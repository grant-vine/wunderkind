import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"

import {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
} from "../../src/cli/prompt-runtime-fixtures.js"
import { PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS } from "../../src/cli/prompt-runtime-contract.js"
import {
  buildPromptOptimizationAdvisoryResult,
  buildPromptOptimizationRuntimeReport,
  measurePromptOptimizationBudgetPressure,
} from "../../src/cli/prompt-optimization-runtime-reporting.js"
import { analyzeV4UserPromptMutability } from "../../src/runtime-user-prompt-optimization.js"

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-fixture.mjs", import.meta.url)
const DUMP_HELPER_PATH = new URL("./helpers/dump-runtime-fixtures.mjs", import.meta.url)

type HelperRuntimeReport = {
  readonly hookPath: "experimental.chat.system.transform" | "experimental.session.compacting"
  readonly modelId: string | null
  readonly promptOptimizationMode: "off" | "advisory" | "active"
  readonly countState: "exact-local" | "provider-api-only" | "unsupported"
  readonly budgetBasis: "exact-openai-tokens" | "configured-bytes" | "budget-unavailable"
  readonly budgetLimit: number | null
  readonly trimBasis: "configured-bytes"
  readonly trimBudgetLimit: number | null
  readonly eligibleSections: readonly string[]
  readonly beforeBytes: number
  readonly afterBytes: number
  readonly savedBytes: number
  readonly trimApplied: boolean
  readonly trimExhausted: boolean
  readonly trimmedSections: readonly string[]
  readonly noTrimReason: string | null
  readonly exactTokenDelta:
    | {
        readonly beforeTokens: number
        readonly afterTokens: number
        readonly savedTokens: number
      }
    | null
}

type HelperRuntimeSummaryMetadata = Omit<HelperRuntimeReport, "modelId">

type HelperRuntimePublicPayload = {
  readonly report: HelperRuntimeReport
  readonly summaryMetadata: HelperRuntimeSummaryMetadata
}

function createHelperEnv(overrides: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides }
  delete env.WUNDERKIND_TEST_MODEL
  delete env.WUNDERKIND_TEST_ENGINE
  delete env.WUNDERKIND_TEST_TOKEN_BUDGET
  delete env.WUNDERKIND_TEST_BYTE_BUDGET
  delete env.WUNDERKIND_TEST_FIXTURE
  delete env.WUNDERKIND_TEST_OUTPUT
  delete env.WUNDERKIND_TEST_HOOK_PATH

  return { ...env, ...overrides }
}

function runHelperRuntimeReport(overrides: Readonly<Record<string, string>> = {}): HelperRuntimeReport {
  const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
    env: createHelperEnv({
      WUNDERKIND_TEST_OUTPUT: "runtime-report",
      ...overrides,
    }),
    encoding: "utf8",
  })

  expect(helperRun.status).toBe(0)
  return JSON.parse(helperRun.stdout.trim() || "{}") as HelperRuntimeReport
}

function runHelperRuntimePublicPayload(
  overrides: Readonly<Record<string, string>> = {},
): HelperRuntimePublicPayload {
  const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
    env: createHelperEnv({
      WUNDERKIND_TEST_OUTPUT: "runtime-public-payload",
      ...overrides,
    }),
    encoding: "utf8",
  })

  expect(helperRun.status).toBe(0)
  return JSON.parse(helperRun.stdout.trim() || "{}") as HelperRuntimePublicPayload
}

function expectSummaryMetadataToMatchReportProjection(payload: HelperRuntimePublicPayload): void {
  expect(payload.summaryMetadata).toEqual({
    hookPath: payload.report.hookPath,
    promptOptimizationMode: payload.report.promptOptimizationMode,
    countState: payload.report.countState,
    budgetBasis: payload.report.budgetBasis,
    budgetLimit: payload.report.budgetLimit,
    trimBasis: payload.report.trimBasis,
    trimBudgetLimit: payload.report.trimBudgetLimit,
    eligibleSections: payload.report.eligibleSections,
    beforeBytes: payload.report.beforeBytes,
    afterBytes: payload.report.afterBytes,
    savedBytes: payload.report.savedBytes,
    trimApplied: payload.report.trimApplied,
    trimExhausted: payload.report.trimExhausted,
    trimmedSections: payload.report.trimmedSections,
    noTrimReason: payload.report.noTrimReason,
    exactTokenDelta: payload.report.exactTokenDelta,
  })
  expect(JSON.stringify(payload.summaryMetadata)).not.toContain('"modelId"')
}

