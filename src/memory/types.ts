export const SENSITIVITIES = ["public", "internal", "sensitive"] as const
export type Sensitivity = (typeof SENSITIVITIES)[number]

export const RAW_STATES = ["retained", "expired"] as const
export type RawState = (typeof RAW_STATES)[number]

export const LEDGER_MODES = ["read-write", "read-only"] as const
export type LedgerMode = (typeof LEDGER_MODES)[number]

export interface MemoryLedgerOptions {
  readonly projectRoot: string
  readonly databaseName?: string
  readonly mode?: LedgerMode
  readonly now?: () => number
}

export interface SourceEventInput {
  readonly eventId: string
  readonly source: string
  readonly occurredAt: number
  readonly rawExcerpt: string
  readonly sensitivity: Sensitivity
}

export interface CandidateInput {
  readonly candidateId: string
  readonly sourceEventId: string
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: Sensitivity
  readonly observedAt: number
}

export interface AcceptCandidateInput {
  readonly factId: string
  readonly candidateId: string
  readonly acceptedAt: number
}

export interface SourceEvent {
  readonly id: string
  readonly source: string
  readonly occurredAt: number
  readonly rawExcerpt: string | null
  readonly redactedExcerpt: string | null
  readonly rawState: RawState
  readonly rawExpiresAt: number
  readonly sensitivity: Sensitivity
}

export interface Candidate {
  readonly id: string
  readonly sourceEventId: string
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: Sensitivity
  readonly observedAt: number
}

export interface TemporalFact {
  readonly id: string
  readonly candidateId: string
  readonly subject: string
  readonly predicate: string
  readonly value: string
  readonly sensitivity: Sensitivity
  readonly validFrom: number
  readonly validTo: number | null
  readonly acceptedAt: number
  readonly deletedAt: number | null
}

export interface LedgerCounts {
  readonly sourceEvents: number
  readonly candidates: number
  readonly facts: number
  readonly activeFacts: number
}

export interface LedgerDiagnostics {
  readonly databasePath: string
  readonly journalMode: "wal"
  readonly foreignKeys: true
  readonly schemaVersion: number
}

export interface RelevantFactQuery {
  readonly query: string
  readonly sensitivity?: Sensitivity
  readonly maxResults?: number
  readonly unbounded?: boolean
}

export interface RelevantFact {
  readonly fact: TemporalFact
  readonly sourceEventIds: readonly string[]
}
