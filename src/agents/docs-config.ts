import type { DocHistoryMode } from "../cli/types.js"

export interface AgentDocsConfig {
  canonicalFilename: string
  eligible: boolean
}

export const DOCS_INDEX_RUNTIME_STATUS = {
  invocation: "/docs-index",
  executable: true,
  reason: "Implemented as a plugin command via commands/docs-index.md and intended for lightweight refresh/bootstrap of managed project docs.",
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
- append-dated: Append a dated section to the file (e.g. ## Update 2026-03-12T18-37-52Z).
- new-dated-file: Create a new file with a UTC timestamp suffix (e.g. marketing-strategy--2026-03-12T18-37-52Z.md).
- overwrite-archive: Overwrite the current file and archive the old one.

UTC Timestamp Contract:
- Always use the exact ISO 8601 UTC format: YYYY-MM-DDTHH-mm-ssZ
- Example: 2026-03-12T18-37-52Z
- Within a single \`/docs-index\` run, all participating agents reuse the same shared base timestamp token provided in the prompt context.
- Timestamped files derived from canonical basenames (e.g. basename--<timestamp>.md) are managed family files belonging to that agent's document set.
- Existing date-only files or sections (e.g. YYYY-MM-DD) remain untouched; do not migrate them.

Use the configured docs path exactly as provided: ${docsPath}
The docs path is always relative to the current project root. Do not inspect or write outside that root.

Within \`/docs-index\`, treat this file as your managed home file. Refresh its contents if it already exists, or create it if missing.

Each eligible docs agent owns its own canonical document output and should stay within that managed lane unless the user explicitly asks for something broader.

The \`/docs-index\` command refreshes or bootstraps project docs from all angles, summarizes what was created/refreshed/failed, and may offer an optional follow-up question about running \`init-deep\`.`
}
