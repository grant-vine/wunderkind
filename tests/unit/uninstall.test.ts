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
  qaPersonality: "risk-based-pragmatist" as const,
  productPersonality: "outcome-obsessed" as const,
  opsPersonality: "on-call-veteran" as const,
  creativePersonality: "pragmatic-problem-solver" as const,
  brandPersonality: "authentic-builder" as const,
  devrelPersonality: "dx-engineer" as const,
  legalPersonality: "pragmatic-advisor" as const,
  supportPersonality: "systematic-triage" as const,
  dataAnalystPersonality: "insight-storyteller" as const,
  docsEnabled: false,
  docsPath: "./docs",
  docHistoryMode: "overwrite" as const,
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock(() => makeDetectedConfig())

const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockRemoveGlobalWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
  removeGlobalWunderkindConfig: mockRemoveGlobalWunderkindConfig,
}))

import { runUninstall } from "../../src/cli/uninstall.js"

describe("runUninstall", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockRemovePluginFromOpenCodeConfig.mockClear()
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
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("defaults to project uninstall when both scopes are installed", async () => {
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
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("removes only project registration and leaves both configs untouched", async () => {
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
})
