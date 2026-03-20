import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, relative } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import { fileURLToPath } from "node:url"
import { WUNDERKIND_AGENT_IDS, WUNDERKIND_AGENT_DEFINITIONS } from "../../agents/manifest.js"
import { renderNativeAgentMarkdown } from "../../agents/render-markdown.js"
import type {
  CisoPersonality,
  CmoPersonality,
  ConfigMergeResult,
  DesignMcpOwnership,
  DesignTool,
  CreativePersonality,
  CtoPersonality,
  DetectedConfig,
  DocHistoryMode,
  GlobalConfig,
  InstallConfig,
  InstallRegistrationScope,
  InstallScope,
  LegalPersonality,
  OrgStructure,
  BaselineConfigKey,
  PluginVersionInfo,
  ProjectConfig,
  ProductPersonality,
  PrdPipelineMode,
  TeamCulture,
} from "../types.js"

const PACKAGE_NAME = "@grant-vine/wunderkind"
const WUNDERKIND_SCHEMA_URL = "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"
const OMO_CANONICAL_PACKAGE_NAME = "oh-my-openagent"
const OMO_LEGACY_PACKAGE_NAME = "oh-my-opencode"

function isDesignTool(value: unknown): value is DesignTool {
  return value === "none" || value === "google-stitch"
}

function isDesignMcpOwnership(value: unknown): value is DesignMcpOwnership {
  return (
    value === "none" ||
    value === "wunderkind-managed" ||
    value === "reused-project" ||
    value === "reused-global"
  )
}

interface ConfigManagerPaths {
  configDir: string
  configJson: string
  configJsonc: string
  legacyConfigJson: string
  legacyConfigJsonc: string
  globalWunderkindDir: string
  globalWunderkindConfig: string
  globalOpenCodeAgentsDir: string
  globalOpenCodeCommandsDir: string
  globalOpenCodeSkillsDir: string
  globalOpenCodeNodeModules: string
  globalCacheDir: string
  wunderkindDir: string
  wunderkindConfig: string
  legacyWunderkindConfig: string
}

interface ConfigManagerPathOverride {
  cwd?: string
  home?: string
}

const CONFIG_MANAGER_PATH_OVERRIDE_KEY = Symbol.for("wunderkind.configManagerPathOverride")

type ConfigManagerGlobalState = typeof globalThis & {
  [CONFIG_MANAGER_PATH_OVERRIDE_KEY]?: ConfigManagerPathOverride
}

function getConfigManagerPathOverride(): ConfigManagerPathOverride | null {
  return (globalThis as ConfigManagerGlobalState)[CONFIG_MANAGER_PATH_OVERRIDE_KEY] ?? null
}

function resolveConfigManagerRuntimeContext(): { cwd: string; home: string } {
  const override = getConfigManagerPathOverride()

  return {
    cwd: override?.cwd ?? process.cwd(),
    home: override?.home ?? homedir(),
  }
}

function resolveConfigManagerPaths(cwd?: string, home?: string): ConfigManagerPaths {
  const runtimeContext = resolveConfigManagerRuntimeContext()
  const resolvedCwd = cwd ?? runtimeContext.cwd
  const resolvedHome = home ?? runtimeContext.home

  const configDir = join(resolvedHome, ".config", "opencode")
  const globalWunderkindDir = join(resolvedHome, ".wunderkind")
  const wunderkindDir = join(resolvedCwd, ".wunderkind")

  return {
    configDir,
    configJson: join(configDir, "opencode.json"),
    configJsonc: join(configDir, "opencode.jsonc"),
    legacyConfigJson: join(configDir, "config.json"),
    legacyConfigJsonc: join(configDir, "config.jsonc"),
    globalWunderkindDir,
    globalWunderkindConfig: join(globalWunderkindDir, "wunderkind.config.jsonc"),
    globalOpenCodeAgentsDir: join(configDir, "agents"),
    globalOpenCodeCommandsDir: join(configDir, "commands"),
    globalOpenCodeSkillsDir: join(configDir, "skills"),
    globalOpenCodeNodeModules: join(configDir, "node_modules"),
    globalCacheDir: join(resolvedHome, ".cache", "opencode"),
    wunderkindDir,
    wunderkindConfig: join(wunderkindDir, "wunderkind.config.jsonc"),
    legacyWunderkindConfig: join(resolvedCwd, "wunderkind.config.jsonc"),
  }
}

export function __setConfigManagerPathOverrideForTests(override: ConfigManagerPathOverride): void {
  const nextOverride: ConfigManagerPathOverride = {}

  if (override.cwd !== undefined) nextOverride.cwd = override.cwd
  if (override.home !== undefined) nextOverride.home = override.home

  const globalState = globalThis as ConfigManagerGlobalState

  if (Object.keys(nextOverride).length === 0) {
    delete globalState[CONFIG_MANAGER_PATH_OVERRIDE_KEY]
    return
  }

  globalState[CONFIG_MANAGER_PATH_OVERRIDE_KEY] = nextOverride
}

export function __resetConfigManagerPathOverrideForTests(): void {
  delete (globalThis as ConfigManagerGlobalState)[CONFIG_MANAGER_PATH_OVERRIDE_KEY]
}

interface OpenCodeConfig {
  plugin?: string[]
  [key: string]: unknown
}

const PROJECT_CONFIG_KEYS = [
  "teamCulture",
  "orgStructure",
  "cisoPersonality",
  "ctoPersonality",
  "cmoPersonality",
  "productPersonality",
  "creativePersonality",
  "legalPersonality",
  "docsEnabled",
  "docsPath",
  "docHistoryMode",
  "prdPipelineMode",
  "designTool",
  "designPath",
  "designMcpOwnership",
] as const

type ProjectConfigKey = (typeof PROJECT_CONFIG_KEYS)[number]

