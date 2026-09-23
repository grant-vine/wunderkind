import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { captureLedgerError, createLedger, createVersionOneLedger, makeProject, removeProject } from "./helpers/memory-ledger.js"

function schemaSql(databasePath: string, type: "index" | "view", name: string): string | null {
  const database = new Database(databasePath, { readonly: true })
  try {
    return database.prepare<{ readonly sql: string | null }, { readonly $name: string; readonly $type: string }>(
      "SELECT sql FROM sqlite_master WHERE type = $type AND name = $name",
    ).get({ $name: name, $type: type })?.sql ?? null
  } finally {
    database.close()
  }
}

describe("MemoryLedger definition-level schema guard", () => {
  it("backs up and preserves a v1 database with matching names but incorrect constraints", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const databasePath = join(databaseDir, "memory.sqlite")
    mkdirSync(databaseDir)
    createVersionOneLedger(databasePath, {
      candidateIdDefinition: "TEXT NOT NULL REFERENCES candidates(id)",
      rawStateCheck: "raw_state IN ('retained')",
    })

    try {
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("schema_incompatible")
      expect(existsSync(join(databaseDir, "memory-backups"))).toBe(true)
      expect(readdirSync(join(databaseDir, "memory-backups")).some((name) => /^1-to-2-.*\.sqlite$/u.test(name))).toBe(true)
      const preserved = new Database(databasePath, { readonly: true })
      try {
        expect(preserved.prepare<{ readonly user_version: number }>("PRAGMA user_version").get()?.user_version).toBe(1)
      } finally {
        preserved.close()
      }
    } finally {
      removeProject(projectRoot)
    }
  })

  it("rejects v2 partial-index predicate drift without rewriting the original database", () => {
    const projectRoot = makeProject()
    const ledger = createLedger(projectRoot, 1_700_000_000_000)
    const databasePath = ledger.databasePath
    ledger.close()
    const database = new Database(databasePath)
    database.exec("DROP INDEX facts_active_subject_predicate_idx; CREATE INDEX facts_active_subject_predicate_idx ON facts(subject, predicate) WHERE valid_to IS NULL;")
    database.close()

    try {
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("schema_incompatible")
      expect(schemaSql(databasePath, "index", "facts_active_subject_predicate_idx")).toContain("WHERE valid_to IS NULL")
    } finally {
      removeProject(projectRoot)
    }
  })

  it("rejects v2 canonical-view drift without rewriting the original database", () => {
    const projectRoot = makeProject()
    const ledger = createLedger(projectRoot, 1_700_000_000_000)
    const databasePath = ledger.databasePath
    ledger.close()
    const database = new Database(databasePath)
    database.exec("DROP VIEW active_fact_sources; CREATE VIEW active_fact_sources AS SELECT id AS fact_id FROM facts;")
    database.close()

    try {
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("schema_incompatible")
      expect(schemaSql(databasePath, "view", "active_fact_sources")).toBe("CREATE VIEW active_fact_sources AS SELECT id AS fact_id FROM facts")
    } finally {
      removeProject(projectRoot)
    }
  })
})
