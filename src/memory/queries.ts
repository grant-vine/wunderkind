import type { Database } from "bun:sqlite"
import { MemoryLedgerError } from "./errors.js"
import { mapFact } from "./records.js"
import type { FactRow } from "./records.js"
import { requireSensitivity, requireText } from "./validation.js"
import type { RelevantFact, RelevantFactQuery } from "./types.js"

interface SourceRow {
  readonly source_event_id: string
}

function maxResults(value: number | undefined): number {
  const resolved = value ?? 20
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > 100) {
    throw new MemoryLedgerError("validation")
  }
  return resolved
}

function literalLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/gu, "\\$&")}%`
}

export function findRelevantFacts(database: Database, input: RelevantFactQuery): readonly RelevantFact[] {
  const phrase = requireText(input.query).toLocaleLowerCase()
  const params: Record<string, string | number> = { $phrase: literalLikePattern(phrase) }
  const limit = input.unbounded === true ? "" : " LIMIT $limit"
  if (input.unbounded !== true) {
    params.$limit = maxResults(input.maxResults)
  }
  const where = [
    "facts.valid_to IS NULL",
    "facts.deleted_at IS NULL",
    "lower(facts.subject || ' ' || facts.predicate || ' ' || facts.value) LIKE $phrase ESCAPE '\\'",
  ]
  if (input.sensitivity !== undefined) {
    where.push("facts.sensitivity = $sensitivity")
    params.$sensitivity = requireSensitivity(input.sensitivity)
  }
  const facts = database.prepare<FactRow>(
    `SELECT facts.* FROM facts WHERE ${where.join(" AND ")} ORDER BY facts.accepted_at DESC, facts.id ASC${limit}`,
  ).all(params)
  const sourceIds = database.prepare<SourceRow, { readonly $factId: string }>(
    "SELECT source_event_id FROM fact_sources WHERE fact_id = $factId ORDER BY source_event_id ASC",
  )
  return facts.map((fact) => ({ fact: mapFact(fact), sourceEventIds: sourceIds.all({ $factId: fact.id }).map((source) => source.source_event_id) }))
}
