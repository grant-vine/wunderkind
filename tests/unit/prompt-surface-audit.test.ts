import { describe, expect, it } from "bun:test"
import {
  collectTokenAuditReport,
  getPromptRuntimeContract,
  PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
} from "../../src/cli/prompt-surface-audit.js"

describe("prompt runtime audit contract", () => {
  it("publishes the frozen audit-only runtime contract", () => {
    const contract = getPromptRuntimeContract()

    expect(contract.auditMode).toBe("audit-only-v1")
    expect(contract.livePromptMutation).toBe(false)
    expect(contract.modelTokenTruthClaims).toBe(false)
    expect(contract.runtimeFixtureIds).toEqual([...PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS])
    expect(contract.layers.map((layer) => layer.id)).toEqual([
      "static-agents",
      "static-commands-static",
      "static-commands-generated",
      "static-skills",
      "runtime-docs-output",
      "runtime-context",
      "runtime-native-agents",
      "runtime-soul-overlay",
      "compaction-continuity",
    ])

    const soulOverlayLayer = contract.layers.find((layer) => layer.id === "runtime-soul-overlay")
    expect(soulOverlayLayer).toBeDefined()
    expect(soulOverlayLayer?.ownership).toBe("user-authored-excluded")
    expect(soulOverlayLayer?.includedInTotals).toBe(false)
  })

  it("adds canonical runtime and compaction groups only to all-surface reporting", async () => {
    const report = await collectTokenAuditReport("all")

    expect(report.groups.map((group) => group.name)).toEqual([
      "agents",
      "commands-static",
      "commands-generated",
      "skills",
      "runtime-docs-output",
      "runtime-context",
      "runtime-native-agents",
      "compaction-continuity",
    ])

    const runtimeGroups = report.groups.filter((group) => /runtime|compaction/.test(group.name))
    expect(runtimeGroups.every((group) => group.collectionMode !== "static-owned")).toBe(true)
    expect(runtimeGroups.every((group) => group.ownership === "runtime-owned")).toBe(true)
    expect(report.entries.some((entry) => entry.group === "runtime-docs-output")).toBe(true)
    expect(report.entries.some((entry) => entry.group === "compaction-continuity")).toBe(true)
    expect(report.entries.some((entry) => entry.group === "runtime-soul-overlay")).toBe(false)
  })
})
