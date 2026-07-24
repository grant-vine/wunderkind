type OmoCategoryId = "quick" | "unspecified-low" | "unspecified-high" | "writing" | "visual-engineering"

export interface CanonicalPackageMetadata {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly agentVersionFrontmatterKey: string
  readonly keywords: readonly string[]
  readonly files: readonly string[]
}

export interface CanonicalPluginMetadata {
  readonly name: string
  readonly description: string
  readonly main: string
}

export interface CanonicalAgentMetadata {
  readonly id: string
  readonly roleLabel: string
  readonly summary: string
  readonly factoryKey:
    | "marketing-wunderkind"
    | "creative-director"
    | "product-wunderkind"
    | "fullstack-wunderkind"
    | "ciso"
    | "legal-counsel"
  readonly omoCategory: OmoCategoryId
  readonly omoColor: string
  readonly omoMode: "primary"
  readonly omoDescription: string
}

export interface CanonicalSkillMetadata {
  readonly id: string
  readonly bucket: "promoted" | "wunderkind-specific" | "deprecated" | "internal" | "remove-now"
  readonly ownerAgentId: CanonicalAgentMetadata["id"]
  readonly description: string
  readonly sourcePath: `skills/${string}/SKILL.md`
}

export interface CanonicalStaticCommandMetadata {
  readonly name: string
  readonly command: `/${string}`
  readonly ownerAgentId: CanonicalAgentMetadata["id"]
  readonly summary: string
  readonly subtask: boolean
  readonly sourcePath: `commands/${string}.md`
}

export interface CanonicalGeneratedCommandMetadata {
  readonly ownerAgentId: CanonicalAgentMetadata["id"]
  readonly command: `/${string}`
  readonly summary: string
  readonly details?: readonly string[]
}

export interface CanonicalGeneratedCommandSection {
  readonly ownerAgentId: CanonicalAgentMetadata["id"]
  readonly heading: string
  readonly items: readonly string[]
}

export interface CanonicalDocsOutputEntry {
  readonly agentId: CanonicalAgentMetadata["id"]
  readonly canonicalFilename: `${string}.md`
  readonly eligible: boolean
}

