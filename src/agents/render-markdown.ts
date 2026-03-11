import type { AgentConfig } from "@opencode-ai/sdk"
import type { WunderkindAgentDefinition } from "./manifest.js"

function renderMultilineScalar(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").trim()
  return normalized
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")
}

function renderPermissionBlock(permission: AgentConfig["permission"]): string[] {
  if (!permission || typeof permission !== "object" || Array.isArray(permission)) {
    return []
  }

  const entries = Object.entries(permission)
  if (entries.length === 0) return []

  return [
    "permission:",
    ...entries.map(([key, value]) => `  ${key}: ${String(value)}`),
  ]
}

export function renderNativeAgentMarkdown(definition: WunderkindAgentDefinition): string {
  const config = definition.factory("")
  const frontmatter = [
    "---",
    "description: >",
    renderMultilineScalar(config.description ?? definition.id),
    `mode: ${definition.factory.mode}`,
    ...(typeof config.temperature === "number" ? [`temperature: ${config.temperature}`] : []),
    ...renderPermissionBlock(config.permission),
    "---",
    "",
  ].join("\n")

  return `${frontmatter}${config.prompt ?? ""}`
}
