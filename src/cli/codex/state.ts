import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import { ensureSafeOwnedFileParent, type CodexPaths } from "./paths.js"

export interface CodexInstalledAgentState {
  readonly name: string
  readonly path: string
  readonly sha256: string
}

export interface CodexInstallState {
  readonly packageVersion: string
  readonly marketplace: { readonly name: string; readonly root: string }
  readonly plugin: { readonly id: string; readonly version: string }
  readonly descriptorSha256?: string
  readonly payloadManifestSha256?: string
  readonly agents: readonly CodexInstalledAgentState[]
}

export interface CodexInstallStateSnapshot {
  readonly state: CodexInstallState
  readonly sha256: string
}

export class CodexStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexStateError"
  }
}

export type CanonicalCodexAgents = ReadonlyMap<string, CodexInstalledAgentState>

export type CodexInstallStateWriter = (ownershipRoot: string, path: string, state: CodexInstallState) => void

let installStateWriterForTests: CodexInstallStateWriter | undefined

function isStableVersion(value: string): boolean { return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value) }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function isAgentState(value: unknown): value is CodexInstalledAgentState {
  return isRecord(value) && typeof value["name"] === "string" && typeof value["path"] === "string" && isHash(value["sha256"])
}

function isInstallState(value: unknown): value is CodexInstallState {
  if (!isRecord(value) || typeof value["packageVersion"] !== "string" || !isRecord(value["marketplace"]) || !isRecord(value["plugin"]) || !Array.isArray(value["agents"])) {
    return false
  }
  return typeof value["marketplace"]["name"] === "string" &&
    typeof value["marketplace"]["root"] === "string" &&
    typeof value["plugin"]["id"] === "string" &&
    typeof value["plugin"]["version"] === "string" &&
    (value["descriptorSha256"] === undefined || isHash(value["descriptorSha256"])) &&
    (value["payloadManifestSha256"] === undefined || isHash(value["payloadManifestSha256"])) &&
    value["agents"].every(isAgentState)
}

export function sha256Bytes(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex")
}

export function sha256File(path: string): string {
  return sha256Bytes(readFileSync(path))
}

export function lstatOrMissing(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path)
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
}

export function readCodexInstallStateSnapshot(path: string): CodexInstallStateSnapshot | undefined {
  const stats = lstatOrMissing(path)
  if (stats === undefined) return undefined
  if (stats.isSymbolicLink() || !stats.isFile()) throw new CodexStateError(`Unsafe Codex install state: ${path}`)
  const content = readFileSync(path)
  let parsed: unknown
  try {
    parsed = JSON.parse(content.toString("utf8"))
  } catch {
    throw new CodexStateError(`Invalid Codex install state: ${path}`)
  }
  if (!isInstallState(parsed)) throw new CodexStateError(`Invalid Codex install state: ${path}`)
  return { state: parsed, sha256: sha256Bytes(content) }
}

export function readCodexInstallState(path: string): CodexInstallState | undefined {
  return readCodexInstallStateSnapshot(path)?.state
}

export function requireCanonicalCodexAgents(paths: CodexPaths, state: CodexInstallState): CanonicalCodexAgents {
  if (!existsSync(paths.agentsDir) || lstatSync(paths.agentsDir).isSymbolicLink() || !lstatSync(paths.agentsDir).isDirectory()) {
    throw new CodexStateError("Codex agents root is unsafe")
  }
  const expected = new Set(CODEX_CAPABILITY_MANIFEST.agents.map((agent) => agent.id))
  if (state.agents.length !== expected.size) throw new CodexStateError("Codex install state does not contain exactly six canonical agents")
  const agents = new Map<string, CodexInstalledAgentState>()
  for (const agent of state.agents) {
    const target = join(paths.agentsDir, `${agent.name}.toml`)
    if (!expected.has(agent.name) || agents.has(agent.name) || resolve(agent.path) !== resolve(target)) {
      throw new CodexStateError("Codex install state contains an unsafe agent record")
    }
    if (lstatOrMissing(agent.path)?.isSymbolicLink() === true) {
      throw new CodexStateError("Codex install state points to a symbolic-link agent")
    }
    agents.set(agent.name, agent)
  }
  if (agents.size !== expected.size || [...expected].some((name) => !agents.has(name))) {
    throw new CodexStateError("Codex install state is missing a canonical agent record")
  }
  return agents
}

export function requireCanonicalCodexInstallState(paths: CodexPaths, state: CodexInstallState): CanonicalCodexAgents {
  if (state.marketplace.name !== CODEX_CAPABILITY_MANIFEST.marketplace.id || resolve(state.marketplace.root) !== resolve(paths.marketplaceRoot)) {
    throw new CodexStateError("Codex install state contains an unsafe marketplace record")
  }
  if (!isStableVersion(state.packageVersion) || !isStableVersion(state.plugin.version) || state.plugin.id !== CODEX_CAPABILITY_MANIFEST.plugin.id || state.plugin.version !== state.packageVersion) {
    throw new CodexStateError("Codex install state contains an unsafe plugin record")
  }
  return requireCanonicalCodexAgents(paths, state)
}

export function removeOwnedFileIfHashMatches(ownershipRoot: string, path: string, hash: string): boolean {
  const root = resolve(ownershipRoot)
  const candidate = resolve(path)
  const suffix = relative(root, candidate)
  if (suffix === "" || suffix === ".." || suffix.startsWith(`..${sep}`) || suffix.startsWith(sep)) return false
  let current = root
  if (!existsSync(current) || lstatSync(current).isSymbolicLink() || !lstatSync(current).isDirectory()) return false
  for (const segment of suffix.split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (!existsSync(current) || lstatSync(current).isSymbolicLink()) return false
  }
  if (!lstatSync(candidate).isFile() || sha256File(candidate) !== hash) return false
  rmSync(candidate)
  return true
}

export function writeFileAtomically(ownershipRoot: string, path: string, content: string | Uint8Array): void {
  ensureSafeOwnedFileParent(ownershipRoot, path)
  const temporary = `${path}.wunderkind-${process.pid}-${Date.now()}.tmp`
  writeFileSync(temporary, content, { flag: "wx" })
  renameSync(temporary, path)
}

export function writeCodexInstallState(ownershipRoot: string, path: string, state: CodexInstallState): void {
  if (installStateWriterForTests !== undefined) {
    installStateWriterForTests(ownershipRoot, path, state)
    return
  }
  writeFileAtomically(ownershipRoot, path, `${JSON.stringify(state, null, 2)}\n`)
}

export function __setCodexInstallStateWriterForTests(writer: CodexInstallStateWriter): void {
  installStateWriterForTests = writer
}

export function __resetCodexInstallStateWriterForTests(): void {
  installStateWriterForTests = undefined
}

export function removeFileIfHashMatches(path: string, hash: string): boolean {
  const stats = lstatOrMissing(path)
  if (stats === undefined || stats.isSymbolicLink() || !stats.isFile() || sha256File(path) !== hash) return false
  rmSync(path)
  return true
}

export function readRawFile(path: string): Uint8Array | undefined {
  const stats = lstatOrMissing(path)
  if (stats === undefined) return undefined
  if (stats.isSymbolicLink() || !stats.isFile()) throw new CodexStateError(`Unsafe Codex file: ${path}`)
  return readFileSync(path)
}

export function restoreRawFile(ownershipRoot: string, path: string, content: Uint8Array | undefined): void {
  if (content === undefined) {
    if (lstatOrMissing(path) !== undefined) rmSync(path)
    return
  }
  writeFileAtomically(ownershipRoot, path, content)
}
