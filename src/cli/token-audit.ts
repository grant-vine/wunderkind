import {
  collectTokenAuditReport,
  renderTokenAuditTable,
  type TokenAuditFormat,
  type TokenAuditSurface,
} from "./prompt-surface-audit.js"

interface OutputWriter {
  (line: string): void
}

export interface TokenAuditOptions {
  readonly cwd?: string
  readonly surface?: TokenAuditSurface
  readonly format?: TokenAuditFormat
  readonly writeStdout?: OutputWriter
  readonly writeStderr?: OutputWriter
}

function writeLine(writer: OutputWriter | undefined, value: string): void {
  ;(writer ?? console.log)(value)
}

export async function runTokenAudit(options: TokenAuditOptions): Promise<number> {
  const surface = options.surface ?? "agents"
  const format = options.format ?? "table"
  const report = collectTokenAuditReport(surface)

  if (format === "json") {
    writeLine(options.writeStdout, JSON.stringify(report))
    return 0
  }

  for (const line of renderTokenAuditTable(report)) {
    writeLine(options.writeStdout, line)
  }

  return 0
}
