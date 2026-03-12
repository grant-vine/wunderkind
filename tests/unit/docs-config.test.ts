import { describe, expect, it } from "bun:test"

import {
  AGENT_DOCS_CONFIG,
  DOCS_INDEX_RUNTIME_STATUS,
  buildDocsInstruction,
  getDocsEligibleAgentKeys,
} from "../../src/agents/docs-config.js"

const EXPECTED_AGENT_KEYS = [
  "marketing-wunderkind",
  "creative-director",
  "product-wunderkind",
  "fullstack-wunderkind",
  "brand-builder",
  "qa-specialist",
  "operations-lead",
  "ciso",
  "devrel-wunderkind",
  "legal-counsel",
  "support-engineer",
  "data-analyst",
] as const

describe("docs-config", () => {
  it("exports AGENT_DOCS_CONFIG as an object", () => {
    expect(typeof AGENT_DOCS_CONFIG).toBe("object")
    expect(AGENT_DOCS_CONFIG === null).toBe(false)
  })

  it("contains all 12 expected agent keys", () => {
    for (const key of EXPECTED_AGENT_KEYS) {
      expect(AGENT_DOCS_CONFIG[key]).toBeDefined()
    }
  })

  it("each entry has canonicalFilename string and eligible boolean", () => {
    for (const key of EXPECTED_AGENT_KEYS) {
      const entry = AGENT_DOCS_CONFIG[key]
      expect(typeof entry?.canonicalFilename).toBe("string")
      expect(typeof entry?.eligible).toBe("boolean")
    }
  })

  it("buildDocsInstruction returns a string", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./docs", "overwrite")
    expect(typeof instruction).toBe("string")
  })

  it("buildDocsInstruction includes canonical filename for the agent", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./docs", "overwrite")
    const filename = AGENT_DOCS_CONFIG["marketing-wunderkind"]?.canonicalFilename ?? ""
    expect(instruction).toContain(filename)
  })

  it("buildDocsInstruction includes docsPath parameter value", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./custom-docs", "overwrite")
    expect(instruction).toContain("./custom-docs")
  })

  it("buildDocsInstruction includes history mode information", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./docs", "overwrite")
    expect(instruction).toContain("History mode")
    expect(instruction).toContain("overwrite")
  })

  it("buildDocsInstruction references the docs-index workflow", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./docs", "overwrite")
    expect(instruction).toContain("/docs-index")
    expect(instruction).toContain("Refresh its contents if it already exists")
    expect(instruction).toContain("create it if missing")
    expect(instruction).toContain("optional follow-up")
    expect(instruction).not.toContain("explicit completion result")
  })

  it("exports the exact eligible docs agent set", () => {
    expect(getDocsEligibleAgentKeys()).toEqual([
      "marketing-wunderkind",
      "creative-director",
      "product-wunderkind",
      "fullstack-wunderkind",
      "brand-builder",
      "qa-specialist",
      "operations-lead",
      "ciso",
      "devrel-wunderkind",
    ])
  })

  it("freezes docs-index as an executable plugin command", () => {
    expect(DOCS_INDEX_RUNTIME_STATUS.invocation).toBe("/docs-index")
    expect(DOCS_INDEX_RUNTIME_STATUS.executable).toBe(true)
    expect(DOCS_INDEX_RUNTIME_STATUS.reason).toContain("lightweight refresh/bootstrap")
  })

  it("buildDocsInstruction throws for unknown agent key", () => {
    try {
      buildDocsInstruction("unknown-agent", "./docs", "overwrite")
      throw new Error("Expected buildDocsInstruction to throw for unknown agent")
    } catch (error) {
      expect(error instanceof Error).toBe(true)
      const message = error instanceof Error ? error.message : ""
      expect(message).toBe("Unknown agent key: unknown-agent")
    }
  })
})
