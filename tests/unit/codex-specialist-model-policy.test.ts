import { describe, expect, it } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "toml"
import { installCodexWunderkind } from "../../src/cli/codex/install.js"
import { getCodexDoctorReport } from "../../src/cli/codex/doctor.js"
import { applyCodexModelPolicy } from "../../src/cli/codex/model-policy.js"
import { applyPolicyTransaction, __setPolicyBeforeWriteForTests } from "../../src/cli/codex/policy-transaction.js"
import { stageSpecialistModelPolicy } from "../../src/cli/codex/specialist-model-policy.js"
import { readCodexInstallState, sha256File, writeCodexInstallState } from "../../src/cli/codex/state.js"
import { resolveCodexPaths } from "../../src/cli/codex/paths.js"
import { cleanup, configure, createFakeCodex, sandbox } from "./helpers/codex-lifecycle-fixtures.js"

function expectedError(operation: () => unknown): Error {
  try { operation() } catch (error) {
    if (error instanceof Error) return error
    throw error
  }
  throw new Error("Expected operation to fail")
}

function legacyInstall() {
  const fixture = sandbox()
  configure(fixture, createFakeCodex())
  installCodexWunderkind()
  const paths = resolveCodexPaths()
  const state = readCodexInstallState(paths.installState)
  if (state === undefined) throw new Error("Expected installed state")
  for (const agent of state.agents) {
    const source = readFileSync(agent.path, "utf8").replace(/^model(?:_reasoning_effort)? = .*\n/gmu, "")
    writeFileSync(agent.path, source)
  }
  writeCodexInstallState(paths.ownershipRoot, paths.installState, { ...state, agents: state.agents.map((agent) => ({ ...agent, sha256: sha256File(agent.path) })) })
  return { fixture, paths }
}

describe("Codex specialist model policy", () => {
  it("reports inherited specialist routing and repairs all six owned legacy roles", () => {
    // Given
    const { fixture, paths } = legacyInstall()
    const root = join(paths.codexHome, "config.toml")
    writeFileSync(root, 'model = "operator-root"\nmodel_reasoning_effort = "low"\n')
    const beforeRoot = readFileSync(root, "utf8")
    try {
      expect(getCodexDoctorReport().modelPolicy.driftedAssignments.filter((id) => id.startsWith("wunderkind-"))).toHaveLength(12)
      // When
      applyCodexModelPolicy(paths)
      // Then
      const state = readCodexInstallState(paths.installState)
      if (state === undefined) throw new Error("Expected repaired state")
      for (const agent of state.agents) {
        const document: unknown = parse(readFileSync(agent.path, "utf8"))
        if (typeof document !== "object" || document === null || Array.isArray(document)) throw new Error("Expected agent TOML")
        expect([Reflect.get(document, "model"), Reflect.get(document, "model_reasoning_effort")]).toEqual(["gpt-6.1-sol", "high"])
        expect(sha256File(agent.path)).toBe(agent.sha256)
      }
      expect(getCodexDoctorReport().modelPolicy.driftedAssignments).toEqual([])
      expect(getCodexDoctorReport().core.catalogOwnership.agents).toBe("wunderkind-owned")
      expect(readFileSync(root, "utf8")).toBe(beforeRoot)
      expect(stageSpecialistModelPolicy(paths).deltas).toEqual([])
    } finally { cleanup(fixture) }
  })

  it("preserves explicit Astra and other edits without adopting their ownership", () => {
    // Given
    const { fixture, paths } = legacyInstall()
    const file = join(paths.agentsDir, "wunderkind-ciso.toml")
    writeFileSync(file, `model = "gpt-6-astra"\n${readFileSync(file, "utf8")}`)
    const before = readFileSync(file, "utf8")
    const stateBefore = readFileSync(paths.installState, "utf8")
    try {
      // When / Then: planning refuses the entire mutation before any write
      expect(expectedError(() => stageSpecialistModelPolicy(paths)).message).toContain("preserved")
      expect(readFileSync(file, "utf8")).toBe(before)
      expect(readFileSync(paths.installState, "utf8")).toBe(stateBefore)
      expect(getCodexDoctorReport().modelPolicy.astraAssignments).toContain("wunderkind-ciso")
      expect(getCodexDoctorReport().modelPolicy.userOwnedAssignments).toContain("wunderkind-ciso")
    } finally { cleanup(fixture) }
  })

  it("rolls back roles and their receipt when the transaction fails", () => {
    // Given
    const { fixture, paths } = legacyInstall()
    const state = readCodexInstallState(paths.installState)
    if (state === undefined) throw new Error("Expected installed state")
    const before = state.agents.map((agent) => readFileSync(agent.path, "utf8"))
    const stateBefore = readFileSync(paths.installState, "utf8")
    const plan = stageSpecialistModelPolicy(paths)
    __setPolicyBeforeWriteForTests((index) => { if (index === 3) throw new Error("Injected failure") })
    try {
      // When / Then
      expect(expectedError(() => applyPolicyTransaction(plan.deltas, join(paths.ownershipRoot, "model-policy-recovery.json"), plan.guards)).message).toContain("rolled back")
      expect(state.agents.map((agent) => readFileSync(agent.path, "utf8"))).toEqual(before)
      expect(readFileSync(paths.installState, "utf8")).toBe(stateBefore)
    } finally { __setPolicyBeforeWriteForTests(undefined); cleanup(fixture) }
  })
})
