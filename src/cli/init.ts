import * as p from "@clack/prompts"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  detectCurrentConfig,
  detectGitHubWorkflowReadiness,
  readWunderkindConfig,
  writeNativeAgentFiles,
  writeNativeCommandFiles,
  writeNativeSkillFiles,
  writeWunderkindConfig,
} from "./config-manager/index.js"
import { bootstrapDesignMd, validateDesignPath } from "./design-md-helper.js"
import { bootstrapDocsReadme, validateDocHistoryMode, validateDocsPath } from "./docs-output-helper.js"
import { detectStitchMcpPresence, mergeStitchMcpConfig, writeStitchSecretFile } from "./mcp-helpers.js"
import { DOCS_HISTORY_META, PERSONALITY_META } from "./personality-meta.js"
import type {
  DesignMcpOwnership,
  DesignTool,
  DocHistoryMode,
  InstallConfig,
  OrgStructure,
  PrdPipelineMode,
  TeamCulture,
} from "./types.js"
import type { StitchPresence } from "./mcp-helpers.js"

export interface InitOptions {
  noTui?: boolean
  docsEnabled?: boolean
  docsPath?: string
  docHistoryMode?: string
  prdPipelineMode?: PrdPipelineMode
  designTool?: string
  designPath?: string
  stitchSetup?: string
  stitchApiKeyFile?: string
}

type DesignWorkflowToggle = "no" | "yes"

type StitchSetupChoice = "reuse" | "project-local" | "skip"

const PROJECT_CONTEXT_MARKERS = ["package.json", "bun.lockb", "bun.lock", "tsconfig.json", "pyproject.toml", ".git"] as const

const AGENTS_MD_PLACEHOLDER = `# Project Agents

This file documents the AI agents configured for this project via Wunderkind.
Run \`wunderkind doctor\` to see current agent configuration and status.
`

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function ensureFile(path: string, content: string): void {
  if (!existsSync(path)) {
    writeFileSync(path, content)
  }
}

export function isProjectContext(cwd: string): boolean {
  return PROJECT_CONTEXT_MARKERS.some((marker) => existsSync(join(cwd, marker)))
}

function normalizeDocHistoryMode(mode: string): DocHistoryMode {
  if (validateDocHistoryMode(mode)) {
    return mode
  }
  return "append-dated"
}

function normalizeDesignPath(designPath: string): string {
  const trimmed = designPath.trim()
  return trimmed === "" ? "./DESIGN.md" : trimmed
}

function normalizeDesignTool(designTool: string | undefined): DesignTool {
  return designTool === "google-stitch" ? "google-stitch" : "none"
}

function normalizeStitchSetup(stitchSetup: string | undefined): StitchSetupChoice | null {
  if (stitchSetup === "reuse" || stitchSetup === "project-local" || stitchSetup === "skip") {
    return stitchSetup
  }

  return null
}

function getReusedStitchOwnership(presence: StitchPresence): Extract<DesignMcpOwnership, "reused-project" | "reused-global"> | null {
  if (presence === "project-local" || presence === "both") {
    return "reused-project"
  }

  if (presence === "global-only") {
    return "reused-global"
  }

  return null
}

function getDefaultStitchSetup(presence: StitchPresence): StitchSetupChoice {
  return presence === "missing" ? "project-local" : "reuse"
}

function isDesignWorkflowEnabled(config: Pick<InstallConfig, "designTool" | "designPath" | "designMcpOwnership">): boolean {
  return (
    config.designTool === "google-stitch" ||
    config.designMcpOwnership !== "none" ||
    normalizeDesignPath(config.designPath ?? "./DESIGN.md") !== "./DESIGN.md"
  )
}

function getInitialStitchSetup(
  presence: StitchPresence,
  ownership: DesignMcpOwnership,
): StitchSetupChoice {
  if (ownership === "wunderkind-managed") return "project-local"
  if (ownership === "reused-project" || ownership === "reused-global") return "reuse"
  return getDefaultStitchSetup(presence)
}

const SOUL_PERSONA_BANNERS: Record<SoulPersonaDefinition["agentKey"], readonly [string, string, string]> = {
  "product-wunderkind": [
    " .-<>-.   PRODUCT WUNDERKIND   .-<>-.",
    "( scope )  outcomes | evidence  (plan )",
    " '-<>-'   user value before noise '-<>-'",
  ],
  "fullstack-wunderkind": [
    " .-[##]-  FULLSTACK WUNDERKIND  -[##]-.",
    "( build ) reliability | tests | ops (ship )",
    " '-[##]-  clean diffs, strong rails  -[##]-'",
  ],
  "marketing-wunderkind": [
    " .-{/}-.  MARKETING WUNDERKIND  .-{/}-.",
    "( signal ) trust | narrative | growth (reach )",
    " '-{/}-   no vanity, prove value   -{/}-'",
  ],
  "creative-director": [
    " .-(* )-   CREATIVE DIRECTOR   -( * )-.",
    "( form ) clarity | craft | access (feel )",
    " '-(* )-  distinct, legible, alive -( * )-'",
  ],
  ciso: [
    " .-[!!]-          CISO          -[!!]-.",
    "( guard ) privacy | risk | controls (audit)",
    " '-[!!]- secure by default, no leaks -[!!]-'",
  ],
  "legal-counsel": [
    " .-[==]-      LEGAL COUNSEL      -[==]-.",
    "( terms ) licensing | claims | risk (plain )",
    " '-[==]- clarity first, promises last -[==]-'",
  ],
}

