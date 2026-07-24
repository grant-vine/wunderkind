import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"

import {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
} from "../../src/cli/prompt-runtime-fixtures.js"
import { PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS } from "../../src/cli/prompt-runtime-contract.js"
import {
  buildPromptOptimizationAdvisoryResult,
  measurePromptOptimizationBudgetPressure,
} from "../../src/cli/token-audit.js"

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-fixture.mjs", import.meta.url)
const DUMP_HELPER_PATH = new URL("./helpers/dump-runtime-fixtures.mjs", import.meta.url)

function createHelperEnv(overrides: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides }
  delete env.WUNDERKIND_TEST_MODEL
  delete env.WUNDERKIND_TEST_ENGINE
  delete env.WUNDERKIND_TEST_TOKEN_BUDGET
  delete env.WUNDERKIND_TEST_BYTE_BUDGET
  delete env.WUNDERKIND_TEST_FIXTURE

  return { ...env, ...overrides }
}

describe("prompt optimization advisory", () => {
  it("reports exact-openai-tokens budget pressure without mutating the eligible prompt surfaces", () => {
    // Given
    const fixture = captureCanonicalRuntimeFixture("fixture-runtime-context")
    const originalSections = [...fixture.sections]
    const originalCompactionContext = [...fixture.compactionContext]
    const eligibleSections = collectPromptOptimizationEligibleSections(fixture)
    const promptContent = eligibleSections.map((section) => section.content).join("\n")

    // When
    const budgetPressure = measurePromptOptimizationBudgetPressure({
      modelId: "gpt-4.1",
      content: promptContent,
      promptOptimizationTokenBudget: 1,
      promptOptimizationByteBudget: 1,
    })
    const advisoryResult = buildPromptOptimizationAdvisoryResult({
      modelId: "gpt-4.1",
      promptOptimizationMode: "advisory",
      content: promptContent,
      promptOptimizationTokenBudget: 1,
      promptOptimizationByteBudget: 1,
    })

    // Then
    expect(eligibleSections.map((section) => section.id)).toEqual([
      "runtime-context",
      "runtime-native-agents",
      "compaction-continuity",
    ])
    expect(budgetPressure.countState).toBe("exact-local")
    expect(budgetPressure.budgetBasis).toBe("exact-openai-tokens")
    expect(typeof budgetPressure.measuredUsage).toBe("number")
    expect(budgetPressure.budgetLimit).toBe(1)
    expect(budgetPressure.overBudget).toBe(true)
    expect(advisoryResult).toEqual({
      modelId: "gpt-4.1",
      promptOptimizationMode: "advisory",
      countState: "exact-local",
      budgetBasis: "exact-openai-tokens",
      trimApplied: false,
      trimExhausted: false,
      trimmedSections: [],
    })
    expect(fixture.sections).toEqual(originalSections)
    expect(fixture.compactionContext).toEqual(originalCompactionContext)
  })

  it("emits the frozen zero-env helper JSON with default-off behavior", () => {
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: createHelperEnv(),
      encoding: "utf8",
    })

    expect(helperRun.status).toBe(0)
    expect(helperRun.stdout.trim()).toBe(
      '{"modelId":null,"promptOptimizationMode":"off","countState":"unsupported","budgetBasis":"budget-unavailable","trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
    )
  })

  it("emits the frozen helper JSON contract for advisory mode without mutating prompts", () => {
    // Given
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: {
        ...process.env,
        WUNDERKIND_TEST_ENGINE: "advisory",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-context",
      },
      encoding: "utf8",
    })

    // When
    const parsed = JSON.parse(helperRun.stdout.trim() || "{}")
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Expected helper JSON object")
    }

    // Then
    expect(helperRun.status).toBe(0)
    expect(parsed).toEqual({
      modelId: null,
      promptOptimizationMode: "advisory",
      countState: "unsupported",
      budgetBasis: "budget-unavailable",
      trimApplied: false,
      trimExhausted: false,
      trimmedSections: [],
    })
    expect(Object.keys(parsed)).toEqual([
      "modelId",
      "promptOptimizationMode",
      "countState",
      "budgetBasis",
      "trimApplied",
      "trimExhausted",
      "trimmedSections",
    ])
  })

  it("emits deterministic exact-openai-tokens helper output for supported OpenAI models", () => {
    const helperEnv = createHelperEnv({
      WUNDERKIND_TEST_MODEL: "gpt-4.1",
      WUNDERKIND_TEST_ENGINE: "advisory",
      WUNDERKIND_TEST_TOKEN_BUDGET: "1",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-context",
    })

    const firstRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: helperEnv,
      encoding: "utf8",
    })
    const secondRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: helperEnv,
      encoding: "utf8",
    })

    expect(firstRun.status).toBe(0)
    expect(secondRun.status).toBe(0)
    expect(firstRun.stdout.trim()).toBe(secondRun.stdout.trim())
    expect(firstRun.stdout.trim()).toBe(
      '{"modelId":"gpt-4.1","promptOptimizationMode":"advisory","countState":"exact-local","budgetBasis":"exact-openai-tokens","trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
    )
  })

  it("includes only the frozen advisory surfaces and excludes runtime-soul-overlay", () => {
    // Given
    const soulOverlayFixture = captureCanonicalRuntimeFixture("fixture-runtime-soul-overlay")
    const activeTrimFixture = captureCanonicalRuntimeFixture("fixture-runtime-active-trim")

    // When
    const soulOverlaySurfaceIds = collectPromptOptimizationEligibleSections(soulOverlayFixture).map(
      (section) => section.id,
    )
    const activeTrimSurfaceIds = collectPromptOptimizationEligibleSections(activeTrimFixture).map(
      (section) => section.id,
    )

    // Then
    expect(soulOverlaySurfaceIds).toEqual([
      "runtime-context",
      "runtime-native-agents",
      "compaction-continuity",
      ])
    expect(activeTrimSurfaceIds).toEqual([
      "runtime-docs-output",
      "runtime-context",
      "runtime-native-agents",
      "compaction-continuity",
    ])
  })

  it("dumps canonical runtime fixtures deterministically without helper-only fixtures", () => {
    const firstRun = spawnSync(process.execPath, [DUMP_HELPER_PATH.pathname], {
      env: createHelperEnv(),
      encoding: "utf8",
    })
    const secondRun = spawnSync(process.execPath, [DUMP_HELPER_PATH.pathname], {
      env: createHelperEnv(),
      encoding: "utf8",
    })

    expect(firstRun.status).toBe(0)
    expect(secondRun.status).toBe(0)
    expect(firstRun.stdout).toBe(secondRun.stdout)

    const parsed = JSON.parse(firstRun.stdout) as {
      readonly fixtures: readonly {
        readonly fixtureId: string
      }[]
    }

    expect(parsed.fixtures.map((fixture) => fixture.fixtureId)).toEqual([
      ...PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
    ])
    expect(parsed.fixtures.map((fixture) => fixture.fixtureId)).not.toContain("fixture-runtime-soul-overlay")
    expect(parsed.fixtures.map((fixture) => fixture.fixtureId)).not.toContain("fixture-runtime-active-trim")
  })
})
