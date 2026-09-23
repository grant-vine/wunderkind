import { describe, expect, it } from "bun:test"
import { spawn } from "node:child_process"
import { createServer as createHttpServer } from "node:http"
import { createServer as createSocketServer } from "node:net"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { executeMemoryCommand } from "../../src/cli/memory-commands.js"

function memoryConfig(port: number) {
  return {
    enabled: true,
    captureEnabled: false,
    injectionEnabled: false,
    extraction: {
      provider: "ollama" as const,
      ollama: { baseUrl: `http://127.0.0.1:${port}`, model: "fake", timeoutMs: 5000, enqueueTimeoutMs: 75, maxQueue: 64, maxResponseBytes: 32768 },
    },
  }
}

async function startFakeOllama(): Promise<{ readonly port: number; readonly close: () => Promise<void> }> {
  const server = createHttpServer((_request, response) => {
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify({ response: JSON.stringify({ facts: [{ subject: "fixture", predicate: "records", value: "local lifecycle", sensitivity: "internal" }] }) }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("fake server did not bind a port")
  return { port: address.port, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

describe("memory CLI operations", () => {
  it("treats stop as an idempotent no-op when memory is disabled", async () => {
    const project = mkdtempSync(join(tmpdir(), "wk-memory-stop-disabled-"))
    try {
      const disabledMemory = {
        enabled: false,
        captureEnabled: false,
        injectionEnabled: false,
        extraction: { provider: "ollama" as const, ollama: { baseUrl: "http://127.0.0.1:11434", timeoutMs: 5000, enqueueTimeoutMs: 75, maxQueue: 64, maxResponseBytes: 32768 } },
      }
      expect(await executeMemoryCommand({ action: "stop", projectRoot: project, memory: disabledMemory })).toEqual({
        ok: true,
        value: { stopped: false },
      })
      expect(await executeMemoryCommand({ action: "stop", projectRoot: project, memory: disabledMemory })).toEqual({
        ok: true,
        value: { stopped: false },
      })
      expect(existsSync(join(project, ".wunderkind", "runtime", "memory"))).toBe(false)
      expect(existsSync(join(project, ".wunderkind", "memory.sqlite"))).toBe(false)
      expect(existsSync(join(project, ".wunderkind", "m.sock"))).toBe(false)
      expect(existsSync(join(project, ".wunderkind", "worker.pid"))).toBe(false)
      expect(existsSync(join(project, ".wunderkind", "worker.lock"))).toBe(false)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })

  it("fails closed when explicit capture is requested without enabled memory", async () => {
    const result = await executeMemoryCommand({
      action: "capture",
      projectRoot: process.cwd(),
      memory: {
        enabled: false,
        captureEnabled: false,
        injectionEnabled: false,
        extraction: { provider: "ollama", ollama: { baseUrl: "http://127.0.0.1:11434", timeoutMs: 5000, enqueueTimeoutMs: 75, maxQueue: 64, maxResponseBytes: 32768 } },
      },
      filePath: "fixture.txt",
    })

    expect(result).toEqual({ ok: false, code: "memory.enabled must be true before explicit capture" })
  })

  it("captures, recalls, forgets, and exports facts without raw excerpts", async () => {
    const project = mkdtempSync(join(tmpdir(), "wk-memory-cli-"))
    const capturePath = join(project, "capture.txt")
    writeFileSync(capturePath, "fixture raw excerpt must not be exported")
    const fake = await startFakeOllama()
    try {
      const capture = await executeMemoryCommand({ action: "capture", projectRoot: project, memory: memoryConfig(fake.port), filePath: capturePath, sourceId: "fixture-1" })
      expect(capture).toEqual({ ok: true, value: { sourceId: "fixture-1", factIds: ["fixture-1:fact:0"] } })
      const recall = await executeMemoryCommand({ action: "recall", projectRoot: project, memory: memoryConfig(fake.port), query: "fixture" })
      if (!recall.ok) throw new Error(recall.code)
      const recalled = JSON.stringify(recall.value["facts"])
      expect(recalled).toContain('"id":"fixture-1:fact:0"')
      expect(recalled).toContain('"value":"local lifecycle"')
      expect(recalled).toContain('"sourceEventIds":["fixture-1"]')
      const exportPath = join(project, "memory.json")
      const exported = await executeMemoryCommand({ action: "export", projectRoot: project, memory: memoryConfig(fake.port), outputPath: exportPath })
      expect(exported).toEqual({ ok: true, value: { outputPath: exportPath, facts: 1 } })
      expect(readFileSync(exportPath, "utf8")).not.toContain("fixture raw excerpt")
      const forgotten = await executeMemoryCommand({ action: "forget-source", projectRoot: project, memory: memoryConfig(fake.port), sourceId: "fixture-1" })
      expect(forgotten).toEqual({ ok: true, value: { forgotten: "source" } })
      expect(await executeMemoryCommand({ action: "recall", projectRoot: project, memory: memoryConfig(fake.port), query: "fixture" })).toEqual({ ok: true, value: { facts: [] } })
    } finally {
      await fake.close()
      rmSync(project, { recursive: true, force: true })
    }
  })

  it("returns from start only after the detached worker owns its socket", async () => {
    const project = mkdtempSync(join(tmpdir(), "wk-memory-start-"))
    const fake = await startFakeOllama()
    try {
      const started = await executeMemoryCommand({ action: "start", projectRoot: project, memory: memoryConfig(fake.port) })
      if (!started.ok) throw new Error(started.code)
      expect(started.value["started"]).toBe(true)
      expect(existsSync(join(project, ".wunderkind", "m.sock"))).toBe(true)
      expect(await executeMemoryCommand({ action: "stop", projectRoot: project, memory: memoryConfig(fake.port) })).toEqual({ ok: true, value: { stopped: true } })
    } finally {
      await fake.close()
      rmSync(project, { recursive: true, force: true })
    }
  })

  it("does not remove an unknown live worker socket while starting", async () => {
    const project = mkdtempSync(join(tmpdir(), "wk-memory-live-socket-"))
    const runtimeDirectory = join(project, ".wunderkind")
    const socketPath = join(runtimeDirectory, "m.sock")
    mkdirSync(runtimeDirectory, { recursive: true })
    const existingServer = createSocketServer((socket) => socket.destroy())
    await new Promise<void>((resolve, reject) => {
      existingServer.once("error", reject)
      existingServer.listen(socketPath, () => {
        existingServer.removeListener("error", reject)
        resolve()
      })
    })
    try {
      expect(await executeMemoryCommand({ action: "start", projectRoot: project, memory: memoryConfig(1) })).toEqual({ ok: false, code: "memory worker did not become ready" })
      expect(existsSync(socketPath)).toBe(true)
      expect(existsSync(join(runtimeDirectory, "worker.pid"))).toBe(false)
      expect(existsSync(join(runtimeDirectory, "worker.lock"))).toBe(false)
    } finally {
      await new Promise<void>((resolve, reject) => existingServer.close((error) => error ? reject(error) : resolve()))
      rmSync(project, { recursive: true, force: true })
    }
  })

  it("removes worker ownership files when ledger initialization fails", async () => {
    const project = mkdtempSync(join(tmpdir(), "wk-memory-init-failure-"))
    const runtimeDirectory = join(project, ".wunderkind")
    const servicePath = new URL("../../src/cli/memory-worker-service.ts", import.meta.url).pathname
    mkdirSync(join(runtimeDirectory, "memory.sqlite"), { recursive: true })
    try {
      const child = spawn(process.execPath, [servicePath, project, JSON.stringify(memoryConfig(1))], { stdio: "ignore" })
      const exitCode = await new Promise<number | null>((resolve) => child.once("exit", resolve))
      expect(exitCode).not.toBe(0)
      expect(existsSync(join(runtimeDirectory, "worker.lock"))).toBe(false)
      expect(existsSync(join(runtimeDirectory, "worker.pid"))).toBe(false)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })
})
