import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import { WUNDERKIND_CANONICAL_MANIFEST } from "../../agents/canonical-manifest.js"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import type { CodexPaths } from "./paths.js"
import { sha256File } from "./state.js"

export interface CodexPayloadManifestEntry {
  readonly path: string
  readonly sha256: string
}

export interface VerifiedCodexPayload {
  readonly version: string
  readonly entries: readonly CodexPayloadManifestEntry[]
  readonly sourceRoot: string
  readonly descriptor: Uint8Array
  readonly payloadManifestSha256: string
}

export class CodexPayloadVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexPayloadVerificationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseManifest(value: unknown): readonly CodexPayloadManifestEntry[] {
  if (!isRecord(value) || value["version"] !== 1 || !Array.isArray(value["files"])) throw new CodexPayloadVerificationError("Codex payload manifest is invalid")
  const entries = value["files"].map((entry): CodexPayloadManifestEntry => {
    if (!isRecord(entry) || typeof entry["path"] !== "string" || typeof entry["sha256"] !== "string" || entry["path"] === "" || entry["path"].startsWith("/") || entry["path"].split(/[\\/]/u).includes("..") || !/^[a-f0-9]{64}$/u.test(entry["sha256"])) {
      throw new CodexPayloadVerificationError("Codex payload manifest is invalid")
    }
    return { path: entry["path"], sha256: entry["sha256"] }
  })
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length) throw new CodexPayloadVerificationError("Codex payload manifest contains duplicate paths")
  return entries
}

function requireExactCanonicalPayloadEntries(entries: readonly CodexPayloadManifestEntry[], version: string): void {
  const pluginRoot = `marketplace/plugins/wunderkind/${version}`
  const requiredPaths = [
    ...CODEX_CAPABILITY_MANIFEST.agents.map((agent) => `agents/${agent.id}.toml`),
    `${pluginRoot}/.codex-plugin/plugin.json`,
    ...CODEX_CAPABILITY_MANIFEST.skills.map((skill) => `${pluginRoot}/skills/${skill.id}/SKILL.md`),
  ]
  const actualPaths = new Set(entries.map((entry) => entry.path))
  const missingPath = requiredPaths.find((path) => !actualPaths.has(path))
  if (missingPath !== undefined) throw new CodexPayloadVerificationError(`Codex payload manifest is missing required file: ${missingPath}`)
  const requiredPathSet = new Set(requiredPaths)
  const unexpectedPath = entries.find((entry) => !requiredPathSet.has(entry.path))
  if (unexpectedPath !== undefined) throw new CodexPayloadVerificationError(`Codex payload manifest contains unexpected file: ${unexpectedPath.path}`)
}

function versionDirectory(sourceRoot: string): string {
  const root = join(sourceRoot, "marketplace", "plugins", "wunderkind")
  try {
    requirePhysicalPayloadPath(sourceRoot, root, "directory")
  } catch {
    throw new CodexPayloadVerificationError("Packaged Codex plugin payload is missing")
  }
  const versions = readdirSync(root).filter((entry) => {
    const candidate = join(root, entry)
    return !lstatSync(candidate).isSymbolicLink() && statSync(candidate).isDirectory()
  })
  if (versions.length !== 1 || versions[0] === undefined) throw new CodexPayloadVerificationError("Packaged Codex plugin payload has an ambiguous version")
  if (versions[0] !== WUNDERKIND_CANONICAL_MANIFEST.package.version) throw new CodexPayloadVerificationError("Packaged Codex plugin payload version does not match the canonical package version")
  return versions[0]
}

function parseJsonFile(path: string, message: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new CodexPayloadVerificationError(message)
  }
}

function requireCanonicalPluginManifest(value: unknown): void {
  if (!isRecord(value) || value["name"] !== CODEX_CAPABILITY_MANIFEST.plugin.id || value["version"] !== WUNDERKIND_CANONICAL_MANIFEST.package.version) {
    throw new CodexPayloadVerificationError("Codex plugin manifest does not match the canonical package version")
  }
}

