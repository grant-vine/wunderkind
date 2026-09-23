import { chmodSync, existsSync, lstatSync, readFileSync, rmSync } from "node:fs"
import { createConnection, createServer, type Server, type Socket } from "node:net"
import { dirname, join } from "node:path"
import { MemoryLedgerError } from "./errors.js"
import { normalizeMemoryEvent, type MemoryCaptureInput } from "./providers.js"
import { resolveMemoryDirectory } from "./paths.js"
import { MemoryWorker, type MemoryWorkerResult } from "./worker.js"

const MAX_SOCKET_MESSAGE_BYTES = 65536

export interface MemoryWorkerSocketServerOptions {
  readonly projectRoot: string
  readonly worker: MemoryWorker
}

export interface MemorySocketEnqueueOptions {
  readonly socketPath: string
  readonly event: unknown
  readonly enqueueTimeoutMs: number
}

interface SocketRequest {
  readonly event: MemoryCaptureInput
}

interface SocketResponse {
  readonly result: MemoryWorkerResult
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSensitivity(value: unknown): value is MemoryCaptureInput["sensitivity"] {
  return value === "public" || value === "internal" || value === "sensitive"
}

function parseCapture(value: unknown): MemoryCaptureInput | null {
  if (!isRecord(value)) return null
  if (typeof value["eventId"] !== "string" || typeof value["source"] !== "string" || typeof value["occurredAt"] !== "number" || typeof value["excerpt"] !== "string" || !isSensitivity(value["sensitivity"])) {
    return null
  }
  return {
    eventId: value["eventId"],
    source: value["source"],
    occurredAt: value["occurredAt"],
    excerpt: value["excerpt"],
    sensitivity: value["sensitivity"],
  }
}

function parseRequest(value: unknown): SocketRequest | null {
  if (!isRecord(value)) return null
  const event = parseCapture(value["event"])
  return event ? { event } : null
}

function parseResponse(value: unknown): MemoryWorkerResult | null {
  if (!isRecord(value) || !isRecord(value["result"])) return null
  const result = value["result"]
  const status = result["status"]
  const factIds = result["factIds"]
  if ((status !== "processed" && status !== "duplicate" && status !== "omitted" && status !== "rejected" && status !== "timeout" && status !== "unavailable" && status !== "failed") || !Array.isArray(factIds) || !factIds.every((id) => typeof id === "string")) {
    return null
  }
  return { status, factIds }
}

function readSocketFrame(socket: Socket): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let byteLength = 0
    let settled = false
    const complete = (frame: string | null): void => {
      if (settled) return
      settled = true
      socket.removeListener("data", onData)
      socket.removeListener("error", onFailure)
      socket.removeListener("close", onFailure)
      resolve(frame)
    }
    const onFailure = (): void => complete(null)
    const onData = (chunk: Buffer): void => {
      byteLength += chunk.byteLength
      if (byteLength > MAX_SOCKET_MESSAGE_BYTES) {
        complete(null)
        return
      }
      chunks.push(chunk)
      const received = Buffer.concat(chunks)
      const newline = received.indexOf(10)
      if (newline >= 0) complete(received.subarray(0, newline).toString("utf8"))
    }
    socket.on("data", onData)
    socket.once("error", onFailure)
    socket.once("close", onFailure)
  })
}

function writeResponse(socket: Socket, result: MemoryWorkerResult): void {
  socket.end(`${JSON.stringify({ result } satisfies SocketResponse)}\n`)
}

function reject(socket: Socket): void {
  writeResponse(socket, { status: "rejected", factIds: [] })
}

export function memoryWorkerSocketPath(projectRoot: string): string {
  return join(resolveMemoryDirectory(projectRoot), "m.sock")
}

export class MemoryWorkerSocketServer {
  readonly #socketPath: string
  readonly #worker: MemoryWorker
  #server: Server | null = null
  readonly #inFlight = new Set<Promise<void>>()
  readonly #sockets = new Set<Socket>()

