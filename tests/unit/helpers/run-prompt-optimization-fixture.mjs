#!/usr/bin/env node

const runtimeFixturesModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/cli/prompt-runtime-fixtures.js")
    : await import("../../../src/cli/prompt-runtime-fixtures.ts")

const tokenAuditModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/cli/token-audit.js")
    : await import("../../../src/cli/token-audit.ts")

const {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
  parsePromptOptimizationHelperFixtureId,
} = runtimeFixturesModule

const { buildPromptOptimizationAdvisoryResult } = tokenAuditModule

const ALLOWED_ENGINES = new Set(["off", "advisory", "active"])

function parsePromptOptimizationMode(value) {
  if (value == null || value === "") {
    return "off"
  }

  if (!ALLOWED_ENGINES.has(value)) {
    throw new Error(`Unsupported WUNDERKIND_TEST_ENGINE: ${value}`)
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

async function main() {
  const modelId = normalizeModelId(process.env.WUNDERKIND_TEST_MODEL)
  const promptOptimizationMode = parsePromptOptimizationMode(process.env.WUNDERKIND_TEST_ENGINE)
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
  const promptContent = eligibleSections
    .map((section) => section.content)
    .join("\n")

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
