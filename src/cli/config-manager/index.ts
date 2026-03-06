import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import type { ConfigMergeResult, DetectedConfig, InstallConfig } from "../types.js"

const PACKAGE_NAME = "wunderkind"
const CONFIG_DIR = join(homedir(), ".config", "opencode")
const CONFIG_JSON = join(CONFIG_DIR, "config.json")
const CONFIG_JSONC = join(CONFIG_DIR, "config.jsonc")
const WUNDERKIND_CONFIG = join(process.cwd(), "wunderkind.config.jsonc")

interface OpenCodeConfig {
  plugin?: string[]
  [key: string]: unknown
}

function getConfigPath(): { path: string; format: "json" | "jsonc" | "none" } {
  if (existsSync(CONFIG_JSONC)) return { path: CONFIG_JSONC, format: "jsonc" }
  if (existsSync(CONFIG_JSON)) return { path: CONFIG_JSON, format: "json" }
  return { path: CONFIG_JSON, format: "none" }
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
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
    region: "Global",
    industry: "",
    primaryRegulation: "GDPR",
    secondaryRegulation: "",
  }

  const { path, format } = getConfigPath()
  if (format === "none") return defaults

  const config = parseConfig(path)
  if (!config) return defaults

  const plugins = config.plugin ?? []
  const isInstalled = plugins.some((p) => p === PACKAGE_NAME || p.startsWith(`${PACKAGE_NAME}@`))
  if (!isInstalled) return defaults

  if (existsSync(WUNDERKIND_CONFIG)) {
    try {
      const wk = parseJsonc(readFileSync(WUNDERKIND_CONFIG, "utf-8")) as Record<string, unknown>
      return {
        isInstalled: true,
        region: typeof wk["REGION"] === "string" ? wk["REGION"] : defaults.region,
        industry: typeof wk["INDUSTRY"] === "string" ? wk["INDUSTRY"] : defaults.industry,
        primaryRegulation: typeof wk["PRIMARY_REGULATION"] === "string" ? wk["PRIMARY_REGULATION"] : defaults.primaryRegulation,
        secondaryRegulation: typeof wk["SECONDARY_REGULATION"] === "string" ? wk["SECONDARY_REGULATION"] : defaults.secondaryRegulation,
      }
    } catch {
      return { ...defaults, isInstalled: true }
    }
  }

  return { ...defaults, isInstalled: true }
}

export function addPluginToOpenCodeConfig(): ConfigMergeResult {
  try {
    ensureConfigDir()
  } catch (err) {
    return { success: false, configPath: CONFIG_DIR, error: String(err) }
  }

  const { path, format } = getConfigPath()

  try {
    if (format === "none") {
      const config: OpenCodeConfig = { plugin: [PACKAGE_NAME] }
      writeFileSync(path, JSON.stringify(config, null, 2) + "\n")
      return { success: true, configPath: path }
    }

    const config = parseConfig(path) ?? {}
    const plugins = (config.plugin ?? []) as string[]
    const existingIndex = plugins.findIndex((p) => p === PACKAGE_NAME || p.startsWith(`${PACKAGE_NAME}@`))

    if (existingIndex !== -1) {
      if (plugins[existingIndex] === PACKAGE_NAME) {
        return { success: true, configPath: path }
      }
      plugins[existingIndex] = PACKAGE_NAME
    } else {
      plugins.push(PACKAGE_NAME)
    }

    config.plugin = plugins

    if (format === "jsonc") {
      const content = readFileSync(path, "utf-8")
      const pluginArrayRegex = /"plugin"\s*:\s*\[([\s\S]*?)\]/
      const match = content.match(pluginArrayRegex)
      if (match) {
        const formatted = plugins.map((p) => `"${p}"`).join(",\n    ")
        const newContent = content.replace(pluginArrayRegex, `"plugin": [\n    ${formatted}\n  ]`)
        writeFileSync(path, newContent)
      } else {
        const newContent = content.replace(/(\{)/, `$1\n  "plugin": ["${PACKAGE_NAME}"],`)
        writeFileSync(path, newContent)
      }
    } else {
      writeFileSync(path, JSON.stringify(config, null, 2) + "\n")
    }

    return { success: true, configPath: path }
  } catch (err) {
    return { success: false, configPath: path, error: String(err) }
  }
}

export function writeWunderkindConfig(installConfig: InstallConfig): ConfigMergeResult {
  const configPath = WUNDERKIND_CONFIG

  try {
    const content = [
      `// Wunderkind configuration — edit these values to tailor agents to your project context`,
      `{`,
      `  // Geographic region — e.g. "South Africa", "United States", "United Kingdom", "Australia"`,
      `  "REGION": ${JSON.stringify(installConfig.region)},`,
      `  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"`,
      `  "INDUSTRY": ${JSON.stringify(installConfig.industry)},`,
      `  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"`,
      `  "PRIMARY_REGULATION": ${JSON.stringify(installConfig.primaryRegulation)},`,
      `  // Optional secondary regulation`,
      `  "SECONDARY_REGULATION": ${JSON.stringify(installConfig.secondaryRegulation)}`,
      `}`,
      ``,
    ].join("\n")

    writeFileSync(configPath, content)
    return { success: true, configPath }
  } catch (err) {
    return { success: false, configPath, error: String(err) }
  }
}
