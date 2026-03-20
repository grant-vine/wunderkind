import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"
import type { DetectedConfig, InstallConfig, InstallScope } from "../../src/cli/types.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname

mock.module("picocolors", () => ({
  default: {
    bgMagenta: (s: string) => s,
    white: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
  },
}))

const mockRunInit = mock(async () => 0)
const mockIsProjectContext = mock(() => true)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json" }))
const mockDetectLegacyConfig = mock(() => false)
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockReadWunderkindConfigForScope = mock<(scope: InstallScope) => Partial<InstallConfig> | null>(() => null)
const mockDetectCurrentConfig = mock<() => DetectedConfig>(() => ({
  isInstalled: true,
  scope: "global" as const,
  projectInstalled: false,
  globalInstalled: true,
  registrationScope: "global" as const,
  projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
  globalOpenCodeConfigPath: "/tmp/opencode.json",
  region: "Global",
  industry: "SaaS",
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
}))

const initModuleFactory = () => ({
  runInit: mockRunInit,
  isProjectContext: mockIsProjectContext,
})
mock.module(`${PROJECT_ROOT}src/cli/init.js`, initModuleFactory)

const configManagerFactory = () => ({
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
  getDefaultGlobalConfig: () => ({
    region: "Global",
    industry: "",
    primaryRegulation: "GDPR",
    secondaryRegulation: "",
  }),
  readWunderkindConfigForScope: mockReadWunderkindConfigForScope,
  detectCurrentConfig: mockDetectCurrentConfig,
  detectLegacyConfig: mockDetectLegacyConfig,
})
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, configManagerFactory)

const mockAddAiTracesToGitignore = mock(() => ({ success: true, added: [], alreadyPresent: [] }))

const gitignoreFactory = () => ({
  addAiTracesToGitignore: mockAddAiTracesToGitignore,
})
mock.module(`${PROJECT_ROOT}src/cli/gitignore-manager.js`, gitignoreFactory)

const mockSelect = mock(async () => "")
const mockConfirm = mock<() => Promise<boolean | string>>(async () => true)
const mockText = mock(async () => "")
const mockCancel = mock(() => {})
const mockOutro = mock(() => {})
const mockNote = mock(() => {})
const mockSpinnerStart = mock(() => {})
const mockSpinnerStop = mock(() => {})
const mockLogInfo = mock(() => {})
const mockLogWarn = mock(() => {})
const mockLogSuccess = mock(() => {})
const mockLogMessage = mock(() => {})
const mockIsCancel = mock((_value: unknown) => false)

function registerBasePromptModule(): void {
  mock.module("@clack/prompts", () => ({
    intro: () => {},
    select: mockSelect,
    confirm: mockConfirm,
    text: mockText,
    isCancel: mockIsCancel,
    cancel: mockCancel,
    spinner: () => ({
      start: mockSpinnerStart,
      stop: mockSpinnerStop,
    }),
    note: mockNote,
    outro: mockOutro,
    log: {
      info: mockLogInfo,
      warn: mockLogWarn,
      success: mockLogSuccess,
      message: mockLogMessage,
    },
  }))
}

registerBasePromptModule()

const TUI_INSTALLER_URL = new URL("src/cli/tui-installer.ts", `file://${PROJECT_ROOT}`).href

let runTuiInstaller: (scope?: InstallScope) => Promise<number>

