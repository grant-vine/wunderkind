#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
const runtimeReportingModule = await import("../../../src/cli/prompt-optimization-runtime-reporting.ts")
const runtimePublicPayloadModule = await import("../../../src/cli/prompt-optimization-runtime-public-payload.ts")
const runtimeSectionsModule = await import("../../../src/runtime-prompt-sections.ts")
const runtimeUserPromptModule = await import("../../../src/runtime-user-prompt-optimization.ts")
const runtimeTranscriptModule = await import("../../../src/runtime-transcript-compression.ts")

const {
  captureCanonicalRuntimeFixture,
  capturePromptOptimizationV4UserPromptFixture,
  getRuntimeSectionGroup,
} = runtimeFixturesModule
const {
  buildPromptOptimizationRuntimeReport,
  measurePromptOptimizationReduction,
} = runtimeReportingModule
const {
  buildPromptOptimizationRuntimePublicPayload,
  isPromptOptimizationRuntimePublicPayloadScalarSafe,
} = runtimePublicPayloadModule
const {
  applyWunderkindSystemTransform,
  buildCompactionContextResult,
  optimizePromptOptimizationRuntimeSections,
} = runtimeSectionsModule
const { buildV4UserPromptOptimizationSurface } = runtimeUserPromptModule
const { compactTranscriptHistorySurface } = runtimeTranscriptModule

export const PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS = [
  "latest-user",
  "runtime-and-tools",
  "contextual",
  "transcript",
]

export const PROMPT_OPTIMIZATION_LEVEL_FIXTURE_CONTRACT = {
  contractMode: "prompt-optimization-level-fixture-v1",
  acceptedLevels: PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS,
  defaultModelId: "gpt-4.1",
  metricPriority: ["exact-tokens", "bytes-fallback"],
  observabilityPriority: [
    "protected-reason-report-only",
    "summary-measurement-alignment",
    "scalar-only-public-payload",
  ],
  requiredKeys: [
    "contractMode",
    "level",
    "modelId",
    "metricBasis",
    "beforeValue",
    "afterValue",
    "savedValue",
    "beforeBytes",
    "afterBytes",
    "savedBytes",
    "trimApplied",
    "noTrimReason",
    "exactTokenDelta",
    "observabilityScore",
    "publicEvidence",
  ],
}

const SELECTED_CONTEXT_SENTINEL = "<!-- wunderkind:selected-context-start -->"

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function parseArgs(argv) {
  let contractOnly = false
  let level = null
  let modelId = PROMPT_OPTIMIZATION_LEVEL_FIXTURE_CONTRACT.defaultModelId

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--contract") {
      contractOnly = true
      continue
    }
    if (arg === "--level") {
      level = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === "--model") {
      modelId = argv[index + 1] ?? modelId
      index += 1
    }
  }

  if (contractOnly) {
    return { contractOnly, level: null, modelId }
  }

  if (!PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS.includes(level)) {
    throw new Error("Expected --level latest-user|runtime-and-tools|contextual|transcript")
  }

  return { contractOnly, level, modelId }
}

function createSelectedContextSection() {
  return [
    SELECTED_CONTEXT_SENTINEL,
    "## Wunderkind Selected Context",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    "Path: src/runtime-prompt-sections.ts",
    "$ bun test tests/unit/prompt-optimization-level-fixture.test.ts",
    "See https://example.com/context-spec for the selected-context contract",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
  ].join("\n")
}

function createBaseConfig(level) {
  return {
    region: "Project Region",
    industry: "SaaS",
    primaryRegulation: "POPIA",
    teamCulture: "pragmatic-balanced",
    orgStructure: "flat",
    docsEnabled: true,
    docsPath: "./docs/output",
    docHistoryMode: "append-dated",
    promptOptimizationEnabled: true,
    promptOptimizationMode: "active",
    promptOptimizationLevel: level,
    promptOptimizationTokenBudget: 120000,
  }
}

function createEmptyTrimResult() {
  return {
    sections: [],
    trimBasis: "configured-bytes",
    eligibleSections: [],
    beforeBytes: 0,
    afterBytes: 0,
    savedBytes: 0,
    trimApplied: false,
    trimExhausted: false,
    trimmedSections: [],
  }
}

function joinSegments(segments) {
  return segments.filter((segment) => segment !== "").join("\n\n")
}

function joinSectionContent(sections) {
  return joinSegments(sections.map((section) => section.content))
}

