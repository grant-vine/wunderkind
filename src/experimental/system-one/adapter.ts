import { createHash } from "node:crypto"

import { TypeSafeClient, type Fetch, type SystemOneRequest as TypeSafeSystemOneRequest } from "@typesafe-ai/sdk"

const KEV_MODEL = "kev-latest" as const
const KEV_MODEL_ID = "jaredpalmer/kev-4b" as const
const KEV_MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101" as const
const KEV_TOKENIZER_JSON_SHA256 = "06b9509352d2af50381ab2247e083b80d32d5c0aba91c272ca9ff729b6a0e523" as const
const KEV_API_SOURCE_SHA256 = "a6f53af5354f8ea17915abc78360fdf291a5108ce39a53a2d9135d48c603ae58" as const
const TOKEN_PREFLIGHT_CONTRACT = "wunderkind-kev-4b-token-count-preflight-v1" as const
const MAX_STATE_TOKENS = 8192
const MAX_JSON_DEPTH = 256
const MAX_JSON_NODES = 100_000
const DEFAULT_TIMEOUT_MS = 5000
const MAX_TIMEOUT_MS = 60_000
const PROXY_ENVIRONMENT_NAMES = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"] as const

type SystemOneJsonValue = string | number | boolean | null | readonly SystemOneJsonValue[] | { readonly [key: string]: SystemOneJsonValue }

export type SystemOneNoulQuestion = { readonly type: "noul"; readonly instructions?: SystemOneJsonValue; readonly criteria?: { readonly true?: SystemOneJsonValue; readonly false?: SystemOneJsonValue } | null }
export type SystemOneChoiceQuestion = { readonly type: "choice"; readonly instructions?: SystemOneJsonValue; readonly criteria: { readonly [key: string]: SystemOneJsonValue } }
export type SystemOneScoreQuestion = { readonly type: "score"; readonly instructions?: SystemOneJsonValue; readonly criteria: readonly [SystemOneJsonValue, ...SystemOneJsonValue[]] }
type SystemOneQuestion = SystemOneNoulQuestion | SystemOneChoiceQuestion | SystemOneScoreQuestion
export type SystemOneRequest = { readonly model: typeof KEV_MODEL; readonly state: SystemOneJsonValue; readonly questions: { readonly [questionId: string]: SystemOneQuestion } }
export type SystemOneTokenPreflight = {
  readonly contract: typeof TOKEN_PREFLIGHT_CONTRACT
  readonly model: typeof KEV_MODEL_ID
  readonly modelRevision: typeof KEV_MODEL_REVISION
  readonly tokenizerJsonSha256: typeof KEV_TOKENIZER_JSON_SHA256
  readonly kevApiSourceSha256: typeof KEV_API_SOURCE_SHA256
  readonly requestSha256: string
  readonly stateJsonSha256: string
  readonly renderedStateSha256: string
  readonly stateTokens: number
}
export type SystemOneAdapterOptions = { readonly enabled: boolean; readonly endpoint?: string; readonly timeoutMs?: number }
export type SystemOneAnswer =
  | { readonly type: "noul"; readonly noul: number }
  | { readonly type: "choice"; readonly choice: string; readonly confidence: number; readonly probabilities: Readonly<Record<string, number>> }
  | { readonly type: "score"; readonly score: number; readonly confidence: number; readonly legend: Readonly<Record<string, string>>; readonly probabilities: Readonly<Record<string, number>> }
export type SystemOneResponse = { readonly model: string; readonly answers: Readonly<Record<string, SystemOneAnswer>>; readonly usage: { readonly inputTokens: number; readonly outputTokens: number } }
export type SystemOnePassthroughReason = "disabled" | "invalid_request" | "preflight_missing" | "preflight_invalid" | "preflight_over_limit" | "endpoint_rejected" | "proxy_rejected" | "transport_failed" | "invalid_response"
export type SystemOneAdapterResult = { readonly kind: "answer"; readonly request: SystemOneRequest; readonly response: SystemOneResponse; readonly latencyMs: number } | { readonly kind: "passthrough"; readonly request: unknown; readonly reason: SystemOnePassthroughReason }

const SDK_TRANSPORT_REQUEST = {
  model: KEV_MODEL,
  state: null,
  questions: { transport: { type: "noul" } },
} satisfies TypeSafeSystemOneRequest

