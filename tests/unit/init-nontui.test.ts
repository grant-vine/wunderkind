import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { GitHubWorkflowReadiness } from "../../src/cli/config-manager/index.js"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"
import type { StitchPresence } from "../../src/cli/mcp-helpers.js"
import type { DetectedConfig, InstallConfig } from "../../src/cli/types.js"

function makeDetectedConfig(overrides: Partial<DetectedConfig> = {}): DetectedConfig {
  return {
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
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock<() => DetectedConfig>(() => makeDetectedConfig())
const mockReadWunderkindConfig = mock<() => Partial<InstallConfig> | null>(() => null)
const mockDetectGitHubWorkflowReadiness = mock<(cwd: string) => GitHubWorkflowReadiness>(() => ({
  isGitRepo: true,
  hasGitHubRemote: true,
  ghInstalled: true,
  authVerified: true,
  authCheckAttempted: true,
}))
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
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

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectGitHubWorkflowReadiness: mockDetectGitHubWorkflowReadiness,
  readWunderkindConfig: mockReadWunderkindConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
}))

mock.module("../../src/cli/mcp-helpers.js", () => ({
  detectStitchMcpPresence: mockDetectStitchMcpPresence,
  mergeStitchMcpConfig: mockMergeStitchMcpConfig,
  writeStitchSecretFile: mockWriteStitchSecretFile,
}))

import { runInit } from "../../src/cli/init.js"

