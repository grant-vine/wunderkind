import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { DetectedConfig, InstallConfig } from "../../src/cli/types.js"
import type { GitHubWorkflowReadiness } from "../../src/cli/config-manager/index.js"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"
import type { StitchPresence } from "../../src/cli/mcp-helpers.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href

const mockText = mock(async () => "")
const mockSelect = mock(async () => "")
const mockConfirm = mock(async () => false)
const mockMultiselect = mock(async () => [] as string[])
const mockPassword = mock(async () => "")
const mockIsCancel = mock(() => false)

const DEFAULT_DETECTED_CONFIG: DetectedConfig = {
  isInstalled: true,
  scope: "global" as const,
  projectInstalled: false,
  globalInstalled: true,
  registrationScope: "global" as const,
  projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
  globalOpenCodeConfigPath: "/tmp/opencode.json",
  region: "Global",
  industry: "",
  primaryRegulation: "",
  secondaryRegulation: "",
  teamCulture: "pragmatic-balanced" as const,
  orgStructure: "flat" as const,
  cisoPersonality: "pragmatic-risk-manager" as const,
  ctoPersonality: "code-archaeologist" as const,
  cmoPersonality: "data-driven" as const,
  productPersonality: "outcome-obsessed" as const,
  creativePersonality: "pragmatic-problem-solver" as const,
  legalPersonality: "pragmatic-advisor" as const,
  docsEnabled: false,
  docsPath: "./docs",
  docHistoryMode: "append-dated" as const,
  prdPipelineMode: "filesystem" as const,
  designTool: "none" as const,
  designPath: "./DESIGN.md",
  designMcpOwnership: "none" as const,
}

mock.module("@clack/prompts", () => ({
  text: mockText,
  select: mockSelect,
  confirm: mockConfirm,
  multiselect: mockMultiselect,
  password: mockPassword,
  isCancel: mockIsCancel,
}))

const mockDetectCurrentConfig = mock(() => DEFAULT_DETECTED_CONFIG)
const mockReadWunderkindConfig = mock<() => Partial<InstallConfig> | null>(() => null)

const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json" }))
const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockReadWunderkindConfigForScope = mock(() => null)
const mockReadGlobalWunderkindConfig = mock(() => null)
const mockReadProjectWunderkindConfig = mock(() => null)
const mockDetectGitHubWorkflowReadiness = mock<(cwd: string) => GitHubWorkflowReadiness>(() => ({
  isGitRepo: true,
  hasGitHubRemote: true,
  ghInstalled: true,
  authVerified: true,
  authCheckAttempted: true,
}))
const mockDetectStitchMcpPresence = mock<(_projectPath?: string) => Promise<StitchPresence>>(async () => "missing")
const mockMergeStitchMcpConfig = mock<(projectPath: string) => Promise<void>>(async (projectPath) => {
  const configPath = join(projectPath, "opencode.json")
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(
    configPath,
    `${JSON.stringify({
      $schema: "https://opencode.ai/config.json",
      mcp: {
        [GOOGLE_STITCH_ADAPTER.serverName]: GOOGLE_STITCH_ADAPTER.getOpenCodePayload(false),
      },
    }, null, 2)}\n`,
  )
})
const mockWriteStitchSecretFile = mock<(apiKey: string, cwd: string) => Promise<void>>(async (apiKey, cwd) => {
  const secretPath = join(cwd, GOOGLE_STITCH_ADAPTER.secretFilePath)
  mkdirSync(dirname(secretPath), { recursive: true })
  writeFileSync(secretPath, apiKey.trim())
})

