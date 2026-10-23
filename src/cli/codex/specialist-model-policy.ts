import { CODEX_SPECIALIST_MODEL_DEFAULTS } from "../../codex/agent-model-defaults.js"
import type { CodexPaths } from "./paths.js"
import { editPolicyToml, policyTomlString, scanPolicyToml, PolicyTomlError } from "./policy-toml.js"
import { policySnapshot, type PolicyDelta, type PolicySnapshot, PolicyTransactionError } from "./policy-transaction.js"
import { readCodexInstallState, readCodexInstallStateSnapshot, requireCanonicalCodexInstallState, sha256Bytes, type CodexInstalledAgentState } from "./state.js"

export function inspectSpecialistModelPolicy(paths: CodexPaths) {
  const driftedAssignments: string[] = []
  const astraAssignments: string[] = []
  const userOwnedAssignments: string[] = []
  const holds: string[] = []
  const state = readCodexInstallState(paths.installState)
  if (state !== undefined) {
    for (const agent of requireCanonicalCodexInstallState(paths, state).values()) {
      const snapshot = policySnapshot(agent.path)
      if (snapshot.bytes === undefined) continue
      if (snapshot.digest !== agent.sha256) {
        userOwnedAssignments.push(agent.name)
        try {
          if (policyTomlString(scanPolicyToml(Buffer.from(snapshot.bytes).toString("utf8")), "model") === "gpt-6-astra") astraAssignments.push(agent.name)
        } catch (error) {
          if (!(error instanceof PolicyTomlError)) throw error
          // Invalid operator-authored TOML stays unowned; core doctor reports the edited asset.
        }
        continue
      }
      const document = scanPolicyToml(Buffer.from(snapshot.bytes).toString("utf8"))
      const model = policyTomlString(document, "model")
      if (model === "gpt-6-astra") astraAssignments.push(agent.name)
      if (model !== CODEX_SPECIALIST_MODEL_DEFAULTS.model) driftedAssignments.push(agent.name)
      if (policyTomlString(document, "model_reasoning_effort") !== CODEX_SPECIALIST_MODEL_DEFAULTS.modelReasoningEffort) driftedAssignments.push(`${agent.name}:reasoning`)
    }
  }
  return { driftedAssignments, astraAssignments, userOwnedAssignments, holds }
}

export function stageSpecialistModelPolicy(paths: CodexPaths): { readonly deltas: readonly PolicyDelta[]; readonly guards: readonly PolicySnapshot[] } {
  const stateSnapshot = policySnapshot(paths.installState)
  const loaded = readCodexInstallStateSnapshot(paths.installState)
  if (loaded?.sha256 !== stateSnapshot.digest) throw new PolicyTransactionError("Concurrent specialist install-state change")
  const state = loaded?.state
  if (state === undefined) return { deltas: [], guards: [stateSnapshot] }
  const agents = requireCanonicalCodexInstallState(paths, state)
  const deltas: PolicyDelta[] = []
  const guards: PolicySnapshot[] = [stateSnapshot]
  const records: CodexInstalledAgentState[] = []
  for (const agent of agents.values()) {
    const before = policySnapshot(agent.path)
    guards.push(before)
    if (before.bytes === undefined || before.digest !== agent.sha256) {
      throw new PolicyTransactionError(`Specialist role is missing or modified and was preserved: ${agent.name}`)
    }
    const source = Buffer.from(before.bytes).toString("utf8")
    const next = editPolicyToml(source, {
      model: CODEX_SPECIALIST_MODEL_DEFAULTS.model,
      model_reasoning_effort: CODEX_SPECIALIST_MODEL_DEFAULTS.modelReasoningEffort,
    })
    if (next !== source) deltas.push({ before, bytes: Buffer.from(next) })
    records.push({ ...agent, sha256: sha256Bytes(next) })
  }
  if (deltas.length > 0) {
    deltas.push({ before: stateSnapshot, bytes: Buffer.from(`${JSON.stringify({ ...state, agents: records }, null, 2)}\n`) })
  }
  return { deltas, guards }
}
