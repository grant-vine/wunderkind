import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockRunInit = mock(async () => 0)
const mockIsProjectContext = mock(() => true)

mock.module("../../src/cli/init.js", () => ({
  runInit: mockRunInit,
  isProjectContext: mockIsProjectContext,
}))

mock.module("../../src/cli/config-manager/index.js", () => ({
  addPluginToOpenCodeConfig: () => ({ success: true, configPath: "/tmp/opencode.json" }),
  writeWunderkindConfig: () => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }),
  getDefaultGlobalConfig: () => ({
    region: "Global",
    industry: "",
    primaryRegulation: "GDPR",
    secondaryRegulation: "",
  }),
  readWunderkindConfigForScope: () => null,
  detectCurrentConfig: () => ({
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
  }),
  detectLegacyConfig: () => false,
}))

const mockAddAiTracesToGitignore = mock(() => ({ success: true, added: [], alreadyPresent: [] }))

mock.module("../../src/cli/gitignore-manager.js", () => ({
  addAiTracesToGitignore: mockAddAiTracesToGitignore,
}))

const mockSelect = mock(async () => "")
const mockConfirm = mock(async () => true)
const mockText = mock(async () => "")

mock.module("@clack/prompts", () => ({
  intro: () => {},
  select: mockSelect,
  confirm: mockConfirm,
  text: mockText,
  isCancel: () => false,
  cancel: () => {},
  spinner: () => ({
    start: () => {},
    stop: () => {},
  }),
  note: () => {},
  outro: () => {},
  log: {
    info: () => {},
    warn: () => {},
    success: () => {},
    message: () => {},
  },
}))

import { runTuiInstaller } from "../../src/cli/tui-installer.js"

describe("runTuiInstaller init handoff", () => {
  let originalStdinTTY: boolean | undefined
  let originalStdoutTTY: boolean | undefined

  beforeEach(() => {
    mockRunInit.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockText.mockClear()
    mockAddAiTracesToGitignore.mockClear()

    originalStdinTTY = process.stdin.isTTY
    originalStdoutTTY = process.stdout.isTTY
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  })

  it("calls runInit and prompts for gitignore when user opts into init", async () => {
    const selectAnswers = ["project", "GDPR", "__other__"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "GDPR")

    const confirmAnswers = [true, true]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? true)

    const textAnswers = ["EU", "SaaS", "Custom-Reg"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(0)
      
      expect(mockRunInit).toHaveBeenCalledTimes(1)
      const initOpts = mockRunInit.mock.calls[0]?.[0] as Record<string, unknown>
      expect(initOpts.noTui).toBe(false)
      expect(initOpts).not.toHaveProperty("region")
      
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      const secondConfirmMsg = mockConfirm.mock.calls[1]?.[0] as { message: string }
      expect(secondConfirmMsg.message).toContain(".gitignore")
      
      expect(mockAddAiTracesToGitignore).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })

  it("does not prompt for gitignore or call it on install-only path", async () => {
    const selectAnswers = ["project", "GDPR", "__other__"]
    mockSelect.mockImplementation(async () => selectAnswers.shift() ?? "GDPR")

    const confirmAnswers = [false]
    mockConfirm.mockImplementation(async () => confirmAnswers.shift() ?? false)

    const textAnswers = ["EU", "SaaS", "Custom-Reg"]
    mockText.mockImplementation(async () => textAnswers.shift() ?? "")

    try {
      const code = await runTuiInstaller("project")
      expect(code).toBe(0)
      
      expect(mockRunInit).toHaveBeenCalledTimes(0)
      
      expect(mockConfirm).toHaveBeenCalledTimes(1)
      const firstConfirmMsg = mockConfirm.mock.calls[0]?.[0] as { message: string }
      expect(firstConfirmMsg.message).toContain("Initialize the current project now?")
      
      expect(mockAddAiTracesToGitignore).toHaveBeenCalledTimes(0)
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTTY, configurable: true })
      Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTTY, configurable: true })
    }
  })
})
