import { beforeEach, describe, expect, it, mock } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DetectedConfig } from "../../src/cli/types.js"
import type { GitHubWorkflowReadiness } from "../../src/cli/config-manager/index.js"

const mockText = mock(async () => "")
const mockSelect = mock(async () => "")
const mockConfirm = mock(async () => false)
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
  prdPipelineMode: "filesystem" as const,
}

mock.module("@clack/prompts", () => ({
  text: mockText,
  select: mockSelect,
  confirm: mockConfirm,
  isCancel: mockIsCancel,
}))

const mockDetectCurrentConfig = mock(() => DEFAULT_DETECTED_CONFIG)

const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockDetectGitHubWorkflowReadiness = mock<(cwd: string) => GitHubWorkflowReadiness>(() => ({
  isGitRepo: true,
  hasGitHubRemote: true,
  ghInstalled: true,
  authVerified: true,
  authCheckAttempted: true,
}))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectGitHubWorkflowReadiness: mockDetectGitHubWorkflowReadiness,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
}))

import { runInit } from "../../src/cli/init.js"

describe("runInit interactive personality prompts", () => {
  beforeEach(() => {
    mockText.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockIsCancel.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockDetectGitHubWorkflowReadiness.mockClear()
    mockDetectCurrentConfig.mockClear()
    mockDetectCurrentConfig.mockImplementation(() => DEFAULT_DETECTED_CONFIG)
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: true,
      hasGitHubRemote: true,
      ghInstalled: true,
      authVerified: true,
      authCheckAttempted: true,
    }))
    mockConfirm.mockImplementation(async () => false)
  })

  it("collects team/org/personality fields interactively when customization is enabled", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers: string[] = []
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")
    const confirmAnswers = [true, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

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
      "filesystem",
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
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.teamCulture).toBe("formal-strict")
      expect(installConfig.orgStructure).toBe("hierarchical")
      expect(installConfig.cisoPersonality).toBe("educator-collaborator")
      expect(installConfig.dataAnalystPersonality).toBe("rigorous-statistician")
      expect(installConfig.docsEnabled).toBe(false)
      expect(installConfig.prdPipelineMode).toBe("filesystem")
    } finally {
      console.log = restoreLog
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("keeps current specialist personalities when customization is skipped", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    mockDetectCurrentConfig.mockImplementation(() => ({
      ...DEFAULT_DETECTED_CONFIG,
      cisoPersonality: "educator-collaborator" as const,
      ctoPersonality: "startup-bro" as const,
      cmoPersonality: "growth-hacker" as const,
      qaPersonality: "rubber-duck" as const,
      productPersonality: "velocity-optimizer" as const,
      opsPersonality: "process-purist" as const,
      creativePersonality: "bold-provocateur" as const,
      brandPersonality: "community-evangelist" as const,
      devrelPersonality: "community-champion" as const,
      legalPersonality: "plain-english-counselor" as const,
      supportPersonality: "knowledge-builder" as const,
      dataAnalystPersonality: "pragmatic-quant" as const,
    }))

    const textAnswers: string[] = []
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")
    const confirmAnswers = [false, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    const selectAnswers = ["formal-strict", "hierarchical", "filesystem"]
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
      expect(mockSelect).toHaveBeenCalledTimes(3)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(installConfig.teamCulture).toBe("formal-strict")
      expect(installConfig.orgStructure).toBe("hierarchical")
      expect(installConfig.cisoPersonality).toBe("educator-collaborator")
      expect(installConfig.ctoPersonality).toBe("startup-bro")
      expect(installConfig.dataAnalystPersonality).toBe("pragmatic-quant")
      expect(installConfig.prdPipelineMode).toBe("filesystem")
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

    const textAnswers = ["./my-docs"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")
    const confirmAnswers = [true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)

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
      "github",
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
      expect(mockSelect).toHaveBeenCalledTimes(16)
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)

      const installConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
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
})
