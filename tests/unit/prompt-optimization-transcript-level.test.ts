import { describe, expect, it } from "bun:test"

import type { InstallConfig } from "../../src/cli/types.js"
import { applyWunderkindSystemTransform } from "../../src/runtime-prompt-sections.js"
import { buildV4UserPromptOptimizationSurface } from "../../src/runtime-user-prompt-optimization.js"

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
    "Repeated selected context note.",
    "Repeated selected context note.",
    SELECTED_CONTEXT_PRESERVE_START,
    "Path: src/runtime-transcript-compression.ts",
    "$ bun test tests/unit/prompt-optimization-transcript-level.test.ts",
    "See https://example.com/transcript-level for the transcript-level contract",
    SELECTED_CONTEXT_PRESERVE_END,
    "Repeated selected context note.",
  ].join("\n")
}

function findSystemEntry(system: readonly string[], marker: string): string {
  const entry = system.find((candidate) => candidate.includes(marker))
  if (!entry) {
    throw new Error(`Missing system entry containing marker: ${marker}`)
  }

  return entry
}

describe("prompt optimization transcript level", () => {
  it("compresses earlier transcript material only at the transcript level while preserving protected spans and contextual compaction", () => {
    const safeEarlierMessage = [
      "Repeated earlier diagnosis line.",
      "Repeated earlier diagnosis line.",
      "Repeated earlier diagnosis line.",
    ].join("\n")
    const protectedEarlierMessage = [
      "Background task id: bg_transcript123 remains session-local.",
      'Quoted user example: "keep this quote exact".',
      "Path: src/runtime-user-prompt-optimization.ts",
      "$ bun test tests/unit/prompt-optimization-v4-fixture.test.ts",
      "See https://example.com/transcript-spec for continuity guidance.",
    ].join("\n")
    const retainedHistoryEntry = [
      "Earlier retained history summary.",
      "Earlier retained history summary.",
      "Earlier retained history summary.",
    ].join("\n")
    const transcriptWideCompactionEntry = [
      "Preserve every active background task id (`bg_...`) separately from any session id.",
      "Preserve every active background task id (`bg_...`) separately from any session id.",
      "Assistant synthesis still pending.",
      "Assistant synthesis still pending.",
    ].join("\n")
    const system = [createSelectedContextSection()]
    const surface = buildV4UserPromptOptimizationSurface({
      messages: [
        { role: "user", content: safeEarlierMessage },
        { role: "assistant", content: "Assistant acknowledgement" },
        { role: "user", content: protectedEarlierMessage },
        { role: "assistant", content: "Second acknowledgement" },
        { role: "user", content: safeEarlierMessage },
        { role: "assistant", content: "Third acknowledgement" },
        { role: "user", content: "Latest request must remain untouched." },
      ],
      retainedHistory: [retainedHistoryEntry, retainedHistoryEntry],
      transcriptWideCompaction: [transcriptWideCompactionEntry],
    })

    const result = applyWunderkindSystemTransform({
      system,
      wunderkindConfig: createBaseConfig({
        promptOptimizationEnabled: true,
        promptOptimizationMode: "active",
        promptOptimizationLevel: "transcript",
      }),
      v4UserPromptOptimizationSurface: surface,
    })

    const transformedSelectedContext = findSystemEntry(system, SELECTED_CONTEXT_SENTINEL)
    const transformedSurface = result.v4UserPromptOptimizationSurface

    expect(transformedSelectedContext).not.toBe(createSelectedContextSection())
    expect(transformedSelectedContext).toContain(SELECTED_CONTEXT_PRESERVE_START)
    expect(transformedSelectedContext).toContain(SELECTED_CONTEXT_PRESERVE_END)
    expect(transformedSelectedContext).toContain("Path: src/runtime-transcript-compression.ts")
    expect(transformedSelectedContext).toContain(
      "$ bun test tests/unit/prompt-optimization-transcript-level.test.ts",
    )
    expect(transformedSelectedContext).toContain(
      "See https://example.com/transcript-level for the transcript-level contract",
    )

    expect(transformedSurface.latestUserMessage).toBe("Latest request must remain untouched.")
    expect(transformedSurface.earlierUserMessages).toHaveLength(2)
    expect(transformedSurface.earlierUserMessages[0]).toBe("Repeated earlier diagnosis line.")
    expect(transformedSurface.earlierUserMessages[1]).toBe(protectedEarlierMessage)
    expect(transformedSurface.earlierUserMessages[1]).toContain("bg_transcript123")
    expect(transformedSurface.earlierUserMessages[1]).toContain('"keep this quote exact"')
    expect(transformedSurface.earlierUserMessages[1]).toContain("Path: src/runtime-user-prompt-optimization.ts")
    expect(transformedSurface.earlierUserMessages[1]).toContain(
      "$ bun test tests/unit/prompt-optimization-v4-fixture.test.ts",
    )
    expect(transformedSurface.earlierUserMessages[1]).toContain(
      "https://example.com/transcript-spec",
    )
    expect(transformedSurface.retainedHistory).toEqual(["Earlier retained history summary."])
    expect(transformedSurface.transcriptWideCompaction).toEqual([
      [
        "Preserve every active background task id (`bg_...`) separately from any session id.",
        "Assistant synthesis still pending.",
      ].join("\n"),
    ])
    expect(transformedSurface.combinedUserHistory).toBe(
      [
        "Repeated earlier diagnosis line.",
        protectedEarlierMessage,
        "Latest request must remain untouched.",
      ].join("\n\n"),
    )
  })

  it("does not compress transcript surfaces for disabled, lower-level, or legacy-compat profiles", () => {
    const safeEarlierMessage = [
      "Repeated earlier diagnosis line.",
      "Repeated earlier diagnosis line.",
    ].join("\n")
    const originalSurface = buildV4UserPromptOptimizationSurface({
      messages: [
        { role: "user", content: safeEarlierMessage },
        { role: "assistant", content: "Assistant acknowledgement" },
        { role: "user", content: "Latest request must remain untouched." },
      ],
      retainedHistory: [safeEarlierMessage],
      transcriptWideCompaction: [safeEarlierMessage],
    })
    const scenarios = [
      {
        name: "disabled",
        config: createBaseConfig({
          promptOptimizationEnabled: false,
          promptOptimizationMode: "active",
          promptOptimizationLevel: "transcript",
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
        name: "contextual",
        config: createBaseConfig({
          promptOptimizationEnabled: true,
          promptOptimizationMode: "active",
          promptOptimizationLevel: "contextual",
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
      const result = applyWunderkindSystemTransform({
        system: [],
        wunderkindConfig: scenario.config,
        v4UserPromptOptimizationSurface: originalSurface,
      })

      expect(result.v4UserPromptOptimizationSurface.earlierUserMessages).toEqual(
        originalSurface.earlierUserMessages,
      )
      expect(result.v4UserPromptOptimizationSurface.retainedHistory).toEqual(
        originalSurface.retainedHistory,
      )
      expect(result.v4UserPromptOptimizationSurface.transcriptWideCompaction).toEqual(
        originalSurface.transcriptWideCompaction,
      )
    }
  })
})
