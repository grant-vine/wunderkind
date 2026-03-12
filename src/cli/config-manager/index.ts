import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, relative } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import { fileURLToPath } from "node:url"
import { WUNDERKIND_AGENT_IDS, WUNDERKIND_AGENT_DEFINITIONS } from "../../agents/manifest.js"
import { renderNativeAgentMarkdown } from "../../agents/render-markdown.js"
import type {
  BrandPersonality,
  CisoPersonality,
  CmoPersonality,
  ConfigMergeResult,
  CreativePersonality,
  CtoPersonality,
  DataAnalystPersonality,
  DetectedConfig,
  DocHistoryMode,
  DevrelPersonality,
  GlobalConfig,
  InstallConfig,
  InstallRegistrationScope,
  InstallScope,
  LegalPersonality,
  OpsPersonality,
  OrgStructure,
  PluginVersionInfo,
  ProjectConfig,
  ProductPersonality,
  QaPersonality,
  SupportPersonality,
  TeamCulture,
} from "../types.js"

const PACKAGE_NAME = "@grant-vine/wunderkind"
const WUNDERKIND_SCHEMA_URL = "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"
const CONFIG_DIR = join(homedir(), ".config", "opencode")
const CONFIG_JSON = join(CONFIG_DIR, "opencode.json")
const CONFIG_JSONC = join(CONFIG_DIR, "opencode.jsonc")
const LEGACY_CONFIG_JSON = join(CONFIG_DIR, "config.json")
const LEGACY_CONFIG_JSONC = join(CONFIG_DIR, "config.jsonc")
const GLOBAL_WUNDERKIND_DIR = join(homedir(), ".wunderkind")
const GLOBAL_WUNDERKIND_CONFIG = join(GLOBAL_WUNDERKIND_DIR, "wunderkind.config.jsonc")
const GLOBAL_OPENCODE_AGENTS_DIR = join(CONFIG_DIR, "agents")
const GLOBAL_OPENCODE_COMMANDS_DIR = join(CONFIG_DIR, "commands")
const GLOBAL_OPENCODE_SKILLS_DIR = join(CONFIG_DIR, "skills")
const GLOBAL_OPENCODE_NODE_MODULES = join(CONFIG_DIR, "node_modules")
const GLOBAL_CACHE_DIR = join(homedir(), ".cache", "opencode")
const WUNDERKIND_DIR = join(process.cwd(), ".wunderkind")
const WUNDERKIND_CONFIG = join(WUNDERKIND_DIR, "wunderkind.config.jsonc")
const LEGACY_WUNDERKIND_CONFIG = join(process.cwd(), "wunderkind.config.jsonc")
const OMO_PACKAGE_NAME = "oh-my-opencode"

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
  "qaPersonality",
  "productPersonality",
  "opsPersonality",
  "creativePersonality",
  "brandPersonality",
  "devrelPersonality",
  "legalPersonality",
  "supportPersonality",
  "dataAnalystPersonality",
  "docsEnabled",
  "docsPath",
  "docHistoryMode",
] as const

type ProjectConfigKey = (typeof PROJECT_CONFIG_KEYS)[number]

