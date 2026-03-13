import { AGENT_DOCS_CONFIG, getDocsEligibleAgentKeys } from "./docs-config.js"
import { resolveProjectLocalDocsPath } from "../cli/docs-output-helper.js"
import type { DocHistoryMode } from "../cli/types.js"

export type DocsIndexOutputStrategy = "in-place" | "dated-file-family"

export interface DocsIndexPlanEntry {
  agentKey: string
  canonicalFilename: string
  managedLanePath: string
  outputStrategy: DocsIndexOutputStrategy
  writePathPattern: string
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
  outputPathsAfterByAgentKey?: Record<string, string[]>
}

export function buildDocsIndexPlan(
  docsPath: string,
  cwd: string = process.cwd(),
  docHistoryMode: DocHistoryMode = "overwrite",
): DocsIndexPlan {
  const normalizedDocsPath = resolveProjectLocalDocsPath(docsPath, cwd).docsPath
  const entries = getDocsEligibleAgentKeys().map((agentKey) => {
    const config = AGENT_DOCS_CONFIG[agentKey]
    if (!config) {
      throw new Error(`Unknown docs agent key: ${agentKey}`)
    }

    const managedLanePath = `${normalizedDocsPath}/${config.canonicalFilename}`
    const outputStrategy: DocsIndexOutputStrategy = docHistoryMode === "new-dated-file" ? "dated-file-family" : "in-place"
    const canonicalBasename = config.canonicalFilename.endsWith(".md")
      ? config.canonicalFilename.slice(0, -3)
      : config.canonicalFilename
    const writePathPattern =
      outputStrategy === "dated-file-family"
        ? `${normalizedDocsPath}/${canonicalBasename}--<UTC_TOKEN>.md`
        : managedLanePath

    return {
      agentKey,
      canonicalFilename: config.canonicalFilename,
      managedLanePath,
      outputStrategy,
      writePathPattern,
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
    const existing = seen.get(entry.managedLanePath)
    if (existing) {
      duplicates.push(`${existing} <-> ${entry.agentKey} => ${entry.managedLanePath}`)
      continue
    }
    seen.set(entry.managedLanePath, entry.agentKey)
  }

  return duplicates
}

export function summarizeDocsIndexResults(plan: DocsIndexPlan, input: DocsIndexSummaryInput): DocsIndexSummary {
  const existingBefore = new Set(input.existingBefore)
  const existingAfter = new Set(input.existingAfter)
  const skippedAgentKeys = new Set(input.skippedAgentKeys ?? [])
  const outputPathsAfterByAgentKey = input.outputPathsAfterByAgentKey ?? {}

  const created: string[] = []
  const refreshed: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  for (const entry of plan.entries) {
    if (skippedAgentKeys.has(entry.agentKey)) {
      skipped.push(entry.managedLanePath)
      continue
    }

    if (entry.outputStrategy === "dated-file-family") {
      const outputPaths = outputPathsAfterByAgentKey[entry.agentKey] ?? []
      const existingOutputPaths = outputPaths.filter((path) => existingAfter.has(path))

      if (existingOutputPaths.length > 0) {
        for (const outputPath of existingOutputPaths) {
          const existedBefore = existingBefore.has(outputPath)
          if (existedBefore) {
            refreshed.push(outputPath)
          } else {
            created.push(outputPath)
          }
        }
        continue
      }

      failed.push(entry.managedLanePath)
      continue
    }

    const existedBefore = existingBefore.has(entry.managedLanePath)
    const existsAfter = existingAfter.has(entry.managedLanePath)

    if (existsAfter) {
      if (existedBefore) {
        refreshed.push(entry.managedLanePath)
      } else {
        created.push(entry.managedLanePath)
      }
      continue
    }

    failed.push(entry.managedLanePath)
  }

  return { created, refreshed, skipped, failed }
}