const DEFAULT_INSTALL_CONFIG: InstallConfig = {
  region: "Global",
  industry: "",
  primaryRegulation: "",
  secondaryRegulation: "",
  teamCulture: "pragmatic-balanced",
  orgStructure: "flat",
  cisoPersonality: "pragmatic-risk-manager",
  ctoPersonality: "code-archaeologist",
  cmoPersonality: "data-driven",
  productPersonality: "outcome-obsessed",
  creativePersonality: "pragmatic-problem-solver",
  legalPersonality: "pragmatic-advisor",
  docsEnabled: false,
  docsPath: "./docs",
  docHistoryMode: "append-dated",
  prdPipelineMode: "filesystem",
  designTool: "none",
  designPath: "./DESIGN.md",
  designMcpOwnership: "none",
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  region: DEFAULT_INSTALL_CONFIG.region,
  industry: DEFAULT_INSTALL_CONFIG.industry,
  primaryRegulation: DEFAULT_INSTALL_CONFIG.primaryRegulation,
  secondaryRegulation: DEFAULT_INSTALL_CONFIG.secondaryRegulation,
}

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  teamCulture: DEFAULT_INSTALL_CONFIG.teamCulture,
  orgStructure: DEFAULT_INSTALL_CONFIG.orgStructure,
  cisoPersonality: DEFAULT_INSTALL_CONFIG.cisoPersonality,
  ctoPersonality: DEFAULT_INSTALL_CONFIG.ctoPersonality,
  cmoPersonality: DEFAULT_INSTALL_CONFIG.cmoPersonality,
  productPersonality: DEFAULT_INSTALL_CONFIG.productPersonality,
  creativePersonality: DEFAULT_INSTALL_CONFIG.creativePersonality,
  legalPersonality: DEFAULT_INSTALL_CONFIG.legalPersonality,
  docsEnabled: DEFAULT_INSTALL_CONFIG.docsEnabled,
  docsPath: DEFAULT_INSTALL_CONFIG.docsPath,
  docHistoryMode: DEFAULT_INSTALL_CONFIG.docHistoryMode,
  prdPipelineMode: DEFAULT_INSTALL_CONFIG.prdPipelineMode,
  designTool: DEFAULT_INSTALL_CONFIG.designTool ?? "none",
  designPath: DEFAULT_INSTALL_CONFIG.designPath ?? "./DESIGN.md",
  designMcpOwnership: DEFAULT_INSTALL_CONFIG.designMcpOwnership ?? "none",
}

export function getDefaultInstallConfig(): InstallConfig {
  return { ...DEFAULT_INSTALL_CONFIG }
}

export function getDefaultGlobalConfig(): GlobalConfig {
  return { ...DEFAULT_GLOBAL_CONFIG }
}

export function getDefaultProjectConfig(): ProjectConfig {
  return { ...DEFAULT_PROJECT_CONFIG }
}

export function resolveOpenCodeConfigPath(scope: InstallScope): {
  path: string
  format: "json" | "jsonc" | "none"
  source: "opencode.json" | "opencode.jsonc" | "config.json" | "config.jsonc" | "default"
} {
  const runtimeContext = resolveConfigManagerRuntimeContext()
  const paths = resolveConfigManagerPaths()

  if (scope === "project") {
    const projectJson = join(runtimeContext.cwd, "opencode.json")
    const projectJsonc = join(runtimeContext.cwd, "opencode.jsonc")
    const projectLegacyJson = join(runtimeContext.cwd, "config.json")
    const projectLegacyJsonc = join(runtimeContext.cwd, "config.jsonc")

    if (existsSync(projectJson)) return { path: projectJson, format: "json", source: "opencode.json" }
    if (existsSync(projectJsonc)) return { path: projectJsonc, format: "jsonc", source: "opencode.jsonc" }
    if (existsSync(projectLegacyJson)) return { path: projectLegacyJson, format: "json", source: "config.json" }
    if (existsSync(projectLegacyJsonc)) return { path: projectLegacyJsonc, format: "jsonc", source: "config.jsonc" }
    return { path: projectJson, format: "none", source: "default" }
  }

  if (existsSync(paths.configJson)) return { path: paths.configJson, format: "json", source: "opencode.json" }
  if (existsSync(paths.configJsonc)) return { path: paths.configJsonc, format: "jsonc", source: "opencode.jsonc" }
  if (existsSync(paths.legacyConfigJson)) return { path: paths.legacyConfigJson, format: "json", source: "config.json" }
  if (existsSync(paths.legacyConfigJsonc)) return { path: paths.legacyConfigJsonc, format: "jsonc", source: "config.jsonc" }
  return { path: paths.configJson, format: "none", source: "default" }
}

function parseConfig(path: string): OpenCodeConfig | null {
  try {
    const content = readFileSync(path, "utf-8")
    if (!content.trim()) return null
    const result = parseJsonc(content) as OpenCodeConfig
    if (!result || typeof result !== "object" || Array.isArray(result)) return null
    return result
  } catch {
    return null
  }
}

function readJsonVersion(filePath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const version = (parsed as Record<string, unknown>)["version"]
    return typeof version === "string" ? version : null
  } catch {
    return null
  }
}

function normalizeDependencyVersion(entry: string | null): string | null {
  if (!entry) return null
  const match = entry.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)
  return match?.[0] ?? null
}

function findPluginEntry(entries: readonly string[], packageName: string): string | null {
  return entries.find((entry) => entry === packageName || entry.startsWith(`${packageName}@`) || entry.startsWith(`file://`)) ?? null
}

function detectLoadedPackageVersion(packageName: string): { version: string | null; packagePath: string | null } {
  const paths = resolveConfigManagerPaths()
  const candidates = [
    join(paths.globalOpenCodeNodeModules, packageName, "package.json"),
    join(paths.globalCacheDir, "node_modules", packageName, "package.json"),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    return {
      version: readJsonVersion(candidate),
      packagePath: candidate,
    }
  }

  return { version: null, packagePath: null }
}

