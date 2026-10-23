import { readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { findNodeAtLocation, getNodeValue } from "jsonc-parser"
import type { CodexPaths } from "./paths.js"
import { resolveCodexPaths } from "./paths.js"
import { lstatOrMissing, sha256Bytes } from "./state.js"
import { editPolicyToml, policyTomlString, removePolicyTomlTable, scanPolicyToml } from "./policy-toml.js"
import { applyPolicyTransaction, policySnapshot, type PolicyDelta } from "./policy-transaction.js"
import { activePolicyProfile, CODEX_POLICY_ROLES, readPolicyLayers, readPolicyReceipt, receiptForKey, resolvePolicyKey, seedPolicyLayer, splitPolicyModel, type PolicyKeyReceipt } from "./policy-overrides.js"
import { assertRoleProvenance, resolvePolicyUpstream, stageUpstreamPolicy } from "./policy-upstream.js"
import { inspectSpecialistModelPolicy, stageSpecialistModelPolicy } from "./specialist-model-policy.js"
export type CodexModelPolicyStatus = "compliant" | "advisory" | "drifted" | "unsafe"
export interface CodexModelPolicyReport {
  readonly status: CodexModelPolicyStatus
  readonly astraAssignments: readonly string[]
  readonly driftedAssignments: readonly string[]
  readonly userOwnedAssignments: readonly string[]
  readonly missingAssignments: readonly string[]
  readonly disabledAssignments: readonly string[]
  readonly unknownAssignments: readonly string[]
  readonly holds: readonly string[]
}
export class CodexModelPolicyError extends Error { constructor(message: string) { super(message); this.name = "CodexModelPolicyError" } }
export interface CodexModelPolicyOptions { readonly resetManagedKeys?: boolean }
function receiptPath(paths: CodexPaths): string { return join(paths.ownershipRoot, "model-policy.json") }
function homeFor(paths: CodexPaths | { readonly codexHome: string; readonly wunderkindHome: string }): string { return "home" in paths ? paths.home : dirname(paths.wunderkindHome) }
function policyContext(paths: CodexPaths | { readonly codexHome: string; readonly wunderkindHome: string; readonly ownershipRoot?: string }) {
  const ownershipRoot = "ownershipRoot" in paths && typeof paths.ownershipRoot === "string" ? paths.ownershipRoot : join(paths.wunderkindHome, "codex")
  const receipt = readPolicyReceipt(join(ownershipRoot, "model-policy.json")); const layers = readPolicyLayers(homeFor(paths), process.cwd()); const profile = activePolicyProfile()
  return { receipt, layers, profile }
}
export function inspectCodexModelPolicy(paths = resolveCodexPaths()): CodexModelPolicyReport {
  const astraAssignments: string[] = []; const driftedAssignments: string[] = []; const userOwnedAssignments: string[] = []; const missingAssignments: string[] = []; const disabledAssignments: string[] = []; const unknownAssignments: string[] = []; const holds: string[] = []
  try {
    const { receipt, layers, profile } = policyContext(paths)
    const specialists = inspectSpecialistModelPolicy(paths)
    astraAssignments.push(...specialists.astraAssignments)
    driftedAssignments.push(...specialists.driftedAssignments)
    userOwnedAssignments.push(...specialists.userOwnedAssignments)
    holds.push(...specialists.holds)
    const rootPath = join(paths.codexHome, "config.toml"); const root = policySnapshot(rootPath)
    const rootDocument = root.bytes === undefined ? undefined : scanPolicyToml(Buffer.from(root.bytes).toString("utf8"))
    const rootModel = rootDocument === undefined ? undefined : policyTomlString(rootDocument, "model")
    for (const assignment of rootDocument?.assignments ?? []) {
      if (assignment.path.length === 3 && assignment.path[0] === "profiles" && assignment.path[2] === "model") {
        const label = `profile:${assignment.path[1] ?? "unknown"}`; userOwnedAssignments.push(label)
        if (assignment.value === '"gpt-6-astra"' || assignment.value === "'gpt-6-astra'") astraAssignments.push(label)
      }
    }
    const rootReceipt = receiptForKey(receipt, rootPath, ["model"])
    if (rootModel === undefined) missingAssignments.push("root")
    else if (rootModel === "gpt-6-astra") astraAssignments.push("root")
    if (rootModel !== undefined && rootReceipt?.value !== rootModel) userOwnedAssignments.push("root")
    else if (rootModel !== "gpt-6-sol") driftedAssignments.push("root")
    const rootReasoning = rootDocument === undefined ? undefined : policyTomlString(rootDocument, "model_reasoning_effort")
    const rootReasoningReceipt = receiptForKey(receipt, rootPath, ["model_reasoning_effort"])
    if (rootReasoning === undefined && rootReasoningReceipt !== undefined) holds.push("Withdrawn managed root reasoning")
    else if (rootReasoning !== undefined && rootReasoningReceipt?.value !== rootReasoning) userOwnedAssignments.push("root:reasoning")
    else if (rootReasoningReceipt !== undefined && rootReasoning !== "medium") driftedAssignments.push("root:reasoning")
    const defaultDisabled = resolvePolicyKey(layers, "default", "disable", profile)?.value === true
    const roles: readonly { readonly id: string; readonly model: string; readonly reasoning: string }[] = [...CODEX_POLICY_ROLES, { id: "default", model: "gpt-6-luna", reasoning: "medium" }]
    for (const role of roles) {
      const disabled = role.id === "default" ? defaultDisabled : resolvePolicyKey(layers, role.id, "disable", profile)?.value === true
      if (disabled) { disabledAssignments.push(role.id); continue }
      const override = resolvePolicyKey(layers, role.id === "default" ? "lazycodex-worker-medium" : role.id, "model", profile)
      const keyReceipt = override === undefined ? undefined : receiptForKey(receipt, override.layer.snapshot.path, override.key)
      const userOwned = override !== undefined && keyReceipt?.value !== override.value
      if (userOwned) userOwnedAssignments.push(role.id)
      const snapshot = policySnapshot(join(paths.codexHome, "agents", `${role.id}.toml`))
      if (snapshot.bytes === undefined) { missingAssignments.push(role.id); continue }
      const document = scanPolicyToml(Buffer.from(snapshot.bytes).toString("utf8")); const model = policyTomlString(document, "model")
      if (model === "gpt-6-astra") astraAssignments.push(role.id)
      const expected = typeof override?.value === "string" ? splitPolicyModel(override.value).model : role.model
      if (model !== expected) driftedAssignments.push(role.id)
      const reasoningRole = role.id === "default" ? "lazycodex-worker-medium" : role.id
      const reasoningOverride = resolvePolicyKey(layers, reasoningRole, "reasoning", profile)
      const reasoningReceipt = reasoningOverride === undefined ? undefined : receiptForKey(receipt, reasoningOverride.layer.snapshot.path, reasoningOverride.key)
      if (reasoningOverride !== undefined && reasoningReceipt?.value !== reasoningOverride.value) userOwnedAssignments.push(`${role.id}:reasoning`)
      const suffix = typeof override?.value === "string" ? splitPolicyModel(override.value).reasoning : undefined
      const reasoning = typeof reasoningOverride?.value === "string" ? reasoningOverride.value : suffix ?? role.reasoning
      if (reasoning !== "auto" && policyTomlString(document, "model_reasoning_effort") !== (reasoning === "off" ? "none" : reasoning)) driftedAssignments.push(`${role.id}:reasoning`)
      if (role.id !== "default" && override === undefined) {
        const previous = receipt.keys.find((entry) => entry.key.at(-2) === role.id && entry.key.at(-1) === "model")
        if (previous !== undefined) holds.push(`Removed managed override: ${role.id}; explicit --reset-model-policy required`)
        else driftedAssignments.push(`${role.id}:durable`)
      }
    }
    const directory = join(paths.codexHome, "agents"); const stat = lstatOrMissing(directory)
    if (stat !== undefined) {
      policySnapshot(join(directory, ".wunderkind-path-probe"))
      const known = new Set(roles.map((role) => role.id))
      for (const entry of readdirSync(directory)) if (entry.endsWith(".toml") && !known.has(entry.slice(0, -5)) && !entry.startsWith("wunderkind-")) unknownAssignments.push(entry.slice(0, -5))
    }
    for (const entry of receipt.keys) {
      if (entry.scope === "root") continue
      const layer = layers.find((candidate) => candidate.snapshot.path === entry.file)
      if (layer === undefined || findNodeAtLocation(layer.tree, [...entry.key]) === undefined) holds.push(`Withdrawn managed policy key: ${entry.key.join(".")}`)
    }
    const installedRoles = roles.length - missingAssignments.filter((id) => id !== "root").length - disabledAssignments.length
    const status = holds.length > 0 || driftedAssignments.length > 0 ? "drifted" : missingAssignments.length > 0 || userOwnedAssignments.length > 0 || unknownAssignments.length > 0 ? "advisory" : "compliant"
    // Missing upstream installation is reported independently from Wunderkind core health.
    return { status: installedRoles === 0 && holds.length === 0 && specialists.driftedAssignments.length === 0 ? "advisory" : status, astraAssignments, driftedAssignments: [...new Set(driftedAssignments)], userOwnedAssignments, missingAssignments, disabledAssignments, unknownAssignments, holds }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return { status: "unsafe", astraAssignments, driftedAssignments, userOwnedAssignments, missingAssignments, disabledAssignments, unknownAssignments, holds: [error.message] }
  }
}
export function applyCodexModelPolicy(paths = resolveCodexPaths(), options: CodexModelPolicyOptions = {}): CodexModelPolicyReport {
  try {
    const upstream = resolvePolicyUpstream(); const { receipt, layers, profile } = policyContext(paths)
    const deltas: PolicyDelta[] = []; const newReceipts: PolicyKeyReceipt[] = [...receipt.keys]
    const specialists = stageSpecialistModelPolicy(paths)
    deltas.push(...specialists.deltas)
    const userLayer = layers[0]
    if (userLayer === undefined) throw new CodexModelPolicyError("Missing canonical OMO user layer")
    const seeds: { readonly key: readonly string[]; readonly value: string }[] = []
    const overrides: Record<string, unknown> = {}
    for (const role of CODEX_POLICY_ROLES) {
      const effective: Record<string, unknown> = {}
      for (const field of ["model", "reasoning", "disable"] as const) {
        const resolved = resolvePolicyKey(layers, role.id, field, profile)
        if (resolved !== undefined) {
          if (field === "disable" ? typeof resolved.value !== "boolean" : typeof resolved.value !== "string") throw new CodexModelPolicyError(`Invalid durable ${role.id}.${field}`)
          if (field === "model" && (typeof resolved.value !== "string" || resolved.value.trim().length === 0)) throw new CodexModelPolicyError(`Empty durable ${role.id}.model`)
          if (field === "reasoning" && (typeof resolved.value !== "string" || !["off", "none", "minimal", "low", "medium", "high", "xhigh", "max", "auto"].includes(resolved.value))) throw new CodexModelPolicyError(`Unsupported durable ${role.id}.reasoning`)
          effective[field] = resolved.value
          continue
        }
        if (field === "disable") continue
        if (field === "reasoning" && typeof effective["model"] === "string" && splitPolicyModel(effective["model"]).reasoning !== undefined) continue
        const previous = receipt.keys.find((entry) => entry.key.at(-2) === role.id && entry.key.at(-1) === field)
        if (previous !== undefined && options.resetManagedKeys !== true) throw new CodexModelPolicyError(`Removed managed ${role.id}.${field}; use explicit --reset-model-policy to reclaim`)
        const value = role[field]; const key = ["[codex]", "agents", role.id, field]
        seeds.push({ key, value }); effective[field] = value
      }
      overrides[role.id] = effective
    }
    const defaultDisabled = resolvePolicyKey(layers, "default", "disable", profile)?.value === true
    if (defaultDisabled) overrides["default"] = { disable: true }
    for (const layer of layers) for (const selected of [undefined, profile]) {
      const key = [...(selected === undefined ? [] : ["profiles", selected]), "[codex]", "agents"]
      const node = findNodeAtLocation(layer.tree, key); const value: unknown = node === undefined ? undefined : getNodeValue(node)
      if (typeof value === "object" && value !== null && !Array.isArray(value)) for (const id of Object.keys(value)) {
        if (id !== "default" && !CODEX_POLICY_ROLES.some((role) => role.id === id)) throw new CodexModelPolicyError(`Unknown durable role ${id}; review before regeneration`)
      }
      if (profile === undefined) break
    }
    const seeded = seedPolicyLayer(userLayer, seeds)
    if (seeds.length > 0) deltas.push({ before: userLayer.snapshot, bytes: seeded.bytes })
    for (const entry of seeded.receipts) { const index = newReceipts.findIndex((old) => old.file === entry.file && JSON.stringify(old.key) === JSON.stringify(entry.key)); if (index >= 0) newReceipts.splice(index, 1); newReceipts.push(entry) }
    // A removed root key withdraws ownership too; unreceipted explicit root choices are preserved.
    const rootPath = join(paths.codexHome, "config.toml"); const rootSnapshot = policySnapshot(rootPath); const rootText = rootSnapshot.bytes === undefined ? "" : Buffer.from(rootSnapshot.bytes).toString("utf8")
    const rootDocument = scanPolicyToml(rootText); const rootModel = policyTomlString(rootDocument, "model"); const oldRoot = receiptForKey(receipt, rootPath, ["model"])
    if (rootModel === undefined && oldRoot !== undefined && options.resetManagedKeys !== true) throw new CodexModelPolicyError("Removed managed root model; use explicit --reset-model-policy to reclaim")
    const rootManaged = rootModel === undefined || oldRoot?.value === rootModel
    const rootReasoning = policyTomlString(rootDocument, "model_reasoning_effort")
    const oldReasoning = receiptForKey(receipt, rootPath, ["model_reasoning_effort"])
    if (rootReasoning === undefined && oldReasoning !== undefined && options.resetManagedKeys !== true) throw new CodexModelPolicyError("Removed managed root reasoning; use explicit --reset-model-policy to reclaim")
    const reasoningManaged = rootManaged && (rootReasoning === undefined || oldReasoning?.value === rootReasoning)
    let nextRoot = editPolicyToml(rootText, { ...(rootManaged ? { model: "gpt-6-sol" } : {}), ...(reasoningManaged ? { model_reasoning_effort: "medium" } : {}) })
    const agents = new Map<string, Uint8Array>(); const snapshots = new Map<string, ReturnType<typeof policySnapshot>>()
    const agentNames = [...CODEX_POLICY_ROLES.map((role) => `${role.id}.toml`), "default.toml", ".lazycodex-default.sha256", ".lazycodex-agent-models.json", "codex-ultrawork-reviewer.toml"]
    for (const name of agentNames) { const snapshot = policySnapshot(join(paths.codexHome, "agents", name)); snapshots.set(name, snapshot); if (snapshot.bytes !== undefined) agents.set(name, snapshot.bytes) }
    for (const role of CODEX_POLICY_ROLES) {
      const installed = agents.get(`${role.id}.toml`); const source = upstream.roles.get(role.id)
      if (installed !== undefined && source !== undefined) {
        const installedText = Buffer.from(installed).toString("utf8"); const sourceText = upstream.roleContent.get(role.id)
        if (sourceText === undefined) throw new CodexModelPolicyError(`Missing trusted source for ${role.id}`)
        assertRoleProvenance(installedText, sourceText)
        const installedModel = policyTomlString(scanPolicyToml(installedText), "model")
        const bundledModel = policyTomlString(scanPolicyToml(sourceText), "model")
        const durable = resolvePolicyKey(layers, role.id, "model", profile)
        if (installedModel !== bundledModel && durable === undefined && !receipt.keys.some((key) => key.key.at(-2) === role.id && key.key.at(-1) === "model")) throw new CodexModelPolicyError(`Unreceipted ${role.id} model choice; preserve it in an explicit durable override before repair`)
      }
    }
    const retired = agents.get("codex-ultrawork-reviewer.toml")
    if (retired !== undefined) throw new CodexModelPolicyError("Retired role provenance requires review; policy repair preserves codex-ultrawork-reviewer.toml")
    const existingDefault = agents.get("default.toml"); const defaultReceipt = agents.get(".lazycodex-default.sha256")
    if (existingDefault !== undefined && (defaultReceipt === undefined || Buffer.from(defaultReceipt).toString("utf8") !== sha256Bytes(existingDefault))) {
      if (!defaultDisabled) throw new CodexModelPolicyError("Unowned default role preserved; resolve conflict or explicitly disable upstream default")
      // Disabled user default is preserved; upstream handles it without overwriting.
    }
    const manifestSnapshots: ReturnType<typeof policySnapshot>[] = []
    const cacheRoot = join(paths.codexHome, "plugins/cache/sisyphuslabs/omo")
    if (lstatOrMissing(cacheRoot) !== undefined) {
      policySnapshot(join(cacheRoot, ".path-probe"))
      for (const version of readdirSync(cacheRoot, { withFileTypes: true })) {
        if (!version.isDirectory()) throw new CodexModelPolicyError("Unsafe upstream plugin cache entry")
        const manifestPath = join(cacheRoot, version.name, ".installed-agents.json")
        const manifest = policySnapshot(manifestPath)
        if (manifest.bytes === undefined) continue
        const previous: unknown = JSON.parse(Buffer.from(manifest.bytes).toString("utf8"))
        const entries: unknown = typeof previous === "object" && previous !== null ? Reflect.get(previous, "agents") : undefined
        if (!Array.isArray(entries) || !entries.every((path: unknown) => typeof path === "string" && path.startsWith(`${paths.codexHome}/agents/`) && /^[A-Za-z0-9-]+\.toml$/u.test(path.slice(`${paths.codexHome}/agents/`.length)))) throw new CodexModelPolicyError("Unsafe upstream agent manifest; review before policy repair")
        manifestSnapshots.push(manifest)
      }
    }
    const sourceManifest = policySnapshot(join(paths.codexHome, ".tmp/marketplaces/sisyphuslabs/plugins/omo/.installed-agents.json"))
    if (sourceManifest.bytes !== undefined) {
      const previous: unknown = JSON.parse(Buffer.from(sourceManifest.bytes).toString("utf8"))
      const entries: unknown = typeof previous === "object" && previous !== null ? Reflect.get(previous, "agents") : undefined
      if (!Array.isArray(entries) || !entries.every((path: unknown) => typeof path === "string" && path.startsWith(`${paths.codexHome}/agents/`) && /^[A-Za-z0-9-]+\.toml$/u.test(path.slice(`${paths.codexHome}/agents/`.length)))) throw new CodexModelPolicyError("Unsafe upstream source manifest")
      manifestSnapshots.push(sourceManifest)
    }
    if (CODEX_POLICY_ROLES.some((role) => agents.has(`${role.id}.toml`))) {
    const staged = stageUpstreamPolicy({ upstream, agents, root: nextRoot, overrides, layers: layers.map((layer) => ({ scope: layer.scope, bytes: layer === userLayer ? seeded.bytes : layer.snapshot.bytes ?? Buffer.from("{}") })), ...(profile === undefined ? {} : { profile }) })
    for (const role of CODEX_POLICY_ROLES) {
      const bytes = staged.files.get(`agents/${role.id}.toml`)
      const effective = overrides[role.id]
      if (typeof effective !== "object" || effective === null) throw new CodexModelPolicyError(`Invalid staged policy for ${role.id}`)
      const configured: unknown = Reflect.get(effective, "model")
      if (bytes === undefined || typeof configured !== "string") throw new CodexModelPolicyError(`Incomplete staged policy for ${role.id}`)
      const stagedText = Buffer.from(bytes).toString("utf8")
      const sourceText = upstream.roleContent.get(role.id)
      if (sourceText === undefined) throw new CodexModelPolicyError(`Missing trusted source for ${role.id}`)
      assertRoleProvenance(stagedText, sourceText)
      const document = scanPolicyToml(stagedText)
      if (policyTomlString(document, "model") !== splitPolicyModel(configured).model) throw new CodexModelPolicyError(`Upstream fallback or rejected override for ${role.id}; repair held`)
      const reasoning: unknown = Reflect.get(effective, "reasoning")
      if (typeof reasoning === "string" && reasoning !== "auto" && policyTomlString(document, "model_reasoning_effort") !== (reasoning === "off" ? "none" : reasoning)) throw new CodexModelPolicyError(`Rejected staged reasoning for ${role.id}`)
    }
    if (!defaultDisabled) {
      const bytes = staged.files.get("agents/default.toml")
      const medium = staged.files.get("agents/lazycodex-worker-medium.toml")
      if (bytes === undefined || medium === undefined || policyTomlString(scanPolicyToml(Buffer.from(bytes).toString("utf8")), "model") !== policyTomlString(scanPolicyToml(Buffer.from(medium).toString("utf8")), "model")) throw new CodexModelPolicyError("Rejected upstream medium-derived default")
    }
    for (const manifest of manifestSnapshots) deltas.push({ before: manifest, bytes: Buffer.from(`${JSON.stringify({ agents: staged.manifestRoles.map((name) => join(paths.codexHome, "agents", name)).sort() }, null, 2)}\n`) })
    const allowedAgentFiles = new Set(agentNames.map((name) => `agents/${name}`))
    for (const path of staged.files.keys()) if (path !== "config.toml" && !allowedAgentFiles.has(path)) throw new CodexModelPolicyError(`Unreviewed staged synchronization output: ${path}`)

    for (const name of agentNames) {
      const before = snapshots.get(name); if (before === undefined) throw new CodexModelPolicyError("Incomplete synchronization snapshot")
      const bytes = staged.files.get(`agents/${name}`)
      if (bytes !== undefined && name.endsWith(".toml")) scanPolicyToml(Buffer.from(bytes).toString("utf8"))
      if ((bytes === undefined ? undefined : sha256Bytes(bytes)) !== before.digest) deltas.push({ before, bytes })
    }
    // Keep unrelated root settings/profile bytes exact; only append missing registrations
    // emitted by the actual installer. Conflicting registrations hold the entire operation.
    const stagedRoot = staged.files.get("config.toml")
    if (stagedRoot === undefined) throw new CodexModelPolicyError("Missing staged root config")
    const stagedDocument = scanPolicyToml(Buffer.from(stagedRoot).toString("utf8"))
    for (const role of [...CODEX_POLICY_ROLES.map((entry) => entry.id), ...(defaultDisabled ? [] : ["default"])]) {
      const expected = stagedDocument.assignments.find((entry) => entry.path.length === 3 && entry.path[0] === "agents" && entry.path[1] === role && entry.path[2] === "config_file")
      if (expected === undefined) throw new CodexModelPolicyError(`Missing staged ${role} registration`)
      const actual = rootDocument.assignments.find((entry) => entry.path.length === 3 && entry.path[0] === "agents" && entry.path[1] === role && entry.path[2] === "config_file")
      if (actual !== undefined && actual.value !== expected.value) throw new CodexModelPolicyError(`Foreign ${role} registration; preserve user config`)
      if (actual === undefined && rootDocument.tables.some((entry) => entry.path.length === 2 && entry.path[0] === "agents" && entry.path[1] === role)) throw new CodexModelPolicyError(`Existing ${role} table lacks a managed config_file; preserve operator settings`)
      if (actual === undefined) nextRoot += `${nextRoot.endsWith("\n") || nextRoot.length === 0 ? "" : "\n"}\n[agents.${role}]\nconfig_file = ${expected.value}\n`
    }
    }
    if (defaultDisabled && existingDefault !== undefined && defaultReceipt !== undefined && Buffer.from(defaultReceipt).toString("utf8") === sha256Bytes(existingDefault)) {
      const registration = rootDocument.assignments.find((entry) => entry.path.length === 3 && entry.path[0] === "agents" && entry.path[1] === "default" && entry.path[2] === "config_file")
      if (registration !== undefined && !['"./agents/default.toml"', "'./agents/default.toml'"].includes(registration.value)) throw new CodexModelPolicyError("Foreign default registration preserved")
      if (registration !== undefined) {
        const section = rootDocument.tables.find((entry) => entry.path.length === 2 && entry.path[0] === "agents" && entry.path[1] === "default")
        const fields = rootDocument.assignments.filter((entry) => entry.path[0] === "agents" && entry.path[1] === "default")
        if (fields.length !== 1 || fields.some((entry) => entry.path.length !== 3 || entry.path[2] !== "config_file") || (section !== undefined && rootText.slice(section.start, section.end).includes("#")) || rootDocument.tables.some((entry) => entry.path.length > 2 && entry.path[0] === "agents" && entry.path[1] === "default")) throw new CodexModelPolicyError("Default registration contains unrelated operator settings; preserve it and review before disabling")
        nextRoot = removePolicyTomlTable(nextRoot, ["agents", "default"])
      }
    }
    scanPolicyToml(nextRoot)
    if (nextRoot !== rootText) deltas.unshift({ before: rootSnapshot, bytes: Buffer.from(nextRoot) })
    for (const [key, value, managed] of [["model", "gpt-6-sol", rootManaged], ["model_reasoning_effort", "medium", reasoningManaged]] as const) {
      if (!managed) continue
      const entry: PolicyKeyReceipt = { file: rootPath, scope: "root", profile: null, key: [key], value, preWriteDigest: rootSnapshot.digest ?? null, lastWriteDigest: sha256Bytes(nextRoot) }
      const index = newReceipts.findIndex((item) => item.file === rootPath && item.key.length === 1 && item.key[0] === key); if (index >= 0) newReceipts.splice(index, 1); newReceipts.push(entry)
    }
    const policyReceipt = policySnapshot(receiptPath(paths))
    deltas.push({ before: policyReceipt, bytes: Buffer.from(`${JSON.stringify({ schemaVersion: 1, policyVersion: 1, keys: newReceipts }, null, 2)}\n`) })
    // Guard every read layer even if no write is planned. This catches operator changes during staging.
    for (const layer of layers) if (policySnapshot(layer.snapshot.path).digest !== layer.snapshot.digest) throw new CodexModelPolicyError(`Concurrent OMO layer change: ${layer.snapshot.path}`)
    applyPolicyTransaction(deltas, join(paths.ownershipRoot, "model-policy-recovery.json"), [rootSnapshot, policyReceipt, ...layers.map((layer) => layer.snapshot), ...snapshots.values(), ...manifestSnapshots, ...specialists.guards])
    return inspectCodexModelPolicy(paths)
  } catch (error) {
    if (error instanceof Error) throw new CodexModelPolicyError(error.message)
    throw error
  }
}
