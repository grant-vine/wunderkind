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
        details: ["Use `social-media-maven` for channel-native plans, posting cadence, themes, and copy scaffolding."],
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
        details: ["Use `technical-writer` when the work becomes deep developer-documentation drafting."],
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
          "Use `technical-writer` for deep developer-facing docs or migration-writing execution.",
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
        details: ["Use `visual-artist` for palette generation, token export, and WCAG auditing."],
      },
      {
        command: "/design-audit <url>",
        summary: "Run a rigorous design and accessibility audit of a live page or design.",
        details: ["Use `agent-browser` to capture screenshots, axe violations, and computed-style evidence."],
      },
      {
        command: "/generate-palette <seed>",
        summary: "Generate an accessible color system from a seed color.",
        details: ["Use `visual-artist` for palette math, token export, and WCAG checks."],
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
        items: ["Use `visual-artist` for detailed color systems, design tokens, and WCAG-focused palette work."],
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
        summary: "Delegate to `agile-pm` for concern-grouped, parallel-safe subtasks with file targets and dependency order.",
      },
      {
        command: "/sprint-plan",
        summary: "Delegate to `agile-pm` for a sprint plan with points, file targets, dependencies, and stretch work.",
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
        summary: "Use `agile-pm` to build a file-to-task conflict matrix with severity and safe sequencing.",
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
          "Keep `grill-me`, `prd-pipeline`, `ubiquitous-language`, and `triage-issue` explicit for deep product work.",
          "Use `agile-pm` whenever the request needs sprint planning, backlog structuring, task decomposition, or file-conflict analysis.",
        ],
      },
      {
        heading: "Delegation Patterns",
        items: [
          "Use `librarian` for competitor research, market data, and industry-report gathering.",
          "Use `explore` for codebase mapping before decomposition or acceptance review.",
          "Use `writing` for PRDs, specs, and long-form product documentation.",
          "Route campaign, launch, and funnel authority to `marketing-wunderkind`.",
          "Route technical follow-up after product intake to `fullstack-wunderkind` with the repro, severity, and expected behavior already framed.",
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
        summary: "Use `vercel-architect` to identify largest chunks, heavy dependencies, and concrete replacement opportunities.",
      },
      {
        command: "/db-audit",
        summary: "Use `db-architect` for schema, index, migration-drift, and slow-query review; report destructive actions without executing them.",
      },
      {
        command: "/edge-vs-node <filepath>",
        summary: "Use `vercel-architect` to decide runtime compatibility and explain blockers.",
      },
      {
        command: "/security-audit",
        summary: "Escalate comprehensive OWASP and security-control review to `ciso`.",
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
          "Use `tdd` for red-green-refactor loops, regression hardening, and defect-driven delivery.",
          "Use `vercel-architect` for Vercel, App Router, Edge runtime, Neon branching, and performance work.",
          "Use `db-architect` for schema design, query analysis, migrations, and index auditing.",
        ],
      },
      {
        heading: "Delegation Patterns",
        items: [
          "Use `visual-engineering` for UI implementation and coded visual work.",
          "Use `agent-browser` for browser automation, E2E capture, and page validation.",
          "Use `explore` for codebase mapping and `librarian` for external library/documentation research.",
          "Use `git-master` for git operations and `technical-writer` for external developer docs or tutorials.",
        ],
      },
    ],
  },
  ciso: {
    commands: [
      {
        command: "/threat-model <system or feature>",
        summary: "Build a STRIDE threat model, rate risks, map mitigations, and use `security-analyst` for deeper assessment.",
      },
      {
        command: "/security-audit <scope>",
        summary: "Review OWASP coverage, auth, authorization, validation, secrets, headers, and dependency risk; use `pen-tester` when active testing is required.",
      },
      {
        command: "/compliance-check <regulation>",
        summary: "Use `compliance-officer` to assess obligations and evidence gaps against a named regulation.",
      },
      {
        command: "/incident-response <incident type>",
        summary: "Run contain/assess/notify/eradicate/recover/learn, delegate operational containment to `fullstack-wunderkind`, and use `compliance-officer` before routing formal wording to `legal-counsel`.",
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
          "Use `security-analyst` for vulnerability assessment, OWASP analysis, code review, and auth testing.",
          "Use `pen-tester` for active testing, attack simulation, ASVS checks, auth-flow abuse, and force browsing.",
          "Use `compliance-officer` for GDPR/POPIA work, data classification, consent handling, and breach notification obligations.",
        ],
      },
      {
        heading: "Delegation Patterns",
        items: ["Route OSS licensing, TOS/Privacy Policy, DPAs, CLAs, and contract-review work to `legal-counsel`."],
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
