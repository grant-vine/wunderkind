import type { Database } from "bun:sqlite"
import { createVerifiedBackup } from "./backups.js"
import { MemoryLedgerError } from "./errors.js"
import { assertVersionOneSchema, assertVersionTwoSchema } from "./schema-validation.js"

export const LEDGER_SCHEMA_VERSION = 2

const SCHEMA = `
CREATE TABLE source_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  raw_excerpt TEXT,
  redacted_excerpt TEXT NOT NULL,
  raw_state TEXT NOT NULL CHECK(raw_state IN ('retained', 'expired')),
  raw_expires_at INTEGER NOT NULL,
  sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive'))
);
CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  source_event_id TEXT NOT NULL REFERENCES source_events(id),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')),
  observed_at INTEGER NOT NULL
);
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL UNIQUE REFERENCES candidates(id),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')),
  valid_from INTEGER NOT NULL,
  valid_to INTEGER,
  accepted_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE fact_sources (
  fact_id TEXT NOT NULL REFERENCES facts(id),
  source_event_id TEXT NOT NULL REFERENCES source_events(id),
  PRIMARY KEY(fact_id, source_event_id)
);
CREATE TABLE fact_tombstones (
  fact_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  deleted_at INTEGER NOT NULL
);
CREATE TABLE source_tombstones (
  source_event_id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);
CREATE TABLE markdown_views (
  name TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX candidates_source_event_idx ON candidates(source_event_id);
CREATE INDEX facts_active_subject_predicate_idx ON facts(subject, predicate) WHERE deleted_at IS NULL AND valid_to IS NULL;
CREATE VIEW active_fact_sources AS
SELECT facts.id AS fact_id, facts.subject, facts.predicate, facts.value, facts.sensitivity, source_events.source, source_events.id AS source_event_id
FROM facts
JOIN fact_sources ON fact_sources.fact_id = facts.id
JOIN source_events ON source_events.id = fact_sources.source_event_id
WHERE facts.deleted_at IS NULL AND facts.valid_to IS NULL;
`

const VERSION_ONE_TO_TWO = `
CREATE TABLE fact_tombstones (
  fact_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  deleted_at INTEGER NOT NULL
);
CREATE TABLE source_tombstones (
  source_event_id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);
`

export interface LedgerMigrationRequest {
  readonly database: Database
  readonly databasePath: string
  readonly backupDirectory: string
  readonly writable: boolean
  readonly at: number
}

function schemaVersion(database: Database): number {
  const row = database.prepare<{ readonly user_version: number }>("PRAGMA user_version").get()
  return row?.user_version ?? 0
}

export function migrateLedger(request: LedgerMigrationRequest): void {
  const currentVersion = schemaVersion(request.database)
  if (currentVersion > LEDGER_SCHEMA_VERSION || (!request.writable && currentVersion !== LEDGER_SCHEMA_VERSION)) {
    throw new MemoryLedgerError("schema_incompatible")
  }
  if (currentVersion === LEDGER_SCHEMA_VERSION) {
    assertVersionTwoSchema(request.database)
    return
  }
  let transactionOpen = false
  try {
    request.database.exec("PRAGMA wal_checkpoint(TRUNCATE);")
    request.database.exec("BEGIN EXCLUSIVE;")
    transactionOpen = true
    if (currentVersion === 0) {
      request.database.exec(`${SCHEMA}\nPRAGMA user_version = ${LEDGER_SCHEMA_VERSION};`)
      assertVersionTwoSchema(request.database)
      request.database.exec("COMMIT;")
      transactionOpen = false
      return
    }
    createVerifiedBackup({
      database: request.database,
      databasePath: request.databasePath,
      backupDirectory: request.backupDirectory,
      fromVersion: currentVersion,
      toVersion: LEDGER_SCHEMA_VERSION,
      at: request.at,
    })
    if (currentVersion === 1) {
      assertVersionOneSchema(request.database)
      const legacyRaw = request.database.prepare<{ readonly count: number }>("SELECT COUNT(*) AS count FROM source_events WHERE raw_excerpt IS NOT NULL").get()
      if ((legacyRaw?.count ?? 0) > 0) {
        throw new MemoryLedgerError("schema_incompatible")
      }
      request.database.exec(`${VERSION_ONE_TO_TWO}\nPRAGMA user_version = ${LEDGER_SCHEMA_VERSION};`)
      assertVersionTwoSchema(request.database)
      request.database.exec("COMMIT;")
      transactionOpen = false
      return
    }
    throw new MemoryLedgerError("schema_incompatible")
  } catch (error) {
    if (transactionOpen) {
      request.database.exec("ROLLBACK;")
    }
    if (error instanceof MemoryLedgerError) {
      throw error
    }
    throw new MemoryLedgerError("schema_incompatible")
  }
}
