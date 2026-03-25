export interface SlashCommandDefinition {
  command: string
  summary: string
  details?: readonly string[]
}

export interface SlashCommandSection {
  heading: string
  items: readonly string[]
}

export interface SlashCommandRegistry {
  commands: readonly SlashCommandDefinition[]
  sections?: readonly SlashCommandSection[]
}

export interface GeneratedRetainedNativeCommand<TOwner extends string = string> {
  agent: TOwner
  name: string
  command: string
  summary: string
  details?: readonly string[]
}

export const RETAINED_AGENT_SLASH_COMMANDS = {
  "marketing-wunderkind": {
    commands: [
      {
        command: "/gtm-plan <product>",
        summary: "Build a go-to-market plan for a product, feature, or release.",
        details: [
          "Define audience segments, positioning, journey stages, channel mix, launch assets, and measurement.",
          "Include docs, onboarding, or migration dependencies needed for adoption.",
        ],
      },
      {
        command: "/content-calendar <platform> <period>",
        summary: "Generate a platform-specific content calendar.",
        details: ["Invoke via `skill(name=\"social-media-maven\")` for channel-native plans, posting cadence, themes, and copy scaffolding."],
      },
      {
        command: "/community-audit",
        summary: "Audit community presence across owned and external channels.",
      },
      {
        command: "/thought-leadership-plan <quarter>",
        summary: "Plan quarterly narrative pillars, channels, authors, and amplification motions.",
      },
      {
        command: "/docs-launch-brief <release>",
        summary: "Plan the audience-facing launch package for a technical release.",
        details: ["Invoke via `skill(name=\"technical-writer\")` when the work becomes deep developer-documentation drafting."],
      },
      {
        command: "/dx-audit",
        summary: "Audit the first-run audience experience for a technical product and identify the smallest adoption fixes.",
      },
      {
        command: "/competitor-analysis <competitors>",
        summary: "Compare competitor positioning, launch patterns, docs support, and adoption strategy.",
      },
    ],
    sections: [
      {
        heading: "Delegation Patterns",
        items: [
          "Use `visual-engineering` for campaign design, launch visuals, and brand-system execution.",
          "Use `librarian` for market research, event inventories, and external trend gathering.",
          "Invoke via `skill(name=\"technical-writer\")` for deep developer-facing docs or migration-writing execution.",
          "Use `fullstack-wunderkind` to verify technical setup steps or code-example correctness.",
          "Use `legal-counsel` for launch, claim, or regulatory review that needs legal authority.",
        ],
      },
    ],
  },
  "creative-director": {
    commands: [
      {
        command: "/brand-identity <brief>",
        summary: "Develop a brand identity system from a creative brief.",
        details: ["Invoke via `skill(name=\"visual-artist\")` for palette generation, token export, and WCAG auditing."],
      },
      {
        command: "/design-audit <url>",
        summary: "Run a rigorous design and accessibility audit of a live page or design.",
        details: ["Use `agent-browser` to capture screenshots, axe violations, and computed-style evidence."],
      },
      {
        command: "/generate-palette <seed>",
        summary: "Generate an accessible color system from a seed color.",
        details: ["Invoke via `skill(name=\"visual-artist\")` for palette math, token export, and WCAG checks."],
      },
      {
        command: "/design-system-review",
        summary: "Audit an existing design system for consistency, gaps, redundancies, and token drift.",
      },
      {
        command: "/creative-brief <project>",
        summary: "Write a creative brief covering audience, objective, deliverables, constraints, and success criteria.",
      },
    ],
    sections: [
      {
        heading: "Sub-Skill Delegation",
        items: ["Invoke via `skill(name=\"visual-artist\")` for detailed color systems, design tokens, and WCAG-focused palette work."],
      },
      {
        heading: "Delegation Patterns",
        items: [
          "Use `visual-engineering` for implementing designs in code.",
          "Use `agent-browser` for browser-based design capture or audit data.",
          "Use `writing` for long-form brand copy, taglines, or UX-writing production at scale.",
        ],
      },
    ],
  },
  "product-wunderkind": {
    commands: [
      {
        command: "/breakdown <task>",
        summary: "Invoke via `skill(name=\"agile-pm\")` for concern-grouped, parallel-safe subtasks with file targets and dependency order.",
      },
      {
        command: "/sprint-plan",
        summary: "Invoke via `skill(name=\"agile-pm\")` for a sprint plan with points, file targets, dependencies, and stretch work.",
      },
      {
        command: "/prd <feature>",
        summary: "Produce Context, Goals, Non-Goals, User Stories, Requirements, Open Questions, Success Metrics, and Timeline.",
        details: ["After drafting, request a technical acceptance follow-up from `fullstack-wunderkind`."],
      },
      {
        command: "/okr-design <level> <objective>",
        summary: "Refine the objective, propose measurable KRs, validate alignment, and flag objective-vs-KR risks.",
      },
      {
        command: "/file-conflict-check",
        summary: "Invoke via `skill(name=\"agile-pm\")` to build a file-to-task conflict matrix with severity and safe sequencing.",
      },
      {
        command: "/north-star <product>",
        summary: "Identify the value moment, propose candidate metrics, choose the best one, and map input metrics plus cadence.",
      },
    ],
    sections: [
      {
        heading: "Sub-Skill Delegation",
        items: [
          "Invoke via `skill(name=\"grill-me\")`, `skill(name=\"prd-pipeline\")`, `skill(name=\"ubiquitous-language\")`, and `skill(name=\"triage-issue\")` for deep product work.",
          "Invoke via `skill(name=\"agile-pm\")` whenever the request needs sprint planning, backlog structuring, task decomposition, or file-conflict analysis.",
        ],
      },
      {
        heading: "Delegation Patterns",
        items: [
          "Delegate via `task(...)` to `librarian` for competitor research, market data, and industry-report gathering.",
          "Delegate via `task(...)` to `explore` for codebase mapping before decomposition or acceptance review.",
          "Delegate via `task(...)` to `writing` for PRDs, specs, and long-form product documentation.",
          "Delegate via `task(...)` to `marketing-wunderkind` for campaign, launch, and funnel authority.",
          "Delegate via `task(...)` to `fullstack-wunderkind` for technical follow-up after product intake with the repro, severity, and expected behavior already framed.",
        ],
      },
    ],
  },
  "fullstack-wunderkind": {
    commands: [
      {
        command: "/validate-page <url>",
        summary: "Run a browser-backed audit for accessibility, CWV, console errors, broken links, and a screenshot.",
        details: ["Return a CWV table with measured vs target values (`LCP < 2.5s`, `CLS < 0.1`, `FCP < 1.8s`, `TTFB < 800ms`) plus raw violations and errors."],
      },
      {
        command: "/bundle-analyze",
        summary: "Invoke via `skill(name=\"vercel-architect\")` to identify largest chunks, heavy dependencies, and concrete replacement opportunities.",
      },
      {
        command: "/db-audit",
        summary: "Invoke via `skill(name=\"db-architect\")` for schema, index, migration-drift, and slow-query review; report destructive actions without executing them.",
      },
      {
        command: "/edge-vs-node <filepath>",
        summary: "Invoke via `skill(name=\"vercel-architect\")` to decide runtime compatibility and explain blockers.",
      },
      {
        command: "/architecture-review <component>",
        summary: "Assess separation of concerns, coupling, traps, and minimal refactor steps with effort and risk.",
      },
      {
        command: "/supportability-review <service>",
        summary: "Review observability, rollback readiness, on-call ownership, and launch blockers.",
      },
      {
        command: "/runbook <service> <alert>",
        summary: "Translate the alert into blast radius, triage steps, root-cause branches, success checks, and escalation conditions.",
      },
    ],
    sections: [
      {
        heading: "Sub-Skill Delegation",
        items: [
          "Invoke via `skill(name=\"tdd\")` for red-green-refactor loops, regression hardening, and defect-driven delivery.",
          "Invoke via `skill(name=\"vercel-architect\")` for Vercel, App Router, Edge runtime, Neon branching, and performance work.",
          "Invoke via `skill(name=\"db-architect\")` for schema design, query analysis, migrations, and index auditing.",
        ],
      },
      {
        heading: "Delegation Patterns",
        items: [
          "Delegate via `task(...)` to `visual-engineering` for UI implementation and coded visual work.",
          "Delegate via `task(...)` to `agent-browser` for browser automation, E2E capture, and page validation.",
          "Delegate via `task(...)` to `explore` for codebase mapping and `librarian` for external library/documentation research.",
          "Delegate via `task(...)` to `git-master` for git operations.",
          "Invoke via `skill(name=\"technical-writer\")` for external developer docs or tutorials.",
        ],
      },
    ],
  },
  ciso: {
    commands: [
      {
        command: "/threat-model <system or feature>",
        summary: "Invoke via `skill(name=\"security-analyst\")` to build a STRIDE threat model, rate risks, and map mitigations.",
      },
      {
        command: "/security-audit <scope>",
        summary: "Invoke via `skill(name=\"pen-tester\")` for active security testing; review OWASP coverage, auth, authorization, validation, secrets, headers, and dependency risk.",
      },
      {
        command: "/compliance-check <regulation>",
        summary: "Invoke via `skill(name=\"compliance-officer\")` to assess obligations and evidence gaps against a named regulation.",
      },
      {
        command: "/incident-response <incident type>",
        summary: "Run contain/assess/notify/eradicate/recover/learn. Delegate operational containment to `fullstack-wunderkind`. Invoke via `skill(name=\"compliance-officer\")` before routing formal wording to `legal-counsel`.",
      },
      {
        command: "/security-headers-check <url>",
        summary: "Use `agent-browser` to capture headers and report missing or misconfigured controls.",
      },
      {
        command: "/dependency-audit",
        summary: "Run a vulnerability audit and return severity-ranked package findings with recommended action.",
      },
    ],
    sections: [
      {
        heading: "Sub-Skill Delegation",
        items: [
          "Invoke via `skill(name=\"security-analyst\")` for vulnerability assessment, OWASP analysis, code review, and auth testing.",
          "Invoke via `skill(name=\"pen-tester\")` for active testing, attack simulation, ASVS checks, auth-flow abuse, and force browsing.",
          "Invoke via `skill(name=\"compliance-officer\")` for GDPR/POPIA work, data classification, consent handling, and breach notification obligations.",
        ],
      },
      {
        heading: "Delegation Patterns",
        items: ["Delegate via `task(...)` to `legal-counsel` for OSS licensing, TOS/Privacy Policy, DPAs, CLAs, and contract-review work."],
      },
    ],
  },
  "legal-counsel": {
    commands: [
      {
        command: "/license-audit",
        summary: "Audit dependency licenses for compatibility, copyleft risk, and remediation options.",
      },
      {
        command: "/draft-tos <product>",
        summary: "Draft a Terms of Service using the active region and regulation context.",
      },
      {
        command: "/draft-privacy-policy",
        summary: "Draft a Privacy Policy that reflects the active primary regulation.",
      },
      {
        command: "/review-contract <type>",
        summary: "Review a contract excerpt for red flags, risk level, and alternative language.",
      },
      {
        command: "/cla-setup",
        summary: "Recommend CLA vs DCO and draft the chosen contribution-ownership path.",
      },
    ],
    sections: [
      {
        heading: "Delegation Patterns",
        items: [
          "Escalate technical security controls or audit evidence to `ciso`.",
          "Escalate incident-response execution or SLO breach handling to `fullstack-wunderkind`.",
          "Legal Counsel stays advisory and does not delegate through sub-skills.",
        ],
      },
    ],
  },
} as const

