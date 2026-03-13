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

  const managedOutputInstruction =
    docHistoryMode === "new-dated-file"
      ? "Within `/docs-index`, treat the canonical unsuffixed file as your managed home lane. Do not rewrite that canonical file for this mode. Instead, create or refresh a UTC-timestamped managed family file alongside it, using the shared run token and the configured collision suffix rules."
      : "Within `/docs-index`, treat this file as your managed home file. Refresh its contents if it already exists, or create it if missing."

  return `When docs output is enabled, write to: ${docsPath}/${config.canonicalFilename}

History mode: ${docHistoryMode}
- overwrite: Replace the file contents each time.
- append-dated: Append a UTC-timestamped section heading like \`## Update 2026-03-12T18-37-52Z\` to the canonical home file.
- new-dated-file: Create a UTC-timestamped managed family file like \`marketing-strategy--2026-03-12T18-37-52Z.md\` alongside the canonical home file.
- overwrite-archive: Overwrite the current file and archive the old one.

UTC Timestamp Contract:
- Use one shared base UTC token per \`/docs-index\` run.
- Timestamp format: \`YYYY-MM-DDTHH-mm-ssZ\`.
- Append collisions use headings like \`## Update 2026-03-12T18-37-52Z (2)\`.
- New dated-file collisions use filenames like \`marketing-strategy--2026-03-12T18-37-52Z--2.md\`.
- Timestamped files derived from canonical basenames are managed family files, not legacy artifacts.
- Existing date-only sections and files should remain untouched.

Use the configured docs path exactly as provided: ${docsPath}
The docs path is always relative to the current project root. Do not inspect or write outside that root.

${managedOutputInstruction}

Each eligible docs agent owns its own canonical document output and should stay within that managed lane unless the user explicitly asks for something broader.

The \`/docs-index\` command refreshes or bootstraps project docs from all angles, summarizes what was created/refreshed/failed, and may offer an optional follow-up question about running \`init-deep\`.`
}
