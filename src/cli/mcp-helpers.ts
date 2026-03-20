import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import { resolveOpenCodeConfigPath } from "./config-manager/index.js"
import { GOOGLE_STITCH_ADAPTER } from "./mcp-adapters.js"

export type StitchPresence = "missing" | "project-local" | "global-only" | "both"

interface OpenCodeConfig {
  $schema?: string
  mcp?: Record<string, unknown>
  [key: string]: unknown
}

const OPENCODE_SCHEMA_URL = "https://opencode.ai/config.json"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function trimOneTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function resolveProjectOpenCodeConfigPath(projectPath: string): string {
  const projectJson = join(projectPath, "opencode.json")
  const projectJsonc = join(projectPath, "opencode.jsonc")
  const projectLegacyJson = join(projectPath, "config.json")
  const projectLegacyJsonc = join(projectPath, "config.jsonc")

  if (existsSync(projectJson)) return projectJson
  if (existsSync(projectJsonc)) return projectJsonc
  if (existsSync(projectLegacyJson)) return projectLegacyJson
  if (existsSync(projectLegacyJsonc)) return projectLegacyJsonc
  return projectJson
}

function parseOpenCodeConfig(filePath: string): OpenCodeConfig | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    if (!content.trim()) return null

    const parsed = parseJsonc(content) as unknown
    if (!isRecord(parsed)) return null

    return parsed as OpenCodeConfig
  } catch {
    return null
  }
}

function getMcpEntries(config: OpenCodeConfig | null): Record<string, unknown> {
  if (!config || !isRecord(config.mcp)) {
    return {}
  }

  return config.mcp
}

function hasStitchConfig(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false
  }

  const config = parseOpenCodeConfig(filePath)
  const mcpEntries = getMcpEntries(config)

  if (Object.prototype.hasOwnProperty.call(mcpEntries, GOOGLE_STITCH_ADAPTER.serverName)) {
    return true
  }

  for (const value of Object.values(mcpEntries)) {
    if (!isRecord(value)) {
      continue
    }

    if (typeof value.url !== "string") {
      continue
    }

    if (trimOneTrailingSlash(value.url) === trimOneTrailingSlash(GOOGLE_STITCH_ADAPTER.remoteUrl)) {
      return true
    }
  }

  return false
}

function isDriftedStitchConfig(value: unknown): boolean {
  if (!isRecord(value)) {
    return true
  }

  if (typeof value.url !== "string") {
    return true
  }

  if (trimOneTrailingSlash(value.url) !== trimOneTrailingSlash(GOOGLE_STITCH_ADAPTER.remoteUrl)) {
    return true
  }

  return value.oauth === true
}

export async function detectStitchMcpPresence(projectPath?: string): Promise<StitchPresence> {
  const globalConfigPath = resolveOpenCodeConfigPath("global").path
  const projectConfigPath = projectPath === undefined
    ? resolveOpenCodeConfigPath("project").path
    : resolveProjectOpenCodeConfigPath(projectPath)

  const hasGlobal = hasStitchConfig(globalConfigPath)
  const hasProject = hasStitchConfig(projectConfigPath)

  if (hasGlobal && hasProject) return "both"
  if (hasProject) return "project-local"
  if (hasGlobal) return "global-only"
  return "missing"
}

export async function mergeStitchMcpConfig(projectPath: string): Promise<void> {
  const targetPath = resolveProjectOpenCodeConfigPath(projectPath)
  const targetDir = dirname(targetPath)

  mkdirSync(targetDir, { recursive: true })

  const existingConfig = parseOpenCodeConfig(targetPath) ?? {}
  const nextConfig: OpenCodeConfig = { ...existingConfig }

  if (nextConfig.$schema === undefined) {
    nextConfig.$schema = OPENCODE_SCHEMA_URL
  }

  const existingMcpEntries = getMcpEntries(existingConfig)
  const nextMcpEntries: Record<string, unknown> = { ...existingMcpEntries }
  const existingStitchEntry = existingMcpEntries[GOOGLE_STITCH_ADAPTER.serverName]

  if (existingStitchEntry === undefined || isDriftedStitchConfig(existingStitchEntry)) {
    nextMcpEntries[GOOGLE_STITCH_ADAPTER.serverName] = GOOGLE_STITCH_ADAPTER.getOpenCodePayload(false)
  }

  nextConfig.mcp = nextMcpEntries

  writeFileSync(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`)
}

export async function writeStitchSecretFile(apiKey: string, cwd: string): Promise<void> {
  const secretFilePath = join(cwd, GOOGLE_STITCH_ADAPTER.secretFilePath)
  mkdirSync(dirname(secretFilePath), { recursive: true })
  writeFileSync(secretFilePath, apiKey.trim())
}
