import * as p from "@clack/prompts"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { detectCurrentConfig, writeWunderkindConfig } from "./config-manager/index.js"
import { bootstrapDocsReadme, validateDocHistoryMode, validateDocsPath } from "./docs-output-helper.js"
import type {
  BrandPersonality,
  CisoPersonality,
  CmoPersonality,
  CreativePersonality,
  CtoPersonality,
  DataAnalystPersonality,
  DevrelPersonality,
  DocHistoryMode,
  InstallConfig,
  LegalPersonality,
  OpsPersonality,
  OrgStructure,
  ProductPersonality,
  QaPersonality,
  SupportPersonality,
  TeamCulture,
} from "./types.js"

export interface InitOptions {
  noTui?: boolean
  docsEnabled?: boolean
  docsPath?: string
  docHistoryMode?: string
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

function toDocsEnabled(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === "yes" || normalized === "y" || normalized === "true") return true
  if (normalized === "no" || normalized === "n" || normalized === "false") return false
  return null
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
      qaPersonality: detected.qaPersonality,
      productPersonality: detected.productPersonality,
      opsPersonality: detected.opsPersonality,
      creativePersonality: detected.creativePersonality,
      brandPersonality: detected.brandPersonality,
      devrelPersonality: detected.devrelPersonality,
      legalPersonality: detected.legalPersonality,
      supportPersonality: detected.supportPersonality,
      dataAnalystPersonality: detected.dataAnalystPersonality,
      docsEnabled: options.docsEnabled ?? detected.docsEnabled,
      docsPath: options.docsPath ?? detected.docsPath,
      docHistoryMode: normalizeDocHistoryMode(options.docHistoryMode ?? detected.docHistoryMode),
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

      const cisoPersonality = await promptSelect<CisoPersonality>(
        "CISO personality:",
        [
          { value: "paranoid-enforcer", label: "paranoid-enforcer" },
          { value: "pragmatic-risk-manager", label: "pragmatic-risk-manager" },
          { value: "educator-collaborator", label: "educator-collaborator" },
        ],
        config.cisoPersonality,
      )
      if (cisoPersonality === null) return 1

      const ctoPersonality = await promptSelect<CtoPersonality>(
        "CTO/Fullstack personality:",
        [
          { value: "grizzled-sysadmin", label: "grizzled-sysadmin" },
          { value: "startup-bro", label: "startup-bro" },
          { value: "code-archaeologist", label: "code-archaeologist" },
        ],
        config.ctoPersonality,
      )
      if (ctoPersonality === null) return 1

      const cmoPersonality = await promptSelect<CmoPersonality>(
        "CMO/Marketing personality:",
        [
          { value: "data-driven", label: "data-driven" },
          { value: "brand-storyteller", label: "brand-storyteller" },
          { value: "growth-hacker", label: "growth-hacker" },
        ],
        config.cmoPersonality,
      )
      if (cmoPersonality === null) return 1

      const qaPersonality = await promptSelect<QaPersonality>(
        "QA personality:",
        [
          { value: "rule-enforcer", label: "rule-enforcer" },
          { value: "risk-based-pragmatist", label: "risk-based-pragmatist" },
          { value: "rubber-duck", label: "rubber-duck" },
        ],
        config.qaPersonality,
      )
      if (qaPersonality === null) return 1

      const productPersonality = await promptSelect<ProductPersonality>(
        "Product personality:",
        [
          { value: "user-advocate", label: "user-advocate" },
          { value: "velocity-optimizer", label: "velocity-optimizer" },
          { value: "outcome-obsessed", label: "outcome-obsessed" },
        ],
        config.productPersonality,
      )
      if (productPersonality === null) return 1

      const opsPersonality = await promptSelect<OpsPersonality>(
        "Operations personality:",
        [
          { value: "on-call-veteran", label: "on-call-veteran" },
          { value: "efficiency-maximiser", label: "efficiency-maximiser" },
          { value: "process-purist", label: "process-purist" },
        ],
        config.opsPersonality,
      )
      if (opsPersonality === null) return 1

      const creativePersonality = await promptSelect<CreativePersonality>(
        "Creative Director personality:",
        [
          { value: "perfectionist-craftsperson", label: "perfectionist-craftsperson" },
          { value: "bold-provocateur", label: "bold-provocateur" },
          { value: "pragmatic-problem-solver", label: "pragmatic-problem-solver" },
        ],
        config.creativePersonality,
      )
      if (creativePersonality === null) return 1

