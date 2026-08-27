import { spawnSync } from "node:child_process"

export interface CodexProcessResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly error?: Error
}

export interface CodexProcessRunner {
  readonly run: (argv: readonly string[]) => CodexProcessResult
}

export interface CodexPluginRemovalExpectation {
  readonly pluginId: string
  readonly name: string
  readonly marketplaceName: string
}

export class CodexProcessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexProcessError"
  }
}

let processRunner: CodexProcessRunner | undefined
export const CODEX_PROCESS_TIMEOUT_MS = 15_000

function defaultRunner(argv: readonly string[]): CodexProcessResult {
  const result = spawnSync("codex", argv, { encoding: "utf8", shell: false, timeout: CODEX_PROCESS_TIMEOUT_MS })
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error instanceof Error ? { error: result.error } : {}),
  }
}

export function runCodex(argv: readonly string[]): CodexProcessResult {
  return (processRunner ?? { run: defaultRunner }).run(argv)
}

export function requireCodexJson(argv: readonly string[], operation: string): unknown {
  const result = runCodex(argv)
  if (result.error !== undefined || result.status !== 0) {
    throw new CodexProcessError(`${operation} failed: ${result.stderr || result.stdout || "codex is unavailable"}`)
  }
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new CodexProcessError(`${operation} returned invalid JSON`)
  }
}

export function requireCodexCli(): void {
  const result = runCodex(["--version"])
  if (result.error !== undefined || result.status !== 0) {
    throw new CodexProcessError("Codex CLI is required. Install Codex and ensure `codex` is on PATH before retrying `wunderkind codex install`.")
  }
}

export function validateCodexPluginRemovalResponse(value: unknown, expected: CodexPluginRemovalExpectation): void {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
    Reflect.get(value, "pluginId") !== expected.pluginId ||
    Reflect.get(value, "name") !== expected.name ||
    Reflect.get(value, "marketplaceName") !== expected.marketplaceName) {
    throw new CodexProcessError("codex plugin remove returned invalid JSON")
  }
}

export function __setCodexProcessRunnerForTests(runner: CodexProcessRunner): void {
  processRunner = runner
}

export function __resetCodexProcessRunnerForTests(): void {
  processRunner = undefined
}
