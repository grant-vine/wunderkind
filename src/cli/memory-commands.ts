import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { stopProjectMemoryWorker } from "./memory-lifecycle.js"
import type { ResolvedMemoryConfig } from "./types.js"
import { MemoryLedger, MemoryWorker, createOllamaExtractor, memoryWorkerSocketPath } from "../memory/index.js"
import { resolveMemoryDirectory } from "../memory/paths.js"

export type MemoryCommandAction = "status" | "start" | "stop" | "capture" | "recall" | "rebuild" | "forget-fact" | "forget-source" | "export"

export interface MemoryCommandInput {
  readonly action: MemoryCommandAction
  readonly projectRoot: string
  readonly memory: ResolvedMemoryConfig
  readonly filePath?: string
  readonly sourceId?: string
  readonly query?: string
  readonly factId?: string
  readonly outputPath?: string
  readonly force?: boolean
}

export type MemoryCommandResult =
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly code: string }

function failure(error: unknown): MemoryCommandResult {
  return { ok: false, code: error instanceof Error ? error.message : "memory operation unavailable" }
}

function requireValue(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === "") throw new Error(`${label} is required`)
  return value
}

function readText(path: string): string {
  const resolved = resolve(path)
  if (!existsSync(resolved)) throw new Error("capture file does not exist")
  return readFileSync(resolved, "utf8")
}

