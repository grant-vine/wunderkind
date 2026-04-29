import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import color from "picocolors"
import {
  detectGitHubWorkflowReadiness,
  detectOmoVersionInfo,
  detectNativeAgentFiles,
  detectNativeCommandFiles,
  detectNativeSkillFiles,
  detectCurrentConfig,
  detectWunderkindVersionInfo,
  getNativeCommandFilePaths,
  getProjectOverrideMarker,
  readProjectWunderkindConfig,
  resolveOpenCodeConfigPath,
  summarizeOmoFreshness as summarizeOmoFreshnessInfo,
} from "./config-manager/index.js"
import { isProjectContext } from "./init.js"
import { GOOGLE_STITCH_ADAPTER } from "./mcp-adapters.js"
import { detectStitchMcpPresence, type StitchPresence } from "./mcp-helpers.js"
import { PERSONALITY_META } from "./personality-meta.js"

export interface DoctorOptions {
  verbose?: boolean
}

interface OpenCodeConfig {
  mcp?: Record<string, unknown>
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

function summarizeOmoFreshness(omoVersion: ReturnType<typeof detectOmoVersionInfo>): { label: string; guidance: string } {
  const summary = summarizeOmoFreshnessInfo(omoVersion)

  switch (summary.state) {
    case "not-detected":
      return { label: color.dim("not checked"), guidance: summary.guidance }
    case "stale-override":
      return { label: color.yellow("stale override detected"), guidance: summary.guidance }
    case "version-skew":
      return { label: color.yellow("version skew detected"), guidance: summary.guidance }
    case "not-verified":
      return { label: color.dim("not verified"), guidance: summary.guidance }
    case "up-to-date":
      return { label: color.green("up to date"), guidance: summary.guidance }
    case "update-available":
      return { label: color.yellow("update available"), guidance: summary.guidance }
    case "local-dev":
      return { label: color.cyan("local development mode"), guidance: summary.guidance }
    case "pinned":
      return {
        label: color.magenta(
          `pinned${omoVersion.freshness?.pinnedVersion ? ` (${omoVersion.freshness.pinnedVersion})` : ""}`,
        ),
        guidance: summary.guidance,
      }
    default:
      return { label: color.dim("not verified"), guidance: summary.guidance }
  }
}

function summarizeWunderkindUpgradeCommands(input: {
  registrationScope: "both" | "project" | "global" | "none" | undefined
  globalOpenCodePath: string
  projectOpenCodePath: string
}): { lifecycle: string; packageRefresh: string } {
  const globalInstallCommand = `cd ${JSON.stringify(dirname(input.globalOpenCodePath))} && bun install @grant-vine/wunderkind`
  const projectInstallCommand = `cd ${JSON.stringify(dirname(input.projectOpenCodePath))} && bun install @grant-vine/wunderkind`

  switch (input.registrationScope) {
    case "project":
      return {
        lifecycle: "wunderkind upgrade --scope=project",
        packageRefresh: projectInstallCommand,
      }
    case "both":
      return {
        lifecycle: "wunderkind upgrade --scope=project && wunderkind upgrade --scope=global",
        packageRefresh: `project: ${projectInstallCommand} | global: ${globalInstallCommand}`,
      }
    case "global":
    default:
      return {
        lifecycle: "wunderkind upgrade --scope=global",
        packageRefresh: globalInstallCommand,
      }
  }
}

function configValue(value: string): string {
  return value.trim() !== "" ? value : "(not set)"
}

function renderBaselineLine(label: string, value: string, marker: "●" | "○", sourceLabel: string): void {
  line(label, `${color.cyan(configValue(value))} ${color.dim(`${marker} ${sourceLabel}`)}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function trimOneTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function readOpenCodeConfig(filePath: string): OpenCodeConfig | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    if (content.trim() === "") return null

    const parsed = parseJsonc(content) as unknown
    if (!isRecord(parsed)) return null

    return parsed as OpenCodeConfig
  } catch {
    return null
  }
}

function getStitchEntry(filePath: string): Record<string, unknown> | null {
  const config = readOpenCodeConfig(filePath)
  if (!config || !isRecord(config.mcp)) return null

  const entry = config.mcp[GOOGLE_STITCH_ADAPTER.serverName]
  return isRecord(entry) ? entry : null
}

function isDriftedStitchEntry(entry: Record<string, unknown> | null): boolean {
  if (entry === null) return false
  if (typeof entry.url !== "string") return true
  if (trimOneTrailingSlash(entry.url) !== trimOneTrailingSlash(GOOGLE_STITCH_ADAPTER.remoteUrl)) return true
  return entry.oauth === true
}

function hasDetectedStitchConfig(presence: StitchPresence): boolean {
  return presence !== "missing"
}

function stitchConfigSourceLabel(presence: StitchPresence): "project" | "global" | "both" | "missing" {
  switch (presence) {
    case "project-local":
      return "project"
    case "global-only":
      return "global"
    case "both":
      return "both"
    default:
      return "missing"
  }
}

function stitchOwnershipSummary(ownership: string): string {
  if (ownership === "wunderkind-managed") return "managed"
  if (ownership === "reused-project" || ownership === "reused-global") return "reused"
  return "none"
}

function stitchReadinessSummary(enabled: boolean, configured: boolean, ownership: string): string {
  const enabledLabel = enabled ? color.green("enabled") : color.dim("disabled")
  const configuredLabel = configured ? color.cyan("configured") : color.dim("not configured")
  const ownershipLabel = color.dim(stitchOwnershipSummary(ownership))
  return `${enabledLabel} ${color.dim("/")} ${configuredLabel} ${color.dim("/")} ${ownershipLabel}`
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
    const wunderkindUpgrade = summarizeWunderkindUpgradeCommands({
      registrationScope: detected.registrationScope,
      globalOpenCodePath,
      projectOpenCodePath,
    })
    line("wunderkind lifecycle:", color.dim(wunderkindUpgrade.lifecycle))
    line("wunderkind package refresh:", color.dim(wunderkindUpgrade.packageRefresh))
    line(
      "oh-my-openagent registration:",
      omoVersion.registered
        ? `${color.green("✓ yes")} ${color.dim(`(${omoVersion.registeredEntry})`)}`
        : color.dim("✗ not detected"),
    )
    line("oh-my-openagent loaded version:", color.cyan(omoVersion.loadedVersion ?? color.dim("unknown")))
    if (omoVersion.currentVersion) {
      line("oh-my-openagent reported current version:", color.cyan(omoVersion.currentVersion))
    }

    if (omoVersion.staleOverrideWarning) {
      warnings.push(omoVersion.staleOverrideWarning)
      line("oh-my-openagent warning:", color.yellow(omoVersion.staleOverrideWarning))
    }
    if (omoVersion.versionSkewWarning) {
      warnings.push(omoVersion.versionSkewWarning)
      line("oh-my-openagent warning:", color.yellow(omoVersion.versionSkewWarning))
    }
    if (omoVersion.dualConfigWarning) {
      warnings.push(omoVersion.dualConfigWarning)
      line("oh-my-openagent warning:", color.yellow(omoVersion.dualConfigWarning))
    }

    const omoFreshness = summarizeOmoFreshness(omoVersion)
    line("oh-my-openagent freshness:", omoFreshness.label)
    const versionAdvice = omoFreshness.guidance
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
        const configSourceLabel = omoVersion.configSource ? ` (${omoVersion.configSource})` : ""
        line("oh-my-openagent config source:", `${color.dim(omoVersion.configPath)}${color.dim(configSourceLabel)}`)
      }
      if (omoVersion.legacyConfigPath) {
        line("oh-my-openagent legacy config:", color.dim(omoVersion.legacyConfigPath))
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
      const regionMarker = getProjectOverrideMarker("region", projectConfig ?? null)
      const industryMarker = getProjectOverrideMarker("industry", projectConfig ?? null)
      const primaryRegulationMarker = getProjectOverrideMarker("primaryRegulation", projectConfig ?? null)
      const secondaryRegulationMarker = getProjectOverrideMarker("secondaryRegulation", projectConfig ?? null)
      renderBaselineLine("region:", detected.region, regionMarker.marker, regionMarker.sourceLabel)
      renderBaselineLine("industry:", detected.industry, industryMarker.marker, industryMarker.sourceLabel)
      renderBaselineLine(
        "primary regulation:",
        detected.primaryRegulation,
        primaryRegulationMarker.marker,
        primaryRegulationMarker.sourceLabel,
      )
      renderBaselineLine(
        "secondary regulation:",
        detected.secondaryRegulation,
        secondaryRegulationMarker.marker,
        secondaryRegulationMarker.sourceLabel,
      )
      line("legend:", color.dim("● = project override, ○ = inherited default"))

      section("Workflow Configuration")
      line("PRD pipeline mode:", color.cyan(projectConfig?.prdPipelineMode ?? detected.prdPipelineMode))

      const githubReadiness = detectGitHubWorkflowReadiness(cwd)
      line("git repository:", status(githubReadiness.isGitRepo))
      line("GitHub remote detected:", status(githubReadiness.hasGitHubRemote))
      line("gh installed:", status(githubReadiness.ghInstalled))
      if (githubReadiness.authCheckAttempted) {
        line("gh auth verified:", status(githubReadiness.authVerified))
      } else {
        line("gh auth verified:", color.dim("not checked"))
      }
    }

    if (inProject) {
      const agentsPath = join(cwd, "AGENTS.md")
      const sisyphusPlansPath = join(cwd, ".sisyphus", "plans")
      const sisyphusNotepadsPath = join(cwd, ".sisyphus", "notepads")
      const sisyphusEvidencePath = join(cwd, ".sisyphus", "evidence")
      const docsPath = join(cwd, detected.docsPath)
      const docsReadmePath = join(docsPath, "README.md")
      const designTool = projectConfig?.designTool ?? detected.designTool ?? "none"
      const designPath = projectConfig?.designPath ?? detected.designPath ?? "./DESIGN.md"
      const designMcpOwnership = projectConfig?.designMcpOwnership ?? detected.designMcpOwnership ?? "none"
      const designFilePath = join(cwd, designPath)
      const designFilePresent = existsSync(designFilePath)
      const stitchSecretFilePath = join(cwd, GOOGLE_STITCH_ADAPTER.secretFilePath)
      const stitchSecretFilePresent = existsSync(stitchSecretFilePath)
      const stitchPresence = await detectStitchMcpPresence(cwd)
      const stitchDetected = hasDetectedStitchConfig(stitchPresence)
      const stitchConfigSource = stitchConfigSourceLabel(stitchPresence)
      const stitchConfigured = stitchDetected || designMcpOwnership === "wunderkind-managed"
      const stitchInUse = designTool === "google-stitch" && stitchConfigured
      const projectStitchEntry = getStitchEntry(projectOpenCodePath)
      const globalStitchEntry = getStitchEntry(globalOpenCodePath)

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
        const missingCommandFiles = getNativeCommandFilePaths()
          .filter((path) => !existsSync(path))
          .map((path) => basename(path))
        if (missingCommandFiles.length > 0) {
          warnings.push(`missing native command files: ${missingCommandFiles.join(", ")}`)
        }
      }
      if (detected.globalInstalled === true && !globalNativeSkills.allPresent) {
        warnings.push(`missing native global skill files: ${globalNativeSkills.dir}`)
      }
      if (designTool === "google-stitch" && !designFilePresent) {
        warnings.push(`design workflow is enabled but the design brief is missing: ${designFilePath}`)
      }
      if (
        designTool === "google-stitch" &&
        (designMcpOwnership === "wunderkind-managed" || designMcpOwnership === "reused-project") &&
        !stitchSecretFilePresent
      ) {
        warnings.push(`project-local Stitch secret file is missing: ${stitchSecretFilePath}`)
      }
      if (isDriftedStitchEntry(projectStitchEntry)) {
        warnings.push(`Stitch MCP entry deviates from the adapter contract in project config: ${projectOpenCodePath}`)
      }
      if (isDriftedStitchEntry(globalStitchEntry)) {
        warnings.push(`Stitch MCP entry deviates from the adapter contract in global config: ${globalOpenCodePath}`)
      }
      if (designMcpOwnership === "wunderkind-managed" && stitchPresence === "missing") {
        warnings.push("design MCP ownership expects a managed Stitch config but none was detected")
      }

      section(options.verbose ? "Project Health" : "Project health")
      line("cwd:", color.dim(cwd))
      line("AGENTS.md present:", status(hasAgents))
      line(".sisyphus/plans present:", status(hasPlans))
      line(".sisyphus/notepads present:", status(hasNotepads))
      line(".sisyphus/evidence present:", status(hasEvidence))
      line("global native agents present:", status(globalNativeAgents.allPresent))
      line("global native commands present:", status(globalNativeCommands.allPresent))
      const dreamInstalled = getNativeCommandFilePaths().some((path) => path.endsWith("dream.md") && existsSync(path))
      line("/dream available:", status(dreamInstalled))
      line("global native skills present:", status(globalNativeSkills.allPresent))

      if (options.verbose) {
        section("Project Configuration")
        line("team culture:", color.cyan(projectConfig?.teamCulture ?? detected.teamCulture))
        line("org structure:", color.cyan(projectConfig?.orgStructure ?? detected.orgStructure))
        line("docs-output enabled:", status((projectConfig?.docsEnabled ?? detected.docsEnabled) === true))
        line("docs-output path:", color.cyan(projectConfig?.docsPath ?? detected.docsPath))
        line("docs-output history mode:", color.cyan(projectConfig?.docHistoryMode ?? detected.docHistoryMode))
        line("PRD pipeline mode:", color.cyan(projectConfig?.prdPipelineMode ?? detected.prdPipelineMode))

        section("Design Workflow")
        line("design tool:", color.cyan(designTool))
        line("design path:", color.cyan(designPath))
        line("design MCP ownership:", color.cyan(designMcpOwnership))
        line("DESIGN.md present:", status(designFilePresent))
        line("Stitch MCP detected:", status(stitchDetected))
        line("Stitch config source:", color.cyan(stitchConfigSource))
        line("Stitch in use:", status(stitchInUse))
        line("project-local secret file present:", status(stitchSecretFilePresent))
        line("auth mode:", color.cyan(GOOGLE_STITCH_ADAPTER.authMode))

        section("Agent Personalities")
        const cisoVal = projectConfig?.cisoPersonality ?? detected.cisoPersonality
        line("ciso:", `${color.cyan(cisoVal)}  ${color.dim(`(${PERSONALITY_META.ciso[cisoVal]?.hint ?? cisoVal})`)}`)
        const ctoVal = projectConfig?.ctoPersonality ?? detected.ctoPersonality
        line("fullstack:", `${color.cyan(ctoVal)}  ${color.dim(`(${PERSONALITY_META.cto[ctoVal]?.hint ?? ctoVal})`)}`)
        const cmoVal = projectConfig?.cmoPersonality ?? detected.cmoPersonality
        line("marketing:", `${color.cyan(cmoVal)}  ${color.dim(`(${PERSONALITY_META.cmo[cmoVal]?.hint ?? cmoVal})`)}`)
        const productVal = projectConfig?.productPersonality ?? detected.productPersonality
        line("product:", `${color.cyan(productVal)}  ${color.dim(`(${PERSONALITY_META.product[productVal]?.hint ?? productVal})`)}`)
        const creativeVal = projectConfig?.creativePersonality ?? detected.creativePersonality
        line("creative:", `${color.cyan(creativeVal)}  ${color.dim(`(${PERSONALITY_META.creative[creativeVal]?.hint ?? creativeVal})`)}`)
        const legalVal = projectConfig?.legalPersonality ?? detected.legalPersonality
        line("legal:", `${color.cyan(legalVal)}  ${color.dim(`(${PERSONALITY_META.legal[legalVal]?.hint ?? legalVal})`)}`)
      } else {
        line("docs-output enabled:", status((projectConfig?.docsEnabled ?? detected.docsEnabled) === true))
        line(
          "Stitch readiness:",
          stitchReadinessSummary(designTool === "google-stitch", stitchConfigured, designMcpOwnership),
        )
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
