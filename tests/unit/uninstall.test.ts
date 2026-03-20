import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
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
  primaryRegulation: "GDPR",
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

const mockDetectCurrentConfig = mock(() => makeDetectedConfig())

const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockRemoveGlobalWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))
const mockRemoveNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
const mockRemoveNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
const mockRemoveNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/skills", changed: true }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
  removeNativeAgentFiles: mockRemoveNativeAgentFiles,
  removeNativeCommandFiles: mockRemoveNativeCommandFiles,
  removeNativeSkillFiles: mockRemoveNativeSkillFiles,
  removeGlobalWunderkindConfig: mockRemoveGlobalWunderkindConfig,
}))

import { runUninstall } from "../../src/cli/uninstall.js"

describe("runUninstall", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockRemovePluginFromOpenCodeConfig.mockClear()
    mockRemoveNativeAgentFiles.mockClear()
    mockRemoveNativeCommandFiles.mockClear()
    mockRemoveNativeSkillFiles.mockClear()
    mockRemoveGlobalWunderkindConfig.mockClear()
  })

  it("removes global registration and global Wunderkind config on global uninstall", async () => {
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({})
      expect(code).toBe(0)
      const firstCallScope = mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]
      expect(firstCallScope).toBe("global")
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeCommandFiles.mock.calls[0]?.length ?? 0).toBe(0)
      expect(mockRemoveNativeSkillFiles).toHaveBeenCalledTimes(1)
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("defaults to project uninstall when both scopes are installed and preserves shared global capabilities", async () => {
    mockDetectCurrentConfig.mockImplementation(() => ({
      ...makeDetectedConfig(),
      registrationScope: "both" as const,
      projectInstalled: true,
      globalInstalled: true,
      scope: "project" as const,
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({})
      expect(code).toBe(0)
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      const first = mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]
      expect(first).toBe("project")
      expect(mockRemoveNativeAgentFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeCommandFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeSkillFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("removes only project registration and leaves shared global capabilities untouched", async () => {
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "project" })
      expect(code).toBe(0)
      const firstCallScope = mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]
      expect(firstCallScope).toBe("project")
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeAgentFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeCommandFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeSkillFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("reports already absent when uninstall is a no-op", async () => {
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({
      success: true,
      configPath: "/tmp/opencode.json",
      changed: false,
    }))

    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("already absent"))).toBe(true)
      expect(messages.some((m) => m.includes("Removed plugin registration"))).toBe(false)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when native agent removal fails", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/agents",
      changed: false,
      error: "EISDIR",
    }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove native agent files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 0 when nothing is installed", async () => {
    mockDetectCurrentConfig.mockImplementation(() => ({
      ...makeDetectedConfig(),
      isInstalled: false,
      projectInstalled: false,
      globalInstalled: false,
      registrationScope: "none",
    }))

    const messages: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({})
      expect(code).toBe(0)
      expect(messages.some((message) => message.includes("not currently registered"))).toBe(true)
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
    }
  })

  it("returns 1 when native command removal fails", async () => {
    mockRemoveNativeCommandFiles.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/global-commands",
      changed: false,
      error: "EPERM",
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when native skill removal fails", async () => {
    mockRemoveNativeSkillFiles.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/skills",
      changed: false,
      error: "EPERM",
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when global config removal fails", async () => {
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/.wunderkind/wunderkind.config.jsonc",
      changed: false,
      error: "EPERM",
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when plugin registration removal fails", async () => {
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/opencode.json",
      changed: false,
      error: "EPERM",
    }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove plugin"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("logs 'already absent' when native assets are not present during global uninstall", async () => {
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/opencode.json", changed: false }))
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: false }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: false }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/skills", changed: false }))
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({
      success: true,
      configPath: "/tmp/.wunderkind/wunderkind.config.jsonc",
      changed: false,
    }))

    const messages: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("already absent"))).toBe(true)
    } finally {
      console.log = originalLog
    }
  })

  it("returns 1 when native command file removal fails during global uninstall", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-commands", changed: false, error: "EACCES" }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove native command files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when native skill file removal fails during global uninstall", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/skills", changed: false, error: "EACCES" }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove native skill files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when global Wunderkind config removal fails during global uninstall", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/skills", changed: true }))
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({ success: false, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: false, error: "ENOENT" }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove global Wunderkind config"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 on unexpected exceptions", async () => {
    mockDetectCurrentConfig.mockImplementation(() => {
      throw new Error("boom")
    })

    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({})
      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("Error: Error: boom"))).toBe(true)
    } finally {
      console.error = originalError
    }
  })

  it("removes an empty global Wunderkind directory after deleting the global config file", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-empty-global-dir-"))
    const fakeHome = join(testRoot, "fake-home")
    const globalDir = join(fakeHome, ".wunderkind")
    const globalConfigPath = join(globalDir, "wunderkind.config.jsonc")

    try {
      mkdirSync(globalDir, { recursive: true })
      writeFileSync(globalConfigPath, "{}\n")
      mock.module("node:os", () => ({ homedir: () => fakeHome }))

      const { removeGlobalWunderkindConfig } = await import(
        `../../src/cli/config-manager/index.ts?uninstall-empty-global-dir=${Date.now()}`,
      )

      const result = removeGlobalWunderkindConfig()

      expect(result.success).toBe(true)
      expect(result.changed).toBe(true)
      expect(result.configPath).toBe(globalConfigPath)
      expect(existsSync(globalConfigPath)).toBe(false)
      expect(existsSync(globalDir)).toBe(false)
    } finally {
      mock.module("node:os", () => ({ homedir }))
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
