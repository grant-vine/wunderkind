#!/usr/bin/env node

import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

if (typeof Bun === "undefined") {
  const rerun = spawnSync("bun", [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    encoding: "utf8",
  })
  if (rerun.stdout) process.stdout.write(rerun.stdout)
  if (rerun.stderr) process.stderr.write(rerun.stderr)
  process.exit(rerun.status ?? 1)
}

const fixturesModule = await import("../../../src/cli/prompt-runtime-fixtures.ts")
const publicPayloadModule = await import("../../../src/cli/prompt-optimization-runtime-public-payload.ts")
const runtimeReportingModule = await import("../../../src/cli/prompt-optimization-runtime-reporting.ts")
const runtimeSectionsModule = await import("../../../src/runtime-prompt-sections.ts")
const runtimeTranscriptModule = await import("../../../src/runtime-transcript-compression.ts")
const runtimeUserPromptModule = await import("../../../src/runtime-user-prompt-optimization.ts")

const { captureCanonicalRuntimeFixture, capturePromptOptimizationV4UserPromptFixture, collectPromptOptimizationEligibleSections } = fixturesModule
const { buildPromptOptimizationRuntimePublicPayload } = publicPayloadModule
const { buildPromptOptimizationRuntimeReport } = runtimeReportingModule
const { applyWunderkindSystemTransform, optimizePromptOptimizationRuntimeSections } = runtimeSectionsModule
const { compactTranscriptHistorySurface } = runtimeTranscriptModule
const { buildV4UserPromptOptimizationSurface } = runtimeUserPromptModule

const LEVEL_HELPER_PATH = new URL("./run-prompt-optimization-level-fixture.mjs", import.meta.url)
const ACCEPTED_LEVELS = ["latest-user", "runtime-and-tools", "contextual", "transcript"]
const PRESERVATION_SUITES = [
  "prompt-optimization-v4-fixture",
  "prompt-optimization-contextual-level",
  "prompt-optimization-transcript-level",
  "prompt-optimization-overlay-guard",
]

const CONTRACT = {
  contractMode: "prompt-optimization-efficacy-v1",
  acceptedLevels: ACCEPTED_LEVELS,
  preservationSuites: PRESERVATION_SUITES,
  requiredTopLevelKeys: ["contractMode", "repeatCount", "stable", "runFingerprints", "baseline"],
  requiredBaselineKeys: ["levels", "preservationSuites", "aggregate"],
  requiredAggregateKeys: [
    "levelsWithSavings",
    "exactTokenLevels",
    "totalSavedBytes",
    "allPublicEvidencePassed",
    "allPreservationSuitesPassed",
  ],
}

const SELECTED_CONTEXT_SENTINEL = "<!-- wunderkind:selected-context-start -->"
const SELECTED_CONTEXT_PRESERVE_START = "<!-- wunderkind:selected-context-preserve-start -->"
const SELECTED_CONTEXT_PRESERVE_END = "<!-- wunderkind:selected-context-preserve-end -->"

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function parseArgs(argv) {
  let contractOnly = false
  let repeatCount = 1
  let enforceRepeatable = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--contract") contractOnly = true
    if (arg === "--enforce-repeatable") enforceRepeatable = true
    if (arg === "--repeat") {
      const next = Number.parseInt(argv[index + 1] ?? "", 10)
      if (!Number.isInteger(next) || next < 1) throw new Error("Expected --repeat to be a positive integer")
      repeatCount = next
      index += 1
    }
  }
  return { contractOnly, repeatCount, enforceRepeatable }
}

function runLevel(level) {
  const helperRun = Bun.spawnSync(["bun", LEVEL_HELPER_PATH.pathname, "--level", level], { env: process.env })
  const stdout = new TextDecoder().decode(helperRun.stdout)
  const stderr = new TextDecoder().decode(helperRun.stderr)
  if (helperRun.exitCode !== 0) throw new Error(stderr || `Level helper failed for ${level}`)
  return JSON.parse(stdout.trim() || "{}")
}