function detectLoadedPackageSources(packageName: string): {
  global: { version: string | null; packagePath: string | null }
  cache: { version: string | null; packagePath: string | null }
} {
  const paths = resolveConfigManagerPaths()
  const globalPath = join(paths.globalOpenCodeNodeModules, packageName, "package.json")
  const cachePath = join(paths.globalCacheDir, "node_modules", packageName, "package.json")

  return {
    global: {
      version: existsSync(globalPath) ? readJsonVersion(globalPath) : null,
      packagePath: existsSync(globalPath) ? globalPath : null,
    },
    cache: {
      version: existsSync(cachePath) ? readJsonVersion(cachePath) : null,
      packagePath: existsSync(cachePath) ? cachePath : null,
    },
  }
}

function compareVersions(left: string, right: string): number | null {
  const normalize = (value: string): [number, number, number] | null => {
    const match = value.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) return null
    const [, major, minor, patch] = match
    return [Number(major), Number(minor), Number(patch)]
  }

  const leftParts = normalize(left)
  const rightParts = normalize(right)
  if (!leftParts || !rightParts) return null

  const majorDelta = leftParts[0] - rightParts[0]
  if (majorDelta !== 0) return majorDelta

  const minorDelta = leftParts[1] - rightParts[1]
  if (minorDelta !== 0) return minorDelta

  const patchDelta = leftParts[2] - rightParts[2]
  if (patchDelta !== 0) return patchDelta

  return 0
}

function buildStaleOverrideWarning(options: {
  packageName: string
  globalVersion: string | null
  cacheVersion: string | null
}): string | null {
  const { packageName, globalVersion, cacheVersion } = options
  if (!globalVersion || !cacheVersion) return null

  const comparison = compareVersions(globalVersion, cacheVersion)
  if (comparison === null || comparison >= 0) return null

  return `global ${packageName} ${globalVersion} likely overrides newer cache ${cacheVersion}`
}

function getOwnPackageVersion(): string | null {
  return readJsonVersion(fileURLToPath(new URL("../../../package.json", import.meta.url)))
}

export function detectPluginVersionInfo(packageName: string): PluginVersionInfo {
  const configResolution = resolveOpenCodeConfigPath("global")
  const configPath = existsSync(configResolution.path) ? configResolution.path : null
  const config = configPath ? parseConfig(configPath) : null
  const registeredEntry = findPluginEntry((config?.plugin ?? []) as string[], packageName)
  const loaded = detectLoadedPackageVersion(packageName)

  return {
    packageName,
    currentVersion: packageName === PACKAGE_NAME ? getOwnPackageVersion() : null,
    registeredEntry,
    registeredVersion: normalizeDependencyVersion(registeredEntry),
    loadedVersion: loaded.version,
    configPath,
    loadedPackagePath: loaded.packagePath,
    registered: registeredEntry !== null,
    staleOverrideWarning: null,
  }
}

export function detectWunderkindVersionInfo(): PluginVersionInfo {
  return detectPluginVersionInfo(PACKAGE_NAME)
}

export function detectOmoVersionInfo(): PluginVersionInfo {
  const configResolution = resolveOpenCodeConfigPath("global")
  const configPath = existsSync(configResolution.path) ? configResolution.path : null
  const config = configPath ? parseConfig(configPath) : null
  const plugins = (config?.plugin ?? []) as string[]

  const registeredCanonicalEntry = findPluginEntry(plugins, OMO_CANONICAL_PACKAGE_NAME)
  const registeredLegacyEntry = findPluginEntry(plugins, OMO_LEGACY_PACKAGE_NAME)
  const registeredEntry = registeredCanonicalEntry ?? registeredLegacyEntry

  const loadedCanonical = detectLoadedPackageVersion(OMO_CANONICAL_PACKAGE_NAME)
  const loadedLegacy = detectLoadedPackageVersion(OMO_LEGACY_PACKAGE_NAME)
  const loadedCanonicalSources = detectLoadedPackageSources(OMO_CANONICAL_PACKAGE_NAME)
  const loadedLegacySources = detectLoadedPackageSources(OMO_LEGACY_PACKAGE_NAME)
  const loaded = loadedCanonical.version !== null || loadedCanonical.packagePath !== null ? loadedCanonical : loadedLegacy
  const loadedSources =
    loadedCanonicalSources.global.packagePath !== null || loadedCanonicalSources.cache.packagePath !== null
      ? loadedCanonicalSources
      : loadedLegacySources
  const staleOverrideWarning = buildStaleOverrideWarning({
    packageName: OMO_CANONICAL_PACKAGE_NAME,
    globalVersion: loadedSources.global.version,
    cacheVersion: loadedSources.cache.version,
  })

  return {
    packageName: OMO_CANONICAL_PACKAGE_NAME,
    currentVersion: null,
    registeredEntry,
    registeredVersion: normalizeDependencyVersion(registeredEntry),
    loadedVersion: loaded.version,
    configPath,
    loadedPackagePath: loaded.packagePath,
    registered: registeredEntry !== null,
    loadedSources,
    staleOverrideWarning,
  }
}

