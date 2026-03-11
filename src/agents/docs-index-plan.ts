import { AGENT_DOCS_CONFIG, getDocsEligibleAgentKeys } from "./docs-config.js"

export interface DocsIndexPlanEntry {
  agentKey: string
  canonicalFilename: string
  targetPath: string
}

export type DocsIndexTaskStatus = "complete" | "failed" | "timed_out"

export interface DocsIndexTaskResult {
  agentKey: string
  targetPath: string
  status: DocsIndexTaskStatus
  notes: string[]
}

export interface DocsIndexPlan {
  docsPath: string
  entries: DocsIndexPlanEntry[]
}

export interface DocsIndexAggregation {
  completed: DocsIndexTaskResult[]
  incomplete: DocsIndexTaskResult[]
  canRunInitDeep: boolean
}

function normalizeDocsPath(docsPath: string): string {
  const trimmed = docsPath.trim()
  if (trimmed === "") return "./docs"
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed
}

export function buildDocsIndexPlan(docsPath: string): DocsIndexPlan {
  const normalizedDocsPath = normalizeDocsPath(docsPath)
  const entries = getDocsEligibleAgentKeys().map((agentKey) => {
    const config = AGENT_DOCS_CONFIG[agentKey]
    if (!config) {
      throw new Error(`Unknown docs agent key: ${agentKey}`)
    }

    return {
      agentKey,
      canonicalFilename: config.canonicalFilename,
      targetPath: `${normalizedDocsPath}/${config.canonicalFilename}`,
    }
  })

  return {
    docsPath: normalizedDocsPath,
    entries,
  }
}

export function detectDocsIndexCollisions(plan: DocsIndexPlan): string[] {
  const seen = new Map<string, string>()
  const collisions: string[] = []

  for (const entry of plan.entries) {
    const existing = seen.get(entry.targetPath)
    if (existing) {
      collisions.push(`${existing} <-> ${entry.agentKey} => ${entry.targetPath}`)
      continue
    }
    seen.set(entry.targetPath, entry.agentKey)
  }

  return collisions
}

export function hasCompleteDocsIndexOutputs(plan: DocsIndexPlan, existingPaths: string[]): boolean {
  const existing = new Set(existingPaths)
  return plan.entries.every((entry) => existing.has(entry.targetPath))
}

export function buildDocsIndexCompletionTag(result: DocsIndexTaskResult): string {
  const notes = result.notes.join(" | ")
  return [
    "<wunderkind-docs-index-result>",
    `agentKey=${result.agentKey}`,
    `targetPath=${result.targetPath}`,
    `status=${result.status}`,
    `notes=${notes}`,
    "</wunderkind-docs-index-result>",
  ].join("\n")
}

export function parseDocsIndexCompletionTag(output: string): DocsIndexTaskResult | null {
  const match = output.match(
    /<wunderkind-docs-index-result>\s*agentKey=(.+)\s*targetPath=(.+)\s*status=(complete|failed|timed_out)\s*notes=(.*)\s*<\/wunderkind-docs-index-result>/s,
  )

  if (!match) return null

  const [, agentKey, targetPath, status, notes] = match
  if (agentKey === undefined || targetPath === undefined || status === undefined || notes === undefined) {
    return null
  }

  return {
    agentKey: agentKey.trim(),
    targetPath: targetPath.trim(),
    status: status.trim() as DocsIndexTaskStatus,
    notes: notes.trim() === "" ? [] : notes.split("|").map((item) => item.trim()).filter(Boolean),
  }
}

export function aggregateDocsIndexResults(
  plan: DocsIndexPlan,
  results: DocsIndexTaskResult[],
  existingPaths: string[],
): DocsIndexAggregation {
  const existing = new Set(existingPaths)

  const resultsByEntry = new Map<string, DocsIndexTaskResult[]>()
  for (const result of results) {
    const key = `${result.agentKey}::${result.targetPath}`
    const current = resultsByEntry.get(key)
    if (current) {
      current.push(result)
    } else {
      resultsByEntry.set(key, [result])
    }
  }

  const completed: DocsIndexTaskResult[] = []
  const incomplete: DocsIndexTaskResult[] = []

  for (const entry of plan.entries) {
    const key = `${entry.agentKey}::${entry.targetPath}`
    const matching = resultsByEntry.get(key) ?? []

    if (matching.length !== 1) {
      incomplete.push({
        agentKey: entry.agentKey,
        targetPath: entry.targetPath,
        status: "failed",
        notes: [matching.length === 0 ? "missing completion result" : "duplicate completion results"],
      })
      continue
    }

    const [result] = matching
    if (result === undefined) {
      incomplete.push({
        agentKey: entry.agentKey,
        targetPath: entry.targetPath,
        status: "failed",
        notes: ["missing completion result"],
      })
      continue
    }

    if (result.status === "complete" && existing.has(entry.targetPath)) {
      completed.push(result)
      continue
    }

    incomplete.push(result)
  }

  return {
    completed,
    incomplete,
    canRunInitDeep: incomplete.length === 0 && completed.length === plan.entries.length,
  }
}
