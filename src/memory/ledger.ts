import { Database } from "bun:sqlite"
import { ensureCandidateCanBecomeFact, ensureSourceCanBeRecorded, forgetFactWithTombstone, forgetSourceWithTombstone } from "./deletion.js"
import { MemoryLedgerError } from "./errors.js"
import { resolveBackupDirectory, resolveLedgerPath } from "./paths.js"
import { findRelevantFacts } from "./queries.js"
import { redactExcerpt } from "./redaction.js"
import { mapCandidate, mapEvent, mapFact } from "./records.js"
import type { CandidateRow, EventRow, FactRow } from "./records.js"
import { LEDGER_SCHEMA_VERSION, migrateLedger } from "./schema.js"
import { safeInfrastructureError, requireSensitivity, requireText, requireTimestamp } from "./validation.js"
import { refreshMarkdownView } from "./views.js"
import type {
  AcceptCandidateInput,
  Candidate,
  CandidateInput,
  LedgerCounts,
  LedgerDiagnostics,
  LedgerMode,
  MemoryLedgerOptions,
  RelevantFact,
  RelevantFactQuery,
  SourceEvent,
  SourceEventInput,
  TemporalFact,
} from "./types.js"

const DAY_MS = 24 * 60 * 60 * 1000
const RAW_RETENTION_MS = 30 * DAY_MS

export class MemoryLedger {
  readonly databasePath: string
  readonly #database: Database
  readonly #mode: LedgerMode
  readonly #now: () => number

  constructor(options: MemoryLedgerOptions) {
    const databaseName = options.databaseName ?? "memory.sqlite"
    const mode = options.mode ?? "read-write"
    this.#mode = mode
    this.#now = options.now ?? Date.now
    this.databasePath = resolveLedgerPath(requireText(options.projectRoot, "containment"), requireText(databaseName, "containment"))
    let database: Database | null = null
    try {
      database = new Database(this.databasePath, mode === "read-only" ? { create: false, readonly: true } : { create: true })
      database.exec("PRAGMA foreign_keys = ON;")
      if (mode === "read-write") {
        database.exec("PRAGMA journal_mode = WAL;")
      }
      migrateLedger({ database, databasePath: this.databasePath, backupDirectory: resolveBackupDirectory(this.databasePath), writable: mode === "read-write", at: this.#now() })
      this.#database = database
    } catch (error) {
      database?.close()
      throw safeInfrastructureError(error)
    }
  }

  close(): void {
    this.#database.close()
  }

  diagnostics(): LedgerDiagnostics {
    const journalRow = this.#database.prepare<{ readonly journal_mode: string }>("PRAGMA journal_mode").get()
    const foreignKeysRow = this.#database.prepare<{ readonly foreign_keys: number }>("PRAGMA foreign_keys").get()
    if (journalRow?.journal_mode !== "wal" || foreignKeysRow?.foreign_keys !== 1) {
      throw new MemoryLedgerError("corrupt")
    }
    return { databasePath: this.databasePath, journalMode: "wal", foreignKeys: true, schemaVersion: LEDGER_SCHEMA_VERSION }
  }

  recordSourceEvent(input: SourceEventInput): { readonly id: string; readonly inserted: boolean } {
    this.#requireWritable()
    const id = redactExcerpt(requireText(input.eventId))
    const occurredAt = requireTimestamp(input.occurredAt)
    const redactedExcerpt = redactExcerpt(requireText(input.rawExcerpt))
    try {
      ensureSourceCanBeRecorded(this.#database, id)
      const result = this.#database.prepare(
        "INSERT INTO source_events (id, source, occurred_at, raw_excerpt, redacted_excerpt, raw_state, raw_expires_at, sensitivity) VALUES ($id, $source, $occurredAt, $rawExcerpt, $redactedExcerpt, 'retained', $rawExpiresAt, $sensitivity) ON CONFLICT(id) DO NOTHING",
      ).run({
        $id: id,
        $source: redactExcerpt(requireText(input.source)),
        $occurredAt: occurredAt,
        $rawExcerpt: null,
        $redactedExcerpt: redactedExcerpt,
        $rawExpiresAt: occurredAt + RAW_RETENTION_MS,
        $sensitivity: requireSensitivity(input.sensitivity),
      })
      refreshMarkdownView(this.#database, this.#now())
      return { id, inserted: result.changes === 1 }
    } catch (error) {
      throw safeInfrastructureError(error)
    }
  }

  recordCandidate(input: CandidateInput): Candidate {
    this.#requireWritable()
    const id = redactExcerpt(requireText(input.candidateId))
    const sourceEventId = redactExcerpt(requireText(input.sourceEventId))
    try {
      this.#database.prepare(
        "INSERT INTO candidates (id, source_event_id, subject, predicate, value, sensitivity, observed_at) VALUES ($id, $sourceEventId, $subject, $predicate, $value, $sensitivity, $observedAt) ON CONFLICT(id) DO NOTHING",
      ).run({
        $id: id,
        $sourceEventId: sourceEventId,
        $subject: redactExcerpt(requireText(input.subject)),
        $predicate: redactExcerpt(requireText(input.predicate)),
        $value: redactExcerpt(requireText(input.value)),
        $sensitivity: requireSensitivity(input.sensitivity),
        $observedAt: requireTimestamp(input.observedAt),
      })
      const candidate = this.#candidateById(id)
      if (!candidate) {
        throw new MemoryLedgerError("corrupt")
      }
      return candidate
    } catch (error) {
      throw safeInfrastructureError(error)
    }
  }

  acceptCandidate(input: AcceptCandidateInput): TemporalFact {
    this.#requireWritable()
    const candidateId = redactExcerpt(requireText(input.candidateId))
    const factId = redactExcerpt(requireText(input.factId))
    const acceptedAt = requireTimestamp(input.acceptedAt)
    try {
      const candidate = this.#candidateById(candidateId)
      if (!candidate) {
        throw new MemoryLedgerError("validation")
      }
      ensureCandidateCanBecomeFact(this.#database, candidate, factId)
      const existing = this.#factById(factId)
      if (existing) {
        return existing
      }
      this.#database.exec("BEGIN IMMEDIATE;")
      try {
        this.#database.prepare(
          "UPDATE facts SET valid_to = $acceptedAt WHERE subject = $subject AND predicate = $predicate AND valid_to IS NULL AND deleted_at IS NULL",
        ).run({ $acceptedAt: acceptedAt, $subject: candidate.subject, $predicate: candidate.predicate })
        this.#database.prepare(
          "INSERT INTO facts (id, candidate_id, subject, predicate, value, sensitivity, valid_from, valid_to, accepted_at, deleted_at) VALUES ($id, $candidateId, $subject, $predicate, $value, $sensitivity, $acceptedAt, NULL, $acceptedAt, NULL)",
        ).run({
          $id: factId,
          $candidateId: candidate.id,
          $subject: candidate.subject,
          $predicate: candidate.predicate,
          $value: candidate.value,
          $sensitivity: candidate.sensitivity,
          $acceptedAt: acceptedAt,
        })
        this.#database.prepare("INSERT INTO fact_sources (fact_id, source_event_id) VALUES ($factId, $sourceEventId)").run({
          $factId: factId,
          $sourceEventId: candidate.sourceEventId,
        })
        this.#database.exec("COMMIT;")
      } catch (error) {
        this.#database.exec("ROLLBACK;")
        throw error
      }
      refreshMarkdownView(this.#database, this.#now())
      const fact = this.#factById(factId)
      if (!fact) {
        throw new MemoryLedgerError("corrupt")
      }
      return fact
    } catch (error) {
      throw safeInfrastructureError(error)
    }
  }

