import { MemoryLedgerError } from "./errors.js"
import { redactExcerpt } from "./redaction.js"
import type { Sensitivity } from "./types.js"

export type CaptureDisposition = "omit" | "summary" | "full"

export interface MemoryCaptureInput {
  readonly eventId: string
  readonly source: string
  readonly occurredAt: number
  readonly excerpt: string
  readonly sensitivity: Sensitivity
}

export interface NormalizedMemoryEvent {
  readonly eventId: string
  readonly source: string
  readonly occurredAt: number
  readonly excerpt: string
  readonly sensitivity: Sensitivity
}

export interface ExtractedMemoryFact {
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: Sensitivity
}

export interface MemoryExtraction {
  readonly facts: readonly ExtractedMemoryFact[]
}

export interface MemoryAbortSignal {
  readonly aborted: boolean
  addEventListener(type: "abort", listener: () => void, options?: { readonly once?: boolean }): void
  removeEventListener(type: "abort", listener: () => void): void
}

export interface MemoryExtractor {
  extract(input: NormalizedMemoryEvent, signal: MemoryAbortSignal): Promise<unknown>
}

export interface OllamaRequest {
  readonly url: string
  readonly body: string
  readonly signal: MemoryAbortSignal
}

export interface OllamaResponse {
  readonly status: number
  readonly body: string
}

export interface OllamaRequester {
  request(input: OllamaRequest): Promise<OllamaResponse>
}

export interface OllamaExtractorOptions extends OllamaRequester {
  readonly baseUrl: string
  readonly model: string
  readonly timeoutMs: number
  readonly maxResponseBytes: number
}

export interface ExperimentalSystemOneAdapter {
  readonly name: "jev" | "kev"
  readonly enabled: false
}

export interface SystemOnePolicy {
  readonly experimental: readonly ExperimentalSystemOneAdapter[]
  select(event: NormalizedMemoryEvent): CaptureDisposition
  summarize(event: NormalizedMemoryEvent): NormalizedMemoryEvent
}

export const OLLAMA_FACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      maxItems: 64,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "predicate", "value", "sensitivity"],
        properties: {
          subject: { type: "string", minLength: 1, maxLength: 512 },
          predicate: { type: "string", minLength: 1, maxLength: 512 },
          value: { type: "string", minLength: 1, maxLength: 4096 },
          sensitivity: { enum: ["public", "internal", "sensitive"] },
        },
      },
    },
  },
} as const

export class MemoryProviderError extends Error {
  readonly name = "MemoryProviderError"