      const brandPersonality = await promptSelect<BrandPersonality>(
        "Brand Builder personality:",
        [
          { value: "community-evangelist", label: "community-evangelist" },
          { value: "pr-spinner", label: "pr-spinner" },
          { value: "authentic-builder", label: "authentic-builder" },
        ],
        config.brandPersonality,
      )
      if (brandPersonality === null) return 1

      const devrelPersonality = await promptSelect<DevrelPersonality>(
        "DevRel personality:",
        [
          { value: "community-champion", label: "community-champion" },
          { value: "docs-perfectionist", label: "docs-perfectionist" },
          { value: "dx-engineer", label: "dx-engineer" },
        ],
        config.devrelPersonality,
      )
      if (devrelPersonality === null) return 1

      const legalPersonality = await promptSelect<LegalPersonality>(
        "Legal Counsel personality:",
        [
          { value: "cautious-gatekeeper", label: "cautious-gatekeeper" },
          { value: "pragmatic-advisor", label: "pragmatic-advisor" },
          { value: "plain-english-counselor", label: "plain-english-counselor" },
        ],
        config.legalPersonality,
      )
      if (legalPersonality === null) return 1

      const supportPersonality = await promptSelect<SupportPersonality>(
        "Support Engineer personality:",
        [
          { value: "empathetic-resolver", label: "empathetic-resolver" },
          { value: "systematic-triage", label: "systematic-triage" },
          { value: "knowledge-builder", label: "knowledge-builder" },
        ],
        config.supportPersonality,
      )
      if (supportPersonality === null) return 1

      const dataAnalystPersonality = await promptSelect<DataAnalystPersonality>(
        "Data Analyst personality:",
        [
          { value: "rigorous-statistician", label: "rigorous-statistician" },
          { value: "insight-storyteller", label: "insight-storyteller" },
          { value: "pragmatic-quant", label: "pragmatic-quant" },
        ],
        config.dataAnalystPersonality,
      )
      if (dataAnalystPersonality === null) return 1

      const docsEnabledRaw = await p.text({
        message: "Enable docs output to disk? (yes/no)",
        placeholder: "no",
        initialValue: config.docsEnabled ? "yes" : "no",
        validate: (v) => (toDocsEnabled(v) === null ? "Enter yes or no" : undefined),
      })
      if (p.isCancel(docsEnabledRaw)) return 1
      const docsEnabled = toDocsEnabled(docsEnabledRaw)
      if (docsEnabled === null) {
        console.error("Error: Invalid docs-enabled value")
        return 1
      }

      let docsPath = config.docsPath
      let docHistoryMode: DocHistoryMode = config.docHistoryMode
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

        const docHistoryModeRaw = await p.text({
          message: "Docs history mode:",
          placeholder: "overwrite",
          initialValue: config.docHistoryMode,
          validate: (v) => (validateDocHistoryMode(v) ? undefined : "Invalid mode"),
        })
        if (p.isCancel(docHistoryModeRaw)) return 1
        if (!validateDocHistoryMode(docHistoryModeRaw)) {
          console.error("Error: Invalid docHistoryMode")
          return 1
        }
        docHistoryMode = docHistoryModeRaw
      }

      config.teamCulture = teamCulture
      config.orgStructure = orgStructure
      config.cisoPersonality = cisoPersonality
      config.ctoPersonality = ctoPersonality
      config.cmoPersonality = cmoPersonality
      config.qaPersonality = qaPersonality
      config.productPersonality = productPersonality
      config.opsPersonality = opsPersonality
      config.creativePersonality = creativePersonality
      config.brandPersonality = brandPersonality
      config.devrelPersonality = devrelPersonality
      config.legalPersonality = legalPersonality
      config.supportPersonality = supportPersonality
      config.dataAnalystPersonality = dataAnalystPersonality
      config.docsEnabled = docsEnabled
      config.docsPath = docsPath
      config.docHistoryMode = docHistoryMode
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

    ensureFile(join(cwd, "AGENTS.md"), AGENTS_MD_PLACEHOLDER)
    ensureDir(join(cwd, ".sisyphus", "plans"))
    ensureDir(join(cwd, ".sisyphus", "notepads"))
    ensureDir(join(cwd, ".sisyphus", "evidence"))

    if (config.docsEnabled) {
      bootstrapDocsReadme(config.docsPath, cwd)
    }

    console.log(`Initialized project in ${cwd}`)
    console.log(`Project config: ${writeResult.configPath}`)
    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
