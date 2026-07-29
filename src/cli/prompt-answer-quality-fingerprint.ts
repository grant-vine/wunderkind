import { createHash } from "node:crypto"
import type {
  PromptAnswerQualityCaseResult,
  PromptAnswerQualityEvaluationOutput,
  PromptAnswerQualityExecutionMode,
  PromptAnswerQualityFacetId,
  PromptAnswerQualityRubricScore,
} from "./prompt-answer-quality-contract.js"
import { normalizePromptAnswerQualityText } from "./prompt-answer-quality-scoring.js"

type Scalar = boolean | number | string | null | readonly Scalar[] | ScalarObject
type ScalarObject = { readonly [key: string]: Scalar }

type PromptAnswerQualityFingerprintFacetInput = ScalarObject & {
  readonly facetId: PromptAnswerQualityFacetId
  readonly score: PromptAnswerQualityRubricScore
  readonly maxScore: number
}

type PromptAnswerQualityFingerprintCaseInput = ScalarObject & {
  readonly caseId: PromptAnswerQualityCaseResult["caseId"]
  readonly caseType: PromptAnswerQualityCaseResult["caseType"]
  readonly optimizationLevel: PromptAnswerQualityCaseResult["optimizationLevel"]
  readonly score: number
  readonly maxScore: number
  readonly passed: boolean
  readonly normalizedAnswerBytes: number
  readonly lineCount: number
  readonly bulletCount: number
  readonly answerDigest: string
  readonly facetScores: readonly PromptAnswerQualityFingerprintFacetInput[]
}

export type PromptAnswerQualityFingerprintInput = ScalarObject & {
  readonly contractMode: PromptAnswerQualityEvaluationOutput["contractMode"]
  readonly executionMode: PromptAnswerQualityExecutionMode
  readonly casePackId: PromptAnswerQualityEvaluationOutput["casePackId"]
  readonly providerId: string
  readonly modelId: string
  readonly aggregate: {
    readonly caseCount: number
    readonly passedCaseCount: number
    readonly totalScore: number
    readonly maxScore: number
    readonly normalizedScore: number
  }
  readonly cases: readonly PromptAnswerQualityFingerprintCaseInput[]
}

export function buildPromptAnswerQualityFingerprintInput(
  output: PromptAnswerQualityEvaluationOutput,
): Readonly<PromptAnswerQualityFingerprintInput> {
  return deepFreezeScalar({
    contractMode: output.contractMode,
    executionMode: output.executionMode,
    casePackId: output.casePackId,
    providerId: output.providerId.trim(),
    modelId: output.modelId.trim(),
    aggregate: {
      caseCount: output.aggregate.caseCount,
      passedCaseCount: output.aggregate.passedCaseCount,
      totalScore: output.aggregate.totalScore,
      maxScore: output.aggregate.maxScore,
      normalizedScore: output.aggregate.normalizedScore,
    },
    cases: output.cases.map((result) => ({
      caseId: result.caseId,
      caseType: result.caseType,
      optimizationLevel: result.optimizationLevel,
      score: result.score,
      maxScore: result.maxScore,
      passed: result.passed,
      normalizedAnswerBytes: Buffer.byteLength(normalizePromptAnswerQualityText(result.answer), "utf8"),
      lineCount: getNonEmptyLines(result.answer).length,
      bulletCount: getBulletLines(result.answer).length,
      answerDigest: createDigest(normalizePromptAnswerQualityText(result.answer)),
      facetScores: result.facetScores.map((facetScore) => ({ facetId: facetScore.facetId, score: facetScore.score, maxScore: facetScore.maxScore })),
    })),
  })
}

export function fingerprintPromptAnswerQualityInput(input: PromptAnswerQualityFingerprintInput): string {
  return createDigest(stableSerialize(input))
}

function getNonEmptyLines(answer: string): readonly string[] { return answer.split("\n").map((line) => line.trim()).filter((line) => line !== "") }
function getBulletLines(answer: string): readonly string[] { return getNonEmptyLines(answer).filter((line) => line.startsWith("- ") || line.startsWith("* ")) }
function createDigest(value: string): string { return createHash("sha256").update(value).digest("hex") }
function stableSerialize(value: Scalar): string { return JSON.stringify(orderScalar(value)) }
function orderScalar(value: Scalar): Scalar { if (Array.isArray(value)) return value.map((entry) => orderScalar(entry)); if (isScalarObject(value)) return Object.keys(value).sort().reduce<ScalarObject>((ordered, key) => { const entry = value[key]; return entry === undefined ? ordered : { ...ordered, [key]: orderScalar(entry) } }, {}); return value }
function deepFreezeScalar<T extends Scalar>(value: T): Readonly<T> { if (Array.isArray(value)) value.forEach((entry) => deepFreezeScalar(entry)); else if (isScalarObject(value)) Object.values(value).forEach((entry) => deepFreezeScalar(entry)); return Object.freeze(value) }
function isScalarObject(value: Scalar): value is ScalarObject { return value !== null && typeof value === "object" && !Array.isArray(value) }