function findSystemEntry(system, marker) {
  const entry = system.find((candidate) => candidate.includes(marker))
  if (!entry) throw new Error(`Missing system entry containing marker: ${marker}`)
  return entry
}

function createBaseConfig(overrides) {
  return {
    region: "Project Region",
    industry: "SaaS",
    primaryRegulation: "POPIA",
    teamCulture: "pragmatic-balanced",
    orgStructure: "flat",
    promptOptimizationByteBudget: 20_000,
    ...overrides,
  }
}

function createSelectedContextSection() {
  return [
    SELECTED_CONTEXT_SENTINEL,
    "## Wunderkind Selected Context",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
    SELECTED_CONTEXT_PRESERVE_START,
    "Path: src/runtime-transcript-compression.ts",
    "$ bun test tests/unit/prompt-optimization-transcript-level.test.ts",
    "See https://example.com/transcript-level for the transcript-level contract",
    SELECTED_CONTEXT_PRESERVE_END,
    "Repeated diagnosis note: preserve the causal chain before proposing changes.",
  ].join("\n")
}

function buildV4Suite() {
  const safeFixture = capturePromptOptimizationV4UserPromptFixture("safe-latest-user-message")
  const riskyFixture = capturePromptOptimizationV4UserPromptFixture("risky-immutable-user-message")
  const safeInput = cloneValue(safeFixture.input)
  const riskyInput = cloneValue(riskyFixture.input)
  const safeSurface = buildV4UserPromptOptimizationSurface(safeInput, safeFixture.wunderkindConfig)
  const riskySurface = buildV4UserPromptOptimizationSurface(riskyInput, riskyFixture.wunderkindConfig)
  const riskyPayload = buildPromptOptimizationRuntimePublicPayload(
    buildPromptOptimizationRuntimeReport({
      hookPath: "experimental.chat.system.transform",
      modelId: riskyInput.modelId,
      promptOptimizationMode: "active",
      content: "",
      trimResult: { sections: [], trimBasis: "configured-bytes", eligibleSections: [], beforeBytes: 0, afterBytes: 0, savedBytes: 0, trimApplied: false, trimExhausted: false, trimmedSections: [] },
      v4PassthroughReason: riskySurface.latestUserMessagePassthroughReason ?? undefined,
      v4UserPromptOptimizationMeasurement: riskySurface.latestUserMessageOptimizationMeasurement ?? undefined,
      promptOptimizationTokenBudget: 120000,
    }),
  )
  const passed =
    (safeSurface.latestUserMessageOptimizationMeasurement?.savedBytes ?? 0) > 0 &&
    JSON.stringify(safeInput.messages) === JSON.stringify(safeFixture.expectation.expectedMessagesAfterOptimization) &&
    riskySurface.latestUserMessagePassthroughReason === riskyFixture.expectation.expectedPassthroughReason &&
    !Object.prototype.hasOwnProperty.call(riskyPayload.summaryMetadata, "noTrimReason")
  return {
    suite: PRESERVATION_SUITES[0],
    passed,
    safeSavedBytes: safeSurface.latestUserMessageOptimizationMeasurement?.savedBytes ?? 0,
    riskyPassthroughReason: riskySurface.latestUserMessagePassthroughReason,
  }
}

function buildContextualSuite() {
  const originalSelectedContext = createSelectedContextSection()
  const system = [originalSelectedContext]
  applyWunderkindSystemTransform({
    system,
    wunderkindConfig: createBaseConfig({ promptOptimizationEnabled: true, promptOptimizationMode: "active", promptOptimizationLevel: "contextual" }),
  })
  const transformed = findSystemEntry(system, SELECTED_CONTEXT_SENTINEL)
  const passed =
    transformed !== originalSelectedContext &&
    transformed.includes(SELECTED_CONTEXT_PRESERVE_START) &&
    transformed.includes(SELECTED_CONTEXT_PRESERVE_END) &&
    transformed.includes("Path: src/runtime-transcript-compression.ts")
  return { suite: PRESERVATION_SUITES[1], passed, transformedBytes: Buffer.byteLength(transformed, "utf8") }
}

