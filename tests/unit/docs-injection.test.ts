import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"
import type { ProjectConfig } from "../../src/cli/types.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"

const mockReadWunderkindConfig = mock<() => Partial<ProjectConfig> | null>(() => null)

function registerConfigManagerMock(): void {
  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, () => ({
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
    detectOmoVersionInfo: () => ({ registered: false, loadedVersion: null, staleOverrideWarning: null }),
    detectWunderkindVersionInfo: () => ({ currentVersion: null }),
    getProjectOverrideMarker: () => ({ marker: "○", sourceLabel: "inherited default" }),
    readProjectWunderkindConfig: () => null,
    resolveOpenCodeConfigPath: () => ({ path: "/tmp/mock-opencode.json", format: "json", source: "opencode.json" }),
  }))
}

type TestOutput = {
  system: string[]
}

function hasDocsSection(system: string[]): boolean {
  return system.some((entry) => entry.includes("## Documentation Output"))
}

function countSentinel(system: string[]): number {
  return system.reduce((count, entry) => count + (entry.includes(DOCS_OUTPUT_SENTINEL) ? 1 : 0), 0)
}

type PluginModule = { default: (...args: unknown[]) => Promise<{ "experimental.chat.system.transform"?: (input: unknown, output: TestOutput) => Promise<void> }> }

let cachedTransform: ((input: unknown, output: TestOutput) => Promise<void>) | null = null

describe("runtime docs-output system injection", () => {
  beforeAll(async () => {
    registerConfigManagerMock()
    const mod = (await import(new URL("src/index.ts", `file://${PROJECT_ROOT}`).href)) as PluginModule
    const pluginResult = await mod.default({})
    const transform = pluginResult["experimental.chat.system.transform"]
    if (!transform) {
      throw new Error("Expected experimental.chat.system.transform to exist")
    }
    cachedTransform = transform
  })

  beforeEach(() => {
    mockReadWunderkindConfig.mockClear()
    mockReadWunderkindConfig.mockImplementation(() => null)
  })

  it("does not inject docs section when docsEnabled is false", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({ docsEnabled: false }))
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    expect(hasDocsSection(output.system)).toBe(false)
    expect(countSentinel(output.system)).toBe(0)
  })

  it("injects docs section with UTC timestamp contract and history mode semantics", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({
      docsEnabled: true,
      docsPath: "./docs/output",
      docHistoryMode: "append-dated",
    }))
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    expect(hasDocsSection(output.system)).toBe(true)
    expect(output.system.some((entry) => entry.includes(DOCS_OUTPUT_SENTINEL))).toBe(true)
    expect(output.system.some((entry) => entry.includes("./docs/output"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("append-dated"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("Eligible Wunderkind docs targets:"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("docs scope: current project root only"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("managed home files"))).toBe(true)
    
    // Assert presence of UTC timestamp contract wording
    const docsContent = output.system.find((entry) => entry.includes("## Documentation Output")) ?? ""
    expect(docsContent).toMatch(/shared UTC timestamp contract/i)
    expect(docsContent).toMatch(/YYYY-MM-DDTHH-mm-ssZ/i)
    expect(docsContent).toMatch(/2026-03-12T18-37-52Z/)
    expect(docsContent).toMatch(/## Update <UTC_TOKEN>/)
    expect(docsContent).toMatch(/## Update <UTC_TOKEN> \(2\)/)
    expect(docsContent).toMatch(/<basename>--<UTC_TOKEN>\.md/)
    expect(docsContent).toMatch(/<basename>--<UTC_TOKEN>--2\.md/)
    expect(docsContent).toMatch(/managed family members/)
    
    // Assert absence of vague wording
    expect(docsContent).not.toMatch(/refresh or bootstrap/)
    expect(docsContent).not.toMatch(/explicit completion result/)
  })

  it("does not duplicate docs section when transform runs twice", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({
      docsEnabled: true,
      docsPath: "./docs",
      docHistoryMode: "overwrite",
    }))
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)
    await cachedTransform!({}, output)

    expect(countSentinel(output.system)).toBe(1)
    expect(output.system.filter((entry) => entry.includes("## Documentation Output")).length).toBe(1)
  })

  it("does not inject docs section when config is null", async () => {
    mockReadWunderkindConfig.mockImplementation(() => null)
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    expect(hasDocsSection(output.system)).toBe(false)
    expect(countSentinel(output.system)).toBe(0)
  })

  it("does not inject docs section for an uninitialized project even if runtime has packaged defaults", async () => {
    mockReadWunderkindConfig.mockImplementation(() => null)
    const output: TestOutput = { system: [] }

    await cachedTransform!({}, output)

    expect(hasDocsSection(output.system)).toBe(false)
    expect(countSentinel(output.system)).toBe(0)
  })
})
