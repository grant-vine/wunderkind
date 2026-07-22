import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"

type PluginPackageJson = {
  readonly exports?: Record<string, unknown>
}

describe("OpenCode plugin compatibility shim", () => {
  it("keeps the local tool shim aligned with the current @opencode-ai/plugin export surface", () => {
    const pluginPackage = JSON.parse(
      readFileSync(new URL("../../node_modules/@opencode-ai/plugin/package.json", import.meta.url), "utf8"),
    ) as PluginPackageJson
    const shim = readFileSync(new URL("../../src/types/opencode-plugin.d.ts", import.meta.url), "utf8")

    expect(pluginPackage.exports?.["./tool"]).toBeDefined()
    expect(shim).toContain('declare module "@opencode-ai/plugin/tool"')
    expect(shim).toContain("export type ToolResult = string | {")
  })
})