function parseWunderkindConfig(path: string): Record<string, unknown> | null {
  try {
    const parsed = parseJsonc(readFileSync(path, "utf-8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function coerceGlobalConfig(source: Record<string, unknown>): Partial<GlobalConfig> {
  const result: Partial<GlobalConfig> = {}

  if (typeof source["region"] === "string") result.region = source["region"]
  if (typeof source["industry"] === "string") result.industry = source["industry"]
  if (typeof source["primaryRegulation"] === "string") result.primaryRegulation = source["primaryRegulation"]
  if (typeof source["secondaryRegulation"] === "string") result.secondaryRegulation = source["secondaryRegulation"]
  return result
}

export interface ConfigSourceMarker {
  marker: "●" | "○"
  sourceLabel: "project override" | "inherited default"
}

export interface GitHubWorkflowReadiness {
  isGitRepo: boolean
  hasGitHubRemote: boolean
  ghInstalled: boolean
  authVerified: boolean
  authCheckAttempted: boolean
}

function commandSucceeds(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { stdio: "ignore" })
  return result.status === 0
}

function stdout(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim() : ""
}

export function detectGitHubWorkflowReadiness(cwd: string): GitHubWorkflowReadiness {
  const isGitRepo = commandSucceeds("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"])
  if (!isGitRepo) {
    return {
      isGitRepo,
      hasGitHubRemote: false,
      ghInstalled: false,
      authVerified: false,
      authCheckAttempted: false,
    }
  }

  const remoteList = stdout("git", ["-C", cwd, "remote", "-v"])
  const hasGitHubRemote = /github\./i.test(remoteList)
  const ghInstalled = commandSucceeds("gh", ["--version"])
  const authCheckAttempted = ghInstalled && hasGitHubRemote
  const authVerified = authCheckAttempted ? commandSucceeds("gh", ["auth", "status", "-h", "github.com"]) : false

  return {
    isGitRepo,
    hasGitHubRemote,
    ghInstalled,
    authVerified,
    authCheckAttempted,
  }
}

export function getProjectOverrideMarker(key: BaselineConfigKey, projectConfig: Record<string, unknown> | null): ConfigSourceMarker {
  const hasOverride = projectConfig !== null && key in projectConfig && typeof projectConfig[key] === "string"
  return hasOverride
    ? { marker: "●", sourceLabel: "project override" }
    : { marker: "○", sourceLabel: "inherited default" }
}

function coerceProjectConfig(source: Record<string, unknown>): Partial<ProjectConfig> {
  const result: Partial<ProjectConfig> = {}

  if (typeof source["teamCulture"] === "string") result.teamCulture = source["teamCulture"] as TeamCulture
  if (typeof source["orgStructure"] === "string") result.orgStructure = source["orgStructure"] as OrgStructure
  if (typeof source["cisoPersonality"] === "string") result.cisoPersonality = source["cisoPersonality"] as CisoPersonality
  if (typeof source["ctoPersonality"] === "string") result.ctoPersonality = source["ctoPersonality"] as CtoPersonality
  if (typeof source["cmoPersonality"] === "string") result.cmoPersonality = source["cmoPersonality"] as CmoPersonality
  if (typeof source["productPersonality"] === "string") {
    result.productPersonality = source["productPersonality"] as ProductPersonality
  }
  if (typeof source["creativePersonality"] === "string") {
    result.creativePersonality = source["creativePersonality"] as CreativePersonality
  }
  if (typeof source["legalPersonality"] === "string") result.legalPersonality = source["legalPersonality"] as LegalPersonality
  if (typeof source["docsEnabled"] === "boolean") result.docsEnabled = source["docsEnabled"]
  if (typeof source["docsPath"] === "string") result.docsPath = source["docsPath"]
  if (typeof source["docHistoryMode"] === "string") result.docHistoryMode = source["docHistoryMode"] as DocHistoryMode
  if (typeof source["prdPipelineMode"] === "string") result.prdPipelineMode = source["prdPipelineMode"] as PrdPipelineMode
  if (isDesignTool(source["designTool"])) result.designTool = source["designTool"]
  if (typeof source["designPath"] === "string") result.designPath = source["designPath"]
  if (isDesignMcpOwnership(source["designMcpOwnership"])) result.designMcpOwnership = source["designMcpOwnership"]

  return result
}

function listLegacyGlobalProjectFields(source: Record<string, unknown>): ProjectConfigKey[] {
  return PROJECT_CONFIG_KEYS.filter((key) => key in source)
}

function hasWunderkindPlugin(plugins: readonly string[]): boolean {
  return plugins.some(
    (p) => p === PACKAGE_NAME || p === "wunderkind" || p.startsWith(`${PACKAGE_NAME}@`) || p.startsWith("wunderkind@"),
  )
}

function detectRegistration(): {
  projectInstalled: boolean
  globalInstalled: boolean
  registrationScope: InstallRegistrationScope
  projectOpenCodeConfigPath: string
  globalOpenCodeConfigPath: string
} {
  const projectResolution = resolveOpenCodeConfigPath("project")
  const globalResolution = resolveOpenCodeConfigPath("global")
  const projectOpenCodeConfigPath = projectResolution.path
  const globalOpenCodeConfigPath = globalResolution.path

  const projectConfig = existsSync(projectOpenCodeConfigPath) ? parseConfig(projectOpenCodeConfigPath) : null
  const globalConfig = existsSync(globalOpenCodeConfigPath) ? parseConfig(globalOpenCodeConfigPath) : null

  const projectInstalled = hasWunderkindPlugin((projectConfig?.plugin ?? []) as string[])
  const globalInstalled = hasWunderkindPlugin((globalConfig?.plugin ?? []) as string[])

  let registrationScope: InstallRegistrationScope = "none"
  if (projectInstalled && globalInstalled) {
    registrationScope = "both"
  } else if (projectInstalled) {
    registrationScope = "project"
  } else if (globalInstalled) {
    registrationScope = "global"
  }

  return {
    projectInstalled,
    globalInstalled,
    registrationScope,
    projectOpenCodeConfigPath,
    globalOpenCodeConfigPath,
  }
}

export function readWunderkindConfig(): Partial<InstallConfig> | null {
  const paths = resolveConfigManagerPaths()
  const projectConfig = existsSync(paths.wunderkindConfig) ? parseWunderkindConfig(paths.wunderkindConfig) : null
  const globalConfig = existsSync(paths.globalWunderkindConfig) ? parseWunderkindConfig(paths.globalWunderkindConfig) : null

  if (!projectConfig && !globalConfig) {
    return null
  }

  const globalSafe = coerceGlobalConfig(globalConfig ?? {})
  const projectGlobalSafe = coerceGlobalConfig(projectConfig ?? {})
  const projectLocal = coerceProjectConfig(projectConfig ?? {})

  return {
    ...globalSafe,
    ...projectGlobalSafe,
    ...projectLocal,
  }
}

export function readGlobalWunderkindConfig(): Partial<GlobalConfig> | null {
  const paths = resolveConfigManagerPaths()
  const globalConfig = existsSync(paths.globalWunderkindConfig) ? parseWunderkindConfig(paths.globalWunderkindConfig) : null
  return globalConfig ? coerceGlobalConfig(globalConfig) : null
}

export function readProjectWunderkindConfig(): Partial<ProjectConfig> | null {
  const paths = resolveConfigManagerPaths()
  const projectConfig = existsSync(paths.wunderkindConfig) ? parseWunderkindConfig(paths.wunderkindConfig) : null
  return projectConfig ? coerceProjectConfig(projectConfig) : null
}

function ensureConfigDir(configDir: string, configPath: string): ConfigMergeResult | null {
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    return null
  } catch (err) {
    return { success: false, configPath, error: String(err) }
  }
}

