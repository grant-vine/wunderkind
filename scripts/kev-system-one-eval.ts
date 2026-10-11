import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import {
  createLocalSystemOneAdapter,
  parseSystemOneRequest,
  type SystemOneRequest,
  type SystemOneTokenPreflight,
} from "../src/experimental/system-one/adapter.js"

const REPLAY_FIXTURE_SHA256 = "11c6896e16c99180a0bcf146bcd2239a440ac60cb5a047735b97cc21966a189b"
const REPLAY_FIXTURE_BYTES = 652079
const MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
const TOKEN_PREFLIGHT_CONTRACT = "wunderkind-kev-4b-token-count-preflight-v1"
const TOKENIZER_JSON_SHA256 = "06b9509352d2af50381ab2247e083b80d32d5c0aba91c272ca9ff729b6a0e523"
const KEV_API_SOURCE_SHA256 = "a6f53af5354f8ea17915abc78360fdf291a5108ce39a53a2d9135d48c603ae58"

type RunnerArguments = {
  readonly endpoint: string
  readonly samplesPath: string
  readonly tokenPreflightPath: string
  readonly outputPath: string
}

type ReplayRecord = {
  readonly recordIndex: number
  readonly sampleId: string
  readonly requestSha256: string
  readonly request: SystemOneRequest
  readonly groundtruth: unknown
}

type PreflightByRecord = ReadonlyMap<number, SystemOneTokenPreflight>

class RunnerError extends Error {
  readonly name = "RunnerError"

