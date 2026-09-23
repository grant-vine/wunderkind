import { describe, expect, it } from "bun:test"
import { symlinkSync } from "node:fs"
import { join } from "node:path"
import { DAY_MS, captureLedgerError, createLedger, makeProject, recordCandidateAndAccept, removeProject } from "./helpers/memory-ledger.js"

describe("MemoryLedger", () => {
  it("persists an idempotent redacted event and fact across a restart with WAL and foreign keys", () => {
    const projectRoot = makeProject()
    const capturedAt = 1_700_000_000_000
    const first = createLedger(projectRoot, capturedAt)

    try {
      const firstWrite = first.recordSourceEvent({
        eventId: "event-1",
        source: "chat",
        occurredAt: capturedAt,
        rawExcerpt: "api_key=super-secret-value Project uses SQLite.",
        sensitivity: "internal",
      })
      const repeatedWrite = first.recordSourceEvent({
        eventId: "event-1",
        source: "chat",
        occurredAt: capturedAt,
        rawExcerpt: "api_key=super-secret-value Project uses SQLite.",
        sensitivity: "internal",
      })
      const factId = recordCandidateAndAccept(first, "event-1", capturedAt)
      const initialDiagnostics = first.diagnostics()
      first.close()

      const reopened = createLedger(projectRoot, capturedAt)
      try {
        const event = reopened.getSourceEvent("event-1")
        const fact = reopened.getFact(factId)

        expect(firstWrite.inserted).toBe(true)
        expect(repeatedWrite.inserted).toBe(false)
        expect(initialDiagnostics.journalMode).toBe("wal")
        expect(initialDiagnostics.foreignKeys).toBe(true)
        expect(event?.rawExcerpt).toBe(null)
        expect(event?.redactedExcerpt).toContain("[REDACTED]")
        expect(fact?.value).toBe("SQLite WAL ledger")
        expect(reopened.getCounts()).toEqual({ sourceEvents: 1, candidates: 1, facts: 1, activeFacts: 1 })
      } finally {
        reopened.close()
      }
    } finally {
      removeProject(projectRoot)
    }
  })

  it("supersedes a temporal fact and never resurrects an explicitly forgotten fact", () => {
    const projectRoot = makeProject()
    const earlier = 1_700_000_000_000
    const later = earlier + DAY_MS
    const ledger = createLedger(projectRoot, later)

    try {
      ledger.recordSourceEvent({ eventId: "event-earlier", source: "chat", occurredAt: earlier, rawExcerpt: "The database is SQLite.", sensitivity: "internal" })
      const firstFactId = recordCandidateAndAccept(ledger, "event-earlier", earlier)
      ledger.recordSourceEvent({ eventId: "event-later", source: "chat", occurredAt: later, rawExcerpt: "The database is Postgres.", sensitivity: "internal" })
      const secondCandidate = ledger.recordCandidate({
        candidateId: "event-later-candidate",
        sourceEventId: "event-later",
        subject: "project",
        predicate: "database",
        value: "Postgres",
        sensitivity: "internal",
        observedAt: later,
      })
      const secondFact = ledger.acceptCandidate({ factId: "event-later-fact", candidateId: secondCandidate.id, acceptedAt: later })
      ledger.forgetFact(secondFact.id, later + 1)

      expect(ledger.getFact(firstFactId)?.validTo).toBe(later)
      expect(ledger.getFact(secondFact.id)).toBe(null)
      expect(ledger.listActiveFacts()).toEqual([])
      expect(ledger.getCounts().activeFacts).toBe(0)
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("creates permanent fact and source tombstones that prevent rebuild resurrection", () => {
    const projectRoot = makeProject()
    const capturedAt = 1_700_000_000_000
    const ledger = createLedger(projectRoot, capturedAt)

    try {
      ledger.recordSourceEvent({ eventId: "event-forget", source: "chat", occurredAt: capturedAt, rawExcerpt: "The database is SQLite.", sensitivity: "internal" })
      const factId = recordCandidateAndAccept(ledger, "event-forget", capturedAt)
      ledger.forgetFact(factId, capturedAt + 1)

      const rebuiltCandidate = ledger.recordCandidate({
        candidateId: "event-forget-rebuilt-candidate",
        sourceEventId: "event-forget",
        subject: "project",
        predicate: "database",
        value: "SQLite WAL ledger",
        sensitivity: "internal",
        observedAt: capturedAt + 2,
      })
      const rebuiltFailure = captureLedgerError(() => ledger.acceptCandidate({ factId: "event-forget-rebuilt-fact", candidateId: rebuiltCandidate.id, acceptedAt: capturedAt + 2 }))

      ledger.forgetSource("event-forget", capturedAt + 3)
      const sourceFailure = captureLedgerError(() => ledger.recordSourceEvent({ eventId: "event-forget", source: "chat", occurredAt: capturedAt + 4, rawExcerpt: "Rebuild source.", sensitivity: "internal" }))

      expect(rebuiltFailure?.code).toBe("tombstoned")
      expect(sourceFailure?.code).toBe("tombstoned")
      expect(ledger.getFact(factId)).toBe(null)
      expect(ledger.readMarkdownView()).not.toContain("SQLite WAL ledger")
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("expires raw excerpts at the exact 30-day boundary while keeping accepted facts until explicit deletion", () => {
    const projectRoot = makeProject()
    const capturedAt = 1_700_000_000_000
    const ledger = createLedger(projectRoot, capturedAt)

    try {
      ledger.recordSourceEvent({ eventId: "event-expiring", source: "chat", occurredAt: capturedAt, rawExcerpt: "Retain this only briefly.", sensitivity: "internal" })
      const factId = recordCandidateAndAccept(ledger, "event-expiring", capturedAt)
      const expired = ledger.expireRawExcerpts(capturedAt + 30 * DAY_MS)

      expect(expired).toBe(1)
      expect(ledger.getSourceEvent("event-expiring")?.rawState).toBe("expired")
      expect(ledger.getSourceEvent("event-expiring")?.rawExcerpt).toBe(null)
      expect(ledger.getFact(factId)?.deletedAt).toBe(null)
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("materializes a read-only Markdown view with fact source attribution and no raw excerpt", () => {
    const projectRoot = makeProject()
    const capturedAt = 1_700_000_000_000
    const ledger = createLedger(projectRoot, capturedAt)

    try {
      ledger.recordSourceEvent({ eventId: "event-view", source: "chat", occurredAt: capturedAt, rawExcerpt: "api_key=do-not-render Source attribution.", sensitivity: "internal" })
      recordCandidateAndAccept(ledger, "event-view", capturedAt)
      const markdown = ledger.readMarkdownView()

      expect(markdown).toContain("SQLite WAL ledger")
      expect(markdown).toContain("source: chat/event-view")
      expect(markdown).not.toContain("do-not-render")
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("redacts candidate and fact values before they reach the ledger or materialized view", () => {
    const projectRoot = makeProject()
    const capturedAt = 1_700_000_000_000
    const ledger = createLedger(projectRoot, capturedAt)

    try {
      const sourceEventId = "event-api_key=identifier-secret"
      const sourceEvent = ledger.recordSourceEvent({ eventId: sourceEventId, source: "chat", occurredAt: capturedAt, rawExcerpt: "Candidate follows.", sensitivity: "internal" })
      const candidate = ledger.recordCandidate({
        candidateId: "candidate-token=identifier-secret",
        sourceEventId,
        subject: "project",
        predicate: "credential",
        value: "api_key=must-not-persist",
        sensitivity: "sensitive",
        observedAt: capturedAt,
      })
      const fact = ledger.acceptCandidate({ factId: "fact-token=identifier-secret", candidateId: candidate.id, acceptedAt: capturedAt })

      expect(sourceEvent.id).not.toContain("identifier-secret")
      expect(candidate.id).not.toContain("identifier-secret")
      expect(fact.id).not.toContain("identifier-secret")
      expect(fact.value).not.toContain("must-not-persist")
      expect(ledger.readMarkdownView()).not.toContain("must-not-persist")
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("redacts connection credentials before event, fact, and view persistence", () => {
    const projectRoot = makeProject()
    const capturedAt = 1_700_000_000_000
    const ledger = createLedger(projectRoot, capturedAt)

    try {
      ledger.recordSourceEvent({ eventId: "connection-event", source: "chat", occurredAt: capturedAt, rawExcerpt: "DATABASE_URL=postgres://alice:connection-secret@db.example/app", sensitivity: "sensitive" })
      const candidate = ledger.recordCandidate({
        candidateId: "connection-candidate",
        sourceEventId: "connection-event",
        subject: "project",
        predicate: "database",
        value: "postgres://alice:fact-secret@db.example/app",
        sensitivity: "sensitive",
        observedAt: capturedAt,
      })
      const fact = ledger.acceptCandidate({ factId: "connection-fact", candidateId: candidate.id, acceptedAt: capturedAt })
      const event = ledger.getSourceEvent("connection-event")

      expect(event?.redactedExcerpt).not.toContain("connection-secret")
      expect(fact.value).not.toContain("fact-secret")
      expect(ledger.readMarkdownView()).not.toContain("fact-secret")
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("rejects an escaping .wunderkind symlink before opening a database", () => {
    const projectRoot = makeProject()
    const external = makeProject()
    symlinkSync(external, join(projectRoot, ".wunderkind"), "dir")

    try {
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("containment")
    } finally {
      removeProject(projectRoot)
      removeProject(external)
    }
  })

  it("rejects malformed event input without inserting a source event", () => {
    const projectRoot = makeProject()
    const ledger = createLedger(projectRoot, 1_700_000_000_000)

    try {
      const failure = captureLedgerError(() => ledger.recordSourceEvent({ eventId: " ", source: "chat", occurredAt: 1_700_000_000_000, rawExcerpt: "valid excerpt", sensitivity: "internal" }))

      expect(failure?.code).toBe("validation")
      expect(ledger.getCounts().sourceEvents).toBe(0)
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

})
