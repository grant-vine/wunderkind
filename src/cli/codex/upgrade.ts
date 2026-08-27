import { existsSync, lstatSync, readFileSync } from "node:fs"
import { basename, join, resolve, win32 } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import { ensureSafeCodexInstallRoots, ensureSafeOwnedFileParent, resolveCodexPaths } from "./paths.js"
import { verifyCodexPayload, type VerifiedCodexPayload } from "./payload.js"
import { requireCodexCli, requireCodexJson } from "./process.js"
import { lstatOrMissing, readCodexInstallStateSnapshot, readRawFile, requireCanonicalCodexInstallState, restoreRawFile, sha256Bytes, sha256File, writeCodexInstallState, writeFileAtomically } from "./state.js"
import type { CodexInstallState } from "./state.js"

export interface CodexUpgradeResult {
  readonly packageVersion: string
  readonly upgraded: boolean
}

export class CodexUpgradeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexUpgradeError"
  }
}

interface AgentUpgradeSnapshot {
  readonly name: string
  readonly path: string
  readonly previous: Uint8Array | undefined
  readonly previousHash: string
  readonly candidate: Uint8Array
  readonly candidateHash: string
}

interface FileUpgradeSnapshot {
  readonly path: string
  readonly previous: Uint8Array | undefined
  readonly previousHash: string | undefined
  readonly candidate: string | Uint8Array
  readonly candidateHash: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compareVersions(left: string, right: string): number | undefined {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u
  const leftMatch = pattern.exec(left)
  const rightMatch = pattern.exec(right)
  if (leftMatch === null || rightMatch === null) return undefined
  const leftParts = [Number(leftMatch[1] ?? ""), Number(leftMatch[2] ?? ""), Number(leftMatch[3] ?? "")] as const
  const rightParts = [Number(rightMatch[1] ?? ""), Number(rightMatch[2] ?? ""), Number(rightMatch[3] ?? "")] as const
  const majorDelta = leftParts[0] - rightParts[0]
  if (majorDelta !== 0) return majorDelta
  const minorDelta = leftParts[1] - rightParts[1]
  if (minorDelta !== 0) return minorDelta
  const patchDelta = leftParts[2] - rightParts[2]
  if (patchDelta !== 0) return patchDelta
  return 0
}

function requirePluginAdd(value: unknown, version: string): void {
  const pluginId = `${CODEX_CAPABILITY_MANIFEST.plugin.id}@${CODEX_CAPABILITY_MANIFEST.marketplace.id}`
  if (!isRecord(value) || value["pluginId"] !== pluginId || value["name"] !== CODEX_CAPABILITY_MANIFEST.plugin.id || value["marketplaceName"] !== CODEX_CAPABILITY_MANIFEST.marketplace.id || value["version"] !== version || typeof value["installedPath"] !== "string") {
    throw new CodexUpgradeError("codex plugin add returned invalid JSON")
  }
}

function candidateAgentSource(payloadRoot: string, targetPath: string): string {
  const filename = targetPath.includes("\\") ? win32.basename(targetPath) : basename(targetPath)
  return join(payloadRoot, "agents", filename)
}

function copyCandidatePayload(ownershipRoot: string, payload: VerifiedCodexPayload): void {
  for (const entry of payload.entries) {
    if (!entry.path.startsWith("marketplace/")) continue
    const destination = join(ownershipRoot, entry.path)
    ensureSafeOwnedFileParent(ownershipRoot, destination)
    const destinationStats = lstatOrMissing(destination)
    if (destinationStats !== undefined) {
      if (destinationStats.isSymbolicLink() || !destinationStats.isFile() || sha256File(destination) !== entry.sha256) {
        throw new CodexUpgradeError(`Codex immutable payload collision: ${entry.path}`)
      }
      continue
    }
    const candidate = readFileSync(join(payload.sourceRoot, entry.path))
    if (sha256Bytes(candidate) !== entry.sha256) throw new CodexUpgradeError(`Codex payload digest changed before immutable copy: ${entry.path}`)
    writeFileAtomically(ownershipRoot, destination, candidate)
  }
  const manifestSource = join(payload.sourceRoot, "marketplace", "plugins", "wunderkind", payload.version, "payload-manifest.json")
  const manifestDestination = join(ownershipRoot, "marketplace", "plugins", "wunderkind", payload.version, "payload-manifest.json")
  const manifestBytes = readFileSync(manifestSource)
  if (sha256Bytes(manifestBytes) !== payload.payloadManifestSha256) throw new CodexUpgradeError("Codex payload manifest changed before immutable copy")
  ensureSafeOwnedFileParent(ownershipRoot, manifestDestination)
  const manifestStats = lstatOrMissing(manifestDestination)
  if (manifestStats !== undefined) {
    if (manifestStats.isSymbolicLink() || !manifestStats.isFile() || sha256File(manifestDestination) !== payload.payloadManifestSha256) {
      throw new CodexUpgradeError("Codex immutable payload collision: payload manifest")
    }
    return
  }
  writeFileAtomically(ownershipRoot, manifestDestination, manifestBytes)
}

function requireUnchangedVerifiedPayload(expected: VerifiedCodexPayload, current: VerifiedCodexPayload): void {
  const sameEntries = expected.entries.length === current.entries.length && expected.entries.every((entry, index) => {
    const candidate = current.entries[index]
    return candidate !== undefined && candidate.path === entry.path && candidate.sha256 === entry.sha256
  })
  if (expected.version !== current.version || expected.payloadManifestSha256 !== current.payloadManifestSha256 || sha256Bytes(expected.descriptor) !== sha256Bytes(current.descriptor) || !sameEntries) {
    throw new CodexUpgradeError("Codex packaged payload changed during Codex discovery and was preserved.")
  }
}

function verifyOwnedAgents(paths: ReturnType<typeof resolveCodexPaths>, state: CodexInstallState): ReadonlyMap<string, { readonly name: string; readonly path: string; readonly sha256: string }> {
  let records: ReturnType<typeof requireCanonicalCodexInstallState>
  try {
    records = requireCanonicalCodexInstallState(paths, state)
  } catch (error) {
    if (error instanceof Error) throw new CodexUpgradeError(`${error.message}; run \`wunderkind codex install\` to recover.`)
    throw error
  }
  for (const agent of records.values()) {
    if (!existsSync(agent.path)) throw new CodexUpgradeError(`Codex agent is missing and was preserved: ${agent.name}. Restore it or run \`wunderkind codex install\`.`)
    if (resolve(agent.path) !== resolve(join(paths.agentsDir, `${agent.name}.toml`)) || sha256File(agent.path) !== agent.sha256) {
      throw new CodexUpgradeError(`Codex agent was modified and was preserved: ${agent.name}. Restore it before upgrading.`)
    }
  }
  return records
}

function fileMatchesHash(path: string, hash: string): boolean {
  const stats = lstatOrMissing(path)
  return stats !== undefined && !stats.isSymbolicLink() && stats.isFile() && sha256File(path) === hash
}

function immutablePayloadMatchesVerifiedPayload(paths: ReturnType<typeof resolveCodexPaths>, payload: VerifiedCodexPayload): boolean {
  const entriesMatch = payload.entries
    .filter((entry) => entry.path.startsWith("marketplace/"))
    .every((entry) => fileMatchesHash(join(paths.ownershipRoot, entry.path), entry.sha256))
  const manifest = join(paths.marketplaceRoot, "plugins", "wunderkind", payload.version, "payload-manifest.json")
  return entriesMatch && fileMatchesHash(manifest, payload.payloadManifestSha256)
}

function candidateStillOwnsPath(snapshot: AgentUpgradeSnapshot): boolean {
  return fileMatchesHash(snapshot.path, snapshot.candidateHash)
}

function rollbackCandidateAgents(snapshots: readonly AgentUpgradeSnapshot[], replaced: ReadonlySet<string>, codexHome: string): readonly string[] {
  const preserved: string[] = []
  for (const snapshot of snapshots) {
    if (!replaced.has(snapshot.path)) continue
    if (!candidateStillOwnsPath(snapshot)) {
      preserved.push(snapshot.name)
      continue
    }
    restoreRawFile(codexHome, snapshot.path, snapshot.previous)
  }
  return preserved
}

export function upgradeCodexWunderkind(): CodexUpgradeResult {
  const paths = resolveCodexPaths()
  const payload = verifyCodexPayload(paths)
  ensureSafeCodexInstallRoots(paths)
  const stateSnapshot = readCodexInstallStateSnapshot(paths.installState)
  const state = stateSnapshot?.state
  if (state === undefined) throw new CodexUpgradeError("Codex install state is missing; run `wunderkind codex install` first.")
  const comparison = compareVersions(payload.version, state.packageVersion)
  if (comparison === undefined) throw new CodexUpgradeError("Codex package versions must be stable semantic versions before upgrade.")
  if (comparison < 0) throw new CodexUpgradeError(`Codex downgrade from ${state.packageVersion} to ${payload.version} is not supported.`)
  const ownedAgents = verifyOwnedAgents(paths, state)
  if (comparison === 0) return { packageVersion: state.packageVersion, upgraded: false }
  if (state.descriptorSha256 === undefined || !fileMatchesHash(paths.marketplaceDescriptor, state.descriptorSha256)) {
    throw new CodexUpgradeError("Codex marketplace descriptor is missing or modified and was preserved; recovery is required before upgrading.")
  }
  requireCodexCli()
  requireUnchangedVerifiedPayload(payload, verifyCodexPayload(paths))
  if (!fileMatchesHash(paths.marketplaceDescriptor, state.descriptorSha256)) {
    throw new CodexUpgradeError("Codex marketplace descriptor changed during Codex discovery and was preserved; recovery is required before upgrading.")
  }

  const descriptorBefore = readRawFile(paths.marketplaceDescriptor)
  const descriptor: FileUpgradeSnapshot = {
    path: paths.marketplaceDescriptor,
    previous: descriptorBefore,
    previousHash: descriptorBefore === undefined ? undefined : sha256Bytes(descriptorBefore),
    candidate: payload.descriptor,
    candidateHash: sha256Bytes(payload.descriptor),
  }
  const snapshots = CODEX_CAPABILITY_MANIFEST.agents.map((agent) => {
    const path = join(paths.agentsDir, `${agent.id}.toml`)
    const recorded = ownedAgents.get(agent.id)
    if (recorded === undefined || recorded.path !== path) throw new CodexUpgradeError(`Codex agent ownership changed before replacement: ${agent.id}`)
    const candidate = readFileSync(candidateAgentSource(payload.sourceRoot, path))
    const expected = payload.entries.find((entry) => entry.path === `agents/${agent.id}.toml`)
    if (expected === undefined || sha256Bytes(candidate) !== expected.sha256) throw new CodexUpgradeError(`Codex payload digest changed before agent replacement: ${agent.id}`)
    return { name: agent.id, path, previous: readRawFile(path), previousHash: recorded.sha256, candidate, candidateHash: sha256Bytes(candidate) }
  })
  const replaced = new Set<string>()
  let descriptorReplaced = false
  try {
    copyCandidatePayload(paths.ownershipRoot, payload)
    writeFileAtomically(paths.ownershipRoot, descriptor.path, descriptor.candidate)
    descriptorReplaced = true
    for (const snapshot of snapshots) {
      if (!existsSync(snapshot.path) || lstatSync(snapshot.path).isSymbolicLink() || sha256File(snapshot.path) !== snapshot.previousHash) {
        throw new CodexUpgradeError(`Codex agent ownership changed before replacement: ${snapshot.name}`)
      }
      writeFileAtomically(paths.codexHome, snapshot.path, snapshot.candidate)
      replaced.add(snapshot.path)
    }
    requirePluginAdd(requireCodexJson(["plugin", "add", "wunderkind@grant-vine", "--json"], "codex plugin add"), payload.version)
    if (!immutablePayloadMatchesVerifiedPayload(paths, payload)) {
      throw new CodexUpgradeError("Codex upgrade recovery required: immutable payload changed during plugin add and was preserved.")
    }
    if (snapshots.some((snapshot) => !candidateStillOwnsPath(snapshot))) {
      throw new CodexUpgradeError("Codex upgrade recovery required: an agent changed during plugin add and was preserved.")
    }
    if (!fileMatchesHash(descriptor.path, descriptor.candidateHash)) {
      throw new CodexUpgradeError("Codex upgrade recovery required: marketplace descriptor changed during plugin add and was preserved.")
    }
    if (stateSnapshot === undefined || !fileMatchesHash(paths.installState, stateSnapshot.sha256)) {
      throw new CodexUpgradeError("Codex upgrade recovery required: install state changed during plugin add and was preserved.")
    }
    const nextState = {
      packageVersion: payload.version,
      marketplace: state.marketplace,
      plugin: { id: CODEX_CAPABILITY_MANIFEST.plugin.id, version: payload.version },
      descriptorSha256: descriptor.candidateHash,
      payloadManifestSha256: payload.payloadManifestSha256,
      agents: snapshots.map((snapshot) => ({ name: snapshot.name, path: snapshot.path, sha256: snapshot.candidateHash })),
    }
    writeCodexInstallState(paths.ownershipRoot, paths.installState, nextState)
    return { packageVersion: payload.version, upgraded: true }
  } catch (error) {
    const preserved = rollbackCandidateAgents(snapshots, replaced, paths.codexHome)
    const descriptorPreserved = descriptorReplaced && !fileMatchesHash(descriptor.path, descriptor.candidateHash)
    if (descriptorReplaced && !descriptorPreserved) restoreRawFile(paths.ownershipRoot, descriptor.path, descriptor.previous)
    if (preserved.length > 0 || descriptorPreserved) {
      const message = error instanceof Error ? error.message : "Codex upgrade failed"
      const preservedFiles = [...preserved, ...(descriptorPreserved ? ["marketplace descriptor"] : [])]
      throw new CodexUpgradeError(`${message}; recovery required: concurrent changes were preserved: ${preservedFiles.join(", ")}.`)
    }
    throw error
  }
}
