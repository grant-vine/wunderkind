import { existsSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ResolvedMemoryConfig } from "./types.js"
import { MemoryLedger, MemoryWorker, MemoryWorkerSocketServer, createOllamaExtractor } from "../memory/index.js"
import { resolveMemoryDirectory } from "../memory/paths.js"

function requireArgument(index: number): string {
  const value = process.argv[index]
  if (value === undefined || value.trim() === "") throw new Error("memory worker argument is required")
  return value
}

function parseConfig(value: string): ResolvedMemoryConfig {
  const parsed: ResolvedMemoryConfig = JSON.parse(value)
  if (!parsed.enabled || parsed.extraction.provider !== "ollama") throw new Error("invalid memory worker configuration")
  return parsed
}

function createExtractor(memory: ResolvedMemoryConfig) {
  const model = memory.extraction.ollama.model
  if (model === undefined) throw new Error("memory model is required")
  return createOllamaExtractor({
    baseUrl: memory.extraction.ollama.baseUrl,
    model,
    timeoutMs: memory.extraction.ollama.timeoutMs,
    maxResponseBytes: memory.extraction.ollama.maxResponseBytes,
    request: async ({ url, body, signal }) => {
      const controller = new AbortController()
      const abort = (): void => controller.abort()
      signal.addEventListener("abort", abort, { once: true })
      try {
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal: controller.signal })
        return { status: response.status, body: await response.text() }
      } finally {
        signal.removeEventListener("abort", abort)
      }
    },
  })
}

function isLivePid(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function removeOwnedFile(path: string, owned: boolean): void {
  if (owned && existsSync(path)) rmSync(path)
}

async function run(): Promise<void> {
  const projectRoot = requireArgument(2)
  const memory = parseConfig(requireArgument(3))
  const runtimeDirectory = resolveMemoryDirectory(projectRoot)
  const lockPath = join(runtimeDirectory, "worker.lock")
  const pidPath = join(runtimeDirectory, "worker.pid")
  const readyPath = join(runtimeDirectory, "worker.ready")
  let ownsLock = false
  let ownsPid = false
  let ownsReady = false
  let ledger: MemoryLedger | null = null
  let server: MemoryWorkerSocketServer | null = null
  let stopping = false
  const stop = async (): Promise<void> => {
    if (stopping) return
    stopping = true
    try {
      if (server !== null) await server.stop()
    } finally {
      if (ledger !== null) ledger.close()
      removeOwnedFile(readyPath, ownsReady)
      removeOwnedFile(pidPath, ownsPid)
      removeOwnedFile(lockPath, ownsLock)
    }
  }
  try {
    if (existsSync(pidPath)) {
      const existingPid = Number.parseInt(readFileSync(pidPath, "utf8"), 10)
      if (Number.isSafeInteger(existingPid) && isLivePid(existingPid)) throw new Error("memory worker is already running")
      rmSync(pidPath)
    }
    if (existsSync(readyPath)) {
      const readyPid = Number.parseInt(readFileSync(readyPath, "utf8"), 10)
      if (Number.isSafeInteger(readyPid) && isLivePid(readyPid)) throw new Error("memory worker is already running")
    }
    if (existsSync(lockPath)) throw new Error("memory worker lock exists")
    openSync(lockPath, "wx", 0o600)
    ownsLock = true
    writeFileSync(pidPath, `${process.pid}\n`, { mode: 0o600 })
    ownsPid = true
    ledger = new MemoryLedger({ projectRoot })
    const worker = new MemoryWorker({ ledger, extractor: createExtractor(memory), maxQueue: memory.extraction.ollama.maxQueue })
    server = new MemoryWorkerSocketServer({ projectRoot, worker })
    await server.start()
    writeFileSync(readyPath, `${process.pid}\n`, { mode: 0o600 })
    ownsReady = true
    process.once("SIGTERM", () => void stop().then(() => process.exit(0), () => process.exit(1)))
    process.once("SIGINT", () => void stop().then(() => process.exit(0), () => process.exit(1)))
  } catch (error) {
    await stop()
    throw error
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "memory worker failed"}\n`)
  process.exit(1)
})
