import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { GitHubWorkflowReadiness } from "../../src/cli/config-manager/index.js"
import type { DetectedConfig } from "../../src/cli/types.js"

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
    docHistoryMode: "overwrite" as const,
    prdPipelineMode: "filesystem" as const,
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock<() => DetectedConfig>(() => makeDetectedConfig())
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

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectGitHubWorkflowReadiness: mockDetectGitHubWorkflowReadiness,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
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
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
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
      expect(writtenConfig.docHistoryMode).toBe("overwrite")

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
