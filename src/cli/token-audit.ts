import { encodingForModel, type Tiktoken, type TiktokenModel } from "js-tiktoken"
import type { PromptOptimizationMode } from "./types.js"
import {
  collectTokenAuditReport,
  renderTokenAuditTable,
  type TokenAuditFormat,
  type TokenAuditSurface,
} from "./prompt-surface-audit.js"
import {
  trimPromptOptimizationRuntimeSections,
  type PromptOptimizationRuntimeSection,
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
  readonly trimApplied: boolean
  readonly trimExhausted: boolean
  readonly trimmedSections: readonly string[]
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

type ExactLocalOpenAiModelId = (typeof OPENAI_EXACT_LOCAL_MODEL_IDS)[number]

const exactLocalOpenAiEncoders = new Map<ExactLocalOpenAiModelId, Tiktoken>()

interface OutputWriter {
  (line: string): void
}

export interface TokenAuditOptions {
  readonly cwd?: string
  readonly surface?: TokenAuditSurface
  readonly format?: TokenAuditFormat
  readonly writeStdout?: OutputWriter
  readonly writeStderr?: OutputWriter
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
  const activeTrimResult =
    input.promptOptimizationMode === "active" && typeof input.promptOptimizationByteBudget === "number"
      ? trimPromptOptimizationRuntimeSections(input.eligibleSections ?? [], input.promptOptimizationByteBudget)
      : {
          trimApplied: false,
          trimExhausted: false,
          trimmedSections: [],
        }

  return {
    modelId: input.modelId ?? null,
    promptOptimizationMode: input.promptOptimizationMode,
    countState: budgetPressure.countState,
    budgetBasis: budgetPressure.budgetBasis,
    trimApplied: activeTrimResult.trimApplied,
    trimExhausted: activeTrimResult.trimExhausted,
    trimmedSections: activeTrimResult.trimmedSections,
  }
}

function writeLine(writer: OutputWriter | undefined, value: string): void {
  ;(writer ?? console.log)(value)
}

export async function runTokenAudit(options: TokenAuditOptions): Promise<number> {
  const surface = options.surface ?? "agents"
  const format = options.format ?? "table"
  const report = await collectTokenAuditReport(surface)

  if (format === "json") {
    writeLine(options.writeStdout, JSON.stringify(report))
    return 0
  }

  for (const line of renderTokenAuditTable(report)) {
    writeLine(options.writeStdout, line)
  }

  return 0
}