const TEAM_CULTURE_OPTIONS: Array<{ value: TeamCulture; label: string; hint: string }> = [
  { value: "formal-strict", label: "formal-strict", hint: "Structured, policy-heavy, rigorous tone" },
  { value: "pragmatic-balanced", label: "pragmatic-balanced", hint: "Default balanced execution style" },
  { value: "experimental-informal", label: "experimental-informal", hint: "Fast-moving, exploratory, informal" },
]

const ORG_STRUCTURE_OPTIONS: Array<{ value: OrgStructure; label: string; hint: string }> = [
  { value: "flat", label: "flat", hint: "Peer collaboration and user escalation" },
  { value: "hierarchical", label: "hierarchical", hint: "Domain authority with explicit veto paths" },
]

const PRD_PIPELINE_MODE_OPTIONS: Array<{ value: PrdPipelineMode; label: string; hint: string }> = [
  { value: "filesystem", label: "filesystem", hint: "Write PRDs, plans, and issues into .sisyphus/ files" },
  { value: "github", label: "github", hint: "Use gh/GitHub workflows for PRD and issue output when ready" },
]

const COMMON_REGULATIONS = [
  { value: "GDPR", label: "GDPR", hint: "EU General Data Protection Regulation" },
  { value: "POPIA", label: "POPIA", hint: "South Africa Protection of Personal Information Act" },
  { value: "CCPA", label: "CCPA", hint: "California Consumer Privacy Act" },
  { value: "LGPD", label: "LGPD", hint: "Brazil Lei Geral de Protecao de Dados" },
  { value: "HIPAA", label: "HIPAA", hint: "US Health Insurance Portability and Accountability Act" },
  { value: "PIPEDA", label: "PIPEDA", hint: "Canada Personal Information Protection and Electronic Documents Act" },
  { value: "PDPA", label: "PDPA", hint: "Thailand/Singapore Personal Data Protection Act" },
  { value: "APPI", label: "APPI", hint: "Japan Act on the Protection of Personal Information" },
  { value: "SOC2", label: "SOC 2", hint: "AICPA Service Organization Control 2" },
  { value: "ISO27001", label: "ISO 27001", hint: "Information security management standard" },
  { value: "__other__", label: "Enter manually...", hint: "Type a custom regulation name" },
] as const

interface SoulPersonaDefinition {
  agentKey:
    | "product-wunderkind"
    | "fullstack-wunderkind"
    | "marketing-wunderkind"
    | "creative-director"
    | "ciso"
    | "legal-counsel"
  displayName: string
  questions: readonly [SoulQuestionDefinition, SoulQuestionDefinition, SoulQuestionDefinition, SoulQuestionDefinition]
}

interface SoulQuestionDefinition {
  message: string
  options: readonly [string, string, string]
}

interface SoulCustomizationAnswers {
  priorityLens: string
  challengeStyle: string
  projectMemory: string
  antiGoals: string
}

const SOUL_FIELD_LABELS: Record<keyof SoulCustomizationAnswers, string> = {
  priorityLens: "Priority lens",
  challengeStyle: "Challenge style",
  projectMemory: "Project memory",
  antiGoals: "Anti-goals",
}