function renderGlobalWunderkindConfig(config: GlobalConfig): string {
  return [
    `// Wunderkind global configuration — safe defaults shared across projects`,
    `{`,
    `  "$schema": ${JSON.stringify(WUNDERKIND_SCHEMA_URL)},`,
    `  // Geographic region — e.g. "South Africa", "United States", "United Kingdom", "Australia"`,
    `  "region": ${JSON.stringify(config.region)},`,
    `  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"`,
    `  "industry": ${JSON.stringify(config.industry)},`,
    `  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"`,
    `  "primaryRegulation": ${JSON.stringify(config.primaryRegulation)},`,
    `  // Optional secondary regulation`,
    `  "secondaryRegulation": ${JSON.stringify(config.secondaryRegulation)}`,
    `}`,
    ``,
  ].join("\n")
}

function renderProjectWunderkindConfig(config: ProjectConfig & Partial<GlobalConfig>, baseline: GlobalConfig): string {
  const lines = [
    `// Wunderkind project configuration — edit these values to tailor agents to this project`,
    `{`,
    `  "$schema": ${JSON.stringify(WUNDERKIND_SCHEMA_URL)},`,
  ]

  const baselineOverrideLines = [
    config.region !== undefined && config.region !== baseline.region
      ? `  "region": ${JSON.stringify(config.region)},`
      : null,
    config.industry !== undefined && config.industry !== baseline.industry
      ? `  "industry": ${JSON.stringify(config.industry)},`
      : null,
    config.primaryRegulation !== undefined && config.primaryRegulation !== baseline.primaryRegulation
      ? `  "primaryRegulation": ${JSON.stringify(config.primaryRegulation)},`
      : null,
    config.secondaryRegulation !== undefined && config.secondaryRegulation !== baseline.secondaryRegulation
      ? `  "secondaryRegulation": ${JSON.stringify(config.secondaryRegulation)},`
      : null,
  ].filter((line): line is string => line !== null)

  if (baselineOverrideLines.length > 0) {
    lines.push(
      `  // Optional project-local baseline overrides — only write fields that intentionally differ from global defaults`,
      ...baselineOverrideLines,
      ``,
    )
  }

  lines.push(
    `  // Team culture baseline — affects all agents' communication style and decision rigour`,
    `  // "formal-strict" | "pragmatic-balanced" | "experimental-informal"`,
    `  "teamCulture": ${JSON.stringify(config.teamCulture)},`,
    `  // Org structure — "flat" (peers, escalate to user) | "hierarchical" (domain authority applies, CISO has hard veto)`,
    `  "orgStructure": ${JSON.stringify(config.orgStructure)},`,
    ``,
    `  // Agent personalities — controls each agent's default character archetype`,
    `  // CISO: "paranoid-enforcer" | "pragmatic-risk-manager" | "educator-collaborator"`,
    `  // Also carries security-incident posture and compliance-impact escalation style`,
    `  "cisoPersonality": ${JSON.stringify(config.cisoPersonality)},`,
    `  // CTO/Fullstack: "grizzled-sysadmin" | "startup-bro" | "code-archaeologist"`,
    `  // Also carries TDD, regression, technical triage, reliability, runbook, and supportability posture`,
    `  "ctoPersonality": ${JSON.stringify(config.ctoPersonality)},`,
    `  // CMO/Marketing: "data-driven" | "brand-storyteller" | "growth-hacker"`,
    `  // Also carries brand, community, developer advocacy, docs adoption, funnel, and campaign-analysis posture`,
    `  "cmoPersonality": ${JSON.stringify(config.cmoPersonality)},`,
    `  // Product: "user-advocate" | "velocity-optimizer" | "outcome-obsessed"`,
    `  // Also carries issue intake, repro shaping, acceptance review, experiment readouts, and backlog-ready triage posture`,
    `  "productPersonality": ${JSON.stringify(config.productPersonality)},`,
    `  // Creative Director: "perfectionist-craftsperson" | "bold-provocateur" | "pragmatic-problem-solver"`,
    `  "creativePersonality": ${JSON.stringify(config.creativePersonality)},`,
    `  // Legal Counsel: "cautious-gatekeeper" | "pragmatic-advisor" | "plain-english-counselor"`,
    `  "legalPersonality": ${JSON.stringify(config.legalPersonality)},`,
    ``,
    `  // Docs output settings`,
    `  // Enable or disable writing docs outputs to disk`,
    `  "docsEnabled": ${JSON.stringify(config.docsEnabled)},`,
    `  // Directory path where docs outputs are written`,
    `  "docsPath": ${JSON.stringify(config.docsPath)},`,
    `  // History mode: "overwrite" | "append-dated" (UTC-timestamped sections) | "new-dated-file" (UTC-timestamped files) | "overwrite-archive"`,
    `  "docHistoryMode": ${JSON.stringify(config.docHistoryMode)},`,
    `  // PRD / planning workflow mode`,
    `  // "filesystem" writes to .sisyphus/; "github" expects gh + GitHub repo readiness`,
    `  // PRD pipeline mode: "filesystem" | "github"`,
    `  "prdPipelineMode": ${JSON.stringify(config.prdPipelineMode ?? "filesystem")},`,
    ``,
    `  // Design workflow settings`,
    `  // Design tool: "none" | "google-stitch"`,
    `  "designTool": ${JSON.stringify(config.designTool)},`,
    `  // Relative path to the design brief shared with design tools`,
    `  "designPath": ${JSON.stringify(config.designPath)},`,
    `  // MCP ownership: "none" | "wunderkind-managed" | "reused-project" | "reused-global"`,
  )

  lines.push(`  "designMcpOwnership": ${JSON.stringify(config.designMcpOwnership)}`)

  lines.push(`}`, ``)

  return lines.join("\n")
}

