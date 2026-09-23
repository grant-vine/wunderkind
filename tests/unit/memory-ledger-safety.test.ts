import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { chmodSync, existsSync, mkdirSync, readdirSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { MemoryLedger } from "../../src/memory/index.js"
import { captureLedgerError, createLedger, createVersionOneLedger, makeProject, removeProject } from "./helpers/memory-ledger.js"

describe("MemoryLedger safety", () => {
  it("backs up a version-N database before a failed N-to-N+1 migration and leaves it readable", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const databasePath = join(databaseDir, "memory.sqlite")
    mkdirSync(databaseDir)
    const legacy = new Database(databasePath)
    legacy.exec("CREATE TABLE source_events (id TEXT PRIMARY KEY); CREATE TABLE fact_tombstones (fact_id TEXT PRIMARY KEY); PRAGMA user_version = 1;")
    legacy.close()

    try {
      const migrationFailure = captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))
      const backupDirectory = join(databaseDir, "memory-backups")
      const backupNames = existsSync(backupDirectory) ? readdirSync(backupDirectory) : []
      const backupName = backupNames.find((name) => /^1-to-2-.*\.sqlite$/u.test(name))

      expect(migrationFailure?.code).toBe("schema_incompatible")
      expect(backupName).toBeDefined()
      const recovered = new Database(databasePath, { readonly: true })
      try {
        expect(recovered.prepare<{ readonly user_version: number }>("PRAGMA user_version").get()?.user_version).toBe(1)
      } finally {
        recovered.close()
      }
    } finally {
      removeProject(projectRoot)
    }
  })

  it("takes a verified backup before migrating a raw-free version-N database", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const databasePath = join(databaseDir, "memory.sqlite")
    mkdirSync(databaseDir)
    createVersionOneLedger(databasePath)

    try {
      const migrated = createLedger(projectRoot, 1_700_000_000_000)
      try {
        const backupNames = readdirSync(join(databaseDir, "memory-backups"))
        migrated.recordSourceEvent({ eventId: "migrated-event", source: "chat", occurredAt: 1_700_000_000_000, rawExcerpt: "Migrated source.", sensitivity: "internal" })
        const candidate = migrated.recordCandidate({ candidateId: "migrated-candidate", sourceEventId: "migrated-event", subject: "project", predicate: "database", value: "SQLite", sensitivity: "internal", observedAt: 1_700_000_000_000 })
        const fact = migrated.acceptCandidate({ factId: "migrated-fact", candidateId: candidate.id, acceptedAt: 1_700_000_000_000 })

        expect(migrated.diagnostics().schemaVersion).toBe(2)
        expect(backupNames.some((name) => /^1-to-2-.*\.sqlite$/u.test(name))).toBe(true)
        expect(fact.value).toBe("SQLite")
      } finally {
        migrated.close()
      }
    } finally {
      removeProject(projectRoot)
    }
  })

  it("fails closed without deleting a legacy raw excerpt during migration", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const databasePath = join(databaseDir, "memory.sqlite")
    mkdirSync(databaseDir)
    createVersionOneLedger(databasePath)
    const legacy = new Database(databasePath)
    legacy.exec("INSERT INTO source_events (id, source, occurred_at, raw_excerpt, redacted_excerpt, raw_state, raw_expires_at, sensitivity) VALUES ('legacy', 'chat', 1, 'legacy-payload', 'legacy-payload', 'retained', 2, 'internal');")
    legacy.close()

    try {
      const migrationFailure = captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))
      const recovered = new Database(databasePath, { readonly: true })
      try {
        const row = recovered.prepare<{ readonly raw_excerpt: string }>("SELECT raw_excerpt FROM source_events WHERE id = 'legacy'").get()

        expect(migrationFailure?.code).toBe("schema_incompatible")
        expect(row?.raw_excerpt).toBe("legacy-payload")
        expect(readdirSync(join(databaseDir, "memory-backups")).some((name) => /^1-to-2-.*\.sqlite$/u.test(name))).toBe(true)
      } finally {
        recovered.close()
      }
    } finally {
      removeProject(projectRoot)
    }
  })

  it("rejects a version-1 ledger whose expected column type was changed", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const databasePath = join(databaseDir, "memory.sqlite")
    mkdirSync(databaseDir)
    createVersionOneLedger(databasePath, { sourceColumnType: "INTEGER" })

    try {
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("schema_incompatible")
    } finally {
      removeProject(projectRoot)
    }
  })

  it("rejects a database-file symlink without opening or changing its external target", () => {
    const projectRoot = makeProject()
    const externalRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const externalDatabase = join(externalRoot, "outside.sqlite")
    mkdirSync(databaseDir)
    const external = new Database(externalDatabase)
    external.exec("CREATE TABLE marker (id TEXT PRIMARY KEY);")
    external.close()
    const before = statSync(externalDatabase).mtimeMs
    symlinkSync(externalDatabase, join(databaseDir, "memory.sqlite"))

    try {
      const failure = captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))

      expect(failure?.code).toBe("containment")
      expect(statSync(externalDatabase).mtimeMs).toBe(before)
    } finally {
      removeProject(projectRoot)
      removeProject(externalRoot)
    }
  })

  it("rejects a pre-existing WAL sidecar symlink before SQLite opens the ledger", () => {
    const projectRoot = makeProject()
    const externalRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const externalWal = join(externalRoot, "outside-wal")
    mkdirSync(databaseDir)
    writeFileSync(externalWal, "outside", "utf8")
    const before = statSync(externalWal).mtimeMs
    symlinkSync(externalWal, join(databaseDir, "memory.sqlite-wal"))

    try {
      const failure = captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))

      expect(failure?.code).toBe("containment")
      expect(statSync(externalWal).mtimeMs).toBe(before)
    } finally {
      removeProject(projectRoot)
      removeProject(externalRoot)
    }
  })

  it("rejects a version-2 database whose required schema objects are incomplete", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    const databasePath = join(databaseDir, "memory.sqlite")
    mkdirSync(databaseDir)
    const incomplete = new Database(databasePath)
    incomplete.exec("CREATE TABLE source_events (id TEXT PRIMARY KEY); PRAGMA user_version = 2;")
    incomplete.close()

    try {
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("schema_incompatible")
    } finally {
      removeProject(projectRoot)
    }
  })

  it("returns safe typed failures for a locked, corrupt, stale, or read-only ledger without echoing raw input", () => {
    const projectRoot = makeProject()
    const databaseDir = join(projectRoot, ".wunderkind")
    mkdirSync(databaseDir)
    const databasePath = join(databaseDir, "memory.sqlite")
    const corruptPath = join(databaseDir, "corrupt.sqlite")
    const malformedPath = join(databaseDir, "malformed.sqlite")
    const rawInput = "api_key=must-never-appear"

    try {
      const stale = new Database(databasePath)
      stale.exec("PRAGMA user_version = 999;")
      stale.close()
      expect(captureLedgerError(() => createLedger(projectRoot, 1_700_000_000_000))?.code).toBe("schema_incompatible")

      writeFileSync(malformedPath, "not a SQLite database", "utf8")
      expect(captureLedgerError(() => new MemoryLedger({ projectRoot, databaseName: "malformed.sqlite", now: () => 1_700_000_000_000 }))?.code).toBe("corrupt")

      const writableLedger = new MemoryLedger({ projectRoot, databaseName: "corrupt.sqlite", now: () => 1_700_000_000_000 })
      writableLedger.close()
      chmodSync(corruptPath, 0o444)

      const readOnlyLedger = new MemoryLedger({ projectRoot, databaseName: "corrupt.sqlite", now: () => 1_700_000_000_000, mode: "read-only" })
      try {
        const readOnlyFailure = captureLedgerError(() => readOnlyLedger.recordSourceEvent({ eventId: "locked", source: "chat", occurredAt: 1_700_000_000_000, rawExcerpt: rawInput, sensitivity: "internal" }))
        expect(readOnlyFailure?.code).toBe("read_only")
        expect(readOnlyFailure?.message).not.toContain(rawInput)
      } finally {
        readOnlyLedger.close()
      }

      const lockedPath = join(databaseDir, "locked.sqlite")
      const holder = new Database(lockedPath)
      holder.exec("BEGIN EXCLUSIVE;")
      try {
        const failure = captureLedgerError(() => new MemoryLedger({ projectRoot, databaseName: "locked.sqlite", now: () => 1_700_000_000_000 }))
        expect(failure?.code).toBe("locked")
        expect(failure?.message).not.toContain(rawInput)
      } finally {
        holder.exec("ROLLBACK;")
        holder.close()
      }
    } finally {
      chmodSync(corruptPath, 0o644)
      removeProject(projectRoot)
    }
  })
})
