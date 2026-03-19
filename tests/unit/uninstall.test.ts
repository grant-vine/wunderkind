import { beforeEach, describe, expect, it, mock } from "bun:test"
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
  desloppifyEnabled: false,
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
})
