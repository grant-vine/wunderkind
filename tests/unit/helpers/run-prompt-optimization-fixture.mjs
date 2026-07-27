#!/usr/bin/env node

const runtimeFixturesModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/cli/prompt-runtime-fixtures.js")
    : await import("../../../src/cli/prompt-runtime-fixtures.ts")

const runtimeReportingModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/cli/prompt-optimization-runtime-reporting.js")
    : await import("../../../src/cli/prompt-optimization-runtime-reporting.ts")

const runtimePublicPayloadModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/cli/prompt-optimization-runtime-public-payload.js")
    : await import("../../../src/cli/prompt-optimization-runtime-public-payload.ts")

const runtimeSectionsModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/runtime-prompt-sections.js")
    : await import("../../../src/runtime-prompt-sections.ts")

const {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
  parsePromptOptimizationHelperFixtureId,
} = runtimeFixturesModule

const {
  buildPromptOptimizationAdvisoryResult,
  buildPromptOptimizationRuntimeReport,
  countPromptOptimizationTokens,
} = runtimeReportingModule
const { buildPromptOptimizationRuntimePublicPayload } = runtimePublicPayloadModule
const { getPromptOptimizationRuntimeSectionByteLength, trimPromptOptimizationRuntimeSections } = runtimeSectionsModule

const ALLOWED_ENGINES = new Set(["off", "advisory", "active"])
const ALLOWED_OUTPUTS = new Set(["advisory", "runtime-report", "runtime-public-payload"])
const ALLOWED_HOOK_PATHS = new Set([
  "experimental.chat.system.transform",
  "experimental.session.compacting",
])

function parsePromptOptimizationMode(value) {
  if (value == null || value === "") {
    return "off"
  }

  if (!ALLOWED_ENGINES.has(value)) {
    throw new Error(`Unsupported WUNDERKIND_TEST_ENGINE: ${value}`)
  }

  return value
}

function parseOutputMode(value) {
  if (value == null || value === "") {
    return "advisory"
  }

  if (!ALLOWED_OUTPUTS.has(value)) {
    throw new Error(`Unsupported WUNDERKIND_TEST_OUTPUT: ${value}`)
  }

  return value
}

function parseHookPath(value) {
  if (value == null || value === "") {
    return "experimental.chat.system.transform"
  }

  if (!ALLOWED_HOOK_PATHS.has(value)) {
    throw new Error(`Unsupported WUNDERKIND_TEST_HOOK_PATH: ${value}`)
  }

  return value
}

function parsePositiveInteger(value, envName) {
  if (value == null || value === "") {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${envName} must be a positive integer`)
  }

  return parsed
}

function normalizeModelId(value) {
  if (value == null || value.trim() === "") {
    return null
  }

  return value.trim()
}

function joinSectionContent(sections) {
  return sections.map((section) => section.content).join("\n")
}

function buildUntrimmedRuntimeResult(eligibleSections) {
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

function buildRuntimeTrimResult(promptOptimizationMode, promptOptimizationByteBudget, eligibleSections) {
  if (promptOptimizationMode === "active" && typeof promptOptimizationByteBudget === "number") {
    return trimPromptOptimizationRuntimeSections(eligibleSections, promptOptimizationByteBudget)
  }

  return buildUntrimmedRuntimeResult(eligibleSections)
}

function buildExactTokenDelta(modelId, beforeContent, afterContent) {
  const beforeCount = countPromptOptimizationTokens(modelId, beforeContent)
  const afterCount = countPromptOptimizationTokens(modelId, afterContent)

  if (beforeCount.countState !== "exact-local" || afterCount.countState !== "exact-local") {
    return null
  }

  return {
    beforeTokens: beforeCount.tokenCount,
    afterTokens: afterCount.tokenCount,
    savedTokens: beforeCount.tokenCount - afterCount.tokenCount,
  }
}

async function main() {
  const modelId = normalizeModelId(process.env.WUNDERKIND_TEST_MODEL)
  const promptOptimizationMode = parsePromptOptimizationMode(process.env.WUNDERKIND_TEST_ENGINE)
  const outputMode = parseOutputMode(process.env.WUNDERKIND_TEST_OUTPUT)
  const hookPath = parseHookPath(process.env.WUNDERKIND_TEST_HOOK_PATH)
  const promptOptimizationTokenBudget = parsePositiveInteger(
    process.env.WUNDERKIND_TEST_TOKEN_BUDGET,
    "WUNDERKIND_TEST_TOKEN_BUDGET",
  )
  const promptOptimizationByteBudget = parsePositiveInteger(
    process.env.WUNDERKIND_TEST_BYTE_BUDGET,
    "WUNDERKIND_TEST_BYTE_BUDGET",
  )
  const fixtureId =
    parsePromptOptimizationHelperFixtureId(process.env.WUNDERKIND_TEST_FIXTURE) ?? "fixture-default-no-config"

  const fixture = captureCanonicalRuntimeFixture(fixtureId)
  const eligibleSections = collectPromptOptimizationEligibleSections(fixture)
  const promptContent = joinSectionContent(eligibleSections)

  if (outputMode === "runtime-report" || outputMode === "runtime-public-payload") {
    const trimResult = buildRuntimeTrimResult(
      promptOptimizationMode,
      promptOptimizationByteBudget,
      eligibleSections,
    )
    const afterContent = joinSectionContent(trimResult.sections)
    const runtimeReport = buildPromptOptimizationRuntimeReport({
      hookPath,
      modelId,
      promptOptimizationMode,
      content: promptContent,
      eligibleSections,
      trimResult,
      promptOptimizationTokenBudget,
      promptOptimizationByteBudget,
    })

    if (outputMode === "runtime-public-payload") {
      process.stdout.write(JSON.stringify(buildPromptOptimizationRuntimePublicPayload(runtimeReport)))
      return
    }

    process.stdout.write(
      JSON.stringify({
        ...runtimeReport,
        exactTokenDelta: buildExactTokenDelta(modelId, promptContent, afterContent),
      }),
    )
    return
  }

  const advisoryResult = buildPromptOptimizationAdvisoryResult({
    modelId,
    promptOptimizationMode,
    content: promptContent,
    eligibleSections,
    promptOptimizationTokenBudget,
    promptOptimizationByteBudget,
  })

  const {
    countState,
    budgetBasis,
    trimBasis,
    eligibleSections: eligibleSectionIds,
    beforeBytes,
    afterBytes,
    savedBytes,
    trimApplied,
    trimExhausted,
    trimmedSections,
  } = advisoryResult

  process.stdout.write(
    JSON.stringify({
      modelId,
      promptOptimizationMode,
      countState,
      budgetBasis,
      trimBasis,
      eligibleSections: eligibleSectionIds,
      beforeBytes,
      afterBytes,
      savedBytes,
      trimApplied,
      trimExhausted,
      trimmedSections,
    }),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
