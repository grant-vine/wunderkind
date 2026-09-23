import { MemoryLedgerError } from "./errors.js"
import type { Sensitivity } from "./types.js"

export function requireText(value: string, code: "validation" | "containment" = "validation"): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new MemoryLedgerError(code)
  }
  return trimmed
}

export function requireTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MemoryLedgerError("validation")
  }
  return value
}

export function requireSensitivity(value: Sensitivity): Sensitivity {
  if (value !== "public" && value !== "internal" && value !== "sensitive") {
    throw new MemoryLedgerError("validation")
  }
  return value
}

export function safeInfrastructureError(error: unknown): MemoryLedgerError {
  if (error instanceof MemoryLedgerError) {
    return error
  }
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("locked") || message.includes("busy")) {
    return new MemoryLedgerError("locked")
  }
  if (message.includes("readonly") || message.includes("read-only")) {
    return new MemoryLedgerError("read_only")
  }
  if (message.includes("malformed") || message.includes("not a database")) {
    return new MemoryLedgerError("corrupt")
  }
  return new MemoryLedgerError("corrupt")
}
