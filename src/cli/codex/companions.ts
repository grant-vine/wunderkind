import { existsSync, lstatSync, readdirSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import { resolveCodexPaths } from "./paths.js"
import { requireCodexJson } from "./process.js"

export type CodexCompanionStatus = "installed" | "enabled" | "available" | "absent"

export interface CodexCompanionReport {
  readonly plugins: Readonly<Record<string, CodexCompanionStatus>>
  readonly matt: CodexCompanionStatus
  readonly supabasePack: CodexCompanionStatus
  readonly vercelPack: CodexCompanionStatus
}

export class CodexCompanionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexCompanionError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pluginStatus(value: unknown, pluginId: string): CodexCompanionStatus {
  if (!isRecord(value) || !Array.isArray(value["installed"]) || !Array.isArray(value["available"])) throw new CodexCompanionError("codex plugin list returned invalid JSON")
  const installed = value["installed"].find((entry) => isRecord(entry) && entry["pluginId"] === pluginId)
  if (installed !== undefined) {
    if (installed["enabled"] === true) return "enabled"
    if (installed["installed"] === true) return "installed"
    throw new CodexCompanionError("codex plugin list returned invalid JSON")
  }
  return value["available"].some((entry) => isRecord(entry) && entry["pluginId"] === pluginId) ? "available" : "absent"
}

function isSafeDirectory(path: string): boolean {
  return existsSync(path) && !lstatSync(path).isSymbolicLink() && lstatSync(path).isDirectory()
}

function confinedSkillsRoot(trustedRoot: string, segments: readonly string[]): string | undefined {
  const root = resolve(trustedRoot)
  const candidate = resolve(root, ...segments)
  const suffix = relative(root, candidate)
  if (suffix === "" || suffix === ".." || suffix.startsWith(`..${sep}`) || suffix.startsWith(sep) || !isSafeDirectory(root)) return undefined
  let current = root
  for (const segment of segments) {
    current = join(current, segment)
    if (!isSafeDirectory(current)) return undefined
  }
  return candidate
}

function rootContainsSkill(root: string, skill: string): boolean {
  const candidate = join(root, skill)
  const skillFile = join(candidate, "SKILL.md")
  return isSafeDirectory(candidate) && existsSync(skillFile) && !lstatSync(skillFile).isSymbolicLink() && lstatSync(skillFile).isFile()
}

function installedSkillNames(): readonly string[] {
  const paths = resolveCodexPaths()
  const roots = [
    confinedSkillsRoot(paths.codexHome, ["skills"]),
    confinedSkillsRoot(process.cwd(), [".codex", "skills"]),
  ]
  return roots.flatMap((root) => {
    if (root === undefined) return []
    return readdirSync(root).filter((entry) => rootContainsSkill(root, entry))
  })
}

function skillPackStatus(names: readonly string[], expected: readonly string[]): CodexCompanionStatus {
  if (expected.every((skill) => names.includes(skill))) return "enabled"
  return expected.some((skill) => names.includes(skill)) ? "installed" : "absent"
}

export function getCodexCompanionReport(): CodexCompanionReport {
  const discovered = requireCodexJson(["plugin", "list", "--available", "--json"], "codex plugin list --available")
  const plugins = Object.fromEntries(CODEX_CAPABILITY_MANIFEST.optionalCompanions.plugins.map((id) => [id, pluginStatus(discovered, id)]))
  const skillNames = installedSkillNames()
  return {
    plugins,
    matt: skillPackStatus(skillNames, CODEX_CAPABILITY_MANIFEST.optionalCompanions.mattSkills),
    supabasePack: skillPackStatus(skillNames, CODEX_CAPABILITY_MANIFEST.optionalCompanions.supabaseSkills),
    vercelPack: skillPackStatus(skillNames, ["vercel"]),
  }
}
