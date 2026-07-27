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
    expect(soulOverlayLayer?.fixtureIds).toEqual(["fixture-runtime-soul-overlay"])
  })

  it("publishes a separate supplementary optimization contract with the frozen mode matrix", () => {
    const contract = getPromptRuntimeContract()
    const supplementaryOptimization = Reflect.get(contract, "supplementaryOptimization")

    expect(supplementaryOptimization.contractMode).toBe("supplementary-prompt-optimization-v1")
    expect(supplementaryOptimization.defaultEnabled).toBe(false)
    expect(supplementaryOptimization.defaultMode).toBe("off")
    expect(supplementaryOptimization.countStates).toEqual([
      { state: "exact-local", label: "supported OpenAI model map" },
      { state: "provider-api-only", label: "unmapped OpenAI aliases" },
      { state: "unsupported", label: "non-OpenAI providers" },
    ])
    expect(supplementaryOptimization.modeMatrix).toEqual([
      {
        enabledInput: "omitted",
        modeInput: "omitted",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
      {
        enabledInput: "omitted",
        modeInput: "off",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
      {
        enabledInput: "omitted",
        modeInput: "advisory",
        resolvedEnabled: true,
        resolvedMode: "advisory",
      },
      {
        enabledInput: "omitted",
        modeInput: "active",
        resolvedEnabled: true,
        resolvedMode: "active",
      },
      {
        enabledInput: true,
        modeInput: "omitted",
        resolvedEnabled: true,
        resolvedMode: "advisory",
      },
      {
        enabledInput: true,
        modeInput: "off",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
      {
        enabledInput: true,
        modeInput: "advisory",
        resolvedEnabled: true,
        resolvedMode: "advisory",
      },
      {
        enabledInput: true,
        modeInput: "active",
        resolvedEnabled: true,
        resolvedMode: "active",
      },
      {
        enabledInput: false,
        modeInput: "omitted",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
      {
        enabledInput: false,
        modeInput: "off",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
      {
        enabledInput: false,
        modeInput: "advisory",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
      {
        enabledInput: false,
        modeInput: "active",
        resolvedEnabled: false,
        resolvedMode: "off",
      },
    ])
  })

  it("freezes the V4 latest-user-message contract and safety taxonomy", () => {
    const contract = getPromptRuntimeContract()

    expect(contract.supplementaryOptimization.v4UserPromptOptimization).toEqual({
      contractMode: "v4-user-prompt-optimization-contract-v1",
      mutableSurface: {
        target: "latest-user-message-only",
        excludes: [
          "earlier-user-messages",
          "retained-history",
          "transcript-wide-compaction",
          "soul-overlays",
          "runtime-owned-trim-surfaces",
        ],
      },
      immutableContentRules: [
        {
          id: "immutable-code-block",
          comment: "Preserve fenced and inline code spans byte-exact.",
        },
        {
          id: "immutable-url",
          comment: "Preserve absolute URLs and URL-like literals byte-exact.",
        },
        {
          id: "immutable-file-path",
          comment: "Preserve file-system paths and path-like literals byte-exact.",
        },
        {
          id: "immutable-command",
          comment: "Preserve shell, CLI, and executable command text byte-exact.",
        },
        {
          id: "immutable-explicit-requirement",
          comment: "Preserve explicit constraints, requirements, and must/must-not wording byte-exact.",
        },
        {
          id: "immutable-compliance-legal-security",
          comment: "Preserve compliance, legal, and security wording byte-exact.",
        },
        {
          id: "immutable-quoted-user-text",
          comment: "Preserve quoted user text and worked examples byte-exact.",
        },
      ],
      mutableContentPolicy: {
        defaultMutability: "immutable-unless-allowlisted",
        allowlistRules: [
          {
            id: "allowlist-plain-natural-language-filler",
            comment: "Allow only ordinary natural-language filler outside immutable spans.",
          },
          {
            id: "allowlist-repetitive-natural-language-prose",
            comment: "Allow only repetitive natural-language prose outside immutable spans.",
          },
        ],
      },
      fallbackBehavior: {
        mode: "whole-message-passthrough",
        passthroughReasonTaxonomy: [
          {
            id: "v4-low-confidence-no-allowlist-match",
            class: "low-confidence",
            comment: "No positive mutable allowlist rule matched the latest user-authored message.",
          },
          {
            id: "v4-low-confidence-mixed-immutable-content",
            class: "low-confidence",
            comment: "Immutable and mutable cues were interleaved too tightly to separate safely.",
          },
          {
            id: "v4-safety-code-block",
            class: "safety-risk",
            comment: "Code-block detector matched within the latest user-authored message.",
          },
          {
            id: "v4-safety-command-or-path",
            class: "safety-risk",
            comment: "Command, file-path, or URL detector matched within the latest user-authored message.",
          },
          {
            id: "v4-safety-explicit-requirement",
            class: "safety-risk",
            comment: "Explicit requirement or constraint detector matched within the latest user-authored message.",
          },
          {
            id: "v4-safety-compliance-legal-security",
            class: "safety-risk",
            comment: "Compliance, legal, or security wording detector matched within the latest user-authored message.",
          },
          {
            id: "v4-safety-quoted-user-text",
            class: "safety-risk",
            comment: "Quoted user text or quoted example detector matched within the latest user-authored message.",
          },
        ],
      },
      reasonVisibility: {
        runtimeReport: "reason-codes-only",
        summaryMetadata: "omit-v4-passthrough-reasons",
        forbiddenSummaryFields: ["noTrimReason"],
      },
      openTokenAdoption: {
        dependencyAllowed: false,
        productSurfaceAdoptionAllowed: false,
        designInputOnly: true,
      },
    })
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