const SOUL_PERSONAS: readonly SoulPersonaDefinition[] = [
  {
    agentKey: "product-wunderkind",
    displayName: "Product Wunderkind",
    questions: [
      {
        message: "What should Product Wunderkind optimize for first on this project?",
        options: [
          "Optimize for user value and problem clarity first.",
          "Optimize for measurable business outcomes and adoption first.",
          "Optimize for execution speed and learning velocity first.",
        ],
      },
      {
        message: "How should Product Wunderkind challenge the team when scope, priorities, or evidence are weak?",
        options: [
          "Challenge gently by surfacing open questions and missing evidence.",
          "Push back clearly when scope or priorities are not justified.",
          "Escalate firmly when the team is committing without evidence.",
        ],
      },
      {
        message: "What recurring product context must Product Wunderkind always remember?",
        options: [
          "Remember that thin vertical slices and fast validation matter here.",
          "Remember that user pain, onboarding friction, and support signals matter here.",
          "Remember that prioritization should stay tied to measurable outcomes and evidence.",
        ],
      },
      {
        message: "What should Product Wunderkind avoid doing on this project, even when asked indirectly?",
        options: [
          "Avoid roadmap theater, speculative scope, and big-bang planning.",
          "Avoid shipping features without a clear user problem or success signal.",
          "Avoid treating stakeholder requests as automatic priorities.",
        ],
      },
    ],
  },
  {
    agentKey: "fullstack-wunderkind",
    displayName: "Fullstack Wunderkind",
    questions: [
      {
        message: "What should Fullstack Wunderkind optimize for first on this project: speed, maintainability, reliability, cost, or something else?",
        options: [
          "Optimize for maintainability and clean change surfaces first.",
          "Optimize for reliability and supportability first.",
          "Optimize for delivery speed while staying within safe guardrails.",
        ],
      },
      {
        message: "When Fullstack Wunderkind finds technical debt or weak architecture, how assertive should it be?",
        options: [
          "Flag debt clearly and suggest a pragmatic follow-up path.",
          "Push back when debt materially raises future delivery cost.",
          "Escalate firmly when architecture risk threatens reliability or safety.",
        ],
      },
      {
        message: "What recurring technical context must Fullstack Wunderkind always remember?",
        options: [
          "Remember that this codebase prefers minimal diffs and existing patterns.",
          "Remember that test coverage and type safety are part of done.",
          "Remember that supportability and future debugging matter as much as shipping.",
        ],
      },
      {
        message: "What engineering behaviors should Fullstack Wunderkind avoid on this project?",
        options: [
          "Avoid broad refactors while fixing a targeted bug.",
          "Avoid clever abstractions that hide simple behavior.",
          "Avoid shipping unverified changes or suppressing type errors.",
        ],
      },
    ],
  },
  {
    agentKey: "marketing-wunderkind",
    displayName: "Marketing Wunderkind",
    questions: [
      {
        message: "What should Marketing Wunderkind optimize for first on this project?",
        options: [
          "Optimize for qualified pipeline and revenue impact first.",
          "Optimize for activation, adoption, and time-to-value first.",
          "Optimize for brand trust and narrative clarity first.",
        ],
      },
      {
        message: "How should Marketing Wunderkind challenge positioning, channel, or launch assumptions that look weak?",
        options: [
          "Challenge with evidence gaps and alternative hypotheses.",
          "Push back directly when messaging or channels are not well supported.",
          "Escalate hard when launch assumptions look vanity-driven or ungrounded.",
        ],
      },
      {
        message: "What recurring market, audience, or brand context must Marketing Wunderkind always remember?",
        options: [
          "Remember that the audience values clarity, trust, and concrete proof.",
          "Remember that adoption depends on showing fast practical value.",
          "Remember that positioning should stay distinct without overclaiming.",
        ],
      },
      {
        message: "What marketing behaviors or tactics should Marketing Wunderkind avoid on this project?",
        options: [
          "Avoid vanity metrics and empty launch theater.",
          "Avoid overpromising capabilities the product cannot support yet.",
          "Avoid generic messaging that sounds interchangeable with competitors.",
        ],
      },
    ],
  },
  {
    agentKey: "creative-director",
    displayName: "Creative Director",
    questions: [
      {
        message: "What should Creative Director optimize for first on this project?",
        options: [
          "Optimize for clarity and usability first.",
          "Optimize for distinctive brand expression first.",
          "Optimize for accessible, production-ready design first.",
        ],
      },
      {
        message: "How should Creative Director challenge weak UX, visual, or brand decisions?",
        options: [
          "Challenge with calm rationale and concrete alternatives.",
          "Push back directly when the work looks generic or confusing.",
          "Escalate firmly when accessibility or brand coherence is being ignored.",
        ],
      },
      {
        message: "What recurring visual, accessibility, or brand context must Creative Director always remember?",
        options: [
          "Remember that accessibility is a baseline requirement, not a polish pass.",
          "Remember that the brand should feel intentional rather than generic.",
          "Remember that design decisions must work on mobile and desktop alike.",
        ],
      },
      {
        message: "What design behaviors should Creative Director avoid on this project?",
        options: [
          "Avoid bland defaults and interchangeable UI patterns.",
          "Avoid visual flair that weakens clarity or accessibility.",
          "Avoid introducing styles that break the established design language without reason.",
        ],
      },
    ],
  },
  {
    agentKey: "ciso",
    displayName: "CISO",
    questions: [
      {
        message: "What security posture should CISO default to on this project?",
        options: [
          "Default to pragmatic risk reduction with delivery awareness.",
          "Default to strict controls for sensitive data and privileged flows.",
          "Default to education-first guidance unless risk is material.",
        ],
      },
      {
        message: "How forcefully should CISO escalate or block work when security concerns appear?",
        options: [
          "Escalate with guidance first and reserve blocking for real risk.",
          "Push back clearly when controls are weak or evidence is missing.",
          "Block work immediately when sensitive-data or compliance risk appears.",
        ],
      },
      {
        message: "What recurring security, privacy, or compliance context must CISO always remember?",
        options: [
          "Remember that customer data handling and privacy posture are critical here.",
          "Remember that compliance evidence and auditability matter here.",
          "Remember that secure defaults are better than exception-heavy processes.",
        ],
      },
      {
        message: "What security shortcuts or assumptions must CISO never allow on this project?",
        options: [
          "Never allow secret leakage, insecure storage, or ad hoc credential handling.",
          "Never allow shipping sensitive changes without verification and traceability.",
          "Never allow compliance claims without evidence to support them.",
        ],
      },
    ],
  },
  {
    agentKey: "legal-counsel",
    displayName: "Legal Counsel",
    questions: [
      {
        message: "What legal posture should Legal Counsel default to on this project?",
        options: [
          "Default to pragmatic guidance that helps the team move safely.",
          "Default to conservative interpretation for contracts and commitments.",
          "Default to plain-language explanations of risk and obligations.",
        ],
      },
      {
        message: "How assertively should Legal Counsel escalate legal ambiguity or contractual risk?",
        options: [
          "Raise ambiguity early and explain the tradeoffs calmly.",
          "Push back directly when contract language or claims are risky.",
          "Escalate firmly when legal exposure or regulatory risk is significant.",
        ],
      },
      {
        message: "What recurring jurisdiction, licensing, or regulatory context must Legal Counsel always remember?",
        options: [
          "Remember that regional regulatory obligations shape what can be promised.",
          "Remember that OSS licensing and third-party terms need explicit care.",
          "Remember that customer-facing claims should stay supportable and precise.",
        ],
      },
      {
        message: "What legal shortcuts, promises, or assumptions must Legal Counsel avoid on this project?",
        options: [
          "Avoid informal promises that sound like binding commitments.",
          "Avoid approving third-party usage without checking license terms.",
          "Avoid hand-waving privacy, compliance, or indemnity language.",
        ],
      },
    ],
  },
] as const

