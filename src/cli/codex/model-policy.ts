import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { CodexPaths } from "./paths.js"
import { resolveCodexPaths } from "./paths.js"

export type CodexModelPolicyStatus = "compliant" | "drifted" | "unsafe"

export interface CodexModelPolicyReport {
  readonly status: CodexModelPolicyStatus
  readonly astraAssignments: readonly string[]
  readonly driftedAssignments: readonly string[]
}

export class CodexModelPolicyError extends Error {
  constructor(message: string) {
    super(message)
  }
}

interface CodexModelPolicyTarget {
  readonly id: string
  readonly model: "gpt-6-sol" | "gpt-6-luna"
  readonly path: (paths: CodexPaths) => string
  readonly createWhenMissing: boolean
}

const CODEX_MODEL_POLICY_TARGETS: readonly CodexModelPolicyTarget[] = [
  { id: "root", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "config.toml"), createWhenMissing: true },
  { id: "lazycodex-worker-high", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "lazycodex-worker-high.toml"), createWhenMissing: false },
  { id: "lazycodex-code-reviewer", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "lazycodex-code-reviewer.toml"), createWhenMissing: false },
  { id: "lazycodex-clone-fidelity-reviewer", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "lazycodex-clone-fidelity-reviewer.toml"), createWhenMissing: false },
  { id: "metis", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "metis.toml"), createWhenMissing: false },
  { id: "momus", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "momus.toml"), createWhenMissing: false },
  { id: "lazycodex-gate-reviewer", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "lazycodex-gate-reviewer.toml"), createWhenMissing: false },
  { id: "plan", model: "gpt-6-sol", path: (paths) => join(paths.codexHome, "agents", "plan.toml"), createWhenMissing: false },
  { id: "lazycodex-worker-low", model: "gpt-6-luna", path: (paths) => join(paths.codexHome, "agents", "lazycodex-worker-low.toml"), createWhenMissing: false },
  { id: "lazycodex-worker-medium", model: "gpt-6-luna", path: (paths) => join(paths.codexHome, "agents", "lazycodex-worker-medium.toml"), createWhenMissing: false },
  { id: "explorer", model: "gpt-6-luna", path: (paths) => join(paths.codexHome, "agents", "explorer.toml"), createWhenMissing: false },
  { id: "librarian", model: "gpt-6-luna", path: (paths) => join(paths.codexHome, "agents", "librarian.toml"), createWhenMissing: false },
  { id: "lazycodex-qa-executor", model: "gpt-6-luna", path: (paths) => join(paths.codexHome, "agents", "lazycodex-qa-executor.toml"), createWhenMissing: false },
] as const

function configuredModel(content: string): string | undefined {
  return /^model\s*=\s*"([^"]+)"\s*$/mu.exec(content)?.[1]
}

function renderModelOverride(content: string, model: CodexModelPolicyTarget["model"]): string {
  if (/^model\s*=\s*"[^"]+"\s*$/mu.test(content)) {
    return content.replace(/^model\s*=\s*"[^"]+"\s*$/mu, `model = "${model}"`)
  }

  const suffix = content.length === 0 || content.endsWith("\n") ? "" : "\n"
  return `${content}${suffix}model = "${model}"\n`
}

function isRegularFile(path: string): boolean {
  return existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink()
}

function reportFor(paths: CodexPaths): CodexModelPolicyReport {
  const astraAssignments: string[] = []
  const driftedAssignments: string[] = []
  let unsafe = false

  for (const target of CODEX_MODEL_POLICY_TARGETS) {
    const path = target.path(paths)
    if (!existsSync(path)) {
      continue
    }
    if (!isRegularFile(path)) {
      unsafe = true
      driftedAssignments.push(target.id)
      continue
    }

    const model = configuredModel(readFileSync(path, "utf8"))
    if (model === "gpt-6-astra") astraAssignments.push(target.id)
    if (model !== target.model) driftedAssignments.push(target.id)
  }

  return {
    status: unsafe ? "unsafe" : driftedAssignments.length === 0 ? "compliant" : "drifted",
    astraAssignments,
    driftedAssignments,
  }
}

export function inspectCodexModelPolicy(paths = resolveCodexPaths()): CodexModelPolicyReport {
  return reportFor(paths)
}

export function applyCodexModelPolicy(paths = resolveCodexPaths()): CodexModelPolicyReport {
  for (const target of CODEX_MODEL_POLICY_TARGETS) {
    const path = target.path(paths)
    if (!existsSync(path)) {
      if (!target.createWhenMissing) continue
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, `model = "${target.model}"\n`, "utf8")
      continue
    }
    if (!isRegularFile(path)) throw new CodexModelPolicyError(`Refusing to modify non-regular Codex model policy file: ${path}`)

    const content = readFileSync(path, "utf8")
    const next = renderModelOverride(content, target.model)
    if (next !== content) writeFileSync(path, next, "utf8")
  }

  return reportFor(paths)
}