function requireCanonicalMarketplaceDescriptor(value: unknown): void {
  const expectedPluginPath = `./plugins/${CODEX_CAPABILITY_MANIFEST.plugin.id}/${WUNDERKIND_CANONICAL_MANIFEST.package.version}`
  if (!isRecord(value) || value["name"] !== CODEX_CAPABILITY_MANIFEST.marketplace.id || !Array.isArray(value["plugins"]) || value["plugins"].length !== 1) {
    throw new CodexPayloadVerificationError("Codex marketplace descriptor has an unexpected shape")
  }
  const plugin = value["plugins"][0]
  if (!isRecord(plugin) || plugin["name"] !== CODEX_CAPABILITY_MANIFEST.plugin.id || !isRecord(plugin["source"]) || plugin["source"]["source"] !== "local" || plugin["source"]["path"] !== expectedPluginPath) {
    throw new CodexPayloadVerificationError("Codex marketplace descriptor does not point to the canonical plugin payload")
  }
}

function requirePhysicalPayloadPath(payloadRoot: string, candidatePath: string, expected: "directory" | "file"): void {
  const root = resolve(payloadRoot)
  const candidate = resolve(candidatePath)
  const suffix = relative(root, candidate)
  if (suffix === ".." || suffix.startsWith(`..${sep}`) || suffix.startsWith(sep)) {
    throw new CodexPayloadVerificationError("Codex payload manifest references an unsafe file")
  }
  let rootStats: ReturnType<typeof lstatSync>
  try {
    rootStats = lstatSync(root)
  } catch {
    throw new CodexPayloadVerificationError("Packaged Codex plugin payload is missing")
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new CodexPayloadVerificationError("Packaged Codex plugin payload is missing")

  const segments = suffix.split(sep).filter(Boolean)
  let current = root
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment)
    let stats: ReturnType<typeof lstatSync>
    try {
      stats = lstatSync(current)
    } catch {
      throw new CodexPayloadVerificationError("Codex payload manifest references an unsafe file")
    }
    if (stats.isSymbolicLink() || (index < segments.length - 1 && !stats.isDirectory())) {
      throw new CodexPayloadVerificationError("Codex payload manifest references an unsafe file")
    }
  }
  const candidateStats = segments.length === 0 ? rootStats : lstatSync(candidate)
  if ((expected === "directory" && !candidateStats.isDirectory()) || (expected === "file" && !candidateStats.isFile())) {
    throw new CodexPayloadVerificationError("Codex payload manifest references an unsafe file")
  }
}

export function verifyCodexPayload(paths: CodexPaths): VerifiedCodexPayload {
  const sourceRoot = resolve(paths.packagedPayloadRoot)
  requirePhysicalPayloadPath(sourceRoot, sourceRoot, "directory")
  const version = versionDirectory(sourceRoot)
  const pluginRoot = join(sourceRoot, "marketplace", "plugins", "wunderkind", version)
  requirePhysicalPayloadPath(sourceRoot, pluginRoot, "directory")
  const payloadManifestPath = join(pluginRoot, "payload-manifest.json")
  requirePhysicalPayloadPath(sourceRoot, payloadManifestPath, "file")
  const manifest = parseJsonFile(payloadManifestPath, "Codex payload manifest is missing or invalid")
  const entries = parseManifest(manifest)
  requireExactCanonicalPayloadEntries(entries, version)
  const pluginManifestPath = join(pluginRoot, ".codex-plugin", "plugin.json")
  requirePhysicalPayloadPath(sourceRoot, pluginManifestPath, "file")
  const pluginManifest = parseJsonFile(pluginManifestPath, "Codex plugin manifest is missing or invalid")
  requireCanonicalPluginManifest(pluginManifest)
  for (const entry of entries) {
    const candidate = resolve(sourceRoot, entry.path)
    requirePhysicalPayloadPath(sourceRoot, candidate, "file")
    if (sha256File(candidate) !== entry.sha256) throw new CodexPayloadVerificationError(`Codex payload digest mismatch: ${entry.path}`)
  }
  const descriptorPath = join(sourceRoot, "marketplace", ".agents", "plugins", "marketplace.json")
  try {
    requirePhysicalPayloadPath(sourceRoot, descriptorPath, "file")
  } catch {
    throw new CodexPayloadVerificationError("Codex payload is missing its marketplace descriptor")
  }
  const descriptor = readFileSync(descriptorPath)
  const parsedDescriptor = parseJsonFile(descriptorPath, "Codex marketplace descriptor is invalid")
  requireCanonicalMarketplaceDescriptor(parsedDescriptor)
  return { version, entries, sourceRoot, descriptor, payloadManifestSha256: sha256File(payloadManifestPath) }
}
