import * as p from "@clack/prompts"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  detectCurrentConfig,
  detectGitHubWorkflowReadiness,
  writeNativeAgentFiles,
  writeNativeCommandFiles,
  writeNativeSkillFiles,
  writeWunderkindConfig,
} from "./config-manager/index.js"
import { bootstrapDocsReadme, validateDocHistoryMode, validateDocsPath } from "./docs-output-helper.js"
import { DOCS_HISTORY_META, PERSONALITY_META } from "./personality-meta.js"
import type {
  DocHistoryMode,
  InstallConfig,
  OrgStructure,
  PrdPipelineMode,
  TeamCulture,
} from "./types.js"

export interface InitOptions {
  noTui?: boolean
  docsEnabled?: boolean
  docsPath?: string
  docHistoryMode?: string
  prdPipelineMode?: PrdPipelineMode
  desloppifyEnabled?: boolean
}

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
  return "overwrite"
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

interface SoulPersonaDefinition {
  agentKey:
    | "product-wunderkind"
    | "fullstack-wunderkind"
    | "marketing-wunderkind"
    | "creative-director"
    | "ciso"
    | "legal-counsel"
  displayName: string
  questions: readonly [string, string, string, string]
}

interface SoulCustomizationAnswers {
  priorityLens: string
  challengeStyle: string
  projectMemory: string
  antiGoals: string
}

const SOUL_PERSONAS: readonly SoulPersonaDefinition[] = [
  {
    agentKey: "product-wunderkind",
    displayName: "Product Wunderkind",
    questions: [
      "What should Product Wunderkind optimize for first on this project?",
      "How should Product Wunderkind challenge the team when scope, priorities, or evidence are weak?",
      "What recurring product context must Product Wunderkind always remember?",
      "What should Product Wunderkind avoid doing on this project, even when asked indirectly?",
    ],
  },
  {
    agentKey: "fullstack-wunderkind",
    displayName: "Fullstack Wunderkind",
    questions: [
      "What should Fullstack Wunderkind optimize for first on this project: speed, maintainability, reliability, cost, or something else?",
      "When Fullstack Wunderkind finds technical debt or weak architecture, how assertive should it be?",
      "What recurring technical context must Fullstack Wunderkind always remember?",
      "What engineering behaviors should Fullstack Wunderkind avoid on this project?",
    ],
  },
  {
    agentKey: "marketing-wunderkind",
    displayName: "Marketing Wunderkind",
    questions: [
      "What should Marketing Wunderkind optimize for first on this project?",
      "How should Marketing Wunderkind challenge positioning, channel, or launch assumptions that look weak?",
      "What recurring market, audience, or brand context must Marketing Wunderkind always remember?",
      "What marketing behaviors or tactics should Marketing Wunderkind avoid on this project?",
    ],
  },
  {
    agentKey: "creative-director",
    displayName: "Creative Director",
    questions: [
      "What should Creative Director optimize for first on this project?",
      "How should Creative Director challenge weak UX, visual, or brand decisions?",
      "What recurring visual, accessibility, or brand context must Creative Director always remember?",
      "What design behaviors should Creative Director avoid on this project?",
    ],
  },
  {
    agentKey: "ciso",
    displayName: "CISO",
    questions: [
      "What security posture should CISO default to on this project?",
      "How forcefully should CISO escalate or block work when security concerns appear?",
      "What recurring security, privacy, or compliance context must CISO always remember?",
      "What security shortcuts or assumptions must CISO never allow on this project?",
    ],
  },
  {
    agentKey: "legal-counsel",
    displayName: "Legal Counsel",
    questions: [
      "What legal posture should Legal Counsel default to on this project?",
      "How assertively should Legal Counsel escalate legal ambiguity or contractual risk?",
      "What recurring jurisdiction, licensing, or regulatory context must Legal Counsel always remember?",
      "What legal shortcuts, promises, or assumptions must Legal Counsel avoid on this project?",
    ],
  },
] as const

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

async function promptRequiredText(message: string): Promise<string | null> {
  const response = await p.text({
    message,
    validate: (value) => (value.trim() === "" ? "This answer is required" : undefined),
  })
  if (p.isCancel(response)) return null
  return (response as string).trim()
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

    const config: InstallConfig = {
      region: detected.region,
      industry: detected.industry,
      primaryRegulation: detected.primaryRegulation,
      secondaryRegulation: detected.secondaryRegulation,
      teamCulture: detected.teamCulture,
      orgStructure: detected.orgStructure,
      cisoPersonality: detected.cisoPersonality,
      ctoPersonality: detected.ctoPersonality,
      cmoPersonality: detected.cmoPersonality,
      productPersonality: detected.productPersonality,
      creativePersonality: detected.creativePersonality,
      legalPersonality: detected.legalPersonality,
      docsEnabled: options.docsEnabled ?? detected.docsEnabled,
      docsPath: options.docsPath ?? detected.docsPath,
      docHistoryMode: normalizeDocHistoryMode(options.docHistoryMode ?? detected.docHistoryMode),
      prdPipelineMode: options.prdPipelineMode ?? detected.prdPipelineMode,
    }

    if (detected.desloppifyEnabled) {
      config.desloppifyEnabled = true
    }
    if (options.desloppifyEnabled !== undefined) {
      config.desloppifyEnabled = options.desloppifyEnabled
    }

    if (!noTui) {
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
        initialValue: false,
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

          const priorityLens = await promptRequiredText(persona.questions[0])
          if (priorityLens === null) return 1
          const challengeStyle = await promptRequiredText(persona.questions[1])
          if (challengeStyle === null) return 1
          const projectMemory = await promptRequiredText(persona.questions[2])
          if (projectMemory === null) return 1
          const antiGoals = await promptRequiredText(persona.questions[3])
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

      const desloppifyEnabledRaw = await p.confirm({
        message: "Enable Desloppify code-health support? (requires Python 3.11+)",
        initialValue: config.desloppifyEnabled === true,
      })
      if (p.isCancel(desloppifyEnabledRaw)) return 1
      const desloppifyEnabled = desloppifyEnabledRaw

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

      config.teamCulture = teamCulture
      config.orgStructure = orgStructure
      config.docsEnabled = docsEnabled
      config.docsPath = docsPath
      config.docHistoryMode = docHistoryMode
      config.prdPipelineMode = prdPipelineMode
      config.desloppifyEnabled = desloppifyEnabled
    }

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

    const writeResult = writeWunderkindConfig(config, "project")
    if (!writeResult.success) {
      console.error(`Error: Failed to write project config: ${writeResult.error}`)
      return 1
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
