import type { SlashCommandRegistry } from "./slash-commands.js"

export function buildRetainedAgentPrompt(options: {
  soulTitle: string
  personalityKey: string
  soulMaintenanceSection: string
  sections: readonly string[]
}): string {
  return [
    `# ${options.soulTitle} — Soul`,
    `Before acting, read the resolved runtime context for \`${options.personalityKey}\`, \`teamCulture\`, \`orgStructure\`, \`region\`, \`industry\`, and applicable regulations.`,
    options.soulMaintenanceSection,
    ...options.sections,
  ].join("\n\n---\n\n")
}

export function buildPersistentContextSection(options: {
  learnings: string
  decisions: string
  blockers: string
}): string {
  return `## Persistent Context (.omo/)

When operating as a subagent inside an OpenCode or OMO workflow, you may receive a \`<Work_Context>\` block with plan and notepad paths. Always honour it. Otherwise, use \`.omo/\` as the primary project artifact root.

**Read before acting:**
- Plan: \`.omo/plans/*.md\` — READ ONLY. Never modify. Never mark checkboxes. The orchestrator manages the plan.
- Notepads: \`.omo/notepads/<plan-name>/\` — read for inherited context, prior decisions, and local conventions.

**Write after completing work:**
- Learnings (${options.learnings}): \`.omo/notepads/<plan-name>/learnings.md\`
- Decisions (${options.decisions}): \`.omo/notepads/<plan-name>/decisions.md\`
- Blockers (${options.blockers}): \`.omo/notepads/<plan-name>/issues.md\`
- Evidence (when the command or workflow explicitly asks for durable proof): \`.omo/evidence/<topic>.md\`

**APPEND ONLY** — never overwrite notepad or evidence files. Use normal Write/Edit for ordinary repo files. Use Wunderkind's bounded durable-artifact writer only for protected \`.omo/notepads/\` and \`.omo/evidence/\` paths. Never use Edit directly on notepad or evidence files.`
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
- Keep command contracts concise: intent, required inputs, and expected output.`
}

export function renderSlashCommandRegistry(registry: SlashCommandRegistry): string {
  const commandIndex = registry.commands.map((command) => `- \`${command.command}\` — ${command.summary}`)

  const sectionBlocks = registry.sections?.map((section) => {
    const items = section.items.map((item) => `- ${item}`).join("\n")
    return [`### ${section.heading}`, items].join("\n\n")
  }) ?? []

  return [
    "## Slash Commands",
    buildSlashCommandHelpSection(),
    ...(commandIndex.length === 0 ? [] : ["### Available Commands", commandIndex.join("\n")]),
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

### Hard rules for delegation

- Prefer parallel delegation when subtasks are independent.
- Keep \`bg_...\` task ids separate from \`ses_...\` session ids.
- Wait for the runtime completion signal before calling \`background_output\`.
- After delegating research or exploration, synthesize the delegated result before repeating the same search locally.
- Avoid unnecessary nested delegation.
- Name the target domain up front so the receiving agent can act without re-triaging.

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
