import { PROMPT_ANSWER_QUALITY_CONTRACT_MODE, PROMPT_ANSWER_QUALITY_FACET_IDS, type PromptAnswerQualityAggregateResult, type PromptAnswerQualityCaseId, type PromptAnswerQualityCasePack, type PromptAnswerQualityCaseResult, type PromptAnswerQualityEvaluationOutput, type PromptAnswerQualityExecutionMode, type PromptAnswerQualityFacetId } from "./prompt-answer-quality-contract.js"
import { buildPromptAnswerQualityFingerprintInput, fingerprintPromptAnswerQualityInput, type PromptAnswerQualityFingerprintInput } from "./prompt-answer-quality-fingerprint.js"
import { evaluatePromptAnswerQualityFacet, normalizePromptAnswerQualityText } from "./prompt-answer-quality-scoring.js"

export { buildPromptAnswerQualityFingerprintInput, fingerprintPromptAnswerQualityInput, normalizePromptAnswerQualityText }
export type { PromptAnswerQualityFingerprintInput }

export interface PromptAnswerQualityCasePackEvaluationInput {
  readonly casePack: PromptAnswerQualityCasePack
  readonly executionMode: PromptAnswerQualityExecutionMode
  readonly providerId: string
  readonly modelId: string
  readonly answersByCaseId: Readonly<Record<PromptAnswerQualityCaseId, string>>
}

export interface PromptAnswerQualityFacetAggregate {
  readonly facetId: PromptAnswerQualityFacetId
  readonly averageScore: number
  readonly averageNormalizedScore: number
  readonly failingCaseCount: number
}

export interface PromptAnswerQualityAggregateMetrics {
  readonly aggregate: PromptAnswerQualityAggregateResult
  readonly passRate: number
  readonly averageCaseScore: number
  readonly facetAggregates: readonly PromptAnswerQualityFacetAggregate[]
}

export interface PromptAnswerQualityCaseRegression {
  readonly caseId: PromptAnswerQualityCaseId
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly baselinePassed: boolean
  readonly optimizedPassed: boolean
  readonly regressedFacetIds: readonly PromptAnswerQualityFacetId[]
  readonly reasons: readonly ("case-score-decreased" | "case-pass-state-regressed" | "facet-score-decreased")[]
}

export interface PromptAnswerQualityEvaluationComparison {
  readonly passed: boolean
  readonly aggregate: { readonly scoreDelta: number; readonly normalizedScoreDelta: number }
  readonly regressions: readonly PromptAnswerQualityCaseRegression[]
}

export function evaluatePromptAnswerQualityCase(
  caseDefinition: PromptAnswerQualityCasePack["cases"][number],
  answer: string,
): PromptAnswerQualityCaseResult {
  const facetScores = caseDefinition.rubric.facets.map((facet) => evaluatePromptAnswerQualityFacet(caseDefinition, facet, answer))
  const score = facetScores.reduce((total, facet) => total + facet.score, 0)
  const passed = score >= caseDefinition.rubric.passingScore && caseDefinition.rubric.facets.every((facet, index) => {
    const facetScore = facetScores[index]
    return facetScore !== undefined && facetScore.score >= facet.minimumScore
  })

  return { caseId: caseDefinition.caseId, caseType: caseDefinition.caseType, optimizationLevel: caseDefinition.optimizationLevel, score, maxScore: caseDefinition.rubric.maximumScore, passed, facetScores, answer }
}

export function buildPromptAnswerQualityAggregateMetrics(cases: readonly PromptAnswerQualityCaseResult[]): PromptAnswerQualityAggregateMetrics {
  const aggregate = buildAggregate(cases)
  return {
    aggregate,
    passRate: roundNumber(aggregate.caseCount === 0 ? 0 : aggregate.passedCaseCount / aggregate.caseCount),
    averageCaseScore: roundNumber(aggregate.caseCount === 0 ? 0 : aggregate.totalScore / aggregate.caseCount),
    facetAggregates: PROMPT_ANSWER_QUALITY_FACET_IDS.map((facetId) => {
      const facetScores = cases.flatMap((result) => result.facetScores.filter((facet) => facet.facetId === facetId))
      const totalScore = facetScores.reduce((total, facet) => total + facet.score, 0)
      return { facetId, averageScore: roundNumber(facetScores.length === 0 ? 0 : totalScore / facetScores.length), averageNormalizedScore: roundNumber(facetScores.length === 0 ? 0 : totalScore / (facetScores.length * 4)), failingCaseCount: facetScores.filter((facet) => facet.score < 2).length }
    }),
  }
}

