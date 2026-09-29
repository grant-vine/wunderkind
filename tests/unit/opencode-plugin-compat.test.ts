import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { tool } from "@opencode-ai/plugin/tool"

type PluginPackageJson = {
  readonly exports?: Record<string, unknown>
  readonly bin?: Record<string, string>
  readonly scripts?: Record<string, string>
}

describe("OpenCode plugin compatibility shim", () => {
  it("executes a structured tool result through the installed plugin tool API", async () => {
    // Given an SDK client and tool using the installed public APIs.
    const client = createOpencodeClient({ baseUrl: "http://127.0.0.1:1" })
    const definition = tool({
      description: "Compatibility fixture",
      args: { text: tool.schema.string() },
      execute: async ({ text }, context) => ({ output: text, metadata: { directory: context.directory } }),
    })
    const context = {
      sessionID: "fixture-session", messageID: "fixture-message", agent: "fixture",
      directory: "/fixture", worktree: "/fixture", abort: new AbortController().signal,
      metadata: () => {}, ask: async () => {},
    }

    // When a parsed argument is executed without a network request.
    const parsed = tool.schema.object(definition.args).parse({ text: "fixture output" })
    const result = await definition.execute(parsed, context)

    // Then the installed tool API preserves structured output and the SDK exposes its session adapter.
    expect(result).toEqual({ output: "fixture output", metadata: { directory: "/fixture" } })
    expect(typeof client.session.prompt).toBe("function")
    expect(tool.schema.object(definition.args).safeParse({ text: 42 }).success).toBe(false)
  })

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

  it("keeps live runtime reporting owned by the runtime seam instead of token-audit", () => {
    const tokenAuditSource = readFileSync(new URL("../../src/cli/token-audit.ts", import.meta.url), "utf8")
    const pluginSource = readFileSync(new URL("../../src/index.ts", import.meta.url), "utf8")

    expect(tokenAuditSource).toContain('./prompt-surface-audit.js')
    expect(tokenAuditSource).not.toContain("prompt-optimization-runtime-reporting")
    expect(tokenAuditSource).not.toContain("system-transform.latest.json")
    expect(tokenAuditSource).not.toContain("session-compacting.latest.json")
    expect(tokenAuditSource).not.toContain("promptOptimizationReportingMode")

    expect(pluginSource).toContain("./cli/prompt-optimization-runtime-reporting.js")
    expect(pluginSource).toContain("buildPromptOptimizationRuntimeReport")
    expect(pluginSource).toContain("maybePersistPromptOptimizationRuntimeReport")
  })

  it("keeps memory separate from prompt optimization and exposes its opt-in doctor posture", () => {
    const cliSource = readFileSync(new URL("../../src/cli/index.ts", import.meta.url), "utf8")
    const doctorSource = readFileSync(new URL("../../src/cli/doctor.ts", import.meta.url), "utf8")
    const tokenAuditSource = readFileSync(new URL("../../src/cli/token-audit.ts", import.meta.url), "utf8")

    expect(cliSource).toContain("default-off multi-level prompt optimization engine")
    expect(doctorSource).toContain("memory enabled:")
    expect(doctorSource).toContain("memory Ollama endpoint:")
    expect(tokenAuditSource).not.toContain("memory capture")
  })
})