export type RetainedAgentSlashCommandOwner = keyof typeof RETAINED_AGENT_SLASH_COMMANDS

function parseSlashCommandName(command: string): string {
  const token = command.trim().split(/\s+/, 1)[0]

  if (token === undefined || token === "" || !token.startsWith("/")) {
    throw new Error(`Invalid retained slash command declaration: ${command}`)
  }

  const name = token.slice(1).trim()
  if (name === "") {
    throw new Error(`Invalid retained slash command declaration: ${command}`)
  }

  return name
}

export function collectGeneratedRetainedNativeCommands<TOwner extends string>(
  registry: Readonly<Record<TOwner, SlashCommandRegistry>>,
): Array<GeneratedRetainedNativeCommand<TOwner>> {
  const commands: Array<GeneratedRetainedNativeCommand<TOwner>> = []
  const ownerByCommandName = new Map<string, TOwner>()

  for (const [agent, commandRegistry] of Object.entries(registry) as Array<[TOwner, SlashCommandRegistry]>) {
    for (const definition of commandRegistry.commands) {
      const name = parseSlashCommandName(definition.command)
      const existingOwner = ownerByCommandName.get(name)

      if (existingOwner !== undefined) {
        throw new Error(
          `Duplicate retained slash command name "${name}" declared by "${String(existingOwner)}" and "${String(agent)}"`,
        )
      }

      ownerByCommandName.set(name, agent)
      commands.push({
        agent,
        name,
        command: definition.command,
        summary: definition.summary,
        ...(definition.details !== undefined ? { details: definition.details } : {}),
      })
    }
  }

  return commands
}

