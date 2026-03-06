import type { AgentConfig } from "@opencode-ai/sdk"

export type AgentMode = "primary" | "subagent" | "all"

export type AgentFactory = ((model: string) => AgentConfig) & {
  mode: AgentMode
}

export type AgentCategory = "exploration" | "specialist" | "advisor" | "utility"

export type AgentCost = "FREE" | "CHEAP" | "EXPENSIVE"

export interface DelegationTrigger {
  domain: string
  trigger: string
}

export interface AgentPromptMetadata {
  category: AgentCategory
  cost: AgentCost
  triggers: DelegationTrigger[]
  useWhen?: string[]
  avoidWhen?: string[]
  dedicatedSection?: string
  promptAlias?: string
  keyTrigger?: string
}

export type PermissionValue = "ask" | "allow" | "deny"

export function createAgentToolRestrictions(denyTools: string[]): {
  permission: Record<string, PermissionValue>
} {
  return {
    permission: Object.fromEntries(
      denyTools.map((tool) => [tool, "deny" as const]),
    ),
  }
}
