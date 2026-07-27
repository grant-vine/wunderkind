import { beforeEach, describe, expect, it, mock } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { InstallConfig } from "../../src/cli/types.js"
import { createProductWunderkindAgent } from "../../src/agents/index.js"
import {
  buildPromptOptimizationRuntimePublicPayload,
  PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS,
} from "../../src/cli/prompt-optimization-runtime-public-payload.js"
import type { PromptOptimizationRuntimeReport } from "../../src/cli/prompt-optimization-runtime-reporting.js"

type RealConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href
const REAL_CONFIG_MANAGER_MODULE_URL = new URL(
  `src/cli/config-manager/index.ts?plugin-transform-config=${Date.now()}`,
  `file://${PROJECT_ROOT}`,
).href
const INDEX_TEST_MODULE_URL = new URL(`src/index.ts?plugin-transform=${Date.now()}`, `file://${PROJECT_ROOT}`).href
const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"
const NATIVE_AGENTS_SENTINEL = "<!-- wunderkind:native-agents-start -->"
const ORIGINAL_CWD = process.cwd()
const HELPER_PATH = new URL("./helpers/run-prompt-optimization-fixture.mjs", import.meta.url)
const realConfigManager = (await import(REAL_CONFIG_MANAGER_MODULE_URL)) as RealConfigManagerModule

const mockReadWunderkindConfig = mock<() => Partial<InstallConfig> | null>(() => null)

function registerConfigManagerMock(): void {
  const factory = () => ({
    ...realConfigManager,
    readWunderkindConfig: mockReadWunderkindConfig,
    detectCurrentConfig: realConfigManager.detectCurrentConfig,
    detectOmoInstallReadiness: () => ({
      installed: false,
      registered: false,
      loadedVersion: null,
      configPath: null,
      configSource: null,
      legacyConfigPath: null,
      staleOverrideWarning: null,
      versionSkewWarning: null,
      dualConfigWarning: null,
      freshness: null,
      freshnessSummary: { state: "not-detected", guidance: "mock guidance" },
      interactiveInstallCommand: "bunx oh-my-openagent install",
      nonTuiInstallCommand: "bunx oh-my-openagent install --no-tui --claude=yes --gemini=no --copilot=yes",
      guidance: "mock guidance",
    }),
    detectGitHubWorkflowReadiness: () => ({
      isGitRepo: false,
      hasGitHubRemote: false,
      ghInstalled: false,
      authVerified: false,
      authCheckAttempted: false,
    }),
    writeWunderkindConfig: () => ({ success: true, configPath: "/tmp/mock-config" }),
    writeNativeAgentFiles: () => ({ success: true, configPath: "/tmp/mock-agents" }),
    writeNativeCommandFiles: () => ({ success: true, configPath: "/tmp/mock-commands" }),
    writeNativeSkillFiles: () => ({ success: true, configPath: "/tmp/mock-skills" }),
    removePluginFromOpenCodeConfig: () => ({ success: true, configPath: "/tmp/mock-opencode.json", changed: true }),
    removeNativeAgentFiles: () => ({ success: true, configPath: "/tmp/mock-agents", changed: true }),
    removeNativeCommandFiles: () => ({ success: true, configPath: "/tmp/mock-commands", changed: true }),
    removeNativeSkillFiles: () => ({ success: true, configPath: "/tmp/mock-skills", changed: true }),
    removeGlobalWunderkindConfig: () => ({ success: true, configPath: "/tmp/mock-global-config", changed: true }),
    detectLegacyConfig: () => false,
    addPluginToOpenCodeConfig: () => ({ success: true, configPath: "/tmp/mock-opencode.json" }),
    getDefaultGlobalConfig: () => ({ region: "Global", industry: "", primaryRegulation: "", secondaryRegulation: "" }),
    getPromptOptimizationHookBudgetBasis: ({ promptOptimizationByteBudget }: { promptOptimizationByteBudget?: number }) =>
      typeof promptOptimizationByteBudget === "number" && Number.isSafeInteger(promptOptimizationByteBudget) && promptOptimizationByteBudget > 0
        ? "configured-bytes"
        : "budget-unavailable",
    readWunderkindConfigForScope: () => null,
    detectNativeAgentFiles: () => ({ dir: "/tmp/mock-agents", presentCount: 0, totalCount: 0, allPresent: false }),
    detectNativeAgentMarkdownVersions: () => ({ allCurrent: true, staleAgentIds: [], currentVersion: null }),
    detectNativeAssetVersion: () => ({ kind: "agents", installedVersion: null, currentVersion: null, needsUpgrade: false }),
    detectNativeCommandFiles: () => ({ dir: "/tmp/mock-commands", presentCount: 0, totalCount: 0, allPresent: false }),
    detectNativeSkillFiles: () => ({ dir: "/tmp/mock-skills", presentCount: 0, totalCount: 0, allPresent: false }),
    getNativeCommandFilePaths: () => [],
    detectOmoVersionInfo: () => ({ registered: false, loadedVersion: null, staleOverrideWarning: null }),
    summarizeOmoFreshness: () => ({ state: "not-detected", guidance: "mock guidance" }),
    detectWunderkindVersionInfo: () => ({ currentVersion: null }),
    getProjectOverrideMarker: () => ({ marker: "○", sourceLabel: "inherited default" }),
    readProjectWunderkindConfig: realConfigManager.readProjectWunderkindConfig,
    resolveOpenCodeConfigPath: () => ({ path: "/tmp/mock-opencode.json", format: "json", source: "opencode.json" }),
    resolveWunderkindTeamConfigPath: () => "/tmp/.omo/teams/wunderkind-daily-brief/config.json",
    writeWunderkindTeamConfig: () => ({ success: true, configPath: "/tmp/.omo/teams/wunderkind-daily-brief/config.json" }),
  })

  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, factory)
  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, factory)
  mock.module(CONFIG_MANAGER_JS_URL, factory)
  mock.module(CONFIG_MANAGER_TS_URL, factory)
}