export function writeGlobalWunderkindConfig(config: GlobalConfig): ConfigMergeResult {
  const paths = resolveConfigManagerPaths()
  const setupError = ensureConfigDir(paths.globalWunderkindDir, paths.globalWunderkindConfig)
  if (setupError) return setupError

  try {
    writeFileSync(paths.globalWunderkindConfig, renderGlobalWunderkindConfig(config))
    return { success: true, configPath: paths.globalWunderkindConfig }
  } catch (err) {
    return { success: false, configPath: paths.globalWunderkindConfig, error: String(err) }
  }
}

export function writeProjectWunderkindConfig(config: ProjectConfig & Partial<GlobalConfig>): ConfigMergeResult {
  const paths = resolveConfigManagerPaths()
  const setupError = ensureConfigDir(paths.wunderkindDir, paths.wunderkindConfig)
  if (setupError) return setupError

  try {
    const baseline = {
      ...DEFAULT_GLOBAL_CONFIG,
      ...(readGlobalWunderkindConfig() ?? {}),
    }
    writeFileSync(paths.wunderkindConfig, renderProjectWunderkindConfig(config, baseline))
    return { success: true, configPath: paths.wunderkindConfig }
  } catch (err) {
    return { success: false, configPath: paths.wunderkindConfig, error: String(err) }
  }
}

export function readWunderkindConfigForScope(scope: InstallScope): Partial<InstallConfig> | null {
  if (scope === "global") {
    return readGlobalWunderkindConfig()
  }

  const paths = resolveConfigManagerPaths()
  const projectConfig = existsSync(paths.wunderkindConfig) ? parseWunderkindConfig(paths.wunderkindConfig) : null
  if (!projectConfig) return null

  return {
    ...coerceGlobalConfig(projectConfig),
    ...coerceProjectConfig(projectConfig),
  }
}

export function detectCurrentConfig(): DetectedConfig {
  const paths = resolveConfigManagerPaths()
  const projectResolution = resolveOpenCodeConfigPath("project")
  const globalResolution = resolveOpenCodeConfigPath("global")
  const defaults = getDefaultInstallConfig()
  const detectedDefaults: DetectedConfig = {
    isInstalled: false,
    scope: "global" as InstallScope,
    projectInstalled: false,
    globalInstalled: false,
    registrationScope: "none",
    projectOpenCodeConfigPath: projectResolution.path,
    globalOpenCodeConfigPath: globalResolution.path,
    ...defaults,
    designTool: defaults.designTool ?? DEFAULT_PROJECT_CONFIG.designTool,
    designPath: defaults.designPath ?? DEFAULT_PROJECT_CONFIG.designPath,
    designMcpOwnership: defaults.designMcpOwnership ?? DEFAULT_PROJECT_CONFIG.designMcpOwnership,
  }

  const registration = detectRegistration()
  if (registration.registrationScope === "none") {
    return {
      ...detectedDefaults,
      ...registration,
    }
  }

  const globalConfig = existsSync(paths.globalWunderkindConfig) ? parseWunderkindConfig(paths.globalWunderkindConfig) : null
  const legacyGlobalProjectFields = globalConfig ? listLegacyGlobalProjectFields(globalConfig) : []
  const globalSafe = readGlobalWunderkindConfig()
  const projectConfig = existsSync(paths.wunderkindConfig) ? parseWunderkindConfig(paths.wunderkindConfig) : null
  const projectGlobalSafe = coerceGlobalConfig(projectConfig ?? {})
  const projectLocal = readProjectWunderkindConfig()
  const legacyGlobalProject = coerceProjectConfig(globalConfig ?? {})

  return {
    isInstalled: true,
    scope: registration.projectInstalled ? "project" : "global",
    projectInstalled: registration.projectInstalled,
    globalInstalled: registration.globalInstalled,
    registrationScope: registration.registrationScope,
    projectOpenCodeConfigPath: registration.projectOpenCodeConfigPath,
    globalOpenCodeConfigPath: registration.globalOpenCodeConfigPath,
    legacyGlobalProjectFields,
    region: projectGlobalSafe.region ?? globalSafe?.region ?? defaults.region,
    industry: projectGlobalSafe.industry ?? globalSafe?.industry ?? defaults.industry,
    primaryRegulation: projectGlobalSafe.primaryRegulation ?? globalSafe?.primaryRegulation ?? defaults.primaryRegulation,
    secondaryRegulation: projectGlobalSafe.secondaryRegulation ?? globalSafe?.secondaryRegulation ?? defaults.secondaryRegulation,
    teamCulture: projectLocal?.teamCulture ?? legacyGlobalProject.teamCulture ?? defaults.teamCulture,
    orgStructure: projectLocal?.orgStructure ?? legacyGlobalProject.orgStructure ?? defaults.orgStructure,
    cisoPersonality: projectLocal?.cisoPersonality ?? legacyGlobalProject.cisoPersonality ?? defaults.cisoPersonality,
    ctoPersonality: projectLocal?.ctoPersonality ?? legacyGlobalProject.ctoPersonality ?? defaults.ctoPersonality,
    cmoPersonality: projectLocal?.cmoPersonality ?? legacyGlobalProject.cmoPersonality ?? defaults.cmoPersonality,
    productPersonality: projectLocal?.productPersonality ?? legacyGlobalProject.productPersonality ?? defaults.productPersonality,
    creativePersonality: projectLocal?.creativePersonality ?? legacyGlobalProject.creativePersonality ?? defaults.creativePersonality,
    legalPersonality: projectLocal?.legalPersonality ?? legacyGlobalProject.legalPersonality ?? defaults.legalPersonality,
    docsEnabled: projectLocal?.docsEnabled ?? legacyGlobalProject.docsEnabled ?? defaults.docsEnabled,
    docsPath: projectLocal?.docsPath ?? legacyGlobalProject.docsPath ?? defaults.docsPath,
    docHistoryMode: projectLocal?.docHistoryMode ?? legacyGlobalProject.docHistoryMode ?? defaults.docHistoryMode,
    prdPipelineMode: projectLocal?.prdPipelineMode ?? legacyGlobalProject.prdPipelineMode ?? defaults.prdPipelineMode,
    designTool: projectLocal?.designTool ?? legacyGlobalProject.designTool ?? defaults.designTool ?? DEFAULT_PROJECT_CONFIG.designTool,
    designPath: projectLocal?.designPath ?? legacyGlobalProject.designPath ?? defaults.designPath ?? DEFAULT_PROJECT_CONFIG.designPath,
    designMcpOwnership:
      projectLocal?.designMcpOwnership ??
      legacyGlobalProject.designMcpOwnership ??
      defaults.designMcpOwnership ??
      DEFAULT_PROJECT_CONFIG.designMcpOwnership,
  }
}

