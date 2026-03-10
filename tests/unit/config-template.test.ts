import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { parse } from "jsonc-parser"

const REQUIRED_AGENT_KEYS = [
  "wunderkind:marketing-wunderkind",
  "wunderkind:creative-director",
  "wunderkind:product-wunderkind",
  "wunderkind:fullstack-wunderkind",
  "wunderkind:brand-builder",
  "wunderkind:qa-specialist",
  "wunderkind:operations-lead",
  "wunderkind:ciso",
  "wunderkind:devrel-wunderkind",
  "wunderkind:legal-counsel",
  "wunderkind:support-engineer",
  "wunderkind:data-analyst",
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readAgentTemplate(): Record<string, unknown> {
  const parsed = parse(readFileSync(new URL("../../oh-my-opencode.jsonc", import.meta.url), "utf8"))

  if (!isRecord(parsed) || !isRecord(parsed.agents)) {
    throw new Error("Expected oh-my-opencode.jsonc to parse to an object with an agents map")
  }

  return parsed.agents
}

describe("oh-my-opencode config template", () => {
  it("defines the expected 12 wunderkind agents", () => {
    const agents = readAgentTemplate()

    expect(Object.keys(agents)).toHaveLength(REQUIRED_AGENT_KEYS.length)

    for (const agentKey of REQUIRED_AGENT_KEYS) {
      expect(agents).toHaveProperty(agentKey)
    }
  })

  it("uses category inheritance instead of per-agent model keys", () => {
    const agents = readAgentTemplate()

    for (const agentKey of REQUIRED_AGENT_KEYS) {
      const agentConfig = agents[agentKey]

      expect(isRecord(agentConfig)).toBe(true)
      if (!isRecord(agentConfig)) {
        throw new Error(`Expected ${agentKey} to map to an object`)
      }

      expect(agentConfig).toHaveProperty("category")
      expect(typeof agentConfig.category).toBe("string")
      expect(agentConfig).not.toHaveProperty("model")
    }
  })
})
