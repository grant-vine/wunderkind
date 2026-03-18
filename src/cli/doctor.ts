import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import color from "picocolors"
import {
  detectOmoVersionInfo,
  detectNativeAgentFiles,
  detectNativeCommandFiles,
  detectNativeSkillFiles,
  detectCurrentConfig,
  detectWunderkindVersionInfo,
  readProjectWunderkindConfig,
  resolveOpenCodeConfigPath,
} from "./config-manager/index.js"
import { isProjectContext } from "./init.js"
import { PERSONALITY_META } from "./personality-meta.js"

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
    const projectConfig = readProjectWunderkindConfig()
    const globalOpenCodeResolution = resolveOpenCodeConfigPath("global")
    const projectOpenCodeResolution = resolveOpenCodeConfigPath("project")

    const globalOpenCodePath = detected.globalOpenCodeConfigPath ?? globalOpenCodeResolution.path
    const projectOpenCodePath = detected.projectOpenCodeConfigPath ?? projectOpenCodeResolution.path
    const globalConfigPath = join(homedir(), ".wunderkind", "wunderkind.config.jsonc")
    const localConfigPath = join(cwd, ".wunderkind", "wunderkind.config.jsonc")
    const globalConfigExists = existsSync(globalConfigPath)
    const localConfigExists = existsSync(localConfigPath)
    const wunderkindVersion = detectWunderkindVersionInfo()
    const omoVersion = detectOmoVersionInfo()

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

    let projectRegistrationStatus: string
    if (detected.projectInstalled === true) {
      projectRegistrationStatus = color.green("✓ yes")
    } else if (detected.globalInstalled === true) {
      projectRegistrationStatus = color.dim("✗ no")
    } else {
      projectRegistrationStatus = color.red("✗ no")
    }
    line("project registration:", projectRegistrationStatus)

    section("Version Status")
    line("wunderkind cli version:", color.cyan(wunderkindVersion.currentVersion ?? "unknown"))
    line(
      "oh-my-openagent registration:",
      omoVersion.registered
        ? `${color.green("✓ yes")} ${color.dim(`(${omoVersion.registeredEntry})`)}`
        : color.dim("✗ not detected"),
    )
    line("oh-my-openagent loaded version:", color.cyan(omoVersion.loadedVersion ?? color.dim("unknown")))

    if (omoVersion.staleOverrideWarning) {
      warnings.push(omoVersion.staleOverrideWarning)
      line("oh-my-openagent warning:", color.yellow(omoVersion.staleOverrideWarning))
    }

    const versionAdvice = !omoVersion.registered
      ? "oh-my-openagent not detected — upgrade Wunderkind independently unless you intentionally use it separately."
      : omoVersion.loadedVersion === null
        ? "oh-my-openagent is registered but its loaded version could not be determined locally — verify before upgrading both together."
        : omoVersion.staleOverrideWarning
          ? "A stale global oh-my-openagent install is likely overriding a newer cache copy — refresh the global install and restart OpenCode."
        : "Versions are advisory only — upgrade Wunderkind and oh-my-openagent independently unless your test case requires both."
    line("upgrade guidance:", color.dim(versionAdvice))

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
      const globalNativeAgents = detectNativeAgentFiles("global")
      const globalNativeCommands = detectNativeCommandFiles()
      const globalNativeSkills = detectNativeSkillFiles("global")
      line("global native agents dir:", `${status(globalNativeAgents.allPresent)} ${color.dim(globalNativeAgents.dir)}`)
      line("global native commands dir:", `${status(globalNativeCommands.allPresent)} ${color.dim(globalNativeCommands.dir)}`)
      line("global native skills dir:", `${status(globalNativeSkills.allPresent)} ${color.dim(globalNativeSkills.dir)}`)
      line("global Wunderkind config:", `${status(globalConfigExists)} ${color.dim(globalConfigPath)}`)
      line("project Wunderkind config:", `${status(localConfigExists)} ${color.dim(localConfigPath)}`)
      if (omoVersion.configPath) {
        line("oh-my-openagent config source:", color.dim(omoVersion.configPath))
      }
      if (omoVersion.loadedPackagePath) {
        line("oh-my-openagent loaded package:", color.dim(omoVersion.loadedPackagePath))
      }
      if (omoVersion.loadedSources?.global.packagePath) {
        const globalVersionLabel = omoVersion.loadedSources.global.version ?? "unknown"
        line(
          "oh-my-openagent global package:",
          `${color.dim(omoVersion.loadedSources.global.packagePath)} ${color.dim(`(${globalVersionLabel})`)}`,
        )
      }
      if (omoVersion.loadedSources?.cache.packagePath) {
        const cacheVersionLabel = omoVersion.loadedSources.cache.version ?? "unknown"
        line(
          "oh-my-openagent cache package:",
          `${color.dim(omoVersion.loadedSources.cache.packagePath)} ${color.dim(`(${cacheVersionLabel})`)}`,
        )
      }

      section("Active Configuration")
      line("region:", color.cyan(detected.region))
      line("industry:", color.cyan(detected.industry || color.dim("(not set)")))
      line("primary regulation:", color.cyan(detected.primaryRegulation))
      if (detected.secondaryRegulation.trim() !== "") {
        line("secondary regulation:", color.cyan(detected.secondaryRegulation))
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
      const globalNativeAgents = detectNativeAgentFiles("global")
      const globalNativeCommands = detectNativeCommandFiles()
      const globalNativeSkills = detectNativeSkillFiles("global")

      if (!localConfigExists) warnings.push(`missing local config: ${localConfigPath}`)
      if (!hasAgents) warnings.push(`missing soul file: ${agentsPath}`)
      if (!hasPlans) warnings.push(`missing soul directory: ${sisyphusPlansPath}`)
      if (!hasNotepads) warnings.push(`missing soul directory: ${sisyphusNotepadsPath}`)
      if (!hasEvidence) warnings.push(`missing soul directory: ${sisyphusEvidencePath}`)
      if (detected.docsEnabled && !hasDocsReadme) warnings.push(`missing docs README: ${docsReadmePath}`)
      if (detected.globalInstalled === true && !globalNativeAgents.allPresent) {
        warnings.push(`missing native global agent files: ${globalNativeAgents.dir}`)
      }
      if (detected.globalInstalled === true && !globalNativeCommands.allPresent) {
        warnings.push(`missing native global command files: ${globalNativeCommands.dir}`)
      }
      if (detected.globalInstalled === true && !globalNativeSkills.allPresent) {
        warnings.push(`missing native global skill files: ${globalNativeSkills.dir}`)
      }

      section(options.verbose ? "Project Health" : "Project health")
      line("cwd:", color.dim(cwd))
      line("AGENTS.md present:", status(hasAgents))
      line(".sisyphus/plans present:", status(hasPlans))
      line(".sisyphus/notepads present:", status(hasNotepads))
      line(".sisyphus/evidence present:", status(hasEvidence))
      line("global native agents present:", status(globalNativeAgents.allPresent))
      line("global native commands present:", status(globalNativeCommands.allPresent))
      line("global native skills present:", status(globalNativeSkills.allPresent))

      if (options.verbose) {
        section("Project Configuration")
        line("team culture:", color.cyan(projectConfig?.teamCulture ?? detected.teamCulture))
        line("org structure:", color.cyan(projectConfig?.orgStructure ?? detected.orgStructure))
        line("docs-output enabled:", status((projectConfig?.docsEnabled ?? detected.docsEnabled) === true))
        line("docs-output path:", color.cyan(projectConfig?.docsPath ?? detected.docsPath))
        line("docs-output history mode:", color.cyan(projectConfig?.docHistoryMode ?? detected.docHistoryMode))

        section("Agent Personalities")
        const cisoVal = projectConfig?.cisoPersonality ?? detected.cisoPersonality
        line("ciso:", `${color.cyan(cisoVal)}  ${color.dim(`(${PERSONALITY_META.ciso[cisoVal]?.hint ?? cisoVal})`)}`)
        const ctoVal = projectConfig?.ctoPersonality ?? detected.ctoPersonality
        line("fullstack:", `${color.cyan(ctoVal)}  ${color.dim(`(${PERSONALITY_META.cto[ctoVal]?.hint ?? ctoVal})`)}`)
        const cmoVal = projectConfig?.cmoPersonality ?? detected.cmoPersonality
        line("marketing:", `${color.cyan(cmoVal)}  ${color.dim(`(${PERSONALITY_META.cmo[cmoVal]?.hint ?? cmoVal})`)}`)
        const qaVal = projectConfig?.qaPersonality ?? detected.qaPersonality
        line("qa:", `${color.cyan(qaVal)}  ${color.dim(`(${PERSONALITY_META.qa[qaVal]?.hint ?? qaVal})`)}`)
        const productVal = projectConfig?.productPersonality ?? detected.productPersonality
        line("product:", `${color.cyan(productVal)}  ${color.dim(`(${PERSONALITY_META.product[productVal]?.hint ?? productVal})`)}`)
        const opsVal = projectConfig?.opsPersonality ?? detected.opsPersonality
        line("ops:", `${color.cyan(opsVal)}  ${color.dim(`(${PERSONALITY_META.ops[opsVal]?.hint ?? opsVal})`)}`)
        const creativeVal = projectConfig?.creativePersonality ?? detected.creativePersonality
        line("creative:", `${color.cyan(creativeVal)}  ${color.dim(`(${PERSONALITY_META.creative[creativeVal]?.hint ?? creativeVal})`)}`)
        const brandVal = projectConfig?.brandPersonality ?? detected.brandPersonality
        line("brand:", `${color.cyan(brandVal)}  ${color.dim(`(${PERSONALITY_META.brand[brandVal]?.hint ?? brandVal})`)}`)
        const devrelVal = projectConfig?.devrelPersonality ?? detected.devrelPersonality
        line("devrel:", `${color.cyan(devrelVal)}  ${color.dim(`(${PERSONALITY_META.devrel[devrelVal]?.hint ?? devrelVal})`)}`)
        const legalVal = projectConfig?.legalPersonality ?? detected.legalPersonality
        line("legal:", `${color.cyan(legalVal)}  ${color.dim(`(${PERSONALITY_META.legal[legalVal]?.hint ?? legalVal})`)}`)
        const supportVal = projectConfig?.supportPersonality ?? detected.supportPersonality
        line("support:", `${color.cyan(supportVal)}  ${color.dim(`(${PERSONALITY_META.support[supportVal]?.hint ?? supportVal})`)}`)
        const dataAnalystVal = projectConfig?.dataAnalystPersonality ?? detected.dataAnalystPersonality
        line("data analyst:", `${color.cyan(dataAnalystVal)}  ${color.dim(`(${PERSONALITY_META.dataAnalyst[dataAnalystVal]?.hint ?? dataAnalystVal})`)}`)
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
        warnings.push("project is not initialized; using global/native defaults for agent and soul/docs settings")
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
