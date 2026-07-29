import { describe, expect, it } from "bun:test"
import {
  buildPromptAnswerQualityFingerprintInput,
  comparePromptAnswerQualityEvaluationOutputs,
  evaluatePromptAnswerQualityCasePack,
  fingerprintPromptAnswerQualityInput,
} from "../../src/cli/prompt-answer-quality-evaluator.js"
import { PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK } from "../../src/cli/prompt-answer-quality-fixtures.js"

const GOOD_ANSWERS = {
  "answer-quality-latest-user-preserves-constraints": [
    "Diagnosis: The latest-user seam likely treated immutable literals as shrinkable, so `src/runtime-user-prompt-optimization.ts`, `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts`, and \"leave this exact text alone\" were not preserved byte-exact.",
    "",
    "- Re-run `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts` and confirm the latest-user seam preserves `src/runtime-user-prompt-optimization.ts` and \"leave this exact text alone\" exactly.",
    "- Inspect only `src/cli/` checks for immutable spans to confirm the answer builder keeps the exact path, command, and quote untouched.",
  ].join("\n"),
  "answer-quality-runtime-tools-uses-noisy-output": [
    "Summary: The repeated warning and cache-wait noise point to a retry loop around remote cache completion, not a new product bug.",
    "Likely cause: the runtime-and-tools compaction is surfacing repeated retry warnings without collapsing them into one stable signal for Path: src/cli/prompt-optimization-runtime-reporting.ts and https://example.com/tool-output/log.",
    "Rerun: `$ bun test tests/unit/prompt-optimization-efficacy.test.ts`",
  ].join("\n"),
  "answer-quality-contextual-synthesizes-selected-context": [
    "- Preserved invariants: keep `<!-- wunderkind:selected-context-preserve-start -->`, `<!-- wunderkind:selected-context-preserve-end -->`, `Path: src/runtime-transcript-compression.ts`, `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts`, and https://example.com/context-spec exact because they mark the protected selected-context contract.",
    "- Compressible context: shrink the repeated note \"preserve the causal chain before proposing changes\" because it is repeated diagnosis context rather than an invariant, and the preserve markers make the preserve-versus-compress rule explicit.",
  ].join("\n"),
  "answer-quality-transcript-reconciles-history": [
    "- Latest request: `Latest request must remain untouched.`",
    "- Protected history: keep `Background task id: bg_transcript123 remains session-local.`, `Quoted user example: \"keep this quote exact\".`, and `Path: src/runtime-user-prompt-optimization.ts` exact because they are protected transcript history.",
    "- Compressible history: shrink repeated summaries like `Earlier retained history summary. Earlier retained history summary.` and `Repeated earlier diagnosis line. Repeated earlier diagnosis line.` while preserving the latest request and protected literals as the practical preserve-versus-compress rule.",
  ].join("\n"),
} as const

const REGRESSED_ANSWERS = {
  ...GOOD_ANSWERS,
  "answer-quality-latest-user-preserves-constraints":
    "General issue. Edit files anywhere and rewrite the request text if needed.",
} as const

describe("prompt answer quality evaluator", () => {
  it("scores the default case pack deterministically and builds a sanitized fingerprint input", () => {
    const evaluation = evaluatePromptAnswerQualityCasePack({
      casePack: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK,
      executionMode: "default-case-pack",
      providerId: "deterministic-stub",
      modelId: "stub-v1",
      answersByCaseId: GOOD_ANSWERS,
    })

    expect(evaluation.contractMode).toBe("prompt-answer-quality-eval-v1")
    expect(evaluation.executionMode).toBe("default-case-pack")
    expect(evaluation.casePackId).toBe("prompt-answer-quality-default-case-pack-v1")
    expect(evaluation.aggregate).toEqual({
      caseCount: 4,
      passedCaseCount: 4,
      totalScore: 64,
      maxScore: 64,
      normalizedScore: 1,
    })
    expect(evaluation.cases.every((result) => result.passed)).toBe(true)

    const fingerprintInput = buildPromptAnswerQualityFingerprintInput(evaluation)
    const fingerprintJson = JSON.stringify(fingerprintInput)

    expect(Object.isFrozen(fingerprintInput)).toBe(true)
    expect(Object.isFrozen(fingerprintInput.cases)).toBe(true)
    expect(fingerprintJson).not.toContain("leave this exact text alone")
    expect(fingerprintJson).not.toContain("Latest request must remain untouched.")
    expect(fingerprintJson).not.toContain("General issue")

    const firstFingerprint = fingerprintPromptAnswerQualityInput(fingerprintInput)
    const secondFingerprint = fingerprintPromptAnswerQualityInput(
      buildPromptAnswerQualityFingerprintInput(evaluation),
    )

    expect(firstFingerprint).toBe(secondFingerprint)
  })

  it("detects baseline-versus-optimized regressions at aggregate and case level", () => {
    const baseline = evaluatePromptAnswerQualityCasePack({
      casePack: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK,
      executionMode: "default-case-pack",
      providerId: "deterministic-stub",
      modelId: "stub-v1",
      answersByCaseId: GOOD_ANSWERS,
    })
    const optimized = evaluatePromptAnswerQualityCasePack({
      casePack: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK,
      executionMode: "default-case-pack",
      providerId: "deterministic-stub",
      modelId: "stub-v1",
      answersByCaseId: REGRESSED_ANSWERS,
    })

    const comparison = comparePromptAnswerQualityEvaluationOutputs({ baseline, optimized })
    const latestUserRegression = comparison.regressions.find(
      (regression) =>
        regression.caseId === "answer-quality-latest-user-preserves-constraints",
    )

    expect(comparison.passed).toBe(false)
    expect(comparison.aggregate.scoreDelta < 0).toBe(true)
    expect(comparison.aggregate.normalizedScoreDelta < 0).toBe(true)
    expect(latestUserRegression).toEqual({
      caseId: "answer-quality-latest-user-preserves-constraints",
      baselineScore: 16,
      optimizedScore: 0,
      baselinePassed: true,
      optimizedPassed: false,
      regressedFacetIds: [
        "instruction-following",
        "constraint-preservation",
        "evidence-use",
        "actionability",
      ],
      reasons: [
        "case-score-decreased",
        "case-pass-state-regressed",
        "facet-score-decreased",
      ],
    })
  })
})