export const WUNDERKIND_CANONICAL_MANIFEST = {
  package: {
    name: "@grant-vine/wunderkind",
  version: "0.23.2",
    description: "Wunderkind — specialist AI agent addon for OpenCode with 6 retained specialist agents for any software product team",
    agentVersionFrontmatterKey: "wunderkind_version",
    keywords: ["oh-my-openagent", "oh-my-opencode", "opencode", "plugin", "wunderkind", "agents", "ai-agents"],
    files: [
      "dist/",
      "agents/",
      "commands/",
      "schemas/",
      "skills/",
      ".claude-plugin/",
      "bin/",
      "oh-my-openagent.jsonc",
      "wunderkind.config.jsonc",
    ],
  },
  plugin: {
    name: "wunderkind",
    description: "Wunderkind — specialist AI agents for any software product team, built as an oh-my-openagent addon",
    main: "dist/index.js",
  },
  nativeAssets: {
    markerFilename: ".wunderkind-version.json",
    kinds: ["agents", "commands", "skills"],
    openCodeDirs: {
      agents: "agents",
      commands: "commands",
      skills: "skills",
    },
    upstream: {
      omoCanonicalPackageName: "oh-my-openagent",
      omoLegacyPackageName: "oh-my-opencode",
    },
    configSchemaUrl: "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json",
  },
  agents: [
    {
      id: "marketing-wunderkind",
      roleLabel: "Marketing Wunderkind",
      summary: "CMO-calibre strategist for brand, community, developer advocacy, docs-led launches, adoption, PR, and go-to-market work.",
      factoryKey: "marketing-wunderkind",
      omoCategory: "writing",
      omoColor: "#FF6B35",
      omoMode: "primary",
      omoDescription: "CMO-calibre marketing strategist. Brand, GTM, community, PR, developer advocacy, docs-led launches, tutorials, migration support, funnel analytics, and DX adoption work.",
    },
    {
      id: "creative-director",
      roleLabel: "Creative Director",
      summary: "Brand and UI/UX lead for design systems, visuals, and product experience.",
      factoryKey: "creative-director",
      omoCategory: "visual-engineering",
      omoColor: "#A855F7",
      omoMode: "primary",
      omoDescription: "Brand identity, design systems, UI/UX, typography, colour, accessibility, design tokens.",
    },
    {
      id: "product-wunderkind",
      roleLabel: "Product Wunderkind",
      summary: "Default orchestrator and front door for all Wunderkind requests. Routes, clarifies, and synthesizes across specialists. VP Product authority for strategy, roadmaps, PRDs, OKRs, issue intake, acceptance review, and decomposition.",
      factoryKey: "product-wunderkind",
      omoCategory: "writing",
      omoColor: "#3B82F6",
      omoMode: "primary",
      omoDescription: "Default orchestrator and front door for all Wunderkind requests. Routes mixed-domain and ambiguous work. VP Product authority: roadmaps, OKRs, PRDs, issue intake, acceptance review, sprint planning, and decomposition.",
    },
    {
      id: "fullstack-wunderkind",
      roleLabel: "Fullstack Wunderkind",
      summary: "CTO-calibre engineer for architecture, implementation, and systems tradeoffs.",
      factoryKey: "fullstack-wunderkind",
      omoCategory: "unspecified-high",
      omoColor: "#10B981",
      omoMode: "primary",
      omoDescription: "CTO-calibre full-stack engineer. Frontend, backend, DB, Vercel, architecture, AI integration.",
    },
    {
      id: "ciso",
      roleLabel: "CISO",
      summary: "Security and compliance lead for threat modeling, controls, and risk decisions.",
      factoryKey: "ciso",
      omoCategory: "unspecified-high",
      omoColor: "#EF4444",
      omoMode: "primary",
      omoDescription: "CISO: security architecture, OWASP, threat modelling, GDPR/CCPA/POPIA, pen testing, breach response.",
    },
    {
      id: "legal-counsel",
      roleLabel: "Legal Counsel",
      summary: "Legal and regulatory advisor for contracts, licensing, and compliance posture.",
      factoryKey: "legal-counsel",
      omoCategory: "writing",
      omoColor: "#6366F1",
      omoMode: "primary",
      omoDescription: "OSS licensing, TOS, privacy policy, DPAs, CLAs, contract review, GDPR/CCPA compliance obligations.",
    },
  ],
  skills: [
    {
      id: "agile-pm",
      bucket: "promoted",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: sprint planning, task breakdown, agile, task decomposition, file conflict check, concern grouping, backlog management, story points, dependency ordering, parallel task safety, agent-friendly task structure, work breakdown structure, sprint retrospective, sprint review, velocity tracking, story splitting, definition of done, story review, acceptance criteria, INVEST criteria.",
      sourcePath: "skills/agile-pm/SKILL.md",
    },
    {
      id: "code-health",
      bucket: "promoted",
      ownerAgentId: "fullstack-wunderkind",
      description: "USE FOR: code health audits, engineering hygiene assessments, coupling analysis, testability reviews, dependency classification, severity-ranked findings reports, and identifying systemic code quality patterns across a codebase.",
      sourcePath: "skills/code-health/SKILL.md",
    },
    {
      id: "compliance-officer",
      bucket: "promoted",
      ownerAgentId: "ciso",
      description: "USE FOR: GDPR, POPIA, CCPA, CPRA, PIPEDA, LGPD, PDPA, APP, data protection, privacy compliance, data classification, consent management, data subject rights, breach notification, DPIA, data retention, cross-border transfer, ROPA, privacy policy, compliance gap assessment, and regulatory response planning.",
      sourcePath: "skills/compliance-officer/SKILL.md",
    },
    {
      id: "db-architect",
      bucket: "promoted",
      ownerAgentId: "fullstack-wunderkind",
      description: "USE FOR: database schema design, Drizzle ORM, PostgreSQL, Neon DB, ERD generation, query analysis, EXPLAIN ANALYZE, index audit, migration diff, drizzle-kit, schema introspection, destructive operations (with confirmation), foreign key analysis.",
      sourcePath: "skills/db-architect/SKILL.md",
    },
    {
      id: "design-an-interface",
      bucket: "deprecated",
      ownerAgentId: "fullstack-wunderkind",
      description:
        "DEPRECATED: docs-history and detection-only reference for the retired design-an-interface route. Do not invoke for new work. Use improve-codebase-architecture for structural interface work, direct fullstack-wunderkind routing for narrow engineering judgement, or product/frontend exploration when user workflow or prototype evidence shapes the contract.",
      sourcePath: "skills/design-an-interface/SKILL.md",
    },
    {
      id: "diagnose",
      bucket: "promoted",
      ownerAgentId: "fullstack-wunderkind",
      description: "USE FOR: deterministic bug diagnosis, reproducible failure loops, ranked hypotheses, focused instrumentation, root-cause isolation, and deciding the smallest proving regression surface before implementation starts.",
      sourcePath: "skills/diagnose/SKILL.md",
    },
    {
      id: "docs-with-grill",
      bucket: "wunderkind-specific",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: context-aware documentation grilling, Matt-style grill-with-docs adaptation, repo-aware questioning, `CONTEXT.md` maintenance, validating domain language against code and docs, and preparing Wunderkind-native docs follow-up without copying external filesystem layouts verbatim.",
      sourcePath: "skills/docs-with-grill/SKILL.md",
    },
    {
      id: "experimentation-analyst",
      bucket: "promoted",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: A/B test design, experiment design, hypothesis formulation, sample size calculation, power analysis, minimum detectable effect, MDE, statistical significance, p-value, confidence interval, control group, treatment group, experiment duration, experiment readout, test results analysis, statistical testing, t-test, chi-square test, z-test, bootstrap, Bayesian A/B testing, frequentist testing, multiple testing correction, Bonferroni, false positive rate, false negative rate, Type I error, Type II error, guardrail metrics, novelty effect, network effects in experiments, holdout group, switchback test, multivariate test, MVT, feature flag rollout, staged rollout, experiment infrastructure.",
      sourcePath: "skills/experimentation-analyst/SKILL.md",
    },
    {
      id: "grill-me",
      bucket: "promoted",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: discovery interrogation, stress-testing requirements, uncovering ambiguity, product questioning, assumption checking, pseudo-orchestrator questioning, scope clarification, decision-tree exploration, requirement grilling, contradiction detection.",
      sourcePath: "skills/grill-me/SKILL.md",
    },
    {
      id: "improve-codebase-architecture",
      bucket: "promoted",
      ownerAgentId: "fullstack-wunderkind",
      description: "USE FOR: architecture improvement, codebase deepening, module boundaries, seam design, coupling reduction, dependency review, deletion-test analysis, RFC creation, structural refactoring, and AI-navigable interfaces.",
      sourcePath: "skills/improve-codebase-architecture/SKILL.md",
    },
    {
      id: "oss-licensing-advisor",
      bucket: "promoted",
      ownerAgentId: "legal-counsel",
      description: "USE FOR: OSS license audit, open source license compatibility, MIT license, Apache 2.0, GPL, LGPL, AGPL, copyleft risk, SPDX identifier, license compatibility matrix, dependency license check, third-party license compliance, FOSS compliance, OpenChain, REUSE spec, license header, contributor license agreement, CLA, individual CLA, corporate CLA, developer certificate of origin, DCO, license selection, choosing a license, dual licensing, commercial exception, license FAQ, license obligations, attribution requirements, notice file, NOTICE.txt, copyright notice, license compatibility with SaaS, OSS in commercial product.",
      sourcePath: "skills/oss-licensing-advisor/SKILL.md",
    },
    {
      id: "pen-tester",
      bucket: "promoted",
      ownerAgentId: "ciso",
      description: "USE FOR: penetration testing, pen test, attack simulation, ethical hacking, OWASP ASVS, auth flow testing, JWT attack, force browsing, IDOR exploitation, privilege escalation, session hijacking, CSRF/XSS/injection testing, business logic testing, rate limit bypass, DAST, and vulnerability proof of concept.",
      sourcePath: "skills/pen-tester/SKILL.md",
    },
    {
      id: "prd-pipeline",
      bucket: "promoted",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: PRD workflow, product requirements, PRD to plan, PRD to issues, implementation planning, vertical slices, tracer bullets, filesystem workflow, GitHub workflow, product handoff, plan generation.",
      sourcePath: "skills/prd-pipeline/SKILL.md",
    },
    {
      id: "security-analyst",
      bucket: "promoted",
      ownerAgentId: "ciso",
      description: "USE FOR: OWASP Top 10, vulnerability assessment, security code review, auth testing, broken access control, injection, XSS, CSRF, SSRF, dependency audit, CVE research, attack surface analysis, API security, and detailed defensive security review.",
      sourcePath: "skills/security-analyst/SKILL.md",
    },
    {
      id: "setup-wunderkind-workflow",
      bucket: "wunderkind-specific",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: repo-local workflow setup, issue flow selection, triage vocabulary, glossary/docs location setup, `.omo` conventions, and adapting Matt-style setup patterns to Wunderkind-native files like `AGENTS.md` and `.omo/*`.",
      sourcePath: "skills/setup-wunderkind-workflow/SKILL.md",
    },
    {
      id: "social-media-maven",
      bucket: "promoted",
      ownerAgentId: "marketing-wunderkind",
      description: "USE FOR: social media strategy, content calendar, content planning, hashtag research, platform strategy, engagement audit, content audit, social landing-page audit, campaign planning, community growth, platform mix, posting cadence, and social ROI.",
      sourcePath: "skills/social-media-maven/SKILL.md",
    },
    {
      id: "tdd",
      bucket: "promoted",
      ownerAgentId: "fullstack-wunderkind",
      description: "USE FOR: test-driven development, red-green-refactor loops, bug fixes with new regression coverage, and feature work that should be proven through public behavior. Use when implementing or repairing TypeScript code under Wunderkind's Bun-based test workflow.",
      sourcePath: "skills/tdd/SKILL.md",
    },
    {
      id: "technical-writer",
      bucket: "promoted",
      ownerAgentId: "marketing-wunderkind",
      description: "USE FOR: technical writing, documentation writing, API documentation, getting started guide, quickstart guide, tutorial writing, conceptual guide, how-to guide, reference documentation, SDK documentation, integration guide, migration guide, upgrade guide, code examples, sample code, README writing, CONTRIBUTING.md, developer onboarding docs, docs architecture, documentation structure, docs site copy, Mintlify, Docusaurus, developer portal content, technical blog post, changelog writing, release notes, CLI help text, error message copy, interactive tutorial, FAQ writing, troubleshooting guide, OpenAPI spec review, webhook docs.",
      sourcePath: "skills/technical-writer/SKILL.md",
    },
    {
      id: "triage-issue",
      bucket: "promoted",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: bug triage, external PR triage, issue investigation, support handoff, incident reproduction, defect documentation, issue scoping, support-to-engineering transitions, acceptance clarity, backlog-ready issue shaping.",
      sourcePath: "skills/triage-issue/SKILL.md",
    },
    {
      id: "ubiquitous-language",
      bucket: "promoted",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: glossary maintenance, shared terminology cleanup, naming alignment, canonical terms, alias resolution, domain-language drift, and explicit updates to `.omo/glossary.md`.",
      sourcePath: "skills/ubiquitous-language/SKILL.md",
    },
    {
      id: "vercel-architect",
      bucket: "promoted",
      ownerAgentId: "fullstack-wunderkind",
      description: "USE FOR: Vercel deployment, Next.js App Router, Edge Runtime, ISR/SSR/SSG, bundle analysis, performance optimisation, Neon DB branching, preview URLs, edge vs Node runtime decisions, Lighthouse CI, Core Web Vitals, and serverless route architecture.",
      sourcePath: "skills/vercel-architect/SKILL.md",
    },
    {
      id: "visual-artist",
      bucket: "promoted",
      ownerAgentId: "creative-director",
      description: "USE FOR: brand identity, colour palette, design system, design audit, token export, WCAG contrast, typography, spacing, visual design review, design language, brand guidelines, Tailwind theme, CSS custom properties, W3C design tokens.",
      sourcePath: "skills/visual-artist/SKILL.md",
    },
    {
      id: "write-a-skill",
      bucket: "wunderkind-specific",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: authoring new Wunderkind-native skills, adapting external skill patterns, defining skill triggers, and deciding when a skill needs extra reference files or scripts. Use when work belongs in `skills/*/SKILL.md` instead of TypeScript.",
      sourcePath: "skills/write-a-skill/SKILL.md",
    },
    {
      id: "caveman",
      bucket: "wunderkind-specific",
      ownerAgentId: "product-wunderkind",
      description: "USE FOR: terse mode, low-token replies, compressed communication, user asks like \"caveman mode\", \"be brief\", \"less tokens\", or \"talk like caveman\" while keeping technical accuracy intact.",
      sourcePath: "skills/caveman/SKILL.md",
    },
  ],
  commands: {
    static: [
      {
        name: "docs-index",
        command: "/docs-index",
        ownerAgentId: "product-wunderkind",
        summary: "Regenerate Wunderkind-managed project documentation and refresh the docs index",
        subtask: true,
        sourcePath: "commands/docs-index.md",
      },
      {
        name: "dream",
        command: "/dream",
        ownerAgentId: "product-wunderkind",
        summary: "Wunderkind-native mixed workflow for ideation, SOUL synthesis, and exploration",
        subtask: true,
        sourcePath: "commands/dream.md",
      },
      {
        name: "design-md",
        command: "/design-md",
        ownerAgentId: "creative-director",
        summary: "Create or capture the canonical DESIGN.md brief for Stitch-guided design work",
        subtask: false,
        sourcePath: "commands/design-md.md",
      },
      {
        name: "workflow-sync",
        command: "/workflow-sync",
        ownerAgentId: "product-wunderkind",
        summary: "Analyze or apply a GitHub Issues sync for a local .omo workflow plan",
        subtask: true,
        sourcePath: "commands/workflow-sync.md",
      },
      {
        name: "token-audit",
        command: "/token-audit",
        ownerAgentId: "fullstack-wunderkind",
        summary: "Report deterministic prompt-surface size metrics for Wunderkind-owned assets",
        subtask: true,
        sourcePath: "commands/token-audit.md",
      },
      {
        name: "wunderkind-team",
        command: "/wunderkind-team",
        ownerAgentId: "product-wunderkind",
        summary: "Launch the Wunderkind team-mode entry flow or fall back cleanly to solo product orchestration",
        subtask: true,
        sourcePath: "commands/wunderkind-team.md",
      },
    ],
    generated: [
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/gtm-plan <product>",
        summary: "Build a go-to-market plan for a product, feature, or release.",
        details: [
          "Define audience segments, positioning, journey stages, channel mix, launch assets, and measurement.",
          "Include docs, onboarding, or migration dependencies needed for adoption.",
        ],
      },
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/content-calendar <platform> <period>",
        summary: "Generate a platform-specific content calendar.",
        details: [
          "Invoke via `skill(name=\"social-media-maven\")` for channel-native plans, posting cadence, themes, and copy scaffolding.",
        ],
      },
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/community-audit",
        summary: "Audit community presence across owned and external channels.",
      },
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/thought-leadership-plan <quarter>",
        summary: "Plan quarterly narrative pillars, channels, authors, and amplification motions.",
      },
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/docs-launch-brief <release>",
        summary: "Plan the audience-facing launch package for a technical release.",
        details: ["Invoke via `skill(name=\"technical-writer\")` when the work becomes deep developer-documentation drafting."],
      },
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/dx-audit",
        summary: "Audit the first-run audience experience for a technical product and identify the smallest adoption fixes.",
      },
      {
        ownerAgentId: "marketing-wunderkind",
        command: "/competitor-analysis <competitors>",
        summary: "Compare competitor positioning, launch patterns, docs support, and adoption strategy.",
      },
      {
        ownerAgentId: "creative-director",
        command: "/brand-identity <brief>",
        summary: "Develop a brand identity system from a creative brief.",
        details: ["Invoke via `skill(name=\"visual-artist\")` for palette generation, token export, and WCAG auditing."],
      },
      {
        ownerAgentId: "creative-director",
        command: "/design-audit <url>",
        summary: "Run a rigorous design and accessibility audit of a live page or design.",
        details: ["Use `agent-browser` to capture screenshots, axe violations, and computed-style evidence."],
      },
      {
        ownerAgentId: "creative-director",
        command: "/generate-palette <seed>",
        summary: "Generate an accessible color system from a seed color.",
        details: ["Invoke via `skill(name=\"visual-artist\")` for palette math, token export, and WCAG checks."],
      },
      {
        ownerAgentId: "creative-director",
        command: "/design-system-review",
        summary: "Audit an existing design system for consistency, gaps, redundancies, and token drift.",
      },
      {
        ownerAgentId: "creative-director",
        command: "/creative-brief <project>",
        summary: "Write a creative brief covering audience, objective, deliverables, constraints, and success criteria.",
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/setup-wunderkind-workflow",
        summary: "Establish the repo-local workflow contract for issue flow, triage vocabulary, glossary/docs locations, and `.omo/` artifact conventions.",
        details: ["Invoke via `skill(name=\"setup-wunderkind-workflow\")` to adapt Matt-style setup patterns to Wunderkind-native locations such as `AGENTS.md` and `.omo/`."],
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/docs-with-grill <topic>",
        summary: "Stress-test a docs or product topic against repo context, update `CONTEXT.md` when needed, and prepare Wunderkind-native documentation follow-up.",
        details: ["Invoke via `skill(name=\"docs-with-grill\")` for one-question-at-a-time context grilling that inspects the repo before asking and treats `CONTEXT.md` as the compact shared context lane."],
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/breakdown <task>",
        summary: "Invoke via `skill(name=\"agile-pm\")` for concern-grouped, parallel-safe subtasks with file targets and dependency order.",
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/sprint-plan",
        summary: "Invoke via `skill(name=\"agile-pm\")` for a sprint plan with points, file targets, dependencies, and stretch work.",
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/prd <feature>",
        summary: "Produce Context, Goals, Non-Goals, User Stories, Requirements, Open Questions, Success Metrics, and Timeline.",
        details: ["After drafting, request a technical acceptance follow-up from `fullstack-wunderkind`."],
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/okr-design <level> <objective>",
        summary: "Refine the objective, propose measurable KRs, validate alignment, and flag objective-vs-KR risks.",
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/file-conflict-check",
        summary: "Invoke via `skill(name=\"agile-pm\")` to build a file-to-task conflict matrix with severity and safe sequencing.",
      },
      {
        ownerAgentId: "product-wunderkind",
        command: "/north-star <product>",
        summary: "Identify the value moment, propose candidate metrics, choose the best one, and map input metrics plus cadence.",
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/diagnose <issue>",
        summary: "Run a deterministic engineering diagnosis loop before implementation or refactor decisions.",
        details: ["Invoke via `skill(name=\"diagnose\")` to reproduce the failure, rank hypotheses, add the smallest proving instrumentation, and define the tightest regression surface before changing code."],
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/validate-page <url>",
        summary: "Run a browser-backed audit for accessibility, CWV, console errors, broken links, and a screenshot.",
        details: ["Return a CWV table with measured vs target values (`LCP < 2.5s`, `CLS < 0.1`, `FCP < 1.8s`, `TTFB < 800ms`) plus raw violations and errors."],
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/bundle-analyze",
        summary: "Invoke via `skill(name=\"vercel-architect\")` to identify largest chunks, heavy dependencies, and concrete replacement opportunities.",
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/db-audit",
        summary: "Invoke via `skill(name=\"db-architect\")` for schema, index, migration-drift, and slow-query review; report destructive actions without executing them.",
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/edge-vs-node <filepath>",
        summary: "Invoke via `skill(name=\"vercel-architect\")` to decide runtime compatibility and explain blockers.",
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/architecture-review <component>",
        summary: "Assess separation of concerns, coupling, traps, and minimal refactor steps with effort and risk.",
        details: ["Invoke via `skill(name=\"improve-codebase-architecture\")` for deep module/RFC work using seam, depth, locality, and deletion-test framing."],
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/supportability-review <service>",
        summary: "Review observability, rollback readiness, on-call ownership, and launch blockers.",
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        command: "/runbook <service> <alert>",
        summary: "Translate the alert into blast radius, triage steps, root-cause branches, success checks, and escalation conditions.",
      },
      {
        ownerAgentId: "ciso",
        command: "/threat-model <system or feature>",
        summary: "Invoke via `skill(name=\"security-analyst\")` to build a STRIDE threat model, rate risks, and map mitigations.",
      },
      {
        ownerAgentId: "ciso",
        command: "/security-audit <scope>",
        summary: "Invoke via `skill(name=\"pen-tester\")` for active security testing; review OWASP coverage, auth, authorization, validation, secrets, headers, and dependency risk.",
      },
      {
        ownerAgentId: "ciso",
        command: "/compliance-check <regulation>",
        summary: "Invoke via `skill(name=\"compliance-officer\")` to assess obligations and evidence gaps against a named regulation.",
      },
      {
        ownerAgentId: "ciso",
        command: "/incident-response <incident type>",
        summary: "Run contain/assess/notify/eradicate/recover/learn. Delegate operational containment to `fullstack-wunderkind`. Invoke via `skill(name=\"compliance-officer\")` before routing formal wording to `legal-counsel`.",
      },
      {
        ownerAgentId: "ciso",
        command: "/security-headers-check <url>",
        summary: "Use `agent-browser` to capture headers and report missing or misconfigured controls.",
      },
      {
        ownerAgentId: "ciso",
        command: "/dependency-audit",
        summary: "Run a vulnerability audit and return severity-ranked package findings with recommended action.",
      },
      {
        ownerAgentId: "legal-counsel",
        command: "/license-audit",
        summary: "Audit dependency licenses for compatibility, copyleft risk, and remediation options.",
      },
      {
        ownerAgentId: "legal-counsel",
        command: "/draft-tos <product>",
        summary: "Draft a Terms of Service using the active region and regulation context.",
      },
      {
        ownerAgentId: "legal-counsel",
        command: "/draft-privacy-policy",
        summary: "Draft a Privacy Policy that reflects the active primary regulation.",
      },
      {
        ownerAgentId: "legal-counsel",
        command: "/review-contract <type>",
        summary: "Review a contract excerpt for red flags, risk level, and alternative language.",
      },
      {
        ownerAgentId: "legal-counsel",
        command: "/cla-setup",
        summary: "Recommend CLA vs DCO and draft the chosen contribution-ownership path.",
      },
    ],
    generatedSections: [
      {
        ownerAgentId: "marketing-wunderkind",
        heading: "Delegation Patterns",
        items: [
          "Use `visual-engineering` for campaign design, launch visuals, and brand-system execution.",
          "Use `librarian` for market research, event inventories, and external trend gathering.",
          "Invoke via `skill(name=\"technical-writer\")` for deep developer-facing docs or migration-writing execution.",
          "Use `fullstack-wunderkind` to verify technical setup steps or code-example correctness.",
          "Use `legal-counsel` for launch, claim, or regulatory review that needs legal authority.",
        ],
      },
      {
        ownerAgentId: "creative-director",
        heading: "Sub-Skill Delegation",
        items: ["Invoke via `skill(name=\"visual-artist\")` for detailed color systems, design tokens, and WCAG-focused palette work."],
      },
      {
        ownerAgentId: "creative-director",
        heading: "Delegation Patterns",
        items: [
          "Use `visual-engineering` for implementing designs in code.",
          "Use `agent-browser` for browser-based design capture or audit data.",
          "Use `writing` for long-form brand copy, taglines, or UX-writing production at scale.",
        ],
      },
      {
        ownerAgentId: "product-wunderkind",
        heading: "Sub-Skill Delegation",
        items: [
          "Invoke via `skill(name=\"grill-me\")`, `skill(name=\"docs-with-grill\")`, `skill(name=\"prd-pipeline\")`, `skill(name=\"triage-issue\")`, and `skill(name=\"setup-wunderkind-workflow\")` for deep product workflow setup, context-aware docs grilling, and discovery work. Use `skill(name=\"ubiquitous-language\")` narrowly for glossary maintenance and naming alignment.",
          "Invoke via `skill(name=\"agile-pm\")` whenever the request needs sprint planning, backlog structuring, task decomposition, or file-conflict analysis.",
        ],
      },
      {
        ownerAgentId: "product-wunderkind",
        heading: "Delegation Patterns",
        items: [
          "Delegate via `task(...)` to `librarian` for competitor research, market data, and industry-report gathering.",
          "Delegate via `task(...)` to `explore` for codebase mapping before decomposition or acceptance review.",
          "Delegate via `task(...)` to `writing` for PRDs, specs, and long-form product documentation.",
          "Delegate via `task(...)` to `marketing-wunderkind` for campaign, launch, and funnel authority.",
          "Delegate via `task(...)` to `fullstack-wunderkind` for technical follow-up after product intake with the repro, severity, and expected behavior already framed.",
        ],
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        heading: "Sub-Skill Delegation",
        items: [
          "Invoke via `skill(name=\"diagnose\")` for deterministic bug reproduction, ranked hypothesis testing, focused instrumentation, and regression-surface definition before implementation starts.",
          "Invoke via `skill(name=\"tdd\")` for red-green-refactor loops, regression hardening, and defect-driven delivery.",
          "Invoke via `skill(name=\"vercel-architect\")` for Vercel, App Router, Edge runtime, Neon branching, and performance work.",
          "Invoke via `skill(name=\"db-architect\")` for schema design, query analysis, migrations, and index auditing.",
          "Invoke via `skill(name=\"improve-codebase-architecture\")` for deep-module RFCs, seam design, and structural refactoring plans.",
        ],
      },
      {
        ownerAgentId: "fullstack-wunderkind",
        heading: "Delegation Patterns",
        items: [
          "Delegate via `task(...)` to `visual-engineering` for UI implementation and coded visual work.",
          "Delegate via `task(...)` to `agent-browser` for browser automation, E2E capture, and page validation.",
          "Delegate via `task(...)` to `explore` for codebase mapping and `librarian` for external library/documentation research.",
          "Delegate via `task(...)` to `git-master` for git operations.",
          "Invoke via `skill(name=\"technical-writer\")` for external developer docs or tutorials.",
        ],
      },
      {
        ownerAgentId: "ciso",
        heading: "Sub-Skill Delegation",
        items: [
          "Invoke via `skill(name=\"security-analyst\")` for vulnerability assessment, OWASP analysis, code review, and auth testing.",
          "Invoke via `skill(name=\"pen-tester\")` for active testing, attack simulation, ASVS checks, auth-flow abuse, and force browsing.",
          "Invoke via `skill(name=\"compliance-officer\")` for GDPR/POPIA work, data classification, consent handling, and breach notification obligations.",
        ],
      },
      {
        ownerAgentId: "ciso",
        heading: "Delegation Patterns",
        items: ["Delegate via `task(...)` to `legal-counsel` for OSS licensing, TOS/Privacy Policy, DPAs, CLAs, and contract-review work."],
      },
      {
        ownerAgentId: "legal-counsel",
        heading: "Delegation Patterns",
        items: [
          "Escalate technical security controls or audit evidence to `ciso`.",
          "Escalate incident-response execution or SLO breach handling to `fullstack-wunderkind`.",
          "Legal Counsel stays advisory and does not delegate through sub-skills.",
        ],
      },
    ],
  },
  docsOutput: {
    entries: [
      {
        agentId: "marketing-wunderkind",
        canonicalFilename: "marketing-strategy.md",
        eligible: true,
      },
      {
        agentId: "creative-director",
        canonicalFilename: "design-decisions.md",
        eligible: true,
      },
      {
        agentId: "product-wunderkind",
        canonicalFilename: "product-decisions.md",
        eligible: true,
      },
      {
        agentId: "fullstack-wunderkind",
        canonicalFilename: "engineering-decisions.md",
        eligible: true,
      },
      {
        agentId: "ciso",
        canonicalFilename: "security-decisions.md",
        eligible: true,
      },
      {
        agentId: "legal-counsel",
        canonicalFilename: "legal-notes.md",
        eligible: false,
      },
    ],
    docsIndex: {
      invocation: "/docs-index",
      executable: true,
      reason: "Implemented as a plugin command via commands/docs-index.md and intended for lightweight refresh/bootstrap of managed project docs.",
    },
  },
  omoTemplates: {
    schemaUrl: "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/dev/assets/oh-my-opencode.schema.json",
    namespacePrefix: "wunderkind",
    categories: [
      { id: "quick", model: "anthropic/claude-haiku-4-5" },
      { id: "unspecified-low", model: "anthropic/claude-sonnet-4-6" },
      { id: "unspecified-high", model: "openai/gpt-5.4", variant: "high" },
      { id: "writing", model: "google/gemini-3-flash" },
      { id: "visual-engineering", model: "google/gemini-3.1-pro", variant: "high" },
    ],
  },
  legacySurfaces: {
    contractPath: ".omo/contracts/wunderkind-upstream-convergence.jsonc",
    referencedTestCaseIds: [
      "legacy-sisyphus-artifact-path",
      "legacy-migrate-command",
      "legacy-sisyphus-gitignore",
      "legacy-oh-my-opencode-config",
      "legacy-design-interface-route",
      "legacy-root-wunderkind-config",
      "legacy-opencode-config-fallback",
      "legacy-history-reference",
    ],
  },
} as const satisfies {
  readonly package: CanonicalPackageMetadata
  readonly plugin: CanonicalPluginMetadata
  readonly nativeAssets: {
    readonly markerFilename: string
    readonly kinds: readonly string[]
    readonly openCodeDirs: Record<string, string>
    readonly upstream: {
      readonly omoCanonicalPackageName: string
      readonly omoLegacyPackageName: string
    }
    readonly configSchemaUrl: string
  }
  readonly agents: readonly CanonicalAgentMetadata[]
  readonly skills: readonly CanonicalSkillMetadata[]
  readonly commands: {
    readonly static: readonly CanonicalStaticCommandMetadata[]
    readonly generated: readonly CanonicalGeneratedCommandMetadata[]
    readonly generatedSections: readonly CanonicalGeneratedCommandSection[]
  }
  readonly docsOutput: {
    readonly entries: readonly CanonicalDocsOutputEntry[]
    readonly docsIndex: {
      readonly invocation: string
      readonly executable: boolean
      readonly reason: string
    }
  }
  readonly omoTemplates: {
    readonly schemaUrl: string
    readonly namespacePrefix: string
    readonly categories: readonly {
      readonly id: OmoCategoryId
      readonly model: string
      readonly variant?: string
    }[]
  }
  readonly legacySurfaces: {
    readonly contractPath: string
    readonly referencedTestCaseIds: readonly string[]
  }
}

