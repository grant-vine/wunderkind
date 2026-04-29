import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { DetectedConfig, InstallConfig, InstallScope, OmoInstallReadiness } from "../../src/cli/types.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href

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
    blue: (s: string) => s,
  },
}))

const mockRunInit = mock(async () => 0)
const mockIsProjectContext = mock(() => true)
const mockDetectOmoInstallReadiness = mock<() => OmoInstallReadiness>(() => ({
  installed: true,
  registered: true,
  loadedVersion: "3.17.6",
  configPath: "/tmp/oh-my-openagent.jsonc",
  configSource: "oh-my-openagent.jsonc",
  legacyConfigPath: null,
  staleOverrideWarning: null,
  versionSkewWarning: null,
  dualConfigWarning: null,
  freshness: null,
  freshnessSummary: {
    state: "not-verified",
    guidance:
      "Latest oh-my-openagent plugin/config naming freshness could not be verified — use `bunx oh-my-opencode get-local-version` for upstream update advice while the package/CLI still use oh-my-opencode.",
  },
  interactiveInstallCommand: "bunx oh-my-opencode install",
  nonTuiInstallCommand: "bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes",
  guidance:
    "upstream now prefers oh-my-openagent for plugin/config naming, but the package and CLI command still remain oh-my-opencode",
}))
const mockSpawnSync = mock(() => ({ status: 0, stdout: "", stderr: "" }))
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json" }))
const mockDetectLegacyConfig = mock(() => false)
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockRemoveNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/mock-agents", changed: true }))
const mockRemoveNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/mock-commands", changed: true }))
const mockRemoveNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/mock-skills", changed: true }))
const mockRemoveGlobalWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))
const mockReadWunderkindConfigForScope = mock<(scope: InstallScope) => Partial<InstallConfig> | null>(() => null)
const mockReadGlobalWunderkindConfig = mock(() => null)
const mockReadProjectWunderkindConfig = mock(() => null)
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
  designTool: "none" as const,
  designPath: "./DESIGN.md",
  designMcpOwnership: "none" as const,
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
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
  removeNativeAgentFiles: mockRemoveNativeAgentFiles,
  removeNativeCommandFiles: mockRemoveNativeCommandFiles,
  removeNativeSkillFiles: mockRemoveNativeSkillFiles,
  removeGlobalWunderkindConfig: mockRemoveGlobalWunderkindConfig,
  getDefaultGlobalConfig: () => ({
    region: "Global",
    industry: "",
    primaryRegulation: "GDPR",
    secondaryRegulation: "",
  }),
  readWunderkindConfigForScope: mockReadWunderkindConfigForScope,
  readGlobalWunderkindConfig: mockReadGlobalWunderkindConfig,
  readProjectWunderkindConfig: mockReadProjectWunderkindConfig,
  detectCurrentConfig: mockDetectCurrentConfig,
  detectOmoInstallReadiness: mockDetectOmoInstallReadiness,
  detectLegacyConfig: mockDetectLegacyConfig,
  detectGitHubWorkflowReadiness: () => ({
    isGitRepo: false,
    hasGitHubRemote: false,
    ghInstalled: false,
    authVerified: false,
    authCheckAttempted: false,
  }),
  detectNativeAgentFiles: () => ({ dir: "/tmp/mock-agents", presentCount: 0, totalCount: 0, allPresent: false }),
  detectNativeCommandFiles: () => ({ dir: "/tmp/mock-commands", presentCount: 0, totalCount: 0, allPresent: false }),
  detectNativeSkillFiles: () => ({ dir: "/tmp/mock-skills", presentCount: 0, totalCount: 0, allPresent: false }),
  getNativeCommandFilePaths: () => [],
  detectOmoVersionInfo: () => ({
    packageName: "oh-my-openagent",
    currentVersion: null,
    registeredEntry: null,
    registeredVersion: null,
    loadedVersion: null,
    configPath: null,
    configSource: null,
    legacyConfigPath: null,
    loadedPackagePath: null,
    registered: false,
    loadedSources: {
      global: { version: null, packagePath: null },
      cache: { version: null, packagePath: null },
    },
    staleOverrideWarning: null,
    versionSkewWarning: null,
    dualConfigWarning: null,
    freshness: null,
  }),
  detectWunderkindVersionInfo: () => ({
    packageName: "@grant-vine/wunderkind",
    currentVersion: null,
    registeredEntry: null,
    registeredVersion: null,
    loadedVersion: null,
    configPath: null,
    loadedPackagePath: null,
    registered: false,
    staleOverrideWarning: null,
  }),
  getProjectOverrideMarker: () => ({ marker: "○" as const, sourceLabel: "inherited default" as const }),
  resolveOpenCodeConfigPath: () => ({ path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const }),
})
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, configManagerFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, configManagerFactory)
mock.module(CONFIG_MANAGER_JS_URL, configManagerFactory)
mock.module(CONFIG_MANAGER_TS_URL, configManagerFactory)
mock.module("node:child_process", () => ({
  spawnSync: mockSpawnSync,
}))

