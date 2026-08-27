import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, relative } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import { fileURLToPath } from "node:url"
import {
  WUNDERKIND_CANONICAL_MANIFEST,
  isShippedCanonicalSkill,
  type NativeAssetKind,
} from "../../agents/canonical-manifest.js"
import { WUNDERKIND_AGENT_IDS, WUNDERKIND_AGENT_DEFINITIONS } from "../../agents/manifest.js"
import { renderNativeAgentMarkdown } from "../../agents/render-markdown.js"
import { getCanonicalPackageVersion, readWunderkindAgentMarkdownVersion } from "../../agents/versioning.js"
import {
  getGeneratedRetainedNativeCommands,
  renderGeneratedRetainedNativeCommandMarkdown,
} from "../../agents/slash-commands.js"
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
  OmoConfigMigrationConflict,
  OmoConfigMigrationPreview,
  OmoConfigMigrationResult,
  OmoFreshnessInfo,
  OmoFreshnessStatus,
  OrgStructure,
  BaselineConfigKey,
  OmoInstallReadiness,
  OmoFreshnessSummary,
  PromptOptimizationLevel,
  PromptOptimizationLevelSource,
  PromptOptimizationMode,
  PromptOptimizationReportingMode,
  PluginVersionInfo,
  ProjectConfig,
  ProductPersonality,
  PrdPipelineMode,
  TeamBootstrapScope,
  TeamCulture,
  WunderkindPathReadiness,
} from "../types.js"

const PACKAGE_NAME = WUNDERKIND_CANONICAL_MANIFEST.package.name
const WUNDERKIND_SAFE_FALLBACK_COMMAND = "bunx @grant-vine/wunderkind" as const
const WUNDERKIND_SCHEMA_URL = WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.configSchemaUrl
const OMO_CANONICAL_PACKAGE_NAME = WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.upstream.omoCanonicalPackageName
const NATIVE_ASSET_VERSION_MARKER_FILENAME = WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.markerFilename
const LEGACY_OMO_CONFIG_WARNING_TITLE = "Legacy OMO configuration remains" as const
const LEGACY_OMO_CONFIG_WARNING_FIX =
  "Run `wunderkind migrate` to merge it into ~/.omo/omo.jsonc." as const

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

function isPromptOptimizationMode(value: unknown): value is PromptOptimizationMode {
  return value === "off" || value === "advisory" || value === "active"
}

function isPromptOptimizationLevel(value: unknown): value is PromptOptimizationLevel {
  return value === "latest-user" || value === "runtime-and-tools" || value === "contextual" || value === "transcript"
}

