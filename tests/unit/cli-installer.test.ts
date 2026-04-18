import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"
import type { InstallArgs } from "../../src/cli/types.js"
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

function makeDetectedConfig(overrides: Partial<DetectedConfig> = {}): DetectedConfig {
  return {
    isInstalled: false,
    scope: "global" as const,
    projectInstalled: false,
    globalInstalled: false,
    registrationScope: "none" as const,
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
    designTool: "none" as const,
    designPath: "./DESIGN.md",
    designMcpOwnership: "none" as const,
    ...overrides,
  }
}

function makeOmoInstallReadiness(overrides: Partial<OmoInstallReadiness> = {}): OmoInstallReadiness {
  return {
    installed: true,
    registered: true,
    loadedVersion: "3.17.4",
    configPath: "/tmp/oh-my-openagent.jsonc",
    staleOverrideWarning: null,
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
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock(() => makeDetectedConfig())
const mockDetectOmoInstallReadiness = mock(() => makeOmoInstallReadiness())
const mockSpawnSync = mock(() => ({ status: 0, stdout: "", stderr: "" }))

const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/fake/opencode.json" }))
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockGetDefaultGlobalConfig = mock<() => Pick<InstallConfig, "region" | "industry" | "primaryRegulation" | "secondaryRegulation">>(() => ({
  region: "Global",
  industry: "",
  primaryRegulation: "",
  secondaryRegulation: "",
}))
const mockReadWunderkindConfigForScope = mock<(scope: InstallScope) => Partial<InstallConfig> | null>(() => null)
const mockReadGlobalWunderkindConfig = mock(() => null)
const mockReadProjectWunderkindConfig = mock(() => null)
const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockRemoveNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/mock-agents", changed: true }))
const mockRemoveNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/mock-commands", changed: true }))
const mockRemoveNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/mock-skills", changed: true }))
const mockRemoveGlobalWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))
const mockResolveOpenCodeConfigPath = mock((scope: InstallScope) =>
  scope === "project"
    ? { path: join(process.cwd(), "opencode.json"), format: "json" as const, source: "opencode.json" as const }
    : { path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const },
)

const configManagerMockFactory = () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectOmoInstallReadiness: mockDetectOmoInstallReadiness,
  detectLegacyConfig: mockDetectLegacyConfig,
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
  getDefaultGlobalConfig: mockGetDefaultGlobalConfig,
  readWunderkindConfigForScope: mockReadWunderkindConfigForScope,
  readGlobalWunderkindConfig: mockReadGlobalWunderkindConfig,
  readProjectWunderkindConfig: mockReadProjectWunderkindConfig,
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
  removeNativeAgentFiles: mockRemoveNativeAgentFiles,
  removeNativeCommandFiles: mockRemoveNativeCommandFiles,
  removeNativeSkillFiles: mockRemoveNativeSkillFiles,
  removeGlobalWunderkindConfig: mockRemoveGlobalWunderkindConfig,
  resolveOpenCodeConfigPath: mockResolveOpenCodeConfigPath,
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
    loadedPackagePath: null,
    registered: false,
    loadedSources: {
      global: { version: null, packagePath: null },
      cache: { version: null, packagePath: null },
    },
    staleOverrideWarning: null,
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
})

mock.module("node:child_process", () => ({
  spawnSync: mockSpawnSync,
}))

mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, configManagerMockFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, configManagerMockFactory)
mock.module(CONFIG_MANAGER_JS_URL, configManagerMockFactory)
mock.module(CONFIG_MANAGER_TS_URL, configManagerMockFactory)

const mockAddAiTracesToGitignore = mock(() => ({
  success: true,
  added: [".wunderkind/"],
  alreadyPresent: [],
}))

mock.module(`${PROJECT_ROOT}src/cli/gitignore-manager.js`, () => ({
  addAiTracesToGitignore: mockAddAiTracesToGitignore,
}))

