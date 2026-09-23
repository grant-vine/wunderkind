import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { captureLedgerError, createLedger, makeProject, removeProject } from "./helpers/memory-ledger.js"

describe("MemoryLedger deterministic relevance query", () => {
  it("returns matching active facts in stable order with provenance and sensitivity filtering", () => {
    const projectRoot = makeProject()
    const ledger = createLedger(projectRoot, 1_700_000_000_000)

    try {
      ledger.recordSourceEvent({ eventId: "query-public", source: "chat", occurredAt: 1_700_000_000_000, rawExcerpt: "Project uses Postgres.", sensitivity: "public" })
      const publicCandidate = ledger.recordCandidate({ candidateId: "query-public-candidate", sourceEventId: "query-public", subject: "project", predicate: "database", value: "Postgres", sensitivity: "public", observedAt: 1_700_000_000_000 })
      ledger.acceptCandidate({ factId: "query-public-fact", candidateId: publicCandidate.id, acceptedAt: 1_700_000_000_000 })

      ledger.recordSourceEvent({ eventId: "query-internal", source: "chat", occurredAt: 1_700_000_000_100, rawExcerpt: "Operations maintain Postgres.", sensitivity: "internal" })
      const internalCandidate = ledger.recordCandidate({ candidateId: "query-internal-candidate", sourceEventId: "query-internal", subject: "operations", predicate: "database", value: "Postgres", sensitivity: "internal", observedAt: 1_700_000_000_100 })
      ledger.acceptCandidate({ factId: "query-internal-fact", candidateId: internalCandidate.id, acceptedAt: 1_700_000_000_100 })
      ledger.recordSourceEvent({ eventId: "query-internal-extra", source: "chat", occurredAt: 1_700_000_000_101, rawExcerpt: "Extra provenance.", sensitivity: "internal" })
      const direct = new Database(ledger.databasePath)
      direct.prepare("INSERT INTO fact_sources (fact_id, source_event_id) VALUES ($factId, $sourceEventId)").run({ $factId: "query-internal-fact", $sourceEventId: "query-internal-extra" })
      direct.close()

      ledger.recordSourceEvent({ eventId: "query-deleted", source: "chat", occurredAt: 1_700_000_000_200, rawExcerpt: "Legacy Postgres reference.", sensitivity: "public" })
      const deletedCandidate = ledger.recordCandidate({ candidateId: "query-deleted-candidate", sourceEventId: "query-deleted", subject: "legacy", predicate: "database", value: "Postgres", sensitivity: "public", observedAt: 1_700_000_000_200 })
      const deletedFact = ledger.acceptCandidate({ factId: "query-deleted-fact", candidateId: deletedCandidate.id, acceptedAt: 1_700_000_000_200 })
      ledger.forgetFact(deletedFact.id, 1_700_000_000_300)

      const publicResults = ledger.findRelevantFacts({ query: "postgres", sensitivity: "public", maxResults: 2 })
      const allResults = ledger.findRelevantFacts({ query: "postgres", maxResults: 3 })
      const literalResults = ledger.findRelevantFacts({ query: "post_gres", maxResults: 3 })

      expect(publicResults).toEqual([{ fact: ledger.getFact("query-public-fact"), sourceEventIds: ["query-public"] }])
      expect(allResults.map((result) => result.fact.id)).toEqual(["query-internal-fact", "query-public-fact"])
      expect(allResults[0]?.sourceEventIds).toEqual(["query-internal", "query-internal-extra"])
      expect(allResults.flatMap((result) => result.sourceEventIds)).not.toContain("query-deleted")
      expect(literalResults).toEqual([])
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })

  it("rejects an invalid relevance-query result limit before reading facts", () => {
    const projectRoot = makeProject()
    const ledger = createLedger(projectRoot, 1_700_000_000_000)

    try {
      const failure = captureLedgerError(() => ledger.findRelevantFacts({ query: "postgres", maxResults: 0 }))

      expect(failure?.code).toBe("validation")
    } finally {
      ledger.close()
      removeProject(projectRoot)
    }
  })
})
