import { MemoryLedger } from "./ledger.js"
import { MemoryProviderError, createSystemOnePolicy, normalizeMemoryEvent, parseOllamaExtraction, type MemoryAbortSignal, type MemoryExtractor, type NormalizedMemoryEvent, type SystemOnePolicy } from "./providers.js"

export type MemoryWorkerStatus = "processed" | "duplicate" | "omitted" | "rejected" | "timeout" | "unavailable" | "failed"

export interface MemoryWorkerResult {
  readonly status: MemoryWorkerStatus
  readonly factIds: readonly string[]
}

export interface MemoryWorkerOptions {
  readonly ledger: MemoryLedger
  readonly extractor: MemoryExtractor
  readonly maxQueue: number
  readonly systemOne?: SystemOnePolicy
}

interface PendingCapture {
  readonly event: NormalizedMemoryEvent
  readonly signal: MemoryAbortSignal
}

const EMPTY_RESULT: MemoryWorkerResult = { status: "failed", factIds: [] }

export class MemoryWorker {
  readonly #ledger: MemoryLedger
  readonly #extractor: MemoryExtractor
  readonly #maxQueue: number
  readonly #systemOne: SystemOnePolicy
  readonly #pendingIds = new Set<string>()
  #tail: Promise<void> = Promise.resolve()

  constructor(options: MemoryWorkerOptions) {
    if (!Number.isSafeInteger(options.maxQueue) || options.maxQueue < 1) {
      throw new Error("memory worker maxQueue must be positive")
    }
    this.#ledger = options.ledger
    this.#extractor = options.extractor
    this.#maxQueue = options.maxQueue
    this.#systemOne = options.systemOne ?? createSystemOnePolicy()
  }

  enqueue(event: NormalizedMemoryEvent, signal: MemoryAbortSignal = new AbortController().signal): Promise<MemoryWorkerResult> {
    const canonicalEvent = normalizeMemoryEvent(event)
    if (signal.aborted) return Promise.resolve({ status: "timeout", factIds: [] })
    if (this.#pendingIds.has(canonicalEvent.eventId)) return Promise.resolve({ status: "duplicate", factIds: [] })
    if (this.#pendingIds.size >= this.#maxQueue) return Promise.resolve({ status: "rejected", factIds: [] })
    this.#pendingIds.add(canonicalEvent.eventId)
    const pending: PendingCapture = { event: canonicalEvent, signal }
    const work = this.#tail.then(async () => this.#reconcile(pending))
    this.#tail = work.then(() => undefined, () => undefined)
    return work.finally(() => this.#pendingIds.delete(canonicalEvent.eventId))
  }

  async #reconcile(pending: PendingCapture): Promise<MemoryWorkerResult> {
    if (pending.signal.aborted) return { status: "timeout", factIds: [] }
    const canonicalEvent = normalizeMemoryEvent(pending.event)
    const disposition = this.#systemOne.select(canonicalEvent)
    if (disposition === "omit") return { status: "omitted", factIds: [] }
    const providerEvent = disposition === "summary" ? this.#systemOne.summarize(canonicalEvent) : canonicalEvent
    try {
      const extraction = parseOllamaExtraction(await this.#extractor.extract(providerEvent, pending.signal))
      if (pending.signal.aborted) return { status: "timeout", factIds: [] }
      this.#ledger.recordSourceEvent({
        eventId: canonicalEvent.eventId,
        source: canonicalEvent.source,
        occurredAt: canonicalEvent.occurredAt,
        rawExcerpt: canonicalEvent.excerpt,
        sensitivity: canonicalEvent.sensitivity,
      })
      const factIds: string[] = []
      for (const [index, fact] of extraction.facts.entries()) {
        if (pending.signal.aborted) return { status: "timeout", factIds: [] }
        const candidateId = `${canonicalEvent.eventId}:candidate:${index}`
        const candidate = this.#ledger.recordCandidate({
          candidateId,
          sourceEventId: canonicalEvent.eventId,
          subject: fact.subject,
          predicate: fact.predicate,
          value: fact.value,
          sensitivity: fact.sensitivity,
          observedAt: canonicalEvent.occurredAt,
        })
        const factId = `${canonicalEvent.eventId}:fact:${index}`
        factIds.push(this.#ledger.acceptCandidate({ factId, candidateId: candidate.id, acceptedAt: canonicalEvent.occurredAt }).id)
      }
      return { status: "processed", factIds }
    } catch (error) {
      if (error instanceof MemoryProviderError && error.code === "timeout") return { status: "timeout", factIds: [] }
      return EMPTY_RESULT
    }
  }
}
