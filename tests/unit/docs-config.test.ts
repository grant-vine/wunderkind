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
  "ciso",
  "legal-counsel",
] as const

describe("docs-config", () => {
  it("exports AGENT_DOCS_CONFIG as an object", () => {
    expect(typeof AGENT_DOCS_CONFIG).toBe("object")
    expect(AGENT_DOCS_CONFIG === null).toBe(false)
  })

  it("contains all 6 expected agent keys", () => {
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

  it("buildDocsInstruction includes history mode information with UTC timestamp examples", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./docs", "overwrite")
    expect(instruction).toContain("History mode")
    expect(instruction).toContain("overwrite")
    expect(instruction).toContain("## Update 2026-03-12T18-37-52Z")
    expect(instruction).toContain("marketing-strategy--2026-03-12T18-37-52Z.md")
  })

  it("buildDocsInstruction includes exact UTC timestamp contract", () => {
    const instruction = buildDocsInstruction("marketing-wunderkind", "./docs", "overwrite")
    expect(instruction).toContain("UTC Timestamp Contract:")
    expect(instruction).toContain("YYYY-MM-DDTHH-mm-ssZ")
    expect(instruction).toContain("reuse the same shared base timestamp token")
    expect(instruction).toContain("managed family files")
    expect(instruction).toContain("Existing date-only files or sections (e.g. YYYY-MM-DD) remain untouched; do not migrate them")
    expect(instruction).not.toContain("- append-dated: Append a dated section to the file.\n")
    expect(instruction).not.toContain("- new-dated-file: Create a new file with a date suffix.\n")
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
      "ciso",
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
