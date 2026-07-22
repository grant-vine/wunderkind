import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import color from "picocolors"
import { LEGACY_PROJECT_ARTIFACT_PATHS, PRIMARY_PROJECT_ARTIFACT_PATHS } from "../project-artifacts.js"
import {
  detectGitHubWorkflowReadiness,
  detectOmoVersionInfo,
  detectNativeAgentFiles,
  detectNativeCommandFiles,
  detectNativeSkillFiles,
  detectCurrentConfig,
  detectNativeAssetVersion,
  detectNativeAgentMarkdownVersions,
  detectWunderkindVersionInfo,
  getNativeCommandFilePaths,
  getProjectOverrideMarker,
  readProjectWunderkindConfig,
  resolveOpenCodeConfigPath,
  summarizeOmoFreshness as summarizeOmoFreshnessInfo,
} from "./config-manager/index.js"
import { getGitHubIssuesWorkflowStateDir } from "./github-issues-mapping.js"
import { isProjectContext } from "./init.js"
import { GOOGLE_STITCH_ADAPTER } from "./mcp-adapters.js"
import { detectStitchMcpPresence, type StitchPresence } from "./mcp-helpers.js"
import { PERSONALITY_META } from "./personality-meta.js"
import { resolveWunderkindTeamEntryState } from "./team-mode-entry.js"

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

