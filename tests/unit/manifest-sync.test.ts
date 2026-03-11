import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"

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

describe("manifest version sync", () => {
  it("keeps package and Claude plugin manifests in sync", () => {
    const packageVersion = readVersion(new URL("../../package.json", import.meta.url))
    const pluginVersion = readVersion(new URL("../../.claude-plugin/plugin.json", import.meta.url))

    expect(packageVersion.length).toBeGreaterThan(0)
    expect(pluginVersion.length).toBeGreaterThan(0)
    expect(pluginVersion).toBe(packageVersion)
  })
})