export function getGeneratedRetainedNativeCommands(): Array<GeneratedRetainedNativeCommand<RetainedAgentSlashCommandOwner>> {
  return collectGeneratedRetainedNativeCommands(RETAINED_AGENT_SLASH_COMMANDS)
}

export function renderGeneratedRetainedNativeCommandMarkdown(command: GeneratedRetainedNativeCommand): string {
  const additionalGuidanceSection =
    command.details === undefined || command.details.length === 0
      ? null
      : [
          "## Additional Guidance",
          "",
          ...command.details.map((detail) => `- ${detail}`),
        ].join("\n")

  return [
    "---",
    `description: ${JSON.stringify(command.summary)}`,
    `agent: ${command.agent}`,
    `name: ${command.name}`,
    "---",
    "",
    `You are executing the retained Wunderkind command \`${command.command}\`.`,
    "",
    "## Command",
    "",
    `This command is invoked as \`${command.command}\`.`,
    "",
    "## Purpose",
    "",
    command.summary,
    "",
    "## Constraints",
    "",
    `- This command is owned by \`${command.agent}\`.`,
    "- If the user asks what this command does or passes `--help`, explain the command purpose, accepted arguments, and expected output shape before doing any further work.",
    "- Use the current project and the resolved Wunderkind runtime context as the source of truth for this command.",
    ...(additionalGuidanceSection === null ? [] : ["", additionalGuidanceSection]),
    "",
    "<user-request>",
    "$ARGUMENTS",
    "</user-request>",
    "",
  ].join("\n")
}