class LocalTransportError extends Error {
  readonly name = "LocalTransportError"

  constructor(readonly code: "endpoint" | "proxy" | "redirect") {
    super(`local System One transport rejected: ${code}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

type JsonWalkState = { count: number; ancestors: WeakSet<object> }

function isWithinJsonBudget(value: unknown, depth = 0, state: JsonWalkState = { count: 0, ancestors: new WeakSet<object>() }): boolean {
  state.count += 1
  if (state.count > MAX_JSON_NODES) return false
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "object" || depth >= MAX_JSON_DEPTH || state.ancestors.has(value)) return false
  state.ancestors.add(value)
  try {
    for (const key of Object.keys(value)) {
      if (!isWithinJsonBudget(Reflect.get(value, key), depth + 1, state)) return false
    }
    return true
  } finally {
    state.ancestors.delete(value)
  }
}

function parseJsonValue(value: unknown, depth = 0, ancestors = new WeakSet<object>(), nodes = { count: 0 }): SystemOneJsonValue | undefined {
  nodes.count += 1
  if (nodes.count > MAX_JSON_NODES) return undefined
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value !== "object" || depth >= MAX_JSON_DEPTH || ancestors.has(value)) return undefined
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const entries: SystemOneJsonValue[] = []
      for (const item of value) {
        const parsed = parseJsonValue(item, depth + 1, ancestors, nodes)
        if (parsed === undefined) return undefined
        entries.push(parsed)
      }
      return entries
    }
    if (!isRecord(value)) return undefined
    const entries: [string, SystemOneJsonValue][] = []
    for (const [key, item] of Object.entries(value)) {
      const parsed = parseJsonValue(item, depth + 1, ancestors, nodes)
      if (parsed === undefined) return undefined
      entries.push([key, parsed])
    }
    return Object.fromEntries(entries)
  } catch {
    return undefined
  } finally {
    ancestors.delete(value)
  }
}

function parseInstructions(value: Record<string, unknown>): SystemOneJsonValue | undefined {
  if (!("instructions" in value)) return undefined
  return parseJsonValue(value["instructions"])
}

function parseNoulQuestion(value: Record<string, unknown>): SystemOneNoulQuestion | null {
  if (!hasOnlyKeys(value, ["type", "instructions", "criteria"]) || value["type"] !== "noul") return null
  const instructions = parseInstructions(value)
  if ("instructions" in value && instructions === undefined) return null
  if (!("criteria" in value)) return instructions === undefined ? { type: "noul" } : { type: "noul", instructions }
  if (value["criteria"] === null) return instructions === undefined ? { type: "noul", criteria: null } : { type: "noul", instructions, criteria: null }
  if (!isRecord(value["criteria"]) || !hasOnlyKeys(value["criteria"], ["true", "false"])) return null
  const criteriaEntries: ["true" | "false", SystemOneJsonValue][] = []
  for (const key of ["true", "false"] as const) {
    if (key in value["criteria"]) {
      const raw = value["criteria"][key]
      const parsed = parseJsonValue(raw)
      if (parsed === undefined) return null
      criteriaEntries.push([key, parsed])
    }
  }
  const criteria = Object.fromEntries(criteriaEntries)
  return instructions === undefined ? { type: "noul", criteria } : { type: "noul", instructions, criteria }
}

function parseChoiceQuestion(value: Record<string, unknown>): SystemOneChoiceQuestion | null {
  if (!hasOnlyKeys(value, ["type", "instructions", "criteria"]) || value["type"] !== "choice" || !isRecord(value["criteria"]) || Object.keys(value["criteria"]).length === 0 || Object.keys(value["criteria"]).length > 255) return null
  const instructions = parseInstructions(value)
  if ("instructions" in value && instructions === undefined) return null
  const entries: [string, SystemOneJsonValue][] = []
  for (const [key, criterion] of Object.entries(value["criteria"])) {
    const parsed = parseJsonValue(criterion)
    if (parsed === undefined) return null
    entries.push([key, parsed])
  }
  const criteria = Object.fromEntries(entries)
  return instructions === undefined ? { type: "choice", criteria } : { type: "choice", instructions, criteria }
}

function parseScoreQuestion(value: Record<string, unknown>): SystemOneScoreQuestion | null {
  if (!hasOnlyKeys(value, ["type", "instructions", "criteria"]) || value["type"] !== "score" || !Array.isArray(value["criteria"]) || value["criteria"].length === 0 || value["criteria"].length > 255) return null
  const instructions = parseInstructions(value)
  if ("instructions" in value && instructions === undefined) return null
  const criteria: SystemOneJsonValue[] = []
  for (const criterion of value["criteria"]) {
    const parsed = parseJsonValue(criterion)
    if (parsed === undefined) return null
    criteria.push(parsed)
  }
  const first = criteria[0]
  if (first === undefined) return null
  const parsedCriteria: [SystemOneJsonValue, ...SystemOneJsonValue[]] = [first, ...criteria.slice(1)]
  return instructions === undefined ? { type: "score", criteria: parsedCriteria } : { type: "score", instructions, criteria: parsedCriteria }
}

function parseQuestion(value: unknown): SystemOneQuestion | null {
  if (!isRecord(value) || typeof value["type"] !== "string") return null
  switch (value["type"]) {
    case "noul": return parseNoulQuestion(value)
    case "choice": return parseChoiceQuestion(value)
    case "score": return parseScoreQuestion(value)
    default: return null
  }
}

export function parseSystemOneRequest(value: unknown): SystemOneRequest | null {
  try {
    if (!isWithinJsonBudget(value) || !isRecord(value) || !hasOnlyKeys(value, ["model", "state", "questions"]) || value["model"] !== KEV_MODEL || !isRecord(value["questions"]) || Object.keys(value["questions"]).length === 0) return null
    const state = parseJsonValue(value["state"])
    if (state === undefined) return null
    const questionEntries: [string, SystemOneQuestion][] = []
    for (const [questionId, question] of Object.entries(value["questions"])) {
      if (questionId.length === 0) return null
      const parsed = parseQuestion(question)
      if (parsed === null) return null
      questionEntries.push([questionId, parsed])
    }
    const questions = Object.fromEntries(questionEntries)
    return { model: KEV_MODEL, state, questions }
  } catch {
    return null
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function parseTokenPreflight(value: unknown, request: SystemOneRequest): "missing" | "invalid" | "over_limit" | SystemOneTokenPreflight {
  if (value === undefined) return "missing"
  if (!isRecord(value)) return "invalid"
  const tokenizerJsonSha256 = value["tokenizerJsonSha256"]
  const kevApiSourceSha256 = value["kevApiSourceSha256"]
  const requestSha256 = value["requestSha256"]
  const stateJsonSha256 = value["stateJsonSha256"]
  const renderedStateSha256 = value["renderedStateSha256"]
  const stateTokens = value["stateTokens"]
  if (value["contract"] !== TOKEN_PREFLIGHT_CONTRACT || value["model"] !== KEV_MODEL_ID || value["modelRevision"] !== KEV_MODEL_REVISION || tokenizerJsonSha256 !== KEV_TOKENIZER_JSON_SHA256 || kevApiSourceSha256 !== KEV_API_SOURCE_SHA256 || !isSha256(requestSha256) || !isSha256(stateJsonSha256) || !isSha256(renderedStateSha256) || typeof stateTokens !== "number" || !Number.isSafeInteger(stateTokens) || stateTokens < 1) return "invalid"
  if (requestSha256 !== sha256Json(request) || stateJsonSha256 !== sha256Json(request.state)) return "invalid"
  if (stateTokens > MAX_STATE_TOKENS) return "over_limit"
  return { contract: TOKEN_PREFLIGHT_CONTRACT, model: KEV_MODEL_ID, modelRevision: KEV_MODEL_REVISION, tokenizerJsonSha256: KEV_TOKENIZER_JSON_SHA256, kevApiSourceSha256: KEV_API_SOURCE_SHA256, requestSha256, stateJsonSha256, renderedStateSha256, stateTokens }
}

function resolveEndpoint(value: string | undefined): URL | null {
  if (value === undefined || !/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/?$/u.test(value)) return null
  let endpoint: URL
  try { endpoint = new URL(value) } catch { return null }
  const port = Number(endpoint.port)
  if (endpoint.protocol !== "http:" || endpoint.username.length > 0 || endpoint.password.length > 0 || endpoint.pathname !== "/" || endpoint.search.length > 0 || endpoint.hash.length > 0 || !Number.isSafeInteger(port) || port < 1 || port > 65535) return null
  return endpoint
}

function proxyConfigured(): boolean {
  return PROXY_ENVIRONMENT_NAMES.some((name) => {
    const value = process.env[name]
    return value !== undefined && value.trim().length !== 0
  })
}

function localOnlyFetch(endpoint: URL, request: SystemOneRequest): Fetch {
  const body = JSON.stringify(request)
  return async (input, init) => {
    if (proxyConfigured()) throw new LocalTransportError("proxy")
    const requestUrl = new URL(input)
    if (requestUrl.protocol !== endpoint.protocol || requestUrl.hostname !== endpoint.hostname || requestUrl.port !== endpoint.port || requestUrl.pathname !== "/v1/systemone" || requestUrl.search.length > 0 || requestUrl.hash.length > 0 || requestUrl.username.length > 0 || requestUrl.password.length > 0) throw new LocalTransportError("endpoint")
    const response = await fetch(requestUrl, { ...init, body, redirect: "manual" })
    if (response.status >= 300 && response.status < 400) throw new LocalTransportError("redirect")
    return response
  }
}

function validFiniteProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

function hasProbabilityDistribution(value: unknown, keys: readonly string[]): value is Readonly<Record<string, number>> {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) return false
  const probabilities = keys.map((key) => value[key])
  if (!probabilities.every(validFiniteProbability)) return false
  return Math.abs(probabilities.reduce((total, probability) => total + probability, 0) - 1) <= 0.02
}

function parseAnswer(value: unknown, question: SystemOneQuestion): SystemOneAnswer | null {
  if (!isRecord(value) || typeof value["type"] !== "string") return null
  switch (question.type) {
    case "noul": return value["type"] === "noul" && hasOnlyKeys(value, ["type", "noul"]) && validFiniteProbability(value["noul"]) ? { type: "noul", noul: value["noul"] } : null
    case "choice": {
      const keys = Object.keys(question.criteria)
      if (value["type"] !== "choice" || !hasOnlyKeys(value, ["type", "choice", "confidence", "probabilities"]) || typeof value["choice"] !== "string" || !keys.includes(value["choice"]) || !validFiniteProbability(value["confidence"]) || !hasProbabilityDistribution(value["probabilities"], keys)) return null
      const responseProbabilities = value["probabilities"]
      if (!isRecord(responseProbabilities)) return null
      const probabilityEntries: [string, number][] = []
      for (const key of keys) {
        const probability = responseProbabilities[key]
        if (probability === undefined) return null
        probabilityEntries.push([key, probability])
      }
      const safeProbabilities = Object.fromEntries(probabilityEntries)
      return { type: "choice", choice: value["choice"], confidence: value["confidence"], probabilities: safeProbabilities }
    }
    case "score": {
      const keys = question.criteria.map((_criterion, index) => String(index))
      const score = value["score"]
      const confidence = value["confidence"]
      const legendResponse = value["legend"]
      const probabilities = value["probabilities"]
      if (value["type"] !== "score" || !hasOnlyKeys(value, ["type", "score", "confidence", "legend", "probabilities"]) || typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > question.criteria.length - 1 || !validFiniteProbability(confidence) || !isRecord(legendResponse) || Object.keys(legendResponse).length !== keys.length || keys.some((key) => typeof legendResponse[key] !== "string") || !hasProbabilityDistribution(probabilities, keys)) return null
      const legendEntries: [string, string][] = []
      for (const key of keys) {
        const legendValue = legendResponse[key]
        if (typeof legendValue !== "string") return null
        legendEntries.push([key, legendValue])
      }
      const safeLegend = Object.fromEntries(legendEntries)
      const probabilityEntries: [string, number][] = []
      for (const key of keys) {
        const probability = probabilities[key]
        if (probability === undefined) return null
        probabilityEntries.push([key, probability])
      }
      const safeProbabilities = Object.fromEntries(probabilityEntries)
      return { type: "score", score, confidence, legend: safeLegend, probabilities: safeProbabilities }
    }
    default: return null
  }
}

function parseResponse(value: unknown, request: SystemOneRequest): SystemOneResponse | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["model", "answers", "usage", "latency_ms"])) return null
  const model = value["model"]
  const responseAnswers = value["answers"]
  const usage = value["usage"]
  const serverLatency = value["latency_ms"]
  if (typeof model !== "string" || model.length === 0 || serverLatency !== undefined && (typeof serverLatency !== "number" || !Number.isFinite(serverLatency) || serverLatency < 0) || !isRecord(responseAnswers) || !isRecord(usage) || !hasOnlyKeys(usage, ["input_tokens", "output_tokens"])) return null
  const inputTokens = usage["input_tokens"]
  const outputTokens = usage["output_tokens"]
  if (typeof inputTokens !== "number" || !Number.isSafeInteger(inputTokens) || inputTokens < 0 || typeof outputTokens !== "number" || !Number.isSafeInteger(outputTokens) || outputTokens < 0) return null
  const questionIds = Object.keys(request.questions)
  if (Object.keys(responseAnswers).length !== questionIds.length || questionIds.some((id) => !(id in responseAnswers))) return null
  const answerEntries: [string, SystemOneAnswer][] = []
  for (const questionId of questionIds) {
    const question = request.questions[questionId]
    if (question === undefined) return null
    const answer = parseAnswer(responseAnswers[questionId], question)
    if (answer === null) return null
    answerEntries.push([questionId, answer])
  }
  const answers = Object.fromEntries(answerEntries)
  return { model, answers, usage: { inputTokens, outputTokens } }
}

function resolveTimeout(timeoutMs: number | undefined): number | null {
  const resolved = timeoutMs ?? DEFAULT_TIMEOUT_MS
  return Number.isSafeInteger(resolved) && resolved > 0 && resolved <= MAX_TIMEOUT_MS ? resolved : null
}

function sha256Json(value: unknown): string {
  const json = JSON.stringify(value)
  if (json === undefined) throw new LocalTransportError("endpoint")
  return createHash("sha256").update(json, "utf8").digest("hex")
}

async function invokeSystemOne(client: TypeSafeClient): Promise<unknown> {
  return client.systemOne(SDK_TRANSPORT_REQUEST)
}

export class LocalSystemOneAdapter {
  constructor(private readonly options: SystemOneAdapterOptions) {}

  async evaluate(input: unknown, tokenPreflight?: unknown): Promise<SystemOneAdapterResult> {
    if (!this.options.enabled) return { kind: "passthrough", request: input, reason: "disabled" }
    let request: SystemOneRequest | null
    try {
      request = parseSystemOneRequest(input)
    } catch {
      request = null
    }
    if (request === null) return { kind: "passthrough", request: input, reason: "invalid_request" }
    let preflight: "missing" | "invalid" | "over_limit" | SystemOneTokenPreflight
    try {
      preflight = parseTokenPreflight(tokenPreflight, request)
    } catch {
      preflight = "invalid"
    }
    if (preflight === "missing") return { kind: "passthrough", request: input, reason: "preflight_missing" }
    if (preflight === "invalid") return { kind: "passthrough", request: input, reason: "preflight_invalid" }
    if (preflight === "over_limit") return { kind: "passthrough", request: input, reason: "preflight_over_limit" }
    const endpoint = resolveEndpoint(this.options.endpoint)
    const timeout = resolveTimeout(this.options.timeoutMs)
    if (endpoint === null || timeout === null) return { kind: "passthrough", request: input, reason: "endpoint_rejected" }
    if (proxyConfigured()) return { kind: "passthrough", request: input, reason: "proxy_rejected" }
    const client = new TypeSafeClient({ apiKey: "local", baseURL: endpoint.toString(), defaultModel: KEV_MODEL, retry: { maxRetries: 0 }, timeout, logLevel: "off", fetch: localOnlyFetch(endpoint, request) })
    const started = performance.now()
    try {
      const response = parseResponse(await invokeSystemOne(client), request)
      if (response === null) return { kind: "passthrough", request: input, reason: "invalid_response" }
      return { kind: "answer", request, response, latencyMs: performance.now() - started }
    } catch {
      return { kind: "passthrough", request: input, reason: "transport_failed" }
    }
  }
}

export function createLocalSystemOneAdapter(options: SystemOneAdapterOptions = { enabled: false }): LocalSystemOneAdapter {
  return new LocalSystemOneAdapter(options)
}