const configManagerMockFactory = () => ({
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  detectCurrentConfig: mockDetectCurrentConfig,
  detectLegacyConfig: mockDetectLegacyConfig,
  detectGitHubWorkflowReadiness: mockDetectGitHubWorkflowReadiness,
  readWunderkindConfig: mockReadWunderkindConfig,
  readGlobalWunderkindConfig: mockReadGlobalWunderkindConfig,
  readProjectWunderkindConfig: mockReadProjectWunderkindConfig,
  readWunderkindConfigForScope: mockReadWunderkindConfigForScope,
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
  detectNativeAgentFiles: () => ({ dir: "/tmp/mock-agents", presentCount: 0, totalCount: 0, allPresent: false }),
  detectNativeCommandFiles: () => ({ dir: "/tmp/mock-commands", presentCount: 0, totalCount: 0, allPresent: false }),
  detectNativeSkillFiles: () => ({ dir: "/tmp/mock-skills", presentCount: 0, totalCount: 0, allPresent: false }),
  getNativeCommandFilePaths: () => [],
  detectOmoVersionInfo: () => ({
    packageName: "oh-my-openagent",
    currentVersion: null,
    registeredEntry: null,
    registeredVersion: null,
    loadedVersion: null,
    configPath: null,
    loadedPackagePath: null,
    registered: false,
    loadedSources: {
      global: { version: null, packagePath: null },
      cache: { version: null, packagePath: null },
    },
    staleOverrideWarning: null,
    freshness: null,
  }),
  detectWunderkindVersionInfo: () => ({
    packageName: "@grant-vine/wunderkind",
    currentVersion: null,
    registeredEntry: null,
    registeredVersion: null,
    loadedVersion: null,
    configPath: null,
    loadedPackagePath: null,
    registered: false,
    staleOverrideWarning: null,
  }),
  getProjectOverrideMarker: () => ({ marker: "○" as const, sourceLabel: "inherited default" as const }),
  getDefaultGlobalConfig: () => ({ region: "Global", industry: "", primaryRegulation: "", secondaryRegulation: "" }),
  resolveOpenCodeConfigPath: () => ({ path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const }),
})

mock.module("../../src/cli/config-manager/index.js", configManagerMockFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, configManagerMockFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, configManagerMockFactory)
mock.module(CONFIG_MANAGER_JS_URL, configManagerMockFactory)
mock.module(CONFIG_MANAGER_TS_URL, configManagerMockFactory)

mock.module("../../src/cli/mcp-helpers.js", () => ({
  detectStitchMcpPresence: mockDetectStitchMcpPresence,
  mergeStitchMcpConfig: mockMergeStitchMcpConfig,
  writeStitchSecretFile: mockWriteStitchSecretFile,
}))

import { runInit } from "../../src/cli/init.js"