  constructor(options: MemoryWorkerSocketServerOptions) {
    this.#socketPath = memoryWorkerSocketPath(options.projectRoot)
    this.#worker = options.worker
  }

  async start(): Promise<void> {
    if (this.#server) return
    await this.#prepareSocketPath()
    const server = createServer((socket) => {
      this.#sockets.add(socket)
      socket.once("close", () => this.#sockets.delete(socket))
      this.#track(this.#serve(socket))
    })
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(this.#socketPath, () => {
        server.removeListener("error", reject)
        resolve()
      })
    })
    chmodSync(this.#socketPath, 0o600)
    this.#server = server
  }

  async stop(): Promise<void> {
    const server = this.#server
    if (!server) return
    this.#server = null
    for (const socket of this.#sockets) socket.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await Promise.all([...this.#inFlight])
    if (existsSync(this.#socketPath)) rmSync(this.#socketPath)
  }

  async #prepareSocketPath(): Promise<void> {
    chmodSync(dirname(this.#socketPath), 0o700)
    if (!existsSync(this.#socketPath)) return
    if (!lstatSync(this.#socketPath).isSocket()) throw new MemoryLedgerError("containment")
    if (await this.#hasLiveListener()) throw new MemoryLedgerError("locked")
    if (!this.#hasKnownDeadOwner()) throw new MemoryLedgerError("locked")
    rmSync(this.#socketPath)
  }

  #hasKnownDeadOwner(): boolean {
    const readyPath = join(dirname(this.#socketPath), "worker.ready")
    if (!existsSync(readyPath)) return false
    const pid = Number.parseInt(readFileSync(readyPath, "utf8"), 10)
    if (!Number.isSafeInteger(pid)) return false
    try {
      process.kill(pid, 0)
      return false
    } catch {
      return true
    }
  }

  #hasLiveListener(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection(this.#socketPath)
      let settled = false
      const complete = (active: boolean): void => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(active)
      }
      socket.once("connect", () => complete(true))
      socket.once("error", () => complete(false))
    })
  }

  #track(work: Promise<void>): void {
    this.#inFlight.add(work)
    work.finally(() => this.#inFlight.delete(work)).catch(() => undefined)
  }

  async #serve(socket: Socket): Promise<void> {
    const controller = new AbortController()
    socket.once("close", () => controller.abort())
    const frame = await readSocketFrame(socket)
    if (frame === null) {
      reject(socket)
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(frame)
    } catch {
      reject(socket)
      return
    }
    const request = parseRequest(parsed)
    if (!request) {
      reject(socket)
      return
    }
    try {
      writeResponse(socket, await this.#worker.enqueue(normalizeMemoryEvent(request.event), controller.signal))
    } catch {
      reject(socket)
    }
  }
}

export async function enqueueMemoryOverSocket(options: MemorySocketEnqueueOptions): Promise<MemoryWorkerResult> {
  const event = parseCapture(options.event)
  if (!event || !Number.isSafeInteger(options.enqueueTimeoutMs) || options.enqueueTimeoutMs < 10) {
    return { status: "rejected", factIds: [] }
  }
  let normalized: MemoryCaptureInput
  try {
    normalized = normalizeMemoryEvent(event)
  } catch {
    return { status: "rejected", factIds: [] }
  }
  const socket = createConnection(options.socketPath)
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ readonly kind: "timeout" }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ kind: "timeout" }), options.enqueueTimeoutMs)
  })
  try {
    socket.once("connect", () => socket.write(`${JSON.stringify({ event: normalized })}\n`))
    const result = await Promise.race([
      readSocketFrame(socket).then((frame) => ({ kind: "frame" as const, frame })),
      timeout,
    ])
    if (result.kind === "timeout") return { status: "timeout", factIds: [] }
    if (result.frame === null) return { status: "unavailable", factIds: [] }
    try {
      return parseResponse(JSON.parse(result.frame)) ?? { status: "rejected", factIds: [] }
    } catch {
      return { status: "rejected", factIds: [] }
    }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    socket.destroy()
  }
}