const mockMergeStitchMcpConfig = mock(async (projectPath: string) => {
  const configPath = join(projectPath, "opencode.json")
  const existing = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {}
  const updated = {
    ...existing,
    mcp: {
      ...(existing.mcp ?? {}),
      [GOOGLE_STITCH_ADAPTER.serverName]: GOOGLE_STITCH_ADAPTER.getOpenCodePayload(false),
    },
  }
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(updated, null, 2)}\n`)
})
const mockDetectStitchMcpPresence = mock(async (_projectPath?: string) => "missing" as const)
const mockWriteStitchSecretFile = mock(async (_apiKey: string, _cwd: string) => {})

mock.module(`${PROJECT_ROOT}src/cli/mcp-helpers.js`, () => ({
  detectStitchMcpPresence: mockDetectStitchMcpPresence,
  mergeStitchMcpConfig: mockMergeStitchMcpConfig,
  writeStitchSecretFile: mockWriteStitchSecretFile,
}))

type CliInstallerModule = {
  printBox: (content: string, title?: string) => void
  printWarning: (message: string) => void
  validateNonTuiArgs: (args: InstallArgs) => { valid: boolean; errors: string[] }
  runCliInstaller: (...args: unknown[]) => Promise<number>
  runCliUpgrade: (...args: unknown[]) => Promise<number>
}

const cliInstallerModulePromise = import(new URL("src/cli/cli-installer.ts", `file://${PROJECT_ROOT}`).href) as Promise<CliInstallerModule>

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

function readProjectMcpConfig(projectRoot: string): Record<string, unknown> | undefined {
  const configPath = join(projectRoot, "opencode.json")
  if (!existsSync(configPath)) {
    return undefined
  }

  const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as unknown
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined
  }

  const mcp = (parsed as Record<string, unknown>).mcp
  if (typeof mcp !== "object" || mcp === null || Array.isArray(mcp)) {
    return undefined
  }

  return mcp as Record<string, unknown>
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
  it("allows missing global baseline flags when defaults are acceptable", async () => {
    const { validateNonTuiArgs } = await cliInstallerModulePromise
    const result = validateNonTuiArgs(baseArgs({ region: undefined }))
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("allows project scope without baseline flags", async () => {
    const { validateNonTuiArgs } = await cliInstallerModulePromise
    const result = validateNonTuiArgs(baseArgs({
      scope: "project",
      region: undefined,
      industry: undefined,
      primaryRegulation: undefined,
      secondaryRegulation: undefined,
    }))
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})

describe("cli output helpers", () => {
  it("prints warning and untitled boxes", async () => {
    const { printBox, printWarning } = await cliInstallerModulePromise
    const messages: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      printWarning("warn")
      printBox("line one\nline two")
      expect(messages.some((message) => message.includes("warn"))).toBe(true)
      expect(messages.some((message) => message.includes("┌"))).toBe(true)
      expect(messages.some((message) => message.includes("└"))).toBe(true)
    } finally {
      console.log = originalLog
    }
  })
})

describe("runCliInstaller", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectOmoInstallReadiness.mockClear()
    mockSpawnSync.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockAddPluginToOpenCodeConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockGetDefaultGlobalConfig.mockClear()
    mockReadWunderkindConfigForScope.mockClear()
    mockAddAiTracesToGitignore.mockClear()
    mockMergeStitchMcpConfig.mockClear()
    mockDetectStitchMcpPresence.mockClear()
    mockWriteStitchSecretFile.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
    mockDetectOmoInstallReadiness.mockImplementation(() => makeOmoInstallReadiness())
    mockSpawnSync.mockImplementation(() => ({ status: 0, stdout: "", stderr: "" }))
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/fake/opencode.json" }))
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-agents" }))
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands" }))
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-skills" }))
    mockReadWunderkindConfigForScope.mockImplementation(() => null)
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: true, added: [".wunderkind/"], alreadyPresent: [] }))
  })

  it("returns 1 when legacy config is detected", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockDetectLegacyConfig.mockImplementation(() => true)
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 with install guidance when OMO is missing for non-interactive install", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const messages: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "))
    }
    mockDetectOmoInstallReadiness.mockImplementation(() =>
      makeOmoInstallReadiness({
        installed: false,
        registered: false,
        loadedVersion: null,
        configPath: null,
      }),
    )

    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
      expect(messages.some((message) => message.includes("oh-my-openagent must already be installed"))).toBe(true)
      expect(messages.some((message) => message.includes("bunx oh-my-opencode install --no-tui"))).toBe(true)
      expect(mockAddPluginToOpenCodeConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = origLog
    }
  })

  it("returns 0 for a successful install with scope=global", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs({ scope: "global" }))
      expect(code).toBe(0)
    } finally {
      restore()
    }
  })

  it("allows successful project install without baseline flags", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockDetectCurrentConfig.mockImplementation(() =>
      makeDetectedConfig({
        isInstalled: true,
        scope: "project",
        projectInstalled: true,
        globalInstalled: true,
        registrationScope: "both",
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }),
    )

    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs({
        scope: "project",
        region: undefined,
        industry: undefined,
        primaryRegulation: undefined,
        secondaryRegulation: undefined,
      }))
      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("calls addPluginToOpenCodeConfig with 'project' when scope=project", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
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

  it("calls writeNativeAgentFiles once for project scope install", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "project" }))
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("calls native command writer for project scope install and refreshes the global command copy", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "project" }))
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("calls writeNativeAgentFiles for global scope install", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "global" }))
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("calls native command and skill writers for global scope install", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "global" }))
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("writes only baseline fields into the selected install scope", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs())
      const calls = mockWriteWunderkindConfig.mock.calls
      const installConfigArg = calls[0]?.[0] as Record<string, unknown> | undefined
      expect(installConfigArg?.region).toBe("South Africa")
      expect(installConfigArg?.industry).toBe("SaaS")
      expect(installConfigArg?.primaryRegulation).toBe("POPIA")
      expect(installConfigArg?.secondaryRegulation).toBe("")
    } finally {
      restore()
    }
  })

  it("does not copy project-local soul/docs fields from scope config into install writes", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockDetectCurrentConfig.mockImplementation(() =>
      makeDetectedConfig({
        isInstalled: true,
        scope: "global",
        projectInstalled: true,
        globalInstalled: true,
        registrationScope: "both",
        teamCulture: "experimental-informal",
        orgStructure: "hierarchical",
        cisoPersonality: "educator-collaborator",
        ctoPersonality: "startup-bro",
        cmoPersonality: "growth-hacker",
        productPersonality: "velocity-optimizer",
        creativePersonality: "bold-provocateur",
        legalPersonality: "cautious-gatekeeper",
        docsEnabled: true,
        docsPath: "./project-docs",
        docHistoryMode: "append-dated",
      }),
    )

    mockReadWunderkindConfigForScope.mockImplementation((scope: string) => {
      if (scope === "global") {
        return {
          region: "Africa",
          industry: "Agency",
        }
      }
      return null
    })

    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "global" }))
      const calls = mockWriteWunderkindConfig.mock.calls
      const installConfigArg = calls[0]?.[0] as Record<string, unknown>
      expect(installConfigArg.region).toBe("South Africa")
      expect(installConfigArg.industry).toBe("SaaS")
      expect(installConfigArg.teamCulture).toBe("experimental-informal")
      expect(installConfigArg.docsEnabled).toBe(true)
    } finally {
      restore()
    }
  })

  it("returns 1 when plugin registration fails", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: false, configPath: "/fake/opencode.json", error: "boom" }))
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when config write fails", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: false, configPath: "/fake/.wunderkind/config", error: "boom" }))
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when native command write fails and warns on gitignore error", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-commands", error: "boom" }))
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: false, added: [], alreadyPresent: [], error: "nope" }))
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when native agent file write fails", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-agents", error: "agent-write-fail" }))
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when native skill file write fails", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-skills", error: "skill-write-fail" }))
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("warns on gitignore error but still returns 0", async () => {
    const { runCliInstaller } = await cliInstallerModulePromise
    const warnings: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: false, added: [], alreadyPresent: [], error: "readonly filesystem" }))
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(0)
      expect(warnings.some((w) => w.includes("readonly filesystem"))).toBe(true)
    } finally {
      console.log = origLog
    }
  })
})

