import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { encodingForModel, type Tiktoken, type TiktokenModel } from "js-tiktoken"
import type { PromptOptimizationV4PassthroughReasonId } from "./prompt-runtime-contract.js"
import { buildPromptOptimizationRuntimePublicPayload } from "./prompt-optimization-runtime-public-payload.js"
import {
  PROMPT_OPTIMIZATION_RUNTIME_REPORT_ARTIFACTS,
  type PromptOptimizationRuntimeReportArtifact,
} from "./prompt-runtime-contract.js"
import type { PromptOptimizationMode, PromptOptimizationReportingMode } from "./types.js"
import type { V4UserPromptOptimizationMeasurement } from "../runtime-user-prompt-optimization.js"
import {
  getPromptOptimizationRuntimeSectionByteLength,
  trimPromptOptimizationRuntimeSections,
  type PromptOptimizationRuntimeSection,
  type PromptOptimizationRuntimeSectionId,
  type PromptOptimizationRuntimeTrimBasis,
  type PromptOptimizationRuntimeTrimResult,
} from "../runtime-prompt-sections.js"

export const OPENAI_EXACT_LOCAL_MODEL_IDS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"] as const satisfies readonly TiktokenModel[]

export type PromptOptimizationCountState = "exact-local" | "provider-api-only" | "unsupported"
export type PromptOptimizationBudgetBasis = "exact-openai-tokens" | "configured-bytes" | "budget-unavailable"

export type PromptOptimizationTokenCount =
  | {
      readonly countState: "exact-local"
      readonly tokenCount: number
    }
  | {
      readonly countState: "provider-api-only"
      readonly tokenCount: null
    }
  | {
      readonly countState: "unsupported"
      readonly tokenCount: null
    }

export interface PromptOptimizationBudgetPressure {
  readonly countState: PromptOptimizationCountState
  readonly budgetBasis: PromptOptimizationBudgetBasis
  readonly measuredUsage: number | null
  readonly budgetLimit: number | null
  readonly overBudget: boolean
}

export interface PromptOptimizationAdvisoryResult {
  readonly modelId: string | null
  readonly promptOptimizationMode: PromptOptimizationMode
  readonly countState: PromptOptimizationCountState
  readonly budgetBasis: PromptOptimizationBudgetBasis
  readonly trimBasis: PromptOptimizationRuntimeTrimBasis
  readonly eligibleSections: readonly PromptOptimizationRuntimeSectionId[]
  readonly beforeBytes: number
  readonly afterBytes: number
  readonly savedBytes: number
  readonly trimApplied: boolean
  readonly trimExhausted: boolean
  readonly trimmedSections: readonly PromptOptimizationRuntimeSectionId[]
}

export interface PromptOptimizationExactTokenDelta {
  readonly beforeTokens: number
  readonly afterTokens: number
  readonly savedTokens: number
}

export interface PromptOptimizationRuntimeReport {
  readonly hookPath: PromptOptimizationRuntimeReportArtifact["hookPath"]
  readonly modelId: string | null
  readonly promptOptimizationMode: PromptOptimizationMode
  readonly countState: PromptOptimizationCountState
  readonly budgetBasis: PromptOptimizationBudgetBasis
  readonly budgetLimit: number | null
  readonly trimBasis: PromptOptimizationRuntimeTrimBasis
  readonly trimBudgetLimit: number | null
  readonly eligibleSections: readonly PromptOptimizationRuntimeSectionId[]
  readonly beforeBytes: number
  readonly afterBytes: number
  readonly savedBytes: number
  readonly trimApplied: boolean
  readonly trimExhausted: boolean
  readonly trimmedSections: readonly PromptOptimizationRuntimeSectionId[]
  readonly noTrimReason: string | null
  readonly exactTokenDelta: PromptOptimizationExactTokenDelta | null
}

export interface PromptOptimizationBudgetPressureInput {
  readonly modelId: string | null | undefined
  readonly content: string
  readonly promptOptimizationTokenBudget?: number | undefined
  readonly promptOptimizationByteBudget?: number | undefined
}

export interface PromptOptimizationAdvisoryInput extends PromptOptimizationBudgetPressureInput {
  readonly promptOptimizationMode: PromptOptimizationMode
  readonly eligibleSections?: readonly PromptOptimizationRuntimeSection[] | undefined
}

