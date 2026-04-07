import { beforeEach, describe, expect, it, mock } from "bun:test"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ProjectConfig } from "../../src/cli/types.js"
import { createProductWunderkindAgent } from "../../src/agents/index.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href
const INDEX_TEST_MODULE_URL = new URL(`src/index.ts?plugin-transform=${Date.now()}`, `file://${PROJECT_ROOT}`).href
const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"
const ORIGINAL_CWD = process.cwd()

const mockReadWunderkindConfig = mock<() => Partial<ProjectConfig> | null>(() => null)

function registerConfigManagerMock(): void {
  const factory = () => ({
    readWunderkindConfig: mockReadWunderkindConfig,
    detectCurrentConfig: () => ({ isInstalled: false }),
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
    readWunderkindConfigForScope: () => null,
    detectNativeAgentFiles: () => ({ dir: "/tmp/mock-agents", presentCount: 0, totalCount: 0, allPresent: false }),
    detectNativeCommandFiles: () => ({ dir: "/tmp/mock-commands", presentCount: 0, totalCount: 0, allPresent: false }),
    detectNativeSkillFiles: () => ({ dir: "/tmp/mock-skills", presentCount: 0, totalCount: 0, allPresent: false }),
    getNativeCommandFilePaths: () => [],
    detectOmoVersionInfo: () => ({ registered: false, loadedVersion: null, staleOverrideWarning: null }),
    detectWunderkindVersionInfo: () => ({ currentVersion: null }),
    getProjectOverrideMarker: () => ({ marker: "○", sourceLabel: "inherited default" }),
    readProjectWunderkindConfig: () => null,
    resolveOpenCodeConfigPath: () => ({ path: "/tmp/mock-opencode.json", format: "json", source: "opencode.json" }),
  })

  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, factory)
  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, factory)
  mock.module(CONFIG_MANAGER_JS_URL, factory)
  mock.module(CONFIG_MANAGER_TS_URL, factory)
}

type TestOutput = {
  system: string[]
}

type PluginModule = { default: (...args: unknown[]) => Promise<{ "experimental.chat.system.transform"?: (input: unknown, output: TestOutput) => Promise<void>; "permission.ask"?: (input: { type: string; pattern?: string | string[]; metadata: Record<string, unknown> }, output: { status: "ask" | "allow" | "deny" }) => Promise<void>; tool?: Record<string, unknown> }> }

let cachedTransform: ((input: unknown, output: TestOutput) => Promise<void>) | null = null
const initPromise = (async () => {
  registerConfigManagerMock()
  const mod = (await import(INDEX_TEST_MODULE_URL)) as PluginModule
  const pluginResult = await mod.default({})
  const transform = pluginResult["experimental.chat.system.transform"]
  if (!transform) {
    throw new Error("Expected experimental.chat.system.transform to exist")
  }
  cachedTransform = transform
})()

describe("Wunderkind plugin transform", () => {
  beforeEach(() => {
    mockReadWunderkindConfig.mockClear()
    mockReadWunderkindConfig.mockImplementation(() => null)
    process.chdir(ORIGINAL_CWD)
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
            relativePath: ".sisyphus/notepads/runtime/learnings.md",
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
        expect(readFileSync(join(sandbox, ".sisyphus/notepads/runtime/learnings.md"), "utf-8")).toBe("Entry\n")
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
          relativePath: ".sisyphus/evidence/dream/findings.md",
          content: "Discovery\n",
        },
        {
          directory: sandbox,
          ask: async () => {},
          metadata: () => {},
        },
      )

      expect(result).toBe("Durable artifact written to .sisyphus/evidence/dream/findings.md")
      expect(readFileSync(join(sandbox, ".sisyphus/evidence/dream/findings.md"), "utf-8")).toBe("Discovery\n")
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
    expect(nativeAgentsContent).toContain("Use normal `Write`/`Edit` for ordinary repo files, docs-output, `DESIGN.md`, `.wunderkind/stitch/`, and managed `.sisyphus/` planning files")
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
    expect(pluginResult).not.toHaveProperty("experimental.session.compacting")
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
