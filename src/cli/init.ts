import * as p from "@clack/prompts"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { detectCurrentConfig, writeWunderkindConfig } from "./config-manager/index.js"
import { bootstrapDocsReadme, validateDocHistoryMode, validateDocsPath } from "./docs-output-helper.js"
import type { DocHistoryMode, InstallConfig } from "./types.js"

export interface InitOptions {
  noTui?: boolean
  region?: string
  industry?: string
  primaryRegulation?: string
  secondaryRegulation?: string
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
      region: options.region ?? detected.region,
      industry: options.industry ?? detected.industry,
      primaryRegulation: options.primaryRegulation ?? detected.primaryRegulation,
      secondaryRegulation: options.secondaryRegulation ?? detected.secondaryRegulation,
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
      const region = await p.text({
        message: "Project region:",
        placeholder: "Global",
        initialValue: config.region,
        validate: (v) => (v.trim() ? undefined : "Region is required"),
      })
      if (p.isCancel(region)) return 1

      const industry = await p.text({
        message: "Project industry:",
        placeholder: "SaaS",
        initialValue: config.industry,
      })
      if (p.isCancel(industry)) return 1

      const primaryRegulation = await p.text({
        message: "Primary regulation:",
        placeholder: "GDPR",
        initialValue: config.primaryRegulation,
        validate: (v) => (v.trim() ? undefined : "Primary regulation is required"),
      })
      if (p.isCancel(primaryRegulation)) return 1

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

      config.region = (region as string).trim() || "Global"
      config.industry = (industry as string).trim()
      config.primaryRegulation = (primaryRegulation as string).trim() || "GDPR"
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