  constructor(readonly code: "arguments" | "fixture" | "preflight" | "adapter") {
    super(`System One evaluation rejected: ${code}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function parseArguments(argv: readonly string[]): RunnerArguments {
  let enabled = false
  let endpoint: string | undefined
  let samplesPath: string | undefined
  let tokenPreflightPath: string | undefined
  let outputPath: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--enabled") {
      if (enabled) throw new RunnerError("arguments")
      enabled = true
      continue
    }
    if (argument !== "--endpoint" && argument !== "--samples" && argument !== "--token-preflight" && argument !== "--out") throw new RunnerError("arguments")
    const value = argv[index + 1]
    if (value === undefined || value.startsWith("--")) throw new RunnerError("arguments")
    index += 1
    switch (argument) {
      case "--endpoint":
        if (endpoint !== undefined) throw new RunnerError("arguments")
        endpoint = value
        break
      case "--samples":
        if (samplesPath !== undefined) throw new RunnerError("arguments")
        samplesPath = value
        break
      case "--token-preflight":
        if (tokenPreflightPath !== undefined) throw new RunnerError("arguments")
        tokenPreflightPath = value
        break
      case "--out":
        if (outputPath !== undefined) throw new RunnerError("arguments")
        outputPath = value
        break
      default:
        throw new RunnerError("arguments")
    }
  }
  if (!enabled || endpoint === undefined || samplesPath === undefined || tokenPreflightPath === undefined || outputPath === undefined) throw new RunnerError("arguments")
  return { endpoint, samplesPath, tokenPreflightPath, outputPath }
}

function parseReplayFixture(path: string): readonly ReplayRecord[] {
  const bytes = readFileSync(path)
  if (bytes.byteLength !== REPLAY_FIXTURE_BYTES || sha256(bytes) !== REPLAY_FIXTURE_SHA256) throw new RunnerError("fixture")
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new RunnerError("fixture")
  }
  if (!isRecord(parsed) || parsed["record_count"] !== 454 || parsed["question_count"] !== 477 || !isRecord(parsed["question_type_counts"]) || parsed["question_type_counts"]["choice"] !== 283 || parsed["question_type_counts"]["score"] !== 16 || parsed["question_type_counts"]["noul"] !== 178 || !Array.isArray(parsed["records"]) || parsed["records"].length !== 454) throw new RunnerError("fixture")
  const records: ReplayRecord[] = []
  let questionCount = 0
  const questionTypeCounts = { choice: 0, score: 0, noul: 0 }
  for (const [position, value] of parsed["records"].entries()) {
    if (!isRecord(value) || value["record_index"] !== position || typeof value["sample_id"] !== "string" || value["sample_id"].length === 0 || !isSha256(value["request_sha256"])) throw new RunnerError("fixture")
    const request = parseSystemOneRequest(value["request"])
    if (request === null || sha256(JSON.stringify(value["request"])) !== value["request_sha256"] || !("groundtruth" in value)) throw new RunnerError("fixture")
    for (const question of Object.values(request.questions)) {
      questionCount += 1
      switch (question.type) {
        case "choice": questionTypeCounts.choice += 1; break
        case "score": questionTypeCounts.score += 1; break
        case "noul": questionTypeCounts.noul += 1; break
      }
    }
    records.push({ recordIndex: position, sampleId: value["sample_id"], requestSha256: value["request_sha256"], request, groundtruth: value["groundtruth"] })
  }
  if (questionCount !== 477 || questionTypeCounts.choice !== 283 || questionTypeCounts.score !== 16 || questionTypeCounts.noul !== 178) throw new RunnerError("fixture")
  return records
}

function parseTokenPreflight(path: string, records: readonly ReplayRecord[]): PreflightByRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new RunnerError("preflight")
  }
  if (!isRecord(parsed) || parsed["contract"] !== TOKEN_PREFLIGHT_CONTRACT || parsed["model"] !== "jaredpalmer/kev-4b" || parsed["model_revision"] !== MODEL_REVISION || parsed["tokenizer_json_sha256"] !== TOKENIZER_JSON_SHA256 || parsed["kev_api_source_sha256"] !== KEV_API_SOURCE_SHA256 || typeof parsed["render_command"] !== "string" || parsed["render_command"].trim().length === 0 || typeof parsed["count_command"] !== "string" || parsed["count_command"].trim().length === 0 || !Array.isArray(parsed["records"]) || parsed["records"].length !== records.length) throw new RunnerError("preflight")
  const byRecord = new Map<number, SystemOneTokenPreflight>()
  for (const value of parsed["records"]) {
    if (!isRecord(value) || typeof value["record_index"] !== "number" || !Number.isSafeInteger(value["record_index"]) || !isSha256(value["request_sha256"]) || !isSha256(value["state_json_sha256"]) || !isSha256(value["rendered_state_sha256"]) || typeof value["state_tokens"] !== "number" || !Number.isSafeInteger(value["state_tokens"]) || value["state_tokens"] < 1 || value["state_tokens"] > 8192 || byRecord.has(value["record_index"])) throw new RunnerError("preflight")
    byRecord.set(value["record_index"], {
      contract: TOKEN_PREFLIGHT_CONTRACT,
      model: "jaredpalmer/kev-4b",
      modelRevision: MODEL_REVISION,
      tokenizerJsonSha256: TOKENIZER_JSON_SHA256,
      kevApiSourceSha256: KEV_API_SOURCE_SHA256,
      requestSha256: value["request_sha256"],
      stateJsonSha256: value["state_json_sha256"],
      renderedStateSha256: value["rendered_state_sha256"],
      stateTokens: value["state_tokens"],
    })
  }
  for (const record of records) {
    const preflight = byRecord.get(record.recordIndex)
    if (preflight === undefined || preflight.requestSha256 !== record.requestSha256 || preflight.stateJsonSha256 !== sha256(JSON.stringify(record.request.state))) throw new RunnerError("preflight")
  }
  return byRecord
}

async function run(arguments_: RunnerArguments): Promise<void> {
  const records = parseReplayFixture(resolve(arguments_.samplesPath))
  const preflight = parseTokenPreflight(resolve(arguments_.tokenPreflightPath), records)
  const adapter = createLocalSystemOneAdapter({ enabled: true, endpoint: arguments_.endpoint })
  const output: string[] = []
  for (const record of records) {
    const verifiedCount = preflight.get(record.recordIndex)
    if (verifiedCount === undefined) throw new RunnerError("preflight")
    const result = await adapter.evaluate(record.request, verifiedCount)
    if (result.kind !== "answer") throw new RunnerError("adapter")
    output.push(JSON.stringify({ record_index: record.recordIndex, sample_id: record.sampleId, request_sha256: record.requestSha256, prediction: result.response.answers, latency_ms: result.latencyMs, groundtruth: record.groundtruth }))
  }
  const outputPath = resolve(arguments_.outputPath)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${output.join("\n")}\n`, "utf8")
}

async function main(): Promise<void> {
  try {
    await run(parseArguments(process.argv.slice(2)))
  } catch (error) {
    if (error instanceof RunnerError) {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = 1
      return
    }
    process.stderr.write("System One evaluation rejected: adapter\n")
    process.exitCode = 1
  }
}

void main()