export interface PromptOptimizationRuntimeReportInput extends PromptOptimizationAdvisoryInput {
  readonly hookPath: PromptOptimizationRuntimeReportArtifact["hookPath"]
  readonly trimResult?: PromptOptimizationRuntimeTrimResult | undefined
  readonly v4PassthroughReason?: PromptOptimizationV4PassthroughReasonId | null | undefined
  readonly v4UserPromptOptimizationMeasurement?: V4UserPromptOptimizationMeasurement | undefined
}

type ExactLocalOpenAiModelId = (typeof OPENAI_EXACT_LOCAL_MODEL_IDS)[number]

const exactLocalOpenAiEncoders = new Map<ExactLocalOpenAiModelId, Tiktoken>()
export { getPromptOptimizationRuntimePublicModelId } from "./prompt-optimization-runtime-public-payload.js"

function buildUntrimmedRuntimeResult(
  eligibleSections: readonly PromptOptimizationRuntimeSection[],
): PromptOptimizationRuntimeTrimResult {
  const beforeBytes = getPromptOptimizationRuntimeSectionByteLength(eligibleSections)

  return {
    sections: eligibleSections,
    trimBasis: "configured-bytes",
    eligibleSections: eligibleSections.map((section) => section.id),
    beforeBytes,
    afterBytes: beforeBytes,
    savedBytes: 0,
    trimApplied: false,
    trimExhausted: false,
    trimmedSections: [],
  }
}

function buildRuntimeTrimResult(input: PromptOptimizationAdvisoryInput): PromptOptimizationRuntimeTrimResult {
  const eligibleSections = input.eligibleSections ?? []

  if (input.promptOptimizationMode === "active" && typeof input.promptOptimizationByteBudget === "number") {
    return trimPromptOptimizationRuntimeSections(eligibleSections, input.promptOptimizationByteBudget)
  }

  return buildUntrimmedRuntimeResult(eligibleSections)
}

function joinPromptOptimizationSectionContent(
  sections: readonly PromptOptimizationRuntimeSection[],
): string {
  return sections.map((section) => section.content).join("\n")
}

function buildExactTokenDelta(input: {
  readonly modelId: string | null | undefined
  readonly beforeContent: string
  readonly afterContent: string
}): PromptOptimizationExactTokenDelta | null {
  const beforeCount = countPromptOptimizationTokens(input.modelId, input.beforeContent)
  const afterCount = countPromptOptimizationTokens(input.modelId, input.afterContent)

  if (beforeCount.countState !== "exact-local" || afterCount.countState !== "exact-local") {
    return null
  }

  return {
    beforeTokens: beforeCount.tokenCount,
    afterTokens: afterCount.tokenCount,
    savedTokens: beforeCount.tokenCount - afterCount.tokenCount,
  }
}

function joinMeasuredPromptContent(segments: readonly string[]): string {
  return segments.filter((segment) => segment !== "").join("\n")
}

function getNoTrimReason(input: PromptOptimizationRuntimeReportInput, trimResult: PromptOptimizationRuntimeTrimResult): string | null {
  if (trimResult.trimApplied || input.v4UserPromptOptimizationMeasurement?.trimApplied === true) {
    return null
  }

  if (input.v4PassthroughReason) {
    return input.v4PassthroughReason
  }

  const v4MeasuredBytes = input.v4UserPromptOptimizationMeasurement?.afterBytes ?? 0

  if (trimResult.eligibleSections.length === 0 && v4MeasuredBytes === 0) {
    return "no-eligible-sections"
  }

  switch (input.promptOptimizationMode) {
    case "off":
      return "prompt-optimization-off"
    case "advisory":
      return "advisory-mode-report-only"
    case "active": {
      if (typeof input.promptOptimizationByteBudget !== "number") {
        return "trim-budget-unavailable"
      }

      return trimResult.afterBytes + v4MeasuredBytes > input.promptOptimizationByteBudget
        ? "over-trim-budget-no-trimmable-sections"
        : "within-trim-budget"
    }
  }
}