export function addPluginToOpenCodeConfig(scope: InstallScope): ConfigMergeResult {
  const runtimeContext = resolveConfigManagerRuntimeContext()
  const paths = resolveConfigManagerPaths()
  const targetPath = resolveOpenCodeConfigPath(scope).path
  const targetDir = scope === "project" ? runtimeContext.cwd : paths.configDir

  try {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }

  try {
    if (!existsSync(targetPath)) {
      const config: OpenCodeConfig = { plugin: [PACKAGE_NAME] }
      writeFileSync(targetPath, JSON.stringify(config, null, 2) + "\n")
      return { success: true, configPath: targetPath }
    }

    const config = parseConfig(targetPath) ?? {}
    const plugins = (config.plugin ?? []) as string[]
    const already = hasWunderkindPlugin(plugins)

    if (already) {
      const idx = plugins.findIndex((p) => p === "wunderkind" || p.startsWith("wunderkind@"))
      if (idx !== -1) {
        plugins[idx] = PACKAGE_NAME
        config.plugin = plugins
        writeFileSync(targetPath, JSON.stringify(config, null, 2) + "\n")
      }
      return { success: true, configPath: targetPath }
    }

    plugins.push(PACKAGE_NAME)
    config.plugin = plugins
    writeFileSync(targetPath, JSON.stringify(config, null, 2) + "\n")
    return { success: true, configPath: targetPath }
  } catch (err) {
    return { success: false, configPath: targetPath, error: String(err) }
  }
}

export function writeWunderkindConfig(installConfig: InstallConfig, scope: InstallScope): ConfigMergeResult {
  if (scope === "global") {
    return writeGlobalWunderkindConfig(installConfig)
  }

  return writeProjectWunderkindConfig({
    ...DEFAULT_PROJECT_CONFIG,
    ...installConfig,
  })
}

export function detectLegacyConfig(): boolean {
  return existsSync(resolveConfigManagerPaths().legacyWunderkindConfig)
}

export function removePluginFromOpenCodeConfig(scope: InstallScope): ConfigMergeResult {
  const targetPath = resolveOpenCodeConfigPath(scope).path

  try {
    if (!existsSync(targetPath)) {
      return { success: true, configPath: targetPath, changed: false }
    }

    const config = parseConfig(targetPath)
    if (!config) {
      return { success: false, configPath: targetPath, error: "Invalid OpenCode config format" }
    }

    const plugins = (config.plugin ?? []) as string[]
    if (plugins.length === 0) {
      return { success: true, configPath: targetPath, changed: false }
    }

    const filtered = plugins.filter(
      (p) => !(p === PACKAGE_NAME || p === "wunderkind" || p.startsWith(`${PACKAGE_NAME}@`) || p.startsWith("wunderkind@")),
    )
    if (filtered.length === plugins.length) {
      return { success: true, configPath: targetPath, changed: false }
    }

    if (filtered.length === 0) {
      delete config.plugin
    } else {
      config.plugin = filtered
    }
    writeFileSync(targetPath, JSON.stringify(config, null, 2) + "\n")

     return { success: true, configPath: targetPath, changed: true }
   } catch (err) {
     return { success: false, configPath: targetPath, error: String(err) }
   }
  }

export function getNativeAgentDir(): string {
  return resolveConfigManagerPaths().globalOpenCodeAgentsDir
}

export function getNativeCommandsDir(): string {
  return resolveConfigManagerPaths().globalOpenCodeCommandsDir
}

export function getNativeSkillsDir(): string {
  return resolveConfigManagerPaths().globalOpenCodeSkillsDir
}

export function getNativeAgentFilePaths(scope: InstallScope): string[] {
  void scope
  const dir = getNativeAgentDir()
  return WUNDERKIND_AGENT_IDS.map((id) => join(dir, `${id}.md`))
}

function getPackagedCommandFilePaths(): string[] {
  const commandsDir = fileURLToPath(new URL("../../../commands", import.meta.url))
  if (!existsSync(commandsDir)) return []
  return readdirSync(commandsDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => join(commandsDir, entry))
}

