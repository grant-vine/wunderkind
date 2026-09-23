import { describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { MemoryLedger } from "../../src/memory/index.js"
import { createAutomaticCaptureAdapter } from "../../src/memory/capture-adapter.js"
import {
  createOllamaExtractor,
  createSystemOnePolicy,
  normalizeMemoryEvent,
  type MemoryExtractor,
  type NormalizedMemoryEvent,
} from "../../src/memory/providers.js"
import { MemoryWorker } from "../../src/memory/worker.js"

function projectRoot(): string {
  return mkdtempSync(join(tmpdir(), "wk-memory-providers-"))
}

function event(id = "event-1"): NormalizedMemoryEvent {
  return normalizeMemoryEvent({
    eventId: id,
    source: "chat",
    occurredAt: 1_700_000_000_000,
    excerpt: "api_key=must-not-reach-provider Project uses SQLite.",
    sensitivity: "internal",
  })
}

function successExtractor(onInput?: (input: NormalizedMemoryEvent) => void): MemoryExtractor {
  return {
    async extract(input) {
      onInput?.(input)
      return {
        facts: [{ subject: "project", predicate: "database", value: "SQLite", sensitivity: "internal" }],
      }
    },
  }
}

describe("memory provider boundary", () => {
  it("redacts before a provider receives a normalized immutable event and persists only validated facts", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root, now: () => 1_700_000_000_000 })
    const providerInputs: NormalizedMemoryEvent[] = []
    const worker = new MemoryWorker({ ledger, extractor: successExtractor((input) => { providerInputs.push(input) }), maxQueue: 2 })

    try {
      const result = await worker.enqueue(event())

      expect(result.status).toBe("processed")
      expect(providerInputs[0]?.excerpt).toContain("[REDACTED]")
      expect(providerInputs[0]?.excerpt).not.toContain("must-not-reach-provider")
      expect(Object.isFrozen(providerInputs[0])).toBe(true)
      expect(ledger.listActiveFacts()).toHaveLength(1)
      expect(ledger.readMarkdownView()).not.toContain("must-not-reach-provider")
    } finally {
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("redacts a forged normalized event again at the worker-to-provider boundary", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const providerInputs: NormalizedMemoryEvent[] = []
    const forged: NormalizedMemoryEvent = {
      eventId: "forged-event",
      source: "chat",
      occurredAt: 1_700_000_000_000,
      excerpt: "token=forged-secret must be redacted again",
      sensitivity: "internal",
    }
    const worker = new MemoryWorker({ ledger, extractor: successExtractor((input) => { providerInputs.push(input) }), maxQueue: 2 })

    try {
      await worker.enqueue(forged)

      expect(providerInputs[0]?.excerpt).toContain("[REDACTED]")
      expect(providerInputs[0]?.excerpt).not.toContain("forged-secret")
    } finally {
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects malformed provider facts without creating an event", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const worker = new MemoryWorker({
      ledger,
      extractor: { async extract() { return { facts: [{ subject: "project", predicate: "database", value: 7 }] } } },
      maxQueue: 2,
    })

    try {
      const result = await worker.enqueue(event())

      expect(result.status).toBe("failed")
      expect(ledger.getCounts().sourceEvents).toBe(0)
    } finally {
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("times out a provider request and leaves no persistent event", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const extractor = createOllamaExtractor({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3",
      timeoutMs: 100,
      maxResponseBytes: 1024,
      request: async (_request) => new Promise(() => undefined),
    })
    const worker = new MemoryWorker({ ledger, extractor, maxQueue: 2 })

    try {
      const result = await worker.enqueue(event())

      expect(result.status).toBe("timeout")
      expect(ledger.getCounts().sourceEvents).toBe(0)
    } finally {
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("sends only the redacted event in a schema-constrained loopback Ollama request", async () => {
    let body = ""
    const extractor = createOllamaExtractor({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3",
      timeoutMs: 100,
      maxResponseBytes: 1024,
      async request(input) {
        body = input.body
        return {
          status: 200,
          body: JSON.stringify({ response: JSON.stringify({ facts: [{ subject: "project", predicate: "database", value: "SQLite", sensitivity: "internal" }] }) }),
        }
      },
    })

    const extraction = await extractor.extract(event("request-secret=must-not-leak"), new AbortController().signal)

    expect(body).toContain("\"stream\":false")
    expect(body).toContain("[REDACTED]")
    expect(body).not.toContain("must-not-leak")
    expect(extraction).toEqual({ facts: [{ subject: "project", predicate: "database", value: "SQLite", sensitivity: "internal" }] })
  })

  it("serializes reconciliation and deduplicates a queued event", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    let active = 0
    let peak = 0
    let release: (value: void | PromiseLike<void>) => void = () => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const worker = new MemoryWorker({
      ledger,
      maxQueue: 3,
      extractor: {
        async extract() {
          active += 1
          peak = Math.max(peak, active)
          await gate
          active -= 1
          return { facts: [{ subject: "project", predicate: "database", value: "SQLite", sensitivity: "internal" }] }
        },
      },
    })

    try {
      const first = worker.enqueue(event("event-serial-1"))
      const duplicate = worker.enqueue(event("event-serial-1"))
      const second = worker.enqueue(event("event-serial-2"))
      release()
      const results = await Promise.all([first, duplicate, second])

      expect(results.map((result) => result.status)).toEqual(["processed", "duplicate", "processed"])
      expect(peak).toBe(1)
      expect(ledger.getCounts().sourceEvents).toBe(2)
    } finally {
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("uses the deterministic System One baseline and keeps experimental adapters disabled", () => {
    const policy = createSystemOnePolicy()

    expect(policy.select(event("public-event"))).toBe("full")
    expect(policy.select(normalizeMemoryEvent({ eventId: "sensitive-event", source: "chat", occurredAt: 1, excerpt: "private", sensitivity: "sensitive" }))).toBe("omit")
    expect(policy.experimental).toEqual([{ name: "jev", enabled: false }, { name: "kev", enabled: false }])
  })

  it("summarizes and redacts an oversized event before provider extraction", async () => {
    const root = projectRoot()
    const ledger = new MemoryLedger({ projectRoot: root })
    const providerInputs: NormalizedMemoryEvent[] = []
    const oversized = normalizeMemoryEvent({
      eventId: "summary-event",
      source: "chat",
      occurredAt: 1_700_000_000_000,
      excerpt: `api_key=summary-secret ${"x".repeat(80)}`,
      sensitivity: "internal",
    })
    const worker = new MemoryWorker({
      ledger,
      extractor: successExtractor((input) => { providerInputs.push(input) }),
      maxQueue: 2,
      systemOne: createSystemOnePolicy(20),
    })

    try {
      const result = await worker.enqueue(oversized)
      const providerInput = providerInputs[0]

      expect(result.status).toBe("processed")
      expect(providerInput === undefined).toBe(false)
      if (providerInput === undefined) throw new Error("provider input missing")
      expect(providerInput.excerpt.length < oversized.excerpt.length).toBe(true)
      expect(providerInput.excerpt).not.toContain("summary-secret")
    } finally {
      ledger.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("only permits automatic capture for the declared host hook and preserves host output exactly", async () => {
    let enqueues = 0
    const output = { parts: ["unchanged"] }
    const disabled = createAutomaticCaptureAdapter({
      enabled: true,
      declaredHook: "chat.params",
      socketPath: "/unused.sock",
      enqueueTimeoutMs: 10,
      enqueue: async () => {
        enqueues += 1
        return { status: "processed", factIds: [] }
      },
    })
    const enabled = createAutomaticCaptureAdapter({
      enabled: true,
      declaredHook: "chat.message",
      socketPath: "/unused.sock",
      enqueueTimeoutMs: 10,
      enqueue: async () => {
        enqueues += 1
        return { status: "processed", factIds: [] }
      },
    })

    const disabledOutcome = await disabled.capture(event("disabled-hook"), output)
    const enabledOutcome = await enabled.capture(event("enabled-hook"), output)

    expect(disabledOutcome.output).toBe(output)
    expect(disabledOutcome.result.status).toBe("rejected")
    expect(enabledOutcome.output).toBe(output)
    expect(enabledOutcome.result.status).toBe("processed")
    expect(enqueues).toBe(1)
  })

  it("preserves host output when automatic normalization or enqueue fails", async () => {
    const output = { parts: ["unchanged"] }
    const adapter = createAutomaticCaptureAdapter({
      enabled: true,
      declaredHook: "chat.message",
      socketPath: "/unused.sock",
      enqueueTimeoutMs: 10,
      enqueue: async () => { throw new Error("unavailable") },
    })

    const normalizationFailure = await adapter.capture({ eventId: "invalid", source: "chat", occurredAt: 1, excerpt: " ", sensitivity: "internal" }, output)
    const enqueueFailure = await adapter.capture({ eventId: "enqueue", source: "chat", occurredAt: 1, excerpt: "valid", sensitivity: "internal" }, output)

    expect(normalizationFailure.output).toBe(output)
    expect(normalizationFailure.result.status).toBe("unavailable")
    expect(enqueueFailure.output).toBe(output)
    expect(enqueueFailure.result.status).toBe("unavailable")
  })
})
