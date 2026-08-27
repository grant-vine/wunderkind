import { existsSync, lstatSync, readFileSync, realpathSync, rmSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import { resolveCodexPaths } from "./paths.js"
import { verifyCodexPayload } from "./payload.js"
import { requireCodexJson, validateCodexPluginRemovalResponse } from "./process.js"
import { readCodexInstallStateSnapshot, removeOwnedFileIfHashMatches, requireCanonicalCodexInstallState, sha256Bytes, sha256File, type CodexInstallState } from "./state.js"

export interface CodexUninstallResult {
  readonly removedAgents: readonly string[]
  readonly preservedAgents: readonly string[]
  readonly marketplaceRemoved: boolean
  readonly stateRemoved: boolean
  readonly recoveryRequired?: boolean
}

export class CodexUninstallError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexUninstallError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function matchesExistingPath(left: string, right: string): boolean {
  try {
    return realpathSync(left) === realpathSync(right)
  } catch {
    return false
  }
}

function parseMarketplaceRoots(value: unknown): readonly { readonly name: string; readonly root: string }[] {
  if (!isRecord(value) || !Array.isArray(value["marketplaces"])) throw new CodexUninstallError("codex plugin marketplace list returned invalid JSON")
  return value["marketplaces"].map((entry) => {
    if (!isRecord(entry) || typeof entry["name"] !== "string") throw new CodexUninstallError("codex plugin marketplace list returned invalid JSON")
    const root = typeof entry["path"] === "string" ? entry["path"] : typeof entry["root"] === "string" ? entry["root"] : undefined
    if (root === undefined) throw new CodexUninstallError("codex plugin marketplace list returned invalid JSON")
    return { name: entry["name"], root: resolve(root) }
  })
}

function hasOtherMarketplacePlugin(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value["installed"])) throw new CodexUninstallError("codex plugin list returned invalid JSON")
  return value["installed"].some((entry) => isRecord(entry) && entry["marketplaceSource"] === CODEX_CAPABILITY_MANIFEST.marketplace.id && entry["pluginId"] !== `${CODEX_CAPABILITY_MANIFEST.plugin.id}@${CODEX_CAPABILITY_MANIFEST.marketplace.id}`)
}

function removeOwnedPayload(root: string, stateVersion: string, manifestHash: string | undefined): boolean {
  const manifest = join(root, "marketplace", "plugins", "wunderkind", stateVersion, "payload-manifest.json")
  if (manifestHash === undefined || !existsSync(manifest) || lstatSync(manifest).isSymbolicLink() || sha256File(manifest) !== manifestHash) return false
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(manifest, "utf8"))
  } catch {
    return false
  }
  if (!isRecord(parsed) || !Array.isArray(parsed["files"])) return false
  const entries = parsed["files"]
  if (!entries.every((entry) => isRecord(entry) && typeof entry["path"] === "string" && typeof entry["sha256"] === "string" && /^[a-f0-9]{64}$/u.test(entry["sha256"]) && (entry["path"].startsWith("marketplace/") || entry["path"].startsWith("agents/")) && !entry["path"].split(/[\\/]/u).includes(".."))) return false
  let complete = true
  for (const entry of entries) {
    if (!entry["path"].startsWith("marketplace/")) continue
    const path = join(root, entry["path"])
    if (!existsSync(path)) continue
    if (!removeOwnedFileIfHashMatches(root, path, entry["sha256"])) { complete = false; continue }
  }
  if (!complete) return false
  return removeOwnedFileIfHashMatches(root, manifest, manifestHash)
}

function fileMatchesHash(path: string, hash: string): boolean {
  return existsSync(path) && !lstatSync(path).isSymbolicLink() && lstatSync(path).isFile() && sha256File(path) === hash
}

function hasPathEntry(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

function physicallyContainedFileMatchesHash(ownershipRoot: string, path: string, hash: string): boolean {
  const root = resolve(ownershipRoot)
  const candidate = resolve(path)
  const suffix = relative(root, candidate)
  if (suffix === "" || suffix === ".." || suffix.startsWith(`..${sep}`) || suffix.startsWith(sep)) return false
  if (!hasPathEntry(root) || lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) return false
  const segments = suffix.split(sep).filter(Boolean)
  let current = root
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment)
    if (!hasPathEntry(current) || lstatSync(current).isSymbolicLink()) return false
    if (index < segments.length - 1 && !lstatSync(current).isDirectory()) return false
  }
  return lstatSync(candidate).isFile() && sha256File(candidate) === hash
}

type MissingStateRecovery =
  | { readonly kind: "absent" }
  | { readonly kind: "unsafe" }
  | { readonly kind: "recovered"; readonly state: CodexInstallState }

