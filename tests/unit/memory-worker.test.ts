import { describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createConnection, createServer } from "node:net"
import { MemoryLedger } from "../../src/memory/index.js"
import { normalizeMemoryEvent, type MemoryExtractor } from "../../src/memory/providers.js"
import { MemoryWorker } from "../../src/memory/worker.js"
import { MemoryWorkerSocketServer, enqueueMemoryOverSocket, memoryWorkerSocketPath } from "../../src/memory/worker-socket.js"

function projectRoot(): string {
  return mkdtempSync(join(tmpdir(), "wk-memory-worker-"))
}

function extractor(): MemoryExtractor {
  return { async extract() { return { facts: [{ subject: "project", predicate: "database", value: "SQLite", sensitivity: "internal" }] } } }
}

function capture(): ReturnType<typeof normalizeMemoryEvent> {
  return normalizeMemoryEvent({ eventId: "socket-event", source: "chat", occurredAt: 1_700_000_000_000, excerpt: "token=not-for-socket", sensitivity: "internal" })
}

function readFrame(socket: ReturnType<typeof createConnection>): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = ""
    socket.on("data", (chunk: Buffer) => {
      value += chunk.toString("utf8")
      const newline = value.indexOf("\n")
      if (newline >= 0) resolve(value.slice(0, newline))
    })
    socket.once("error", reject)
  })
}

describe("memory Unix-socket worker", () => {
  it("uses an owner-only Unix socket, processes a capture, and removes the listener on stop", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root, now: () => 1_700_000_000_000 })
    const server = new MemoryWorkerSocketServer({ projectRoot: root, worker: new MemoryWorker({ ledger, extractor: extractor(), maxQueue: 2 }) })

    try {
      await server.start()
      const socketPath = memoryWorkerSocketPath(root)
      const result = await enqueueMemoryOverSocket({ socketPath, event: capture(), enqueueTimeoutMs: 50 })

      expect(statSync(socketPath).mode & 0o777).toBe(0o600)
      expect(result.status).toBe("processed")
      expect(ledger.getCounts().sourceEvents).toBe(1)
      await server.stop()
      expect(existsSync(socketPath)).toBe(false)
    } finally {
      await server.stop()
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("fails closed on malformed socket payload without writing an event", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const server = new MemoryWorkerSocketServer({ projectRoot: root, worker: new MemoryWorker({ ledger, extractor: extractor(), maxQueue: 2 }) })

    try {
      await server.start()
      const result = await enqueueMemoryOverSocket({ socketPath: memoryWorkerSocketPath(root), event: { eventId: "bad" }, enqueueTimeoutMs: 50 })

      expect(result.status).toBe("rejected")
      expect(ledger.getCounts().sourceEvents).toBe(0)
    } finally {
      await server.stop()
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("processes a request split across arbitrary socket chunks", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const server = new MemoryWorkerSocketServer({ projectRoot: root, worker: new MemoryWorker({ ledger, extractor: extractor(), maxQueue: 2 }) })
    let client: ReturnType<typeof createConnection> | null = null

    try {
      await server.start()
      client = createConnection(memoryWorkerSocketPath(root))
      await new Promise<void>((resolve, reject) => {
        client?.once("connect", () => resolve())
        client?.once("error", reject)
      })
      const payload = `${JSON.stringify({ event: capture() })}\n`
      client.write(payload.slice(0, 11))
      client.write(payload.slice(11))
      const frame = await readFrame(client)

      expect(JSON.parse(frame)).toEqual({ result: { status: "processed", factIds: ["socket-event:fact:0"] } })
      expect(ledger.getCounts().sourceEvents).toBe(1)
    } finally {
      client?.destroy()
      await server.stop()
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("processes a response split across arbitrary socket chunks", async () => {
    const root = projectRoot()
    const socketPath = memoryWorkerSocketPath(root)
    const response = `${JSON.stringify({ result: { status: "processed", factIds: ["fact-1"] } })}\n`
    const server = createServer((socket) => {
      socket.once("data", () => {
        socket.write(response.slice(0, 9))
        socket.end(response.slice(9))
      })
    })

    try {
      await new Promise<void>((resolve, reject) => server.listen(socketPath, () => resolve()).once("error", reject))
      const result = await enqueueMemoryOverSocket({ socketPath, event: capture(), enqueueTimeoutMs: 50 })

      expect(result).toEqual({ status: "processed", factIds: ["fact-1"] })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("replaces a stale Unix socket before starting a new worker", async () => {
    const root = projectRoot()
    const socketPath = memoryWorkerSocketPath(root)
    const stagedSocketPath = join(root, ".wunderkind", "stale.sock")
    const stale = createServer()
    const ledger = new MemoryLedger({ projectRoot: root })
    const worker = new MemoryWorkerSocketServer({ projectRoot: root, worker: new MemoryWorker({ ledger, extractor: extractor(), maxQueue: 2 }) })

    try {
      await new Promise<void>((resolve, reject) => stale.listen(socketPath, () => resolve()).once("error", reject))
      renameSync(socketPath, stagedSocketPath)
      await new Promise<void>((resolve) => stale.close(() => resolve()))
      renameSync(stagedSocketPath, socketPath)
      writeFileSync(join(root, ".wunderkind", "worker.ready"), "999999\n")
      expect(existsSync(socketPath)).toBe(true)

      await worker.start()
      const result = await enqueueMemoryOverSocket({ socketPath, event: capture(), enqueueTimeoutMs: 50 })

      expect(result.status).toBe("processed")
    } finally {
      await worker.stop()
      await new Promise<void>((resolve) => stale.close(() => resolve()))
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("stops cleanly when a connected client has not sent a request", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const server = new MemoryWorkerSocketServer({ projectRoot: root, worker: new MemoryWorker({ ledger, extractor: extractor(), maxQueue: 2 }) })
    let client: ReturnType<typeof createConnection> | null = null

    try {
      await server.start()
      client = createConnection(memoryWorkerSocketPath(root))
      await new Promise<void>((resolve, reject) => {
        client?.once("connect", () => resolve())
        client?.once("error", reject)
      })
      await server.stop()

      expect(existsSync(memoryWorkerSocketPath(root))).toBe(false)
    } finally {
      client?.destroy()
      await server.stop()
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("returns before the enqueue deadline for a stalled non-reading worker and writes nothing", async () => {
    const root = projectRoot()
    const socketPath = memoryWorkerSocketPath(root)
    const deadlineMs = 30
    const stalled = createServer(() => undefined)

    try {
      await new Promise<void>((resolve, reject) => stalled.listen(socketPath, () => resolve()).once("error", reject))
      const startedAt = performance.now()
      const result = await enqueueMemoryOverSocket({ socketPath, event: capture(), enqueueTimeoutMs: deadlineMs })
      const elapsedMs = performance.now() - startedAt

      expect(result.status).toBe("timeout")
      expect(elapsedMs < deadlineMs + 100).toBe(true)
    } finally {
      await new Promise<void>((resolve) => stalled.close(() => resolve()))
      rmSync(root, { recursive: true, force: true })
    }
  })
})
