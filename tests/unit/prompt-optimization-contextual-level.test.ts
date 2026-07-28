import { describe, expect, it } from "bun:test"

import type { InstallConfig } from "../../src/cli/types.js"
import { applyWunderkindSystemTransform } from "../../src/runtime-prompt-sections.js"

const SELECTED_CONTEXT_SENTINEL = "<!-- wunderkind:selected-context-start -->"
const SELECTED_CONTEXT_PRESERVE_START = "<!-- wunderkind:selected-context-preserve-start -->"
const SELECTED_CONTEXT_PRESERVE_END = "<!-- wunderkind:selected-context-preserve-end -->"

function createBaseConfig(overrides: Partial<InstallConfig>): Partial<InstallConfig> {
  return {
    region: "Project Region",
    industry: "SaaS",
    primaryRegulation: "POPIA",
    teamCulture: "pragmatic-balanced",
    orgStructure: "flat",
    promptOptimizationByteBudget: 20_000,
    ...overrides,
  }
}

function createSelectedContextSection(): string {
  return [
    SELECTED_CONTEXT_SENTINEL,
    "## Wunderkind Selected Context",
    "Customer reported payment onboarding drift during a POPIA-sensitive rollout.",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    SELECTED_CONTEXT_PRESERVE_START,
    "Path: src/runtime-prompt-sections.ts",
    "$ bun test tests/unit/prompt-optimization-contextual-level.test.ts",
    "See https://example.com/context-spec for the selected-context contract",
    SELECTED_CONTEXT_PRESERVE_END,
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
  ].join("\n")
}

function findSystemEntry(system: readonly string[], marker: string): string {
  const entry = system.find((candidate) => candidate.includes(marker))
  if (!entry) {
    throw new Error(`Missing system entry containing marker: ${marker}`)
  }

  return entry
}

describe("prompt optimization contextual level", () => {
  it("compresses already-selected context only at the contextual level and preserves explicit spans", () => {
    const externalSection = [
      "# External Corpus Excerpt",
      "Repeated diagnosis note: preserve the causal chain before proposing changes.",
      "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    ].join("\n")
    const selectedContext = createSelectedContextSection()
    const system = [externalSection, selectedContext]

    const result = applyWunderkindSystemTransform({
      system,
      wunderkindConfig: createBaseConfig({
        promptOptimizationEnabled: true,
        promptOptimizationMode: "active",
        promptOptimizationLevel: "contextual",
      }),
    })

    const transformedSelectedContext = findSystemEntry(system, SELECTED_CONTEXT_SENTINEL)

    expect(system).toContain(externalSection)
    expect(transformedSelectedContext).not.toBe(selectedContext)
    expect(transformedSelectedContext).toContain(SELECTED_CONTEXT_SENTINEL)
    expect(transformedSelectedContext).toContain(SELECTED_CONTEXT_PRESERVE_START)
    expect(transformedSelectedContext).toContain(SELECTED_CONTEXT_PRESERVE_END)
    expect(transformedSelectedContext).toContain("Path: src/runtime-prompt-sections.ts")
    expect(transformedSelectedContext).toContain(
      "$ bun test tests/unit/prompt-optimization-contextual-level.test.ts",
    )
    expect(transformedSelectedContext).toContain(
      "See https://example.com/context-spec for the selected-context contract",
    )
    expect(transformedSelectedContext).not.toContain(
      [
        "Repeated diagnosis note: preserve the causal chain before proposing changes.",
        "Repeated diagnosis note: preserve the causal chain before proposing changes.",
      ].join("\n"),
    )
    expect(result.trimResult.trimmedSections).toContain("selected-context")
  })

  it("does not compress selected context for disabled, lower-level, or legacy-compat profiles", () => {
    const originalSelectedContext = createSelectedContextSection()
    const scenarios = [
      {
        name: "disabled",
        config: createBaseConfig({
          promptOptimizationEnabled: false,
          promptOptimizationMode: "active",
          promptOptimizationLevel: "contextual",
        }),
      },
      {
        name: "runtime-and-tools",
        config: createBaseConfig({
          promptOptimizationEnabled: true,
          promptOptimizationMode: "active",
          promptOptimizationLevel: "runtime-and-tools",
        }),
      },
      {
        name: "legacy-enabled-without-level",
        config: createBaseConfig({
          promptOptimizationEnabled: true,
          promptOptimizationMode: "active",
        }),
      },
    ] as const

    for (const scenario of scenarios) {
      const system = [originalSelectedContext]
      const result = applyWunderkindSystemTransform({
        system,
        wunderkindConfig: scenario.config,
      })

      expect(findSystemEntry(system, SELECTED_CONTEXT_SENTINEL)).toBe(originalSelectedContext)
      expect(result.trimResult.trimmedSections).not.toContain("selected-context")
      expect(result.eligibleSections.some((section) => section.id === "selected-context")).toBe(false)
    }
  })
})
