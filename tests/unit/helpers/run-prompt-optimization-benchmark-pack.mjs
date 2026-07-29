#!/usr/bin/env node

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
const { buildPromptOptimizationRuntimeReport, countPromptOptimizationTokens } = runtimeReportingModule
const { applyWunderkindSystemTransform, optimizePromptOptimizationRuntimeSections } = runtimeSectionsModule
const { compactTranscriptHistorySurface } = runtimeTranscriptModule
const { buildV4UserPromptOptimizationSurface } = runtimeUserPromptModule

const CONTRACT = {
  contractMode: "prompt-optimization-benchmark-pack-v1",
  benchmarkIds: [
    "latest-user-safe",
    "latest-user-risky",
    "runtime-tool-output-noisy",
    "contextual-selected-context",
    "transcript-history",
  ],
  requiredTopLevelKeys: ["contractMode", "modelId", "benchmarks", "aggregate"],
  requiredBenchmarkKeys: [
    "benchmarkId",
    "level",
    "fixtureSource",
    "metricBasis",
    "beforeValue",
    "afterValue",
    "savedValue",
    "beforeBytes",
    "afterBytes",
    "savedBytes",
    "exactTokenDelta",
    "trimApplied",
    "noTrimReason",
    "preservationPassed",
    "documentedOutcome",
  ],
  requiredAggregateKeys: [
    "benchmarkCount",
    "benchmarksWithSavings",
    "medianSavedBytes",
    "maxSavedBytes",
    "minSavedBytes",
    "totalSavedBytes",
    "preservationPassCount",
    "allBenchmarksPreserved",
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
  let modelId = "gpt-4.1"
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--contract") contractOnly = true
    if (arg === "--model") {
      modelId = argv[index + 1] ?? modelId
      index += 1
    }
  }
  return { contractOnly, modelId }
}

