import type { DocHistoryMode } from "../cli/types.js"

export interface AgentDocsConfig {
  canonicalFilename: string
  eligible: boolean
}

export const DOCS_INDEX_RUNTIME_STATUS = {
  invocation: "/docs-index",
  executable: true,
  reason: "Implemented as a plugin command via commands/docs-index.md and intended to fan out parallel background doc tasks.",
} as const

export function getDocsEligibleAgentKeys(): string[] {
  return Object.entries(AGENT_DOCS_CONFIG)
    .filter(([, config]) => config.eligible)
    .map(([key]) => key)
}

export const AGENT_DOCS_CONFIG: Record<string, AgentDocsConfig> = {
  "marketing-wunderkind": {
    canonicalFilename: "marketing-strategy.md",
    eligible: true,
  },
  "creative-director": {
    canonicalFilename: "design-decisions.md",
    eligible: true,
  },
  "product-wunderkind": {
    canonicalFilename: "product-decisions.md",
    eligible: true,
  },
  "fullstack-wunderkind": {
    canonicalFilename: "engineering-decisions.md",
    eligible: true,
  },
  "brand-builder": {
    canonicalFilename: "brand-guidelines.md",
    eligible: true,
  },
  "qa-specialist": {
    canonicalFilename: "qa-decisions.md",
    eligible: true,
  },
  "operations-lead": {
    canonicalFilename: "ops-runbooks.md",
    eligible: true,
  },
  ciso: {
    canonicalFilename: "security-decisions.md",
    eligible: true,
  },
  "devrel-wunderkind": {
    canonicalFilename: "devrel-decisions.md",
    eligible: true,
  },
  "legal-counsel": {
    canonicalFilename: "legal-notes.md",
    eligible: false,
  },
  "support-engineer": {
    canonicalFilename: "support-notes.md",
    eligible: false,
  },
  "data-analyst": {
    canonicalFilename: "data-analysis.md",
    eligible: false,
  },
}

export function buildDocsInstruction(
  agentKey: string,
  docsPath: string,
  docHistoryMode: DocHistoryMode,
): string {
  const config = AGENT_DOCS_CONFIG[agentKey]
  if (!config) {
    throw new Error(`Unknown agent key: ${agentKey}`)
  }

  return `When docs output is enabled, write to: ${docsPath}/${config.canonicalFilename}

History mode: ${docHistoryMode}
- overwrite: Replace the file contents each time.
- append-dated: Append a dated section to the file.
- new-dated-file: Create a new file with a date suffix.
- overwrite-archive: Overwrite the current file and archive the old one.

Use the configured docs path exactly as provided: ${docsPath}

After writing, participate in the \`/docs-index\` workflow to refresh the project documentation index.

Each eligible docs agent owns its own canonical document output. When your work is complete, return an explicit completion result for your target file so the coordinator can decide whether to write a partial index or a full success index.

The namespaced plugin command coordinates one parallel background task per eligible docs agent, writes the index from completed child outputs, and only runs \`init-deep\` after full success.`
}
