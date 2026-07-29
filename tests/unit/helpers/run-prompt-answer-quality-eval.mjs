#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

if (typeof Bun === "undefined") {
  const rerun = spawnSync("bun", [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    encoding: "utf8",
  })
  if (rerun.stdout) process.stdout.write(rerun.stdout)
  if (rerun.stderr) process.stderr.write(rerun.stderr)
  process.exit(rerun.status ?? 1)
}

const contractModule = await import("../../../src/cli/prompt-answer-quality-contract.ts")
const evaluatorModule = await import("../../../src/cli/prompt-answer-quality-evaluator.ts")
const fixturesModule = await import("../../../src/cli/prompt-answer-quality-fixtures.ts")

const {
  PROMPT_ANSWER_QUALITY_CONTRACT,
  PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS,
  PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID,
  PROMPT_ANSWER_QUALITY_PROVIDER_ERROR_CODES,
} = contractModule
const { evaluatePromptAnswerQualityCasePack } = evaluatorModule
const { PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK } = fixturesModule

const CONTRACT = {
  contractMode: "prompt-answer-quality-helper-v1",
  evaluationContractMode: PROMPT_ANSWER_QUALITY_CONTRACT.contractMode,
  providerProtocolMode: PROMPT_ANSWER_QUALITY_CONTRACT.providerProtocolMode,
  defaultCasePackId: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK_ID,
  defaultCaseIds: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_IDS,
  providerModes: ["stub", "command"],
  requiredTopLevelKeys: ["contractMode", "repeatCount", "stable", "runFingerprints", "baseline"],
  requiredBaselineKeys: PROMPT_ANSWER_QUALITY_CONTRACT.requiredTopLevelKeys,
  requiredPerCaseKeys: PROMPT_ANSWER_QUALITY_CONTRACT.requiredPerCaseKeys,
  requiredAggregateKeys: PROMPT_ANSWER_QUALITY_CONTRACT.requiredAggregateKeys,
}

const STUB_PROVIDER_RESPONSES = {
  "answer-quality-latest-user-preserves-constraints": "The latest-user seam likely changed operator intent near `src/runtime-user-prompt-optimization.ts`, so preserve \"leave this exact text alone\" and the exact rerun command inside `src/cli/`.\n\n- Re-run `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts` beside `src/runtime-user-prompt-optimization.ts`.\n- Inspect the `src/cli/` caller and preserve the byte-exact latest-user constraint.",
  "answer-quality-runtime-tools-uses-noisy-output": "Summary: the repeated warnings point to runtime-owned retry noise rather than a new product bug.\nLikely cause: the retry loop is waiting on cache state; keep `Path: src/cli/prompt-optimization-runtime-reporting.ts` and `See https://example.com/tool-output/log for stable reference` exact.\nRerun: $ bun test tests/unit/prompt-optimization-efficacy.test.ts",
  "answer-quality-contextual-synthesizes-selected-context": "- Preserved invariants: keep `<!-- wunderkind:selected-context-preserve-start -->`, `<!-- wunderkind:selected-context-preserve-end -->`, `Path: src/runtime-transcript-compression.ts`, `$ bun test tests/unit/prompt-optimization-level-fixture.test.ts`, and `https://example.com/context-spec` exact as protected preserve markers.\n- Compressible context: the repeated note is the safe shrink target, so compress the repeated diagnosis note outside the preserved span.",
  "answer-quality-transcript-reconciles-history": "- Latest request: keep `Latest request must remain untouched.` exactly.\n- Protected history: preserve `Background task id: bg_transcript123 remains session-local.`, `Quoted user example: \"keep this quote exact\".`, and `Path: src/runtime-user-prompt-optimization.ts` exactly.\n- Compressible history: repeated summaries are compressible; the practical preserve-versus-compress rule is preserving the latest request and protected literals while repeated summaries shrink and anything exact stays verbatim.",
}

function parseArgs(argv) {
  let contractOnly = false
  let providerMode = "stub"
  let providerCommand = null
  let repeatCount = 1
  let enforceRepeatable = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--contract") contractOnly = true
    if (arg === "--provider") {
      providerMode = argv[index + 1] ?? providerMode
      index += 1
    }
    if (arg === "--provider-command") {
      providerCommand = argv[index + 1] ?? null
      index += 1
    }
    if (arg === "--repeat") {
      const next = Number.parseInt(argv[index + 1] ?? "", 10)
      if (!Number.isInteger(next) || next < 1) throw new Error("Expected --repeat to be a positive integer")
      repeatCount = next
      index += 1
    }
    if (arg === "--enforce-repeatable") enforceRepeatable = true
  }
  if (!CONTRACT.providerModes.includes(providerMode)) throw new Error("Expected --provider stub|command")
  if (providerMode === "command" && providerCommand == null) throw new Error("Expected --provider-command when --provider command is used")
  return { contractOnly, providerMode, providerCommand, repeatCount, enforceRepeatable }
}

function parseProviderCommand(value) {
  const parsed = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((part) => typeof part !== "string" || part === "")) {
    throw new Error("Expected --provider-command to be a JSON array of non-empty strings")
  }
  return parsed
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function sanitizeAnswer(answer) {
  const masked = answer.replace(/bg_[A-Za-z0-9_-]+/g, "bg_[redacted]")
  const lines = masked.split("\n")
  return lines.filter((line, index) => line !== lines[index - 1]).join("\n")
}

function sanitizeEvaluationOutput(output) {
  return {
    ...output,
    cases: output.cases.map((result) => ({
      ...result,
      answer: sanitizeAnswer(result.answer),
    })),
  }
}