type TestOutput = {
  system: string[]
  metadata?: (input: TestMetadataEvent) => void
}

type TestMetadataEvent = {
  readonly title?: string
  readonly metadata?: Record<string, unknown>
}

type CompactionOutput = {
  context: string[]
  metadata?: (input: TestMetadataEvent) => void
}

type PluginModule = { default: (...args: unknown[]) => Promise<{ "experimental.chat.system.transform"?: (input: unknown, output: TestOutput) => Promise<void>; "experimental.session.compacting"?: (input: unknown, output: CompactionOutput) => Promise<void>; "permission.ask"?: (input: { type: string; pattern?: string | string[]; metadata: Record<string, unknown> }, output: { status: "ask" | "allow" | "deny" }) => Promise<void>; tool?: Record<string, unknown> }> }

let cachedTransform: ((input: unknown, output: TestOutput) => Promise<void>) | null = null
let cachedCompaction: ((input: unknown, output: CompactionOutput) => Promise<void>) | null = null
const initPromise = (async () => {
  registerConfigManagerMock()
  const mod = (await import(INDEX_TEST_MODULE_URL)) as PluginModule
  const pluginResult = await mod.default({})
  const transform = pluginResult["experimental.chat.system.transform"]
  const compaction = pluginResult["experimental.session.compacting"]
  if (!transform) {
    throw new Error("Expected experimental.chat.system.transform to exist")
  }
  if (!compaction) {
    throw new Error("Expected experimental.session.compacting to exist")
  }
  cachedTransform = transform
  cachedCompaction = compaction
})()

function readRuntimeReport(reportPath: string): PromptOptimizationRuntimeReport {
  return JSON.parse(readFileSync(reportPath, "utf-8")) as PromptOptimizationRuntimeReport
}

function createRuntimeReportingConfig(overrides: Partial<InstallConfig> = {}): Partial<InstallConfig> {
  return {
    region: "South Africa",
    industry: "SaaS",
    primaryRegulation: "POPIA",
    secondaryRegulation: "",
    teamCulture: "pragmatic-balanced",
    orgStructure: "flat",
    docsEnabled: true,
    docsPath: "./docs",
    docHistoryMode: "append-dated",
    promptOptimizationEnabled: true,
    promptOptimizationReportingMode: "persist",
    ...overrides,
  }
}