const DEFAULT_INSTALL_CONFIG: InstallConfig = {
  region: "Global",
  industry: "",
  primaryRegulation: "GDPR",
  secondaryRegulation: "",
  teamCulture: "pragmatic-balanced",
  orgStructure: "flat",
  cisoPersonality: "pragmatic-risk-manager",
  ctoPersonality: "code-archaeologist",
  cmoPersonality: "data-driven",
  qaPersonality: "risk-based-pragmatist",
  productPersonality: "outcome-obsessed",
  opsPersonality: "on-call-veteran",
  creativePersonality: "pragmatic-problem-solver",
  brandPersonality: "authentic-builder",
  devrelPersonality: "dx-engineer",
  legalPersonality: "pragmatic-advisor",
  supportPersonality: "systematic-triage",
  dataAnalystPersonality: "insight-storyteller",
  docsEnabled: false,
  docsPath: "./docs",
  docHistoryMode: "overwrite",
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
  qaPersonality: DEFAULT_INSTALL_CONFIG.qaPersonality,
  productPersonality: DEFAULT_INSTALL_CONFIG.productPersonality,
  opsPersonality: DEFAULT_INSTALL_CONFIG.opsPersonality,
  creativePersonality: DEFAULT_INSTALL_CONFIG.creativePersonality,
  brandPersonality: DEFAULT_INSTALL_CONFIG.brandPersonality,
  devrelPersonality: DEFAULT_INSTALL_CONFIG.devrelPersonality,
  legalPersonality: DEFAULT_INSTALL_CONFIG.legalPersonality,
  supportPersonality: DEFAULT_INSTALL_CONFIG.supportPersonality,
  dataAnalystPersonality: DEFAULT_INSTALL_CONFIG.dataAnalystPersonality,
  docsEnabled: DEFAULT_INSTALL_CONFIG.docsEnabled,
  docsPath: DEFAULT_INSTALL_CONFIG.docsPath,
  docHistoryMode: DEFAULT_INSTALL_CONFIG.docHistoryMode,
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
  if (scope === "project") {
    const projectJson = join(process.cwd(), "opencode.json")
    const projectJsonc = join(process.cwd(), "opencode.jsonc")
    const projectLegacyJson = join(process.cwd(), "config.json")
    const projectLegacyJsonc = join(process.cwd(), "config.jsonc")

    if (existsSync(projectJson)) return { path: projectJson, format: "json", source: "opencode.json" }
    if (existsSync(projectJsonc)) return { path: projectJsonc, format: "jsonc", source: "opencode.jsonc" }
    if (existsSync(projectLegacyJson)) return { path: projectLegacyJson, format: "json", source: "config.json" }
    if (existsSync(projectLegacyJsonc)) return { path: projectLegacyJsonc, format: "jsonc", source: "config.jsonc" }
    return { path: projectJson, format: "none", source: "default" }
  }

  if (existsSync(CONFIG_JSON)) return { path: CONFIG_JSON, format: "json", source: "opencode.json" }
  if (existsSync(CONFIG_JSONC)) return { path: CONFIG_JSONC, format: "jsonc", source: "opencode.jsonc" }
  if (existsSync(LEGACY_CONFIG_JSON)) return { path: LEGACY_CONFIG_JSON, format: "json", source: "config.json" }
  if (existsSync(LEGACY_CONFIG_JSONC)) return { path: LEGACY_CONFIG_JSONC, format: "jsonc", source: "config.jsonc" }
  return { path: CONFIG_JSON, format: "none", source: "default" }
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
  const candidates = [
    join(GLOBAL_OPENCODE_NODE_MODULES, packageName, "package.json"),
    join(GLOBAL_CACHE_DIR, "node_modules", packageName, "package.json"),
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
  }
}

export function detectWunderkindVersionInfo(): PluginVersionInfo {
  return detectPluginVersionInfo(PACKAGE_NAME)
}

