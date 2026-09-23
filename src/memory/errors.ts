export const MEMORY_LEDGER_ERROR_CODES = [
  "containment",
  "corrupt",
  "locked",
  "read_only",
  "schema_incompatible",
  "tombstoned",
  "validation",
] as const

export type MemoryLedgerErrorCode = (typeof MEMORY_LEDGER_ERROR_CODES)[number]

export class MemoryLedgerError extends Error {
  readonly name = "MemoryLedgerError"

  constructor(readonly code: MemoryLedgerErrorCode) {
    super(`memory ledger unavailable: ${code}`)
  }
}
