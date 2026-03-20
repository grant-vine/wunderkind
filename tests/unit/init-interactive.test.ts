import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DetectedConfig } from "../../src/cli/types.js"
import type { GitHubWorkflowReadiness } from "../../src/cli/config-manager/index.js"

const mockText = mock(async () => "")
const mockSelect = mock(async () => "")
const mockConfirm = mock(async () => false)
const mockMultiselect = mock(async () => [] as string[])
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
  docHistoryMode: "overwrite" as const,
  prdPipelineMode: "filesystem" as const,
}

mock.module("@clack/prompts", () => ({
  text: mockText,
  select: mockSelect,
  confirm: mockConfirm,
  multiselect: mockMultiselect,
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

describe("runInit interactive SOUL prompts", () => {
  beforeEach(() => {
    mockText.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockMultiselect.mockClear()
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
    mockMultiselect.mockImplementation(async () => [])
  })

  it("creates a retained persona SOUL file when customization is enabled", async () => {
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const textAnswers = [
      "EU",
      "SaaS",
      "Optimize for activation and retention first.",
      "Push back early when scope expands without evidence.",
      "This team prefers thin vertical slices and filesystem-first planning.",
      "Do not generate roadmap theater or big-bang releases.",
    ]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    const confirmAnswers = [true, false, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockMultiselect.mockImplementation(async () => ["product-wunderkind"])

    const selectAnswers = ["GDPR", "POPIA", "formal-strict", "hierarchical", "filesystem"]
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
      expect(mockSelect).toHaveBeenCalledTimes(5)
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
      expect(soulFile).toContain("- Priority lens: Optimize for activation and retention first.")
      expect(soulFile).toContain("- Challenge style: Push back early when scope expands without evidence.")
      expect(soulFile).toContain("- Project memory: This team prefers thin vertical slices and filesystem-first planning.")
      expect(soulFile).toContain("- Anti-goals: Do not generate roadmap theater or big-bang releases.")
      expect(soulFile).toContain("## Durable Knowledge")
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

    const selectAnswers = ["CCPA", "SOC2", "formal-strict", "hierarchical", "filesystem"]
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
      expect(mockSelect).toHaveBeenCalledTimes(5)
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

    const selectAnswers = ["GDPR", "ISO27001", "formal-strict", "hierarchical", "github", "append-dated"]
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
      expect(mockSelect).toHaveBeenCalledTimes(6)
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
        docsPathValidateResults.push(opts.validate("./valid-docs"))
        return "./valid-docs"
      }
      return textAnswers.shift() ?? ""
    })

    const confirmAnswers = [false, true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)

    const selectAnswers = ["GDPR", "", "pragmatic-balanced", "flat", "filesystem", "overwrite"]
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

      expect(docsPathValidateResults[0]).toBeDefined()
      expect(typeof docsPathValidateResults[0]).toBe("string")
      expect(docsPathValidateResults[1]).toBeUndefined()

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

    const selectAnswers = ["__other__", "__other__", "pragmatic-balanced", "flat", "filesystem"]
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
})
