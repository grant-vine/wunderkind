import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { InstallArgs } from "../../src/cli/types.js"

const mockDetectCurrentConfig = mock(() => ({
  isInstalled: false,
  scope: "global" as const,
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
}))

const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/fake/opencode.json" }))
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
const mockCreateMemoryFiles = mock(() => ({ success: true, configPath: "/fake/.wunderkind/memory" }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectLegacyConfig: mockDetectLegacyConfig,
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  createMemoryFiles: mockCreateMemoryFiles,
}))

const mockAddAiTracesToGitignore = mock(() => ({
  success: true,
  added: [".wunderkind/"],
  alreadyPresent: [],
}))

mock.module("../../src/cli/gitignore-manager.js", () => ({
  addAiTracesToGitignore: mockAddAiTracesToGitignore,
}))

import { validateNonTuiArgs, runCliInstaller } from "../../src/cli/cli-installer.js"

function silenceConsole(): () => void {
  const origLog = console.log
  const origErr = console.error
  console.log = () => {}
  console.error = () => {}
  return () => {
    console.log = origLog
    console.error = origErr
  }
}

function baseArgs(overrides: Partial<InstallArgs> = {}): InstallArgs {
  return {
    tui: false,
    scope: "global",
    region: "South Africa",
    industry: "SaaS",
    primaryRegulation: "POPIA",
    secondaryRegulation: "",
    ...overrides,
  }
}

describe("validateNonTuiArgs", () => {
  it("returns error containing 'region' when region is missing", () => {
    const result = validateNonTuiArgs(baseArgs({ region: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("region"))).toBe(true)
  })

  it("returns error containing 'industry' when industry is missing", () => {
    const result = validateNonTuiArgs(baseArgs({ industry: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("industry"))).toBe(true)
  })

  it("returns error containing 'primary-regulation' when primaryRegulation is missing", () => {
    const result = validateNonTuiArgs(baseArgs({ primaryRegulation: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("primary-regulation"))).toBe(true)
  })

  it("returns empty errors array when all required fields are present", () => {
    const result = validateNonTuiArgs(baseArgs())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})

describe("runCliInstaller", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockAddPluginToOpenCodeConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockAddAiTracesToGitignore.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: false,
      scope: "global" as const,
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
    }))
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/fake/opencode.json" }))
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: true, added: [".wunderkind/"], alreadyPresent: [] }))
  })

  it("returns 1 when legacy config is detected", async () => {
    mockDetectLegacyConfig.mockImplementation(() => true)
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 0 for a successful install with scope=global", async () => {
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs({ scope: "global" }))
      expect(code).toBe(0)
    } finally {
      restore()
    }
  })

  it("calls addPluginToOpenCodeConfig with 'project' when scope=project", async () => {
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "project" }))
      expect(mockAddPluginToOpenCodeConfig).toHaveBeenCalledTimes(1)
      const calls = mockAddPluginToOpenCodeConfig.mock.calls
      expect(calls[0]?.[0]).toBe("project")
    } finally {
      restore()
    }
  })
})
