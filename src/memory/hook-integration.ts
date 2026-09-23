import { MemoryLedger } from "./ledger.js"
import { compileMemoryContextSection, mergeMemoryContextSection } from "./context.js"

export interface MemoryHookContextInput {
  readonly system: readonly string[]
  readonly enabled: boolean
  readonly query: string | null
  readonly projectRoot?: string
}

export function appendMemoryContextToSystem(input: MemoryHookContextInput): readonly string[] {
  if (!input.enabled || input.query === null || input.query.trim() === "") {
    return input.system
  }

  try {
    const ledger = new MemoryLedger({ projectRoot: input.projectRoot ?? process.cwd() })
    try {
      const compiled = compileMemoryContextSection({
        ledger,
        query: input.query,
        config: {
          enabled: true,
          byteBudget: 4096,
          maximumAgeMs: 30 * 24 * 60 * 60 * 1000,
          maxResults: 8,
        },
      })
      return mergeMemoryContextSection(input.system, compiled)
    } finally {
      ledger.close()
    }
  } catch {
    return input.system
  }
}