export function detectOmoVersionInfo(): PluginVersionInfo {
  return detectPluginVersionInfo(OMO_PACKAGE_NAME)
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

function coerceProjectConfig(source: Record<string, unknown>): Partial<ProjectConfig> {
  const result: Partial<ProjectConfig> = {}

  if (typeof source["teamCulture"] === "string") result.teamCulture = source["teamCulture"] as TeamCulture
  if (typeof source["orgStructure"] === "string") result.orgStructure = source["orgStructure"] as OrgStructure
  if (typeof source["cisoPersonality"] === "string") result.cisoPersonality = source["cisoPersonality"] as CisoPersonality
  if (typeof source["ctoPersonality"] === "string") result.ctoPersonality = source["ctoPersonality"] as CtoPersonality
  if (typeof source["cmoPersonality"] === "string") result.cmoPersonality = source["cmoPersonality"] as CmoPersonality
  if (typeof source["qaPersonality"] === "string") result.qaPersonality = source["qaPersonality"] as QaPersonality
  if (typeof source["productPersonality"] === "string") {
    result.productPersonality = source["productPersonality"] as ProductPersonality
  }
  if (typeof source["opsPersonality"] === "string") result.opsPersonality = source["opsPersonality"] as OpsPersonality
  if (typeof source["creativePersonality"] === "string") {
    result.creativePersonality = source["creativePersonality"] as CreativePersonality
  }
  if (typeof source["brandPersonality"] === "string") result.brandPersonality = source["brandPersonality"] as BrandPersonality
  if (typeof source["devrelPersonality"] === "string") result.devrelPersonality = source["devrelPersonality"] as DevrelPersonality
  if (typeof source["legalPersonality"] === "string") result.legalPersonality = source["legalPersonality"] as LegalPersonality
  if (typeof source["supportPersonality"] === "string") {
    result.supportPersonality = source["supportPersonality"] as SupportPersonality
  }
  if (typeof source["dataAnalystPersonality"] === "string") {
    result.dataAnalystPersonality = source["dataAnalystPersonality"] as DataAnalystPersonality
  }
  if (typeof source["docsEnabled"] === "boolean") result.docsEnabled = source["docsEnabled"]
  if (typeof source["docsPath"] === "string") result.docsPath = source["docsPath"]
  if (typeof source["docHistoryMode"] === "string") result.docHistoryMode = source["docHistoryMode"] as DocHistoryMode

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
  const projectConfig = existsSync(WUNDERKIND_CONFIG) ? parseWunderkindConfig(WUNDERKIND_CONFIG) : null
  const globalConfig = existsSync(GLOBAL_WUNDERKIND_CONFIG) ? parseWunderkindConfig(GLOBAL_WUNDERKIND_CONFIG) : null

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
  const globalConfig = existsSync(GLOBAL_WUNDERKIND_CONFIG) ? parseWunderkindConfig(GLOBAL_WUNDERKIND_CONFIG) : null
  return globalConfig ? coerceGlobalConfig(globalConfig) : null
}

export function readProjectWunderkindConfig(): Partial<ProjectConfig> | null {
  const projectConfig = existsSync(WUNDERKIND_CONFIG) ? parseWunderkindConfig(WUNDERKIND_CONFIG) : null
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
    `  "cisoPersonality": ${JSON.stringify(config.cisoPersonality)},`,
    `  // CTO/Fullstack: "grizzled-sysadmin" | "startup-bro" | "code-archaeologist"`,
    `  "ctoPersonality": ${JSON.stringify(config.ctoPersonality)},`,
    `  // CMO/Marketing: "data-driven" | "brand-storyteller" | "growth-hacker"`,
    `  "cmoPersonality": ${JSON.stringify(config.cmoPersonality)},`,
    `  // QA: "rule-enforcer" | "risk-based-pragmatist" | "rubber-duck"`,
    `  "qaPersonality": ${JSON.stringify(config.qaPersonality)},`,
    `  // Product: "user-advocate" | "velocity-optimizer" | "outcome-obsessed"`,
    `  "productPersonality": ${JSON.stringify(config.productPersonality)},`,
    `  // Operations: "on-call-veteran" | "efficiency-maximiser" | "process-purist"`,
    `  "opsPersonality": ${JSON.stringify(config.opsPersonality)},`,
    `  // Creative Director: "perfectionist-craftsperson" | "bold-provocateur" | "pragmatic-problem-solver"`,
    `  "creativePersonality": ${JSON.stringify(config.creativePersonality)},`,
    `  // Brand Builder: "community-evangelist" | "pr-spinner" | "authentic-builder"`,
    `  "brandPersonality": ${JSON.stringify(config.brandPersonality)},`,
    `  // DevRel Wunderkind: "community-champion" | "docs-perfectionist" | "dx-engineer"`,
    `  "devrelPersonality": ${JSON.stringify(config.devrelPersonality)},`,
    `  // Legal Counsel: "cautious-gatekeeper" | "pragmatic-advisor" | "plain-english-counselor"`,
    `  "legalPersonality": ${JSON.stringify(config.legalPersonality)},`,
    `  // Support Engineer: "empathetic-resolver" | "systematic-triage" | "knowledge-builder"`,
    `  "supportPersonality": ${JSON.stringify(config.supportPersonality)},`,
    `  // Data Analyst: "rigorous-statistician" | "insight-storyteller" | "pragmatic-quant"`,
    `  "dataAnalystPersonality": ${JSON.stringify(config.dataAnalystPersonality)},`,
    ``,
    `  // Docs output settings`,
    `  // Enable or disable writing docs outputs to disk`,
    `  "docsEnabled": ${JSON.stringify(config.docsEnabled)},`,
    `  // Directory path where docs outputs are written`,
    `  "docsPath": ${JSON.stringify(config.docsPath)},`,
    `  // History mode: "overwrite" | "append-dated" | "new-dated-file" | "overwrite-archive"`,
    `  "docHistoryMode": ${JSON.stringify(config.docHistoryMode)}`,
    `}`,
    ``,
  )

  return lines.join("\n")
}

export function writeGlobalWunderkindConfig(config: GlobalConfig): ConfigMergeResult {
  const setupError = ensureConfigDir(GLOBAL_WUNDERKIND_DIR, GLOBAL_WUNDERKIND_CONFIG)
  if (setupError) return setupError

  try {
    writeFileSync(GLOBAL_WUNDERKIND_CONFIG, renderGlobalWunderkindConfig(config))
    return { success: true, configPath: GLOBAL_WUNDERKIND_CONFIG }
  } catch (err) {
    return { success: false, configPath: GLOBAL_WUNDERKIND_CONFIG, error: String(err) }
  }
}

export function writeProjectWunderkindConfig(config: ProjectConfig & Partial<GlobalConfig>): ConfigMergeResult {
  const setupError = ensureConfigDir(WUNDERKIND_DIR, WUNDERKIND_CONFIG)
  if (setupError) return setupError

  try {
    const baseline = {
      ...DEFAULT_GLOBAL_CONFIG,
      ...(readGlobalWunderkindConfig() ?? {}),
    }
    writeFileSync(WUNDERKIND_CONFIG, renderProjectWunderkindConfig(config, baseline))
    return { success: true, configPath: WUNDERKIND_CONFIG }
  } catch (err) {
    return { success: false, configPath: WUNDERKIND_CONFIG, error: String(err) }
  }
}

