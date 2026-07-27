#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

if (typeof Bun === "undefined") {
  const rerun = spawnSync("bun", [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    encoding: "utf8",
  })
  if (rerun.stdout) {
    process.stdout.write(rerun.stdout)
  }
  if (rerun.stderr) {
    process.stderr.write(rerun.stderr)
  }
  process.exit(rerun.status ?? 1)
}

const runtimeFixturesModule = await import("../../../src/cli/prompt-runtime-fixtures.ts")

const runtimeSectionsModule = await import("../../../src/runtime-prompt-sections.ts")

const runtimeUserPromptModule = await import("../../../src/runtime-user-prompt-optimization.ts")

const runtimeReportingModule = await import("../../../src/cli/prompt-optimization-runtime-reporting.ts")

const runtimePublicPayloadModule = await import("../../../src/cli/prompt-optimization-runtime-public-payload.ts")

const {
  capturePromptOptimizationV4UserPromptFixture,
  parsePromptOptimizationV4UserPromptFixtureId,
} = runtimeFixturesModule

const { applyWunderkindSystemTransform, buildCompactionContextResult } = runtimeSectionsModule
const { buildV4UserPromptOptimizationSurface } = runtimeUserPromptModule
const {
  buildPromptOptimizationRuntimeReport,
  maybePersistPromptOptimizationRuntimeReport,
} = runtimeReportingModule
const { buildPromptOptimizationRuntimePublicPayload } = runtimePublicPayloadModule

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function parseArgs(argv) {
  let fixtureId = null
  let modelId = "gpt-4.1"

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--fixture") {
      fixtureId = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (arg === "--model") {
      modelId = argv[index + 1] ?? modelId
      index += 1
      continue
    }
  }

  const parsedFixtureId = parsePromptOptimizationV4UserPromptFixtureId(fixtureId)
  if (parsedFixtureId === null) {
    throw new Error("Expected --fixture safe-latest-user-message|risky-immutable-user-message")
  }

  return { fixtureId: parsedFixtureId, modelId }
}

function assertSummaryMetadataDoesNotWidenWithReason(summaryMetadata) {
  if (Object.prototype.hasOwnProperty.call(summaryMetadata, "passthroughReason")) {
    throw new Error("summary metadata must not expose passthroughReason")
  }
}

function assertFixtureContract(fixture, payload) {
  assertSummaryMetadataDoesNotWidenWithReason(payload.summaryMetadata)

  if (fixture.expectation.kind === "safe-optimization") {
    if (!(payload.savedBytes > 0)) {
      throw new Error(`safe fixture must report savedBytes > 0, got ${payload.savedBytes}`)
    }
    if (payload.trimApplied !== true) {
      throw new Error("safe fixture must report trimApplied=true")
    }
    if ((Reflect.get(payload.summaryMetadata, "noTrimReason") ?? null) !== null) {
      throw new Error("safe fixture summary metadata must not expose a non-null passthrough reason")
    }
    return
  }

  const noSavings = payload.savedBytes === 0 || payload.beforeBytes === payload.afterBytes
  if (!noSavings) {
    throw new Error("risky fixture must prove whole-message passthrough with no byte reduction")
  }
  if (payload.trimApplied !== false) {
    throw new Error("risky fixture must report trimApplied=false")
  }
  if (payload.noTrimReason == null || payload.noTrimReason === "") {
    throw new Error("risky fixture must expose an explicit non-null runtime-report reason")
  }
  if (Object.prototype.hasOwnProperty.call(payload.summaryMetadata, "noTrimReason")) {
    throw new Error("risky fixture summary metadata must not expose noTrimReason")
  }
}

async function main() {
  const { fixtureId, modelId } = parseArgs(process.argv.slice(2))
  const fixture = capturePromptOptimizationV4UserPromptFixture(fixtureId)
  const cwd = process.cwd()
  const input = cloneValue(fixture.input)
  input.modelId = modelId
  input.model = modelId

  const v4Surface = buildV4UserPromptOptimizationSurface(input, {
    promptOptimizationEnabled: fixture.wunderkindConfig.promptOptimizationEnabled,
    promptOptimizationMode: fixture.wunderkindConfig.promptOptimizationMode,
  })

  const systemOutput = { system: [] }
  const transformResult = applyWunderkindSystemTransform({
    system: systemOutput.system,
    wunderkindConfig: fixture.wunderkindConfig,
    cwd,
    v4UserPromptOptimizationSurface: v4Surface,
  })

  const systemReport = buildPromptOptimizationRuntimeReport({
    hookPath: "experimental.chat.system.transform",
    modelId,
    promptOptimizationMode: fixture.wunderkindConfig.promptOptimizationMode ?? "off",
    content: transformResult.eligibleSections.map((section) => section.content).join("\n"),
    eligibleSections: transformResult.eligibleSections,
    trimResult: transformResult.trimResult,
    v4PassthroughReason: v4Surface.latestUserMessagePassthroughReason ?? undefined,
    v4UserPromptOptimizationMeasurement: v4Surface.latestUserMessageOptimizationMeasurement ?? undefined,
    promptOptimizationTokenBudget: fixture.wunderkindConfig.promptOptimizationTokenBudget,
    promptOptimizationByteBudget: fixture.wunderkindConfig.promptOptimizationByteBudget,
  })

  const compactionResult = buildCompactionContextResult(fixture.wunderkindConfig, cwd)
  const sessionReport = buildPromptOptimizationRuntimeReport({
    hookPath: "experimental.session.compacting",
    modelId,
    promptOptimizationMode: fixture.wunderkindConfig.promptOptimizationMode ?? "off",
    content: compactionResult.eligibleSections.map((section) => section.content).join("\n"),
    eligibleSections: compactionResult.eligibleSections,
    trimResult: compactionResult.trimResult,
    promptOptimizationTokenBudget: fixture.wunderkindConfig.promptOptimizationTokenBudget,
    promptOptimizationByteBudget: fixture.wunderkindConfig.promptOptimizationByteBudget,
  })

  maybePersistPromptOptimizationRuntimeReport({
    cwd,
    reportingMode: fixture.wunderkindConfig.promptOptimizationReportingMode,
    report: systemReport,
  })
  maybePersistPromptOptimizationRuntimeReport({
    cwd,
    reportingMode: fixture.wunderkindConfig.promptOptimizationReportingMode,
    report: sessionReport,
  })

  const publicPayload = buildPromptOptimizationRuntimePublicPayload(systemReport)
  const output = {
    fixtureId,
    hookPath: publicPayload.report.hookPath,
    modelId: publicPayload.report.modelId,
    promptOptimizationMode: publicPayload.report.promptOptimizationMode,
    beforeBytes: publicPayload.report.beforeBytes,
    afterBytes: publicPayload.report.afterBytes,
    savedBytes: publicPayload.report.savedBytes,
    trimApplied: publicPayload.report.trimApplied,
    noTrimReason: publicPayload.report.noTrimReason,
    summaryMetadata: publicPayload.summaryMetadata,
  }

  assertFixtureContract(fixture, output)
  process.stdout.write(JSON.stringify(output))
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