function renderTeamEntryStatusLabel(statusValue: ReturnType<typeof resolveWunderkindTeamEntryState>["status"]): string {
  switch (statusValue) {
    case "team-ready":
      return color.green("team-ready")
    case "team-spec-missing":
      return color.yellow("fallback to solo product-wunderkind (missing team spec)")
    default:
      return color.dim("fallback to solo product-wunderkind (team mode disabled)")
  }
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
    const legacyOpenCodeWarning =
      "Legacy OpenCode config.json/config.jsonc was detected but is not used by the converged Wunderkind flow. Move plugin config to opencode.json or opencode.jsonc."

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
    const nativeAgentVersion = detectNativeAssetVersion("agents")
    const nativeCommandVersion = detectNativeAssetVersion("commands")
    const nativeSkillVersion = detectNativeAssetVersion("skills")
    const nativeAgentMarkdownVersions = detectNativeAgentMarkdownVersions("global")
    const staleNativeAssets = [
      { kind: "agents", needsUpgrade: nativeAgentVersion.needsUpgrade || !nativeAgentMarkdownVersions.allCurrent },
      { kind: "commands", needsUpgrade: nativeCommandVersion.needsUpgrade },
      { kind: "skills", needsUpgrade: nativeSkillVersion.needsUpgrade },
    ]
      .filter((asset) => asset.needsUpgrade)
      .map((asset) => asset.kind)
    line("wunderkind lifecycle:", color.dim(wunderkindUpgrade.lifecycle))
    line("wunderkind package refresh:", color.dim(wunderkindUpgrade.packageRefresh))
    line(
      "native agent markdown versions:",
      nativeAgentMarkdownVersions.allCurrent
        ? color.green("up to date")
        : color.yellow(`upgrade recommended (${nativeAgentMarkdownVersions.staleAgentIds.join(", ")})`),
    )
    line(
      "native asset freshness:",
      staleNativeAssets.length > 0
        ? color.yellow(`upgrade recommended (${staleNativeAssets.join(", ")})`)
        : color.green("up to date"),
    )
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
    if (globalOpenCodeResolution.ignoredLegacyPath) {
      const warning = `${legacyOpenCodeWarning} (${globalOpenCodeResolution.ignoredLegacyPath})`
      warnings.push(warning)
      line("OpenCode warning:", color.yellow(warning))
    }
    if (
      projectOpenCodeResolution.ignoredLegacyPath
      && projectOpenCodeResolution.ignoredLegacyPath !== globalOpenCodeResolution.ignoredLegacyPath
    ) {
      const warning = `${legacyOpenCodeWarning} (${projectOpenCodeResolution.ignoredLegacyPath})`
      warnings.push(warning)
      line("OpenCode warning:", color.yellow(warning))
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
      if (globalOpenCodeResolution.ignoredLegacyPath) {
        line("ignored legacy global OpenCode config:", color.dim(globalOpenCodeResolution.ignoredLegacyPath))
      }
      if (
        projectOpenCodeResolution.ignoredLegacyPath
        && projectOpenCodeResolution.ignoredLegacyPath !== globalOpenCodeResolution.ignoredLegacyPath
      ) {
        line("ignored legacy project OpenCode config:", color.dim(projectOpenCodeResolution.ignoredLegacyPath))
      }
      const globalNativeAgents = detectNativeAgentFiles("global")
      const globalNativeCommands = detectNativeCommandFiles()
      const globalNativeSkills = detectNativeSkillFiles("global")
      line("global native agents dir:", `${status(globalNativeAgents.allPresent)} ${color.dim(globalNativeAgents.dir)}`)
      line("global native agents version:", `${color.cyan(nativeAgentVersion.installedVersion ?? color.dim("unknown"))} ${color.dim(`(${nativeAgentVersion.markerPresent ? "marker present" : "marker missing"})`)}`)
      line(
        "global native agent markdown versions:",
        nativeAgentMarkdownVersions.allCurrent
          ? color.green(`up to date (${nativeAgentMarkdownVersions.currentVersion ?? "unknown"})`)
          : color.yellow(
              nativeAgentMarkdownVersions.agents
                .filter((agent) => agent.filePresent && !agent.matchesCurrent)
                .map((agent) => `${agent.id}@${agent.installedVersion ?? "missing"}`)
                .join(", "),
            ),
      )
      line("global native commands dir:", `${status(globalNativeCommands.allPresent)} ${color.dim(globalNativeCommands.dir)}`)
      line("global native commands version:", `${color.cyan(nativeCommandVersion.installedVersion ?? color.dim("unknown"))} ${color.dim(`(${nativeCommandVersion.markerPresent ? "marker present" : "marker missing"})`)}`)
      line("global native skills dir:", `${status(globalNativeSkills.allPresent)} ${color.dim(globalNativeSkills.dir)}`)
      line("global native skills version:", `${color.cyan(nativeSkillVersion.installedVersion ?? color.dim("unknown"))} ${color.dim(`(${nativeSkillVersion.markerPresent ? "marker present" : "marker missing"})`)}`)
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
      const cavemanMarker = projectConfig !== null && "cavemanEnabled" in projectConfig ? "●" : "○"
      line("caveman mode:", `${detected.cavemanEnabled ? color.green("enabled") : color.dim("disabled")} ${color.dim(`${cavemanMarker} ${cavemanMarker === "●" ? "project override" : "default off"}`)}`)
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

      const workflowStateDir = getGitHubIssuesWorkflowStateDir(cwd)
      const workflowStateCount = existsSync(workflowStateDir)
        ? readdirSync(workflowStateDir).filter((entry) => entry.endsWith(".json")).length
        : 0
      line("workflow sync command:", color.dim("wunderkind workflow-sync --plan <path> [--apply]"))
      line("team bootstrap command:", color.dim("wunderkind team-bootstrap --scope=project --name=wunderkind-daily-brief"))
      line("token audit command:", color.dim("wunderkind token-audit --surface agents --format table"))
      line("token audit contract:", color.dim("audit-only; no live prompt packing; no model-token truth claims"))
      line(
        "github workflow state dir:",
        `${color.dim(workflowStateDir)} ${color.dim(`(${workflowStateCount} tracked workflow${workflowStateCount === 1 ? "" : "s"})`)}`,
      )
    }

    if (inProject) {
      const agentsPath = join(cwd, "AGENTS.md")
      const omoPlansPath = join(cwd, PRIMARY_PROJECT_ARTIFACT_PATHS.plans)
      const omoNotepadsPath = join(cwd, PRIMARY_PROJECT_ARTIFACT_PATHS.notepads)
      const omoEvidencePath = join(cwd, PRIMARY_PROJECT_ARTIFACT_PATHS.evidence)
      const legacyArtifactRootPath = join(cwd, LEGACY_PROJECT_ARTIFACT_PATHS.root)
      const contextPath = join(cwd, "CONTEXT.md")
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
      const teamEntryState = resolveWunderkindTeamEntryState({ cwd })

      const hasAgents = existsSync(agentsPath)
      const hasContext = existsSync(contextPath)
      const hasPlans = existsSync(omoPlansPath)
      const hasNotepads = existsSync(omoNotepadsPath)
      const hasEvidence = existsSync(omoEvidencePath)
      const hasLegacyArtifactRoot = existsSync(legacyArtifactRootPath)
      const hasDocsReadme = existsSync(docsReadmePath)
      const globalNativeAgents = detectNativeAgentFiles("global")
      const globalNativeCommands = detectNativeCommandFiles()
      const globalNativeSkills = detectNativeSkillFiles("global")

      if (!localConfigExists) warnings.push(`missing local config: ${localConfigPath}`)
      if (!hasAgents) warnings.push(`missing soul file: ${agentsPath}`)
      if (localConfigExists && !hasContext) warnings.push(`missing project context file: ${contextPath}`)
      if (!hasPlans) warnings.push(`missing project artifact directory: ${omoPlansPath}`)
      if (!hasNotepads) warnings.push(`missing project artifact directory: ${omoNotepadsPath}`)
      if (!hasEvidence) warnings.push(`missing project artifact directory: ${omoEvidencePath}`)
      if (hasLegacyArtifactRoot) {
        warnings.push(
          `legacy ${LEGACY_PROJECT_ARTIFACT_PATHS.root}/ artifacts detected; move anything you still need into ${PRIMARY_PROJECT_ARTIFACT_PATHS.root}/ manually because wunderkind migrate has been removed`,
        )
      }
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
      if (detected.globalInstalled === true) {
        for (const asset of [nativeAgentVersion, nativeCommandVersion, nativeSkillVersion]) {
          if (asset.needsUpgrade) {
            warnings.push(`native ${asset.kind} were installed from ${asset.installedVersion ?? "an unknown version"}; current Wunderkind is ${asset.currentVersion ?? "unknown"}. Run ${wunderkindUpgrade.lifecycle}.`)
          }
        }

        if (!nativeAgentMarkdownVersions.allCurrent) {
          warnings.push(
            `native agent markdown versions are stale for ${nativeAgentMarkdownVersions.staleAgentIds.join(", ")}; current Wunderkind is ${nativeAgentMarkdownVersions.currentVersion ?? "unknown"}. Run ${wunderkindUpgrade.lifecycle}.`,
          )
        }
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
      line("CONTEXT.md present:", status(hasContext))
      line(".omo/plans present:", status(hasPlans))
      line(".omo/notepads present:", status(hasNotepads))
      line(".omo/evidence present:", status(hasEvidence))
      line("legacy .sisyphus/ present:", status(hasLegacyArtifactRoot))
      line("global native agents present:", status(globalNativeAgents.allPresent))
      line("global native commands present:", status(globalNativeCommands.allPresent))
      const dreamInstalled = getNativeCommandFilePaths().some((path) => path.endsWith("dream.md") && existsSync(path))
      line("/dream available:", status(dreamInstalled))
      line("/wunderkind-team readiness:", renderTeamEntryStatusLabel(teamEntryState.status))
      line("global native skills present:", status(globalNativeSkills.allPresent))

      if (options.verbose) {
        section("Project Configuration")
        line("team culture:", color.cyan(projectConfig?.teamCulture ?? detected.teamCulture))
        line("org structure:", color.cyan(projectConfig?.orgStructure ?? detected.orgStructure))
        line("docs-output enabled:", status((projectConfig?.docsEnabled ?? detected.docsEnabled) === true))
        line("docs-output path:", color.cyan(projectConfig?.docsPath ?? detected.docsPath))
        line("docs-output history mode:", color.cyan(projectConfig?.docHistoryMode ?? detected.docHistoryMode))
        line("PRD pipeline mode:", color.cyan(projectConfig?.prdPipelineMode ?? detected.prdPipelineMode))
        line(
          "/wunderkind-team config:",
          teamEntryState.activeConfigPath === null
            ? color.dim("canonical oh-my-openagent team mode config not found")
            : `${status(teamEntryState.teamModeEnabled)} ${color.dim(teamEntryState.activeConfigPath)} ${color.dim(`(${teamEntryState.activeConfigScope}/${teamEntryState.activeConfigFormat}, key: team_mode.enabled)`)}`,
        )
        line(
          "/wunderkind-team project spec:",
          `${status(existsSync(teamEntryState.projectTeamSpecPath))} ${color.dim(teamEntryState.projectTeamSpecPath)}`,
        )
        line(
          "/wunderkind-team user spec:",
          `${status(existsSync(teamEntryState.userTeamSpecPath))} ${color.dim(teamEntryState.userTeamSpecPath)}`,
        )
        line(
          "/wunderkind-team selected spec:",
          teamEntryState.availableTeamSpecPath === null
            ? color.dim("missing team spec")
            : `${color.cyan(teamEntryState.availableTeamSpecScope ?? "unknown")} ${color.dim(teamEntryState.availableTeamSpecPath)}`,
        )
        line(
          "/wunderkind-team bootstrap:",
          color.dim("wunderkind team-bootstrap --scope=project --name=wunderkind-daily-brief"),
        )
        line(
          "/wunderkind-team fallback:",
          color.dim("disabled team mode or missing team spec falls back to solo product-wunderkind orchestration"),
        )

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