function isPromptOptimizationReportingMode(value: unknown): value is PromptOptimizationReportingMode {
  return value === "off" || value === "persist" || value === "summary"
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function formatMalformedPromptOptimizationLevel(value: unknown): string | undefined {
  if (value === undefined || isPromptOptimizationLevel(value)) {
    return undefined
  }

  if (typeof value === "string") {
    return value
  }

  const jsonValue = JSON.stringify(value)
  return jsonValue ?? String(value)
}

function resolvePromptOptimizationState(input: {
  promptOptimizationEnabled: boolean | undefined
  promptOptimizationMode: PromptOptimizationMode | undefined
  promptOptimizationLevel: PromptOptimizationLevel | undefined
  malformedPromptOptimizationLevel: string | undefined
}): {
  enabled: boolean
  mode: PromptOptimizationMode
  level?: PromptOptimizationLevel
  levelSource?: PromptOptimizationLevelSource
} {
  const {
    promptOptimizationEnabled,
    promptOptimizationMode,
    promptOptimizationLevel,
    malformedPromptOptimizationLevel,
  } = input
  const implicitLevelSource: PromptOptimizationLevelSource = malformedPromptOptimizationLevel !== undefined
    ? "malformed-persisted"
    : "legacy-compatibility"

  if (promptOptimizationEnabled === false) {
    return { enabled: false, mode: "off" }
  }

  if (promptOptimizationEnabled === true) {
    if (promptOptimizationMode === undefined) {
      return promptOptimizationLevel === undefined
        ? { enabled: true, mode: "advisory", levelSource: implicitLevelSource }
        : { enabled: true, mode: "advisory", level: promptOptimizationLevel, levelSource: "explicit" }
    }

    const resolvedState: { enabled: boolean; mode: PromptOptimizationMode } = promptOptimizationMode === "off"
      ? { enabled: false, mode: "off" }
      : { enabled: true, mode: promptOptimizationMode }

    if (!resolvedState.enabled) {
      return resolvedState
    }

    return promptOptimizationLevel === undefined
      ? { ...resolvedState, levelSource: implicitLevelSource }
      : { ...resolvedState, level: promptOptimizationLevel, levelSource: "explicit" }
  }

  if (promptOptimizationMode === undefined || promptOptimizationMode === "off") {
    return { enabled: false, mode: "off" }
  }

  return promptOptimizationLevel === undefined
    ? { enabled: true, mode: promptOptimizationMode, levelSource: implicitLevelSource }
    : { enabled: true, mode: promptOptimizationMode, level: promptOptimizationLevel, levelSource: "explicit" }
}

function getValidatedPromptOptimizationBudgets(config: Partial<ProjectConfig>): {
  promptOptimizationTokenBudget?: number
  promptOptimizationByteBudget?: number
} {
  const budgets: {
    promptOptimizationTokenBudget?: number
    promptOptimizationByteBudget?: number
  } = {}

  if (isPositiveInteger(config.promptOptimizationTokenBudget)) {
    budgets.promptOptimizationTokenBudget = config.promptOptimizationTokenBudget
  }

  if (isPositiveInteger(config.promptOptimizationByteBudget)) {
    budgets.promptOptimizationByteBudget = config.promptOptimizationByteBudget
  }

  return budgets
}

function validatePromptOptimizationConfig(config: Partial<ProjectConfig>): string | null {
  if (
    config.promptOptimizationLevel !== undefined &&
    !isPromptOptimizationLevel(config.promptOptimizationLevel)
  ) {
    return "promptOptimizationLevel must be one of: latest-user, runtime-and-tools, contextual, or transcript"
  }

  if (
    config.promptOptimizationReportingMode !== undefined &&
    !isPromptOptimizationReportingMode(config.promptOptimizationReportingMode)
  ) {
    return "promptOptimizationReportingMode must be one of: off, persist, or summary"
  }

  if (config.promptOptimizationTokenBudget !== undefined && !isPositiveInteger(config.promptOptimizationTokenBudget)) {
    return "promptOptimizationTokenBudget must be a positive integer"
  }

  if (config.promptOptimizationByteBudget !== undefined && !isPositiveInteger(config.promptOptimizationByteBudget)) {
    return "promptOptimizationByteBudget must be a positive integer"
  }

  return null
}

export function getPromptOptimizationHookBudgetBasis(input: {
  promptOptimizationByteBudget: number | undefined
}): "configured-bytes" | "budget-unavailable" {
  return isPositiveInteger(input.promptOptimizationByteBudget) ? "configured-bytes" : "budget-unavailable"
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
  omoUnifiedConfigDir: string
  omoUnifiedConfigJsonc: string
  omoConfigJson: string
  omoConfigJsonc: string
  omoLegacyConfigJson: string
  omoLegacyConfigJsonc: string
  wunderkindDir: string
  wunderkindConfig: string
  legacyWunderkindConfig: string
}

interface ConfigManagerPathOverride {
  cwd?: string
  home?: string
}

export type WunderkindTeamMemberKind = "category" | "subagent_type"
export type WunderkindTeamSubagentType = "sisyphus" | "atlas" | "sisyphus-junior" | "hephaestus"

export interface WunderkindTeamMemberSpec {
  readonly name: string
  readonly kind: WunderkindTeamMemberKind
  readonly category?: string
  readonly subagent_type?: WunderkindTeamSubagentType
  readonly prompt?: string
}

export interface WunderkindTeamSpec {
  readonly name: string
  readonly description?: string
  readonly lead: WunderkindTeamMemberSpec
  readonly members: readonly WunderkindTeamMemberSpec[]
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
  const omoUnifiedConfigDir = join(resolvedHome, ".omo")
  const wunderkindDir = join(resolvedCwd, ".wunderkind")

  return {
    configDir,
    configJson: join(configDir, "opencode.json"),
    configJsonc: join(configDir, "opencode.jsonc"),
    legacyConfigJson: join(configDir, "config.json"),
    legacyConfigJsonc: join(configDir, "config.jsonc"),
    globalWunderkindDir,
    globalWunderkindConfig: join(globalWunderkindDir, "wunderkind.config.jsonc"),
    globalOpenCodeAgentsDir: join(configDir, WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.openCodeDirs.agents),
    globalOpenCodeCommandsDir: join(configDir, WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.openCodeDirs.commands),
    globalOpenCodeSkillsDir: join(configDir, WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.openCodeDirs.skills),
    globalOpenCodeNodeModules: join(configDir, "node_modules"),
    globalCacheDir: join(resolvedHome, ".cache", "opencode"),
    omoUnifiedConfigDir,
    omoUnifiedConfigJsonc: join(omoUnifiedConfigDir, "omo.jsonc"),
    omoConfigJson: join(configDir, "oh-my-openagent.json"),
    omoConfigJsonc: join(configDir, "oh-my-openagent.jsonc"),
    omoLegacyConfigJson: join(configDir, "oh-my-opencode.json"),
    omoLegacyConfigJsonc: join(configDir, "oh-my-opencode.jsonc"),
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
  "cavemanEnabled",
  "promptOptimizationEnabled",
  "promptOptimizationMode",
  "promptOptimizationLevel",
  "promptOptimizationReportingMode",
  "promptOptimizationTokenBudget",
  "promptOptimizationByteBudget",
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
  cavemanEnabled: false,
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
  cavemanEnabled: DEFAULT_INSTALL_CONFIG.cavemanEnabled ?? false,
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

export function resolveWunderkindTeamConfigPath(scope: TeamBootstrapScope, teamName: string): string {
  const runtimeContext = resolveConfigManagerRuntimeContext()
  const teamRoot = scope === "project"
    ? join(runtimeContext.cwd, ".omo", "teams")
    : join(runtimeContext.home, ".omo", "teams")

  return join(teamRoot, teamName, "config.json")
}

export function writeWunderkindTeamConfig(spec: WunderkindTeamSpec, scope: TeamBootstrapScope): ConfigMergeResult {
  const configPath = resolveWunderkindTeamConfigPath(scope, spec.name)
  const configDir = dirname(configPath)

  try {
    mkdirSync(configDir, { recursive: true })
    writeFileSync(configPath, `${JSON.stringify(spec, null, 2)}\n`)
    return { success: true, configPath }
  } catch (err) {
    return { success: false, configPath, error: String(err) }
  }
}

export function resolveOpenCodeConfigPath(scope: InstallScope): {
  path: string
  format: "json" | "jsonc" | "none"
  source: "opencode.json" | "opencode.jsonc" | "default"
  ignoredLegacyPath: string | null
} {
  const runtimeContext = resolveConfigManagerRuntimeContext()
  const paths = resolveConfigManagerPaths()

  if (scope === "project") {
    const projectJson = join(runtimeContext.cwd, "opencode.json")
    const projectJsonc = join(runtimeContext.cwd, "opencode.jsonc")
    const projectLegacyJson = join(runtimeContext.cwd, "config.json")
    const projectLegacyJsonc = join(runtimeContext.cwd, "config.jsonc")
    const ignoredLegacyPath = existsSync(projectLegacyJson)
      ? projectLegacyJson
      : existsSync(projectLegacyJsonc)
        ? projectLegacyJsonc
        : null

    if (existsSync(projectJson)) return { path: projectJson, format: "json", source: "opencode.json", ignoredLegacyPath }
    if (existsSync(projectJsonc)) return { path: projectJsonc, format: "jsonc", source: "opencode.jsonc", ignoredLegacyPath }
    return { path: projectJson, format: "none", source: "default", ignoredLegacyPath }
  }

  const ignoredLegacyPath = existsSync(paths.legacyConfigJson)
    ? paths.legacyConfigJson
    : existsSync(paths.legacyConfigJsonc)
      ? paths.legacyConfigJsonc
      : null

  if (existsSync(paths.configJson)) return { path: paths.configJson, format: "json", source: "opencode.json", ignoredLegacyPath }
  if (existsSync(paths.configJsonc)) return { path: paths.configJsonc, format: "jsonc", source: "opencode.jsonc", ignoredLegacyPath }
  return { path: paths.configJson, format: "none", source: "default", ignoredLegacyPath }
}

function resolveOmoConfigPath(): {
  path: string | null
  format: "json" | "jsonc" | "none"
  source: "oh-my-openagent.json" | "oh-my-openagent.jsonc" | "omo.jsonc" | "default"
  legacyPath: string | null
} {
  const paths = resolveConfigManagerPaths()
  const unifiedJsoncExists = existsSync(paths.omoUnifiedConfigJsonc)
  const legacyPath = [
    paths.omoConfigJson,
    paths.omoConfigJsonc,
    paths.omoLegacyConfigJson,
    paths.omoLegacyConfigJsonc,
  ].find((filePath) => existsSync(filePath)) ?? null

  if (unifiedJsoncExists) {
    return { path: paths.omoUnifiedConfigJsonc, format: "jsonc", source: "omo.jsonc", legacyPath }
  }

  return { path: null, format: "none", source: "default", legacyPath }
}

function formatLegacyOmoConfigWarning(legacyPath: string): string {
  return [
    LEGACY_OMO_CONFIG_WARNING_TITLE,
    `Legacy configuration remains at ${legacyPath}. It is not part of the unified ~/.omo/omo.jsonc config chain.`,
    `Fix: ${LEGACY_OMO_CONFIG_WARNING_FIX}`,
  ].join("\n")
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

function parseConfigOrThrow(path: string): OpenCodeConfig {
  const parsed = parseConfig(path)
  if (parsed === null) {
    throw new Error(`Invalid config format: ${path}`)
  }
  return parsed
}

function writeConfigFile(path: string, config: OpenCodeConfig): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n")
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function cloneConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneConfigValue(entry))
  }

  if (isPlainRecord(value)) {
    const clone: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneConfigValue(nestedValue)
    }
    return clone
  }

  return value
}

