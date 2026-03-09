import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import type {
  BrandPersonality,
  CisoPersonality,
  CmoPersonality,
  ConfigMergeResult,
  CreativePersonality,
  CtoPersonality,
  DataAnalystPersonality,
  DetectedConfig,
  DevrelPersonality,
  InstallConfig,
  InstallScope,
  LegalPersonality,
  OpsPersonality,
  OrgStructure,
  ProductPersonality,
  QaPersonality,
  SupportPersonality,
  TeamCulture,
} from "../types.js"

const PACKAGE_NAME = "@grant-vine/wunderkind"
const CONFIG_DIR = join(homedir(), ".config", "opencode")
const CONFIG_JSON = join(CONFIG_DIR, "opencode.json")
const CONFIG_JSONC = join(CONFIG_DIR, "opencode.jsonc")
const LEGACY_CONFIG_JSON = join(CONFIG_DIR, "config.json")
const LEGACY_CONFIG_JSONC = join(CONFIG_DIR, "config.jsonc")
const GLOBAL_WUNDERKIND_DIR = join(homedir(), ".wunderkind")
const GLOBAL_WUNDERKIND_CONFIG = join(GLOBAL_WUNDERKIND_DIR, "wunderkind.config.jsonc")
const WUNDERKIND_DIR = join(process.cwd(), ".wunderkind")
const WUNDERKIND_CONFIG = join(WUNDERKIND_DIR, "wunderkind.config.jsonc")
const LEGACY_WUNDERKIND_CONFIG = join(process.cwd(), "wunderkind.config.jsonc")

interface OpenCodeConfig {
  plugin?: string[]
  [key: string]: unknown
}

