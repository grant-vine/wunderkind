import type { PromptOptimizationLevel } from "./prompt-runtime-contract.js"

export const PROMPT_ANSWER_QUALITY_CONTRACT_MODE = "prompt-answer-quality-eval-v1" as const
export const PROMPT_ANSWER_QUALITY_PROVIDER_PROTOCOL_MODE =
  "prompt-answer-quality-provider-v1" as const
export const PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID =
  "prompt-answer-quality-default-case-pack-v1" as const

export const PROMPT_ANSWER_QUALITY_EXECUTION_MODES = [
  "single-case",
  "default-case-pack",
] as const

export const PROMPT_ANSWER_QUALITY_CASE_TYPES = [
  "diagnosis",
  "triage",
  "comparison",
  "synthesis",
] as const

export const PROMPT_ANSWER_QUALITY_FACET_IDS = [
  "instruction-following",
  "constraint-preservation",
  "evidence-use",
  "actionability",
] as const

export const PROMPT_ANSWER_QUALITY_RUBRIC_SCORES = [0, 1, 2, 3, 4] as const

export const PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS = [
  "answer-quality-latest-user-preserves-constraints",
  "answer-quality-runtime-tools-uses-noisy-output",
  "answer-quality-contextual-synthesizes-selected-context",
  "answer-quality-transcript-reconciles-history",
] as const

export const PROMPT_ANSWER_QUALITY_REQUIRED_TOP_LEVEL_KEYS = [
  "contractMode",
  "executionMode",
  "casePackId",
  "providerId",
  "modelId",
  "cases",
  "aggregate",
] as const

export const PROMPT_ANSWER_QUALITY_REQUIRED_PER_CASE_KEYS = [
  "caseId",
  "caseType",
  "optimizationLevel",
  "score",
  "maxScore",
  "passed",
  "facetScores",
  "answer",
] as const

export const PROMPT_ANSWER_QUALITY_REQUIRED_AGGREGATE_KEYS = [
  "caseCount",
  "passedCaseCount",
  "totalScore",
  "maxScore",
  "normalizedScore",
] as const

export const PROMPT_ANSWER_QUALITY_PROVIDER_ERROR_CODES = [
  "provider-failed",
  "invalid-response",
  "empty-answer",
] as const

export type PromptAnswerQualityExecutionMode =
  (typeof PROMPT_ANSWER_QUALITY_EXECUTION_MODES)[number]
export type PromptAnswerQualityCaseType = (typeof PROMPT_ANSWER_QUALITY_CASE_TYPES)[number]
export type PromptAnswerQualityFacetId = (typeof PROMPT_ANSWER_QUALITY_FACET_IDS)[number]
export type PromptAnswerQualityRubricScore =
  (typeof PROMPT_ANSWER_QUALITY_RUBRIC_SCORES)[number]
export type PromptAnswerQualityCaseId = (typeof PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS)[number]
export type PromptAnswerQualityTopLevelKey =
  (typeof PROMPT_ANSWER_QUALITY_REQUIRED_TOP_LEVEL_KEYS)[number]
export type PromptAnswerQualityPerCaseKey =
  (typeof PROMPT_ANSWER_QUALITY_REQUIRED_PER_CASE_KEYS)[number]
export type PromptAnswerQualityAggregateKey =
  (typeof PROMPT_ANSWER_QUALITY_REQUIRED_AGGREGATE_KEYS)[number]
export type PromptAnswerQualityProviderErrorCode =
  (typeof PROMPT_ANSWER_QUALITY_PROVIDER_ERROR_CODES)[number]

export interface PromptAnswerQualityPromptSurfaces {
  readonly latestUserMessage: string
  readonly runtimeOwnedSections: readonly string[]
  readonly toolOutputs: readonly string[]
  readonly selectedContext: readonly string[]
  readonly retainedHistory: readonly string[]
  readonly transcriptWideCompaction: readonly string[]
}

export interface PromptAnswerQualityPromptDefinition {
  readonly systemInstruction: string
  readonly surfaces: PromptAnswerQualityPromptSurfaces
}

export interface PromptAnswerQualityFacetExpectation {
  readonly facetId: PromptAnswerQualityFacetId
  readonly minimumScore: PromptAnswerQualityRubricScore
  readonly guidance: string
  readonly positiveSignals: readonly string[]
  readonly failureSignals: readonly string[]
}

export interface PromptAnswerQualityRubric {
  readonly scale: readonly PromptAnswerQualityRubricScore[]
  readonly passingScore: number
  readonly maximumScore: number
  readonly facets: readonly PromptAnswerQualityFacetExpectation[]
}

export interface PromptAnswerQualityCaseDefinition {
  readonly caseId: PromptAnswerQualityCaseId
  readonly caseType: PromptAnswerQualityCaseType
  readonly title: string
  readonly optimizationLevel: PromptOptimizationLevel
  readonly expectedOutcome: string
  readonly prompt: PromptAnswerQualityPromptDefinition
  readonly rubric: PromptAnswerQualityRubric
}