function mergeLegacyConfigIntoTarget(input: {
  legacyConfig: OpenCodeConfig
  targetConfig: OpenCodeConfig
}): { mergedConfig: OpenCodeConfig; preview: OmoConfigMigrationPreview } {
  const mergedConfig = cloneConfigValue(input.targetConfig)
  if (!isPlainRecord(mergedConfig)) {
    throw new Error("Target OMO config must be an object")
  }

  const copiedPaths: string[] = []
  const keptPaths: string[] = []
  const conflicts: OmoConfigMigrationConflict[] = []

  const mergeInto = (target: Record<string, unknown>, legacy: Record<string, unknown>, basePath: string): void => {
    for (const [key, legacyValue] of Object.entries(legacy)) {
      const nextPath = basePath === "" ? key : `${basePath}.${key}`
      if (!(key in target)) {
        target[key] = cloneConfigValue(legacyValue)
        copiedPaths.push(nextPath)
        continue
      }

      const targetValue = target[key]
      if (isPlainRecord(targetValue) && isPlainRecord(legacyValue)) {
        mergeInto(targetValue, legacyValue, nextPath)
        continue
      }

      keptPaths.push(nextPath)
      conflicts.push({ path: nextPath, legacyValue, keptValue: targetValue })
    }
  }

  mergeInto(mergedConfig, input.legacyConfig, "")

  return {
    mergedConfig,
    preview: {
      copiedPaths,
      keptPaths,
      conflicts,
    },
  }
}