  constructor(readonly code: "invalid_response" | "timeout" | "unavailable") {
    super(`memory provider unavailable: ${code}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSensitivity(value: unknown): value is Sensitivity {
  return value === "public" || value === "internal" || value === "sensitive"
}

function isText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
}

function parseExtractedFact(value: unknown): ExtractedMemoryFact | null {
  if (!isRecord(value) || Object.keys(value).length !== 4) return null
  if (!isText(value["subject"], 512) || !isText(value["predicate"], 512) || !isText(value["value"], 4096) || !isSensitivity(value["sensitivity"])) {
    return null
  }
  return {
    subject: redactExcerpt(value["subject"]),
    predicate: redactExcerpt(value["predicate"]),
    value: redactExcerpt(value["value"]),
    sensitivity: value["sensitivity"],
  }
}

export function parseOllamaExtraction(value: unknown): MemoryExtraction {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value["facts"]) || value["facts"].length > 64) {
    throw new MemoryProviderError("invalid_response")
  }
  const facts: ExtractedMemoryFact[] = []
  for (const fact of value["facts"]) {
    const parsed = parseExtractedFact(fact)
    if (!parsed) throw new MemoryProviderError("invalid_response")
    facts.push(parsed)
  }
  return { facts }
}

function assertLoopbackUrl(value: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new MemoryProviderError("unavailable")
  }
  const octets = parsed.hostname.split(".")
  const isLoopbackV4 = octets.length === 4 && octets[0] === "127" && octets.every((octet) => /^\d{1,3}$/u.test(octet) && Number(octet) <= 255)
  if (parsed.protocol !== "http:" || (parsed.hostname !== "::1" && !isLoopbackV4)) {
    throw new MemoryProviderError("unavailable")
  }
  return parsed
}

function abortAfter<T>(request: (signal: MemoryAbortSignal) => Promise<T>, signal: MemoryAbortSignal, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const abortFromCaller = (): void => controller.abort()
  signal.addEventListener("abort", abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const work = request(controller.signal)
  const cancelled = new Promise<T>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new MemoryProviderError("timeout")), { once: true })
  })
  return Promise.race([work, cancelled]).finally(() => {
    clearTimeout(timeout)
    signal.removeEventListener("abort", abortFromCaller)
  })
}

export function createOllamaExtractor(options: OllamaExtractorOptions): MemoryExtractor {
  const endpoint = assertLoopbackUrl(options.baseUrl)
  const model = options.model.trim()
  if (model.length === 0 || !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 100 || !Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes < 1024) {
    throw new MemoryProviderError("unavailable")
  }
  const url = new URL("api/generate", endpoint).toString()
  return {
    async extract(input, signal): Promise<MemoryExtraction> {
      const canonicalInput = normalizeMemoryEvent(input)
      const body = JSON.stringify({
        model,
        stream: false,
        format: OLLAMA_FACT_SCHEMA,
        prompt: JSON.stringify({ excerpt: canonicalInput.excerpt, source: canonicalInput.source, occurredAt: canonicalInput.occurredAt, sensitivity: canonicalInput.sensitivity }),
      })
      try {
        const response = await abortAfter((requestSignal) => options.request({ url, body, signal: requestSignal }), signal, options.timeoutMs)
        if (response.status !== 200 || Buffer.byteLength(response.body, "utf8") > options.maxResponseBytes) {
          throw new MemoryProviderError("invalid_response")
        }
        const envelope: unknown = JSON.parse(response.body)
        if (!isRecord(envelope) || typeof envelope["response"] !== "string") {
          throw new MemoryProviderError("invalid_response")
        }
        return parseOllamaExtraction(JSON.parse(envelope["response"]))
      } catch (error) {
        if (error instanceof MemoryProviderError) throw error
        throw new MemoryProviderError("unavailable")
      }
    },
  }
}

export function normalizeMemoryEvent(input: MemoryCaptureInput): NormalizedMemoryEvent {
  if (!Number.isSafeInteger(input.occurredAt) || input.occurredAt < 0 || !isSensitivity(input.sensitivity)) {
    throw new MemoryLedgerError("validation")
  }
  const eventId = redactExcerpt(input.eventId.trim())
  const source = redactExcerpt(input.source.trim())
  const excerpt = redactExcerpt(input.excerpt.trim())
  if (eventId.length === 0 || source.length === 0 || excerpt.length === 0) {
    throw new MemoryLedgerError("validation")
  }
  return Object.freeze({ eventId, source, occurredAt: input.occurredAt, excerpt, sensitivity: input.sensitivity })
}

export function summarizeMemoryEvent(event: NormalizedMemoryEvent, maximumExcerptLength: number): NormalizedMemoryEvent {
  const canonical = normalizeMemoryEvent(event)
  if (!Number.isSafeInteger(maximumExcerptLength) || maximumExcerptLength < 1) {
    throw new MemoryLedgerError("validation")
  }
  if (canonical.excerpt.length <= maximumExcerptLength) return canonical
  return normalizeMemoryEvent({
    eventId: canonical.eventId,
    source: canonical.source,
    occurredAt: canonical.occurredAt,
    excerpt: `${canonical.excerpt.slice(0, maximumExcerptLength)} [TRUNCATED]`,
    sensitivity: canonical.sensitivity,
  })
}

export function createSystemOnePolicy(summaryThreshold = 1200): SystemOnePolicy {
  if (!Number.isSafeInteger(summaryThreshold) || summaryThreshold < 1) {
    throw new MemoryLedgerError("validation")
  }
  return {
    experimental: [{ name: "jev", enabled: false }, { name: "kev", enabled: false }],
    select(event): CaptureDisposition {
      if (event.sensitivity === "sensitive") return "omit"
      return event.excerpt.length > summaryThreshold ? "summary" : "full"
    },
    summarize(event): NormalizedMemoryEvent {
      return summarizeMemoryEvent(event, summaryThreshold)
    },
  }
}