function isProviderErrorCode(value) {
  return PROMPT_ANSWER_QUALITY_PROVIDER_ERROR_CODES.includes(value)
}

function parseProviderStdout(stdout, caseId, protocolMode) {
  const parsed = JSON.parse(stdout)
  if (typeof parsed !== "object" || parsed === null) throw new Error("Command provider response must be an object")
  if (parsed.protocolMode !== protocolMode || parsed.caseId !== caseId) throw new Error("Command provider response did not echo the protocol mode and case id")
  switch (parsed.status) {
    case "ok":
      if (typeof parsed.providerId !== "string" || parsed.providerId === "") throw new Error("Command provider response must include providerId")
      if (typeof parsed.modelId !== "string" || parsed.modelId === "") throw new Error("Command provider response must include modelId")
      if (typeof parsed.answer !== "string" || parsed.answer.trim() === "") throw new Error("Command provider response must include a non-empty answer")
      return parsed
    case "error":
      if (!isProviderErrorCode(parsed.errorCode) || typeof parsed.errorMessage !== "string") throw new Error("Command provider error response was invalid")
      throw new Error(`${parsed.errorCode}: ${parsed.errorMessage}`)
    default:
      throw new Error("Command provider response must use status ok|error")
  }
}

function buildSurfaceSection(title, content) {
  if (Array.isArray(content)) {
    if (content.length === 0) return null
    return `## ${title}\n${content.join("\n")}`
  }
  if (content === "") return null
  return `## ${title}\n${content}`
}

function buildProviderMessages(caseDefinition) {
  const sections = [
    buildSurfaceSection("Case", `${caseDefinition.title}\nExpected outcome: ${caseDefinition.expectedOutcome}`),
    buildSurfaceSection("Latest User Message", caseDefinition.prompt.surfaces.latestUserMessage),
    buildSurfaceSection("Runtime Owned Sections", caseDefinition.prompt.surfaces.runtimeOwnedSections),
    buildSurfaceSection("Tool Outputs", caseDefinition.prompt.surfaces.toolOutputs),
    buildSurfaceSection("Selected Context", caseDefinition.prompt.surfaces.selectedContext),
    buildSurfaceSection("Retained History", caseDefinition.prompt.surfaces.retainedHistory),
    buildSurfaceSection("Transcript Wide Compaction", caseDefinition.prompt.surfaces.transcriptWideCompaction),
  ].filter((section) => section !== null)
  return [
    { role: "system", content: caseDefinition.prompt.systemInstruction },
    { role: "user", content: sections.join("\n\n") },
  ]
}

function createStubProvider() {
  return async (caseDefinition) => ({
    providerId: "stub",
    modelId: "stub-deterministic-v1",
    answer: STUB_PROVIDER_RESPONSES[caseDefinition.caseId],
  })
}

function createCommandProvider(command) {
  return async (caseDefinition) => {
    const providerRun = spawnSync(command[0], command.slice(1), {
      input: JSON.stringify({
        protocolMode: PROMPT_ANSWER_QUALITY_CONTRACT.providerProtocolMode,
        caseId: caseDefinition.caseId,
        executionMode: "default-case-pack",
        messages: buildProviderMessages(caseDefinition),
      }),
      encoding: "utf8",
    })
    if ((providerRun.status ?? 1) !== 0) {
      throw new Error(providerRun.stderr || `Command provider failed for ${caseDefinition.caseId}`)
    }
    return parseProviderStdout(providerRun.stdout.trim(), caseDefinition.caseId, PROMPT_ANSWER_QUALITY_CONTRACT.providerProtocolMode)
  }
}

async function runBaseline(providerMode, providerCommand) {
  const answerProvider = providerMode === "command"
    ? createCommandProvider(parseProviderCommand(providerCommand))
    : createStubProvider()
  const providerResponses = await Promise.all(
    PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK.cases.map(async (caseDefinition) => ({
      caseId: caseDefinition.caseId,
      response: await answerProvider(caseDefinition),
    })),
  )
  const [firstResponse] = providerResponses
  if (firstResponse == null) throw new Error("Prompt answer quality case pack was empty")
  const evaluation = evaluatePromptAnswerQualityCasePack({
    casePack: PROMPT_ANSWER_QUALITY_DEFAULT_CASE_PACK,
    executionMode: "default-case-pack",
    providerId: firstResponse.response.providerId,
    modelId: firstResponse.response.modelId,
    answersByCaseId: Object.fromEntries(providerResponses.map(({ caseId, response }) => [caseId, response.answer])),
  })
  return sanitizeEvaluationOutput(evaluation)
}

async function main() {
  const { contractOnly, providerMode, providerCommand, repeatCount, enforceRepeatable } = parseArgs(process.argv.slice(2))
  if (contractOnly) {
    process.stdout.write(JSON.stringify(CONTRACT))
    return
  }
  const baselines = []
  for (let index = 0; index < repeatCount; index += 1) {
    baselines.push(await runBaseline(providerMode, providerCommand))
  }
  const runFingerprints = baselines.map((baseline) => fingerprint(baseline))
  const stable = new Set(runFingerprints).size === 1
  if (enforceRepeatable && !stable) throw new Error("Prompt answer quality results were not repeatable")
  process.stdout.write(JSON.stringify({
    contractMode: CONTRACT.contractMode,
    repeatCount,
    stable,
    runFingerprints,
    baseline: baselines[0],
  }))
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