export interface PromptAnswerQualityCasePack {
  readonly contractMode: typeof PROMPT_ANSWER_QUALITY_CONTRACT_MODE
  readonly casePackId: typeof PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID
  readonly levelsCovered: readonly PromptOptimizationLevel[]
  readonly cases: readonly PromptAnswerQualityCaseDefinition[]
}

export interface PromptAnswerQualityFacetScore {
  readonly facetId: PromptAnswerQualityFacetId
  readonly score: PromptAnswerQualityRubricScore
  readonly maxScore: 4
  readonly rationale: string
}

export interface PromptAnswerQualityCaseResult {
  readonly caseId: PromptAnswerQualityCaseId
  readonly caseType: PromptAnswerQualityCaseType
  readonly optimizationLevel: PromptOptimizationLevel
  readonly score: number
  readonly maxScore: number
  readonly passed: boolean
  readonly facetScores: readonly PromptAnswerQualityFacetScore[]
  readonly answer: string
}

export interface PromptAnswerQualityAggregateResult {
  readonly caseCount: number
  readonly passedCaseCount: number
  readonly totalScore: number
  readonly maxScore: number
  readonly normalizedScore: number
}

export interface PromptAnswerQualityEvaluationOutput {
  readonly contractMode: typeof PROMPT_ANSWER_QUALITY_CONTRACT_MODE
  readonly executionMode: PromptAnswerQualityExecutionMode
  readonly casePackId: typeof PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID | null
  readonly providerId: string
  readonly modelId: string
  readonly cases: readonly PromptAnswerQualityCaseResult[]
  readonly aggregate: PromptAnswerQualityAggregateResult
}

export type PromptAnswerQualityProviderMessageRole = "system" | "user" | "assistant"

export interface PromptAnswerQualityProviderMessage {
  readonly role: PromptAnswerQualityProviderMessageRole
  readonly content: string
}

export interface PromptAnswerQualityProviderStdin {
  readonly protocolMode: typeof PROMPT_ANSWER_QUALITY_PROVIDER_PROTOCOL_MODE
  readonly caseId: PromptAnswerQualityCaseId
  readonly executionMode: PromptAnswerQualityExecutionMode
  readonly messages: readonly PromptAnswerQualityProviderMessage[]
}

export interface PromptAnswerQualityProviderStdoutSuccess {
  readonly protocolMode: typeof PROMPT_ANSWER_QUALITY_PROVIDER_PROTOCOL_MODE
  readonly caseId: PromptAnswerQualityCaseId
  readonly status: "ok"
  readonly providerId: string
  readonly modelId: string
  readonly answer: string
}

export interface PromptAnswerQualityProviderStdoutError {
  readonly protocolMode: typeof PROMPT_ANSWER_QUALITY_PROVIDER_PROTOCOL_MODE
  readonly caseId: PromptAnswerQualityCaseId
  readonly status: "error"
  readonly errorCode: PromptAnswerQualityProviderErrorCode
  readonly errorMessage: string
}

export type PromptAnswerQualityProviderStdout =
  | PromptAnswerQualityProviderStdoutSuccess
  | PromptAnswerQualityProviderStdoutError

export interface PromptAnswerQualityContract {
  readonly contractMode: typeof PROMPT_ANSWER_QUALITY_CONTRACT_MODE
  readonly providerProtocolMode: typeof PROMPT_ANSWER_QUALITY_PROVIDER_PROTOCOL_MODE
  readonly defaultCasePackId: typeof PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID
  readonly executionModes: readonly PromptAnswerQualityExecutionMode[]
  readonly caseTypes: readonly PromptAnswerQualityCaseType[]
  readonly facetIds: readonly PromptAnswerQualityFacetId[]
  readonly requiredTopLevelKeys: readonly PromptAnswerQualityTopLevelKey[]
  readonly requiredPerCaseKeys: readonly PromptAnswerQualityPerCaseKey[]
  readonly requiredAggregateKeys: readonly PromptAnswerQualityAggregateKey[]
}

export const PROMPT_ANSWER_QUALITY_CONTRACT: PromptAnswerQualityContract = {
  contractMode: PROMPT_ANSWER_QUALITY_CONTRACT_MODE,
  providerProtocolMode: PROMPT_ANSWER_QUALITY_PROVIDER_PROTOCOL_MODE,
  defaultCasePackId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID,
  executionModes: PROMPT_ANSWER_QUALITY_EXECUTION_MODES,
  caseTypes: PROMPT_ANSWER_QUALITY_CASE_TYPES,
  facetIds: PROMPT_ANSWER_QUALITY_FACET_IDS,
  requiredTopLevelKeys: PROMPT_ANSWER_QUALITY_REQUIRED_TOP_LEVEL_KEYS,
  requiredPerCaseKeys: PROMPT_ANSWER_QUALITY_REQUIRED_PER_CASE_KEYS,
  requiredAggregateKeys: PROMPT_ANSWER_QUALITY_REQUIRED_AGGREGATE_KEYS,
}