function createExtractor(memory: ResolvedMemoryConfig) {
  const model = memory.extraction.ollama.model
  if (model === undefined) throw new Error("memory.extraction.ollama.model is required for explicit capture")
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

function explicitCaptureError(memory: ResolvedMemoryConfig): string | null {
  if (!memory.enabled) return "memory.enabled must be true before explicit capture"
  if (memory.extraction.ollama.model === undefined || memory.extraction.ollama.model.trim() === "") {
    return "memory.extraction.ollama.model is required for explicit capture"
  }
  return null
}

function workerPidPath(projectRoot: string): string {
  return `${resolveMemoryDirectory(projectRoot)}/worker.pid`
}

function isLivePid(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function status(projectRoot: string, memory: ResolvedMemoryConfig): Record<string, unknown> {
  if (!memory.enabled) return { enabled: false, running: false, captureEnabled: false, injectionEnabled: false }
  const pidPath = workerPidPath(projectRoot)
  const pid = existsSync(pidPath) ? Number.parseInt(readFileSync(pidPath, "utf8"), 10) : NaN
  const running = Number.isSafeInteger(pid) && isLivePid(pid)
  const ledger = new MemoryLedger({ projectRoot })
  try {
    return { enabled: true, running, captureEnabled: memory.captureEnabled, injectionEnabled: memory.injectionEnabled, counts: ledger.getCounts() }
  } finally {
    ledger.close()
  }
}

function workerReadyPath(projectRoot: string): string {
  return `${resolveMemoryDirectory(projectRoot)}/worker.ready`
}

function workerIsReady(childPid: number, readyPath: string, socketPath: string): boolean {
  if (!existsSync(readyPath) || !existsSync(socketPath)) return false
  try {
    return readFileSync(readyPath, "utf8").trim() === `${childPid}`
  } catch {
    return false
  }
}

function waitForWorkerReady(child: ChildProcess, readyPath: string, socketPath: string): Promise<boolean> {
  const childPid = child.pid
  if (childPid === undefined) return Promise.resolve(false)
  return new Promise((resolve) => {
    let complete = false
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (ready: boolean): void => {
      if (complete) return
      complete = true
      if (timeout !== undefined) clearTimeout(timeout)
      if (pollTimer !== undefined) clearTimeout(pollTimer)
      child.removeListener("exit", onExit)
      resolve(ready)
    }
    const onExit = (): void => finish(false)
    const poll = (): void => {
      if (workerIsReady(childPid, readyPath, socketPath)) {
        finish(true)
        return
      }
      pollTimer = setTimeout(poll, 20)
    }
    child.once("exit", onExit)
    timeout = setTimeout(() => finish(false), 2000)
    poll()
  })
}

async function startWorker(projectRoot: string, memory: ResolvedMemoryConfig): Promise<MemoryCommandResult> {
  if (process.versions.bun === undefined) {
    return { ok: false, code: "memory worker start requires Bun runtime" }
  }
  if (memory.extraction.ollama.model === undefined) {
    return { ok: false, code: "memory.extraction.ollama.model is required to start a memory worker" }
  }
  const pidPath = workerPidPath(projectRoot)
  const socketPath = memoryWorkerSocketPath(projectRoot)
  if (existsSync(pidPath)) {
    const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10)
    if (Number.isSafeInteger(pid) && isLivePid(pid)) return { ok: false, code: "memory worker is already running" }
  }
  const readyPath = workerReadyPath(projectRoot)
  const compiledServicePath = new URL("./memory-worker-service.js", import.meta.url).pathname
  const servicePath = existsSync(compiledServicePath)
    ? compiledServicePath
    : new URL("./memory-worker-service.ts", import.meta.url).pathname
  const child = spawn(process.execPath, [servicePath, projectRoot, JSON.stringify(memory)], {
    detached: true,
    stdio: "ignore",
  })
  if (!await waitForWorkerReady(child, readyPath, socketPath)) {
    child.kill("SIGTERM")
    return { ok: false, code: "memory worker did not become ready" }
  }
  child.unref()
  return { ok: true, value: { started: true, pid: child.pid } }
}

export async function executeMemoryCommand(input: MemoryCommandInput): Promise<MemoryCommandResult> {
  try {
    if (input.action === "status") return { ok: true, value: status(input.projectRoot, input.memory) }
    if (input.action === "stop") {
      const result = await stopProjectMemoryWorker(input.projectRoot)
      if (result === "failed") return { ok: false, code: "memory worker did not stop" }
      return { ok: true, value: { stopped: result === "stopped" } }
    }
    if (!input.memory.enabled) return { ok: false, code: "memory.enabled must be true before explicit capture" }

    if (input.action === "start") {
      return await startWorker(input.projectRoot, input.memory)
    }
    if (input.action === "capture") {
      const captureError = explicitCaptureError(input.memory)
      if (captureError !== null) return { ok: false, code: captureError }
      const sourceId = input.sourceId ?? `capture-${Date.now()}`
      const content = readText(requireValue(input.filePath, "--file"))
      const ledger = new MemoryLedger({ projectRoot: input.projectRoot })
      try {
        const worker = new MemoryWorker({ ledger, extractor: createExtractor(input.memory), maxQueue: input.memory.extraction.ollama.maxQueue })
        const result = await worker.enqueue({ eventId: sourceId, source: sourceId, occurredAt: Date.now(), excerpt: content, sensitivity: "internal" })
        if (result.status !== "processed" && result.status !== "duplicate") return { ok: false, code: `capture ${result.status}` }
        return { ok: true, value: { sourceId, factIds: result.factIds } }
      } finally {
        ledger.close()
      }
    }

    const ledger = new MemoryLedger({ projectRoot: input.projectRoot })
    try {
      if (input.action === "recall") {
        const query = requireValue(input.query, "--query")
        const facts = ledger.findRelevantFacts({ query }).map((entry) => ({ fact: entry.fact, sourceEventIds: entry.sourceEventIds }))
        return { ok: true, value: { facts } }
      }
      if (input.action === "rebuild") return { ok: true, value: { view: ledger.readMarkdownView() } }
      if (input.action === "forget-fact") {
        ledger.forgetFact(requireValue(input.factId, "--id"))
        return { ok: true, value: { forgotten: "fact" } }
      }
      if (input.action === "forget-source") {
        ledger.forgetSource(requireValue(input.sourceId, "--id"))
        return { ok: true, value: { forgotten: "source" } }
      }
      if (input.action === "export") {
        const outputPath = resolve(requireValue(input.outputPath, "--output"))
        if (existsSync(outputPath) && input.force !== true) return { ok: false, code: "export target exists; pass --force to replace it" }
        const facts = ledger.listActiveFacts().map((fact) => ({ ...fact }))
        writeFileSync(outputPath, `${JSON.stringify({ facts }, null, 2)}\n`, { flag: input.force === true ? "w" : "wx" })
        return { ok: true, value: { outputPath, facts: facts.length } }
      }
      return { ok: false, code: "unsupported memory command" }
    } finally {
      ledger.close()
    }
  } catch (error) {
    return failure(error)
  }
}