  forgetFact(factId: string, deletedAt = this.#now()): void {
    this.#requireWritable()
    try {
      forgetFactWithTombstone(this.#database, redactExcerpt(requireText(factId)), requireTimestamp(deletedAt))
      refreshMarkdownView(this.#database, this.#now())
    } catch (error) {
      throw safeInfrastructureError(error)
    }
  }

  forgetSource(sourceEventId: string, deletedAt = this.#now()): void {
    this.#requireWritable()
    try {
      forgetSourceWithTombstone(this.#database, redactExcerpt(requireText(sourceEventId)), requireTimestamp(deletedAt))
      refreshMarkdownView(this.#database, this.#now())
    } catch (error) {
      throw safeInfrastructureError(error)
    }
  }

  expireRawExcerpts(at = this.#now()): number {
    this.#requireWritable()
    try {
      const result = this.#database.prepare(
        "UPDATE source_events SET raw_excerpt = NULL, redacted_excerpt = '[EXPIRED]', raw_state = 'expired' WHERE raw_state = 'retained' AND raw_expires_at <= $at",
      ).run({ $at: requireTimestamp(at) })
      return result.changes
    } catch (error) {
      throw safeInfrastructureError(error)
    }
  }

  getSourceEvent(eventId: string): SourceEvent | null {
    const row = this.#database.prepare<EventRow, { readonly $id: string }>("SELECT * FROM source_events WHERE id = $id").get({ $id: redactExcerpt(requireText(eventId)) })
    return row ? mapEvent(row) : null
  }

  getFact(factId: string): TemporalFact | null {
    return this.#factById(redactExcerpt(requireText(factId)))
  }

  listActiveFacts(): readonly TemporalFact[] {
    const rows = this.#database.prepare<FactRow>("SELECT * FROM facts WHERE valid_to IS NULL AND deleted_at IS NULL ORDER BY accepted_at ASC").all()
    return rows.map(mapFact)
  }

  findRelevantFacts(input: RelevantFactQuery): readonly RelevantFact[] {
    return findRelevantFacts(this.#database, input)
  }

  getCounts(): LedgerCounts {
    const row = this.#database.prepare<{
      readonly source_events: number
      readonly candidates: number
      readonly facts: number
      readonly active_facts: number
    }>(
      "SELECT (SELECT COUNT(*) FROM source_events) AS source_events, (SELECT COUNT(*) FROM candidates) AS candidates, (SELECT COUNT(*) FROM facts) AS facts, (SELECT COUNT(*) FROM facts WHERE valid_to IS NULL AND deleted_at IS NULL) AS active_facts",
    ).get()
    if (!row) {
      throw new MemoryLedgerError("corrupt")
    }
    return { sourceEvents: row.source_events, candidates: row.candidates, facts: row.facts, activeFacts: row.active_facts }
  }

  readMarkdownView(): string {
    const row = this.#database.prepare<{ readonly markdown: string }, { readonly $name: string }>("SELECT markdown FROM markdown_views WHERE name = $name").get({ $name: "facts" })
    return row?.markdown ?? "# Memory facts\n"
  }

  #candidateById(id: string): Candidate | null {
    const row = this.#database.prepare<CandidateRow, { readonly $id: string }>("SELECT * FROM candidates WHERE id = $id").get({ $id: id })
    return row ? mapCandidate(row) : null
  }

  #factById(id: string): TemporalFact | null {
    const row = this.#database.prepare<FactRow, { readonly $id: string }>("SELECT * FROM facts WHERE id = $id").get({ $id: id })
    return row ? mapFact(row) : null
  }

  #requireWritable(): void {
    if (this.#mode === "read-only") {
      throw new MemoryLedgerError("read_only")
    }
  }

}