export function readWunderkindConfigForScope(scope: InstallScope): Partial<InstallConfig> | null {
  if (scope === "global") {
    return readGlobalWunderkindConfig()
  }

  const projectConfig = existsSync(WUNDERKIND_CONFIG) ? parseWunderkindConfig(WUNDERKIND_CONFIG) : null
  if (!projectConfig) return null

  return {
    ...coerceGlobalConfig(projectConfig),
    ...coerceProjectConfig(projectConfig),
  }
}

export function detectCurrentConfig(): DetectedConfig {
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
  }

  const registration = detectRegistration()
  if (registration.registrationScope === "none") {
    return {
      ...detectedDefaults,
      ...registration,
    }
  }

  const globalConfig = existsSync(GLOBAL_WUNDERKIND_CONFIG) ? parseWunderkindConfig(GLOBAL_WUNDERKIND_CONFIG) : null
  const legacyGlobalProjectFields = globalConfig ? listLegacyGlobalProjectFields(globalConfig) : []
  const globalSafe = readGlobalWunderkindConfig()
  const projectConfig = existsSync(WUNDERKIND_CONFIG) ? parseWunderkindConfig(WUNDERKIND_CONFIG) : null
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
    qaPersonality: projectLocal?.qaPersonality ?? legacyGlobalProject.qaPersonality ?? defaults.qaPersonality,
    productPersonality: projectLocal?.productPersonality ?? legacyGlobalProject.productPersonality ?? defaults.productPersonality,
    opsPersonality: projectLocal?.opsPersonality ?? legacyGlobalProject.opsPersonality ?? defaults.opsPersonality,
    creativePersonality: projectLocal?.creativePersonality ?? legacyGlobalProject.creativePersonality ?? defaults.creativePersonality,
    brandPersonality: projectLocal?.brandPersonality ?? legacyGlobalProject.brandPersonality ?? defaults.brandPersonality,
    devrelPersonality: projectLocal?.devrelPersonality ?? legacyGlobalProject.devrelPersonality ?? defaults.devrelPersonality,
    legalPersonality: projectLocal?.legalPersonality ?? legacyGlobalProject.legalPersonality ?? defaults.legalPersonality,
    supportPersonality: projectLocal?.supportPersonality ?? legacyGlobalProject.supportPersonality ?? defaults.supportPersonality,
    dataAnalystPersonality: projectLocal?.dataAnalystPersonality ?? legacyGlobalProject.dataAnalystPersonality ?? defaults.dataAnalystPersonality,
    docsEnabled: projectLocal?.docsEnabled ?? legacyGlobalProject.docsEnabled ?? defaults.docsEnabled,
    docsPath: projectLocal?.docsPath ?? legacyGlobalProject.docsPath ?? defaults.docsPath,
    docHistoryMode: projectLocal?.docHistoryMode ?? legacyGlobalProject.docHistoryMode ?? defaults.docHistoryMode,
  }
}

export function addPluginToOpenCodeConfig(scope: InstallScope): ConfigMergeResult {
  const targetPath = resolveOpenCodeConfigPath(scope).path
  const targetDir = scope === "project" ? process.cwd() : CONFIG_DIR

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

  return writeProjectWunderkindConfig(installConfig)
}

export function detectLegacyConfig(): boolean {
  return existsSync(LEGACY_WUNDERKIND_CONFIG)
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
  return GLOBAL_OPENCODE_AGENTS_DIR
}

export function getNativeCommandsDir(): string {
  return GLOBAL_OPENCODE_COMMANDS_DIR
}

export function getNativeSkillsDir(): string {
  return GLOBAL_OPENCODE_SKILLS_DIR
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
  try {
    if (!existsSync(GLOBAL_WUNDERKIND_CONFIG)) {
      return { success: true, configPath: GLOBAL_WUNDERKIND_CONFIG, changed: false }
    }
    rmSync(GLOBAL_WUNDERKIND_CONFIG, { force: true })

    if (existsSync(GLOBAL_WUNDERKIND_DIR) && readdirSync(GLOBAL_WUNDERKIND_DIR).length === 0) {
      rmSync(GLOBAL_WUNDERKIND_DIR, { recursive: false, force: true })
    }

    return { success: true, configPath: GLOBAL_WUNDERKIND_CONFIG, changed: true }
  } catch (err) {
    return { success: false, configPath: GLOBAL_WUNDERKIND_CONFIG, error: String(err) }
  }
}