function reconstructMissingInstallState(paths: ReturnType<typeof resolveCodexPaths>): MissingStateRecovery {
  if (!hasPathEntry(paths.marketplaceDescriptor)) return { kind: "absent" }
  try {
    const payload = verifyCodexPayload(paths)
    const manifest = join(paths.marketplaceRoot, "plugins", "wunderkind", payload.version, "payload-manifest.json")
    const sourceManifest = join(payload.sourceRoot, "marketplace", "plugins", "wunderkind", payload.version, "payload-manifest.json")
    if (!physicallyContainedFileMatchesHash(paths.ownershipRoot, paths.marketplaceDescriptor, sha256Bytes(payload.descriptor)) || !physicallyContainedFileMatchesHash(paths.ownershipRoot, manifest, sha256File(sourceManifest))) return { kind: "unsafe" }
    for (const entry of payload.entries) {
      if (!entry.path.startsWith("marketplace/")) continue
      if (!physicallyContainedFileMatchesHash(paths.ownershipRoot, join(paths.ownershipRoot, entry.path), entry.sha256)) return { kind: "unsafe" }
    }
    const agents = CODEX_CAPABILITY_MANIFEST.agents.map((agent) => {
      const path = join(paths.agentsDir, `${agent.id}.toml`)
      const entry = payload.entries.find((candidate) => candidate.path === `agents/${agent.id}.toml`)
      if (entry === undefined || !fileMatchesHash(path, entry.sha256)) throw new CodexUninstallError("Codex recovery candidates are not hash-owned")
      return { name: agent.id, path, sha256: entry.sha256 }
    })
    return { kind: "recovered", state: {
      packageVersion: payload.version,
      marketplace: { name: CODEX_CAPABILITY_MANIFEST.marketplace.id, root: paths.marketplaceRoot },
      plugin: { id: CODEX_CAPABILITY_MANIFEST.plugin.id, version: payload.version },
      descriptorSha256: sha256Bytes(payload.descriptor),
      payloadManifestSha256: sha256File(manifest),
      agents,
    } }
  } catch {
    return { kind: "unsafe" }
  }
}

function pruneEmptyDirectories(path: string, stop: string): void {
  let current = path
  while (relative(stop, current) !== "" && existsSync(current)) {
    try {
      rmSync(current)
      current = dirname(current)
    } catch {
      return
    }
  }
}

export function uninstallCodexWunderkind(): CodexUninstallResult {
  const paths = resolveCodexPaths()
  const snapshot = readCodexInstallStateSnapshot(paths.installState)
  const recovery = snapshot === undefined ? reconstructMissingInstallState(paths) : undefined
  if (recovery?.kind === "unsafe") return { removedAgents: [], preservedAgents: [], marketplaceRemoved: false, stateRemoved: false, recoveryRequired: true }
  const state = snapshot?.state ?? (recovery?.kind === "recovered" ? recovery.state : undefined)
  if (state !== undefined) requireCanonicalCodexInstallState(paths, state)
  const removed = requireCodexJson(["plugin", "remove", "wunderkind@grant-vine", "--json"], "codex plugin remove")
  validateCodexPluginRemovalResponse(removed, { pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine" })
  if (state === undefined) return { removedAgents: [], preservedAgents: [], marketplaceRemoved: false, stateRemoved: false }
  const agents = requireCanonicalCodexInstallState(paths, state)
  const marketplaces = parseMarketplaceRoots(requireCodexJson(["plugin", "marketplace", "list", "--json"], "codex plugin marketplace list"))
  const registered = marketplaces.find((entry) => entry.name === CODEX_CAPABILITY_MANIFEST.marketplace.id)
  const otherPluginUsesMarketplace = hasOtherMarketplacePlugin(requireCodexJson(["plugin", "list", "--json"], "codex plugin list"))

  const removedAgents: string[] = []
  const preservedAgents: string[] = []
  for (const agent of agents.values()) {
    if (removeOwnedFileIfHashMatches(paths.codexHome, agent.path, agent.sha256)) removedAgents.push(agent.name)
    else if (existsSync(agent.path)) preservedAgents.push(agent.name)
  }
  const mayRemoveMarketplace = registered !== undefined && matchesExistingPath(registered.root, state.marketplace.root) && !otherPluginUsesMarketplace
  const payloadRemoved = otherPluginUsesMarketplace ? false : removeOwnedPayload(paths.ownershipRoot, state.packageVersion, state.payloadManifestSha256)
  const descriptorRemoved = otherPluginUsesMarketplace ? false : state.descriptorSha256 !== undefined && removeOwnedFileIfHashMatches(paths.ownershipRoot, paths.marketplaceDescriptor, state.descriptorSha256)
  let marketplaceRemoved = false
  if (mayRemoveMarketplace) {
    const response = requireCodexJson(["plugin", "marketplace", "remove", CODEX_CAPABILITY_MANIFEST.marketplace.id, "--json"], "codex plugin marketplace remove")
    if (!isRecord(response) || response["marketplaceName"] !== CODEX_CAPABILITY_MANIFEST.marketplace.id || response["installedRoot"] !== null) throw new CodexUninstallError("codex plugin marketplace remove returned invalid JSON")
    marketplaceRemoved = true
  }
  const safeToRemoveState = removedAgents.length === CODEX_CAPABILITY_MANIFEST.agents.length && preservedAgents.length === 0 && payloadRemoved && descriptorRemoved
  if (safeToRemoveState) {
    if (snapshot === undefined) return { removedAgents, preservedAgents, marketplaceRemoved, stateRemoved: false }
    if (!removeOwnedFileIfHashMatches(paths.ownershipRoot, paths.installState, snapshot.sha256)) return { removedAgents, preservedAgents, marketplaceRemoved, stateRemoved: false, recoveryRequired: true }
    pruneEmptyDirectories(dirname(paths.installState), paths.wunderkindHome)
  }
  return { removedAgents, preservedAgents, marketplaceRemoved, stateRemoved: safeToRemoveState, ...(!safeToRemoveState ? { recoveryRequired: true } : {}) }
}
