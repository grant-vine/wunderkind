import { readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../codex/capability-manifest.js"
import { getCodexDoctorReport } from "./doctor.js"
import { ensureSafeCodexInstallRoots, ensureSafeOwnedFileParent, resolveCodexPaths, type CodexPaths } from "./paths.js"
import { verifyCodexPayload, type VerifiedCodexPayload } from "./payload.js"
import { requireCodexCli } from "./process.js"
import {
  addWunderkindPlugin,
  CodexInstallError,
  discoverCodexPlugins,
  ensureCodexMarketplace,
  hasInstalledWunderkindPlugin,
  requireCompatibleLazyCodex,
  rollbackCodexMarketplace,
  rollbackWunderkindPlugin,
} from "./registration.js"
import {
  readCodexInstallState,
  lstatOrMissing,
  readRawFile,
  removeFileIfHashMatches,
  requireCanonicalCodexInstallState,
  restoreRawFile,
  sha256Bytes,
  sha256File,
  writeCodexInstallState,
  writeFileAtomically,
  type CodexInstallState,
} from "./state.js"

export interface CodexInstallResult { readonly packageVersion: string; readonly agentPaths: readonly string[] }

export interface CodexGlobalInstallReadiness { readonly healthy: boolean; readonly guidance: string; readonly packageVersion?: string }

export { CodexInstallError } from "./registration.js"

function copyImmutablePayload(paths: CodexPaths, payload: VerifiedCodexPayload): readonly string[] {
  const created: string[] = []
  for (const entry of payload.entries) {
    if (!entry.path.startsWith("marketplace/")) continue
    const source = join(payload.sourceRoot, entry.path)
    const destination = join(paths.ownershipRoot, entry.path)
    ensureSafeOwnedFileParent(paths.ownershipRoot, destination)
    const destinationStats = lstatOrMissing(destination)
    if (destinationStats !== undefined) {
      if (destinationStats.isSymbolicLink() || !destinationStats.isFile() || sha256File(destination) !== entry.sha256) {
        throw new CodexInstallError(`Codex immutable payload collision: ${entry.path}`)
      }
      continue
    }
    const candidate = readFileSync(source)
    if (sha256Bytes(candidate) !== entry.sha256) throw new CodexInstallError(`Codex payload digest changed before immutable copy: ${entry.path}`)
    writeFileAtomically(paths.ownershipRoot, destination, candidate)
    created.push(destination)
  }
  const manifestSource = join(payload.sourceRoot, "marketplace", "plugins", "wunderkind", payload.version, "payload-manifest.json")
  const manifestDestination = join(paths.marketplaceRoot, "plugins", "wunderkind", payload.version, "payload-manifest.json")
  const manifestBytes = readFileSync(manifestSource)
  if (sha256Bytes(manifestBytes) !== payload.payloadManifestSha256) throw new CodexInstallError("Codex payload manifest changed before immutable copy")
  ensureSafeOwnedFileParent(paths.ownershipRoot, manifestDestination)
  const manifestStats = lstatOrMissing(manifestDestination)
  if (manifestStats !== undefined) {
    if (manifestStats.isSymbolicLink() || !manifestStats.isFile() || sha256File(manifestDestination) !== payload.payloadManifestSha256) {
      throw new CodexInstallError("Codex immutable payload collision: payload manifest")
    }
  } else {
    writeFileAtomically(paths.ownershipRoot, manifestDestination, manifestBytes)
    created.push(manifestDestination)
  }
  return created
}

function readVerifiedDescriptor(payload: VerifiedCodexPayload): Uint8Array {
  const source = join(payload.sourceRoot, "marketplace", ".agents", "plugins", "marketplace.json")
  const descriptor = readFileSync(source)
  if (sha256Bytes(descriptor) !== sha256Bytes(payload.descriptor)) throw new CodexInstallError("Codex marketplace descriptor changed before install")
  return descriptor
}

function requireUnchangedVerifiedPayload(expected: VerifiedCodexPayload, current: VerifiedCodexPayload): void {
  const sameEntries = expected.entries.length === current.entries.length && expected.entries.every((entry, index) => {
    const candidate = current.entries[index]
    return candidate !== undefined && candidate.path === entry.path && candidate.sha256 === entry.sha256
  })
  if (expected.version !== current.version || expected.payloadManifestSha256 !== current.payloadManifestSha256 || sha256Bytes(expected.descriptor) !== sha256Bytes(current.descriptor) || !sameEntries) {
    throw new CodexInstallError("Codex packaged payload changed during Codex discovery and was preserved.")
  }
}

function agentPayloadHash(payload: VerifiedCodexPayload, agentId: string): string {
  const entry = payload.entries.find((candidate) => candidate.path === `agents/${agentId}.toml`)
  if (entry === undefined) throw new CodexInstallError(`Codex payload is missing agent: ${agentId}`)
  return entry.sha256
}

function preflightAgent(paths: CodexPaths, payload: VerifiedCodexPayload, state: CodexInstallState | undefined, agentId: string): void {
  const target = join(paths.agentsDir, `${agentId}.toml`)
  const stats = lstatOrMissing(target)
  if (stats === undefined) return
  const owned = state?.agents.find((agent) => agent.name === agentId)
  const expectedHash = agentPayloadHash(payload, agentId)
  if (owned === undefined || owned.path !== target || owned.sha256 !== expectedHash || stats.isSymbolicLink() || !stats.isFile() || sha256File(target) !== expectedHash) {
    throw new CodexInstallError(`Codex agent already exists and is not Wunderkind-owned: ${target}`)
  }
}

function preflightAgents(paths: CodexPaths, payload: VerifiedCodexPayload, state: CodexInstallState | undefined): void {
  for (const agent of CODEX_CAPABILITY_MANIFEST.agents) preflightAgent(paths, payload, state, agent.id)
}

function preflightDescriptor(paths: CodexPaths, payload: VerifiedCodexPayload, state: CodexInstallState | undefined): void {
  if (state !== undefined) {
    if (state.descriptorSha256 === undefined || !fileMatchesHash(paths.marketplaceDescriptor, state.descriptorSha256)) {
      throw new CodexInstallError(`Codex marketplace descriptor is missing or modified and was preserved: ${paths.marketplaceDescriptor}`)
    }
    return
  }
  if (lstatOrMissing(paths.marketplaceDescriptor) !== undefined && !fileMatchesHash(paths.marketplaceDescriptor, sha256Bytes(payload.descriptor))) {
    throw new CodexInstallError(`Codex marketplace descriptor already exists and is not Wunderkind-owned: ${paths.marketplaceDescriptor}`)
  }
}

function writeAgents(paths: CodexPaths, payload: VerifiedCodexPayload, state: CodexInstallState | undefined): readonly string[] {
  const agentPaths: string[] = []
  for (const agent of CODEX_CAPABILITY_MANIFEST.agents) {
    const target = join(paths.agentsDir, `${agent.id}.toml`)
    preflightAgent(paths, payload, state, agent.id)
    const content = readFileSync(join(payload.sourceRoot, "agents", `${agent.id}.toml`))
    if (sha256Bytes(content) !== agentPayloadHash(payload, agent.id)) throw new CodexInstallError(`Codex payload digest changed before agent write: ${agent.id}`)
    writeFileAtomically(paths.codexHome, target, content)
    agentPaths.push(target)
  }
  return agentPaths
}

function agentsMatchVerifiedPayload(paths: CodexPaths, payload: VerifiedCodexPayload): boolean {
  return CODEX_CAPABILITY_MANIFEST.agents.every((agent) => {
    const path = join(paths.agentsDir, `${agent.id}.toml`)
    return fileMatchesHash(path, agentPayloadHash(payload, agent.id))
  })
}

function immutablePayloadMatchesVerifiedPayload(paths: CodexPaths, payload: VerifiedCodexPayload): boolean {
  const entriesMatch = payload.entries
    .filter((entry) => entry.path.startsWith("marketplace/"))
    .every((entry) => fileMatchesHash(join(paths.ownershipRoot, entry.path), entry.sha256))
  const manifest = join(paths.marketplaceRoot, "plugins", "wunderkind", payload.version, "payload-manifest.json")
  return entriesMatch && fileMatchesHash(manifest, payload.payloadManifestSha256)
}

function fileMatchesHash(path: string, hash: string): boolean {
  const stats = lstatOrMissing(path)
  return stats !== undefined && !stats.isSymbolicLink() && stats.isFile() && sha256File(path) === hash
}

function fileMatchesSnapshot(path: string, snapshot: Uint8Array | undefined): boolean {
  return snapshot === undefined ? lstatOrMissing(path) === undefined : fileMatchesHash(path, sha256Bytes(snapshot))
}

function restoreCandidate(ownershipRoot: string, path: string, hash: string, original: Uint8Array | undefined): void {
  if (!fileMatchesHash(path, hash)) return
  restoreRawFile(ownershipRoot, path, original)
}

export function installCodexWunderkind(): CodexInstallResult {
  const paths = resolveCodexPaths()
  const payload = verifyCodexPayload(paths)
  const stateBefore = readRawFile(paths.installState)
  const previousState = readCodexInstallState(paths.installState)
  if (previousState !== undefined) requireCanonicalCodexInstallState(paths, previousState)
  preflightDescriptor(paths, payload, previousState)
  preflightAgents(paths, payload, previousState)
  ensureSafeCodexInstallRoots(paths)
  requireCodexCli()
  const plugins = discoverCodexPlugins()
  requireCompatibleLazyCodex(plugins)
  const pluginWasInstalled = hasInstalledWunderkindPlugin(plugins)
  requireUnchangedVerifiedPayload(payload, verifyCodexPayload(paths))
  preflightDescriptor(paths, payload, previousState)

  const descriptorBefore = readRawFile(paths.marketplaceDescriptor)
  const agentBefore = new Map(CODEX_CAPABILITY_MANIFEST.agents.map((agent) => {
    const path = join(paths.agentsDir, `${agent.id}.toml`)
    return [path, readRawFile(path)]
  }))
  let immutableCreated: readonly string[] = []
  let agentPaths: readonly string[] = []
  let marketplaceRegistered = false
  let pluginAdded = false
  try {
    immutableCreated = copyImmutablePayload(paths, payload)
    const descriptor = readVerifiedDescriptor(payload)
    writeFileAtomically(paths.ownershipRoot, paths.marketplaceDescriptor, descriptor)
    agentPaths = writeAgents(paths, payload, previousState)
    marketplaceRegistered = ensureCodexMarketplace(paths, () => { marketplaceRegistered = true })
    addWunderkindPlugin(payload.version, () => { pluginAdded = true })
    if (!immutablePayloadMatchesVerifiedPayload(paths, payload)) {
      throw new CodexInstallError("Codex install recovery required: immutable payload changed during plugin add and was preserved.")
    }
    if (!agentsMatchVerifiedPayload(paths, payload)) {
      throw new CodexInstallError("Codex install recovery required: an agent changed during plugin add and was preserved.")
    }
    if (!fileMatchesHash(paths.marketplaceDescriptor, sha256Bytes(descriptor))) {
      throw new CodexInstallError("Codex install recovery required: marketplace descriptor changed during plugin add and was preserved.")
    }
    if (!fileMatchesSnapshot(paths.installState, stateBefore)) {
      throw new CodexInstallError("Codex install recovery required: install state changed during plugin add and was preserved.")
    }
    const state: CodexInstallState = {
      packageVersion: payload.version,
      marketplace: { name: CODEX_CAPABILITY_MANIFEST.marketplace.id, root: paths.marketplaceRoot },
      plugin: { id: CODEX_CAPABILITY_MANIFEST.plugin.id, version: payload.version },
      descriptorSha256: sha256Bytes(descriptor),
      payloadManifestSha256: payload.payloadManifestSha256,
      agents: CODEX_CAPABILITY_MANIFEST.agents.map((agent) => {
        const path = join(paths.agentsDir, `${agent.id}.toml`)
        return { name: agent.id, path, sha256: sha256File(path) }
      }),
    }
    writeCodexInstallState(paths.ownershipRoot, paths.installState, state)
    return { packageVersion: payload.version, agentPaths }
  } catch (error) {
    if (pluginAdded && !pluginWasInstalled) {
      try {
        rollbackWunderkindPlugin()
      } catch (rollbackError) {
        const message = rollbackError instanceof Error ? rollbackError.message : "unknown rollback failure"
        throw new CodexInstallError(`Codex install failed and plugin rollback failed: ${message}; recovery required.`)
      }
    }
    for (const agent of CODEX_CAPABILITY_MANIFEST.agents) {
      const path = join(paths.agentsDir, `${agent.id}.toml`)
      restoreCandidate(paths.codexHome, path, agentPayloadHash(payload, agent.id), agentBefore.get(path))
    }
    restoreCandidate(paths.ownershipRoot, paths.marketplaceDescriptor, sha256Bytes(payload.descriptor), descriptorBefore)
    for (const path of immutableCreated) {
      const relativePath = relative(paths.ownershipRoot, path).replaceAll("\\", "/")
      const entry = payload.entries.find((candidate) => candidate.path === relativePath)
      if (entry !== undefined) {
        removeFileIfHashMatches(path, entry.sha256)
      } else if (relativePath.endsWith("/payload-manifest.json")) {
        removeFileIfHashMatches(path, payload.payloadManifestSha256)
      }
    }
    if (marketplaceRegistered) {
      try {
        rollbackCodexMarketplace()
      } catch (rollbackError) {
        const message = rollbackError instanceof Error ? rollbackError.message : "unknown rollback failure"
        throw new CodexInstallError(`Codex install failed and marketplace rollback failed: ${message}`)
      }
    }
    throw error
  }
}

export function getCodexGlobalInstallReadiness(): CodexGlobalInstallReadiness {
  try {
    const report = getCodexDoctorReport()
    if (report.core.healthy && report.core.plugin.version !== undefined) {
      return { healthy: true, guidance: "Wunderkind Codex installation is current.", packageVersion: report.core.plugin.version }
    }
    return { healthy: false, guidance: report.remediation[0] ?? "Run `wunderkind codex install` to recover." }
  } catch {
    return { healthy: false, guidance: "Codex install state is invalid; run `wunderkind codex install` to recover." }
  }
}