describe("runInit non-interactive branching", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectGitHubWorkflowReadiness.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockReadWunderkindConfig.mockClear()
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
    mockReadWunderkindConfig.mockImplementation(() => null)
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: true,
      hasGitHubRemote: true,
      ghInstalled: true,
      authVerified: true,
      authCheckAttempted: true,
    }))
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-agents" }))
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands" }))
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-skills" }))
    mockDetectStitchMcpPresence.mockClear()
    mockMergeStitchMcpConfig.mockClear()
    mockWriteStitchSecretFile.mockClear()
    mockDetectStitchMcpPresence.mockImplementation(async () => "missing")
  })

  it("creates a project-local Stitch MCP config for google-stitch init", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "google-stitch",
        stitchSetup: "project-local",
      })

      expect(code).toBe(0)
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(1)

      const projectOpenCode = JSON.parse(readFileSync(join(tempProject, "opencode.json"), "utf-8")) as {
        mcp?: Record<string, unknown>
      }
      expect(projectOpenCode.mcp?.[GOOGLE_STITCH_ADAPTER.serverName]).toEqual(
        GOOGLE_STITCH_ADAPTER.getOpenCodePayload(false),
      )

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designTool).toBe("google-stitch")
      expect(writtenConfig.designPath).toBe("./DESIGN.md")
      expect(writtenConfig.designMcpOwnership).toBe("wunderkind-managed")
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("writes a trimmed Stitch API key file when a key file is provided", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const apiKeyFile = join(tempProject, "stitch-key.txt")

    writeFileSync(join(tempProject, "package.json"), "{}")
    writeFileSync(apiKeyFile, "  stitched-secret  \n")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "google-stitch",
        stitchSetup: "project-local",
        stitchApiKeyFile: apiKeyFile,
      })

      expect(code).toBe(0)
      expect(readFileSync(join(tempProject, GOOGLE_STITCH_ADAPTER.secretFilePath), "utf-8")).toBe("stitched-secret")
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("allows project-local Stitch setup without writing a secret file", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "google-stitch",
        stitchSetup: "project-local",
      })

      expect(code).toBe(0)
      expect(existsSync(join(tempProject, GOOGLE_STITCH_ADAPTER.secretFilePath))).toBe(false)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("bootstraps DESIGN.md at the default path for google-stitch init", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "google-stitch",
        stitchSetup: "project-local",
      })

      expect(code).toBe(0)
      expect(existsSync(join(tempProject, "DESIGN.md"))).toBe(true)
      expect(readFileSync(join(tempProject, "DESIGN.md"), "utf-8")).toContain("## Overview")
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("reuses global Stitch config without writing a project-local MCP entry", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectStitchMcpPresence.mockImplementation(async () => "global-only")
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "google-stitch",
        stitchSetup: "reuse",
      })

      expect(code).toBe(0)
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(0)
      expect(existsSync(join(tempProject, "opencode.json"))).toBe(false)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designMcpOwnership).toBe("reused-global")
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("supports skipping Stitch setup while persisting no ownership", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "google-stitch",
        stitchSetup: "skip",
      })

      expect(code).toBe(0)
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(0)
      expect(existsSync(join(tempProject, "opencode.json"))).toBe(false)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designMcpOwnership).toBe("none")
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("persists none ownership when design workflow is disabled", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        designTool: "none",
      })

      expect(code).toBe(0)
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(0)
      expect(existsSync(join(tempProject, "opencode.json"))).toBe(false)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designTool).toBe("none")
      expect(writtenConfig.designPath).toBe("./DESIGN.md")
      expect(writtenConfig.designMcpOwnership).toBe("none")
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("bootstraps soul files and docs README while normalizing invalid doc history mode", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const messages: string[] = []

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runInit({
        noTui: true,
        docsEnabled: true,
        docsPath: "./notes/docs",
        docHistoryMode: "rolling",
      })

      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.docsEnabled).toBe(true)
      expect(writtenConfig.docsPath).toBe("./notes/docs")
      expect(writtenConfig.docHistoryMode).toBe("append-dated")

      expect(existsSync(join(tempProject, "AGENTS.md"))).toBe(true)
      expect(existsSync(join(tempProject, ".sisyphus", "plans"))).toBe(true)
      expect(existsSync(join(tempProject, ".sisyphus", "notepads"))).toBe(true)
      expect(existsSync(join(tempProject, ".sisyphus", "evidence"))).toBe(true)
      expect(existsSync(join(tempProject, "notes", "docs", "README.md"))).toBe(true)
      expect(readFileSync(join(tempProject, "notes", "docs", "README.md"), "utf-8")).toContain("# Documentation")
      expect(messages.some((message) => message.includes("Initialized project in"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("uses persisted merged config values for no-TUI baseline and docs defaults", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig({
      region: "Detected Region",
      industry: "Detected Industry",
      primaryRegulation: "Detected Primary",
      secondaryRegulation: "Detected Secondary",
      docsEnabled: false,
      docsPath: "./detected-docs",
      docHistoryMode: "append-dated",
      prdPipelineMode: "filesystem",
      designPath: "./detected-design.md",
    }))
    mockReadWunderkindConfig.mockImplementation(() => ({
      region: "Persisted Region",
      industry: "Persisted Industry",
      primaryRegulation: "POPIA",
      secondaryRegulation: "SOC2",
      docsEnabled: true,
      docsPath: "./persisted-docs",
      docHistoryMode: "overwrite-archive",
      prdPipelineMode: "github",
      designPath: "./persisted-design.md",
    }))

    try {
      const code = await runInit({ noTui: true })

      expect(code).toBe(0)
      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.region).toBe("Persisted Region")
      expect(writtenConfig.industry).toBe("Persisted Industry")
      expect(writtenConfig.primaryRegulation).toBe("POPIA")
      expect(writtenConfig.secondaryRegulation).toBe("SOC2")
      expect(writtenConfig.docsEnabled).toBe(true)
      expect(writtenConfig.docsPath).toBe("./persisted-docs")
      expect(writtenConfig.docHistoryMode).toBe("overwrite-archive")
      expect(writtenConfig.prdPipelineMode).toBe("github")
      expect(writtenConfig.designPath).toBe("./persisted-design.md")
      expect(existsSync(join(tempProject, "persisted-docs", "README.md"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("preserves existing design workflow config in no-TUI mode when no design overrides are provided", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = () => {}

    mockReadWunderkindConfig.mockImplementation(() => ({
      designTool: "google-stitch",
      designPath: "./design/system/DESIGN.md",
      designMcpOwnership: "reused-project",
      docsEnabled: true,
      docsPath: "./docs-output",
      docHistoryMode: "append-dated",
    }))

    try {
      const code = await runInit({ noTui: true })

      expect(code).toBe(0)
      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.designTool).toBe("google-stitch")
      expect(writtenConfig.designPath).toBe("./design/system/DESIGN.md")
      expect(writtenConfig.designMcpOwnership).toBe("reused-project")
      expect(mockMergeStitchMcpConfig).toHaveBeenCalledTimes(0)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("rejects invalid docs paths in no-TUI mode before writing project config", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const errors: string[] = []

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runInit({
        noTui: true,
        docsEnabled: true,
        docsPath: "../outside-docs",
      })

      expect(code).toBe(1)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)
      expect(errors.some((message) => message.includes("docsPath must not traverse parent directories"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns when github PRD mode is selected without GitHub remote or gh CLI", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const messages: string[] = []

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: true,
      hasGitHubRemote: false,
      ghInstalled: false,
      authVerified: false,
      authCheckAttempted: false,
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true, prdPipelineMode: "github" })

      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(1)
      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.prdPipelineMode).toBe("github")
      expect(messages.some((message) => message.includes("no GitHub remote was detected"))).toBe(true)
      expect(messages.some((message) => message.includes("`gh` is not installed"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns when github PRD mode is selected but folder is not a git repo yet", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const messages: string[] = []

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: false,
      hasGitHubRemote: false,
      ghInstalled: true,
      authVerified: false,
      authCheckAttempted: false,
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true, prdPipelineMode: "github" })
      expect(code).toBe(0)
      expect(messages.some((message) => message.includes("not a git repository yet"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns when github PRD auth could not be verified", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const messages: string[] = []

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: true,
      hasGitHubRemote: true,
      ghInstalled: true,
      authVerified: false,
      authCheckAttempted: true,
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true, prdPipelineMode: "github" })
      expect(code).toBe(0)
      expect(messages.some((message) => message.includes("could not verify GitHub readiness"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns when bootstrapping in a folder that does not look like a project", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))
    const messages: string[] = []

    process.chdir(tempProject)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(0)
      expect(messages.some((message) => message.includes("does not look like a project"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("returns 1 when project config write fails", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: false, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", error: "boom" }))
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(1)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("returns 1 when native command write fails", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-commands", error: "boom" }))
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(1)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("returns 1 when native agent write fails", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-agents", error: "boom" }))
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(1)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("returns 1 when native skill write fails", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-nontui-"))

    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-skills", error: "boom" }))
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(1)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("returns 1 on unexpected init errors", async () => {
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }
    mockDetectCurrentConfig.mockImplementation(() => {
      throw new Error("init boom")
    })

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("init boom"))).toBe(true)
    } finally {
      console.error = originalError
    }
  })
})
