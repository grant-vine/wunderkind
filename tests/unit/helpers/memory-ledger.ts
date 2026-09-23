import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Database } from "bun:sqlite"
import { MemoryLedger, MemoryLedgerError } from "../../../src/memory/index.js"

export const DAY_MS = 24 * 60 * 60 * 1000

export function makeProject(): string {
  return mkdtempSync(join(tmpdir(), "wk-memory-ledger-"))
}

export function removeProject(projectRoot: string): void {
  rmSync(projectRoot, { recursive: true, force: true })
}

export function createLedger(projectRoot: string, now: number): MemoryLedger {
  return new MemoryLedger({ projectRoot, now: () => now })
}

export function captureLedgerError(action: () => void): MemoryLedgerError | null {
  try {
    action()
    return null
  } catch (error) {
    return error instanceof MemoryLedgerError ? error : null
  }
}

export function recordCandidateAndAccept(ledger: MemoryLedger, eventId: string, acceptedAt: number): string {
  const candidate = ledger.recordCandidate({
    candidateId: `${eventId}-candidate`,
    sourceEventId: eventId,
    subject: "project",
    predicate: "database",
    value: "SQLite WAL ledger",
    sensitivity: "internal",
    observedAt: acceptedAt,
  })
  return ledger.acceptCandidate({ factId: `${eventId}-fact`, candidateId: candidate.id, acceptedAt }).id
}

export interface VersionOneLedgerOptions {
  readonly sourceColumnType?: string
  readonly candidateIdDefinition?: string
  readonly rawStateCheck?: string
}

export function createVersionOneLedger(databasePath: string, options: VersionOneLedgerOptions = {}): void {
  const sourceColumnType = options.sourceColumnType ?? "TEXT"
  const candidateIdDefinition = options.candidateIdDefinition ?? "TEXT NOT NULL UNIQUE REFERENCES candidates(id)"
  const rawStateCheck = options.rawStateCheck ?? "raw_state IN ('retained', 'expired')"
  const database = new Database(databasePath)
  try {
    database.exec(`
CREATE TABLE source_events (id TEXT PRIMARY KEY, source ${sourceColumnType} NOT NULL, occurred_at INTEGER NOT NULL, raw_excerpt TEXT, redacted_excerpt TEXT NOT NULL, raw_state TEXT NOT NULL CHECK(${rawStateCheck}), raw_expires_at INTEGER NOT NULL, sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')));
CREATE TABLE candidates (id TEXT PRIMARY KEY, source_event_id TEXT NOT NULL REFERENCES source_events(id), subject TEXT NOT NULL, predicate TEXT NOT NULL, value TEXT NOT NULL, sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')), observed_at INTEGER NOT NULL);
CREATE TABLE facts (id TEXT PRIMARY KEY, candidate_id ${candidateIdDefinition}, subject TEXT NOT NULL, predicate TEXT NOT NULL, value TEXT NOT NULL, sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')), valid_from INTEGER NOT NULL, valid_to INTEGER, accepted_at INTEGER NOT NULL, deleted_at INTEGER);
CREATE TABLE fact_sources (fact_id TEXT NOT NULL REFERENCES facts(id), source_event_id TEXT NOT NULL REFERENCES source_events(id), PRIMARY KEY(fact_id, source_event_id));
CREATE TABLE markdown_views (name TEXT PRIMARY KEY, markdown TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX candidates_source_event_idx ON candidates(source_event_id);
CREATE INDEX facts_active_subject_predicate_idx ON facts(subject, predicate) WHERE deleted_at IS NULL AND valid_to IS NULL;
CREATE VIEW active_fact_sources AS SELECT facts.id AS fact_id, facts.subject, facts.predicate, facts.value, facts.sensitivity, source_events.source, source_events.id AS source_event_id FROM facts JOIN fact_sources ON fact_sources.fact_id = facts.id JOIN source_events ON source_events.id = fact_sources.source_event_id WHERE facts.deleted_at IS NULL AND facts.valid_to IS NULL;
PRAGMA user_version = 1;
`)
  } finally {
    database.close()
  }
}