describe("runInit interactive SOUL prompts", () => {
  beforeEach(() => {
    mockText.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockMultiselect.mockClear()
    mockPassword.mockClear()
    mockIsCancel.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockDetectGitHubWorkflowReadiness.mockClear()
    mockDetectCurrentConfig.mockClear()
    mockReadWunderkindConfig.mockClear()
    mockDetectStitchMcpPresence.mockClear()
    mockMergeStitchMcpConfig.mockClear()
    mockWriteStitchSecretFile.mockClear()
    mockDetectCurrentConfig.mockImplementation(() => DEFAULT_DETECTED_CONFIG)
    mockReadWunderkindConfig.mockImplementation(() => null)
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: true,
      hasGitHubRemote: true,
      ghInstalled: true,
      authVerified: true,
      authCheckAttempted: true,
    }))
    mockConfirm.mockImplementation(async () => false)
    mockMultiselect.mockImplementation(async () => [])
    mockPassword.mockImplementation(async () => "")
    mockDetectStitchMcpPresence.mockImplementation(async () => "missing")
  })

  it("creates a retained persona SOUL file when customization is enabled", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [true, false, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockMultiselect.mockImplementation(async () => ["product-wunderkind"])

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "Optimize for measurable business outcomes and adoption first.",
      "Push back clearly when scope or priorities are not justified.",
        "Remember that thin vertical slices and fast validation matter here.",
        "Avoid roadmap theater, speculative scope, and big-bang planning.",
        "filesystem",
        "no",
      ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    const messages: string[] = []
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runInit({})
      expect(code).toBe(0)
      expect(mockSelect).toHaveBeenCalledTimes(10)
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockMultiselect).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.region).toBe("EU")
      expect(installConfig.industry).toBe("SaaS")
      expect(installConfig.primaryRegulation).toBe("GDPR")
      expect(installConfig.secondaryRegulation).toBe("POPIA")
      expect(installConfig.teamCulture).toBe("formal-strict")
      expect(installConfig.orgStructure).toBe("hierarchical")
      expect(installConfig.docsEnabled).toBe(false)
      expect(installConfig.prdPipelineMode).toBe("filesystem")

      const soulPath = join(tempProject, ".wunderkind", "souls", "product-wunderkind.md")
      expect(existsSync(soulPath)).toBe(true)
      const soulFile = readFileSync(soulPath, "utf-8")
      expect(soulFile).toContain("<!-- wunderkind:soul-file:v1 -->")
      expect(soulFile).toContain("# Product Wunderkind SOUL")
      expect(soulFile).toContain("- agentKey: product-wunderkind")
      expect(soulFile).toContain("- Priority lens: Optimize for measurable business outcomes and adoption first.")
      expect(soulFile).toContain("- Challenge style: Push back clearly when scope or priorities are not justified.")
      expect(soulFile).toContain("- Project memory: Remember that thin vertical slices and fast validation matter here.")
      expect(soulFile).toContain("- Anti-goals: Avoid roadmap theater, speculative scope, and big-bang planning.")
      expect(soulFile).toContain("## Durable Knowledge")
      expect(messages.some((message) => message.includes("PRODUCT WUNDERKIND"))).toBe(true)
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("offers select-based SOUL answers with a custom fallback option", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS", "Optimize for partner-led expansion first."]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [true, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockMultiselect.mockImplementation(async () => ["product-wunderkind"])

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "__custom__",
      "Push back clearly when scope or priorities are not justified.",
      "Remember that prioritization should stay tied to measurable outcomes and evidence.",
      "Avoid treating stakeholder requests as automatic priorities.",
      "filesystem",
      "no",
    ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)

      const firstSoulSelectCall = mockSelect.mock.calls[4]?.[0] as { options?: Array<{ value: string; label: string }> }
      expect(firstSoulSelectCall.options?.some((option) => option.label === "Enter your own answer")).toBe(true)

      const soulPath = join(tempProject, ".wunderkind", "souls", "product-wunderkind.md")
      expect(readFileSync(soulPath, "utf-8")).toContain("- Priority lens: Optimize for partner-led expansion first.")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("hydrates existing soul answers when re-running init on a configured project", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [true, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockMultiselect.mockImplementation(async () => ["product-wunderkind"])

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "Optimize for user value and problem clarity first.",
      "Push back clearly when scope or priorities are not justified.",
      "Remember that user pain, onboarding friction, and support signals matter here.",
      "Avoid treating stakeholder requests as automatic priorities.",
      "filesystem",
      "no",
    ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    const soulsDir = join(tempProject, ".wunderkind", "souls")
    writeFileSync(join(tempProject, "package.json"), "{}")
    mkdirSync(soulsDir, { recursive: true })
    process.chdir(tempProject)
    console.log = () => {}

    try {
      writeFileSync(
        join(tempProject, ".wunderkind", "souls", "product-wunderkind.md"),
        [
          "<!-- wunderkind:soul-file:v1 -->",
          "# Product Wunderkind SOUL",
          "",
          "- agentKey: product-wunderkind",
          "",
          "## Customization",
          "- Priority lens: Optimize for measurable business outcomes and adoption first.",
          "- Challenge style: Push back clearly when scope or priorities are not justified.",
          "- Project memory: Remember that prioritization should stay tied to measurable outcomes and evidence.",
          "- Anti-goals: Avoid treating stakeholder requests as automatic priorities.",
          "",
          "## Durable Knowledge",
          "",
        ].join("\n"),
      )

      const code = await runInit({})
      expect(code).toBe(0)

      const soulConfirmCall = mockConfirm.mock.calls[0]?.[0] as { initialValue?: boolean }
      expect(soulConfirmCall.initialValue).toBe(true)

      const soulMultiselectCall = mockMultiselect.mock.calls[0]?.[0] as { initialValues?: string[] }
      expect(soulMultiselectCall.initialValues).toEqual(["product-wunderkind"])

      const firstSoulSelectCall = mockSelect.mock.calls[4]?.[0] as { initialValue?: string }
      expect(firstSoulSelectCall.initialValue).toBe("Optimize for measurable business outcomes and adoption first.")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("skips SOUL creation when customization is declined and keeps retained personalities", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    mockDetectCurrentConfig.mockImplementation(() => ({
      ...DEFAULT_DETECTED_CONFIG,
      region: "North America",
      industry: "Marketplace",
      primaryRegulation: "CCPA",
      secondaryRegulation: "SOC2",
      cisoPersonality: "educator-collaborator" as const,
      ctoPersonality: "startup-bro" as const,
      cmoPersonality: "growth-hacker" as const,
      productPersonality: "velocity-optimizer" as const,
      creativePersonality: "bold-provocateur" as const,
      legalPersonality: "plain-english-counselor" as const,
    }))

    const confirmAnswers = [false, false, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    const textAnswers = ["North America", "Marketplace"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const selectAnswers = ["CCPA", "SOC2", "formal-strict", "hierarchical", "filesystem", "no"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockSelect).toHaveBeenCalledTimes(6)
      expect(mockMultiselect).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.region).toBe("North America")
      expect(installConfig.industry).toBe("Marketplace")
      expect(installConfig.primaryRegulation).toBe("CCPA")
      expect(installConfig.secondaryRegulation).toBe("SOC2")
      expect(installConfig.teamCulture).toBe("formal-strict")
      expect(installConfig.orgStructure).toBe("hierarchical")
      expect(installConfig.cisoPersonality).toBe("educator-collaborator")
      expect(installConfig.ctoPersonality).toBe("startup-bro")
      expect(installConfig.legalPersonality).toBe("plain-english-counselor")
      expect(installConfig.prdPipelineMode).toBe("filesystem")
      expect(existsSync(join(tempProject, ".wunderkind", "souls"))).toBe(false)
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("selects docs history mode via select when docs are enabled", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["United Kingdom", "HealthTech", "./my-docs"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")
    const confirmAnswers = [false, true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)

    const selectAnswers = ["GDPR", "ISO27001", "formal-strict", "hierarchical", "github", "append-dated", "no"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)
      expect(mockSelect).toHaveBeenCalledTimes(7)
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockMultiselect).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.region).toBe("United Kingdom")
      expect(installConfig.industry).toBe("HealthTech")
      expect(installConfig.primaryRegulation).toBe("GDPR")
      expect(installConfig.secondaryRegulation).toBe("ISO27001")
      expect(installConfig.docsEnabled).toBe(true)
      expect(installConfig.docHistoryMode).toBe("append-dated")
      expect(installConfig.prdPipelineMode).toBe("github")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("hydrates early prompt defaults from persisted merged config values", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    mockReadWunderkindConfig.mockImplementation(() => ({
      region: "Project Region",
      industry: "FinTech",
      primaryRegulation: "POPIA",
      secondaryRegulation: "SOC2",
      teamCulture: "formal-strict",
      orgStructure: "hierarchical",
      docsEnabled: true,
      docsPath: "./persisted-docs",
      docHistoryMode: "overwrite-archive",
      prdPipelineMode: "github",
      designPath: "./designs/brief.md",
    }))

    const textAnswers = ["Project Region", "FinTech", "./persisted-docs"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")
    const confirmAnswers = [false, true, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    const selectAnswers = ["POPIA", "SOC2", "formal-strict", "hierarchical", "github", "overwrite-archive", "no"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)

      expect((mockText.mock.calls[0]?.[0] as { initialValue?: string }).initialValue).toBe("Project Region")
      expect((mockText.mock.calls[1]?.[0] as { initialValue?: string }).initialValue).toBe("FinTech")
      expect((mockConfirm.mock.calls[1]?.[0] as { initialValue?: boolean }).initialValue).toBe(true)
      expect((mockSelect.mock.calls[4]?.[0] as { initialValue?: string }).initialValue).toBe("github")
      expect((mockText.mock.calls[2]?.[0] as { initialValue?: string }).initialValue).toBe("./persisted-docs")
      expect((mockSelect.mock.calls[5]?.[0] as { initialValue?: string }).initialValue).toBe("overwrite-archive")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("docs path validate callback rejects invalid paths and accepts valid ones", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["Australia", "eCommerce"]
    const docsPathValidateResults: (string | undefined)[] = []
    mockText.mockImplementation(async (opts?: { validate?: (v: string) => string | undefined }) => {
      if (opts?.validate) {
        docsPathValidateResults.push(opts.validate("../outside"))
        docsPathValidateResults.push(opts.validate("./DESIGN.md/subdir"))
        docsPathValidateResults.push(opts.validate("./linked-docs"))
        docsPathValidateResults.push(opts.validate("./valid-docs"))
        return "./valid-docs"
      }
      return textAnswers.shift() ?? ""
    })

    const confirmAnswers = [false, true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)

    const selectAnswers = ["GDPR", "", "pragmatic-balanced", "flat", "filesystem", "append-dated", "no"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    mkdirSync(join(tempProject, "real-docs"), { recursive: true })
    symlinkSync(join(tempProject, "real-docs"), join(tempProject, "linked-docs"), "dir")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)

      expect(docsPathValidateResults[0]).toBeDefined()
      expect(typeof docsPathValidateResults[0]).toBe("string")
      expect(docsPathValidateResults[1]).toContain("DESIGN.md is reserved for design-md")
      expect(docsPathValidateResults[2]).toContain("docs-output lane must not include symlinked segments")
      expect(docsPathValidateResults[3]).toBeUndefined()

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.docsEnabled).toBe(true)
      expect(installConfig.docsPath).toBe("./valid-docs")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("supports manual regulation entry for project-local baseline overrides", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["LATAM", "FinTech", "PCI DSS", "SOX"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [false, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    const selectAnswers = ["__other__", "__other__", "pragmatic-balanced", "flat", "filesystem", "no"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.region).toBe("LATAM")
      expect(installConfig.industry).toBe("FinTech")
      expect(installConfig.primaryRegulation).toBe("PCI DSS")
      expect(installConfig.secondaryRegulation).toBe("SOX")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("returns 1 when SOUL customization is enabled but no persona is selected", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [true, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockMultiselect.mockImplementation(async () => [])

    const selectAnswers = ["GDPR", "POPIA", "formal-strict", "hierarchical"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const restoreError = console.error
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    const errors: string[] = []
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runInit({})
      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("at least one retained persona"))).toBe(true)
    } finally {
      console.log = restoreLog
      console.error = restoreError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("creates project-local Stitch config with blank masked password input", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS", "./DESIGN.md"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [false, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockPassword.mockImplementation(async () => "")

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "filesystem",
      "yes",
      "google-stitch",
      "project-local",
    ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)
      expect(mockPassword).toHaveBeenCalledTimes(1)
      expect(existsSync(join(tempProject, "opencode.json"))).toBe(true)
      expect(existsSync(join(tempProject, GOOGLE_STITCH_ADAPTER.secretFilePath))).toBe(false)
      expect(existsSync(join(tempProject, "DESIGN.md"))).toBe(true)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designTool).toBe("google-stitch")
      expect(writtenConfig.designPath).toBe("./DESIGN.md")
      expect(writtenConfig.designMcpOwnership).toBe("wunderkind-managed")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("reuses global Stitch config without creating a project-local MCP entry", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS", "./DESIGN.md"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [false, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockDetectStitchMcpPresence.mockImplementation(async () => "global-only")

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "filesystem",
      "yes",
      "google-stitch",
      "reuse",
    ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(0)
      expect(existsSync(join(tempProject, "opencode.json"))).toBe(false)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designMcpOwnership).toBe("reused-global")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("supports skipping interactive Stitch setup without MCP changes", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["EU", "SaaS", "./DESIGN.md"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [false, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "filesystem",
      "yes",
      "google-stitch",
      "skip",
    ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(0)
      expect(existsSync(join(tempProject, "opencode.json"))).toBe(false)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designMcpOwnership).toBe("none")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("rehydrates existing design workflow defaults on rerun", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    mockReadWunderkindConfig.mockImplementation(() => ({
      designTool: "google-stitch",
      designPath: "./design/system/DESIGN.md",
      designMcpOwnership: "reused-project",
      docsEnabled: true,
      docsPath: "./docs-output",
      docHistoryMode: "append-dated",
    }))

    const textAnswers = ["EU", "SaaS", "./docs-output", ""]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [false, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockDetectStitchMcpPresence.mockImplementation(async () => "project-local")

    const selectAnswers = [
      "GDPR",
      "POPIA",
      "formal-strict",
      "hierarchical",
      "filesystem",
      "append-dated",
      "yes",
      "google-stitch",
      "reuse",
    ]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "")

    const restoreLog = console.log
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-interactive-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}

    try {
      const code = await runInit({})
      expect(code).toBe(0)

      const enableDesignWorkflowCall = mockSelect.mock.calls[6]?.[0] as { initialValue?: string }
      expect(enableDesignWorkflowCall.initialValue).toBe("yes")

      const designToolCall = mockSelect.mock.calls[7]?.[0] as { initialValue?: string }
      expect(designToolCall.initialValue).toBe("google-stitch")

      const stitchSetupCall = mockSelect.mock.calls[8]?.[0] as { initialValue?: string }
      expect(stitchSetupCall.initialValue).toBe("reuse")

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designTool).toBe("google-stitch")
      expect(writtenConfig.designPath).toBe("./design/system/DESIGN.md")
      expect(writtenConfig.designMcpOwnership).toBe("reused-project")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })
})
