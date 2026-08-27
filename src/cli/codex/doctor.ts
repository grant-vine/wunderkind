import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import { isCompatibleLazyCodexVersion } from "./registration.js"
import { getCodexCompanionReport, type CodexCompanionReport } from "./companions.js"
import { resolveCodexPaths } from "./paths.js"
import { resolveCodexProjectMarker } from "./project-marker.js"
import { runCodex } from "./process.js"
import { readCodexInstallState, requireCanonicalCodexInstallState, sha256File, type CodexInstallState } from "./state.js"

export interface CodexDoctorOptions { readonly json?: boolean; readonly verbose?: boolean }
export type CodexAgentHealth = "current" | "missing" | "stale-owned" | "modified-unowned"
export type CodexSkillHealth = "current" | "missing" | "modified"
export type CodexPluginHealth = "enabled" | "installed" | "missing" | "unavailable"

export interface CodexDoctorReport {
  readonly schemaVersion: 1
  readonly core: {
    readonly healthy: boolean; readonly state: "missing" | "invalid" | "present"
    readonly codex: { readonly status: CodexPluginHealth; readonly version?: string }
    readonly lazyCodex: { readonly status: CodexPluginHealth; readonly version?: string }
    readonly marketplace: { readonly status: CodexPluginHealth }
    readonly plugin: { readonly status: CodexPluginHealth; readonly version?: string }
    readonly agents: Readonly<Record<string, CodexAgentHealth>>
    readonly pluginManifest: CodexSkillHealth
    readonly skills: Readonly<Record<string, CodexSkillHealth>>
    readonly projectBootstrap: { readonly ready: boolean }
  }
  readonly optional: CodexCompanionReport | { readonly unavailable: true }
  readonly remediation: readonly string[]
  readonly paths?: { readonly codexHome: string; readonly ownershipRoot: string }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function regularFile(path: string): boolean { return existsSync(path) && !lstatSync(path).isSymbolicLink() && lstatSync(path).isFile() }
function parsedJson(stdout: string): unknown | undefined { try { return JSON.parse(stdout) } catch { return undefined } }
function matchesExistingPath(left: string, right: string): boolean { try { return realpathSync(left) === realpathSync(right) } catch { return false } }
function safeVersion(stdout: string): string {
  const value = stdout.trim()
  return /^[A-Za-z0-9._ -]+$/u.test(value) ? value : "reported"
}

function pluginHealth(value: unknown, pluginId: string): { readonly status: CodexPluginHealth; readonly version?: string } {
  if (!isRecord(value) || !Array.isArray(value["installed"])) return { status: "unavailable" }
  const entry = value["installed"].find((candidate) => isRecord(candidate) && candidate["pluginId"] === pluginId)
  if (entry === undefined) return { status: "missing" }
  if (typeof entry["version"] !== "string" || typeof entry["installed"] !== "boolean" || typeof entry["enabled"] !== "boolean") return { status: "unavailable" }
  if (!entry["installed"]) return { status: "unavailable", version: entry["version"] }
  return entry["enabled"] ? { status: "enabled", version: entry["version"] } : { status: "installed", version: entry["version"] }
}

function marketplaceHealth(value: unknown, expectedRoot: string): CodexPluginHealth {
  if (!isRecord(value) || !Array.isArray(value["marketplaces"])) return "unavailable"
  const entry = value["marketplaces"].find((candidate) => isRecord(candidate) && candidate["name"] === CODEX_CAPABILITY_MANIFEST.marketplace.id)
  if (entry === undefined) return "missing"
  const root = typeof entry["path"] === "string" ? entry["path"] : typeof entry["root"] === "string" ? entry["root"] : undefined
  return root !== undefined && matchesExistingPath(root, expectedRoot) ? "enabled" : "installed"
}

function readPayloadHashes(root: string, state: CodexInstallState | undefined): ReadonlyMap<string, string> {
  if (state === undefined || state.payloadManifestSha256 === undefined) return new Map()
  const version = state.packageVersion
  const manifest = join(root, "marketplace", "plugins", "wunderkind", version, "payload-manifest.json")
  if (!regularFile(manifest) || sha256File(manifest) !== state.payloadManifestSha256) return new Map()
  const parsed = parsedJson(readFileSync(manifest, "utf8"))
  if (!isRecord(parsed) || !Array.isArray(parsed["files"])) return new Map()
  const hashes = new Map<string, string>()
  for (const entry of parsed["files"]) {
    if (!isRecord(entry) || typeof entry["path"] !== "string" || typeof entry["sha256"] !== "string") return new Map()
    hashes.set(entry["path"], entry["sha256"])
  }
  return hashes
}

function inspectAgents(state: CodexInstallState | undefined, agentsDir: string): Readonly<Record<string, CodexAgentHealth>> {
  const result: Record<string, CodexAgentHealth> = {}
  for (const agent of CODEX_CAPABILITY_MANIFEST.agents) {
    const path = join(agentsDir, `${agent.id}.toml`)
    const records = state?.agents.filter((entry) => entry.name === agent.id) ?? []
    if (records.length !== 1 || records[0]?.path !== path || (existsSync(path) && lstatSync(path).isSymbolicLink())) {
      result[agent.id] = existsSync(path) ? "modified-unowned" : "missing"
      continue
    }
    const record = records[0]
    if (record === undefined || !regularFile(path)) { result[agent.id] = "missing"; continue }
    result[agent.id] = sha256File(path) === record.sha256 ? "current" : "stale-owned"
  }
  return result
}

function inspectSkills(root: string, state: CodexInstallState | undefined): Readonly<Record<string, CodexSkillHealth>> {
  const version = state?.packageVersion
  const hashes = readPayloadHashes(root, state)
  const result: Record<string, CodexSkillHealth> = {}
  for (const skill of CODEX_CAPABILITY_MANIFEST.skills) {
    const relativePath = `marketplace/plugins/wunderkind/${version ?? "missing"}/skills/${skill.id}/SKILL.md`
    const path = join(root, relativePath)
    const expected = hashes.get(relativePath)
    if (!regularFile(path)) result[skill.id] = "missing"
    else result[skill.id] = expected !== undefined && sha256File(path) === expected ? "current" : "modified"
  }
  return result
}

function inspectPluginManifest(root: string, state: CodexInstallState | undefined): CodexSkillHealth {
  const version = state?.packageVersion
  const relativePath = `marketplace/plugins/wunderkind/${version ?? "missing"}/.codex-plugin/plugin.json`
  const expected = readPayloadHashes(root, state).get(relativePath)
  const path = join(root, relativePath)
  if (!regularFile(path)) return "missing"
  return expected !== undefined && sha256File(path) === expected ? "current" : "modified"
}

function remediationFor(
  state: "missing" | "invalid" | "present",
  codex: { readonly status: CodexPluginHealth },
  lazyCodex: { readonly status: CodexPluginHealth; readonly version?: string },
  marketplace: { readonly status: CodexPluginHealth },
  plugin: { readonly status: CodexPluginHealth; readonly version?: string },
  agents: Readonly<Record<string, CodexAgentHealth>>,
  pluginManifest: CodexSkillHealth,
  skills: Readonly<Record<string, CodexSkillHealth>>,
  packageVersion: string | undefined,
): readonly string[] {
  if (state === "invalid") return ["Repair or restore `~/.wunderkind/codex/install-state.json`; do not overwrite existing `wunderkind-*` agents. Then run `wunderkind codex install`."]
  if (state === "missing") return ["Run `wunderkind codex install` only when no existing `wunderkind-*` agents need preservation; otherwise recover `~/.wunderkind/codex/install-state.json` first."]

  const remediation: string[] = []
  if (codex.status === "unavailable") remediation.push("Install Codex and ensure `codex` is on PATH, then rerun `wunderkind codex doctor`.")

  if (lazyCodex.status === "unavailable") remediation.push("Repair Codex plugin discovery for LazyCodex (`omo@sisyphuslabs`), then rerun `wunderkind codex doctor`.")
  else if (lazyCodex.status === "missing") remediation.push("Install LazyCodex (`omo@sisyphuslabs`) at version `>=4.19.4 <5`, enable it in Codex, then rerun `wunderkind codex doctor`.")
  else if (lazyCodex.status === "installed") remediation.push("Enable LazyCodex (`omo@sisyphuslabs`) in Codex, then rerun `wunderkind codex doctor`.")
  else if (!isCompatibleLazyCodexVersion(lazyCodex.version)) remediation.push("Install LazyCodex (`omo@sisyphuslabs`) at version `>=4.19.4 <5`, then rerun `wunderkind codex doctor`.")

  if (plugin.status === "unavailable") remediation.push("Repair Codex plugin discovery for `wunderkind@grant-vine`, then rerun `wunderkind codex doctor`.")
  else if (plugin.status === "missing") remediation.push("Run `wunderkind codex install` to add `wunderkind@grant-vine`, then rerun `wunderkind codex doctor`.")
  else if (plugin.status === "installed") remediation.push("Enable `wunderkind@grant-vine` in Codex, then rerun `wunderkind codex doctor`.")
  else if (plugin.version !== packageVersion) remediation.push("Run `wunderkind codex install` to re-register the recorded Wunderkind plugin version, then rerun `wunderkind codex doctor`.")

  if (marketplace.status === "unavailable") remediation.push("Repair Codex marketplace discovery for `grant-vine`, then rerun `wunderkind codex doctor`.")
  else if (marketplace.status === "missing") remediation.push("Run `wunderkind codex install` to register the `grant-vine` marketplace, then rerun `wunderkind codex doctor`.")
  else if (marketplace.status === "installed") remediation.push("Resolve the `grant-vine` marketplace root mismatch with the Codex CLI without removing third-party plugins, then rerun `wunderkind codex install`.")

  const agentStatuses = Object.values(agents)
  if (agentStatuses.some((status) => status === "missing")) remediation.push("Restore missing hash-recorded Wunderkind agent files from a trusted package copy before running `wunderkind codex upgrade`.")
  else if (agentStatuses.some((status) => status === "stale-owned" || status === "modified-unowned")) remediation.push("Restore modified Wunderkind agent files from a trusted package copy before running `wunderkind codex upgrade`.")

  if (pluginManifest !== "current" || Object.values(skills).some((status) => status === "missing" || status === "modified")) remediation.push("Restore modified Wunderkind payload files from a trusted package copy, then rerun `wunderkind codex doctor`.")
  return remediation
}

export function getCodexDoctorReport(options: CodexDoctorOptions = {}): CodexDoctorReport {
  const paths = resolveCodexPaths()
  let state: CodexInstallState | undefined
  let stateStatus: "missing" | "invalid" | "present" = "present"
  try {
    state = readCodexInstallState(paths.installState)
    if (state === undefined) stateStatus = "missing"
    else requireCanonicalCodexInstallState(paths, state)
  } catch { stateStatus = "invalid" }
  const version = runCodex(["--version"])
  const codex = version.status === 0 ? { status: "enabled" as const, version: safeVersion(version.stdout) } : { status: "unavailable" as const }
  const pluginsResult = runCodex(["plugin", "list", "--json"])
  const plugins = pluginsResult.status === 0 ? parsedJson(pluginsResult.stdout) : undefined
  const marketplacesResult = runCodex(["plugin", "marketplace", "list", "--json"])
  const marketplaces = marketplacesResult.status === 0 ? parsedJson(marketplacesResult.stdout) : undefined
  const agents = inspectAgents(state, paths.agentsDir)
  const pluginManifest = inspectPluginManifest(paths.ownershipRoot, state)
  const skills = inspectSkills(paths.ownershipRoot, state)
  const lazyCodex = pluginHealth(plugins, CODEX_CAPABILITY_MANIFEST.lazyCodex.pluginId)
  const plugin = pluginHealth(plugins, `${CODEX_CAPABILITY_MANIFEST.plugin.id}@${CODEX_CAPABILITY_MANIFEST.marketplace.id}`)
  const marketplace = { status: marketplaceHealth(marketplaces, state?.marketplace.root ?? paths.marketplaceRoot) }
  const projectBootstrap = { ready: resolveCodexProjectMarker(join(process.cwd(), ".wunderkind", "codex-project.json")).kind === "ready" }
  let optional: CodexCompanionReport | { readonly unavailable: true }
  try { optional = getCodexCompanionReport() } catch { optional = { unavailable: true } }
  const healthy = stateStatus === "present" && codex.status === "enabled" && lazyCodex.status === "enabled" && isCompatibleLazyCodexVersion(lazyCodex.version) && plugin.status === "enabled" && plugin.version === state?.plugin.version && marketplace.status === "enabled" && Object.values(agents).every((status) => status === "current") && pluginManifest === "current" && Object.values(skills).every((status) => status === "current")
  const remediation = healthy ? [] : remediationFor(stateStatus, codex, lazyCodex, marketplace, plugin, agents, pluginManifest, skills, state?.plugin.version)
  return { schemaVersion: 1, core: { healthy, state: stateStatus, codex, lazyCodex, marketplace, plugin, agents, pluginManifest, skills, projectBootstrap }, optional, remediation, ...(options.verbose ? { paths: { codexHome: paths.codexHome, ownershipRoot: paths.ownershipRoot } } : {}) }
}

export function runCodexDoctor(options: CodexDoctorOptions = {}): number {
  const report = getCodexDoctorReport(options)
  if (options.json === true) console.log(JSON.stringify(report))
  else {
    console.log(`Codex core health: ${report.core.healthy ? "healthy" : "needs attention"}`)
    console.log(`Codex: ${report.core.codex.status}${report.core.codex.version === undefined ? "" : ` (${report.core.codex.version})`}`)
    console.log(`LazyCodex: ${report.core.lazyCodex.status}${report.core.lazyCodex.version === undefined ? "" : ` (${report.core.lazyCodex.version})`}`)
    console.log(`Marketplace/plugin: ${report.core.marketplace.status}/${report.core.plugin.status}`)
    for (const [name, status] of Object.entries(report.core.agents)) console.log(`- agent ${name}: ${status}`)
    console.log(`- plugin manifest: ${report.core.pluginManifest}`)
    for (const [name, status] of Object.entries(report.core.skills)) console.log(`- skill ${name}: ${status}`)
    console.log(`Project bootstrap: ${report.core.projectBootstrap.ready ? "ready" : "not attached"}`)
    if (!report.core.healthy) for (const action of report.remediation) console.log(action)
    if ("unavailable" in report.optional) console.log("Optional companions: unavailable (advisory; doctor makes no changes).")
    else console.log(`Optional companions: Matt ${report.optional.matt}; Supabase ${report.optional.supabasePack}; Vercel ${report.optional.vercelPack}; plugins ${Object.entries(report.optional.plugins).map(([id, status]) => `${id}=${status}`).join(", ")}. Advisory only; doctor makes no changes.`)
  }
  return report.core.healthy ? 0 : 1
}