const mockAddAiTracesToGitignore = mock<
  () => { success: boolean; added: string[]; alreadyPresent: string[]; error?: string }
>(() => ({ success: true, added: [], alreadyPresent: [] }))

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

async function ensureTuiInstaller(): Promise<void> {
  if (runTuiInstaller !== undefined) {
    return
  }

  const mod = await import(TUI_INSTALLER_URL)
  runTuiInstaller = mod.runTuiInstaller as (scope?: InstallScope) => Promise<number>
}

describe("runTuiInstaller init handoff", () => {
  let originalStdinTTY: boolean | undefined
  let originalStdoutTTY: boolean | undefined

  beforeEach(async () => {
    await ensureTuiInstaller()
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
    mockDetectOmoInstallReadiness.mockClear()
    mockSpawnSync.mockClear()
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
    mockDetectOmoInstallReadiness.mockImplementation(() => ({
      installed: true,
      registered: true,
      loadedVersion: "3.15.3",
      configPath: "/tmp/oh-my-openagent.jsonc",
      configSource: "oh-my-openagent.jsonc",
      legacyConfigPath: null,
      staleOverrideWarning: null,
      versionSkewWarning: null,
      dualConfigWarning: null,
      freshness: null,
      freshnessSummary: {
        state: "not-verified",
        guidance:
          "Latest oh-my-openagent plugin/config naming freshness could not be verified — use `bunx oh-my-opencode get-local-version` for upstream update advice while the package/CLI still use oh-my-opencode.",
      },
      interactiveInstallCommand: "bunx oh-my-opencode install",
      nonTuiInstallCommand: "bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes",
      guidance:
        "upstream now prefers oh-my-openagent for plugin/config naming, but the package and CLI command still remain oh-my-opencode",
    }))
    mockSpawnSync.mockImplementation(() => ({ status: 0, stdout: "", stderr: "" }))
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
      designTool: "none" as const,
      designPath: "./DESIGN.md",
      designMcpOwnership: "none" as const,
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
      designTool: "none" as const,
      designPath: "./DESIGN.md",
      designMcpOwnership: "none" as const,
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

  it("auto-runs the upstream OMO installer when OMO is missing", async () => {
    let readinessChecks = 0
    mockDetectOmoInstallReadiness.mockImplementation(() => {
      readinessChecks += 1

      if (readinessChecks === 1) {
        return {
          installed: false,
          registered: false,
          loadedVersion: null,
          configPath: null,
          configSource: null,
          legacyConfigPath: null,
          staleOverrideWarning: null,
          versionSkewWarning: null,
          dualConfigWarning: null,
          freshness: null,
          freshnessSummary: {
            state: "not-detected",
            guidance:
              "oh-my-openagent plugin/config naming was not detected — keep using the oh-my-opencode package/CLI for installs until upstream renames those too.",
          },
          interactiveInstallCommand: "bunx oh-my-opencode install",
          nonTuiInstallCommand: "bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes",
          guidance:
            "upstream now prefers oh-my-openagent for plugin/config naming, but the package and CLI command still remain oh-my-opencode",
        }
      }

      return {
        installed: true,
        registered: true,
        loadedVersion: "3.17.6",
        configPath: "/tmp/oh-my-openagent.jsonc",
        configSource: "oh-my-openagent.jsonc",
        legacyConfigPath: null,
        staleOverrideWarning: null,
        versionSkewWarning: null,
        dualConfigWarning: null,
        freshness: null,
        freshnessSummary: {
          state: "not-verified",
          guidance:
            "Latest oh-my-openagent plugin/config naming freshness could not be verified — use `bunx oh-my-opencode get-local-version` for upstream update advice while the package/CLI still use oh-my-opencode.",
        },
        interactiveInstallCommand: "bunx oh-my-opencode install",
        nonTuiInstallCommand: "bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes",
        guidance:
          "upstream now prefers oh-my-openagent for plugin/config naming, but the package and CLI command still remain oh-my-opencode",
      }
    })

    mockSelect.mockImplementation(async () => "global")
    mockConfirm.mockImplementation(async () => false)

    const code = await runTuiInstaller("global")
    expect(code).toBe(0)
    expect(mockSpawnSync).toHaveBeenCalledTimes(2)
    expect(mockSpawnSync.mock.calls[0]?.[0]).toBe("bunx")
    expect(mockSpawnSync.mock.calls[0]?.[1]).toEqual(["oh-my-opencode", "--help"])
    expect(mockSpawnSync.mock.calls[1]?.[0]).toBe("bunx")
    expect(mockSpawnSync.mock.calls[1]?.[1]).toEqual(["oh-my-opencode", "install"])
  })

  it("returns 1 with manual guidance when OMO is missing and auto-bootstrap is unavailable", async () => {
    mockDetectOmoInstallReadiness.mockImplementation(() => ({
      installed: false,
      registered: false,
      loadedVersion: null,
      configPath: null,
      configSource: null,
      legacyConfigPath: null,
      staleOverrideWarning: null,
      versionSkewWarning: null,
      dualConfigWarning: null,
      freshness: null,
      freshnessSummary: {
        state: "not-detected",
        guidance:
          "oh-my-openagent plugin/config naming was not detected — keep using the oh-my-opencode package/CLI for installs until upstream renames those too.",
      },
      interactiveInstallCommand: "bunx oh-my-opencode install",
      nonTuiInstallCommand: "bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes",
      guidance:
        "upstream now prefers oh-my-openagent for plugin/config naming, but the package and CLI command still remain oh-my-opencode",
    }))
    mockSpawnSync.mockImplementation(() => ({ status: 1, stdout: "", stderr: "missing" }))

    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "))
    }

    try {
      const code = await runTuiInstaller("global")
      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("bunx oh-my-opencode install"))).toBe(true)
      expect(mockAddPluginToOpenCodeConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.error = originalError
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
      expect(mockLogSuccess.mock.calls.some((call) => String(call[0] ?? "").includes("entries to"))).toBe(true)
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
  it("surfaces OMO drift warnings during TUI install when readiness detects them", async () => {
    mockSelect.mockImplementation(async () => "global")
    mockConfirm.mockImplementation(async () => false)
    mockDetectOmoInstallReadiness.mockImplementation(() => ({
      installed: true,
      registered: true,
      loadedVersion: "3.15.3",
      configPath: "/tmp/oh-my-openagent.jsonc",
      configSource: "oh-my-openagent.jsonc",
      legacyConfigPath: "/tmp/oh-my-opencode.jsonc",
      staleOverrideWarning: "global oh-my-openagent 3.15.3 likely overrides newer cache 3.17.6",
      versionSkewWarning: "upstream get-local-version reports 3.17.6 but the loaded oh-my-openagent package is 3.15.3",
      dualConfigWarning: "canonical oh-my-openagent.jsonc is being used while legacy config still exists at /tmp/oh-my-opencode.jsonc",
      freshness: null,
      freshnessSummary: {
        state: "version-skew",
        guidance:
          "oh-my-openagent reports a newer current version than the package OpenCode appears to have loaded — rerun `bunx oh-my-opencode install`, then restart OpenCode so the active plugin matches upstream.",
      },
      interactiveInstallCommand: "bunx oh-my-opencode install",
      nonTuiInstallCommand: "bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes",
      guidance:
        "upstream now prefers oh-my-openagent for plugin/config naming, but the package and CLI command still remain oh-my-opencode",
    }))

    const code = await runTuiInstaller("global")
    expect(code).toBe(0)
    expect(mockLogWarn.mock.calls.some((call) => String(call[0] ?? "").includes("global oh-my-openagent 3.15.3 likely overrides newer cache 3.17.6"))).toBe(true)
    expect(mockLogWarn.mock.calls.some((call) => String(call[0] ?? "").includes("upstream get-local-version reports 3.17.6"))).toBe(true)
    expect(mockLogWarn.mock.calls.some((call) => String(call[0] ?? "").includes("legacy config still exists"))).toBe(true)
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
