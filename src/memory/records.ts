import type { RawState, Sensitivity, Candidate, SourceEvent, TemporalFact } from "./types.js"

export interface EventRow {
  readonly id: string
  readonly source: string
  readonly occurred_at: number
  readonly raw_excerpt: string | null
  readonly redacted_excerpt: string | null
  readonly raw_state: RawState
  readonly raw_expires_at: number
  readonly sensitivity: Sensitivity
}

export interface CandidateRow {
  readonly id: string
  readonly source_event_id: string
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: Sensitivity
  readonly observed_at: number
}

export interface FactRow {
  readonly id: string
  readonly candidate_id: string
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: Sensitivity
  readonly valid_from: number
  readonly valid_to: number | null
  readonly accepted_at: number
  readonly deleted_at: number | null
}

export function mapEvent(row: EventRow): SourceEvent {
  return {
    id: row.id,
    source: row.source,
    occurredAt: row.occurred_at,
    rawExcerpt: row.raw_excerpt,
    redactedExcerpt: row.redacted_excerpt,
    rawState: row.raw_state,
    rawExpiresAt: row.raw_expires_at,
    sensitivity: row.sensitivity,
  }
}

export function mapCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    subject: row.subject,
    predicate: row.predicate,
    value: row.value,
    sensitivity: row.sensitivity,
    observedAt: row.observed_at,
  }
}

export function mapFact(row: FactRow): TemporalFact {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    subject: row.subject,
    predicate: row.predicate,
    value: row.value,
    sensitivity: row.sensitivity,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    acceptedAt: row.accepted_at,
    deletedAt: row.deleted_at,
  }
}