describe("Wunderkind plugin transform", () => {
  beforeEach(() => {
    mockReadWunderkindConfig.mockClear()
    mockReadWunderkindConfig.mockImplementation(() => null)
    process.chdir(ORIGINAL_CWD)
    delete process.env["OMO_AST_GREP_SG_PATH"]
  })

  it("builds one sanitized public runtime payload and derives summary metadata from its stable subset", () => {
    const publicPayload = buildPromptOptimizationRuntimePublicPayload({
      hookPath: "experimental.chat.system.transform",
      modelId: "sk-live-summary",
      promptOptimizationMode: "active",
      countState: "exact-local",
      budgetBasis: "configured-bytes",
      budgetLimit: 128,
      trimBasis: "configured-bytes",
      trimBudgetLimit: 96,
      eligibleSections: ["runtime-context"],
      beforeBytes: 200,
      afterBytes: 120,
      savedBytes: 80,
      trimApplied: true,
      trimExhausted: false,
      trimmedSections: ["runtime-docs-output"],
      noTrimReason: null,
      exactTokenDelta: {
        beforeTokens: 40,
        afterTokens: 24,
        savedTokens: 16,
      },
    })

    expect(publicPayload.report.modelId).toBe("***")
    expect(publicPayload.summaryMetadata).toEqual({
      hookPath: publicPayload.report.hookPath,
      promptOptimizationMode: publicPayload.report.promptOptimizationMode,
      countState: publicPayload.report.countState,
      budgetBasis: publicPayload.report.budgetBasis,
      budgetLimit: publicPayload.report.budgetLimit,
      trimBasis: publicPayload.report.trimBasis,
      trimBudgetLimit: publicPayload.report.trimBudgetLimit,
      eligibleSections: publicPayload.report.eligibleSections,
      beforeBytes: publicPayload.report.beforeBytes,
      afterBytes: publicPayload.report.afterBytes,
      savedBytes: publicPayload.report.savedBytes,
      trimApplied: publicPayload.report.trimApplied,
      trimExhausted: publicPayload.report.trimExhausted,
      trimmedSections: publicPayload.report.trimmedSections,
      noTrimReason: publicPayload.report.noTrimReason,
      exactTokenDelta: publicPayload.report.exactTokenDelta,
    })
    expect(Object.keys(publicPayload.summaryMetadata)).toEqual([
      ...PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS,
    ])
    expect(publicPayload.summaryMetadata).not.toHaveProperty("modelId")
  })

  it("prefers ast-grep via the upstream env override seam on macOS when unset", async () => {
    registerConfigManagerMock()

    const mod = (await import(new URL(`src/index.ts?ast-grep-env=${Date.now()}`, `file://${PROJECT_ROOT}`).href)) as PluginModule & {
      applyAstGrepMacOsEnvOverride: typeof import("../../src/index.js").applyAstGrepMacOsEnvOverride
    }

    const env: NodeJS.ProcessEnv = {}
    const result = mod.applyAstGrepMacOsEnvOverride({
      platform: "darwin",
      env,
      resolveBinaryPath: () => "/opt/homebrew/bin/ast-grep",
      supportsVersionProbe: (binaryPath) => binaryPath === "/opt/homebrew/bin/ast-grep",
    })

    expect(result).toEqual({
      applied: true,
      reason: "configured",
      binaryPath: "/opt/homebrew/bin/ast-grep",
    })
    expect(env["OMO_AST_GREP_SG_PATH"]).toBe("/opt/homebrew/bin/ast-grep")
  })

  it("preserves an existing ast-grep override env var", async () => {
    registerConfigManagerMock()
    const env: NodeJS.ProcessEnv = {
      OMO_AST_GREP_SG_PATH: "/custom/ast-grep",
    }

    const mod = (await import(new URL(`src/index.ts?ast-grep-existing=${Date.now()}`, `file://${PROJECT_ROOT}`).href)) as PluginModule & {
      applyAstGrepMacOsEnvOverride: typeof import("../../src/index.js").applyAstGrepMacOsEnvOverride
    }

    const result = mod.applyAstGrepMacOsEnvOverride({ platform: "darwin", env })

    expect(result).toEqual({
      applied: false,
      reason: "already-set",
      binaryPath: "/custom/ast-grep",
    })
    expect(env["OMO_AST_GREP_SG_PATH"]).toBe("/custom/ast-grep")
  })

  it("always injects the native agent catalog and delegation rules", async () => {
    await initPromise
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    const nativeAgentsSection = output.system.find((entry) => entry.includes("## Wunderkind Native Agents"))
    if (!nativeAgentsSection) {
      throw new Error("Expected native agents section")
    }

    expect(nativeAgentsSection).toContain("marketing-wunderkind")
    expect(nativeAgentsSection).toContain("creative-director")
    expect(nativeAgentsSection).toContain("product-wunderkind")
    expect(nativeAgentsSection).toContain("fullstack-wunderkind")
    expect(nativeAgentsSection).toContain("ciso")
    expect(nativeAgentsSection).toContain("legal-counsel")
    expect(nativeAgentsSection).not.toContain("brand-builder")
    expect(nativeAgentsSection).not.toContain("qa-specialist")
    expect(nativeAgentsSection).not.toContain("operations-lead")
    expect(nativeAgentsSection).not.toContain("devrel-wunderkind")
    expect(nativeAgentsSection).not.toContain("support-engineer")
    expect(nativeAgentsSection).not.toContain("data-analyst")
    expect(nativeAgentsSection).toContain(
      "Use marketing-wunderkind for GTM, brand, community, developer advocacy, docs-led launches, tutorials, migration support, funnel interpretation, and adoption work",
    )
    expect(nativeAgentsSection).toContain(
      "Use fullstack-wunderkind for engineering implementation, architecture, TDD, technical diagnosis, reliability engineering, runbooks, incidents, and supportability",
    )
    expect(nativeAgentsSection).toContain("Use legal-counsel for OSS licensing and legal/compliance review")
    expect(nativeAgentsSection).toContain(
      "Use `task(...)` for retained-agent or subagent delegation; always include explicit `load_skills` and `run_in_background`.",
    )
    expect(nativeAgentsSection).toContain(`Use \`skill(name="...")\` for shipped skills and sub-skills.`)
  })

  it("registers a bounded durable artifact writer tool", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})

    expect(pluginResult.tool).toBeDefined()
    expect(Object.keys(pluginResult.tool ?? {})).toContain("wunderkind_write_artifact")
  })

  it("writes durable artifacts without routing through generic write/edit permission asks", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const durableArtifactTool = pluginResult.tool?.["wunderkind_write_artifact"] as
      | {
          execute?: (
            args: {
              relativePath: string
              content: string
              mode?: string
            },
            context: {
              directory: string
              ask: (input: unknown) => Promise<void>
              metadata: (input: unknown) => void
            },
          ) => Promise<string>
        }
      | undefined

    if (!durableArtifactTool?.execute) {
      throw new Error("Expected wunderkind_write_artifact.execute to exist")
    }

    const sandbox = join(tmpdir(), `wunderkind-tool-write-permission-${Date.now()}`)
    mkdirSync(sandbox, { recursive: true })
      const askCalls: unknown[] = []

      try {
        await durableArtifactTool.execute(
          {
            relativePath: ".omo/notepads/runtime/learnings.md",
            content: "Entry\n",
          },
          {
            directory: sandbox,
            ask: async (input) => {
              askCalls.push(input)
            },
            metadata: () => {},
          },
        )

        expect(askCalls).toHaveLength(0)
        expect(readFileSync(join(sandbox, ".omo/notepads/runtime/learnings.md"), "utf-8")).toBe("Entry\n")
      } finally {
        rmSync(sandbox, { recursive: true, force: true })
      }
  })

  it("lets product-wunderkind write a PRD through the durable artifact tool despite generic write/edit denial", async () => {
    const productConfig = createProductWunderkindAgent("test-model")
    const permissions = productConfig.permission as Record<string, string> | undefined
    expect(permissions?.["write"]).toBe("deny")
    expect(permissions?.["edit"]).toBe("deny")
    expect(productConfig.prompt).toContain("Use normal Write/Edit for ordinary repo files")
  })

  it("supports evidence writes through the durable artifact tool", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const durableArtifactTool = pluginResult.tool?.["wunderkind_write_artifact"] as
      | {
          execute?: (
            args: {
              relativePath: string
              content: string
              mode?: string
            },
            context: {
              directory: string
              ask: (input: unknown) => Promise<void>
              metadata: (input: unknown) => void
            },
          ) => Promise<string>
        }
      | undefined

    if (!durableArtifactTool?.execute) {
      throw new Error("Expected wunderkind_write_artifact.execute to exist")
    }

    const sandbox = join(tmpdir(), `wunderkind-tool-evidence-${Date.now()}`)
    mkdirSync(sandbox, { recursive: true })

    try {
      const result = await durableArtifactTool.execute(
        {
          relativePath: ".omo/evidence/dream/findings.md",
          content: "Discovery\n",
        },
        {
          directory: sandbox,
          ask: async () => {},
          metadata: () => {},
        },
      )

        expect(result).toBe("Durable artifact written to .omo/evidence/dream/findings.md")
        expect(readFileSync(join(sandbox, ".omo/evidence/dream/findings.md"), "utf-8")).toBe("Discovery\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("passes a non-default configured docsPath through the durable artifact tool runtime seam", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({
      docsPath: "./project-docs",
    }))

    const output: TestOutput = { system: [] }
    await cachedTransform!({}, output)

    const nativeAgentsContent = output.system.find((entry) => entry.includes("## Wunderkind Native Agents")) ?? ""
    expect(nativeAgentsContent).toContain("Use normal `Write`/`Edit` for ordinary repo files, docs-output, `DESIGN.md`, `.wunderkind/stitch/`, and managed `.omo/` planning files")
  })

  it("exposes the currently adopted plugin hook surface", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})

    expect(typeof pluginResult["permission.ask"]).toBe("function")
    expect(typeof pluginResult["experimental.chat.system.transform"]).toBe("function")
    expect(pluginResult).not.toHaveProperty("tool.execute.before")
    expect(pluginResult).not.toHaveProperty("tool.execute.after")
    expect(pluginResult).not.toHaveProperty("command.execute.before")
    expect(pluginResult).not.toHaveProperty("chat.headers")
    expect(pluginResult).not.toHaveProperty("shell.env")
    expect(typeof pluginResult["experimental.session.compacting"]).toBe("function")
  })

  it("preserves background-task continuity in compaction context", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const hook = pluginResult["experimental.session.compacting"]
    if (!hook) {
      throw new Error("Expected experimental.session.compacting hook")
    }

    const output = { context: [] as string[] }
    await hook({}, output)

    expect(output.context.join("\n")).toContain("Preserve every active background task id (`bg_...")
    expect(output.context.join("\n")).toContain("ready to call `background_output`")
  })

  it("keeps active mode default-safe when no byte budget is configured", async () => {
    registerConfigManagerMock()
    mockReadWunderkindConfig.mockImplementation(() => ({
      promptOptimizationEnabled: true,
      promptOptimizationMode: "active",
    }))
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const transform = pluginResult["experimental.chat.system.transform"]
    if (!transform) {
      throw new Error("Expected experimental.chat.system.transform to exist")
    }

    const output: TestOutput = { system: [] }

    await transform({}, output)

    expect(output.system.some((entry) => entry.includes("## Wunderkind Native Agents"))).toBe(true)
    expect(output.system.some((entry) => entry.includes(NATIVE_AGENTS_SENTINEL))).toBe(true)
  })

  it("overwrites the latest runtime report for both live hook paths and persists only scalar metrics plus section ids", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-runtime-report-${Date.now()}`)
    const runtimeReportDir = join(tempDir, ".wunderkind", "runtime", "prompt-optimization")
    const systemReportPath = join(runtimeReportDir, "system-transform.latest.json")
    const sessionReportPath = join(runtimeReportDir, "session-compacting.latest.json")

    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    try {
      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "advisory",
          promptOptimizationByteBudget: 1200,
        }),
      )

      await cachedTransform!({}, { system: [] })
      await cachedCompaction!({}, { context: [] })

      const firstSystemReport = readRuntimeReport(systemReportPath)
      const firstSessionReport = readRuntimeReport(sessionReportPath)

      expect(Object.keys(firstSystemReport)).toEqual([
        "hookPath",
        "modelId",
        "promptOptimizationMode",
        "countState",
        "budgetBasis",
        "budgetLimit",
        "trimBasis",
        "trimBudgetLimit",
        "eligibleSections",
        "beforeBytes",
        "afterBytes",
        "savedBytes",
        "trimApplied",
        "trimExhausted",
        "trimmedSections",
        "noTrimReason",
        "exactTokenDelta",
      ])
      expect(firstSystemReport.hookPath).toBe("experimental.chat.system.transform")
      expect(firstSystemReport.promptOptimizationMode).toBe("advisory")
      expect(firstSystemReport.trimApplied).toBe(false)
      expect(firstSystemReport.noTrimReason).toBe("advisory-mode-report-only")
      expect(firstSystemReport.exactTokenDelta).toBe(null)
      expect(firstSessionReport.hookPath).toBe("experimental.session.compacting")
      expect(firstSessionReport.promptOptimizationMode).toBe("advisory")
      expect(firstSessionReport.trimApplied).toBe(false)
      expect(firstSessionReport.noTrimReason).toBe("advisory-mode-report-only")
      expect(firstSessionReport.exactTokenDelta).toBe(null)
      expect(firstSystemReport.eligibleSections.length).toBeGreaterThan(0)
      expect(firstSystemReport.eligibleSections.every((sectionId) => typeof sectionId === "string")).toBe(true)
      expect(firstSystemReport).not.toHaveProperty("content")
      expect(firstSystemReport).not.toHaveProperty("system")
      expect(firstSystemReport).not.toHaveProperty("context")

      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
        }),
      )

      await cachedTransform!({}, { system: [] })
      await cachedCompaction!({}, { context: [] })

      const secondSystemReport = readRuntimeReport(systemReportPath)
      const secondSessionReport = readRuntimeReport(sessionReportPath)

      expect(secondSystemReport.hookPath).toBe("experimental.chat.system.transform")
      expect(secondSystemReport.promptOptimizationMode).toBe("active")
      expect(secondSystemReport.trimApplied).toBe(true)
      expect(secondSystemReport.trimExhausted).toBe(true)
      expect(secondSystemReport.noTrimReason).toBe(null)
      expect(secondSystemReport.savedBytes).toBeGreaterThan(0)
      expect(secondSystemReport.afterBytes < secondSystemReport.beforeBytes).toBe(true)
      expect(secondSystemReport).not.toEqual(firstSystemReport)
      expect(secondSystemReport.noTrimReason).not.toBe(firstSystemReport.noTrimReason)

      expect(secondSessionReport.hookPath).toBe("experimental.session.compacting")
      expect(secondSessionReport.promptOptimizationMode).toBe("active")
      expect(secondSessionReport.trimApplied).toBe(true)
      expect(secondSessionReport.trimExhausted).toBe(true)
      expect(secondSessionReport.noTrimReason).toBe(null)
      expect(secondSessionReport.trimmedSections).toEqual(["compaction-continuity"])
      expect(secondSessionReport.savedBytes).toBeGreaterThan(0)
      expect(secondSessionReport.afterBytes < secondSessionReport.beforeBytes).toBe(true)
      expect(secondSessionReport).not.toEqual(firstSessionReport)
      expect(secondSessionReport.noTrimReason).not.toBe(firstSessionReport.noTrimReason)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("persists an over-budget no-trim reason when runtime-context is the only eligible system-transform section", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-runtime-context-only-${Date.now()}`)
    const runtimeReportPath = join(
      tempDir,
      ".wunderkind",
      "runtime",
      "prompt-optimization",
      "system-transform.latest.json",
    )

    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    try {
      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          docsEnabled: false,
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
        }),
      )

      await cachedTransform!(
        {},
        {
          system: [
            `${NATIVE_AGENTS_SENTINEL}\n## Wunderkind Native Agents\nAlready present`,
          ],
        },
      )

      const persistedReport = readRuntimeReport(runtimeReportPath)
      const persistedJson = readFileSync(runtimeReportPath, "utf-8")

      expect(persistedReport.hookPath).toBe("experimental.chat.system.transform")
      expect(persistedReport.promptOptimizationMode).toBe("active")
      expect(persistedReport.eligibleSections).toEqual(["runtime-context"])
      expect(persistedReport.trimApplied).toBe(false)
      expect(persistedReport.afterBytes).toBe(persistedReport.beforeBytes)
      expect(persistedReport.afterBytes > (persistedReport.trimBudgetLimit ?? Number.POSITIVE_INFINITY)).toBe(true)
      expect(persistedReport.noTrimReason).toBe("over-trim-budget-no-trimmable-sections")
      expect(persistedJson).not.toContain("Already present")
      expect(persistedJson).not.toContain("## Wunderkind Native Agents")
      expect(persistedJson).not.toContain("## Documentation Output")
      expect(persistedJson).not.toContain("SOUL")
      expect(persistedJson).not.toContain("bg_")
      expect(persistedJson).not.toContain("Preserve every active background task id")
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("masks seeded secret model ids in persisted latest reports and still overwrites both live hook paths on the next run", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-runtime-public-payload-${Date.now()}`)
    const runtimeReportDir = join(tempDir, ".wunderkind", "runtime", "prompt-optimization")
    const systemReportPath = join(runtimeReportDir, "system-transform.latest.json")
    const sessionReportPath = join(runtimeReportDir, "session-compacting.latest.json")
    const seededSecretModelId = "sk-live-summary"
    const safeModelId = "gpt-4.1"

    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    try {
      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "advisory",
          promptOptimizationByteBudget: 1200,
          promptOptimizationReportingMode: "persist",
        }),
      )

      await cachedTransform!({ modelId: seededSecretModelId }, { system: [] })
      await cachedCompaction!({ modelId: seededSecretModelId }, { context: [] })

      const firstPersistedSystemReport = readRuntimeReport(systemReportPath)
      const firstPersistedSessionReport = readRuntimeReport(sessionReportPath)
      const firstPersistedSystemJson = readFileSync(systemReportPath, "utf-8")
      const firstPersistedSessionJson = readFileSync(sessionReportPath, "utf-8")

      expect(firstPersistedSystemReport.modelId).toBe("***")
      expect(firstPersistedSessionReport.modelId).toBe("***")
      expect(firstPersistedSystemReport.hookPath).toBe("experimental.chat.system.transform")
      expect(firstPersistedSessionReport.hookPath).toBe("experimental.session.compacting")
      expect(firstPersistedSystemReport.promptOptimizationMode).toBe("advisory")
      expect(firstPersistedSessionReport.promptOptimizationMode).toBe("advisory")
      expect(firstPersistedSystemReport.trimApplied).toBe(false)
      expect(firstPersistedSessionReport.trimApplied).toBe(false)
      expect(firstPersistedSystemJson).not.toContain(seededSecretModelId)
      expect(firstPersistedSessionJson).not.toContain(seededSecretModelId)

      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
          promptOptimizationReportingMode: "persist",
        }),
      )

      await cachedTransform!({ modelId: safeModelId }, { system: [] })
      await cachedCompaction!({ modelId: safeModelId }, { context: [] })

      const secondPersistedSystemReport = readRuntimeReport(systemReportPath)
      const secondPersistedSessionReport = readRuntimeReport(sessionReportPath)
      const secondPersistedSystemJson = readFileSync(systemReportPath, "utf-8")
      const secondPersistedSessionJson = readFileSync(sessionReportPath, "utf-8")

      expect(secondPersistedSystemReport.hookPath).toBe("experimental.chat.system.transform")
      expect(secondPersistedSessionReport.hookPath).toBe("experimental.session.compacting")
      expect(secondPersistedSystemReport.modelId).toBe(safeModelId)
      expect(secondPersistedSessionReport.modelId).toBe(safeModelId)
      expect(secondPersistedSystemReport.promptOptimizationMode).toBe("active")
      expect(secondPersistedSessionReport.promptOptimizationMode).toBe("active")
      expect(secondPersistedSystemReport.trimApplied).toBe(true)
      expect(secondPersistedSessionReport.trimApplied).toBe(true)
      expect(secondPersistedSystemReport).not.toEqual(firstPersistedSystemReport)
      expect(secondPersistedSessionReport).not.toEqual(firstPersistedSessionReport)
      expect(secondPersistedSystemJson).toContain(`"modelId": "${safeModelId}"`)
      expect(secondPersistedSessionJson).toContain(`"modelId": "${safeModelId}"`)
      expect(secondPersistedSystemJson).not.toContain(seededSecretModelId)
      expect(secondPersistedSessionJson).not.toContain(seededSecretModelId)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("leaves existing latest runtime reports untouched and emits no summary metadata when reporting mode changes from persist to off", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-runtime-off-${Date.now()}`)
    const runtimeReportDir = join(tempDir, ".wunderkind", "runtime", "prompt-optimization")
    const systemReportPath = join(runtimeReportDir, "system-transform.latest.json")
    const sessionReportPath = join(runtimeReportDir, "session-compacting.latest.json")
    const summaryEvents: TestMetadataEvent[] = []

    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    try {
      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
          promptOptimizationReportingMode: "persist",
        }),
      )

      await cachedTransform!(
        { modelId: "gpt-4.1" },
        { system: [], metadata: (input) => summaryEvents.push(input) },
      )
      await cachedCompaction!(
        { modelId: "gpt-4.1" },
        { context: [], metadata: (input) => summaryEvents.push(input) },
      )

      const persistedSystemJsonBeforeOff = readFileSync(systemReportPath, "utf-8")
      const persistedSessionJsonBeforeOff = readFileSync(sessionReportPath, "utf-8")

      summaryEvents.length = 0

      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
          promptOptimizationReportingMode: "off",
        }),
      )

      await cachedTransform!(
        { modelId: "github_pat_off_mode_should_not_overwrite" },
        { system: [], metadata: (input) => summaryEvents.push(input) },
      )
      await cachedCompaction!(
        { modelId: "github_pat_off_mode_should_not_overwrite" },
        { context: [], metadata: (input) => summaryEvents.push(input) },
      )

      expect(summaryEvents).toHaveLength(0)
      expect(existsSync(systemReportPath)).toBe(true)
      expect(existsSync(sessionReportPath)).toBe(true)
      expect(readFileSync(systemReportPath, "utf-8")).toBe(persistedSystemJsonBeforeOff)
      expect(readFileSync(sessionReportPath, "utf-8")).toBe(persistedSessionJsonBeforeOff)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("emits scalar-only summary metadata for both live hook paths only in summary mode", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-runtime-summary-${Date.now()}`)
    const runtimeReportDir = join(tempDir, ".wunderkind", "runtime", "prompt-optimization")
    const systemReportPath = join(runtimeReportDir, "system-transform.latest.json")
    const sessionReportPath = join(runtimeReportDir, "session-compacting.latest.json")
    const summaryEvents: TestMetadataEvent[] = []
    const safeModelId = "gpt-4.1"
    const seededSecretModelId = "sk-live-summary"

    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    try {
      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationTokenBudget: 1,
          promptOptimizationByteBudget: 1,
          promptOptimizationReportingMode: "summary",
        }),
      )

      await cachedTransform!(
        { modelId: safeModelId, model: safeModelId },
        { system: [], metadata: (input) => summaryEvents.push(input) },
      )
      await cachedCompaction!(
        { modelId: safeModelId, model: safeModelId },
        { context: [], metadata: (input) => summaryEvents.push(input) },
      )

      const persistedSystemReport = readRuntimeReport(systemReportPath)
      const persistedSessionReport = readRuntimeReport(sessionReportPath)
      const expectedSystemPublicPayload = buildPromptOptimizationRuntimePublicPayload(
        persistedSystemReport,
      )
      const expectedSessionPublicPayload = buildPromptOptimizationRuntimePublicPayload(
        persistedSessionReport,
      )

      expect(summaryEvents).toHaveLength(2)
      expect(persistedSystemReport).toEqual(expectedSystemPublicPayload.report)
      expect(persistedSessionReport).toEqual(expectedSessionPublicPayload.report)
      expect(summaryEvents[0]).toEqual({
        title: "Prompt optimization summary",
        metadata: expectedSystemPublicPayload.summaryMetadata,
      })
      expect(summaryEvents[1]).toEqual({
        title: "Prompt optimization summary",
        metadata: expectedSessionPublicPayload.summaryMetadata,
      })

      expect(persistedSystemReport.exactTokenDelta).not.toBe(null)
      expect(persistedSystemReport.exactTokenDelta?.savedTokens).toBeGreaterThan(0)
      expect(persistedSessionReport.exactTokenDelta).not.toBe(null)
      expect(persistedSessionReport.exactTokenDelta?.savedTokens).toBeGreaterThan(0)

      const summaryPayload = JSON.stringify(summaryEvents)
      const persistedSystemJson = readFileSync(systemReportPath, "utf-8")
      const persistedSessionJson = readFileSync(sessionReportPath, "utf-8")

      expect(persistedSystemReport.modelId).toBe(safeModelId)
      expect(persistedSessionReport.modelId).toBe(safeModelId)
      expect(Object.keys(summaryEvents[0]?.metadata ?? {})).toEqual([
        ...PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS,
      ])
      expect(Object.keys(summaryEvents[1]?.metadata ?? {})).toEqual([
        ...PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS,
      ])
      expect(summaryPayload).not.toContain("## Documentation Output")
      expect(summaryPayload).not.toContain("Preserve every active background task id")
      expect(summaryPayload).not.toContain("bg_")
      expect(summaryPayload).not.toContain("task")
      expect(summaryPayload).not.toContain("SOUL")
      expect(persistedSystemJson).not.toContain("## Documentation Output")
      expect(persistedSessionJson).not.toContain("Preserve every active background task id")
      expect(persistedSessionJson).not.toContain("bg_")
      expect(persistedSystemJson).not.toContain("SOUL")

      summaryEvents.length = 0

      await cachedTransform!(
        { modelId: seededSecretModelId, model: safeModelId },
        { system: [], metadata: (input) => summaryEvents.push(input) },
      )
      await cachedCompaction!(
        { modelId: seededSecretModelId, model: safeModelId },
        { context: [], metadata: (input) => summaryEvents.push(input) },
      )

      const redactedSystemReport = readRuntimeReport(systemReportPath)
      const redactedSessionReport = readRuntimeReport(sessionReportPath)
      const expectedRedactedSystemPublicPayload = buildPromptOptimizationRuntimePublicPayload(
        redactedSystemReport,
      )
      const expectedRedactedSessionPublicPayload = buildPromptOptimizationRuntimePublicPayload(
        redactedSessionReport,
      )
      const redactedSummaryPayload = JSON.stringify(summaryEvents)
      const redactedSystemJson = readFileSync(systemReportPath, "utf-8")
      const redactedSessionJson = readFileSync(sessionReportPath, "utf-8")

      expect(summaryEvents).toHaveLength(2)
      expect(redactedSystemReport).toEqual(expectedRedactedSystemPublicPayload.report)
      expect(redactedSessionReport).toEqual(expectedRedactedSessionPublicPayload.report)
      expect(redactedSystemReport.modelId).toBe("***")
      expect(redactedSessionReport.modelId).toBe("***")
      expect(summaryEvents[0]).toEqual({
        title: "Prompt optimization summary",
        metadata: expectedRedactedSystemPublicPayload.summaryMetadata,
      })
      expect(summaryEvents[1]).toEqual({
        title: "Prompt optimization summary",
        metadata: expectedRedactedSessionPublicPayload.summaryMetadata,
      })
      expect(Object.keys(summaryEvents[0]?.metadata ?? {})).toEqual([
        ...PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS,
      ])
      expect(Object.keys(summaryEvents[1]?.metadata ?? {})).toEqual([
        ...PROMPT_OPTIMIZATION_RUNTIME_SUMMARY_METADATA_FIELDS,
      ])
      expect(redactedSummaryPayload).not.toContain(seededSecretModelId)
      expect(redactedSystemJson).not.toContain(seededSecretModelId)
      expect(redactedSessionJson).not.toContain(seededSecretModelId)
      expect(redactedSystemJson).toContain('"modelId": "***"')
      expect(redactedSessionJson).toContain('"modelId": "***"')
      expect(redactedSummaryPayload).not.toContain('"modelId"')

      summaryEvents.length = 0
      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
          promptOptimizationReportingMode: "persist",
        }),
      )

      await cachedTransform!({}, { system: [], metadata: (input) => summaryEvents.push(input) })
      await cachedCompaction!({}, { context: [], metadata: (input) => summaryEvents.push(input) })

      expect(summaryEvents).toHaveLength(0)

      mockReadWunderkindConfig.mockImplementation(() =>
        createRuntimeReportingConfig({
          promptOptimizationMode: "active",
          promptOptimizationByteBudget: 1,
          promptOptimizationReportingMode: "off",
        }),
      )

      await cachedTransform!({}, { system: [], metadata: (input) => summaryEvents.push(input) })
      await cachedCompaction!({}, { context: [], metadata: (input) => summaryEvents.push(input) })

      expect(summaryEvents).toHaveLength(0)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("preserves the continuity floor text when active compaction trimming exhausts earlier content", async () => {
    registerConfigManagerMock()
    mockReadWunderkindConfig.mockImplementation(() => ({
      promptOptimizationEnabled: true,
      promptOptimizationMode: "active",
      promptOptimizationByteBudget: 1,
    }))
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const hook = pluginResult["experimental.session.compacting"]
    if (!hook) {
      throw new Error("Expected experimental.session.compacting hook")
    }

    const output = { context: [] as string[] }
    await hook({}, output)

    expect(output.context).toEqual([
      "Compaction continuity preserved. Earlier compaction context was removed only for byte budget.",
    ])
  })

  it("produces the frozen active runtime fixture result at the 1200-byte budget", () => {
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: {
        ...process.env,
        WUNDERKIND_TEST_ENGINE: "active",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
        WUNDERKIND_TEST_BYTE_BUDGET: "1200",
      },
      encoding: "utf8",
    })

    expect(helperRun.status).toBe(0)
    expect(helperRun.stdout.trim()).toBe(
      '{"modelId":null,"promptOptimizationMode":"active","countState":"unsupported","budgetBasis":"configured-bytes","trimBasis":"configured-bytes","eligibleSections":["runtime-docs-output","runtime-context","runtime-native-agents","compaction-continuity"],"beforeBytes":6606,"afterBytes":1116,"savedBytes":5490,"trimApplied":true,"trimExhausted":false,"trimmedSections":["runtime-native-agents","runtime-docs-output"]}',
    )
  })

  it("denies shell-based file mutation for non-fullstack retained agents", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const hook = pluginResult["permission.ask"]
    if (!hook) {
      throw new Error("Expected permission.ask hook")
    }

    const output = { status: "ask" as const }
    await hook(
      {
        type: "bash",
        pattern: "python script.py > docs/output.md",
        metadata: { agent: "product-wunderkind" },
      },
      output,
    )

    expect(output.status).toBe("deny")
  })

  it("does not deny shell access for fullstack-wunderkind through the retained-agent hook", async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const hook = pluginResult["permission.ask"]
    if (!hook) {
      throw new Error("Expected permission.ask hook")
    }

    const output = { status: "ask" as const }
    await hook(
      {
        type: "bash",
        pattern: "bun test tests/unit/",
        metadata: { agent: "fullstack-wunderkind" },
      },
      output,
    )

    expect(output.status).toBe("ask")
  })

  it("injects resolved runtime context with fallback labels for blank baseline fields", async () => {
    await initPromise
    mockReadWunderkindConfig.mockImplementation(() => ({
      region: "South Africa",
      industry: "",
      primaryRegulation: "",
      secondaryRegulation: "GDPR",
      teamCulture: "experimental-informal",
      orgStructure: "hierarchical",
    }))
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    const runtimeContextSection = output.system.find((entry) => entry.includes("## Wunderkind Resolved Runtime Context"))
    if (!runtimeContextSection) {
      throw new Error("Expected runtime context section")
    }

    expect(runtimeContextSection).toContain("- region: South Africa")
    expect(runtimeContextSection).toContain("- industry: (not set)")
    expect(runtimeContextSection).toContain("- primary regulation: (not set)")
    expect(runtimeContextSection).toContain("- secondary regulation: GDPR")
    expect(runtimeContextSection).toContain("- team culture: experimental-informal")
    expect(runtimeContextSection).toContain("- org structure: hierarchical")
  })

  it("does not inject runtime context when no Wunderkind config is available", async () => {
    await initPromise
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    expect(output.system.some((entry) => entry.includes("## Wunderkind Resolved Runtime Context"))).toBe(false)
  })

  it("injects a SOUL overlay for the detected retained persona when a project-local file exists", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-soul-${Date.now()}`)
    const soulsDir = join(tempDir, ".wunderkind", "souls")
    const soulContent = [
      "<!-- wunderkind:soul-file:v1 -->",
      "# Product Wunderkind SOUL",
      "",
      "- agentKey: product-wunderkind",
      "",
      "## Customization",
      "- Priority lens: Optimize for activation first.",
      "- Challenge style: Push back on weak evidence early.",
      "- Project memory: Filesystem-first planning is the norm.",
      "- Anti-goals: Avoid roadmap theater.",
      "",
      "## Durable Knowledge",
      "",
    ].join("\n")

    mkdirSync(soulsDir, { recursive: true })
    writeFileSync(join(soulsDir, "product-wunderkind.md"), soulContent, "utf-8")
    process.chdir(tempDir)

    const output: TestOutput = { system: ["# Product Wunderkind\nBase retained prompt"] }

    try {
      await cachedTransform!({}, output)
      const soulSection = output.system.find((entry) => entry.includes("## Wunderkind SOUL Overlay"))
      expect(soulSection).toBeDefined()
      expect(soulSection).toContain("<!-- wunderkind:soul-runtime-start:product-wunderkind -->")
      expect(soulSection).toContain(soulContent.trim())
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("skips SOUL injection when the persona sentinel is already present", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-soul-idempotent-${Date.now()}`)
    const soulsDir = join(tempDir, ".wunderkind", "souls")

    mkdirSync(soulsDir, { recursive: true })
    writeFileSync(join(soulsDir, "product-wunderkind.md"), "# Product Wunderkind SOUL\n", "utf-8")
    process.chdir(tempDir)

    const output: TestOutput = {
      system: [
        "# Product Wunderkind\nBase retained prompt",
        "<!-- wunderkind:soul-runtime-start:product-wunderkind -->\n## Wunderkind SOUL Overlay\n\nAlready injected",
      ],
    }

    try {
      await cachedTransform!({}, output)
      expect(output.system.filter((entry) => entry.includes("<!-- wunderkind:soul-runtime-start:product-wunderkind -->")).length).toBe(1)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("skips SOUL overlay when the soul file exists but is empty or whitespace-only", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-soul-empty-${Date.now()}`)
    const soulsDir = join(tempDir, ".wunderkind", "souls")
    mkdirSync(soulsDir, { recursive: true })
    writeFileSync(join(soulsDir, "product-wunderkind.md"), "   \n  \n", "utf-8")
    process.chdir(tempDir)
    const output: TestOutput = { system: ["# Product Wunderkind\nBase retained prompt"] }
    try {
      await cachedTransform!({}, output)
      expect(output.system.some((s) => s.includes("## Wunderkind SOUL Overlay"))).toBe(false)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("skips docs injection when the docs sentinel is already present", async () => {
    await initPromise
    mockReadWunderkindConfig.mockImplementation(() => ({
      docsEnabled: true,
      docsPath: "./docs/output",
      docHistoryMode: "append-dated",
    }))
    const output: TestOutput = {
      system: [
        `${DOCS_OUTPUT_SENTINEL}\n## Documentation Output\n\nAlready injected`,
      ],
    }

    await cachedTransform!({}, output)

    expect(output.system.filter((entry) => entry.includes(DOCS_OUTPUT_SENTINEL)).length).toBe(1)
    expect(output.system.filter((entry) => entry.includes("## Documentation Output")).length).toBe(1)
    expect(output.system.some((entry) => entry.includes("./docs/output") && entry.includes("append-dated"))).toBe(false)
  })

  it("skips SOUL overlay when the soul file does not exist on disk", async () => {
    await initPromise
    const tempDir = join(tmpdir(), `wunderkind-soul-missing-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)

    const output: TestOutput = { system: ["# Product Wunderkind\nBase retained prompt"] }

    try {
      await cachedTransform!({}, output)
      expect(output.system.some((s) => s.includes("## Wunderkind SOUL Overlay"))).toBe(false)
    } finally {
      process.chdir(ORIGINAL_CWD)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