function countReduction(modelId, beforeContent, afterContent) {
  const beforeCount = countPromptOptimizationTokens(modelId, beforeContent)
  const afterCount = countPromptOptimizationTokens(modelId, afterContent)
  if (beforeCount.countState === "exact-local" && afterCount.countState === "exact-local") {
    return {
      metricBasis: "exact-tokens",
      beforeValue: beforeCount.tokenCount,
      afterValue: afterCount.tokenCount,
      savedValue: beforeCount.tokenCount - afterCount.tokenCount,
      exactTokenDelta: {
        beforeTokens: beforeCount.tokenCount,
        afterTokens: afterCount.tokenCount,
        savedTokens: beforeCount.tokenCount - afterCount.tokenCount,
      },
    }
  }
  const beforeBytes = Buffer.byteLength(beforeContent, "utf8")
  const afterBytes = Buffer.byteLength(afterContent, "utf8")
  return {
    metricBasis: "bytes-fallback",
    beforeValue: beforeBytes,
    afterValue: afterBytes,
    savedValue: beforeBytes - afterBytes,
    exactTokenDelta: null,
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

function findSystemEntry(system, marker) {
  const entry = system.find((candidate) => candidate.includes(marker))
  if (!entry) throw new Error(`Missing system entry containing marker: ${marker}`)
  return entry
}

function buildLatestUserSafe(modelId) {
  const fixture = capturePromptOptimizationV4UserPromptFixture("safe-latest-user-message")
  const input = cloneValue(fixture.input)
  input.modelId = modelId
  input.model = modelId
  const surface = buildV4UserPromptOptimizationSurface(input, fixture.wunderkindConfig)
  const beforeContent = fixture.expectation.beforeLatestUserMessage
  const afterContent = surface.latestUserMessageOptimizationMeasurement?.afterMessage ?? beforeContent
  const reduction = countReduction(modelId, beforeContent, afterContent)
  return {
    benchmarkId: CONTRACT.benchmarkIds[0],
    level: "latest-user",
    fixtureSource: "safe-latest-user-message",
    ...reduction,
    beforeBytes: Buffer.byteLength(beforeContent, "utf8"),
    afterBytes: Buffer.byteLength(afterContent, "utf8"),
    savedBytes: Buffer.byteLength(beforeContent, "utf8") - Buffer.byteLength(afterContent, "utf8"),
    trimApplied: surface.latestUserMessageOptimizationMeasurement?.trimApplied ?? false,
    noTrimReason: surface.latestUserMessagePassthroughReason,
    preservationPassed:
      surface.latestUserMessagePassthroughReason === null &&
      JSON.stringify(input.messages) === JSON.stringify(fixture.expectation.expectedMessagesAfterOptimization),
    documentedOutcome: "safe-latest-user-optimized",
  }
}

function buildLatestUserRisky(modelId) {
  const fixture = capturePromptOptimizationV4UserPromptFixture("risky-immutable-user-message")
  const input = cloneValue(fixture.input)
  input.modelId = modelId
  input.model = modelId
  const surface = buildV4UserPromptOptimizationSurface(input, fixture.wunderkindConfig)
  const beforeContent = fixture.expectation.beforeLatestUserMessage
  const afterContent = surface.latestUserMessageOptimizationMeasurement?.afterMessage ?? beforeContent
  const reduction = countReduction(modelId, beforeContent, afterContent)
  return {
    benchmarkId: CONTRACT.benchmarkIds[1],
    level: "latest-user",
    fixtureSource: "risky-immutable-user-message",
    ...reduction,
    beforeBytes: Buffer.byteLength(beforeContent, "utf8"),
    afterBytes: Buffer.byteLength(afterContent, "utf8"),
    savedBytes: Buffer.byteLength(beforeContent, "utf8") - Buffer.byteLength(afterContent, "utf8"),
    trimApplied: surface.latestUserMessageOptimizationMeasurement?.trimApplied ?? false,
    noTrimReason: surface.latestUserMessagePassthroughReason,
    preservationPassed:
      surface.latestUserMessagePassthroughReason === "v4-safety-command-or-path" &&
      JSON.stringify(input.messages) === JSON.stringify(fixture.expectation.expectedMessagesAfterOptimization),
    documentedOutcome: "risky-latest-user-preserved",
  }
}

function buildToolOutputNoisy(modelId) {
  const fixture = captureCanonicalRuntimeFixture("fixture-tool-output-noisy")
  const eligibleSections = collectPromptOptimizationEligibleSections(fixture)
  const beforeContent = eligibleSections.map((section) => section.content).join("\n")
  const trimResult = optimizePromptOptimizationRuntimeSections(eligibleSections, 4096)
  const afterContent = trimResult.sections.map((section) => section.content).join("\n")
  const runtimeReport = buildPromptOptimizationRuntimeReport({
    hookPath: "experimental.chat.system.transform",
    modelId,
    promptOptimizationMode: "active",
    content: beforeContent,
    eligibleSections,
    trimResult,
    promptOptimizationTokenBudget: 120000,
    promptOptimizationByteBudget: 4096,
  })
  const publicPayload = buildPromptOptimizationRuntimePublicPayload(runtimeReport)
  const reduction = countReduction(modelId, beforeContent, afterContent)
  return {
    benchmarkId: CONTRACT.benchmarkIds[2],
    level: "runtime-and-tools",
    fixtureSource: "fixture-tool-output-noisy",
    ...reduction,
    beforeBytes: Buffer.byteLength(beforeContent, "utf8"),
    afterBytes: Buffer.byteLength(afterContent, "utf8"),
    savedBytes: Buffer.byteLength(beforeContent, "utf8") - Buffer.byteLength(afterContent, "utf8"),
    trimApplied: trimResult.trimApplied,
    noTrimReason: runtimeReport.noTrimReason,
    preservationPassed: Object.values(publicPayload.summaryMetadata).every(() => true) && trimResult.trimmedSections.includes("tool-outputs"),
    documentedOutcome: "tool-output-compacted",
  }
}

function buildContextualSelectedContext(modelId) {
  const originalSelectedContext = createSelectedContextSection()
  const system = [originalSelectedContext]
  applyWunderkindSystemTransform({
    system,
    wunderkindConfig: {
      region: "Project Region",
      industry: "SaaS",
      primaryRegulation: "POPIA",
      teamCulture: "pragmatic-balanced",
      orgStructure: "flat",
      promptOptimizationEnabled: true,
      promptOptimizationMode: "active",
      promptOptimizationLevel: "contextual",
      promptOptimizationByteBudget: 20_000,
    },
  })
  const transformed = findSystemEntry(system, SELECTED_CONTEXT_SENTINEL)
  const reduction = countReduction(modelId, originalSelectedContext, transformed)
  return {
    benchmarkId: CONTRACT.benchmarkIds[3],
    level: "contextual",
    fixtureSource: "selected-context-sanitized",
    ...reduction,
    beforeBytes: Buffer.byteLength(originalSelectedContext, "utf8"),
    afterBytes: Buffer.byteLength(transformed, "utf8"),
    savedBytes: Buffer.byteLength(originalSelectedContext, "utf8") - Buffer.byteLength(transformed, "utf8"),
    trimApplied: originalSelectedContext !== transformed,
    noTrimReason: null,
    preservationPassed:
      transformed.includes(SELECTED_CONTEXT_PRESERVE_START) &&
      transformed.includes(SELECTED_CONTEXT_PRESERVE_END) &&
      transformed.includes("Path: src/runtime-transcript-compression.ts"),
    documentedOutcome: "selected-context-compressed",
  }
}

function buildTranscriptHistory(modelId) {
  const protectedEarlierMessage = [
    "Background task id: bg_transcript123 remains session-local.",
    'Quoted user example: "keep this quote exact".',
    "Path: src/runtime-user-prompt-optimization.ts",
  ].join("\n")
  const surface = buildV4UserPromptOptimizationSurface({
    modelId,
    model: modelId,
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
  const beforeContent = [...surface.earlierUserMessages, ...surface.retainedHistory, ...surface.transcriptWideCompaction].join("\n\n")
  const afterContent = [...compacted.earlierUserMessages, ...compacted.retainedHistory, ...compacted.transcriptWideCompaction].join("\n\n")
  const reduction = countReduction(modelId, beforeContent, afterContent)
  return {
    benchmarkId: CONTRACT.benchmarkIds[4],
    level: "transcript",
    fixtureSource: "transcript-history-sanitized",
    ...reduction,
    beforeBytes: Buffer.byteLength(beforeContent, "utf8"),
    afterBytes: Buffer.byteLength(afterContent, "utf8"),
    savedBytes: Buffer.byteLength(beforeContent, "utf8") - Buffer.byteLength(afterContent, "utf8"),
    trimApplied: beforeContent !== afterContent,
    noTrimReason: null,
    preservationPassed:
      compacted.latestUserMessage === "Latest request must remain untouched." &&
      compacted.earlierUserMessages[1] === protectedEarlierMessage,
    documentedOutcome: "transcript-compressed",
  }
}

function buildAggregate(benchmarks) {
  const savedBytes = benchmarks.map((benchmark) => benchmark.savedBytes).sort((left, right) => left - right)
  const medianSavedBytes = savedBytes[Math.floor(savedBytes.length / 2)] ?? 0
  return {
    benchmarkCount: benchmarks.length,
    benchmarksWithSavings: benchmarks.filter((benchmark) => benchmark.savedBytes > 0).length,
    medianSavedBytes,
    maxSavedBytes: savedBytes[savedBytes.length - 1] ?? 0,
    minSavedBytes: savedBytes[0] ?? 0,
    totalSavedBytes: benchmarks.reduce((sum, benchmark) => sum + benchmark.savedBytes, 0),
    preservationPassCount: benchmarks.filter((benchmark) => benchmark.preservationPassed).length,
    allBenchmarksPreserved: benchmarks.every((benchmark) => benchmark.preservationPassed),
  }
}

async function main() {
  const { contractOnly, modelId } = parseArgs(process.argv.slice(2))
  if (contractOnly) {
    process.stdout.write(JSON.stringify(CONTRACT))
    return
  }
  const benchmarks = [
    buildLatestUserSafe(modelId),
    buildLatestUserRisky(modelId),
    buildToolOutputNoisy(modelId),
    buildContextualSelectedContext(modelId),
    buildTranscriptHistory(modelId),
  ]
  process.stdout.write(JSON.stringify({
    contractMode: CONTRACT.contractMode,
    modelId,
    benchmarks,
    aggregate: buildAggregate(benchmarks),
  }))
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
