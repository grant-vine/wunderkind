import { describe, it, expect } from "bun:test"
import { readFileSync, statSync } from "node:fs"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readVersion(fileUrl: URL): string {
  const parsed: unknown = JSON.parse(readFileSync(fileUrl, "utf8"))

  if (!isRecord(parsed) || typeof parsed.version !== "string") {
    throw new Error(`Expected a JSON object with a string version in ${fileUrl.pathname}`)
  }

  return parsed.version
}

function readText(fileUrl: URL): string {
  return readFileSync(fileUrl, "utf8")
}

describe("manifest version sync", () => {
  it("keeps package and Claude plugin manifests in sync", () => {
    const packageVersion = readVersion(new URL("../../package.json", import.meta.url))
    const pluginVersion = readVersion(new URL("../../.claude-plugin/plugin.json", import.meta.url))

    expect(packageVersion.length).toBeGreaterThan(0)
    expect(pluginVersion.length).toBeGreaterThan(0)
    expect(pluginVersion).toBe(packageVersion)
  })

  it("keeps package metadata aligned with the six retained-agent product surface", () => {
    const packageBody = readText(new URL("../../package.json", import.meta.url))

    expect(packageBody).toContain("6 retained specialist agents")
    expect(packageBody).not.toContain("12 professional agents")
  })
})

describe("design-md command asset", () => {
  const commandFile = new URL("../../commands/design-md.md", import.meta.url)
  const docsIndexFile = new URL("../../commands/docs-index.md", import.meta.url)

  it("exists as a file", () => {
    expect(statSync(commandFile).isFile()).toBe(true)
  })

  it("keeps both shipped command assets covered by package publishing", () => {
    const packageJson = JSON.parse(readText(new URL("../../package.json", import.meta.url))) as {
      files?: unknown
    }

    expect(Array.isArray(packageJson.files)).toBe(true)
    expect(packageJson.files).toContain("commands/")
    expect(statSync(commandFile).isFile()).toBe(true)
    expect(statSync(docsIndexFile).isFile()).toBe(true)
  })

  it("declares the creative-director owner in frontmatter", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).toContain("agent: creative-director")
    expect(commandBody).toContain("name: design-md")
  })

  it("references only the supported modes", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).toContain("`new`")
    expect(commandBody).toContain("`capture-existing`")
    expect(commandBody).not.toContain("`refresh`")
    expect(commandBody).not.toContain("`update`")
  })

  it("avoids slash-sync language and two-way round-trip promises", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).not.toContain("/sync")
    expect(commandBody).not.toContain("bi-directional")
    expect(commandBody).not.toContain("two-way")
    expect(commandBody).not.toContain("round-trip")
  })

  it("writes the capture-existing companion inside .wunderkind/stitch", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).toContain(".wunderkind/stitch/source-assets.md")
  })

  it("preserves the shipped docs-index command asset assertions", () => {
    const docsIndexBody = readText(docsIndexFile)

    expect(docsIndexBody).toContain("/docs-index")
    expect(docsIndexBody).toContain("agent: product-wunderkind")
  })
})
