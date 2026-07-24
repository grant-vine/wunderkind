import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"

type PluginPackageJson = {
  readonly exports?: Record<string, unknown>
  readonly bin?: Record<string, string>
  readonly scripts?: Record<string, string>
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

  it("keeps prompt optimization overlay-only without a daemon or secondary runtime entrypoint", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as PluginPackageJson

    expect(packageJson.bin).toEqual({ wunderkind: "bin/wunderkind.js" })
    expect(Object.keys(packageJson.exports ?? {})).toEqual(["."])
    expect(
      Object.keys(packageJson.scripts ?? {}).some((name) =>
        ["start", "serve", "daemon", "worker", "queue", "scheduler"].includes(name),
      ),
    ).toBe(false)
  })
})
