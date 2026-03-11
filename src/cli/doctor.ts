import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import color from "picocolors"
import {
  detectCurrentConfig,
  readGlobalWunderkindConfig,
  readProjectWunderkindConfig,
  resolveOpenCodeConfigPath,
} from "./config-manager/index.js"
import { isProjectContext } from "./init.js"

export interface DoctorOptions {
  verbose?: boolean
}

function status(value: boolean): string {
  return value ? color.green("✓ yes") : color.red("✗ no")
}

function section(title: string): void {
  console.log(`\n${color.bold(color.cyan(title))}`)
}

function line(label: string, value: string): void {
  console.log(`${color.dim("- ")}${color.bold(label)} ${value}`)
}

export async function runDoctor(): Promise<number> {
  return runDoctorWithOptions({})
}

export async function runDoctorWithOptions(options: DoctorOptions): Promise<number> {
  try {
    const cwd = process.cwd()
    const inProject = isProjectContext(cwd)
    const detected = detectCurrentConfig()
    const globalConfig = readGlobalWunderkindConfig()
    const projectConfig = readProjectWunderkindConfig()
    const globalOpenCodeResolution = resolveOpenCodeConfigPath("global")
    const projectOpenCodeResolution = resolveOpenCodeConfigPath("project")

    const globalOpenCodePath = detected.globalOpenCodeConfigPath ?? globalOpenCodeResolution.path
    const projectOpenCodePath = detected.projectOpenCodeConfigPath ?? projectOpenCodeResolution.path
    const globalConfigPath = join(homedir(), ".wunderkind", "wunderkind.config.jsonc")
    const localConfigPath = join(cwd, ".wunderkind", "wunderkind.config.jsonc")
    const globalConfigExists = existsSync(globalConfigPath)
    const localConfigExists = existsSync(localConfigPath)

    const warnings: string[] = []

    const scopeLabel =
      detected.registrationScope === "both"
        ? color.yellow("both")
        : detected.registrationScope === "project"
          ? color.cyan("project")
          : detected.registrationScope === "global"
            ? color.cyan("global")
            : color.red("none")

    section("Install Summary")
    line("installed:", status(detected.isInstalled))
    line("effective scope:", scopeLabel)
    line("global registration:", status(detected.globalInstalled === true))
    line("project registration:", status(detected.projectInstalled === true))

    if (options.verbose) {
      section("Resolved Paths")
      line(
        "global OpenCode config:",
        `${color.dim(globalOpenCodePath)} ${color.dim(`(${globalOpenCodeResolution.source})`)}`,
      )
      line(
        "project OpenCode config:",
        `${color.dim(projectOpenCodePath)} ${color.dim(`(${projectOpenCodeResolution.source})`)}`,
      )
      line("global Wunderkind config:", `${status(globalConfigExists)} ${color.dim(globalConfigPath)}`)
      line("project Wunderkind config:", `${status(localConfigExists)} ${color.dim(localConfigPath)}`)

      section("Active Configuration")
      line("region:", color.cyan(globalConfig?.region ?? detected.region))
      line("industry:", color.cyan((globalConfig?.industry ?? detected.industry) || color.dim("(not set)")))
      line("primary regulation:", color.cyan(globalConfig?.primaryRegulation ?? detected.primaryRegulation))
      if ((globalConfig?.secondaryRegulation ?? detected.secondaryRegulation).trim() !== "") {
        line("secondary regulation:", color.cyan(globalConfig?.secondaryRegulation ?? detected.secondaryRegulation))
      }
    }

    if (inProject) {
      const agentsPath = join(cwd, "AGENTS.md")
      const sisyphusPlansPath = join(cwd, ".sisyphus", "plans")
      const sisyphusNotepadsPath = join(cwd, ".sisyphus", "notepads")
      const sisyphusEvidencePath = join(cwd, ".sisyphus", "evidence")
      const docsPath = join(cwd, detected.docsPath)
      const docsReadmePath = join(docsPath, "README.md")

      const hasAgents = existsSync(agentsPath)
      const hasPlans = existsSync(sisyphusPlansPath)
      const hasNotepads = existsSync(sisyphusNotepadsPath)
      const hasEvidence = existsSync(sisyphusEvidencePath)
      const hasDocsReadme = existsSync(docsReadmePath)

      if (!localConfigExists) warnings.push(`missing local config: ${localConfigPath}`)
      if (!hasAgents) warnings.push(`missing soul file: ${agentsPath}`)
      if (!hasPlans) warnings.push(`missing soul directory: ${sisyphusPlansPath}`)
      if (!hasNotepads) warnings.push(`missing soul directory: ${sisyphusNotepadsPath}`)
      if (!hasEvidence) warnings.push(`missing soul directory: ${sisyphusEvidencePath}`)
      if (detected.docsEnabled && !hasDocsReadme) warnings.push(`missing docs README: ${docsReadmePath}`)

      section(options.verbose ? "Project Health" : "Project health")
      line("cwd:", color.dim(cwd))
      line("AGENTS.md present:", status(hasAgents))
      line(".sisyphus/plans present:", status(hasPlans))
      line(".sisyphus/notepads present:", status(hasNotepads))
      line(".sisyphus/evidence present:", status(hasEvidence))

      if (options.verbose) {
        section("Documentation Context")
        line("team culture:", color.cyan(projectConfig?.teamCulture ?? detected.teamCulture))
        line("org structure:", color.cyan(projectConfig?.orgStructure ?? detected.orgStructure))
        line("docs-output enabled:", status((projectConfig?.docsEnabled ?? detected.docsEnabled) === true))
        line("docs-output path:", color.cyan(projectConfig?.docsPath ?? detected.docsPath))
        line("docs-output history mode:", color.cyan(projectConfig?.docHistoryMode ?? detected.docHistoryMode))
      } else {
        line("docs-output enabled:", status((projectConfig?.docsEnabled ?? detected.docsEnabled) === true))
      }

      if ((projectConfig?.docsEnabled ?? detected.docsEnabled) === true) {
        line("docs README present:", status(hasDocsReadme))
      }

      if (detected.legacyGlobalProjectFields?.length) {
        warnings.push(
          `legacy global project-local fields detected: ${detected.legacyGlobalProjectFields.join(", ")}`,
        )
      }
      if (!localConfigExists) {
        warnings.push("project is not initialized; using packaged defaults for soul/docs settings")
      }
    } else {
      section(options.verbose ? "Project Health" : "Project health")
      line("cwd:", color.dim(cwd))
      line("project context detected:", status(false))
      line("note:", "Current directory does not look like a project; skipping soul-file checks.")
    }

    if (warnings.length > 0) {
      section("Warnings")
      for (const warning of warnings) {
        console.log(`${color.dim("- ")}${color.yellow(warning)}`)
      }
    }

    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