export function migrateLegacyOmoConfig(options: { dryRun?: boolean } = {}): OmoConfigMigrationResult {
  const paths = resolveConfigManagerPaths()
  const legacyConfigPaths = [
    paths.omoConfigJson,
    paths.omoConfigJsonc,
    paths.omoLegacyConfigJson,
    paths.omoLegacyConfigJsonc,
  ].filter((filePath) => existsSync(filePath))
  const legacyConfigPath = legacyConfigPaths[0] ?? null

  if (legacyConfigPath === null) {
    return {
      status: "noop",
      legacyConfigPath: null,
      targetConfigPath: paths.omoUnifiedConfigJsonc,
      preview: { copiedPaths: [], keptPaths: [], conflicts: [] },
      message: "Nothing to migrate.",
    }
  }

  try {
    let mergedConfig: OpenCodeConfig = existsSync(paths.omoUnifiedConfigJsonc)
      ? parseConfigOrThrow(paths.omoUnifiedConfigJsonc)
      : {}
    const aggregatePreview: {
      copiedPaths: string[]
      keptPaths: string[]
      conflicts: OmoConfigMigrationConflict[]
    } = {
      copiedPaths: [],
      keptPaths: [],
      conflicts: [],
    }

    for (const sourcePath of legacyConfigPaths) {
      const legacyConfig = parseConfigOrThrow(sourcePath)
      const mergeResult = mergeLegacyConfigIntoTarget({ legacyConfig, targetConfig: mergedConfig })
      mergedConfig = mergeResult.mergedConfig
      aggregatePreview.copiedPaths.push(...mergeResult.preview.copiedPaths)
      aggregatePreview.keptPaths.push(...mergeResult.preview.keptPaths)
      aggregatePreview.conflicts.push(...mergeResult.preview.conflicts)
    }

    const preview: OmoConfigMigrationPreview = aggregatePreview
    const migrationLabel = legacyConfigPaths.length === 1
      ? legacyConfigPath
      : `${legacyConfigPaths.length} legacy OMO config files`

    if (options.dryRun === true) {
      return {
        status: "dry-run",
        legacyConfigPath,
        targetConfigPath: paths.omoUnifiedConfigJsonc,
        preview,
        message: `Dry run: would migrate ${migrationLabel} into ~/.omo/omo.jsonc.`,
      }
    }

    mkdirSync(paths.omoUnifiedConfigDir, { recursive: true })
    writeConfigFile(paths.omoUnifiedConfigJsonc, mergedConfig)
    for (const sourcePath of legacyConfigPaths) {
      rmSync(sourcePath)
    }

    return {
      status: "migrated",
      legacyConfigPath,
      targetConfigPath: paths.omoUnifiedConfigJsonc,
      preview,
      message: `Migrated ${migrationLabel} into ~/.omo/omo.jsonc.`,
    }
  } catch (error) {
    return {
      status: "error",
      legacyConfigPath,
      targetConfigPath: paths.omoUnifiedConfigJsonc,
      preview: { copiedPaths: [], keptPaths: [], conflicts: [] },
      message: `Failed to migrate ${legacyConfigPath}.`,
      error: error instanceof Error ? error.message : String(error),
    }
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

function stripAnsi(value: string): string {
  return value.replace(new RegExp("\\u001b\\[[0-9;]*m", "g"), "")
}

function isOmoFreshnessStatus(value: unknown): value is OmoFreshnessStatus {
  return (
    value === "up-to-date" ||
    value === "outdated" ||
    value === "local-dev" ||
    value === "pinned" ||
    value === "error" ||
    value === "unknown"
  )
}

function parseOmoFreshnessJson(stdoutValue: string): OmoFreshnessInfo | null {
  try {
    const parsed = JSON.parse(stdoutValue) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null

    const record = parsed as Record<string, unknown>
    const status = record.status
    if (!isOmoFreshnessStatus(status)) return null

    const currentVersion = typeof record.currentVersion === "string"
      ? record.currentVersion
      : typeof record.pluginVersion === "string"
        ? record.pluginVersion
        : null
    const latestVersion = typeof record.latestVersion === "string" ? record.latestVersion : null
    const pinnedVersion = typeof record.pinnedVersion === "string" ? record.pinnedVersion : null

    return {
      status,
      currentVersion,
      latestVersion,
      pinnedVersion,
      renderedOutput: null,
    }
  } catch {
    return null
  }
}

function detectOmoFreshnessInfo(cwd: string): OmoFreshnessInfo {
  const runtimeContext = resolveConfigManagerRuntimeContext()
  const spawnEnv = {
    ...process.env,
    HOME: runtimeContext.home,
    USERPROFILE: runtimeContext.home,
    XDG_CONFIG_HOME: join(runtimeContext.home, ".config"),
  }
  const baseInfo: OmoFreshnessInfo = {
    status: "unknown",
    currentVersion: null,
    latestVersion: null,
    pinnedVersion: null,
    renderedOutput: null,
  }

  const jsonResult = spawnSync("bunx", ["oh-my-openagent", "get-local-version", "--json", "--directory", cwd], {
    encoding: "utf8",
    timeout: 750,
    maxBuffer: 1024 * 32,
    env: spawnEnv,
  })

  if (jsonResult.error) return baseInfo

  const parsed = typeof jsonResult.stdout === "string" ? parseOmoFreshnessJson(jsonResult.stdout) : null
  if (parsed === null) return baseInfo

  if (parsed.status !== "outdated") {
    return {
      ...parsed,
      renderedOutput: null,
    }
  }

  const textResult = spawnSync("bunx", ["oh-my-openagent", "get-local-version", "--directory", cwd], {
    encoding: "utf8",
    timeout: 750,
    maxBuffer: 1024 * 32,
    env: spawnEnv,
  })
  const renderedOutput = textResult.error ? "" : typeof textResult.stdout === "string" ? stripAnsi(textResult.stdout).trim() : ""

  return {
    ...parsed,
    renderedOutput: renderedOutput !== "" ? renderedOutput : null,
  }
}

function normalizeDependencyVersion(entry: string | null): string | null {
  if (!entry) return null
  const match = entry.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)
  return match?.[0] ?? null
}

function findPluginEntry(entries: readonly string[], packageName: string): string | null {
  return (
    entries.find((entry) => {
      if (entry === packageName || entry.startsWith(`${packageName}@`)) {
        return true
      }

      if (!entry.startsWith("file://")) {
        return false
      }

      return entry.includes(`/${packageName}`) || entry.endsWith(packageName)
    }) ?? null
  )
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

function getOmoLoadedPackageInfo(): {
  loaded: { version: string | null; packagePath: string | null }
  loadedSources: {
    global: { version: string | null; packagePath: string | null }
    cache: { version: string | null; packagePath: string | null }
  }
  packageNameUsed: string | null
} {
  const loaded = detectLoadedPackageVersion(OMO_CANONICAL_PACKAGE_NAME)
  const loadedSources = detectLoadedPackageSources(OMO_CANONICAL_PACKAGE_NAME)
  const hasLoadedPackage = loaded.version !== null || loaded.packagePath !== null
  const hasSources = loadedSources.global.packagePath !== null || loadedSources.cache.packagePath !== null

  if (hasLoadedPackage || hasSources) {
    return {
      loaded,
      loadedSources,
      packageNameUsed: OMO_CANONICAL_PACKAGE_NAME,
    }
  }

  return {
    loaded: { version: null, packagePath: null },
    loadedSources: {
      global: { version: null, packagePath: null },
      cache: { version: null, packagePath: null },
    },
    packageNameUsed: null,
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

export function detectPluginVersionInfo(packageName: string): PluginVersionInfo {
  const configResolution = resolveOpenCodeConfigPath("global")
  const configPath = existsSync(configResolution.path) ? configResolution.path : null
  const config = configPath ? parseConfig(configPath) : null
  const registeredEntry = findPluginEntry((config?.plugin ?? []) as string[], packageName)
  const loaded = detectLoadedPackageVersion(packageName)

  return {
    packageName,
    currentVersion: packageName === PACKAGE_NAME ? getCanonicalPackageVersion() : null,
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
  const omoConfigResolution = resolveOmoConfigPath()
  const openCodeConfigResolution = resolveOpenCodeConfigPath("global")
  const configPath = omoConfigResolution.path
  const omoConfig = configPath ? parseConfig(configPath) : null
  const openCodeConfig = existsSync(openCodeConfigResolution.path) ? parseConfig(openCodeConfigResolution.path) : null
  const omoPlugins = (omoConfig?.plugin ?? []) as string[]
  const openCodePlugins = (openCodeConfig?.plugin ?? []) as string[]
  const plugins = omoPlugins.length > 0 ? omoPlugins : openCodePlugins

  const registeredCanonicalEntry = findPluginEntry(plugins, OMO_CANONICAL_PACKAGE_NAME)
  const packageInfo = getOmoLoadedPackageInfo()
  const staleOverrideWarning = buildStaleOverrideWarning({
    packageName: packageInfo.packageNameUsed ?? OMO_CANONICAL_PACKAGE_NAME,
    globalVersion: packageInfo.loadedSources.global.version,
    cacheVersion: packageInfo.loadedSources.cache.version,
  })
  const freshness = registeredCanonicalEntry !== null
    ? detectOmoFreshnessInfo(resolveConfigManagerRuntimeContext().cwd)
    : null
  const currentVersion = freshness?.currentVersion ?? null
  const versionSkewWarning =
    currentVersion !== null &&
    packageInfo.loaded.version !== null &&
    compareVersions(currentVersion, packageInfo.loaded.version) !== 0
      ? `upstream get-local-version reports ${currentVersion} but the loaded ${packageInfo.packageNameUsed ?? OMO_CANONICAL_PACKAGE_NAME} package is ${packageInfo.loaded.version}`
      : null
  const dualConfigWarning = omoConfigResolution.legacyPath !== null
    ? formatLegacyOmoConfigWarning(omoConfigResolution.legacyPath)
    : null

  return {
    packageName: OMO_CANONICAL_PACKAGE_NAME,
    currentVersion,
    registeredEntry: registeredCanonicalEntry,
    registeredVersion: normalizeDependencyVersion(registeredCanonicalEntry),
    loadedVersion: packageInfo.loaded.version,
    configPath,
    configSource: configPath === null ? null : omoConfigResolution.source,
    legacyConfigPath: omoConfigResolution.legacyPath,
    loadedPackagePath: packageInfo.loaded.packagePath,
    registered: registeredCanonicalEntry !== null,
    loadedSources: packageInfo.loadedSources,
    staleOverrideWarning,
    versionSkewWarning,
    dualConfigWarning,
    freshness,
  }
}

export function detectOmoInstallReadiness(): OmoInstallReadiness {
  const versionInfo = detectOmoVersionInfo()
  const installed = versionInfo.registered
  const freshnessSummary = summarizeOmoFreshness(versionInfo)

  return {
    installed,
    registered: versionInfo.registered,
    loadedVersion: versionInfo.loadedVersion,
    configPath: versionInfo.configPath,
    configSource: versionInfo.configSource ?? null,
    legacyConfigPath: versionInfo.legacyConfigPath ?? null,
    staleOverrideWarning: versionInfo.staleOverrideWarning ?? null,
    versionSkewWarning: versionInfo.versionSkewWarning ?? null,
    dualConfigWarning: versionInfo.dualConfigWarning ?? null,
    freshness: versionInfo.freshness ?? null,
    freshnessSummary,
    interactiveInstallCommand: "bunx oh-my-openagent install",
    nonTuiInstallCommand: "bunx oh-my-openagent install --no-tui --claude=yes --gemini=no --copilot=yes",
    guidance: versionInfo.dualConfigWarning ?? "Use oh-my-openagent for plugin entries, config basenames, and install commands.",
  }
}

export function summarizeOmoFreshness(versionInfo: PluginVersionInfo): OmoFreshnessSummary {
  const freshness = versionInfo.freshness

  if (!versionInfo.registered) {
    return {
      state: "not-detected",
      guidance: "oh-my-openagent plugin/config naming was not detected — run `bunx oh-my-openagent install`.",
    }
  }

  if (versionInfo.staleOverrideWarning) {
    return {
      state: "stale-override",
      guidance:
        "A stale global oh-my-openagent install is likely overriding a newer cache copy — refresh the global install and restart OpenCode.",
    }
  }

  if (versionInfo.versionSkewWarning) {
    return {
      state: "version-skew",
      guidance:
        "oh-my-openagent reports a newer current version than the package OpenCode appears to have loaded — rerun `bunx oh-my-openagent install`, then restart OpenCode so the active plugin matches upstream.",
    }
  }

  if (versionInfo.dualConfigWarning) {
    return {
      state: "not-verified",
      guidance: "Run `wunderkind migrate` to merge the legacy config into ~/.omo/omo.jsonc.",
    }
  }

  if (!freshness || freshness.status === "unknown" || freshness.status === "error") {
    return {
      state: "not-verified",
      guidance:
        "Latest oh-my-openagent freshness could not be verified — use `bunx oh-my-openagent get-local-version` for upstream update advice.",
    }
  }

  if (freshness.status === "up-to-date") {
    return {
      state: "up-to-date",
      guidance: "oh-my-openagent is already up to date.",
    }
  }

  if (freshness.status === "outdated") {
    const upgradeCommand = freshness.renderedOutput?.split("\n").find((lineValue) => lineValue.includes("Run:"))
    return {
      state: "update-available",
      guidance:
        upgradeCommand ??
        "An oh-my-openagent plugin/config update is available — run `bunx oh-my-openagent get-local-version` for the recommended command.",
    }
  }

  if (freshness.status === "local-dev") {
    return {
      state: "local-dev",
      guidance: "oh-my-openagent is running in local development mode — upstream update checks are informational only.",
    }
  }

  return {
    state: "pinned",
    guidance: "oh-my-openagent is pinned, so automatic upgrade advice is intentionally suppressed upstream.",
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

export function detectWunderkindPathReadiness(): WunderkindPathReadiness {
  const result = spawnSync("wunderkind", ["--version"], {
    encoding: "utf8",
    timeout: 750,
    maxBuffer: 1024 * 32,
  })

  if (!result.error && result.status === 0) {
    return {
      available: true,
      guidance:
        `Direct \`wunderkind\` invocation is available in the current shell PATH. ` +
        `\`${WUNDERKIND_SAFE_FALLBACK_COMMAND} ...\` remains the safe fallback.`,
    }
  }

  return {
    available: false,
    guidance:
      `Direct \`wunderkind\` invocation is not available in the current shell PATH. ` +
      `Keep using \`${WUNDERKIND_SAFE_FALLBACK_COMMAND} ...\`. Wunderkind does not auto-edit shell PATH.`,
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
  if (typeof source["cavemanEnabled"] === "boolean") result.cavemanEnabled = source["cavemanEnabled"]
  if (typeof source["promptOptimizationEnabled"] === "boolean") {
    result.promptOptimizationEnabled = source["promptOptimizationEnabled"]
  }
  if (isPromptOptimizationMode(source["promptOptimizationMode"])) {
    result.promptOptimizationMode = source["promptOptimizationMode"]
  }
  if (isPromptOptimizationLevel(source["promptOptimizationLevel"])) {
    result.promptOptimizationLevel = source["promptOptimizationLevel"]
  }
  if (isPromptOptimizationReportingMode(source["promptOptimizationReportingMode"])) {
    result.promptOptimizationReportingMode = source["promptOptimizationReportingMode"]
  }
  if (isPositiveInteger(source["promptOptimizationTokenBudget"])) {
    result.promptOptimizationTokenBudget = source["promptOptimizationTokenBudget"]
  }
  if (isPositiveInteger(source["promptOptimizationByteBudget"])) {
    result.promptOptimizationByteBudget = source["promptOptimizationByteBudget"]
  }

  return result
}

function getMalformedPersistedPromptOptimizationLevel(source: Record<string, unknown> | null): string | undefined {
  if (source === null || !("promptOptimizationLevel" in source)) {
    return undefined
  }

  return formatMalformedPromptOptimizationLevel(source["promptOptimizationLevel"])
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

export function validateProjectWunderkindConfigWriteTarget(): ConfigMergeResult | null {
  const paths = resolveConfigManagerPaths()

  try {
    try {
      const directory = lstatSync(paths.wunderkindDir)
      if (!directory.isDirectory() || directory.isSymbolicLink()) {
        return { success: false, configPath: paths.wunderkindConfig, error: "Project config directory must be a physical directory" }
      }
    } catch (err) {
      if (!(err instanceof Error) || !("code" in err) || err.code !== "ENOENT") throw err
    }

    try {
      const config = lstatSync(paths.wunderkindConfig)
      if (!config.isFile() || config.isSymbolicLink()) {
        return { success: false, configPath: paths.wunderkindConfig, error: "Project config must be a physical regular file" }
      }
    } catch (err) {
      if (!(err instanceof Error) || !("code" in err) || err.code !== "ENOENT") throw err
    }

    return null
  } catch (err) {
    return { success: false, configPath: paths.wunderkindConfig, error: String(err) }
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
  const resolvedPromptOptimization = resolvePromptOptimizationState({
    promptOptimizationEnabled: config.promptOptimizationEnabled,
    promptOptimizationMode: config.promptOptimizationMode,
    promptOptimizationLevel: config.promptOptimizationLevel,
    malformedPromptOptimizationLevel: undefined,
  })
  const promptOptimizationReportingMode = config.promptOptimizationReportingMode ?? "off"
  const promptOptimizationBudgets = getValidatedPromptOptimizationBudgets(config)
  const omitPromptOptimizationFields =
    resolvedPromptOptimization.enabled === false &&
    resolvedPromptOptimization.mode === "off" &&
    config.promptOptimizationLevel === undefined &&
    promptOptimizationReportingMode === "off" &&
    promptOptimizationBudgets.promptOptimizationTokenBudget === undefined &&
    promptOptimizationBudgets.promptOptimizationByteBudget === undefined
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
    `  // "filesystem" writes to .omo/; "github" expects gh + GitHub repo readiness`,
    `  // PRD pipeline mode: "filesystem" | "github"`,
    `  "prdPipelineMode": ${JSON.stringify(config.prdPipelineMode ?? "filesystem")},`,
    ``,
  )

    if (!omitPromptOptimizationFields) {
      lines.push(
        `  // Supplementary prompt optimization engine settings`,
        `  // Omit these keys to keep the shipped product posture default-off; set them only for explicitly enabled project-local runtime contexts`,
        `  // Enabling optimization keeps the security-safe baseline on: redacted reporting, preserve/fallback enforcement, and no protected-content persistence drift`,
        `  // promptOptimizationLevel is the capability-based surface selector. Legacy enabled repos that omit it keep the current shipped behavior until an operator explicitly chooses a level`,
        `  // promptOptimizationReportingMode controls sanitized/redacted latest-report artifacts or summaries on the separate runtime-report surface, not the audit-only token-audit surface`,
      )

    if (config.promptOptimizationEnabled !== undefined) {
      lines.push(`  "promptOptimizationEnabled": ${JSON.stringify(config.promptOptimizationEnabled)},`)
    }

    if (config.promptOptimizationMode !== undefined) {
      lines.push(`  "promptOptimizationMode": ${JSON.stringify(config.promptOptimizationMode)},`)
    }

    if (config.promptOptimizationLevel !== undefined) {
      lines.push(
        `  // Level: "latest-user" | "runtime-and-tools" | "contextual" | "transcript"`,
      )
      lines.push(`  "promptOptimizationLevel": ${JSON.stringify(config.promptOptimizationLevel)},`)
    }

    if (config.promptOptimizationReportingMode !== undefined && config.promptOptimizationReportingMode !== "off") {
      lines.push(
        `  // Reporting mode: "persist" keeps sanitized/redacted latest-report artifacts, and "summary" also emits sanitized/redacted summary metadata`,
      )
      lines.push(`  "promptOptimizationReportingMode": ${JSON.stringify(config.promptOptimizationReportingMode)},`)
    }

    if (promptOptimizationBudgets.promptOptimizationTokenBudget !== undefined) {
      lines.push(`  "promptOptimizationTokenBudget": ${JSON.stringify(promptOptimizationBudgets.promptOptimizationTokenBudget)},`)
    }

    if (promptOptimizationBudgets.promptOptimizationByteBudget !== undefined) {
      lines.push(`  "promptOptimizationByteBudget": ${JSON.stringify(promptOptimizationBudgets.promptOptimizationByteBudget)},`)
    }

    lines.push(``)
  }

  lines.push(
    `  // Communication mode`,
    `  // Enable project-default caveman mode for terse, high-signal replies when compression preserves full value`,
    `  "cavemanEnabled": ${JSON.stringify(config.cavemanEnabled ?? false)},`,
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

  const promptOptimizationValidationError = validatePromptOptimizationConfig(config)
  if (promptOptimizationValidationError !== null) {
    return { success: false, configPath: paths.wunderkindConfig, error: promptOptimizationValidationError }
  }

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
  const malformedPromptOptimizationLevel = getMalformedPersistedPromptOptimizationLevel(projectConfig)
  const resolvedPromptOptimization = resolvePromptOptimizationState({
    promptOptimizationEnabled: projectLocal?.promptOptimizationEnabled,
    promptOptimizationMode: projectLocal?.promptOptimizationMode,
    promptOptimizationLevel: projectLocal?.promptOptimizationLevel,
    malformedPromptOptimizationLevel,
  })

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
    teamCulture: projectLocal?.teamCulture ?? defaults.teamCulture,
    orgStructure: projectLocal?.orgStructure ?? defaults.orgStructure,
    cisoPersonality: projectLocal?.cisoPersonality ?? defaults.cisoPersonality,
    ctoPersonality: projectLocal?.ctoPersonality ?? defaults.ctoPersonality,
    cmoPersonality: projectLocal?.cmoPersonality ?? defaults.cmoPersonality,
    productPersonality: projectLocal?.productPersonality ?? defaults.productPersonality,
    creativePersonality: projectLocal?.creativePersonality ?? defaults.creativePersonality,
    legalPersonality: projectLocal?.legalPersonality ?? defaults.legalPersonality,
    docsEnabled: projectLocal?.docsEnabled ?? defaults.docsEnabled,
    docsPath: projectLocal?.docsPath ?? defaults.docsPath,
    docHistoryMode: projectLocal?.docHistoryMode ?? defaults.docHistoryMode,
    prdPipelineMode: projectLocal?.prdPipelineMode ?? defaults.prdPipelineMode,
    designTool: projectLocal?.designTool ?? defaults.designTool ?? DEFAULT_PROJECT_CONFIG.designTool,
    designPath: projectLocal?.designPath ?? defaults.designPath ?? DEFAULT_PROJECT_CONFIG.designPath,
    designMcpOwnership: projectLocal?.designMcpOwnership ?? defaults.designMcpOwnership ?? DEFAULT_PROJECT_CONFIG.designMcpOwnership,
    cavemanEnabled: projectLocal?.cavemanEnabled ?? defaults.cavemanEnabled ?? false,
    promptOptimizationEnabled: resolvedPromptOptimization.enabled,
    promptOptimizationMode: resolvedPromptOptimization.mode,
    ...(resolvedPromptOptimization.level !== undefined
      ? { promptOptimizationLevel: resolvedPromptOptimization.level }
      : {}),
    ...(resolvedPromptOptimization.enabled && resolvedPromptOptimization.levelSource !== undefined
      ? { promptOptimizationLevelSource: resolvedPromptOptimization.levelSource }
      : {}),
    ...(malformedPromptOptimizationLevel !== undefined
      ? { promptOptimizationMalformedLevel: malformedPromptOptimizationLevel }
      : {}),
    ...(projectLocal?.promptOptimizationReportingMode !== undefined
      ? { promptOptimizationReportingMode: projectLocal.promptOptimizationReportingMode }
      : {}),
    ...(projectLocal?.promptOptimizationTokenBudget !== undefined
      ? { promptOptimizationTokenBudget: projectLocal.promptOptimizationTokenBudget }
      : {}),
    ...(projectLocal?.promptOptimizationByteBudget !== undefined
      ? { promptOptimizationByteBudget: projectLocal.promptOptimizationByteBudget }
      : {}),
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
  return WUNDERKIND_CANONICAL_MANIFEST.commands.static
    .map((command) => fileURLToPath(new URL(`../../../${command.sourcePath}`, import.meta.url)))
    .filter((filePath) => existsSync(filePath))
}

function getPackagedCommandNames(): string[] {
  return WUNDERKIND_CANONICAL_MANIFEST.commands.static.map((command) => command.name)
}

function getGeneratedRetainedNativeCommandNames(): string[] {
  return getGeneratedRetainedNativeCommands().map((command) => command.name)
}

function assertNoNativeCommandNameCollisions(packagedNames: readonly string[], generatedNames: readonly string[]): void {
  const packaged = new Set(packagedNames)

  for (const name of generatedNames) {
    if (packaged.has(name)) {
      throw new Error(`Generated retained command name "${name}" collides with shipped static command asset`)
    }
  }
}

function removeStaleCommandFiles(targetDir: string, activeFileNames: readonly string[]): void {
  if (!existsSync(targetDir)) return

  const active = new Set(activeFileNames)

  for (const entry of readdirSync(targetDir)) {
    if (!entry.endsWith(".md")) continue
    if (active.has(entry)) continue
    rmSync(join(targetDir, entry), { force: true })
  }
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
  return WUNDERKIND_CANONICAL_MANIFEST.skills
    .filter(
      (skill) =>
        isShippedCanonicalSkill(skill) && (skill.bucket === "promoted" || skill.bucket === "wunderkind-specific"),
    )
    .map((skill) => fileURLToPath(new URL(`../../../${skill.sourcePath}`, import.meta.url)))
    .map((filePath) => dirname(filePath))
    .filter((dirPath, index, array) => array.indexOf(dirPath) === index)
    .filter((dirPath) => existsSync(dirPath) && statSync(dirPath).isDirectory())
}

function getBlockedPackagedSkillIds(): string[] {
  return WUNDERKIND_CANONICAL_MANIFEST.skills
    .filter((skill) => skill.bucket !== "promoted" && skill.bucket !== "wunderkind-specific")
    .map((skill) => skill.id)
}

function getBlockedNativeSkillDirectories(): string[] {
  const dir = getNativeSkillsDir()
  return getBlockedPackagedSkillIds().map((id) => join(dir, id))
}

function removeBlockedNativeSkillDirectories(): boolean {
  let changed = false

  for (const skillDir of getBlockedNativeSkillDirectories()) {
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true })
      changed = true
    }
  }

  return changed
}

export function getNativeCommandFilePaths(): string[] {
  const dir = getNativeCommandsDir()
  const packagedPaths = getPackagedCommandFilePaths().map((source) => join(dir, basename(source)))
  const generatedPaths = getGeneratedRetainedNativeCommandNames().map((name) => join(dir, `${name}.md`))

  return [...packagedPaths, ...generatedPaths]
}

export function getNativeSkillDirectories(scope: InstallScope): string[] {
  void scope
  const dir = getNativeSkillsDir()
  return getPackagedSkillDirectories().map((source) => join(dir, basename(source)))
}

function getNativeAssetDir(kind: NativeAssetKind): string {
  if (kind === "agents") return getNativeAgentDir()
  if (kind === "commands") return getNativeCommandsDir()
  return getNativeSkillsDir()
}

function getNativeAssetVersionMarkerPath(kind: NativeAssetKind): string {
  return join(getNativeAssetDir(kind), NATIVE_ASSET_VERSION_MARKER_FILENAME)
}

function writeNativeAssetVersionMarker(targetDir: string, kind: NativeAssetKind): void {
  const payload = {
    package: PACKAGE_NAME,
    kind,
    version: getCanonicalPackageVersion(),
    writtenAt: new Date().toISOString(),
  }

  writeFileSync(join(targetDir, NATIVE_ASSET_VERSION_MARKER_FILENAME), `${JSON.stringify(payload, null, 2)}
`, "utf-8")
}

function readNativeAssetVersionMarker(markerPath: string): { version: string | null } {
  try {
    const parsed = JSON.parse(readFileSync(markerPath, "utf-8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { version: null }
    }

    const version = (parsed as Record<string, unknown>).version
    return { version: typeof version === "string" ? version : null }
  } catch {
    return { version: null }
  }
}

export function detectNativeAssetVersion(kind: NativeAssetKind): {
  kind: NativeAssetKind
  dir: string
  dirPresent: boolean
  markerPath: string
  markerPresent: boolean
  installedVersion: string | null
  currentVersion: string | null
  needsUpgrade: boolean
} {
  const dir = getNativeAssetDir(kind)
  const markerPath = getNativeAssetVersionMarkerPath(kind)
  const dirPresent = existsSync(dir)
  const markerPresent = existsSync(markerPath)
  const installedVersion = markerPresent ? readNativeAssetVersionMarker(markerPath).version : null
  const currentVersion = getCanonicalPackageVersion()
  const needsUpgrade =
    dirPresent &&
    currentVersion !== null &&
    (!markerPresent || installedVersion === null || compareVersions(installedVersion, currentVersion) !== 0)

  return {
    kind,
    dir,
    dirPresent,
    markerPath,
    markerPresent,
    installedVersion,
    currentVersion,
    needsUpgrade,
  }
}

export function detectNativeAgentMarkdownVersions(scope: InstallScope): {
  currentVersion: string | null
  agents: Array<{
    id: string
    filePath: string
    filePresent: boolean
    installedVersion: string | null
    matchesCurrent: boolean
  }>
  staleAgentIds: string[]
  missingVersionAgentIds: string[]
  allCurrent: boolean
} {
  void scope

  const currentVersion = getCanonicalPackageVersion()
  const agents = WUNDERKIND_AGENT_DEFINITIONS.map((definition) => {
    const filePath = join(getNativeAgentDir(), `${definition.id}.md`)
    const filePresent = existsSync(filePath)
    const installedVersion = filePresent ? readWunderkindAgentMarkdownVersion(filePath) : null
    const matchesCurrent = currentVersion !== null && installedVersion === currentVersion

    return {
      id: definition.id,
      filePath,
      filePresent,
      installedVersion,
      matchesCurrent,
    }
  })

  const staleAgents = agents.filter((agent) => agent.filePresent && !agent.matchesCurrent)

  return {
    currentVersion,
    agents,
    staleAgentIds: staleAgents.map((agent) => agent.id),
    missingVersionAgentIds: staleAgents.filter((agent) => agent.installedVersion === null).map((agent) => agent.id),
    allCurrent: staleAgents.length === 0,
  }
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
    writeNativeAssetVersionMarker(targetDir, "agents")
    return { success: true, configPath: targetDir }
  } catch (err) {
    return { success: false, configPath: targetDir, error: String(err) }
  }
}

export function writeNativeCommandFiles(): ConfigMergeResult {
  const targetDir = getNativeCommandsDir()
  const sourceFiles = getPackagedCommandFilePaths()
  const sourceRoot = fileURLToPath(new URL("../../../commands", import.meta.url))
  const generatedCommands = getGeneratedRetainedNativeCommands()
  const packagedCommandNames = getPackagedCommandNames()
  const generatedCommandNames = generatedCommands.map((command) => command.name)
  const activeFileNames = [
    ...packagedCommandNames.map((name) => `${name}.md`),
    ...generatedCommandNames.map((name) => `${name}.md`),
  ]

  try {
    assertNoNativeCommandNameCollisions(packagedCommandNames, generatedCommandNames)
    mkdirSync(targetDir, { recursive: true })
    removeStaleCommandFiles(targetDir, activeFileNames)
    copyFileSet(sourceFiles, sourceRoot, targetDir)

    for (const command of generatedCommands) {
      writeFileSync(
        join(targetDir, `${command.name}.md`),
        renderGeneratedRetainedNativeCommandMarkdown(command),
        "utf-8",
      )
    }

    writeNativeAssetVersionMarker(targetDir, "commands")
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
    removeBlockedNativeSkillDirectories()
    const sourceFiles = skillDirs.flatMap((skillDir) => collectFilesRecursively(skillDir))
    copyFileSet(sourceFiles, sourceRoot, targetDir)
    writeNativeAssetVersionMarker(targetDir, "skills")
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
  const totalCount = getNativeCommandFilePaths().length

  return { dir, presentCount, totalCount, allPresent: presentCount === totalCount }
}

export function detectNativeSkillFiles(scope: InstallScope): {
  dir: string
  presentCount: number
  totalCount: number
  allPresent: boolean
  staleBlockedCount: number
} {
  void scope
  const dir = getNativeSkillsDir()
  const presentCount = getNativeSkillDirectories(scope).filter((dirPath) => existsSync(dirPath)).length
  const totalCount = getPackagedSkillDirectories().length
  const staleBlockedCount = getBlockedNativeSkillDirectories().filter((dirPath) => existsSync(dirPath)).length

  return { dir, presentCount, totalCount, allPresent: presentCount === totalCount && staleBlockedCount === 0, staleBlockedCount }
}

export function removeNativeAgentFiles(scope: InstallScope): ConfigMergeResult {
  const filePaths = getNativeAgentFilePaths(scope)
  const targetDir = getNativeAgentDir()
  const markerPath = getNativeAssetVersionMarkerPath("agents")

  try {
    let changed = false
    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true })
        changed = true
      }
    }

    if (existsSync(markerPath)) {
      rmSync(markerPath, { force: true })
      changed = true
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
  const markerPath = getNativeAssetVersionMarkerPath("commands")

  try {
    let changed = false
    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true })
        changed = true
      }
    }

    if (existsSync(markerPath)) {
      rmSync(markerPath, { force: true })
      changed = true
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
  const markerPath = getNativeAssetVersionMarkerPath("skills")

  try {
    let changed = false
    for (const skillDir of skillDirs) {
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true })
        changed = true
      }
    }

    if (removeBlockedNativeSkillDirectories()) {
      changed = true
    }

    if (existsSync(markerPath)) {
      rmSync(markerPath, { force: true })
      changed = true
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
