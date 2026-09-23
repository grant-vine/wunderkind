import type { Database } from "bun:sqlite"
import { MemoryLedgerError } from "./errors.js"

const VERSION_ONE_TABLES = {
  source_events: ["id", "source", "occurred_at", "raw_excerpt", "redacted_excerpt", "raw_state", "raw_expires_at", "sensitivity"],
  candidates: ["id", "source_event_id", "subject", "predicate", "value", "sensitivity", "observed_at"],
  facts: ["id", "candidate_id", "subject", "predicate", "value", "sensitivity", "valid_from", "valid_to", "accepted_at", "deleted_at"],
  fact_sources: ["fact_id", "source_event_id"],
  markdown_views: ["name", "markdown", "updated_at"],
} as const

const VERSION_TWO_TABLES = {
  ...VERSION_ONE_TABLES,
  fact_tombstones: ["fact_id", "fingerprint", "deleted_at"],
  source_tombstones: ["source_event_id", "deleted_at"],
} as const

const REQUIRED_INDEXES = ["candidates_source_event_idx", "facts_active_subject_predicate_idx"] as const
const REQUIRED_VIEWS = ["active_fact_sources"] as const
const REQUIRED_COLUMN_TYPES = {
  source_events: ["TEXT", "TEXT", "INTEGER", "TEXT", "TEXT", "TEXT", "INTEGER", "TEXT"],
  candidates: ["TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "INTEGER"],
  facts: ["TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "INTEGER", "INTEGER", "INTEGER", "INTEGER"],
  fact_sources: ["TEXT", "TEXT"],
  fact_tombstones: ["TEXT", "TEXT", "INTEGER"],
  source_tombstones: ["TEXT", "INTEGER"],
  markdown_views: ["TEXT", "TEXT", "INTEGER"],
} as const
const VERSION_ONE_DEFINITIONS = {
  tables: {
    source_events: "CREATE TABLE source_events (id TEXT PRIMARY KEY, source TEXT NOT NULL, occurred_at INTEGER NOT NULL, raw_excerpt TEXT, redacted_excerpt TEXT NOT NULL, raw_state TEXT NOT NULL CHECK(raw_state IN ('retained', 'expired')), raw_expires_at INTEGER NOT NULL, sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')))",
    candidates: "CREATE TABLE candidates (id TEXT PRIMARY KEY, source_event_id TEXT NOT NULL REFERENCES source_events(id), subject TEXT NOT NULL, predicate TEXT NOT NULL, value TEXT NOT NULL, sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')), observed_at INTEGER NOT NULL)",
    facts: "CREATE TABLE facts (id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL UNIQUE REFERENCES candidates(id), subject TEXT NOT NULL, predicate TEXT NOT NULL, value TEXT NOT NULL, sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public', 'internal', 'sensitive')), valid_from INTEGER NOT NULL, valid_to INTEGER, accepted_at INTEGER NOT NULL, deleted_at INTEGER)",
    fact_sources: "CREATE TABLE fact_sources (fact_id TEXT NOT NULL REFERENCES facts(id), source_event_id TEXT NOT NULL REFERENCES source_events(id), PRIMARY KEY(fact_id, source_event_id))",
    markdown_views: "CREATE TABLE markdown_views (name TEXT PRIMARY KEY, markdown TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  },
  indexes: {
    candidates_source_event_idx: "CREATE INDEX candidates_source_event_idx ON candidates(source_event_id)",
    facts_active_subject_predicate_idx: "CREATE INDEX facts_active_subject_predicate_idx ON facts(subject, predicate) WHERE deleted_at IS NULL AND valid_to IS NULL",
  },
  views: {
    active_fact_sources: "CREATE VIEW active_fact_sources AS SELECT facts.id AS fact_id, facts.subject, facts.predicate, facts.value, facts.sensitivity, source_events.source, source_events.id AS source_event_id FROM facts JOIN fact_sources ON fact_sources.fact_id = facts.id JOIN source_events ON source_events.id = fact_sources.source_event_id WHERE facts.deleted_at IS NULL AND facts.valid_to IS NULL",
  },
} as const
const VERSION_TWO_DEFINITIONS = {
  ...VERSION_ONE_DEFINITIONS,
  tables: {
    ...VERSION_ONE_DEFINITIONS.tables,
    fact_tombstones: "CREATE TABLE fact_tombstones (fact_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, deleted_at INTEGER NOT NULL)",
    source_tombstones: "CREATE TABLE source_tombstones (source_event_id TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL)",
  },
} as const

function names(database: Database, type: "table" | "index" | "view"): readonly string[] {
  const rows = database.prepare<{ readonly name: string }, { readonly $type: string }>(
    "SELECT name FROM sqlite_master WHERE type = $type AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
  ).all({ $type: type })
  return rows.map((row) => row.name)
}

function columns(database: Database, table: string): readonly { readonly name: string; readonly type: string }[] {
  return database.prepare<{ readonly name: string; readonly type: string }>(`PRAGMA table_info(${table})`).all()
}

function exactNames(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((name, index) => name === expected[index])
}

function canonicalSql(sql: string): string {
  return sql.toLocaleLowerCase().replace(/\s+/gu, " ").replace(/\s*([(),=])\s*/gu, "$1").replace(/;$/u, "").trim()
}

function assertDefinitions(database: Database, definitions: Readonly<Record<"tables" | "indexes" | "views", Readonly<Record<string, string>>>>): void {
  const types = { tables: "table", indexes: "index", views: "view" } as const
  for (const key of ["tables", "indexes", "views"] as const) {
    for (const [name, expectedSql] of Object.entries(definitions[key])) {
      const actual = database.prepare<{ readonly sql: string | null }, { readonly $name: string; readonly $type: string }>(
        "SELECT sql FROM sqlite_master WHERE name = $name AND type = $type",
      ).get({ $name: name, $type: types[key] })
      if (actual?.sql === null || actual?.sql === undefined || canonicalSql(actual.sql) !== canonicalSql(expectedSql)) {
        throw new MemoryLedgerError("schema_incompatible")
      }
    }
  }
}

function assertExpectedTables(database: Database, expected: Readonly<Record<string, readonly string[]>>): void {
  const tableNames = Object.keys(expected).sort()
  if (!exactNames(names(database, "table"), tableNames)) {
    throw new MemoryLedgerError("schema_incompatible")
  }
  for (const [table, expectedColumns] of Object.entries(expected)) {
    const actualColumns = columns(database, table)
    const expectedTypes = REQUIRED_COLUMN_TYPES[table as keyof typeof REQUIRED_COLUMN_TYPES]
    if (!exactNames(actualColumns.map((column) => column.name), expectedColumns) || !exactNames(actualColumns.map((column) => column.type.toLocaleUpperCase()), expectedTypes)) {
      throw new MemoryLedgerError("schema_incompatible")
    }
  }
}

export function assertVersionOneSchema(database: Database): void {
  assertExpectedTables(database, VERSION_ONE_TABLES)
  if (!exactNames(names(database, "index"), [...REQUIRED_INDEXES].sort()) || !exactNames(names(database, "view"), REQUIRED_VIEWS)) {
    throw new MemoryLedgerError("schema_incompatible")
  }
  assertDefinitions(database, VERSION_ONE_DEFINITIONS)
}

export function assertVersionTwoSchema(database: Database): void {
  assertExpectedTables(database, VERSION_TWO_TABLES)
  if (!exactNames(names(database, "index"), [...REQUIRED_INDEXES].sort()) || !exactNames(names(database, "view"), REQUIRED_VIEWS)) {
    throw new MemoryLedgerError("schema_incompatible")
  }
  assertDefinitions(database, VERSION_TWO_DEFINITIONS)
}
