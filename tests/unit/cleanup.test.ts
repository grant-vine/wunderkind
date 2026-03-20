import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DetectedConfig } from "../../src/cli/types.js"

function makeDetectedConfig(overrides: Partial<DetectedConfig> = {}): DetectedConfig {
  return {
    isInstalled: true,
    scope: "project" as const,
    projectInstalled: true,
    globalInstalled: true,
    registrationScope: "project" as const,
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
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock<() => DetectedConfig>(() => makeDetectedConfig())
const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
}))

import { runProjectCleanup } from "../../src/cli/cleanup.js"

describe("runProjectCleanup", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockRemovePluginFromOpenCodeConfig.mockClear()
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
  })

  it("removes project plugin wiring and local .wunderkind state", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const originalError = console.error
    const tempProject = mkdtempSync(join(tmpdir(), "wk-cleanup-"))
    const wunderkindDir = join(tempProject, ".wunderkind")
    const messages: string[] = []

    mkdirSync(join(wunderkindDir, "souls"), { recursive: true })
    writeFileSync(join(wunderkindDir, "wunderkind.config.jsonc"), "{}\n")
    writeFileSync(join(wunderkindDir, "souls", "product-wunderkind.md"), "test\n")
    process.chdir(tempProject)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runProjectCleanup()
      expect(code).toBe(0)
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      expect(mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]).toBe("project")
      expect(existsSync(wunderkindDir)).toBe(false)
      expect(messages.some((message) => message.includes("Removed project plugin registration"))).toBe(true)
      expect(messages.some((message) => message.includes("Removed project Wunderkind state"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      console.error = originalError
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("reports already absent when no project-local state exists", async () => {
    const originalCwd = process.cwd()
    const originalLog = console.log
    const tempProject = mkdtempSync(join(tmpdir(), "wk-cleanup-"))
    const messages: string[] = []

    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig({ projectInstalled: false, registrationScope: "none", isInstalled: false }))
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/opencode.json", changed: false }))

    process.chdir(tempProject)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runProjectCleanup()
      expect(code).toBe(0)
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(0)
      expect(messages.some((message) => message.includes("Project Wunderkind state already absent"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      console.log = originalLog
      rmSync(tempProject, { recursive: true, force: true })
    }
  })
})