export type CanonicalAgentId = (typeof WUNDERKIND_CANONICAL_MANIFEST.agents)[number]["id"]
export type CanonicalSkillId = (typeof WUNDERKIND_CANONICAL_MANIFEST.skills)[number]["id"]
export type NativeAssetKind = (typeof WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.kinds)[number]

export function getCanonicalClaudePluginManifest(): Record<string, string> {
  return {
    name: WUNDERKIND_CANONICAL_MANIFEST.plugin.name,
    version: WUNDERKIND_CANONICAL_MANIFEST.package.version,
    description: WUNDERKIND_CANONICAL_MANIFEST.plugin.description,
    main: WUNDERKIND_CANONICAL_MANIFEST.plugin.main,
  }
}

export function renderCanonicalOhMyOpenagentTemplate(): string {
  const categories = Object.fromEntries(
    WUNDERKIND_CANONICAL_MANIFEST.omoTemplates.categories.map((category) => [
      category.id,
      {
        model: category.model,
        ...("variant" in category ? { variant: category.variant } : {}),
      },
    ]),
  )

  const agents = Object.fromEntries(
    WUNDERKIND_CANONICAL_MANIFEST.agents.map((agent) => [
      `${WUNDERKIND_CANONICAL_MANIFEST.omoTemplates.namespacePrefix}:${agent.id}`,
      {
        mode: agent.omoMode,
        category: agent.omoCategory,
        color: agent.omoColor,
        description: agent.omoDescription,
      },
    ]),
  )

  return `${JSON.stringify(
    {
      $schema: WUNDERKIND_CANONICAL_MANIFEST.omoTemplates.schemaUrl,
      categories,
      agents,
    },
    null,
    2,
  )}
`
}
