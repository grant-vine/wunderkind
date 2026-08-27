import { realpathSync } from "node:fs"
import { resolve } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import type { CodexPaths } from "./paths.js"
import { requireCodexJson, runCodex, validateCodexPluginRemovalResponse } from "./process.js"

interface CodexPluginRecord {
  readonly pluginId: string
  readonly version: string
  readonly installed: boolean
  readonly enabled: boolean
}

export class CodexInstallError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexInstallError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parsePlugins(value: unknown): readonly CodexPluginRecord[] {
  if (!isRecord(value) || !Array.isArray(value["installed"]) || !Array.isArray(value["available"])) {
    throw new CodexInstallError("codex plugin list returned invalid JSON")
  }
  return value["installed"].map((entry): CodexPluginRecord => {
    if (!isRecord(entry) || typeof entry["pluginId"] !== "string" || typeof entry["version"] !== "string" || typeof entry["installed"] !== "boolean" || typeof entry["enabled"] !== "boolean") {
      throw new CodexInstallError("codex plugin list returned invalid JSON")
    }
    return { pluginId: entry["pluginId"], version: entry["version"], installed: entry["installed"], enabled: entry["enabled"] }
  })
}

function parseVersion(version: string): readonly [number, number, number, boolean] | undefined {
  const numeric = "(0|[1-9]\\d*)"
  const prerelease = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)"
  const match = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-(${prerelease}(?:\\.${prerelease})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`, "u").exec(version)
  if (!match) return undefined
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) return undefined
  return [major, minor, patch, match[4] !== undefined]
}

export function isCompatibleLazyCodexVersion(version: string | undefined): boolean {
  if (version === undefined) return false
  const parsed = parseVersion(version)
  return parsed !== undefined && !parsed[3] && parsed[0] === 4 && (parsed[1] > 19 || (parsed[1] === 19 && parsed[2] >= 4))
}

export function discoverCodexPlugins(): readonly CodexPluginRecord[] {
  return parsePlugins(requireCodexJson(["plugin", "list", "--json"], "codex plugin list"))
}

export function requireCompatibleLazyCodex(plugins: readonly CodexPluginRecord[]): void {
  const lazy = plugins.find((plugin) => plugin.pluginId === CODEX_CAPABILITY_MANIFEST.lazyCodex.pluginId)
  if (lazy === undefined || !lazy.installed) throw new CodexInstallError("LazyCodex is required. Install `omo@sisyphuslabs` with Codex, enable it, then retry `wunderkind codex install`.")
  if (!lazy.enabled) throw new CodexInstallError("LazyCodex is disabled. Enable `omo@sisyphuslabs`, then retry `wunderkind codex install`.")
  if (!isCompatibleLazyCodexVersion(lazy.version)) {
    throw new CodexInstallError("LazyCodex 4.19.4 through 4.x is required; install a compatible `omo@sisyphuslabs` release, then retry `wunderkind codex install`.")
  }
}

export function hasInstalledWunderkindPlugin(plugins: readonly CodexPluginRecord[]): boolean {
  return plugins.some((plugin) => plugin.pluginId === "wunderkind@grant-vine" && plugin.installed)
}

function matchesExistingPath(left: string, right: string): boolean {
  try {
    return realpathSync(left) === realpathSync(right)
  } catch {
    return false
  }
}

function marketplaceRoot(entry: unknown): { readonly name: string; readonly root: string } {
  if (!isRecord(entry) || typeof entry["name"] !== "string") throw new CodexInstallError("codex marketplace list returned invalid JSON")
  const root = typeof entry["path"] === "string" ? entry["path"] : typeof entry["root"] === "string" ? entry["root"] : undefined
  if (root === undefined) throw new CodexInstallError("codex marketplace list returned invalid JSON")
  return { name: entry["name"], root: resolve(root) }
}

function parseMarketplaces(value: unknown): readonly { readonly name: string; readonly root: string }[] {
  if (!isRecord(value) || !Array.isArray(value["marketplaces"])) throw new CodexInstallError("codex marketplace list returned invalid JSON")
  return value["marketplaces"].map(marketplaceRoot)
}

export function ensureCodexMarketplace(paths: CodexPaths, onRegistered: () => void): boolean {
  const marketplaces = parseMarketplaces(requireCodexJson(["plugin", "marketplace", "list", "--json"], "codex plugin marketplace list"))
  const found = marketplaces.find((entry) => entry.name === CODEX_CAPABILITY_MANIFEST.marketplace.id)
  if (found !== undefined && !matchesExistingPath(found.root, paths.marketplaceRoot)) throw new CodexInstallError("Codex marketplace name collision for grant-vine")
  if (found !== undefined) return false
  const result = runCodex(["plugin", "marketplace", "add", paths.marketplaceRoot, "--json"])
  if (result.error !== undefined || result.status !== 0) throw new CodexInstallError(`codex plugin marketplace add failed: ${result.stderr || result.stdout || "codex is unavailable"}`)
  onRegistered()
  let value: unknown
  try {
    value = JSON.parse(result.stdout)
  } catch {
    throw new CodexInstallError("codex plugin marketplace add returned invalid JSON")
  }
  const installedRoot = isRecord(value) && typeof value["installedRoot"] === "string" ? value["installedRoot"] : undefined
  if (!isRecord(value) || value["marketplaceName"] !== CODEX_CAPABILITY_MANIFEST.marketplace.id || installedRoot === undefined || !matchesExistingPath(installedRoot, paths.marketplaceRoot) || typeof value["alreadyAdded"] !== "boolean") {
    throw new CodexInstallError("codex plugin marketplace add returned invalid JSON")
  }
  return true
}

export function addWunderkindPlugin(version: string, onAdded: () => void): void {
  const result = runCodex(["plugin", "add", "wunderkind@grant-vine", "--json"])
  if (result.error !== undefined || result.status !== 0) throw new CodexInstallError(`codex plugin add failed: ${result.stderr || result.stdout || "codex is unavailable"}`)
  onAdded()
  let value: unknown
  try {
    value = JSON.parse(result.stdout)
  } catch {
    throw new CodexInstallError("codex plugin add returned invalid JSON")
  }
  if (!isRecord(value) || value["pluginId"] !== "wunderkind@grant-vine" || value["name"] !== CODEX_CAPABILITY_MANIFEST.plugin.id || value["marketplaceName"] !== CODEX_CAPABILITY_MANIFEST.marketplace.id || value["version"] !== version || typeof value["installedPath"] !== "string") {
    throw new CodexInstallError("codex plugin add returned invalid JSON")
  }
}

function rollbackJson(argv: readonly string[], operation: string): unknown {
  const result = runCodex(argv)
  if (result.error !== undefined || result.status !== 0) throw new CodexInstallError(`${operation} failed: ${result.stderr || result.stdout || "codex is unavailable"}`)
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new CodexInstallError(`${operation} returned invalid JSON`)
  }
}

export function rollbackWunderkindPlugin(): void {
  const value = rollbackJson(["plugin", "remove", "wunderkind@grant-vine", "--json"], "codex plugin remove")
  try {
    validateCodexPluginRemovalResponse(value, { pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine" })
  } catch {
    throw new CodexInstallError("codex plugin remove returned invalid JSON")
  }
}

export function rollbackCodexMarketplace(): void {
  const value = rollbackJson(["plugin", "marketplace", "remove", CODEX_CAPABILITY_MANIFEST.marketplace.id, "--json"], "codex plugin marketplace remove")
  if (!isRecord(value) || value["marketplaceName"] !== CODEX_CAPABILITY_MANIFEST.marketplace.id || value["installedRoot"] !== null) {
    throw new CodexInstallError("codex plugin marketplace remove returned invalid JSON")
  }
}
