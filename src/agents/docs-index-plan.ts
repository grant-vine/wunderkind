import { AGENT_DOCS_CONFIG, getDocsEligibleAgentKeys } from "./docs-config.js"
import { resolveProjectLocalDocsPath } from "../cli/docs-output-helper.js"

export interface DocsIndexPlanEntry {
  agentKey: string
  canonicalFilename: string
  targetPath: string
}

export interface DocsIndexPlan {
  docsPath: string
  entries: DocsIndexPlanEntry[]
}

export interface DocsIndexSummary {
  created: string[]
  refreshed: string[]
  skipped: string[]
  failed: string[]
}

export interface DocsIndexSummaryInput {
  existingBefore: string[]
  existingAfter: string[]
  skippedAgentKeys?: string[]
}

export function buildDocsIndexPlan(docsPath: string, cwd: string = process.cwd()): DocsIndexPlan {
  const normalizedDocsPath = resolveProjectLocalDocsPath(docsPath, cwd).docsPath
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

export function validateDocsIndexPlan(plan: DocsIndexPlan): string[] {
  const seen = new Map<string, string>()
  const duplicates: string[] = []

  for (const entry of plan.entries) {
    const existing = seen.get(entry.targetPath)
    if (existing) {
      duplicates.push(`${existing} <-> ${entry.agentKey} => ${entry.targetPath}`)
      continue
    }
    seen.set(entry.targetPath, entry.agentKey)
  }

  return duplicates
}

export function summarizeDocsIndexResults(plan: DocsIndexPlan, input: DocsIndexSummaryInput): DocsIndexSummary {
  const existingBefore = new Set(input.existingBefore)
  const existingAfter = new Set(input.existingAfter)
  const skippedAgentKeys = new Set(input.skippedAgentKeys ?? [])

  const created: string[] = []
  const refreshed: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  for (const entry of plan.entries) {
    if (skippedAgentKeys.has(entry.agentKey)) {
      skipped.push(entry.targetPath)
      continue
    }

    const existedBefore = existingBefore.has(entry.targetPath)
    const existsAfter = existingAfter.has(entry.targetPath)

    if (existsAfter) {
      if (existedBefore) {
        refreshed.push(entry.targetPath)
      } else {
        created.push(entry.targetPath)
      }
      continue
    }

    failed.push(entry.targetPath)
  }

  return { created, refreshed, skipped, failed }
}