function getRuntimeReportArtifact(
  hookPath: PromptOptimizationRuntimeReportArtifact["hookPath"],
): PromptOptimizationRuntimeReportArtifact {
  const artifact = PROMPT_OPTIMIZATION_RUNTIME_REPORT_ARTIFACTS.find((candidate) => candidate.hookPath === hookPath)
  if (!artifact) {
    throw new Error(`Unsupported runtime report hook path: ${hookPath}`)
  }

  return artifact
}

function shouldPersistRuntimeReport(reportingMode: PromptOptimizationReportingMode | null | undefined): boolean {
  return reportingMode === "persist" || reportingMode === "summary"
}

function getExactLocalOpenAiModelId(modelId: string | null | undefined): ExactLocalOpenAiModelId | null {
  if (!modelId) {
    return null
  }

  for (const supportedModelId of OPENAI_EXACT_LOCAL_MODEL_IDS) {
    if (supportedModelId === modelId) {
      return supportedModelId
    }
  }

  return null
}

function isOpenAiModelId(modelId: string | null | undefined): modelId is string {
  if (!modelId) {
    return false
  }

  return modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4") || modelId.startsWith("chatgpt-")
}

function getExactLocalOpenAiEncoder(modelId: ExactLocalOpenAiModelId): Tiktoken {
  const cachedEncoder = exactLocalOpenAiEncoders.get(modelId)
  if (cachedEncoder) {
    return cachedEncoder
  }

  const createdEncoder = encodingForModel(modelId)
  exactLocalOpenAiEncoders.set(modelId, createdEncoder)
  return createdEncoder
}

export function getPromptOptimizationCountState(modelId: string | null | undefined): PromptOptimizationCountState {
  if (getExactLocalOpenAiModelId(modelId)) {
    return "exact-local"
  }

  if (isOpenAiModelId(modelId)) {
    return "provider-api-only"
  }

  return "unsupported"
}

export function countPromptOptimizationTokens(
  modelId: string | null | undefined,
  content: string,
): PromptOptimizationTokenCount {
  const exactLocalOpenAiModelId = getExactLocalOpenAiModelId(modelId)
  if (exactLocalOpenAiModelId) {
    return {
      countState: "exact-local",
      tokenCount: getExactLocalOpenAiEncoder(exactLocalOpenAiModelId).encode(content).length,
    }
  }

  if (isOpenAiModelId(modelId)) {
    return {
      countState: "provider-api-only",
      tokenCount: null,
    }
  }

  return {
    countState: "unsupported",
    tokenCount: null,
  }
}

export function getPromptOptimizationBudgetBasis(input: {
  readonly modelId: string | null | undefined
  readonly promptOptimizationTokenBudget?: number | undefined
  readonly promptOptimizationByteBudget?: number | undefined
}): PromptOptimizationBudgetBasis {
  if (
    getPromptOptimizationCountState(input.modelId) === "exact-local" &&
    typeof input.promptOptimizationTokenBudget === "number"
  ) {
    return "exact-openai-tokens"
  }

  if (typeof input.promptOptimizationByteBudget === "number") {
    return "configured-bytes"
  }

  return "budget-unavailable"
}

export function measurePromptOptimizationBudgetPressure(
  input: PromptOptimizationBudgetPressureInput,
): PromptOptimizationBudgetPressure {
  const tokenCount = countPromptOptimizationTokens(input.modelId, input.content)
  const budgetBasis = getPromptOptimizationBudgetBasis(input)

  switch (budgetBasis) {
    case "exact-openai-tokens": {
      const budgetLimit = input.promptOptimizationTokenBudget ?? null
      const measuredUsage = tokenCount.tokenCount

      return {
        countState: tokenCount.countState,
        budgetBasis,
        measuredUsage,
        budgetLimit,
        overBudget: budgetLimit !== null && measuredUsage !== null ? measuredUsage > budgetLimit : false,
      }
    }
    case "configured-bytes": {
      const budgetLimit = input.promptOptimizationByteBudget ?? null
      const measuredUsage = Buffer.byteLength(input.content, "utf8")

      return {
        countState: tokenCount.countState,
        budgetBasis,
        measuredUsage,
        budgetLimit,
        overBudget: budgetLimit !== null ? measuredUsage > budgetLimit : false,
      }
    }
    case "budget-unavailable":
      return {
        countState: tokenCount.countState,
        budgetBasis,
        measuredUsage: null,
        budgetLimit: null,
        overBudget: false,
      }
  }
}