function collectFilesRecursively(rootDir: string): string[] {
  if (!existsSync(rootDir)) return []

  const results: string[] = []
  for (const entry of readdirSync(rootDir)) {
    const fullPath = join(rootDir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

function getPackagedSkillDirectories(): string[] {
  const skillsDir = fileURLToPath(new URL("../../../skills", import.meta.url))
  if (!existsSync(skillsDir)) return []
  return readdirSync(skillsDir)
    .map((entry) => join(skillsDir, entry))
    .filter((entry) => statSync(entry).isDirectory())
}

export function getNativeCommandFilePaths(): string[] {
  const dir = getNativeCommandsDir()
  return getPackagedCommandFilePaths().map((source) => join(dir, basename(source)))
}

export function getNativeSkillDirectories(scope: InstallScope): string[] {
  void scope
  const dir = getNativeSkillsDir()
  return getPackagedSkillDirectories().map((source) => join(dir, basename(source)))
}

function copyFileSet(sourceFiles: string[], sourceRoot: string, targetRoot: string): void {
  mkdirSync(targetRoot, { recursive: true })
  for (const sourceFile of sourceFiles) {
    const relativePath = relative(sourceRoot, sourceFile)
    const targetFile = join(targetRoot, relativePath)
    mkdirSync(dirname(targetFile), { recursive: true })
    writeFileSync(targetFile, readFileSync(sourceFile, "utf-8"), "utf-8")
  }
}

export function writeNativeAgentFiles(scope: InstallScope): ConfigMergeResult {
  void scope
  const targetDir = getNativeAgentDir()

  try {
    mkdirSync(targetDir, { recursive: true })
    for (const definition of WUNDERKIND_AGENT_DEFINITIONS) {
      writeFileSync(join(targetDir, `${definition.id}.md`), renderNativeAgentMarkdown(definition), "utf-8")
    }
    return { success: true, configPath: targetDir }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}

export function writeNativeCommandFiles(): ConfigMergeResult {
  const targetDir = getNativeCommandsDir()
  const sourceFiles = getPackagedCommandFilePaths()
  const sourceRoot = fileURLToPath(new URL("../../../commands", import.meta.url))

  try {
    copyFileSet(sourceFiles, sourceRoot, targetDir)
    return { success: true, configPath: targetDir }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}

export function writeNativeSkillFiles(scope: InstallScope): ConfigMergeResult {
  void scope
  const targetDir = getNativeSkillsDir()
  const skillDirs = getPackagedSkillDirectories()
  const sourceRoot = fileURLToPath(new URL("../../../skills", import.meta.url))

  try {
    const sourceFiles = skillDirs.flatMap((skillDir) => collectFilesRecursively(skillDir))
    copyFileSet(sourceFiles, sourceRoot, targetDir)
    return { success: true, configPath: targetDir }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}

export function detectNativeAgentFiles(scope: InstallScope): { dir: string; presentCount: number; totalCount: number; allPresent: boolean } {
  void scope
  const dir = getNativeAgentDir()
  const presentCount = getNativeAgentFilePaths(scope).filter((filePath) => existsSync(filePath)).length
  const totalCount = WUNDERKIND_AGENT_IDS.length

  return {
    dir,
    presentCount,
    totalCount,
    allPresent: presentCount === totalCount,
  }
}

export function detectNativeCommandFiles(): { dir: string; presentCount: number; totalCount: number; allPresent: boolean } {
  const dir = getNativeCommandsDir()
  const presentCount = getNativeCommandFilePaths().filter((filePath) => existsSync(filePath)).length
  const totalCount = getPackagedCommandFilePaths().length

  return { dir, presentCount, totalCount, allPresent: presentCount === totalCount }
}

export function detectNativeSkillFiles(scope: InstallScope): { dir: string; presentCount: number; totalCount: number; allPresent: boolean } {
  void scope
  const dir = getNativeSkillsDir()
  const presentCount = getNativeSkillDirectories(scope).filter((dirPath) => existsSync(dirPath)).length
  const totalCount = getPackagedSkillDirectories().length

  return { dir, presentCount, totalCount, allPresent: presentCount === totalCount }
}

export function removeNativeAgentFiles(scope: InstallScope): ConfigMergeResult {
  const filePaths = getNativeAgentFilePaths(scope)
  const targetDir = getNativeAgentDir()

  try {
    let changed = false
    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true })
        changed = true
      }
    }

    if (existsSync(targetDir) && readdirSync(targetDir).length === 0) {
      rmSync(targetDir, { recursive: true, force: true })
      changed = true
    }

    return { success: true, configPath: targetDir, changed }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}

export function removeNativeCommandFiles(): ConfigMergeResult {
  const filePaths = getNativeCommandFilePaths()
  const targetDir = getNativeCommandsDir()

  try {
    let changed = false
    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true })
        changed = true
      }
    }

    if (existsSync(targetDir) && readdirSync(targetDir).length === 0) {
      rmSync(targetDir, { recursive: true, force: true })
      changed = true
    }

    return { success: true, configPath: targetDir, changed }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}

export function removeNativeSkillFiles(scope: InstallScope): ConfigMergeResult {
  const skillDirs = getNativeSkillDirectories(scope)
  const targetDir = getNativeSkillsDir()

  try {
    let changed = false
    for (const skillDir of skillDirs) {
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true })
        changed = true
      }
    }

    if (existsSync(targetDir) && readdirSync(targetDir).length === 0) {
      rmSync(targetDir, { recursive: true, force: true })
      changed = true
    }

    return { success: true, configPath: targetDir, changed }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}
 
export function removeGlobalWunderkindConfig(): ConfigMergeResult {
  const paths = resolveConfigManagerPaths()
  try {
    if (!existsSync(paths.globalWunderkindConfig)) {
      return { success: true, configPath: paths.globalWunderkindConfig, changed: false }
    }
    rmSync(paths.globalWunderkindConfig, { force: true })

    if (existsSync(paths.globalWunderkindDir) && readdirSync(paths.globalWunderkindDir).length === 0) {
      rmSync(paths.globalWunderkindDir, { recursive: true, force: true })
    }

    return { success: true, configPath: paths.globalWunderkindConfig, changed: true }
  } catch (err) {
    return { success: false, configPath: paths.globalWunderkindConfig, error: String(err) }
  }
}