function buildRuntimeEligibleSections(projectDir) {
  const system = [createSelectedContextSection()]
  const seedConfig = { ...createBaseConfig("transcript"), promptOptimizationEnabled: false, promptOptimizationMode: "off" }
  const toolOutputContent = captureCanonicalRuntimeFixture("fixture-tool-output-noisy").toolOutputContent
  const sections = []

  applyWunderkindSystemTransform({ system, wunderkindConfig: seedConfig, cwd: projectDir })
  if (toolOutputContent) {
    sections.push({ id: "tool-outputs", content: toolOutputContent })
  }
  for (const section of system) {
    if (section.includes(SELECTED_CONTEXT_SENTINEL)) {
      sections.push({ id: "selected-context", content: section })
      continue
    }
    const group = getRuntimeSectionGroup(section)
    if (group) {
      sections.push({ id: group, content: section })
    }
  }
  const compactionResult = buildCompactionContextResult(seedConfig, projectDir)
  sections.push({ id: "compaction-continuity", content: compactionResult.context.join("\n") })

  return sections
}

function createSafeTranscriptInput(modelId) {
  const safeFixture = capturePromptOptimizationV4UserPromptFixture("safe-latest-user-message")
  return {
    modelId,
    model: modelId,
    messages: [
      { role: "user", content: "Repeated earlier diagnosis line.\nRepeated earlier diagnosis line.\n" },
      { role: "assistant", content: "Assistant acknowledgement" },
      {
        role: "user",
        content: [
          "Background task id: bg_transcript123 remains session-local.\n",
          'Quoted user example: "keep this quote exact".\n',
          "Path: src/runtime-user-prompt-optimization.ts\n",
        ].join(""),
      },
      { role: "assistant", content: "Second acknowledgement" },
      { role: "user", content: safeFixture.expectation.beforeLatestUserMessage },
    ],
    retainedHistory: [
      "Earlier retained history summary.\nEarlier retained history summary.\n",
      "Earlier retained history summary.\nEarlier retained history summary.\n",
    ],
    transcriptWideCompaction: [
      "Assistant synthesis still pending.\nAssistant synthesis still pending.\n",
      "Assistant synthesis still pending.\nAssistant synthesis still pending.\n",
    ],
  }
}

function getRuntimeTrimResult(level, beforeRuntimeSections) {
  if (level === "latest-user") {
    return createEmptyTrimResult()
  }

  return optimizePromptOptimizationRuntimeSections(beforeRuntimeSections, undefined, {
    contextualCompressionEnabled: level === "contextual" || level === "transcript",
  })
}

function buildMeasurementProjection(payload) {
  const summary = payload.summaryMetadata
  const report = payload.report
  const exactTokenDelta = report.exactTokenDelta
  const noTrimReasonProjection = Object.prototype.hasOwnProperty.call(summary, "noTrimReason")
    ? { noTrimReason: report.noTrimReason }
    : {}

  return {
    hookPath: report.hookPath,
    promptOptimizationMode: report.promptOptimizationMode,
    countState: report.countState,
    budgetBasis: report.budgetBasis,
    budgetLimit: report.budgetLimit,
    trimBasis: report.trimBasis,
    trimBudgetLimit: report.trimBudgetLimit,
    eligibleSections: report.eligibleSections,
    beforeBytes: report.beforeBytes,
    afterBytes: report.afterBytes,
    savedBytes: report.savedBytes,
    trimApplied: report.trimApplied,
    trimExhausted: report.trimExhausted,
    trimmedSections: report.trimmedSections,
    ...noTrimReasonProjection,
    exactTokenDelta,
  }
}

function buildRiskyPublicPayload(modelId) {
  const riskyFixture = capturePromptOptimizationV4UserPromptFixture("risky-immutable-user-message")
  const riskyInput = cloneValue(riskyFixture.input)
  riskyInput.modelId = modelId
  riskyInput.model = modelId
  const riskySurface = buildV4UserPromptOptimizationSurface(riskyInput, {
    promptOptimizationEnabled: true,
    promptOptimizationMode: "active",
  })

  return buildPromptOptimizationRuntimePublicPayload(
    buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId,
      promptOptimizationMode: "active",
      content: "",
      trimResult: createEmptyTrimResult(),
      v4PassthroughReason: riskySurface.latestUserMessagePassthroughReason ?? undefined,
      v4UserPromptOptimizationMeasurement: riskySurface.latestUserMessageOptimizationMeasurement ?? undefined,
      promptOptimizationTokenBudget: 120000,
    }),
  )
}