export function buildPromptOptimizationAdvisoryResult(
  input: PromptOptimizationAdvisoryInput,
): PromptOptimizationAdvisoryResult {
  const budgetPressure = measurePromptOptimizationBudgetPressure(input)
  const activeTrimResult = buildRuntimeTrimResult(input)

  return {
    modelId: input.modelId ?? null,
    promptOptimizationMode: input.promptOptimizationMode,
    countState: budgetPressure.countState,
    budgetBasis: budgetPressure.budgetBasis,
    trimBasis: activeTrimResult.trimBasis,
    eligibleSections: activeTrimResult.eligibleSections,
    beforeBytes: activeTrimResult.beforeBytes,
    afterBytes: activeTrimResult.afterBytes,
    savedBytes: activeTrimResult.savedBytes,
    trimApplied: activeTrimResult.trimApplied,
    trimExhausted: activeTrimResult.trimExhausted,
    trimmedSections: activeTrimResult.trimmedSections,
  }
}

export function buildPromptOptimizationRuntimeReport(
  input: PromptOptimizationRuntimeReportInput,
): PromptOptimizationRuntimeReport {
  const budgetPressure = measurePromptOptimizationBudgetPressure(input)
  const trimResult = input.trimResult ?? buildRuntimeTrimResult(input)
  const runtimeBeforeContent = input.content
  const runtimeAfterContent = joinPromptOptimizationSectionContent(trimResult.sections)
  const v4UserPromptOptimizationMeasurement = input.v4UserPromptOptimizationMeasurement
  const beforeContent = v4UserPromptOptimizationMeasurement
    ? joinMeasuredPromptContent([runtimeBeforeContent, v4UserPromptOptimizationMeasurement.beforeMessage])
    : runtimeBeforeContent
  const afterContent = v4UserPromptOptimizationMeasurement
    ? joinMeasuredPromptContent([runtimeAfterContent, v4UserPromptOptimizationMeasurement.afterMessage])
    : runtimeAfterContent
  const beforeBytes = trimResult.beforeBytes + (v4UserPromptOptimizationMeasurement?.beforeBytes ?? 0)
  const afterBytes = trimResult.afterBytes + (v4UserPromptOptimizationMeasurement?.afterBytes ?? 0)
  const savedBytes = trimResult.savedBytes + (v4UserPromptOptimizationMeasurement?.savedBytes ?? 0)

  return {
    hookPath: input.hookPath,
    modelId: input.modelId ?? null,
    promptOptimizationMode: input.promptOptimizationMode,
    countState: budgetPressure.countState,
      budgetBasis: budgetPressure.budgetBasis,
      budgetLimit: budgetPressure.budgetLimit,
      trimBasis: trimResult.trimBasis,
      trimBudgetLimit: input.promptOptimizationByteBudget ?? null,
      eligibleSections: trimResult.eligibleSections,
      beforeBytes,
      afterBytes,
      savedBytes,
      trimApplied: trimResult.trimApplied || (v4UserPromptOptimizationMeasurement?.trimApplied ?? false),
      trimExhausted: trimResult.trimExhausted,
      trimmedSections: trimResult.trimmedSections,
      noTrimReason: getNoTrimReason(input, trimResult),
      exactTokenDelta: buildExactTokenDelta({
        modelId: input.modelId,
        beforeContent,
        afterContent,
      }),
    }
}

export function maybePersistPromptOptimizationRuntimeReport(options: {
  readonly cwd?: string | undefined
  readonly reportingMode: PromptOptimizationReportingMode | null | undefined
  readonly report: PromptOptimizationRuntimeReport
}): string | null {
  if (!shouldPersistRuntimeReport(options.reportingMode)) {
    return null
  }

  const artifact = getRuntimeReportArtifact(options.report.hookPath)
  const absolutePath = join(options.cwd ?? process.cwd(), artifact.filePath)
  const publicPayload = buildPromptOptimizationRuntimePublicPayload(options.report)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, `${JSON.stringify(publicPayload.report, null, 2)}\n`, "utf-8")
  return absolutePath
}

function readStringField(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

export function readPromptOptimizationModelId(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const source = input as Record<string, unknown>
  return readStringField(source, "modelId") ?? readStringField(source, "model")
}
