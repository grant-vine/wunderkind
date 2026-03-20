import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { WUNDERKIND_AGENT_IDS } from "../../src/agents/manifest.js"

const WUNDERKIND_SCHEMA_URL = "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"

describe("native wunderkind agent manifest", () => {
  it("defines the expected 6 filename-safe agent ids", () => {
    expect(WUNDERKIND_AGENT_IDS).toHaveLength(6)
    expect(WUNDERKIND_AGENT_IDS).toContain("marketing-wunderkind")
    expect(WUNDERKIND_AGENT_IDS).toContain("ciso")
    expect(WUNDERKIND_AGENT_IDS.every((id) => !id.includes(":"))).toBe(true)
  })
})

describe("package publish surface", () => {
  it("includes schema assets in package files", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { files?: string[] }

    expect(Array.isArray(pkg.files)).toBe(true)
    expect(pkg.files).toContain("schemas/")
  })

  it("includes plugin command assets in package files", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { files?: string[] }

    expect(Array.isArray(pkg.files)).toBe(true)
    expect(pkg.files).toContain("commands/")
  })
})

describe("wunderkind config schema asset", () => {
  it("uses the expected canonical schema URL as its id", () => {
    const schema = JSON.parse(readFileSync(new URL("../../schemas/wunderkind.config.schema.json", import.meta.url), "utf8")) as {
      $id?: string
      oneOf?: Array<{ properties?: Record<string, unknown>; required?: string[] }>
    }

    expect(schema.$id).toBe(WUNDERKIND_SCHEMA_URL)
    expect(Array.isArray(schema.oneOf)).toBe(true)
    expect(schema.oneOf?.length).toBe(2)
    const projectSchema = schema.oneOf?.[1]
    expect(projectSchema?.properties?.prdPipelineMode).toBeDefined()
    expect(projectSchema?.properties?.["de" + "sloppifyEnabled"]).toBeUndefined()
    expect(projectSchema?.required).not.toContain("prdPipelineMode")
  })

  it("silently drops removed legacy project keys when parsing JSONC config", async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")

    const tempRoot = mkdtempSync(join(tmpdir(), "wk-config-schema-"))
    const originalCwd = process.cwd()
    const legacyKey = ["de", "sloppifyEnabled"].join("")

    try {
      process.chdir(tempRoot)
      mkdirSync(join(tempRoot, ".wunderkind"), { recursive: true })
      writeFileSync(
        join(tempRoot, ".wunderkind", "wunderkind.config.jsonc"),
        `{
  // stale legacy field should be ignored
  "teamCulture": "pragmatic-balanced",
  "${legacyKey}": true
}`,
      )

      const { readProjectWunderkindConfig } = await import(`../../src/cli/config-manager/index.ts?stale-key=${Date.now()}`)
      const parsed = readProjectWunderkindConfig()

      expect(parsed).toBeDefined()
      expect(parsed?.teamCulture).toBe("pragmatic-balanced")
      expect(Object.prototype.hasOwnProperty.call(parsed ?? {}, legacyKey)).toBe(false)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

describe("docs-index plugin command asset", () => {
  it("exists and uses the lightweight docs refresh contract", () => {
    const command = readFileSync(new URL("../../commands/docs-index.md", import.meta.url), "utf8")

    expect(command).toContain("agent: product-wunderkind")
    expect(command).toContain("/docs-index")
    expect(command).not.toContain("local docs-index planning support")
    expect(command).toContain("refresh/bootstrap")
    expect(command).toContain("bootstrapped from scratch when missing")
    expect(command).toContain("Never inspect parent directories")
    expect(command).toContain("ask the user whether to run `init-deep`")
    expect(command).not.toContain("explicit structured completion result")
    expect(command).not.toContain("one parallel background task per docs-eligible Wunderkind agent")
    expect(command).toContain("Partial success")
    expect(command).toContain("2026-03-12T18-37-52Z")
    expect(command).toContain("## Update 2026-03-12T18-37-52Z")
    expect(command).toContain("marketing-strategy--2026-03-12T18-37-52Z.md")
    expect(command).toContain("managed family files")
  })
})