async function main() {
  const { contractOnly, level, modelId } = parseArgs(process.argv.slice(2))
  if (contractOnly) {
    process.stdout.write(JSON.stringify(PROMPT_OPTIMIZATION_LEVEL_FIXTURE_CONTRACT))
    return
  }

  const tempDir = mkdtempSync(join(tmpdir(), `wk-level-fixture-${level}-`))

  try {
    const beforeRuntimeSections = buildRuntimeEligibleSections(tempDir)
    const runtimeTrimResult = getRuntimeTrimResult(level, beforeRuntimeSections)
    const afterRuntimeSections = level === "latest-user" ? beforeRuntimeSections : runtimeTrimResult.sections
    const v4Input = createSafeTranscriptInput(modelId)
    const optimizedInput = cloneValue(v4Input)
    const optimizedSurface = buildV4UserPromptOptimizationSurface(optimizedInput, {
      promptOptimizationEnabled: true,
      promptOptimizationMode: "active",
    })
    const transcriptSurface = level === "transcript"
      ? compactTranscriptHistorySurface(optimizedSurface)
      : optimizedSurface
    const latestUserMeasurement = optimizedSurface.latestUserMessageOptimizationMeasurement
    const latestUserBefore = latestUserMeasurement?.beforeMessage ?? optimizedSurface.latestUserMessage ?? ""
    const latestUserAfter = latestUserMeasurement?.afterMessage ?? optimizedSurface.latestUserMessage ?? ""
    const beforeContent = joinSegments([
      joinSectionContent(beforeRuntimeSections),
      latestUserBefore,
      ...optimizedSurface.earlierUserMessages,
      ...optimizedSurface.retainedHistory,
      ...optimizedSurface.transcriptWideCompaction,
    ])
    const afterContent = joinSegments([
      joinSectionContent(afterRuntimeSections),
      latestUserAfter,
      ...transcriptSurface.earlierUserMessages,
      ...transcriptSurface.retainedHistory,
      ...transcriptSurface.transcriptWideCompaction,
    ])
    const reduction = measurePromptOptimizationReduction({ modelId, beforeContent, afterContent })
    const systemReport = buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId,
      promptOptimizationMode: "active",
      content: level === "latest-user" ? "" : joinSectionContent(beforeRuntimeSections),
      eligibleSections: level === "latest-user" ? [] : beforeRuntimeSections,
      trimResult: runtimeTrimResult,
      v4PassthroughReason: optimizedSurface.latestUserMessagePassthroughReason ?? undefined,
      v4UserPromptOptimizationMeasurement: latestUserMeasurement ?? undefined,
      promptOptimizationTokenBudget: 120000,
    })
    const mainPublicPayload = buildPromptOptimizationRuntimePublicPayload(systemReport)
    const riskyPublicPayload = buildRiskyPublicPayload(modelId)
    const publicEvidence = {
      scalarOnly:
        isPromptOptimizationRuntimePublicPayloadScalarSafe(mainPublicPayload)
        && isPromptOptimizationRuntimePublicPayloadScalarSafe(riskyPublicPayload),
      summaryMatchesReport:
        JSON.stringify(mainPublicPayload.summaryMetadata) === JSON.stringify(buildMeasurementProjection(mainPublicPayload)),
      protectedReasonRetainedOnReport: riskyPublicPayload.report.noTrimReason === "v4-safety-command-or-path",
      protectedReasonOmittedFromSummary: !Object.prototype.hasOwnProperty.call(
        riskyPublicPayload.summaryMetadata,
        "noTrimReason",
      ),
    }
    const observabilityScore = Object.values(publicEvidence).filter(Boolean).length

    process.stdout.write(
      JSON.stringify({
        contractMode: PROMPT_OPTIMIZATION_LEVEL_FIXTURE_CONTRACT.contractMode,
        level,
        modelId,
        metricBasis: reduction.metricBasis,
        beforeValue: reduction.beforeValue,
        afterValue: reduction.afterValue,
        savedValue: reduction.savedValue,
        beforeBytes: Buffer.byteLength(beforeContent, "utf8"),
        afterBytes: Buffer.byteLength(afterContent, "utf8"),
        savedBytes: Buffer.byteLength(beforeContent, "utf8") - Buffer.byteLength(afterContent, "utf8"),
        trimApplied: reduction.savedValue > 0,
        noTrimReason: reduction.savedValue > 0 ? null : systemReport.noTrimReason,
        exactTokenDelta: reduction.exactTokenDelta,
        observabilityScore,
        publicEvidence,
      }),
    )
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
