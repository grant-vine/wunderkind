import { beforeEach, describe, expect, it, mock } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const mockText = mock(async () => "")
const mockSelect = mock(async () => "")
const mockIsCancel = mock(() => false)

mock.module("@clack/prompts", () => ({
  text: mockText,
  select: mockSelect,
  isCancel: mockIsCancel,
}))

const mockDetectCurrentConfig = mock(() => ({
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
}))

const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteOmoAgentConfig = mock(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeOmoAgentConfig: mockWriteOmoAgentConfig,
}))

import { runInit } from "../../src/cli/init.js"

describe("runInit interactive personality prompts", () => {
  beforeEach(() => {
    mockText.mockClear()
    mockSelect.mockClear()
    mockIsCancel.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteOmoAgentConfig.mockClear()
  })

  it("collects team/org/personality fields interactively and persists them", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["no"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const selectAnswers = [
      "formal-strict",
      "hierarchical",
      "educator-collaborator",
      "grizzled-sysadmin",
      "growth-hacker",
      "rule-enforcer",
      "user-advocate",
      "process-purist",
      "bold-provocateur",
      "pr-spinner",
      "community-champion",
      "cautious-gatekeeper",
      "knowledge-builder",
      "rigorous-statistician",
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
      expect(mockSelect).toHaveBeenCalledTimes(14)
      expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.teamCulture).toBe("formal-strict")
      expect(installConfig.orgStructure).toBe("hierarchical")
      expect(installConfig.cisoPersonality).toBe("educator-collaborator")
      expect(installConfig.dataAnalystPersonality).toBe("rigorous-statistician")
      expect(installConfig.docsEnabled).toBe(false)
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("selects docs history mode via select when docs enabled", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = ["yes", "./my-docs"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const selectAnswers = [
      "formal-strict",
      "hierarchical",
      "educator-collaborator",
      "grizzled-sysadmin",
      "growth-hacker",
      "rule-enforcer",
      "user-advocate",
      "process-purist",
      "bold-provocateur",
      "pr-spinner",
      "community-champion",
      "cautious-gatekeeper",
      "knowledge-builder",
      "rigorous-statistician",
      "append-dated",
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
      expect(mockSelect).toHaveBeenCalledTimes(15)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.docsEnabled).toBe(true)
      expect(installConfig.docHistoryMode).toBe("append-dated")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })
})