function buildTranscriptSuite() {
  const protectedEarlierMessage = [
    "Background task id: bg_transcript123 remains session-local.",
    'Quoted user example: "keep this quote exact".',
    "Path: src/runtime-user-prompt-optimization.ts",
  ].join("\n")
  const surface = buildV4UserPromptOptimizationSurface({
    messages: [
      { role: "user", content: "Repeated earlier diagnosis line.\nRepeated earlier diagnosis line." },
      { role: "assistant", content: "Assistant acknowledgement" },
      { role: "user", content: protectedEarlierMessage },
      { role: "assistant", content: "Second acknowledgement" },
      { role: "user", content: "Latest request must remain untouched." },
    ],
    retainedHistory: ["Earlier retained history summary.\nEarlier retained history summary."],
    transcriptWideCompaction: ["Assistant synthesis still pending.\nAssistant synthesis still pending."],
  })
  const compacted = compactTranscriptHistorySurface(surface)
  const passed =
    compacted.latestUserMessage === "Latest request must remain untouched." &&
    compacted.earlierUserMessages[1] === protectedEarlierMessage &&
    compacted.retainedHistory[0] === "Earlier retained history summary." &&
    compacted.transcriptWideCompaction[0] === "Assistant synthesis still pending."
  return { suite: PRESERVATION_SUITES[2], passed, retainedHistoryCount: compacted.retainedHistory.length }
}

function buildOverlaySuite() {
  const soulFixture = captureCanonicalRuntimeFixture("fixture-runtime-soul-overlay")
  const eligibleSectionIds = collectPromptOptimizationEligibleSections(soulFixture).map((section) => section.id)
  const activeTrimFixture = captureCanonicalRuntimeFixture("fixture-runtime-active-trim")
  const activeTrim = optimizePromptOptimizationRuntimeSections(collectPromptOptimizationEligibleSections(activeTrimFixture), 1)
  const passed = !eligibleSectionIds.includes("runtime-soul-overlay") && !activeTrim.trimmedSections.includes("runtime-context")
  return { suite: PRESERVATION_SUITES[3], passed, trimmedSections: activeTrim.trimmedSections }
}

function buildBaseline() {
  const levels = ACCEPTED_LEVELS.map((level) => runLevel(level))
  const preservationSuites = [buildV4Suite(), buildContextualSuite(), buildTranscriptSuite(), buildOverlaySuite()]
  return {
    levels,
    preservationSuites,
    aggregate: {
      levelsWithSavings: levels.filter((level) => level.savedBytes > 0).length,
      exactTokenLevels: levels.filter((level) => level.metricBasis === "exact-tokens").length,
      totalSavedBytes: levels.reduce((sum, level) => sum + level.savedBytes, 0),
      allPublicEvidencePassed: levels.every((level) => Object.values(level.publicEvidence).every(Boolean)),
      allPreservationSuitesPassed: preservationSuites.every((suite) => suite.passed),
    },
  }
}

function fingerprintBaseline(baseline) {
  return createHash("sha256").update(JSON.stringify(baseline)).digest("hex")
}

async function main() {
  const { contractOnly, repeatCount, enforceRepeatable } = parseArgs(process.argv.slice(2))
  if (contractOnly) {
    process.stdout.write(JSON.stringify(CONTRACT))
    return
  }
  const baselines = Array.from({ length: repeatCount }, () => buildBaseline())
  const runFingerprints = baselines.map((baseline) => fingerprintBaseline(baseline))
  const stable = new Set(runFingerprints).size === 1
  const result = { contractMode: CONTRACT.contractMode, repeatCount, stable, runFingerprints, baseline: baselines[0] }
  if (enforceRepeatable && !stable) throw new Error("Prompt optimization efficacy results were not repeatable")
  process.stdout.write(JSON.stringify(result))
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