const CUSTOM_SOUL_ANSWER_VALUE = "__custom__"

function renderSoulFile(persona: SoulPersonaDefinition, answers: SoulCustomizationAnswers): string {
  return [
    "<!-- wunderkind:soul-file:v1 -->",
    `# ${persona.displayName} SOUL`,
    "",
    `- agentKey: ${persona.agentKey}`,
    "",
    "## Customization",
    `- Priority lens: ${answers.priorityLens}`,
    `- Challenge style: ${answers.challengeStyle}`,
    `- Project memory: ${answers.projectMemory}`,
    `- Anti-goals: ${answers.antiGoals}`,
    "",
    "## Durable Knowledge",
    "",
  ].join("\n")
}

function renderSoulPersonaBanner(persona: SoulPersonaDefinition): string {
  return SOUL_PERSONA_BANNERS[persona.agentKey].join("\n")
}

function parseSoulFileAnswers(fileContent: string): SoulCustomizationAnswers | null {
  const extract = (label: string): string | null => {
    const pattern = new RegExp(`^- ${label}: (.+)$`, "m")
    const match = fileContent.match(pattern)
    return match?.[1]?.trim() ?? null
  }

  const priorityLens = extract(SOUL_FIELD_LABELS.priorityLens)
  const challengeStyle = extract(SOUL_FIELD_LABELS.challengeStyle)
  const projectMemory = extract(SOUL_FIELD_LABELS.projectMemory)
  const antiGoals = extract(SOUL_FIELD_LABELS.antiGoals)

  if (!priorityLens || !challengeStyle || !projectMemory || !antiGoals) {
    return null
  }

  return { priorityLens, challengeStyle, projectMemory, antiGoals }
}

function readExistingSoulAnswers(cwd: string): Map<SoulPersonaDefinition["agentKey"], SoulCustomizationAnswers> {
  const existingAnswers = new Map<SoulPersonaDefinition["agentKey"], SoulCustomizationAnswers>()

  for (const persona of SOUL_PERSONAS) {
    const soulPath = join(cwd, ".wunderkind", "souls", `${persona.agentKey}.md`)
    if (!existsSync(soulPath)) continue

    const parsed = parseSoulFileAnswers(readFileSync(soulPath, "utf-8"))
    if (parsed) {
      existingAnswers.set(persona.agentKey, parsed)
    }
  }

  return existingAnswers
}