describe("runCliUpgrade", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectOmoInstallReadiness.mockClear()
    mockSpawnSync.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockReadWunderkindConfigForScope.mockClear()
    mockResolveOpenCodeConfigPath.mockClear()
    mockMergeStitchMcpConfig.mockClear()
    mockDetectStitchMcpPresence.mockClear()
    mockWriteStitchSecretFile.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig({ isInstalled: true, globalInstalled: true, registrationScope: "global" }))
    mockDetectOmoInstallReadiness.mockImplementation(() => makeOmoInstallReadiness())
    mockSpawnSync.mockImplementation(() => ({ status: 0, stdout: "", stderr: "" }))
    mockReadWunderkindConfigForScope.mockImplementation((scope: InstallScope) =>
      scope === "global"
        ? {
            region: "Australia",
            industry: "SaaS",
            primaryRegulation: "",
            secondaryRegulation: "",
          }
        : null,
    )
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-agents" }))
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands" }))
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-skills" }))
    mockResolveOpenCodeConfigPath.mockImplementation((scope: InstallScope) =>
      scope === "project"
        ? { path: join(process.cwd(), "opencode.json"), format: "json" as const, source: "opencode.json" as const }
        : { path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const },
    )
  })

  it("fails if Wunderkind is not installed in the requested scope", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig({ isInstalled: false, globalInstalled: false, registrationScope: "none" }))
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 with install guidance when OMO is missing for upgrade", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    const messages: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "))
    }
    mockDetectOmoInstallReadiness.mockImplementation(() =>
      makeOmoInstallReadiness({
        installed: false,
        registered: false,
        loadedVersion: null,
        configPath: null,
      }),
    )

    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
      expect(messages.some((message) => message.includes("oh-my-openagent must already be installed"))).toBe(true)
      expect(messages.some((message) => message.includes("bunx oh-my-opencode install --no-tui"))).toBe(true)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(0)
    } finally {
      console.log = origLog
    }
  })

  it("refreshes native assets by default even when no baseline overrides are requested", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("supports dry-run without writing config or native assets", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global", dryRun: true })
      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(0)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(0)
    } finally {
      restore()
    }
  })

  it("rewrites config when refresh-config is passed", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global", refreshConfig: true })
      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("updates only global baseline fields when explicit overrides are provided", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global", region: "South Africa" })
      expect(code).toBe(0)
      const configArg = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(configArg.region).toBe("South Africa")
      expect(configArg.teamCulture).toBe("pragmatic-balanced")
      expect(configArg.docsEnabled).toBe(false)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("preserves project baseline fields on project refresh-config when no overrides are provided", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockDetectCurrentConfig.mockImplementation(() =>
      makeDetectedConfig({
        isInstalled: true,
        scope: "project",
        projectInstalled: true,
        globalInstalled: false,
        registrationScope: "project",
        region: "Project Region",
        industry: "Project Industry",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }),
    )
    mockReadWunderkindConfigForScope.mockImplementation((scope: InstallScope) =>
      scope === "project"
        ? {
            region: "Project Region",
            industry: "Project Industry",
            primaryRegulation: "POPIA",
            secondaryRegulation: "GDPR",
          }
        : null,
    )

    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "project", refreshConfig: true })
      expect(code).toBe(0)
      const configArg = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(configArg.region).toBe("Project Region")
      expect(configArg.industry).toBe("Project Industry")
      expect(configArg.primaryRegulation).toBe("POPIA")
      expect(configArg.secondaryRegulation).toBe("GDPR")
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("uses detected effective baseline values for project refresh-config when sparse project overrides omit them", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockDetectCurrentConfig.mockImplementation(() =>
      makeDetectedConfig({
        isInstalled: true,
        scope: "project",
        projectInstalled: true,
        globalInstalled: true,
        registrationScope: "both",
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }),
    )
    mockReadWunderkindConfigForScope.mockImplementation((scope: InstallScope) =>
      scope === "project"
        ? {
            teamCulture: "pragmatic-balanced",
            docsEnabled: false,
          }
        : null,
    )

    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "project", refreshConfig: true })
      expect(code).toBe(0)
      const configArg = mockWriteWunderkindConfig.mock.calls[0]?.[0] as Record<string, unknown>
      expect(configArg.region).toBe("South Africa")
      expect(configArg.industry).toBe("SaaS")
      expect(configArg.primaryRegulation).toBe("POPIA")
      expect(configArg.secondaryRegulation).toBe("GDPR")
    } finally {
      restore()
    }
  })

  it("returns 1 when refresh config write fails", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: false, configPath: "/fake/.wunderkind/config", error: "boom" }))
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global", refreshConfig: true })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when native refresh fails", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-agents", error: "boom" }))
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when legacy config is detected during upgrade", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockDetectLegacyConfig.mockImplementation(() => true)
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("prints dry-run config line when dryRun=true and refreshConfig=true", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    const messages: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "))
    }
    try {
      const code = await runCliUpgrade({ scope: "global", dryRun: true, refreshConfig: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("would rewrite Wunderkind config"))).toBe(true)
    } finally {
      console.log = origLog
    }
  })

  it("returns 1 when writeNativeCommandFiles fails during upgrade", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-commands", error: "cmd-fail" }))
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 1 when writeNativeSkillFiles fails during upgrade", async () => {
    const { runCliUpgrade } = await cliInstallerModulePromise
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-skills", error: "skill-fail" }))
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  describe("upgrade Stitch reconciliation", () => {
    it("reconciles Stitch MCP config for wunderkind-managed project ownership", async () => {
      const { runCliUpgrade } = await cliInstallerModulePromise
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-upgrade-managed-stitch-"))
      const originalCwd = process.cwd()
      mockDetectCurrentConfig.mockImplementation(() =>
        makeDetectedConfig({
          isInstalled: true,
          scope: "project",
          projectInstalled: true,
          globalInstalled: true,
          registrationScope: "both",
          designTool: "google-stitch",
          designMcpOwnership: "wunderkind-managed",
        }),
      )

      try {
        process.chdir(projectRoot)
        writeFileSync(
          join(projectRoot, "opencode.json"),
          `${JSON.stringify({
            $schema: "https://opencode.ai/config.json",
            mcp: {
              [GOOGLE_STITCH_ADAPTER.serverName]: {
                type: "remote",
                url: "https://stitch.googleapis.com/mcp",
                enabled: true,
                oauth: true,
                headers: {},
              },
            },
          }, null, 2)}\n`,
        )

        const restore = silenceConsole()
        try {
          const code = await runCliUpgrade({ scope: "project" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const mcp = readProjectMcpConfig(projectRoot)
        expect(mcp?.[GOOGLE_STITCH_ADAPTER.serverName]).toEqual(GOOGLE_STITCH_ADAPTER.getOpenCodePayload(false))
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("preserves reused-project Stitch ownership during project upgrade", async () => {
      const { runCliUpgrade } = await cliInstallerModulePromise
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-upgrade-reused-project-stitch-"))
      const originalCwd = process.cwd()
      mockDetectCurrentConfig.mockImplementation(() =>
        makeDetectedConfig({
          isInstalled: true,
          scope: "project",
          projectInstalled: true,
          globalInstalled: true,
          registrationScope: "both",
          designTool: "google-stitch",
          designMcpOwnership: "reused-project",
        }),
      )

      try {
        process.chdir(projectRoot)
        writeFileSync(join(projectRoot, "opencode.json"), `${JSON.stringify({ mcp: {} }, null, 2)}\n`)

        const restore = silenceConsole()
        try {
          const code = await runCliUpgrade({ scope: "project" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const mcp = readProjectMcpConfig(projectRoot)
        expect(mcp?.[GOOGLE_STITCH_ADAPTER.serverName]).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("preserves reused-global Stitch ownership during project upgrade", async () => {
      const { runCliUpgrade } = await cliInstallerModulePromise
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-upgrade-reused-global-stitch-"))
      const originalCwd = process.cwd()
      mockDetectCurrentConfig.mockImplementation(() =>
        makeDetectedConfig({
          isInstalled: true,
          scope: "project",
          projectInstalled: true,
          globalInstalled: true,
          registrationScope: "both",
          designTool: "google-stitch",
          designMcpOwnership: "reused-global",
        }),
      )

      try {
        process.chdir(projectRoot)
        writeFileSync(join(projectRoot, "opencode.json"), `${JSON.stringify({ mcp: {} }, null, 2)}\n`)

        const restore = silenceConsole()
        try {
          const code = await runCliUpgrade({ scope: "project" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const mcp = readProjectMcpConfig(projectRoot)
        expect(mcp?.[GOOGLE_STITCH_ADAPTER.serverName]).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("skips Stitch reconciliation when design workflow is absent", async () => {
      const { runCliUpgrade } = await cliInstallerModulePromise
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-upgrade-no-design-stitch-"))
      const originalCwd = process.cwd()
      mockDetectCurrentConfig.mockImplementation(() =>
        makeDetectedConfig({
          isInstalled: true,
          scope: "project",
          projectInstalled: true,
          globalInstalled: true,
          registrationScope: "both",
          designTool: "none",
          designMcpOwnership: "none",
        }),
      )

      try {
        process.chdir(projectRoot)
        writeFileSync(join(projectRoot, "opencode.json"), `${JSON.stringify({ mcp: {} }, null, 2)}\n`)

        const restore = silenceConsole()
        try {
          const code = await runCliUpgrade({ scope: "project" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const mcp = readProjectMcpConfig(projectRoot)
        expect(mcp?.[GOOGLE_STITCH_ADAPTER.serverName]).toBeUndefined()
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })
  })
})

describe("docs-output-helper", () => {
  it("validateDocsPath rejects absolute paths", async () => {
    const { validateDocsPath } = await import("../../src/cli/docs-output-helper.js")
    expect(validateDocsPath("/tmp/docs")).toEqual({ valid: false, error: "docsPath must be a relative path" })
  })

  it("validateDocsPath rejects parent traversal paths", async () => {
    const { validateDocsPath } = await import("../../src/cli/docs-output-helper.js")
    expect(validateDocsPath("../docs")).toEqual({ valid: false, error: "docsPath must not traverse parent directories" })
    expect(validateDocsPath("safe/../docs")).toEqual({ valid: false, error: "docsPath must not traverse parent directories" })
  })

  it("validateDocsPath accepts a relative path", async () => {
    const { validateDocsPath } = await import("../../src/cli/docs-output-helper.js")
    expect(validateDocsPath("./docs/outputs")).toEqual({ valid: true })
  })

  it("validateDocHistoryMode accepts valid modes and rejects invalid mode", async () => {
    const { validateDocHistoryMode } = await import("../../src/cli/docs-output-helper.js")
    expect(validateDocHistoryMode("overwrite")).toBe(true)
    expect(validateDocHistoryMode("append-dated")).toBe(true)
    expect(validateDocHistoryMode("new-dated-file")).toBe(true)
    expect(validateDocHistoryMode("overwrite-archive")).toBe(true)
    expect(validateDocHistoryMode("rolling")).toBe(false)
  })

  it("bootstrapDocsReadme creates nested dirs and README.md when missing", async () => {
    const { tmpdir } = await import("node:os")
    const { mkdtempSync } = await import("node:fs")
    const { bootstrapDocsReadme } = await import("../../src/cli/docs-output-helper.js")

    const testRoot = mkdtempSync(join(tmpdir(), "wk-docs-helper-"))
    try {
      const docsPath = "nested/docs/output"
      const readmePath = join(testRoot, docsPath, "README.md")

      bootstrapDocsReadme(docsPath, testRoot)

      expect(existsSync(readmePath)).toBe(true)
      expect(readFileSync(readmePath, "utf-8")).toBe(
        "# Documentation\n\nThis directory contains project documentation artifacts generated by Wunderkind agents.\n",
      )
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("bootstrapDocsReadme does not overwrite existing README.md", async () => {
    const { tmpdir } = await import("node:os")
    const { mkdtempSync } = await import("node:fs")
    const { bootstrapDocsReadme } = await import("../../src/cli/docs-output-helper.js")

    const testRoot = mkdtempSync(join(tmpdir(), "wk-docs-helper-"))
    try {
      const docsPath = "docs"
      const docsDir = join(testRoot, docsPath)
      const readmePath = join(docsDir, "README.md")

      mkdirSync(docsDir, { recursive: true })
      writeFileSync(readmePath, "# Existing\n")

      bootstrapDocsReadme(docsPath, testRoot)

      expect(readFileSync(readmePath, "utf-8")).toBe("# Existing\n")
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})

describe("writeNativeAgentFiles", () => {
  it("is idempotent — second call overwrites without error", async () => {
    const { writeNativeAgentFiles } = await import(`../../src/cli/config-manager/index.ts?native-agent-idempotent=${Date.now()}`)
    const testRoot = mkdtempSync(join(tmpdir(), "wk-native-agent-idempotent-"))
    const originalCwd = process.cwd()

    try {
      process.chdir(testRoot)
      const r1 = writeNativeAgentFiles("project")
      const r2 = writeNativeAgentFiles("project")

      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    } finally {
      process.chdir(originalCwd)
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})

describe("writeNativeCommandFiles", () => {
})

describe("writeNativeSkillFiles", () => {
})
