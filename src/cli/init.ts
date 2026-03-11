import * as p from "@clack/prompts"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { detectCurrentConfig, writeNativeAgentFiles, writeWunderkindConfig } from "./config-manager/index.js"
import { bootstrapDocsReadme, validateDocHistoryMode, validateDocsPath } from "./docs-output-helper.js"
import { DOCS_HISTORY_META, PERSONALITY_META } from "./personality-meta.js"
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

      const customizeSpecialistPersonalities = await p.confirm({
        message: "Customize specialist personalities for this project?",
        initialValue: false,
      })
      if (p.isCancel(customizeSpecialistPersonalities)) return 1

      if (customizeSpecialistPersonalities) {
        const cisoPersonality = await promptSelect<CisoPersonality>(
          "CISO personality:",
          [
            { value: "paranoid-enforcer", label: "paranoid-enforcer", hint: PERSONALITY_META.ciso["paranoid-enforcer"]!.hint },
            { value: "pragmatic-risk-manager", label: "pragmatic-risk-manager", hint: PERSONALITY_META.ciso["pragmatic-risk-manager"]!.hint },
            { value: "educator-collaborator", label: "educator-collaborator", hint: PERSONALITY_META.ciso["educator-collaborator"]!.hint },
          ],
          config.cisoPersonality,
        )
        if (cisoPersonality === null) return 1

        const ctoPersonality = await promptSelect<CtoPersonality>(
          "CTO/Fullstack personality:",
          [
            { value: "grizzled-sysadmin", label: "grizzled-sysadmin", hint: PERSONALITY_META.cto["grizzled-sysadmin"]!.hint },
            { value: "startup-bro", label: "startup-bro", hint: PERSONALITY_META.cto["startup-bro"]!.hint },
            { value: "code-archaeologist", label: "code-archaeologist", hint: PERSONALITY_META.cto["code-archaeologist"]!.hint },
          ],
          config.ctoPersonality,
        )
        if (ctoPersonality === null) return 1

        const cmoPersonality = await promptSelect<CmoPersonality>(
          "CMO/Marketing personality:",
          [
            { value: "data-driven", label: "data-driven", hint: PERSONALITY_META.cmo["data-driven"]!.hint },
            { value: "brand-storyteller", label: "brand-storyteller", hint: PERSONALITY_META.cmo["brand-storyteller"]!.hint },
            { value: "growth-hacker", label: "growth-hacker", hint: PERSONALITY_META.cmo["growth-hacker"]!.hint },
          ],
          config.cmoPersonality,
        )
        if (cmoPersonality === null) return 1

        const qaPersonality = await promptSelect<QaPersonality>(
          "QA personality:",
          [
            { value: "rule-enforcer", label: "rule-enforcer", hint: PERSONALITY_META.qa["rule-enforcer"]!.hint },
            { value: "risk-based-pragmatist", label: "risk-based-pragmatist", hint: PERSONALITY_META.qa["risk-based-pragmatist"]!.hint },
            { value: "rubber-duck", label: "rubber-duck", hint: PERSONALITY_META.qa["rubber-duck"]!.hint },
          ],
          config.qaPersonality,
        )
        if (qaPersonality === null) return 1

        const productPersonality = await promptSelect<ProductPersonality>(
          "Product personality:",
          [
            { value: "user-advocate", label: "user-advocate", hint: PERSONALITY_META.product["user-advocate"]!.hint },
            { value: "velocity-optimizer", label: "velocity-optimizer", hint: PERSONALITY_META.product["velocity-optimizer"]!.hint },
            { value: "outcome-obsessed", label: "outcome-obsessed", hint: PERSONALITY_META.product["outcome-obsessed"]!.hint },
          ],
          config.productPersonality,
        )
        if (productPersonality === null) return 1

        const opsPersonality = await promptSelect<OpsPersonality>(
          "Operations personality:",
          [
            { value: "on-call-veteran", label: "on-call-veteran", hint: PERSONALITY_META.ops["on-call-veteran"]!.hint },
            { value: "efficiency-maximiser", label: "efficiency-maximiser", hint: PERSONALITY_META.ops["efficiency-maximiser"]!.hint },
            { value: "process-purist", label: "process-purist", hint: PERSONALITY_META.ops["process-purist"]!.hint },
          ],
          config.opsPersonality,
        )
        if (opsPersonality === null) return 1

        const creativePersonality = await promptSelect<CreativePersonality>(
          "Creative Director personality:",
          [
            { value: "perfectionist-craftsperson", label: "perfectionist-craftsperson", hint: PERSONALITY_META.creative["perfectionist-craftsperson"]!.hint },
            { value: "bold-provocateur", label: "bold-provocateur", hint: PERSONALITY_META.creative["bold-provocateur"]!.hint },
            { value: "pragmatic-problem-solver", label: "pragmatic-problem-solver", hint: PERSONALITY_META.creative["pragmatic-problem-solver"]!.hint },
          ],
          config.creativePersonality,
        )
        if (creativePersonality === null) return 1

        const brandPersonality = await promptSelect<BrandPersonality>(
          "Brand Builder personality:",
          [
            { value: "community-evangelist", label: "community-evangelist", hint: PERSONALITY_META.brand["community-evangelist"]!.hint },
            { value: "pr-spinner", label: "pr-spinner", hint: PERSONALITY_META.brand["pr-spinner"]!.hint },
            { value: "authentic-builder", label: "authentic-builder", hint: PERSONALITY_META.brand["authentic-builder"]!.hint },
          ],
          config.brandPersonality,
        )
        if (brandPersonality === null) return 1

        const devrelPersonality = await promptSelect<DevrelPersonality>(
          "DevRel personality:",
          [
            { value: "community-champion", label: "community-champion", hint: PERSONALITY_META.devrel["community-champion"]!.hint },
            { value: "docs-perfectionist", label: "docs-perfectionist", hint: PERSONALITY_META.devrel["docs-perfectionist"]!.hint },
            { value: "dx-engineer", label: "dx-engineer", hint: PERSONALITY_META.devrel["dx-engineer"]!.hint },
          ],
          config.devrelPersonality,
        )
        if (devrelPersonality === null) return 1

        const legalPersonality = await promptSelect<LegalPersonality>(
          "Legal Counsel personality:",
          [
            { value: "cautious-gatekeeper", label: "cautious-gatekeeper", hint: PERSONALITY_META.legal["cautious-gatekeeper"]!.hint },
            { value: "pragmatic-advisor", label: "pragmatic-advisor", hint: PERSONALITY_META.legal["pragmatic-advisor"]!.hint },
            { value: "plain-english-counselor", label: "plain-english-counselor", hint: PERSONALITY_META.legal["plain-english-counselor"]!.hint },
          ],
          config.legalPersonality,
        )
        if (legalPersonality === null) return 1

        const supportPersonality = await promptSelect<SupportPersonality>(
          "Support Engineer personality:",
          [
            { value: "empathetic-resolver", label: "empathetic-resolver", hint: PERSONALITY_META.support["empathetic-resolver"]!.hint },
            { value: "systematic-triage", label: "systematic-triage", hint: PERSONALITY_META.support["systematic-triage"]!.hint },
            { value: "knowledge-builder", label: "knowledge-builder", hint: PERSONALITY_META.support["knowledge-builder"]!.hint },
          ],
          config.supportPersonality,
        )
        if (supportPersonality === null) return 1

        const dataAnalystPersonality = await promptSelect<DataAnalystPersonality>(
          "Data Analyst personality:",
          [
            { value: "rigorous-statistician", label: "rigorous-statistician", hint: PERSONALITY_META.dataAnalyst["rigorous-statistician"]!.hint },
            { value: "insight-storyteller", label: "insight-storyteller", hint: PERSONALITY_META.dataAnalyst["insight-storyteller"]!.hint },
            { value: "pragmatic-quant", label: "pragmatic-quant", hint: PERSONALITY_META.dataAnalyst["pragmatic-quant"]!.hint },
          ],
          config.dataAnalystPersonality,
        )
        if (dataAnalystPersonality === null) return 1

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
      }

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

    ensureFile(join(cwd, "AGENTS.md"), AGENTS_MD_PLACEHOLDER)
    ensureDir(join(cwd, ".sisyphus", "plans"))
    ensureDir(join(cwd, ".sisyphus", "notepads"))
    ensureDir(join(cwd, ".sisyphus", "evidence"))

    if (config.docsEnabled) {
      bootstrapDocsReadme(config.docsPath, cwd)
    }

    console.log(`Initialized project in ${cwd}`)
    console.log(`Project config: ${writeResult.configPath}`)
    if (!noTui) {
      console.log("Tip: Run 'wunderkind doctor --verbose' or edit .wunderkind/wunderkind.config.jsonc to review specialist personalities later.")
    }
    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