async function promptSoulAnswer(question: SoulQuestionDefinition, existingValue?: string): Promise<string | null> {
  const initialValue = existingValue !== undefined && question.options.includes(existingValue)
    ? existingValue
    : existingValue !== undefined
      ? CUSTOM_SOUL_ANSWER_VALUE
      : question.options[0]

  const selection = await p.select<string>({
    message: question.message,
    options: [
      ...question.options.map((option) => ({ value: option, label: option })),
      {
        value: CUSTOM_SOUL_ANSWER_VALUE,
        label: "Enter your own answer",
        hint: "Type a custom SOUL line",
      },
    ],
    initialValue,
  })
  if (p.isCancel(selection)) return null

  if (selection !== CUSTOM_SOUL_ANSWER_VALUE) {
    return selection
  }

  const custom = existingValue !== undefined
    ? await p.text({
        message: `${question.message} (custom answer)`,
        initialValue: existingValue,
        validate: (value) => (value.trim() === "" ? "This answer is required" : undefined),
      })
    : await p.text({
        message: `${question.message} (custom answer)`,
        validate: (value) => (value.trim() === "" ? "This answer is required" : undefined),
      })
  if (p.isCancel(custom)) return null
  return (custom as string).trim()
}

async function promptSelect<T extends string>(
  message: string,
  options: NonNullable<Parameters<typeof p.select<T>>[0]["options"]>,
  initialValue: T,
): Promise<T | null> {
  const selection = await p.select<T>({ message, options, initialValue })
  if (p.isCancel(selection)) return null
  return selection
}

async function promptRegulation(message: string, initialValue: string): Promise<string | null> {
  const knownValues = COMMON_REGULATIONS.map((regulation) => regulation.value).filter((value) => value !== "__other__")
  const initial = knownValues.includes(initialValue as typeof knownValues[number]) ? initialValue : "__other__"

  const selection = await p.select({
    message,
    options: COMMON_REGULATIONS as unknown as Array<{ value: string; label: string; hint?: string }>,
    initialValue: initial,
  })
  if (p.isCancel(selection)) return null

  if (selection !== "__other__") {
    return selection as string
  }

  const custom = await p.text({
    message: "Enter regulation name:",
    placeholder: "leave blank to skip",
    initialValue: knownValues.includes(initialValue as typeof knownValues[number]) ? "" : initialValue,
  })
  if (p.isCancel(custom)) return null

  return (custom as string).trim()
}

