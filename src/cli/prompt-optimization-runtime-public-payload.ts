import type { PromptOptimizationRuntimeReport } from "./prompt-optimization-runtime-reporting.js"
import {
  isPromptOptimizationV4PassthroughReason,
  type PromptOptimizationRuntimeReportRequiredField,
} from "./prompt-runtime-contract.js"

export const PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS = [
  "hookPath",
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
] as const satisfies readonly Exclude<PromptOptimizationRuntimeReportRequiredField, "modelId">[]

export type PromptOptimizationRuntimeSummaryMetadata = Pick<
  PromptOptimizationRuntimeReport,
  Exclude<(typeof PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS)[number], "noTrimReason">
> & {
  readonly noTrimReason?: PromptOptimizationRuntimeReport["noTrimReason"]
}

export interface PromptOptimizationRuntimePublicPayload {
  readonly report: PromptOptimizationRuntimeReport
  readonly summaryMetadata: PromptOptimizationRuntimeSummaryMetadata
}

const PROMPT_OPTIMIZATION_RUNTIME_PUBLIC_REDACTION_MASK = "***"
const PROMPT_OPTIMIZATION_RUNTIME_SECRET_RULE_PREFIXES = [
  "sk-",
  "ghp_",
  "github_pat_",
  "xoxb-",
  "xoxp-",
] as const
const PROMPT_OPTIMIZATION_RUNTIME_JWT_SHAPE =
  /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/
const PROMPT_OPTIMIZATION_RUNTIME_CREDENTIALED_URL_AUTHORITY = /:\/\/[^\s/@:]+:[^\s/@]+@/

function normalizePromptOptimizationRuntimePublicString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized === "" ? null : normalized
}

function isPromptOptimizationRuntimeSecretBearingValue(value: string): boolean {
  if (PROMPT_OPTIMIZATION_RUNTIME_SECRET_RULE_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return true
  }

  if (value.startsWith("Bearer ")) {
    return true
  }

  if (PROMPT_OPTIMIZATION_RUNTIME_JWT_SHAPE.test(value)) {
    return true
  }

  if (PROMPT_OPTIMIZATION_RUNTIME_CREDENTIALED_URL_AUTHORITY.test(value)) {
    return true
  }

  return value.includes("-----BEGIN") && value.includes("PRIVATE KEY-----")
}

export function getPromptOptimizationRuntimePublicModelId(modelId: string | null | undefined): string | null {
  const normalized = normalizePromptOptimizationRuntimePublicString(modelId)
  if (normalized === null) {
    return null
  }

  return isPromptOptimizationRuntimeSecretBearingValue(normalized)
    ? PROMPT_OPTIMIZATION_RUNTIME_PUBLIC_REDACTION_MASK
    : normalized
}

export function buildPromptOptimizationRuntimePublicPayload(
  report: PromptOptimizationRuntimeReport,
): PromptOptimizationRuntimePublicPayload {
  const sanitizedReport: PromptOptimizationRuntimeReport = {
    ...report,
    modelId: getPromptOptimizationRuntimePublicModelId(report.modelId),
  }
  const shouldExposeNoTrimReason = !isPromptOptimizationV4PassthroughReason(sanitizedReport.noTrimReason)

  return {
    report: sanitizedReport,
    summaryMetadata: {
      hookPath: sanitizedReport.hookPath,
      promptOptimizationMode: sanitizedReport.promptOptimizationMode,
      countState: sanitizedReport.countState,
      budgetBasis: sanitizedReport.budgetBasis,
      budgetLimit: sanitizedReport.budgetLimit,
      trimBasis: sanitizedReport.trimBasis,
      trimBudgetLimit: sanitizedReport.trimBudgetLimit,
      eligibleSections: sanitizedReport.eligibleSections,
      beforeBytes: sanitizedReport.beforeBytes,
      afterBytes: sanitizedReport.afterBytes,
      savedBytes: sanitizedReport.savedBytes,
      trimApplied: sanitizedReport.trimApplied,
      trimExhausted: sanitizedReport.trimExhausted,
      trimmedSections: sanitizedReport.trimmedSections,
      ...(shouldExposeNoTrimReason ? { noTrimReason: sanitizedReport.noTrimReason } : {}),
      exactTokenDelta: sanitizedReport.exactTokenDelta,
    },
  }
}
