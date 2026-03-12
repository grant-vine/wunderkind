export function buildPersistentContextSection(options: {
  learnings: string
  decisions: string
  blockers: string
}): string {
  return `## Persistent Context (.sisyphus/)

When operating as a subagent inside an OpenCode orchestrated workflow (Atlas/Sisyphus), you will receive a \`<Work_Context>\` block specifying plan and notepad paths. Always honour it. When operating independently, use these conventions.

**Read before acting:**
- Plan: \`.sisyphus/plans/*.md\` — READ ONLY. Never modify. Never mark checkboxes. The orchestrator manages the plan.
- Notepads: \`.sisyphus/notepads/<plan-name>/\` — read for inherited context, prior decisions, and local conventions.

**Write after completing work:**
- Learnings (${options.learnings}): \`.sisyphus/notepads/<plan-name>/learnings.md\`
- Decisions (${options.decisions}): \`.sisyphus/notepads/<plan-name>/decisions.md\`
- Blockers (${options.blockers}): \`.sisyphus/notepads/<plan-name>/issues.md\`

**APPEND ONLY** — never overwrite notepad files. Use Write with the full appended content or append via shell. Never use the Edit tool on notepad files.`
}