function getConfigPath(): { path: string; format: "json" | "jsonc" | "none" } {
  if (existsSync(CONFIG_JSON)) return { path: CONFIG_JSON, format: "json" }
  if (existsSync(CONFIG_JSONC)) return { path: CONFIG_JSONC, format: "jsonc" }
  if (existsSync(LEGACY_CONFIG_JSON)) return { path: LEGACY_CONFIG_JSON, format: "json" }
  if (existsSync(LEGACY_CONFIG_JSONC)) return { path: LEGACY_CONFIG_JSONC, format: "jsonc" }
  return { path: CONFIG_JSON, format: "none" }
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

export function detectCurrentConfig(): DetectedConfig {
  const defaults: DetectedConfig = {
    isInstalled: false,
    scope: "global" as InstallScope,
    region: "Global",
    industry: "",
    primaryRegulation: "GDPR",
    secondaryRegulation: "",
    teamCulture: "pragmatic-balanced" as TeamCulture,
    orgStructure: "flat" as OrgStructure,
    cisoPersonality: "pragmatic-risk-manager" as CisoPersonality,
    ctoPersonality: "code-archaeologist" as CtoPersonality,
    cmoPersonality: "data-driven" as CmoPersonality,
    qaPersonality: "risk-based-pragmatist" as QaPersonality,
    productPersonality: "outcome-obsessed" as ProductPersonality,
    opsPersonality: "on-call-veteran" as OpsPersonality,
    creativePersonality: "pragmatic-problem-solver" as CreativePersonality,
    brandPersonality: "authentic-builder" as BrandPersonality,
    devrelPersonality: "dx-engineer" as DevrelPersonality,
    legalPersonality: "pragmatic-advisor" as LegalPersonality,
    supportPersonality: "systematic-triage" as SupportPersonality,
    dataAnalystPersonality: "insight-storyteller" as DataAnalystPersonality,
  }

  const { path, format } = getConfigPath()
  if (format === "none") return defaults

  const config = parseConfig(path)
  if (!config) return defaults

  const plugins = config.plugin ?? []
  const isInstalled = plugins.some(
    (p) => p === PACKAGE_NAME || p === "wunderkind" || p.startsWith(`${PACKAGE_NAME}@`) || p.startsWith("wunderkind@"),
  )
  if (!isInstalled) return defaults

  const wkConfigPath = existsSync(WUNDERKIND_CONFIG)
    ? WUNDERKIND_CONFIG
    : existsSync(GLOBAL_WUNDERKIND_CONFIG)
      ? GLOBAL_WUNDERKIND_CONFIG
      : null

  if (wkConfigPath !== null) {
    try {
      const wk = parseJsonc(readFileSync(wkConfigPath, "utf-8")) as Record<string, unknown>
      return {
        isInstalled: true,
        scope: "global" as InstallScope,
        region: typeof wk["region"] === "string" ? wk["region"] : defaults.region,
        industry: typeof wk["industry"] === "string" ? wk["industry"] : defaults.industry,
        primaryRegulation: typeof wk["primaryRegulation"] === "string" ? wk["primaryRegulation"] : defaults.primaryRegulation,
        secondaryRegulation: typeof wk["secondaryRegulation"] === "string" ? wk["secondaryRegulation"] : defaults.secondaryRegulation,
        teamCulture: typeof wk["teamCulture"] === "string" ? (wk["teamCulture"] as TeamCulture) : defaults.teamCulture,
        orgStructure: typeof wk["orgStructure"] === "string" ? (wk["orgStructure"] as OrgStructure) : defaults.orgStructure,
        cisoPersonality: typeof wk["cisoPersonality"] === "string" ? (wk["cisoPersonality"] as CisoPersonality) : defaults.cisoPersonality,
        ctoPersonality: typeof wk["ctoPersonality"] === "string" ? (wk["ctoPersonality"] as CtoPersonality) : defaults.ctoPersonality,
        cmoPersonality: typeof wk["cmoPersonality"] === "string" ? (wk["cmoPersonality"] as CmoPersonality) : defaults.cmoPersonality,
        qaPersonality: typeof wk["qaPersonality"] === "string" ? (wk["qaPersonality"] as QaPersonality) : defaults.qaPersonality,
        productPersonality: typeof wk["productPersonality"] === "string" ? (wk["productPersonality"] as ProductPersonality) : defaults.productPersonality,
        opsPersonality: typeof wk["opsPersonality"] === "string" ? (wk["opsPersonality"] as OpsPersonality) : defaults.opsPersonality,
        creativePersonality: typeof wk["creativePersonality"] === "string" ? (wk["creativePersonality"] as CreativePersonality) : defaults.creativePersonality,
        brandPersonality: typeof wk["brandPersonality"] === "string" ? (wk["brandPersonality"] as BrandPersonality) : defaults.brandPersonality,
        devrelPersonality: typeof wk["devrelPersonality"] === "string" ? (wk["devrelPersonality"] as DevrelPersonality) : defaults.devrelPersonality,
        legalPersonality: typeof wk["legalPersonality"] === "string" ? (wk["legalPersonality"] as LegalPersonality) : defaults.legalPersonality,
        supportPersonality: typeof wk["supportPersonality"] === "string" ? (wk["supportPersonality"] as SupportPersonality) : defaults.supportPersonality,
        dataAnalystPersonality: typeof wk["dataAnalystPersonality"] === "string" ? (wk["dataAnalystPersonality"] as DataAnalystPersonality) : defaults.dataAnalystPersonality,
      }
    } catch {
      return { ...defaults, isInstalled: true, scope: "global" as InstallScope }
    }
  }

  return { ...defaults, isInstalled: true, scope: "global" as InstallScope }
}

export function addPluginToOpenCodeConfig(scope: InstallScope): ConfigMergeResult {
  const targetPath = scope === "project" ? join(process.cwd(), "opencode.json") : CONFIG_JSON
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
    const already = plugins.some(
      (p) => p === PACKAGE_NAME || p === "wunderkind" || p.startsWith(`${PACKAGE_NAME}@`) || p.startsWith("wunderkind@"),
    )

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
  const configPath = scope === "global" ? GLOBAL_WUNDERKIND_CONFIG : WUNDERKIND_CONFIG
  const configDir = scope === "global" ? GLOBAL_WUNDERKIND_DIR : WUNDERKIND_DIR

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
  } catch (err) {
    return { success: false, configPath, error: String(err) }
  }

  try {
    const content = [
      `// Wunderkind configuration — edit these values to tailor agents to your project context`,
      `{`,
      `  // Geographic region — e.g. "South Africa", "United States", "United Kingdom", "Australia"`,
      `  "region": ${JSON.stringify(installConfig.region)},`,
      `  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"`,
      `  "industry": ${JSON.stringify(installConfig.industry)},`,
      `  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"`,
      `  "primaryRegulation": ${JSON.stringify(installConfig.primaryRegulation)},`,
      `  // Optional secondary regulation`,
      `  "secondaryRegulation": ${JSON.stringify(installConfig.secondaryRegulation)},`,
      ``,
      `  // Team culture baseline — affects all agents' communication style and decision rigour`,
      `  // "formal-strict" | "pragmatic-balanced" | "experimental-informal"`,
      `  "teamCulture": ${JSON.stringify(installConfig.teamCulture)},`,
      `  // Org structure — "flat" (peers, escalate to user) | "hierarchical" (domain authority applies, CISO has hard veto)`,
      `  "orgStructure": ${JSON.stringify(installConfig.orgStructure)},`,
      ``,
      `  // Agent personalities — controls each agent's default character archetype`,
      `  // CISO: "paranoid-enforcer" | "pragmatic-risk-manager" | "educator-collaborator"`,
      `  "cisoPersonality": ${JSON.stringify(installConfig.cisoPersonality)},`,
      `  // CTO/Fullstack: "grizzled-sysadmin" | "startup-bro" | "code-archaeologist"`,
      `  "ctoPersonality": ${JSON.stringify(installConfig.ctoPersonality)},`,
      `  // CMO/Marketing: "data-driven" | "brand-storyteller" | "growth-hacker"`,
      `  "cmoPersonality": ${JSON.stringify(installConfig.cmoPersonality)},`,
      `  // QA: "rule-enforcer" | "risk-based-pragmatist" | "rubber-duck"`,
      `  "qaPersonality": ${JSON.stringify(installConfig.qaPersonality)},`,
      `  // Product: "user-advocate" | "velocity-optimizer" | "outcome-obsessed"`,
      `  "productPersonality": ${JSON.stringify(installConfig.productPersonality)},`,
      `  // Operations: "on-call-veteran" | "efficiency-maximiser" | "process-purist"`,
      `  "opsPersonality": ${JSON.stringify(installConfig.opsPersonality)},`,
      `  // Creative Director: "perfectionist-craftsperson" | "bold-provocateur" | "pragmatic-problem-solver"`,
      `  "creativePersonality": ${JSON.stringify(installConfig.creativePersonality)},`,
      `  // Brand Builder: "community-evangelist" | "pr-spinner" | "authentic-builder"`,
      `  "brandPersonality": ${JSON.stringify(installConfig.brandPersonality)},`,
      `  // DevRel Wunderkind: "community-champion" | "docs-perfectionist" | "dx-engineer"`,
      `  "devrelPersonality": ${JSON.stringify(installConfig.devrelPersonality)},`,
      `  // Legal Counsel: "cautious-gatekeeper" | "pragmatic-advisor" | "plain-english-counselor"`,
      `  "legalPersonality": ${JSON.stringify(installConfig.legalPersonality)},`,
      `  // Support Engineer: "empathetic-resolver" | "systematic-triage" | "knowledge-builder"`,
      `  "supportPersonality": ${JSON.stringify(installConfig.supportPersonality)},`,
      `  // Data Analyst: "rigorous-statistician" | "insight-storyteller" | "pragmatic-quant"`,
      `  "dataAnalystPersonality": ${JSON.stringify(installConfig.dataAnalystPersonality)}`,
      `}`,
      ``,
    ].join("\n")

    writeFileSync(configPath, content)
    return { success: true, configPath }
  } catch (err) {
    return { success: false, configPath, error: String(err) }
  }
}

export function detectLegacyConfig(): boolean {
  return existsSync(LEGACY_WUNDERKIND_CONFIG)
}
