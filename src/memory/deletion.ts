import type { Database } from "bun:sqlite"
import { MemoryLedgerError } from "./errors.js"
import type { Candidate } from "./types.js"

interface FactForDeletion {
  readonly id: string
  readonly candidate_id: string
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: string
}

function fingerprint(candidate: Candidate): string {
  return [candidate.subject, candidate.predicate, candidate.value, candidate.sensitivity].join("\u001f")
}

function factFingerprint(fact: FactForDeletion): string {
  return [fact.subject, fact.predicate, fact.value, fact.sensitivity].join("\u001f")
}

function recordFactTombstone(database: Database, fact: FactForDeletion, deletedAt: number): void {
  database.prepare(
    "INSERT INTO fact_tombstones (fact_id, fingerprint, deleted_at) VALUES ($factId, $fingerprint, $deletedAt) ON CONFLICT DO NOTHING",
  ).run({ $factId: fact.id, $fingerprint: factFingerprint(fact), $deletedAt: deletedAt })
}

export function ensureCandidateCanBecomeFact(database: Database, candidate: Candidate, factId: string): void {
  const row = database.prepare<{ readonly fact_id: string }, { readonly $factId: string; readonly $fingerprint: string }>(
    "SELECT fact_id FROM fact_tombstones WHERE fact_id = $factId OR fingerprint = $fingerprint LIMIT 1",
  ).get({ $factId: factId, $fingerprint: fingerprint(candidate) })
  if (row) {
    throw new MemoryLedgerError("tombstoned")
  }
}

export function ensureSourceCanBeRecorded(database: Database, sourceEventId: string): void {
  const row = database.prepare<{ readonly source_event_id: string }, { readonly $sourceEventId: string }>(
    "SELECT source_event_id FROM source_tombstones WHERE source_event_id = $sourceEventId",
  ).get({ $sourceEventId: sourceEventId })
  if (row) {
    throw new MemoryLedgerError("tombstoned")
  }
}

export function forgetFactWithTombstone(database: Database, factId: string, deletedAt: number): void {
  const fact = database.prepare<FactForDeletion, { readonly $factId: string }>(
    "SELECT id, candidate_id, subject, predicate, value, sensitivity FROM facts WHERE id = $factId",
  ).get({ $factId: factId })
  if (!fact) {
    throw new MemoryLedgerError("validation")
  }
  database.exec("BEGIN IMMEDIATE;")
  try {
    recordFactTombstone(database, fact, deletedAt)
    database.prepare("DELETE FROM fact_sources WHERE fact_id = $factId").run({ $factId: fact.id })
    database.prepare("DELETE FROM facts WHERE id = $factId").run({ $factId: fact.id })
    database.prepare("DELETE FROM candidates WHERE id = $candidateId").run({ $candidateId: fact.candidate_id })
    database.exec("COMMIT;")
  } catch (error) {
    database.exec("ROLLBACK;")
    throw error
  }
}

export function forgetSourceWithTombstone(database: Database, sourceEventId: string, deletedAt: number): void {
  const facts = database.prepare<FactForDeletion, { readonly $sourceEventId: string }>(
    "SELECT facts.id, facts.candidate_id, facts.subject, facts.predicate, facts.value, facts.sensitivity FROM facts JOIN candidates ON candidates.id = facts.candidate_id WHERE candidates.source_event_id = $sourceEventId",
  ).all({ $sourceEventId: sourceEventId })
  database.exec("BEGIN IMMEDIATE;")
  try {
    database.prepare(
      "INSERT INTO source_tombstones (source_event_id, deleted_at) VALUES ($sourceEventId, $deletedAt) ON CONFLICT(source_event_id) DO NOTHING",
    ).run({ $sourceEventId: sourceEventId, $deletedAt: deletedAt })
    for (const fact of facts) {
      recordFactTombstone(database, fact, deletedAt)
      database.prepare("DELETE FROM fact_sources WHERE fact_id = $factId").run({ $factId: fact.id })
      database.prepare("DELETE FROM facts WHERE id = $factId").run({ $factId: fact.id })
    }
    database.prepare("DELETE FROM candidates WHERE source_event_id = $sourceEventId").run({ $sourceEventId: sourceEventId })
    database.prepare("DELETE FROM source_events WHERE id = $sourceEventId").run({ $sourceEventId: sourceEventId })
    database.exec("COMMIT;")
  } catch (error) {
    database.exec("ROLLBACK;")
    throw error
  }
}