describe("runTuiInstaller init handoff", () => {
  let originalStdinTTY: boolean | undefined
  let originalStdoutTTY: boolean | undefined

  beforeAll(async () => {
    const mod = await import(TUI_INSTALLER_URL)
    runTuiInstaller = mod.runTuiInstaller as (scope?: InstallScope) => Promise<number>
  })

  beforeEach(() => {
    mockRunInit.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockText.mockClear()
    mockCancel.mockClear()
    mockOutro.mockClear()
    mockNote.mockClear()
    mockSpinnerStart.mockClear()
    mockSpinnerStop.mockClear()
    mockLogInfo.mockClear()
    mockLogWarn.mockClear()
    mockLogSuccess.mockClear()
    mockLogMessage.mockClear()
    mockAddPluginToOpenCodeConfig.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockReadWunderkindConfigForScope.mockClear()
    mockDetectCurrentConfig.mockClear()
    mockAddAiTracesToGitignore.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()

    mockRunInit.mockImplementation(async () => 0)
    registerBasePromptModule()
    mockIsProjectContext.mockImplementation(() => true)
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/opencode.json" }))
    mockDetectLegacyConfig.mockImplementation(() => false)
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-agents" }))
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands" }))
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-skills" }))
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: true, added: [], alreadyPresent: [] }))
    mockReadWunderkindConfigForScope.mockImplementation(() => null)
    mockIsCancel.mockClear()
    mockIsCancel.mockImplementation((_value: unknown) => false)
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "global" as const,
      projectInstalled: false,
      globalInstalled: true,
      registrationScope: "global" as const,
      projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
      globalOpenCodeConfigPath: "/tmp/opencode.json",
      region: "Global",
      industry: "SaaS",
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
    }))

    originalStdinTTY = process.stdin.isTTY
    originalStdoutTTY = process.stdout.isTTY
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  })

  it("calls runInit and prompts for gitignore when user opts into init", async () => {
    const selectAnswers = ["project"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "project")

    const confirmAnswers = [true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(0)

      expect(mockRunInit).toHaveBeenCalledTimes(1)
      const initOpts = mockRunInit.mock.calls[0]?.[0] as Record<string, unknown>
      expect(initOpts.noTui).toBe(false)
      expect(initOpts).not.toHaveProperty("region")
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)

      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockSelect).toHaveBeenCalledTimes(1)
      expect(mockText).toHaveBeenCalledTimes(0)
      const secondConfirmMsg = mockConfirm.mock.calls[1]?.[0] as { message: string }
      expect(secondConfirmMsg.message).toContain(".gitignore")
      
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
      expect(mockAddAiTracesToGitignore).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("does not prompt for gitignore or call it on install-only path", async () => {
    const selectAnswers = ["project"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "project")

    const confirmAnswers = [false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(0)

      expect(mockRunInit).toHaveBeenCalledTimes(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)

      expect(mockConfirm).toHaveBeenCalledTimes(1)
      expect(mockSelect).toHaveBeenCalledTimes(1)
      expect(mockText).toHaveBeenCalledTimes(0)
      const firstConfirmMsg = mockConfirm.mock.calls[0]?.[0] as { message: string }
      expect(firstConfirmMsg.message).toContain("Initialize the current project now?")
      
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
      expect(mockAddAiTracesToGitignore).toHaveBeenCalledTimes(0)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("writes native agents on project-scope install without init", async () => {
    const selectAnswers = ["project"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "project")

    const confirmAnswers = [false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(0)
      expect(mockRunInit).toHaveBeenCalledTimes(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
      expect(mockText).toHaveBeenCalledTimes(0)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("uses the scoped global baseline silently during global install even inside a project", async () => {
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "project" as const,
      projectInstalled: true,
      globalInstalled: true,
      registrationScope: "both" as const,
      projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
      globalOpenCodeConfigPath: "/tmp/opencode.json",
      region: "Project Region",
      industry: "Project Industry",
      primaryRegulation: "POPIA",
      secondaryRegulation: "GDPR",
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
    }))
    mockReadWunderkindConfigForScope.mockImplementation((scope: string) =>
      scope === "global"
        ? {
            region: "Global Region",
            industry: "Global Industry",
            primaryRegulation: "CCPA",
            secondaryRegulation: "",
          }
        : null,
    )

    const selectAnswers = ["global"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "global")

    const confirmAnswers = [false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    try {
      const code = await runTuiInstaller("global")
      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(1)
      const writtenConfig = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(writtenConfig.region).toBe("Global Region")
      expect(writtenConfig.industry).toBe("Global Industry")
      expect(writtenConfig.primaryRegulation).toBe("CCPA")
      expect(writtenConfig.secondaryRegulation).toBe("")
      expect(mockText).toHaveBeenCalledTimes(0)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("returns 1 without a TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true })

    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runTuiInstaller("global")
      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("requires a TTY"))).toBe(true)
    } finally {
      console.error = originalError
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("returns 1 when legacy config is detected", async () => {
    mockDetectLegacyConfig.mockImplementation(() => true)

    try {
      const code = await runTuiInstaller("global")
      expect(code).toBe(1)
      expect(mockCancel).toHaveBeenCalledTimes(1)
    } finally {
      mockDetectLegacyConfig.mockImplementation(() => false)
    }
  })

  it("returns 1 when scope selection is cancelled", async () => {
    mockSelect.mockImplementation(async () => "cancelled")
    mockIsCancel.mockImplementation((value: unknown) => value === "cancelled")

    try {
      const code = await runTuiInstaller("global")
      expect(code).toBe(1)
      expect(mockCancel).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("returns 1 when init confirmation is cancelled", async () => {
    mockSelect.mockImplementation(async () => "project")
    mockConfirm.mockImplementation(async () => "cancelled")
    mockIsCancel.mockImplementation((value: unknown) => value === "cancelled")

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(1)
      expect(mockCancel).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("returns 1 when gitignore confirm is cancelled after init is accepted", async () => {
    mockSelect.mockImplementation(async () => "project")
    const confirmAnswers = [true, "cancelled"]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)
    mockIsCancel.mockImplementation((value: unknown) => value === "cancelled")

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(1)
      expect(mockCancel).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("returns 1 when plugin write fails", async () => {
    mockSelect.mockImplementation(async () => "global")
    mockConfirm.mockImplementation(async () => false)
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: false, configPath: "/tmp/opencode.json", error: "boom" }))

    const code = await runTuiInstaller("global")
    expect(code).toBe(1)
    expect(mockAddPluginToOpenCodeConfig).toHaveBeenCalledTimes(1)
  })

  it("returns 1 when global config write fails", async () => {
    mockSelect.mockImplementation(async () => "global")
    mockConfirm.mockImplementation(async () => false)
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: false, configPath: "/tmp/config.jsonc", error: "boom" }))

    const code = await runTuiInstaller("global")
    expect(code).toBe(1)
    expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(1)
  })

  it("returns 1 when native agent write fails", async () => {
    mockSelect.mockImplementation(async () => "project")
    mockConfirm.mockImplementation(async () => false)
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/agents", error: "boom" }))

    const code = await runTuiInstaller("project")
    expect(code).toBe(1)
    expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
  })

  it("returns 1 when native command write fails", async () => {
    mockSelect.mockImplementation(async () => "project")
    mockConfirm.mockImplementation(async () => false)
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/commands", error: "boom" }))

    const code = await runTuiInstaller("project")
    expect(code).toBe(1)
    expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
  })

  it("returns 1 when native skill write fails", async () => {
    mockSelect.mockImplementation(async () => "project")
    mockConfirm.mockImplementation(async () => false)
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/skills", error: "boom" }))

    const code = await runTuiInstaller("project")
    expect(code).toBe(1)
    expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
  })

  it("logs success when gitignore entries are newly added", async () => {
    mockSelect.mockImplementation(async () => "project")
    const confirmAnswers = [true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: true, added: [".wunderkind/", "AGENTS.md"], alreadyPresent: [] }))

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(0)
      expect(mockLogSuccess).toHaveBeenCalledWith(expect.stringContaining("entries to"))
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("warns when gitignore update fails after successful install", async () => {
    mockSelect.mockImplementation(async () => "project")
    const confirmAnswers = [true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: false, added: [], alreadyPresent: [], error: "readonly" }))

    const code = await runTuiInstaller("project")
    expect(code).toBe(0)
    expect(mockLogWarn).toHaveBeenCalledTimes(1)
  })

  it("warns when init handoff fails after install succeeds", async () => {
    mockSelect.mockImplementation(async () => "project")
    const confirmAnswers = [true, false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)
    mockRunInit.mockImplementation(async () => 7)

    const code = await runTuiInstaller("project")
    expect(code).toBe(7)
    expect(mockLogWarn).toHaveBeenCalledTimes(1)
    expect(mockOutro).toHaveBeenCalledTimes(1)
  })
})
