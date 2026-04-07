import type { SlashCommandRegistry } from "./slash-commands.js"

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
- Evidence (when the command or workflow explicitly asks for durable proof): \`.sisyphus/evidence/<topic>.md\`

**APPEND ONLY** — never overwrite notepad or evidence files. Use normal Write/Edit for ordinary repo files. Use Wunderkind's bounded durable-artifact writer only for protected \`.sisyphus/notepads/\` and \`.sisyphus/evidence/\` paths so append-only guarantees are preserved. Never use the Edit tool directly on notepad or evidence files.`
}

export function buildSoulMaintenanceSection(): string {
  return `## SOUL Maintenance (.wunderkind/souls/)

If a project-local SOUL overlay is present, treat it as additive guidance that refines the neutral base prompt for this project.

SOUL files are read-only in the current retained-agent durable writer contract unless the runtime explicitly exposes a dedicated SOUL persistence lane.

- Treat explicit user requests like "remember this", "from now on", "always", "never", or clear corrections to your operating style as SOUL-update candidates.
- Surface the candidate SOUL update in chat or route it to the orchestrator instead of mutating \.wunderkind/souls/<agent-key>.md through generic Write/Edit tools.
- Only persist durable instructions through explicitly supported Wunderkind lanes. Do not store one-off task details, secrets, credentials, temporary debugging notes, or anything the user did not ask to persist.`
}

export function buildSlashCommandHelpSection(): string {
  return `Every slash command must support a \`--help\` form.

- If the user asks what a command does, which arguments it accepts, or what output shape it expects, tell them to run \`/<command> --help\`.
- Prefer concise command contracts over long inline examples; keep the command body focused on intent, required inputs, and expected output.`
}

export function renderSlashCommandRegistry(registry: SlashCommandRegistry): string {
  const commandBlocks = registry.commands.map((command) => {
    const details = command.details?.map((detail) => `- ${detail}`).join("\n")
    return [`### \`${command.command}\``, command.summary, details].filter((part) => part !== undefined && part !== "").join("\n\n")
  })

  const sectionBlocks = registry.sections?.map((section) => {
    const items = section.items.map((item) => `- ${item}`).join("\n")
    return [`## ${section.heading}`, items].join("\n\n")
  }) ?? []

  return [
    "## Slash Commands",
    buildSlashCommandHelpSection(),
    ...commandBlocks,
    ...sectionBlocks,
  ].join("\n\n---\n\n")
}

export function buildDelegationContractSection(): string {
  return `## Delegation Contract

Use this contract to choose the right delegation mechanism.

- Invoke via \`skill(name="<skill>")\` for shipped Wunderkind skills and sub-skills — invoke directly, never wrap in \`task()\`.
- Delegate via \`task(...)\` for retained-agent (\`category=\`) or specialist subagent (\`subagent_type=\`) delegation.

### Required fields in every \`task()\` call

- \`load_skills\`: required in every \`task()\` call. Use \`[]\` when no skills apply; never omit.
- \`run_in_background\`: required in every \`task()\` call. Must be explicitly \`true\` or \`false\`; never omit.
- \`category\` and \`subagent_type\`: mutually exclusive. Pass exactly one, never both.

### Canonical examples

\`\`\`typescript
task({
  category: "deep",
  load_skills: [],
  run_in_background: false,
  prompt: "...",
})

task({
  subagent_type: "oracle",
  load_skills: [],
  run_in_background: true,
  prompt: "...",
})
\`\`\``
}
