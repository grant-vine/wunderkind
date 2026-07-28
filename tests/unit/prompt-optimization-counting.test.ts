import { describe, expect, it } from "bun:test"
import {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
} from "../../src/cli/prompt-runtime-fixtures.js"
import {
  OPENAI_EXACT_LOCAL_MODEL_IDS,
  buildPromptOptimizationRuntimeReport,
  countPromptOptimizationTokens,
  measurePromptOptimizationReduction,
} from "../../src/cli/prompt-optimization-runtime-reporting.js"
import type { PromptOptimizationRuntimeTrimResult } from "../../src/runtime-prompt-sections.js"

const FROZEN_EXACT_LOCAL_MODEL_IDS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"] as const

const EMPTY_TRIM_RESULT: PromptOptimizationRuntimeTrimResult = {
  sections: [],
  trimBasis: "configured-bytes",
  eligibleSections: [],
  beforeBytes: 0,
  afterBytes: 0,
  savedBytes: 0,
  trimApplied: false,
  trimExhausted: false,
  trimmedSections: [],
}

describe("prompt optimization token counting", () => {
  it("keeps the frozen supported OpenAI model map in the runtime-reporting seam as the single exact-local source of truth", () => {
    expect(OPENAI_EXACT_LOCAL_MODEL_IDS).toEqual(FROZEN_EXACT_LOCAL_MODEL_IDS)
  })

  it("returns exact-local with an exact zero count for the frozen supported OpenAI model ids", () => {
    for (const modelId of FROZEN_EXACT_LOCAL_MODEL_IDS) {
      expect(countPromptOptimizationTokens(modelId, "")).toEqual({
        countState: "exact-local",
        tokenCount: 0,
      })
    }
  })

  it("returns deterministic exact-local counts for the frozen supported OpenAI model ids against the runtime-context fixture", () => {
    const fixture = captureCanonicalRuntimeFixture("fixture-runtime-context")
    const promptContent = collectPromptOptimizationEligibleSections(fixture)
      .map((section) => section.content)
      .join("\n")

    for (const modelId of FROZEN_EXACT_LOCAL_MODEL_IDS) {
      const firstCount = countPromptOptimizationTokens(modelId, promptContent)
      const secondCount = countPromptOptimizationTokens(modelId, promptContent)

      expect(firstCount).toEqual(secondCount)
      expect(firstCount.countState).toBe("exact-local")
      expect(firstCount.tokenCount).toBeGreaterThan(0)
    }
  })

  it("returns provider-api-only for unmapped OpenAI aliases", () => {
    expect(countPromptOptimizationTokens("gpt-4.1-preview", "Hello from an alias")).toEqual({
      countState: "provider-api-only",
      tokenCount: null,
    })
  })

  it("returns unsupported for non-OpenAI providers", () => {
    expect(countPromptOptimizationTokens("claude-3-5-sonnet", "Hello from another provider")).toEqual({
      countState: "unsupported",
      tokenCount: null,
    })
  })

  it("measures aggregate reduction with exact-token priority for the frozen supported OpenAI model ids", () => {
    const reduction = measurePromptOptimizationReduction({
      modelId: "gpt-4.1",
      beforeContent: "Repeat the diagnosis clearly. Repeat the diagnosis clearly.\n",
      afterContent: "Repeat the diagnosis clearly.\n",
    })

    expect(reduction.metricBasis).toBe("exact-tokens")
    expect(reduction.exactTokenDelta).not.toBe(null)
    expect(reduction.beforeValue).toBe(reduction.exactTokenDelta?.beforeTokens)
    expect(reduction.afterValue).toBe(reduction.exactTokenDelta?.afterTokens)
    expect(reduction.savedValue).toBe(reduction.exactTokenDelta?.savedTokens)
    expect(reduction.savedValue).toBeGreaterThan(0)
  })

  it("falls back to deterministic byte measurement when exact-local token counting is unavailable", () => {
    const beforeContent = "Keep the benchmark deterministic. Keep the benchmark deterministic.\n"
    const afterContent = "Keep the benchmark deterministic.\n"

    expect(
      measurePromptOptimizationReduction({
        modelId: "claude-3-5-sonnet",
        beforeContent,
        afterContent,
      }),
    ).toEqual({
      metricBasis: "bytes-fallback",
      beforeValue: Buffer.byteLength(beforeContent, "utf8"),
      afterValue: Buffer.byteLength(afterContent, "utf8"),
      savedValue: Buffer.byteLength(beforeContent, "utf8") - Buffer.byteLength(afterContent, "utf8"),
      exactTokenDelta: null,
    })
  })

  it("reports measured V4 byte savings for unsupported models without fabricating exact token deltas", () => {
    const report = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: "claude-3-5-sonnet",
      promptOptimizationMode: "active",
      content: "",
      trimResult: EMPTY_TRIM_RESULT,
      promptOptimizationByteBudget: 120000,
      v4UserPromptOptimizationMeasurement: {
        beforeMessage:
          "Please keep the diagnosis short and actionable. Please keep the diagnosis short and actionable.\n",
        afterMessage: "Please keep the diagnosis short and actionable.\n",
        beforeBytes: 89,
        afterBytes: 45,
        savedBytes: 44,
        trimApplied: true,
      },
    })

    expect(report.beforeBytes).toBe(89)
    expect(report.afterBytes).toBe(45)
    expect(report.savedBytes).toBe(44)
    expect(report.trimApplied).toBe(true)
    expect(report.exactTokenDelta).toBe(null)
  })

  it("does not fabricate V4 savings for passthrough or no-op measurements", () => {
    const passthroughReport = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: "gpt-4.1",
      promptOptimizationMode: "active",
      content: "",
      trimResult: EMPTY_TRIM_RESULT,
      promptOptimizationByteBudget: 120000,
      v4PassthroughReason: "v4-safety-command-or-path",
      v4UserPromptOptimizationMeasurement: {
        beforeMessage: "$ bun test tests/unit/plugin-transform.test.ts\n",
        afterMessage: "$ bun test tests/unit/plugin-transform.test.ts\n",
        beforeBytes: 45,
        afterBytes: 45,
        savedBytes: 0,
        trimApplied: false,
      },
    })
    const noOpReport = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: "gpt-4.1",
      promptOptimizationMode: "active",
      content: "",
      trimResult: EMPTY_TRIM_RESULT,
      promptOptimizationByteBudget: 120000,
      v4UserPromptOptimizationMeasurement: {
        beforeMessage: "Please keep the diagnosis short and useful.\n",
        afterMessage: "Please keep the diagnosis short and useful.\n",
        beforeBytes: 44,
        afterBytes: 44,
        savedBytes: 0,
        trimApplied: false,
      },
    })

    expect(passthroughReport.savedBytes).toBe(0)
    expect(passthroughReport.beforeBytes).toBe(passthroughReport.afterBytes)
    expect(passthroughReport.trimApplied).toBe(false)
    expect(passthroughReport.noTrimReason).toBe("v4-safety-command-or-path")
    expect(passthroughReport.exactTokenDelta?.savedTokens ?? 0).toBe(0)

    expect(noOpReport.savedBytes).toBe(0)
    expect(noOpReport.beforeBytes).toBe(noOpReport.afterBytes)
    expect(noOpReport.trimApplied).toBe(false)
    expect(noOpReport.noTrimReason).toBe("within-trim-budget")
    expect(noOpReport.exactTokenDelta?.savedTokens ?? 0).toBe(0)
  })
})
