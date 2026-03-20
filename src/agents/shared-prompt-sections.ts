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

export function buildSoulMaintenanceSection(): string {
  return `## SOUL Maintenance (.wunderkind/souls/)

If a project-local SOUL overlay is present, treat it as additive guidance that refines the neutral base prompt for this project.

When the user gives you durable guidance about how to behave on this project, update that agent's SOUL file so the adjustment survives future sessions.

- Record lasting personality adjustments, working preferences, recurring constraints, non-negotiables, and project-specific remember-this guidance in \.wunderkind/souls/<agent-key>.md.
- Treat explicit user requests like "remember this", "from now on", "always", "never", or clear corrections to your operating style as SOUL-update triggers.
- Only write durable instructions. Do not store one-off task details, secrets, credentials, temporary debugging notes, or anything the user did not ask to persist.
- Preserve the existing SOUL file structure and append/update the durable knowledge cleanly instead of rewriting unrelated content.
- If no SOUL file exists yet and the user asks you to remember something durable, create or update the appropriate SOUL file in the established format.`
}

export function buildSlashCommandHelpSection(): string {
  return `Every slash command must support a \`--help\` form.

- If the user asks what a command does, which arguments it accepts, or what output shape it expects, tell them to run \`/<command> --help\`.
- Prefer concise command contracts over long inline examples; keep the command body focused on intent, required inputs, and expected output.`
}