describe("prompt optimization advisory", () => {
  it("keeps mutability positive-allowlist-only instead of treating everything else as mutable", () => {
    const analysis = analyzeV4UserPromptMutability([
      "Please summarize the debugging approach clearly.\n",
      "alpha + beta => gamma\n",
      "Repeat the final diagnosis clearly. Repeat the final diagnosis clearly.",
    ].join(""))

    expect(analysis.segments.map((segment) => ({ kind: segment.kind, ruleId: segment.ruleId, text: segment.text.trimEnd() }))).toEqual([
      {
        kind: "mutable-allowlist",
        ruleId: "allowlist-plain-natural-language-filler",
        text: "Please summarize the debugging approach clearly.",
      },
      {
        kind: "immutable-unclassified",
        ruleId: null,
        text: "alpha + beta => gamma",
      },
      {
        kind: "mutable-allowlist",
        ruleId: "allowlist-repetitive-natural-language-prose",
        text: "Repeat the final diagnosis clearly. Repeat the final diagnosis clearly.",
      },
    ])
    expect(analysis.reconstructedMessage).toBe([
      "Please summarize the debugging approach clearly.\n",
      "alpha + beta => gamma\n",
      "Repeat the final diagnosis clearly. Repeat the final diagnosis clearly.",
    ].join(""))
  })

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
      eligibleSections,
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
      trimBasis: "configured-bytes",
      eligibleSections: ["runtime-context", "runtime-native-agents", "compaction-continuity"],
      beforeBytes: 6013,
      afterBytes: 6013,
      savedBytes: 0,
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
      '{"modelId":null,"promptOptimizationMode":"off","countState":"unsupported","budgetBasis":"budget-unavailable","trimBasis":"configured-bytes","eligibleSections":["runtime-native-agents","compaction-continuity"],"beforeBytes":5262,"afterBytes":5262,"savedBytes":0,"trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
    )
  })

  it("emits the frozen helper JSON contract for advisory mode without mutating prompts", () => {
    // Given
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: createHelperEnv({
        WUNDERKIND_TEST_ENGINE: "advisory",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-context",
      }),
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
      trimBasis: "configured-bytes",
      eligibleSections: ["runtime-native-agents", "compaction-continuity"],
      beforeBytes: 5262,
      afterBytes: 5262,
      savedBytes: 0,
      trimApplied: false,
      trimExhausted: false,
      trimmedSections: [],
    })
    expect(Object.keys(parsed)).toEqual([
      "modelId",
      "promptOptimizationMode",
      "countState",
      "budgetBasis",
      "trimBasis",
      "eligibleSections",
      "beforeBytes",
      "afterBytes",
      "savedBytes",
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
      '{"modelId":"gpt-4.1","promptOptimizationMode":"advisory","countState":"exact-local","budgetBasis":"exact-openai-tokens","trimBasis":"configured-bytes","eligibleSections":["runtime-native-agents","compaction-continuity"],"beforeBytes":5262,"afterBytes":5262,"savedBytes":0,"trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
    )
  })

  it("emits a structured off runtime report with no exact token delta", () => {
    const report = runHelperRuntimeReport()

    expect(report.hookPath).toBe("experimental.chat.system.transform")
    expect(report.promptOptimizationMode).toBe("off")
    expect(report.countState).toBe("unsupported")
    expect(report.budgetBasis).toBe("budget-unavailable")
    expect(report.budgetLimit).toBe(null)
    expect(report.trimBudgetLimit).toBe(null)
    expect(report.trimApplied).toBe(false)
    expect(report.trimExhausted).toBe(false)
    expect(report.noTrimReason).toBe("prompt-optimization-off")
    expect(report.eligibleSections).toEqual(["runtime-native-agents", "compaction-continuity"])
    expect(report.beforeBytes).toBe(report.afterBytes)
    expect(report.savedBytes).toBe(0)
    expect(report.exactTokenDelta).toBe(null)
  })

  it("pins the current emitted runtime-report field inventory before v3 classification", () => {
    const report = runHelperRuntimeReport()

    expect(Object.keys(report)).toEqual([
      "hookPath",
      "modelId",
      "promptOptimizationMode",
      "countState",
      "budgetBasis",
      "budgetLimit",
      "trimBasis",
      "trimBudgetLimit",
      "eligibleSections",
      "beforeBytes",
      "afterBytes",
      "savedBytes",
      "trimApplied",
      "trimExhausted",
      "trimmedSections",
      "noTrimReason",
      "exactTokenDelta",
    ])
  })

  it("keeps advisory helper output deterministic when parent env leaks runtime-report vars", () => {
    const originalOutput = process.env.WUNDERKIND_TEST_OUTPUT
    const originalHookPath = process.env.WUNDERKIND_TEST_HOOK_PATH

    process.env.WUNDERKIND_TEST_OUTPUT = "runtime-report"
    process.env.WUNDERKIND_TEST_HOOK_PATH = "experimental.session.compacting"

    try {
      const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
        env: createHelperEnv({
          WUNDERKIND_TEST_ENGINE: "advisory",
          WUNDERKIND_TEST_FIXTURE: "fixture-runtime-context",
        }),
        encoding: "utf8",
      })

      expect(helperRun.status).toBe(0)
      expect(helperRun.stdout.trim()).toBe(
        '{"modelId":null,"promptOptimizationMode":"advisory","countState":"unsupported","budgetBasis":"budget-unavailable","trimBasis":"configured-bytes","eligibleSections":["runtime-native-agents","compaction-continuity"],"beforeBytes":5262,"afterBytes":5262,"savedBytes":0,"trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
      )
    } finally {
      if (originalOutput === undefined) {
        delete process.env.WUNDERKIND_TEST_OUTPUT
      } else {
        process.env.WUNDERKIND_TEST_OUTPUT = originalOutput
      }

      if (originalHookPath === undefined) {
        delete process.env.WUNDERKIND_TEST_HOOK_PATH
      } else {
        process.env.WUNDERKIND_TEST_HOOK_PATH = originalHookPath
      }
    }
  })

  it("emits an exact-local runtime report with supplemental token delta while mutation remains byte-budget-driven", () => {
    const report = runHelperRuntimeReport({
      WUNDERKIND_TEST_MODEL: "gpt-4.1",
      WUNDERKIND_TEST_ENGINE: "active",
      WUNDERKIND_TEST_TOKEN_BUDGET: "1",
      WUNDERKIND_TEST_BYTE_BUDGET: "1200",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
    })

    expect(report.countState).toBe("exact-local")
    expect(report.budgetBasis).toBe("exact-openai-tokens")
    expect(report.budgetLimit).toBe(1)
    expect(report.trimBasis).toBe("configured-bytes")
    expect(report.trimBudgetLimit).toBe(1200)
    expect(report.trimApplied).toBe(true)
    expect(report.trimExhausted).toBe(false)
    expect(report.savedBytes).toBeGreaterThan(0)
    expect(report.afterBytes < report.beforeBytes).toBe(true)
    expect(report.noTrimReason).toBe(null)
    expect(report.exactTokenDelta).toBeDefined()
    expect(report.exactTokenDelta).not.toBe(null)
    expect(report.exactTokenDelta?.beforeTokens).toBeGreaterThan(report.exactTokenDelta?.afterTokens ?? Number.POSITIVE_INFINITY)
    expect(report.exactTokenDelta?.savedTokens).toBeGreaterThan(0)
    expect(report.exactTokenDelta?.savedTokens).toBe(
      (report.exactTokenDelta?.beforeTokens ?? 0) - (report.exactTokenDelta?.afterTokens ?? 0),
    )
  })

  it("emits an exact-local helper public payload that preserves safe literals for the system hook", () => {
    const payload = runHelperRuntimePublicPayload({
      WUNDERKIND_TEST_MODEL: "gpt-4.1",
      WUNDERKIND_TEST_ENGINE: "active",
      WUNDERKIND_TEST_TOKEN_BUDGET: "1",
      WUNDERKIND_TEST_BYTE_BUDGET: "1200",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
      WUNDERKIND_TEST_HOOK_PATH: "experimental.chat.system.transform",
    })

    expect(payload.report.hookPath).toBe("experimental.chat.system.transform")
    expect(payload.report.modelId).toBe("gpt-4.1")
    expect(payload.report.countState).toBe("exact-local")
    expect(payload.report.budgetBasis).toBe("exact-openai-tokens")
    expect(payload.report.trimBasis).toBe("configured-bytes")
    expect(payload.report.exactTokenDelta).not.toBe(null)
    expectSummaryMetadataToMatchReportProjection(payload)
  })

  it("emits provider-api-only fallback runtime reports without exact token deltas", () => {
    const report = runHelperRuntimeReport({
      WUNDERKIND_TEST_MODEL: "gpt-4.1-preview",
      WUNDERKIND_TEST_ENGINE: "active",
      WUNDERKIND_TEST_BYTE_BUDGET: "1200",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
    })

    expect(report.countState).toBe("provider-api-only")
    expect(report.budgetBasis).toBe("configured-bytes")
    expect(report.trimBasis).toBe("configured-bytes")
    expect(report.trimApplied).toBe(true)
    expect(report.exactTokenDelta).toBe(null)
  })

  it("emits a provider-api-only helper public payload that preserves safe literal aliases for the session hook", () => {
    const payload = runHelperRuntimePublicPayload({
      WUNDERKIND_TEST_MODEL: "gpt-4.1-preview",
      WUNDERKIND_TEST_ENGINE: "active",
      WUNDERKIND_TEST_BYTE_BUDGET: "1",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
      WUNDERKIND_TEST_HOOK_PATH: "experimental.session.compacting",
    })

    expect(payload.report.hookPath).toBe("experimental.session.compacting")
    expect(payload.report.modelId).toBe("gpt-4.1-preview")
    expect(payload.report.countState).toBe("provider-api-only")
    expect(payload.report.budgetBasis).toBe("configured-bytes")
    expect(payload.report.trimBasis).toBe("configured-bytes")
    expect(payload.report.exactTokenDelta).toBe(null)
    expectSummaryMetadataToMatchReportProjection(payload)
  })

  it("emits unsupported fallback runtime reports without exact token deltas", () => {
    const report = runHelperRuntimeReport({
      WUNDERKIND_TEST_MODEL: "claude-3-5-sonnet",
      WUNDERKIND_TEST_ENGINE: "advisory",
      WUNDERKIND_TEST_BYTE_BUDGET: "1200",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-context",
    })

    expect(report.countState).toBe("unsupported")
    expect(report.budgetBasis).toBe("configured-bytes")
    expect(report.trimApplied).toBe(false)
    expect(report.noTrimReason).toBe("advisory-mode-report-only")
    expect(report.exactTokenDelta).toBe(null)
  })

  it("masks seeded secret helper public payload model ids without changing unsupported fallback semantics", () => {
    const seededSecretModelId = "sk-live-helper-surface"
    const payload = runHelperRuntimePublicPayload({
      WUNDERKIND_TEST_MODEL: seededSecretModelId,
      WUNDERKIND_TEST_ENGINE: "advisory",
      WUNDERKIND_TEST_BYTE_BUDGET: "1200",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-context",
      WUNDERKIND_TEST_HOOK_PATH: "experimental.chat.system.transform",
    })

    expect(payload.report.hookPath).toBe("experimental.chat.system.transform")
    expect(payload.report.modelId).toBe("***")
    expect(payload.report.countState).toBe("unsupported")
    expect(payload.report.budgetBasis).toBe("configured-bytes")
    expect(payload.report.trimApplied).toBe(false)
    expect(payload.report.noTrimReason).toBe("advisory-mode-report-only")
    expect(payload.report.exactTokenDelta).toBe(null)
    expect(JSON.stringify(payload)).not.toContain(seededSecretModelId)
    expectSummaryMetadataToMatchReportProjection(payload)
  })

  it("reports advisory no-trim reasons and active savings without persisting prompt content", () => {
    const fixture = captureCanonicalRuntimeFixture("fixture-runtime-active-trim")
    const eligibleSections = collectPromptOptimizationEligibleSections(fixture)
    const promptContent = eligibleSections.map((section) => section.content).join("\n")

    const advisoryReport = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: null,
      promptOptimizationMode: "advisory",
      content: promptContent,
      eligibleSections,
      promptOptimizationByteBudget: 1200,
    })
    const activeReport = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: null,
      promptOptimizationMode: "active",
      content: promptContent,
      eligibleSections,
      promptOptimizationByteBudget: 1200,
    })

    expect(advisoryReport.hookPath).toBe("experimental.chat.system.transform")
    expect(advisoryReport.promptOptimizationMode).toBe("advisory")
    expect(advisoryReport.trimApplied).toBe(false)
    expect(advisoryReport.savedBytes).toBe(0)
    expect(advisoryReport.noTrimReason).toBe("advisory-mode-report-only")
    expect(advisoryReport.exactTokenDelta).toBe(null)
    expect(advisoryReport.budgetLimit).toBe(1200)
    expect(advisoryReport.trimBudgetLimit).toBe(1200)
    expect(activeReport.hookPath).toBe("experimental.chat.system.transform")
    expect(activeReport.promptOptimizationMode).toBe("active")
    expect(activeReport.trimApplied).toBe(true)
    expect(activeReport.trimExhausted).toBe(false)
    expect(activeReport.noTrimReason).toBe(null)
    expect(activeReport.savedBytes).toBeGreaterThan(0)
    expect(activeReport.afterBytes < activeReport.beforeBytes).toBe(true)
    expect(activeReport.exactTokenDelta).toBe(null)
    expect(activeReport).not.toHaveProperty("content")
  })

  it("surfaces exact-local supplemental token deltas on the real runtime-report builder", () => {
    const fixture = captureCanonicalRuntimeFixture("fixture-runtime-active-trim")
    const eligibleSections = collectPromptOptimizationEligibleSections(fixture)
    const promptContent = eligibleSections.map((section) => section.content).join("\n")

    const report = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: "gpt-4.1",
      promptOptimizationMode: "active",
      content: promptContent,
      eligibleSections,
      promptOptimizationTokenBudget: 1,
      promptOptimizationByteBudget: 1200,
    })

    expect(report.countState).toBe("exact-local")
    expect(report.budgetBasis).toBe("exact-openai-tokens")
    expect(report.trimBasis).toBe("configured-bytes")
    expect(report.trimApplied).toBe(true)
    expect(report.exactTokenDelta).not.toBe(null)
    expect(report.exactTokenDelta?.beforeTokens).toBeGreaterThan(
      report.exactTokenDelta?.afterTokens ?? Number.POSITIVE_INFINITY,
    )
    expect(report.exactTokenDelta?.savedTokens).toBeGreaterThan(0)
    expect(report.exactTokenDelta?.savedTokens).toBe(
      (report.exactTokenDelta?.beforeTokens ?? 0) - (report.exactTokenDelta?.afterTokens ?? 0),
    )
    expect(report).not.toHaveProperty("content")
  })

  it("reports active over-budget no-trim truthfully when runtime-context is the only eligible non-trimmable section", () => {
    const runtimeContextOnlySection = {
      id: "runtime-context" as const,
      content: [
        "<!-- wunderkind:runtime-context-start -->",
        "## Wunderkind Resolved Runtime Context",
        "- region: South Africa",
      ].join("\n"),
    }

    const report = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: null,
      promptOptimizationMode: "active",
      content: runtimeContextOnlySection.content,
      eligibleSections: [runtimeContextOnlySection],
      promptOptimizationByteBudget: 1,
    })

    expect(report.eligibleSections).toEqual(["runtime-context"])
    expect(report.trimApplied).toBe(false)
    expect(report.trimExhausted).toBe(false)
    expect(report.beforeBytes).toBe(report.afterBytes)
    expect(report.afterBytes > (report.trimBudgetLimit ?? Number.POSITIVE_INFINITY)).toBe(true)
    expect(report.noTrimReason).toBe("over-trim-budget-no-trimmable-sections")
  })

  it("emits a continuity-floor exhaustion runtime report for the compaction hook", () => {
    const report = runHelperRuntimeReport({
      WUNDERKIND_TEST_ENGINE: "active",
      WUNDERKIND_TEST_HOOK_PATH: "experimental.session.compacting",
      WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
      WUNDERKIND_TEST_BYTE_BUDGET: "1",
    })

    expect(report.hookPath).toBe("experimental.session.compacting")
    expect(report.trimApplied).toBe(true)
    expect(report.trimExhausted).toBe(true)
    expect(report.trimmedSections).toContain("compaction-continuity")
    expect(report.afterBytes < report.beforeBytes).toBe(true)
    expect(report.noTrimReason).toBe(null)
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