export async function runInit(options: InitOptions): Promise<number> {
  try {
    const detected = detectCurrentConfig()
    if (!detected.isInstalled) {
      console.error("Error: Wunderkind is not installed in OpenCode. Run 'wunderkind install' first.")
      return 1
    }

    const cwd = process.cwd()
    if (!isProjectContext(cwd)) {
      console.log("Warning: Current directory does not look like a project. Continuing bootstrap in this folder.")
    }

    const noTui = options.noTui === true || !process.stdin.isTTY || !process.stdout.isTTY
    const soulAnswers = new Map<SoulPersonaDefinition["agentKey"], SoulCustomizationAnswers>()
    const existingSoulAnswers = readExistingSoulAnswers(cwd)
    const persisted = readWunderkindConfig()
    let designTool: DesignTool = persisted?.designTool ?? detected.designTool
    let designPath = normalizeDesignPath(options.designPath ?? persisted?.designPath ?? detected.designPath)
    let designMcpOwnership: DesignMcpOwnership = persisted?.designMcpOwnership ?? detected.designMcpOwnership
    let shouldMergeStitchProjectConfig = false
    let stitchSecretValue: string | null = null
    let shouldBootstrapDesignFile = false

    const config: InstallConfig = {
      region: persisted?.region ?? detected.region,
      industry: persisted?.industry ?? detected.industry,
      primaryRegulation: persisted?.primaryRegulation ?? detected.primaryRegulation,
      secondaryRegulation: persisted?.secondaryRegulation ?? detected.secondaryRegulation,
      teamCulture: persisted?.teamCulture ?? detected.teamCulture,
      orgStructure: persisted?.orgStructure ?? detected.orgStructure,
      cisoPersonality: persisted?.cisoPersonality ?? detected.cisoPersonality,
      ctoPersonality: persisted?.ctoPersonality ?? detected.ctoPersonality,
      cmoPersonality: persisted?.cmoPersonality ?? detected.cmoPersonality,
      productPersonality: persisted?.productPersonality ?? detected.productPersonality,
      creativePersonality: persisted?.creativePersonality ?? detected.creativePersonality,
      legalPersonality: persisted?.legalPersonality ?? detected.legalPersonality,
      docsEnabled: options.docsEnabled ?? persisted?.docsEnabled ?? detected.docsEnabled,
      docsPath: options.docsPath ?? persisted?.docsPath ?? detected.docsPath,
      docHistoryMode: normalizeDocHistoryMode(options.docHistoryMode ?? persisted?.docHistoryMode ?? detected.docHistoryMode),
      prdPipelineMode: options.prdPipelineMode ?? persisted?.prdPipelineMode ?? detected.prdPipelineMode,
      designTool: persisted?.designTool ?? detected.designTool,
      designPath: persisted?.designPath ?? detected.designPath,
      designMcpOwnership: persisted?.designMcpOwnership ?? detected.designMcpOwnership,
    }

    if (!noTui) {
      const regionRaw = await p.text({
        message: "Project region baseline:",
        placeholder: "Global",
        initialValue: config.region,
      })
      if (p.isCancel(regionRaw)) return 1

      const industryRaw = await p.text({
        message: "Project industry or vertical:",
        placeholder: "SaaS",
        initialValue: config.industry,
      })
      if (p.isCancel(industryRaw)) return 1

      const primaryRegulation = await promptRegulation(
        "Primary data-protection regulation for this project?",
        config.primaryRegulation,
      )
      if (primaryRegulation === null) return 1

      const secondaryRegulation = await promptRegulation(
        "Secondary regulation for this project? (optional)",
        config.secondaryRegulation,
      )
      if (secondaryRegulation === null) return 1

      const teamCulture = await promptSelect(
        "Team culture baseline:",
        TEAM_CULTURE_OPTIONS,
        config.teamCulture,
      )
      if (teamCulture === null) return 1

      const orgStructure = await promptSelect(
        "Organization structure:",
        ORG_STRUCTURE_OPTIONS,
        config.orgStructure,
      )
      if (orgStructure === null) return 1

      const createSoulCustomizations = await p.confirm({
        message: "Do you want to create project-local SOUL customizations for any retained Wunderkind personas?",
        initialValue: existingSoulAnswers.size > 0,
      })
      if (p.isCancel(createSoulCustomizations)) return 1

      if (createSoulCustomizations) {
        const selectedSoulPersonas = await p.multiselect<string>({
          message: "Select retained personas for project-local SOUL customization:",
          options: SOUL_PERSONAS.map((persona) => ({
            value: persona.agentKey,
            label: `${persona.displayName} (${persona.agentKey})`,
            hint: PERSONALITY_META[
              persona.agentKey === "product-wunderkind"
                ? "product"
                : persona.agentKey === "fullstack-wunderkind"
                  ? "cto"
                  : persona.agentKey === "marketing-wunderkind"
                    ? "cmo"
                    : persona.agentKey === "creative-director"
                      ? "creative"
                      : persona.agentKey === "ciso"
                        ? "ciso"
                        : "legal"
            ][
              persona.agentKey === "product-wunderkind"
                ? config.productPersonality
                : persona.agentKey === "fullstack-wunderkind"
                  ? config.ctoPersonality
                  : persona.agentKey === "marketing-wunderkind"
                    ? config.cmoPersonality
                    : persona.agentKey === "creative-director"
                      ? config.creativePersonality
                    : persona.agentKey === "ciso"
                      ? config.cisoPersonality
                      : config.legalPersonality
            ]?.hint ?? "",
          })),
          initialValues: [...existingSoulAnswers.keys()],
          required: true,
        })
        if (p.isCancel(selectedSoulPersonas)) return 1
        if (selectedSoulPersonas.length === 0) {
          console.error("Error: at least one retained persona must be selected to create SOUL files")
          return 1
        }
        const selectedSoulPersonaKeys = new Set(selectedSoulPersonas as SoulPersonaDefinition["agentKey"][])

        for (const persona of SOUL_PERSONAS) {
          if (!selectedSoulPersonaKeys.has(persona.agentKey)) continue

          console.log(renderSoulPersonaBanner(persona))

          const existingAnswers = existingSoulAnswers.get(persona.agentKey)

          const priorityLens = await promptSoulAnswer(persona.questions[0], existingAnswers?.priorityLens)
          if (priorityLens === null) return 1
          const challengeStyle = await promptSoulAnswer(persona.questions[1], existingAnswers?.challengeStyle)
          if (challengeStyle === null) return 1
          const projectMemory = await promptSoulAnswer(persona.questions[2], existingAnswers?.projectMemory)
          if (projectMemory === null) return 1
          const antiGoals = await promptSoulAnswer(persona.questions[3], existingAnswers?.antiGoals)
          if (antiGoals === null) return 1

          soulAnswers.set(persona.agentKey, {
            priorityLens,
            challengeStyle,
            projectMemory,
            antiGoals,
          })
        }
      }

      const docsEnabledRaw = await p.confirm({
        message: "Enable docs output to disk?",
        initialValue: config.docsEnabled,
      })
      if (p.isCancel(docsEnabledRaw)) return 1
      const docsEnabled = docsEnabledRaw

      let docsPath = config.docsPath
      let docHistoryMode: DocHistoryMode = config.docHistoryMode
      const prdPipelineMode = await promptSelect<PrdPipelineMode>(
        "PRD / planning workflow mode:",
        PRD_PIPELINE_MODE_OPTIONS,
        config.prdPipelineMode,
      )
      if (prdPipelineMode === null) return 1

      if (docsEnabled) {
        const docsPathRaw = await p.text({
          message: "Docs output directory path (relative):",
          placeholder: "./docs",
          initialValue: config.docsPath,
          validate: (v) => {
            const validation = validateDocsPath(v)
            return validation.valid ? undefined : validation.error
          },
        })
        if (p.isCancel(docsPathRaw)) return 1
        docsPath = (docsPathRaw as string).trim() || "./docs"

        const docHistoryModeRaw = await promptSelect<DocHistoryMode>(
          "Docs history mode:",
          [
            { value: "overwrite", label: "overwrite", hint: DOCS_HISTORY_META["overwrite"].hint },
            { value: "append-dated", label: "append-dated", hint: DOCS_HISTORY_META["append-dated"].hint },
            { value: "new-dated-file", label: "new-dated-file", hint: DOCS_HISTORY_META["new-dated-file"].hint },
            { value: "overwrite-archive", label: "overwrite-archive", hint: DOCS_HISTORY_META["overwrite-archive"].hint },
          ],
          config.docHistoryMode,
        )
        if (docHistoryModeRaw === null) return 1
        docHistoryMode = docHistoryModeRaw
      }

      config.region = (regionRaw as string).trim() || "Global"
      config.industry = (industryRaw as string).trim()
      config.primaryRegulation = primaryRegulation
      config.secondaryRegulation = secondaryRegulation
      config.teamCulture = teamCulture
      config.orgStructure = orgStructure
      config.docsEnabled = docsEnabled
      config.docsPath = docsPath
      config.docHistoryMode = docHistoryMode
      config.prdPipelineMode = prdPipelineMode

      const enableDesignWorkflow = await promptSelect<DesignWorkflowToggle>(
        "Enable design workflow?",
        [
          { value: "no", label: "No", hint: "Skip design workflow bootstrap" },
          { value: "yes", label: "Yes", hint: "Configure DESIGN.md and optional Stitch MCP setup" },
        ],
        isDesignWorkflowEnabled({
          designTool,
          designPath,
          designMcpOwnership,
        })
          ? "yes"
          : "no",
      )
      if (enableDesignWorkflow === null) return 1

      if (enableDesignWorkflow === "yes") {
        shouldBootstrapDesignFile = true

        const selectedDesignTool = await promptSelect<DesignTool>(
          "Design tool:",
          [
            { value: "none", label: "none", hint: "Use only DESIGN.md without MCP setup" },
            { value: "google-stitch", label: "google-stitch", hint: "Connect Google Stitch via MCP" },
          ],
          designTool,
        )
        if (selectedDesignTool === null) return 1
        designTool = selectedDesignTool
        designMcpOwnership = designTool === "google-stitch" ? designMcpOwnership : "none"

        if (designTool === "google-stitch") {
          const stitchPresence = await detectStitchMcpPresence(cwd)
          const defaultStitchSetup = getInitialStitchSetup(stitchPresence, designMcpOwnership)
          const stitchSetup = await promptSelect<StitchSetupChoice>(
            "Stitch MCP setup:",
            [
              { value: "reuse", label: "reuse existing", hint: "Use an existing Stitch MCP configuration" },
              { value: "project-local", label: "create project-local", hint: "Create a project-local Stitch MCP config" },
              { value: "skip", label: "skip", hint: "Leave Stitch MCP unset for now" },
            ],
            defaultStitchSetup,
          )
          if (stitchSetup === null) return 1

          if (stitchSetup === "reuse") {
            const reusedOwnership = getReusedStitchOwnership(stitchPresence)
            if (reusedOwnership !== null) {
              designMcpOwnership = reusedOwnership
            }
          } else if (stitchSetup === "project-local") {
            designMcpOwnership = "wunderkind-managed"
            shouldMergeStitchProjectConfig = true

            const stitchApiKey = await p.password({
              message: "Stitch API key (leave blank to set up later):",
            })
            if (p.isCancel(stitchApiKey)) return 1

            const normalizedStitchApiKey = String(stitchApiKey).trim()
            if (normalizedStitchApiKey !== "") {
              stitchSecretValue = normalizedStitchApiKey
            }
          }
        }

        const designPathRaw = await p.text({
          message: "DESIGN.md path:",
          initialValue: designPath,
          validate: (value) => {
            const validation = validateDesignPath(value)
            return validation.valid ? undefined : validation.error
          },
        })
        if (p.isCancel(designPathRaw)) return 1

        const normalizedDesignPathInput = String(designPathRaw).trim()
        designPath = normalizeDesignPath(normalizedDesignPathInput === "" ? designPath : normalizedDesignPathInput)
      } else {
        designTool = "none"
        designMcpOwnership = "none"
      }
    } else {
      const hasDesignOverrides =
        options.designTool !== undefined ||
        options.designPath !== undefined ||
        options.stitchSetup !== undefined ||
        options.stitchApiKeyFile !== undefined

      designTool = options.designTool === undefined ? config.designTool ?? "none" : normalizeDesignTool(options.designTool)
      designPath = normalizeDesignPath(options.designPath ?? config.designPath ?? detected.designPath)
      designMcpOwnership = options.designTool === undefined ? config.designMcpOwnership ?? "none" : "none"

      if (hasDesignOverrides && designTool === "google-stitch") {
        shouldBootstrapDesignFile = true

        const stitchPresence = await detectStitchMcpPresence(cwd)
        const stitchSetup = normalizeStitchSetup(options.stitchSetup) ?? getInitialStitchSetup(stitchPresence, designMcpOwnership)

        if (stitchSetup === "reuse") {
          const reusedOwnership = getReusedStitchOwnership(stitchPresence)
          if (reusedOwnership !== null) {
            designMcpOwnership = reusedOwnership
          } else {
            console.log("Warning: Stitch reuse requested, but no existing Stitch MCP config was detected. Skipping Stitch MCP setup.")
          }
        } else if (stitchSetup === "project-local") {
          designMcpOwnership = "wunderkind-managed"
          shouldMergeStitchProjectConfig = true

          if (options.stitchApiKeyFile) {
            stitchSecretValue = readFileSync(options.stitchApiKeyFile, "utf-8")
          }
        }
      }
    }

    config.designTool = designTool
    config.designPath = designPath
    config.designMcpOwnership = designMcpOwnership

    if (config.prdPipelineMode === "github") {
      const githubReadiness = detectGitHubWorkflowReadiness(cwd)
      if (!githubReadiness.isGitRepo) {
        console.log("Warning: GitHub PRD mode selected, but this folder is not a git repository yet.")
      } else if (!githubReadiness.hasGitHubRemote) {
        console.log("Warning: GitHub PRD mode selected, but no GitHub remote was detected. Filesystem mode may be safer until remotes are configured.")
      }

      if (!githubReadiness.ghInstalled) {
        console.log("Warning: GitHub PRD mode selected, but `gh` is not installed. GitHub-backed PRD workflows will not be ready until GitHub CLI is available.")
      } else if (githubReadiness.authCheckAttempted && !githubReadiness.authVerified) {
        console.log("Warning: GitHub PRD mode selected, but `gh auth status` could not verify GitHub readiness. You may need to authenticate before using GitHub-backed workflows.")
      }
    }

    if (config.docsEnabled) {
      const docsPathValidation = validateDocsPath(config.docsPath)
      if (!docsPathValidation.valid) {
        console.error(`Error: ${docsPathValidation.error}`)
        return 1
      }
    }

    if (!validateDocHistoryMode(config.docHistoryMode)) {
      console.error("Error: invalid docHistoryMode")
      return 1
    }

    const designPathValidation = validateDesignPath(config.designPath ?? designPath)
    if (!designPathValidation.valid) {
      console.error(`Error: ${designPathValidation.error}`)
      return 1
    }

    const writeResult = writeWunderkindConfig(config, "project")
    if (!writeResult.success) {
      console.error(`Error: Failed to write project config: ${writeResult.error}`)
      return 1
    }

    if (shouldMergeStitchProjectConfig) {
      await mergeStitchMcpConfig(cwd)
    }

    if (stitchSecretValue !== null) {
      await writeStitchSecretFile(stitchSecretValue, cwd)
    }

    if (shouldBootstrapDesignFile) {
      bootstrapDesignMd(designPath, cwd)
    }

    const nativeAgentsResult = writeNativeAgentFiles("project")
    if (!nativeAgentsResult.success) {
      console.error(`Error: Failed to write native agent files: ${nativeAgentsResult.error}`)
      return 1
    }

    const nativeCommandsResult = writeNativeCommandFiles()
    if (!nativeCommandsResult.success) {
      console.error(`Error: Failed to write native command files: ${nativeCommandsResult.error}`)
      return 1
    }

    const nativeSkillsResult = writeNativeSkillFiles("project")
    if (!nativeSkillsResult.success) {
      console.error(`Error: Failed to write native skill files: ${nativeSkillsResult.error}`)
      return 1
    }

    ensureFile(join(cwd, "AGENTS.md"), AGENTS_MD_PLACEHOLDER)
    ensureDir(join(cwd, ".sisyphus", "plans"))
    ensureDir(join(cwd, ".sisyphus", "notepads"))
    ensureDir(join(cwd, ".sisyphus", "evidence"))

    if (soulAnswers.size > 0) {
      const soulsDir = join(cwd, ".wunderkind", "souls")
      ensureDir(soulsDir)
      for (const persona of SOUL_PERSONAS) {
        const answers = soulAnswers.get(persona.agentKey)
        if (!answers) continue
        writeFileSync(join(soulsDir, `${persona.agentKey}.md`), renderSoulFile(persona, answers))
      }
    }

    if (config.docsEnabled) {
      bootstrapDocsReadme(config.docsPath, cwd)
    }

    console.log(`Initialized project in ${cwd}`)
    console.log(`Project config: ${writeResult.configPath}`)
    if (!noTui) {
      console.log("Tip: Run 'wunderkind doctor --verbose' to review the retained personas and docs/runtime settings later.")
    }
    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
