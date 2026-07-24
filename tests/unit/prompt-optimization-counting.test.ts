import { describe, expect, it } from "bun:test"
import {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
} from "../../src/cli/prompt-runtime-fixtures.js"
import {
  OPENAI_EXACT_LOCAL_MODEL_IDS,
  countPromptOptimizationTokens,
} from "../../src/cli/token-audit.js"

const FROZEN_EXACT_LOCAL_MODEL_IDS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"] as const

describe("prompt optimization token counting", () => {
  it("keeps the frozen supported OpenAI model map in token-audit as the single exact-local source of truth", () => {
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
})