export function buildPromptAnswerQualityEvaluationOutput(input: { readonly executionMode: PromptAnswerQualityExecutionMode; readonly casePackId: PromptAnswerQualityEvaluationOutput["casePackId"]; readonly providerId: string; readonly modelId: string; readonly cases: readonly PromptAnswerQualityCaseResult[] }): PromptAnswerQualityEvaluationOutput {
  return { contractMode: PROMPT_ANSWER_QUALITY_CONTRACT_MODE, executionMode: input.executionMode, casePackId: input.casePackId, providerId: input.providerId.trim(), modelId: input.modelId.trim(), cases: input.cases, aggregate: buildAggregate(input.cases) }
}

export function evaluatePromptAnswerQualityCasePack(input: PromptAnswerQualityCasePackEvaluationInput): PromptAnswerQualityEvaluationOutput {
  return buildPromptAnswerQualityEvaluationOutput({ executionMode: input.executionMode, casePackId: input.casePack.casePackId, providerId: input.providerId, modelId: input.modelId, cases: input.casePack.cases.map((caseDefinition) => evaluatePromptAnswerQualityCase(caseDefinition, readAnswer(input.answersByCaseId, caseDefinition.caseId))) })
}

export function comparePromptAnswerQualityEvaluationOutputs(input: { readonly baseline: PromptAnswerQualityEvaluationOutput; readonly optimized: PromptAnswerQualityEvaluationOutput }): PromptAnswerQualityEvaluationComparison {
  const regressions = input.baseline.cases.flatMap((baselineCase) => {
    const optimizedCase = input.optimized.cases.find((candidate) => candidate.caseId === baselineCase.caseId)
    if (!optimizedCase) return []

    const regressedFacetIds = baselineCase.facetScores.flatMap((baselineFacet) => {
      const optimizedFacet = optimizedCase.facetScores.find((candidate) => candidate.facetId === baselineFacet.facetId)
      return optimizedFacet !== undefined && optimizedFacet.score < baselineFacet.score ? [baselineFacet.facetId] : []
    })
    const reasons = [
      ...(optimizedCase.score < baselineCase.score ? (["case-score-decreased"] as const) : []),
      ...(baselineCase.passed && !optimizedCase.passed ? (["case-pass-state-regressed"] as const) : []),
      ...(regressedFacetIds.length > 0 ? (["facet-score-decreased"] as const) : []),
    ]

    return reasons.length === 0 ? [] : [{ caseId: baselineCase.caseId, baselineScore: baselineCase.score, optimizedScore: optimizedCase.score, baselinePassed: baselineCase.passed, optimizedPassed: optimizedCase.passed, regressedFacetIds, reasons }]
  })

  return { passed: regressions.length === 0 && input.optimized.aggregate.normalizedScore >= input.baseline.aggregate.normalizedScore, aggregate: { scoreDelta: input.optimized.aggregate.totalScore - input.baseline.aggregate.totalScore, normalizedScoreDelta: roundNumber(input.optimized.aggregate.normalizedScore - input.baseline.aggregate.normalizedScore) }, regressions }
}

function readAnswer(answers: Readonly<Record<PromptAnswerQualityCaseId, string>>, caseId: PromptAnswerQualityCaseId): string {
  const answer = answers[caseId]
  if (answer === undefined) throw new Error(`Missing prompt answer quality answer for case ${caseId}`)
  return answer
}

function buildAggregate(cases: readonly PromptAnswerQualityCaseResult[]): PromptAnswerQualityAggregateResult {
  const totalScore = cases.reduce((total, result) => total + result.score, 0)
  const maxScore = cases.reduce((total, result) => total + result.maxScore, 0)
  return { caseCount: cases.length, passedCaseCount: cases.filter((result) => result.passed).length, totalScore, maxScore, normalizedScore: roundNumber(maxScore === 0 ? 0 : totalScore / maxScore) }
}

function roundNumber(value: number): number { return Number(value.toFixed(4)) }
