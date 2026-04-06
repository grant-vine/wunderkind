import { beforeEach, describe, expect, it, mock } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"
import type { DetectedConfig, InstallConfig, OmoFreshnessInfo, PluginVersionInfo } from "../../src/cli/types.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href
function createDetectedConfig(overrides: Partial<DetectedConfig> = {}): DetectedConfig {
  return {
    isInstalled: false,
    scope: "global",
    projectInstalled: false,
    globalInstalled: false,
    registrationScope: "none",
    region: "Global",
    industry: "",
    primaryRegulation: "",
    secondaryRegulation: "",
    teamCulture: "pragmatic-balanced",
    orgStructure: "flat",
    cisoPersonality: "pragmatic-risk-manager",
    ctoPersonality: "code-archaeologist",
    cmoPersonality: "data-driven",
    productPersonality: "outcome-obsessed",
    creativePersonality: "pragmatic-problem-solver",
    legalPersonality: "pragmatic-advisor",
    docsEnabled: false,
    docsPath: "./docs",
    docHistoryMode: "overwrite",
    prdPipelineMode: "filesystem",
    designTool: "none",
    designPath: "./DESIGN.md",
    designMcpOwnership: "none",
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock<() => unknown>(() => createDetectedConfig())
const mockReadWunderkindConfig = mock<() => Partial<InstallConfig> | null>(() => null)

const mockReadGlobalWunderkindConfig = mock(() => null)
const mockReadProjectWunderkindConfig = mock<() => Record<string, unknown> | null>(() => null)
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockRemoveNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/mock-agents", changed: true }))
const mockRemoveNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/mock-commands", changed: true }))
const mockRemoveNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/mock-skills", changed: true }))
const mockRemoveGlobalWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))
const mockReadWunderkindConfigForScope = mock<() => Partial<InstallConfig> | null>(() => null)
const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json" }))
const mockDetectNativeAgentFiles = mock((scope: "global" | "project") => ({
  dir: scope === "global" ? "/tmp/global-agents" : `${process.cwd()}/.opencode/agents`,
  presentCount: 6,
  totalCount: 6,
  allPresent: true,
}))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockDetectNativeCommandFiles = mock(() => ({
  dir: "/tmp/global-commands",
  presentCount: 38,
  totalCount: 38,
  allPresent: true,
}))
const mockGetNativeCommandFilePaths = mock<() => string[]>(() => [
  "/tmp/global-commands/docs-index.md",
  "/tmp/global-commands/design-md.md",
  "/tmp/global-commands/dream.md",
])
const mockDetectNativeSkillFiles = mock((scope: "global" | "project") => ({
  dir: scope === "global" ? "/tmp/global-skills" : `${process.cwd()}/.opencode/skills`,
  presentCount: 11,
  totalCount: 11,
  allPresent: true,
}))
const mockDetectWunderkindVersionInfo = mock<() => PluginVersionInfo>(() => ({
  packageName: "@grant-vine/wunderkind",
  currentVersion: "0.9.4" as string | null,
  registeredEntry: "@grant-vine/wunderkind" as string | null,
  registeredVersion: null,
  loadedVersion: "0.9.4" as string | null,
  configPath: "/tmp/opencode.json" as string | null,
  loadedPackagePath: "/tmp/node_modules/@grant-vine/wunderkind/package.json" as string | null,
  registered: true,
  staleOverrideWarning: null,
}))
const mockDetectOmoVersionInfo = mock<() => PluginVersionInfo>(() => ({
  packageName: "oh-my-openagent",
  currentVersion: null,
  registeredEntry: "oh-my-openagent@3.12.2" as string | null,
  registeredVersion: null,
  loadedVersion: "3.12.2" as string | null,
  configPath: "/tmp/opencode.json" as string | null,
  loadedPackagePath: "/tmp/node_modules/oh-my-openagent/package.json" as string | null,
  registered: true,
  loadedSources: {
    global: {
      version: "3.12.2" as string | null,
      packagePath: "/tmp/node_modules/oh-my-openagent/package.json" as string | null,
    },
    cache: {
      version: null,
      packagePath: null,
    },
  },
  staleOverrideWarning: null,
  freshness: {
    status: "unknown",
    currentVersion: "3.12.2",
    latestVersion: null,
    pinnedVersion: null,
    renderedOutput: null,
  },
}))

function createOmoFreshness(overrides: Partial<OmoFreshnessInfo> = {}): OmoFreshnessInfo {
  return {
    status: "unknown",
    currentVersion: "3.12.2",
    latestVersion: null,
    pinnedVersion: null,
    renderedOutput: null,
    ...overrides,
  }
}
const mockResolveOpenCodeConfigPath = mock((scope: "global" | "project") =>
  scope === "global"
    ? { path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const }
    : { path: `${process.cwd()}/opencode.json`, format: "json" as const, source: "opencode.json" as const },
)
const mockDetectGitHubWorkflowReadiness = mock(() => ({
  isGitRepo: true,
  hasGitHubRemote: true,
  ghInstalled: true,
  authVerified: true,
  authCheckAttempted: true,
}))

const mockDetectStitchMcpPresence = mock<(_projectPath?: string) => Promise<"missing" | "project-local" | "global-only" | "both">>(
  async () => "missing",
)

mock.module(`${PROJECT_ROOT}src/cli/mcp-helpers.js`, () => ({
  detectStitchMcpPresence: mockDetectStitchMcpPresence,
  mergeStitchMcpConfig: mock(async () => {}),
  writeStitchSecretFile: mock(async () => {}),
}))

const configManagerMockFactory = () => ({
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  detectCurrentConfig: mockDetectCurrentConfig,
  detectLegacyConfig: mockDetectLegacyConfig,
  detectGitHubWorkflowReadiness: mockDetectGitHubWorkflowReadiness,
  detectNativeAgentFiles: mockDetectNativeAgentFiles,
  detectNativeCommandFiles: mockDetectNativeCommandFiles,
  detectNativeSkillFiles: mockDetectNativeSkillFiles,
  detectOmoVersionInfo: mockDetectOmoVersionInfo,
  detectWunderkindVersionInfo: mockDetectWunderkindVersionInfo,
  getNativeCommandFilePaths: mockGetNativeCommandFilePaths,
  readWunderkindConfig: mockReadWunderkindConfig,
  readWunderkindConfigForScope: mockReadWunderkindConfigForScope,
  readGlobalWunderkindConfig: mockReadGlobalWunderkindConfig,
  readProjectWunderkindConfig: mockReadProjectWunderkindConfig,
  removePluginFromOpenCodeConfig: mockRemovePluginFromOpenCodeConfig,
  removeNativeAgentFiles: mockRemoveNativeAgentFiles,
  removeNativeCommandFiles: mockRemoveNativeCommandFiles,
  removeNativeSkillFiles: mockRemoveNativeSkillFiles,
  removeGlobalWunderkindConfig: mockRemoveGlobalWunderkindConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
  resolveOpenCodeConfigPath: mockResolveOpenCodeConfigPath,
  getProjectOverrideMarker: () => ({ marker: "○" as const, sourceLabel: "inherited default" }),
})

mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, configManagerMockFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, configManagerMockFactory)
mock.module(CONFIG_MANAGER_JS_URL, configManagerMockFactory)
mock.module(CONFIG_MANAGER_TS_URL, configManagerMockFactory)

mock.module("picocolors", () => ({
  default: {
    green: (s: string) => `[green]${s}[/green]`,
    red: (s: string) => `[red]${s}[/red]`,
    dim: (s: string) => `[dim]${s}[/dim]`,
    cyan: (s: string) => `[cyan]${s}[/cyan]`,
    blue: (s: string) => `[blue]${s}[/blue]`,
    white: (s: string) => `[white]${s}[/white]`,
    bold: (s: string) => `[bold]${s}[/bold]`,
    yellow: (s: string) => `[yellow]${s}[/yellow]`,
    bgMagenta: (s: string) => `[bgMagenta]${s}[/bgMagenta]`,
  },
}))

let runDoctor: () => Promise<number>
let runDoctorWithOptions: (options: { verbose?: boolean }) => Promise<number>
let isProjectContext: (cwd: string) => boolean
let runInit: (options: { noTui: boolean }) => Promise<number>

beforeEach(async () => {
  if (runDoctor !== undefined) {
    return
  }

  const doctorMod = await import(new URL("src/cli/doctor.ts", `file://${PROJECT_ROOT}`).href)
  runDoctor = doctorMod.runDoctor
  runDoctorWithOptions = doctorMod.runDoctorWithOptions
  const initMod = await import(new URL("src/cli/init.ts", `file://${PROJECT_ROOT}`).href)
  isProjectContext = initMod.isProjectContext
  runInit = initMod.runInit
})

function silenceConsole(): () => void {
  const originalLog = console.log
  const originalError = console.error
  console.log = () => {}
  console.error = () => {}
  return () => {
    console.log = originalLog
    console.error = originalError
  }
}

async function captureDoctorOutput(options: { verbose?: boolean } = {}): Promise<{ code: number; messages: string[] }> {
  const messages: string[] = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (...args: unknown[]) => {
    messages.push(args.map((arg) => String(arg)).join(" "))
  }
  console.error = (...args: unknown[]) => {
    messages.push(args.map((arg) => String(arg)).join(" "))
  }

  try {
    const code = await runDoctorWithOptions(options)
    return { code, messages }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

function writeProjectHealthFixture(projectPath: string): void {
  writeFileSync(join(projectPath, "package.json"), "{}")
  writeFileSync(join(projectPath, "AGENTS.md"), "# AGENTS\n")
  mkdirSync(join(projectPath, ".sisyphus", "plans"), { recursive: true })
  mkdirSync(join(projectPath, ".sisyphus", "notepads"), { recursive: true })
  mkdirSync(join(projectPath, ".sisyphus", "evidence"), { recursive: true })
  mkdirSync(join(projectPath, ".wunderkind"), { recursive: true })
  writeFileSync(join(projectPath, ".wunderkind", "wunderkind.config.jsonc"), "{}\n")
}

function mockProjectDoctorContext(
  projectPath: string,
  overrides: Partial<DetectedConfig> = {},
  projectConfig: Record<string, unknown> | null = null,
): { projectOpenCodePath: string; globalOpenCodePath: string } {
  const projectOpenCodePath = join(projectPath, "opencode.json")
  const globalOpenCodePath = join(projectPath, "global-opencode.json")

  mockResolveOpenCodeConfigPath.mockImplementation((scope: "global" | "project") =>
    scope === "global"
      ? { path: globalOpenCodePath, format: "json" as const, source: "opencode.json" as const }
      : { path: projectOpenCodePath, format: "json" as const, source: "opencode.json" as const },
  )

  mockDetectCurrentConfig.mockImplementation((): DetectedConfig =>
    createDetectedConfig({
      isInstalled: true,
      scope: "project",
      projectInstalled: true,
      globalInstalled: true,
      registrationScope: "both",
      projectOpenCodeConfigPath: projectOpenCodePath,
      globalOpenCodeConfigPath: globalOpenCodePath,
      region: "Project Region",
      industry: "SaaS",
      primaryRegulation: "POPIA",
      secondaryRegulation: "",
      ...overrides,
    }),
  )

  mockReadProjectWunderkindConfig.mockImplementation(() => projectConfig)

  return { projectOpenCodePath, globalOpenCodePath }
}

describe("isProjectContext", () => {
  it("returns true when package.json exists in cwd", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "wk-project-context-"))
    try {
      writeFileSync(join(tempRoot, "package.json"), "{}")
      expect(isProjectContext(tempRoot)).toBe(true)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it("returns false for an empty directory", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "wk-project-context-"))
    try {
      expect(isProjectContext(tempRoot)).toBe(false)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

describe("runInit", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockDetectNativeAgentFiles.mockClear()
    mockDetectNativeCommandFiles.mockClear()
    mockDetectNativeSkillFiles.mockClear()
    mockDetectWunderkindVersionInfo.mockClear()
    mockDetectOmoVersionInfo.mockClear()
    mockReadWunderkindConfig.mockClear()
    mockReadWunderkindConfig.mockImplementation(() => null)
    mockDetectCurrentConfig.mockImplementation(() =>
      createDetectedConfig({
        isInstalled: false,
        scope: "global",
      }),
    )
  })

  it("returns 1 when Wunderkind is not installed", async () => {
    const restore = silenceConsole()
    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("calls writeNativeAgentFiles when in project context", async () => {
    const restore = silenceConsole()
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-init-doctor-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectCurrentConfig.mockImplementation(() =>
      createDetectedConfig({
        isInstalled: true,
        scope: "global",
        projectInstalled: false,
        globalInstalled: true,
        registrationScope: "global",
        projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
        globalOpenCodeConfigPath: "/tmp/opencode.json",
      }),
    )

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(0)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockWriteNativeSkillFiles).toHaveBeenCalledTimes(1)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
      restore()
    }
  })
})

describe("runDoctor", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectOmoVersionInfo.mockClear()
    mockReadGlobalWunderkindConfig.mockClear()
    mockReadProjectWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockResolveOpenCodeConfigPath.mockClear()
    mockDetectGitHubWorkflowReadiness.mockClear()
    mockDetectStitchMcpPresence.mockClear()
    mockDetectStitchMcpPresence.mockImplementation(async () => "missing")
    mockDetectOmoVersionInfo.mockImplementation(() => ({
      packageName: "oh-my-openagent",
      currentVersion: null,
      registeredEntry: "oh-my-openagent@3.12.2" as string | null,
      registeredVersion: null,
      loadedVersion: "3.12.2" as string | null,
      configPath: "/tmp/opencode.json" as string | null,
      loadedPackagePath: "/tmp/node_modules/oh-my-openagent/package.json" as string | null,
      registered: true,
      loadedSources: {
        global: {
          version: "3.12.2" as string | null,
          packagePath: "/tmp/node_modules/oh-my-openagent/package.json" as string | null,
        },
        cache: {
          version: null,
          packagePath: null,
        },
      },
      staleOverrideWarning: null,
      freshness: {
        status: "unknown",
        currentVersion: "3.12.2",
        latestVersion: null,
        pinnedVersion: null,
        renderedOutput: null,
      },
    }))
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "global" as const,
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
    }))
    mockReadGlobalWunderkindConfig.mockImplementation(() => null)
    mockReadProjectWunderkindConfig.mockImplementation(() => null)
  })

  it("shows 'gh auth verified: not checked' when auth was not attempted", async () => {
    mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
      isGitRepo: true,
      hasGitHubRemote: true,
      ghInstalled: true,
      authVerified: false,
      authCheckAttempted: false,
    }))

    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("gh auth verified:") && m.includes("not checked"))).toBe(true)
    } finally {
      mockDetectGitHubWorkflowReadiness.mockClear()
      mockDetectGitHubWorkflowReadiness.mockImplementation(() => ({
        isGitRepo: true,
        hasGitHubRemote: true,
        ghInstalled: true,
        authVerified: true,
        authCheckAttempted: true,
      }))
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 0 and prints concise install information by default", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Install Summary"))).toBe(true)
      expect(messages.some((m) => m.includes("Version Status"))).toBe(true)
      expect(messages.some((m) => m.includes("wunderkind cli version:"))).toBe(true)
      expect(messages.some((m) => m.includes("oh-my-openagent loaded version:"))).toBe(true)
      expect(messages.some((m) => m.includes("effective scope:"))).toBe(true)
      expect(messages.some((m) => m.includes("Resolved Paths"))).toBe(false)
      expect(messages.some((m) => m.includes("Active Configuration"))).toBe(false)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("prints verbose diagnostic sections when verbose mode is enabled", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Resolved Paths"))).toBe(true)
      expect(messages.some((m) => m.includes("Active Configuration"))).toBe(true)
      expect(messages.some((m) => m.includes("Project Health"))).toBe(true)
      expect(messages.some((m) => m.includes("oh-my-openagent loaded package:"))).toBe(true)
      expect(messages.some((m) => m.includes("oh-my-openagent global package:"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("warns when a stale global OMO install likely overrides a newer cache version", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectOmoVersionInfo.mockImplementation(() => ({
      packageName: "oh-my-openagent",
      currentVersion: null,
      registeredEntry: "oh-my-openagent@latest" as string | null,
      registeredVersion: null,
      loadedVersion: "3.12.2" as string | null,
      configPath: "/tmp/opencode.json" as string | null,
      loadedPackagePath: "/Users/grantv/.config/opencode/node_modules/oh-my-openagent/package.json" as string | null,
      registered: true,
      loadedSources: {
        global: {
          version: "3.12.2" as string | null,
          packagePath: "/Users/grantv/.config/opencode/node_modules/oh-my-openagent/package.json" as string | null,
        },
        cache: {
          version: "3.12.3" as string | null,
          packagePath: "/Users/grantv/.cache/opencode/node_modules/oh-my-openagent/package.json" as string | null,
        },
      },
      staleOverrideWarning: "global oh-my-openagent 3.12.2 likely overrides newer cache 3.12.3",
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("oh-my-openagent warning:"))).toBe(true)
      expect(messages.some((m) => m.includes("global oh-my-openagent 3.12.2 likely overrides newer cache 3.12.3"))).toBe(true)
      expect(messages.some((m) => m.includes("refresh the global install and restart OpenCode"))).toBe(true)
      expect(messages.some((m) => m.includes("Warnings"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("shows both global and cache OMO package sources in verbose mode when they differ", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectOmoVersionInfo.mockImplementation(() => ({
      packageName: "oh-my-openagent",
      currentVersion: null,
      registeredEntry: "oh-my-openagent@latest" as string | null,
      registeredVersion: null,
      loadedVersion: "3.12.2" as string | null,
      configPath: "/tmp/opencode.json" as string | null,
      loadedPackagePath: "/Users/grantv/.config/opencode/node_modules/oh-my-openagent/package.json" as string | null,
      registered: true,
      loadedSources: {
        global: {
          version: "3.12.2" as string | null,
          packagePath: "/Users/grantv/.config/opencode/node_modules/oh-my-openagent/package.json" as string | null,
        },
        cache: {
          version: "3.12.3" as string | null,
          packagePath: "/Users/grantv/.cache/opencode/node_modules/oh-my-openagent/package.json" as string | null,
        },
      },
      staleOverrideWarning: "global oh-my-openagent 3.12.2 likely overrides newer cache 3.12.3",
    }))

    try {
      const code = await runDoctorWithOptions({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("oh-my-openagent global package:") && m.includes("3.12.2"))).toBe(true)
      expect(messages.some((m) => m.includes("oh-my-openagent cache package:") && m.includes("3.12.3"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("renders baseline override markers in verbose Active Configuration", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockReadProjectWunderkindConfig.mockImplementation(() => ({
      teamCulture: "pragmatic-balanced",
      orgStructure: "flat",
      docsEnabled: false,
      docsPath: "./docs",
      docHistoryMode: "overwrite",
    }))

    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "project" as const,
      projectInstalled: true,
      globalInstalled: true,
      registrationScope: "both" as const,
      projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
      globalOpenCodeConfigPath: "/tmp/opencode.json",
      region: "Global",
      industry: "Software Development Services",
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
    }))

    try {
      const code = await runDoctorWithOptions({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("region:") && m.includes("Global") && m.includes("○ inherited default"))).toBe(true)
      expect(messages.some((m) => m.includes("industry:") && m.includes("Software Development Services") && m.includes("○ inherited default"))).toBe(true)
      expect(messages.some((m) => m.includes("primary regulation:") && m.includes("(not set)") && m.includes("○ inherited default"))).toBe(true)
      expect(messages.some((m) => m.includes("legend:") && m.includes("● = project override, ○ = inherited default"))).toBe(true)
      expect(messages.some((m) => m.includes("Workflow Configuration"))).toBe(true)
      expect(messages.some((m) => m.includes("PRD pipeline mode:") && m.includes("filesystem"))).toBe(true)
      expect(messages.some((m) => m.includes("GitHub remote detected:") && m.includes("✓ yes"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("warns when global install exists but native global agents are absent", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-omo-warning-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "global" as const,
      projectInstalled: true,
      globalInstalled: true,
      registrationScope: "both" as const,
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
    }))
    mockDetectNativeAgentFiles.mockImplementation((scope: "global" | "project") => ({
      dir: scope === "global" ? "/tmp/global-agents" : `${process.cwd()}/.opencode/agents`,
      presentCount: scope === "global" ? 0 : 6,
      totalCount: 6,
      allPresent: scope !== "global",
    }))
    mockDetectNativeCommandFiles.mockImplementation(() => ({
      dir: "/tmp/global-commands",
      presentCount: 0,
      totalCount: 38,
      allPresent: false,
    }))
    mockDetectNativeSkillFiles.mockImplementation((scope: "global" | "project") => ({
      dir: scope === "global" ? "/tmp/global-skills" : `${process.cwd()}/.opencode/skills`,
      presentCount: scope === "global" ? 0 : 11,
      totalCount: 11,
      allPresent: scope !== "global",
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("missing native global agent files"))).toBe(true)
      expect(messages.some((m) => m.includes("missing native global command files"))).toBe(true)
      expect(messages.some((m) => m.includes("missing native global skill files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("shows neutral OMO advice when OMO is not detected", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}
    mockDetectOmoVersionInfo.mockImplementation(() => ({
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
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("oh-my-openagent registration:"))).toBe(true)
      expect(messages.some((m) => m.includes("✗ not detected"))).toBe(true)
      expect(messages.some((m) => m.includes("Upgrade guidance:") || m.includes("upgrade guidance:"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("describes the real upstream naming split in doctor guidance", async () => {
    const { code, messages } = await captureDoctorOutput({})

    expect(code).toBe(0)
    expect(messages.some((m) => m.includes("wunderkind lifecycle:") && m.includes("wunderkind upgrade --scope=global"))).toBe(true)
    expect(messages.some((m) => m.includes("wunderkind package refresh:") && m.includes("bun install @grant-vine/wunderkind"))).toBe(true)
    expect(messages.some((m) => m.includes("upgrade guidance:") && m.includes("oh-my-openagent plugin/config naming"))).toBe(true)
    expect(messages.some((m) => m.includes("upgrade guidance:") && m.includes("bunx oh-my-opencode"))).toBe(true)
  })

  it("shows project-scope wunderkind upgrade guidance when registration is project-only", async () => {
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-project-upgrade-"))
    const restore = silenceConsole()
    const originalCwd = process.cwd()

    try {
      process.chdir(tempProject)
      mockProjectDoctorContext(tempProject, {
        globalInstalled: false,
        projectInstalled: true,
        registrationScope: "project",
      })

      const { code, messages } = await captureDoctorOutput({ verbose: true })

      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("wunderkind lifecycle:") && m.includes("wunderkind upgrade --scope=project"))).toBe(true)
      expect(messages.some((m) => m.includes("wunderkind package refresh:") && m.includes(tempProject) && m.includes("bun install @grant-vine/wunderkind"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      restore()
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("shows upstream up-to-date guidance when OMO freshness is verified", async () => {
    mockDetectOmoVersionInfo.mockImplementation(() => ({
      packageName: "oh-my-openagent",
      currentVersion: null,
      registeredEntry: "oh-my-openagent@3.12.2",
      registeredVersion: null,
      loadedVersion: "3.12.2",
      configPath: "/tmp/opencode.json",
      loadedPackagePath: "/tmp/node_modules/oh-my-openagent/package.json",
      registered: true,
      loadedSources: {
        global: { version: "3.12.2", packagePath: "/tmp/node_modules/oh-my-openagent/package.json" },
        cache: { version: null, packagePath: null },
      },
      staleOverrideWarning: null,
      freshness: createOmoFreshness({
        status: "up-to-date",
        currentVersion: "3.12.2",
        latestVersion: "3.12.2",
      }),
    }))

    const { code, messages } = await captureDoctorOutput({})

    expect(code).toBe(0)
    expect(messages.some((m) => m.includes("oh-my-openagent freshness:") && m.includes("up to date"))).toBe(true)
    expect(messages.some((m) => m.includes("upgrade guidance:") && m.includes("already up to date"))).toBe(true)
  })

  it("shows upstream update command when OMO reports an update is available", async () => {
    mockDetectOmoVersionInfo.mockImplementation(() => ({
      packageName: "oh-my-openagent",
      currentVersion: null,
      registeredEntry: "oh-my-openagent@3.12.2",
      registeredVersion: null,
      loadedVersion: "3.12.2",
      configPath: "/tmp/opencode.json",
      loadedPackagePath: "/tmp/node_modules/oh-my-openagent/package.json",
      registered: true,
      loadedSources: {
        global: { version: "3.12.2", packagePath: "/tmp/node_modules/oh-my-openagent/package.json" },
        cache: { version: null, packagePath: null },
      },
      staleOverrideWarning: null,
      freshness: createOmoFreshness({
        status: "outdated",
        currentVersion: "3.12.2",
        latestVersion: "3.13.1",
        renderedOutput: "Run: cd ~/.config/opencode && bun update oh-my-opencode",
      }),
    }))

    const { code, messages } = await captureDoctorOutput({})

    expect(code).toBe(0)
    expect(messages.some((m) => m.includes("oh-my-openagent freshness:") && m.includes("update available"))).toBe(true)
    expect(messages.some((m) => m.includes("upgrade guidance:") && m.includes("bun update oh-my-opencode"))).toBe(true)
  })

  it("falls back cleanly when OMO freshness cannot be verified", async () => {
    mockDetectOmoVersionInfo.mockImplementation(() => ({
      packageName: "oh-my-openagent",
      currentVersion: null,
      registeredEntry: "oh-my-openagent@3.12.2",
      registeredVersion: null,
      loadedVersion: "3.12.2",
      configPath: "/tmp/opencode.json",
      loadedPackagePath: "/tmp/node_modules/oh-my-openagent/package.json",
      registered: true,
      loadedSources: {
        global: { version: "3.12.2", packagePath: "/tmp/node_modules/oh-my-openagent/package.json" },
        cache: { version: null, packagePath: null },
      },
      staleOverrideWarning: null,
      freshness: createOmoFreshness({
        status: "error",
        currentVersion: "3.12.2",
      }),
    }))

    const { code, messages } = await captureDoctorOutput({})

    expect(code).toBe(0)
    expect(messages.some((m) => m.includes("oh-my-openagent freshness:") && m.includes("not verified"))).toBe(true)
    expect(messages.some((m) => m.includes("upgrade guidance:") && m.includes("could not be verified"))).toBe(true)
  })

  it("shows Agent Personalities section in verbose mode", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-personalities-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "global" as const,
      projectInstalled: true,
      globalInstalled: true,
      registrationScope: "both" as const,
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
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Agent Personalities"))).toBe(true)
      expect(messages.some((m) => m.includes("pragmatic-risk-manager"))).toBe(true)
      expect(messages.some((m) => m.includes("global native agents dir:"))).toBe(true)
      expect(messages.some((m) => m.includes("global native commands dir:"))).toBe(true)
      expect(messages.some((m) => m.includes("global native skills dir:"))).toBe(true)
      expect(messages.some((m) => m.includes("project native agents dir:"))).toBe(false)
      expect(messages.some((m) => m.includes("project native skills dir:"))).toBe(false)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("shows effective project baseline overrides in verbose Active Configuration", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation((): DetectedConfig =>
      createDetectedConfig({
        isInstalled: true,
        scope: "project",
        projectInstalled: true,
        globalInstalled: true,
        registrationScope: "both",
        projectOpenCodeConfigPath: `${process.cwd()}/opencode.json`,
        globalOpenCodeConfigPath: "/tmp/opencode.json",
        region: "Project Region",
        industry: "Project Industry",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }),
    )

    try {
      const code = await runDoctorWithOptions({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("region:") && m.includes("Project Region"))).toBe(true)
      expect(messages.some((m) => m.includes("industry:") && m.includes("Project Industry"))).toBe(true)
      expect(messages.some((m) => m.includes("primary regulation:") && m.includes("POPIA"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("renders dim '✗ no' for project registration when global is installed but project is not", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "global" as const,
      projectInstalled: false,
      globalInstalled: true,
      registrationScope: "global" as const,
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
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      const projectRegistrationLine = messages.find((m) => m.includes("project registration:"))
      expect(projectRegistrationLine).toBeDefined()
      expect(projectRegistrationLine).toContain("[dim]✗ no[/dim]")
      expect(projectRegistrationLine).not.toContain("[red]✗ no[/red]")
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("renders red '✗ no' for project registration when neither is installed", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: false,
      scope: "global" as const,
      projectInstalled: false,
      globalInstalled: false,
      registrationScope: "none" as const,
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
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      const projectRegistrationLine = messages.find((m) => m.includes("project registration:"))
      expect(projectRegistrationLine).toBeDefined()
      expect(projectRegistrationLine).toContain("[red]✗ no[/red]")
      expect(projectRegistrationLine).not.toContain("[dim]✗ no[/dim]")
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("warns when project is not initialized and legacy global project-local fields are detected", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-legacy-project-fields-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation(() => ({
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
      legacyGlobalProjectFields: ["teamCulture", "docsEnabled"],
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("legacy global project-local fields detected: teamCulture, docsEnabled"))).toBe(true)
      expect(messages.some((m) => m.includes("project is not initialized; using global/native defaults"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("returns 1 on unexpected doctor errors", async () => {
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }
    mockDetectCurrentConfig.mockImplementation(() => {
      throw new Error("doctor boom")
    })

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("doctor boom"))).toBe(true)
    } finally {
      console.error = originalError
    }
  })

  it("runDoctor() delegates to runDoctorWithOptions with no options", async () => {
    const restore = silenceConsole()
    try {
      const code = await runDoctor()
      expect(code).toBe(0)
    } finally {
      restore()
    }
  })

  it("renders green '✓ yes' for project registration when projectInstalled is true", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "project" as const,
      projectInstalled: true,
      globalInstalled: true,
      registrationScope: "both" as const,
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
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      const projectRegistrationLine = messages.find((m) => m.includes("project registration:"))
      expect(projectRegistrationLine).toBeDefined()
      expect(projectRegistrationLine).toContain("[green]✓ yes[/green]")
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("renders dim '✗ no' for project registration when global is installed but project is not", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
      scope: "global" as const,
      projectInstalled: false,
      globalInstalled: true,
      registrationScope: "global" as const,
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
    }))

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      const projectRegistrationLine = messages.find((m) => m.includes("project registration:"))
      expect(projectRegistrationLine).toBeDefined()
      expect(projectRegistrationLine).toContain("[dim]✗ no[/dim]")
      expect(projectRegistrationLine).not.toContain("[red]✗ no[/red]")
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("shows 'project context detected: no' when not in a project directory", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    const originalCwd = process.cwd()
    const tempEmpty = mkdtempSync(join(tmpdir(), "wk-doctor-non-project-"))
    process.chdir(tempEmpty)
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("project context detected:") && m.includes("✗ no"))).toBe(true)
      expect(messages.some((m) => m.includes("Current directory does not look like a project"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempEmpty, { recursive: true, force: true })
    }
  })

  it("renders docs-output enabled line in non-verbose project context", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-nonverbose-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectCurrentConfig.mockImplementation(() => ({
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
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("docs-output enabled:"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("shows 'docs README present' line when docsEnabled is true in project context", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-docs-enabled-"))
    writeFileSync(join(tempProject, "package.json"), "{}")
    process.chdir(tempProject)
    mockDetectCurrentConfig.mockImplementation(() => ({
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
      docsEnabled: true,
      docsPath: "./docs",
      docHistoryMode: "overwrite" as const,
      prdPipelineMode: "filesystem" as const,
    }))
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("docs README present:"))).toBe(true)
      expect(messages.some((m) => m.includes("missing docs README:"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("reports verbose Stitch workflow details without leaking the API key", async () => {
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-stitch-ready-"))
    writeProjectHealthFixture(tempProject)
    process.chdir(tempProject)

    const secretValue = "super-secret-stitch-key"
    const { projectOpenCodePath } = mockProjectDoctorContext(
      tempProject,
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      },
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      },
    )

    mockDetectStitchMcpPresence.mockImplementation(async () => "project-local")

    writeFileSync(join(tempProject, "DESIGN.md"), "# Design\n")
    mkdirSync(join(tempProject, ".wunderkind", "stitch"), { recursive: true })
    writeFileSync(join(tempProject, GOOGLE_STITCH_ADAPTER.secretFilePath), `${secretValue}\n`)
    writeFileSync(
      projectOpenCodePath,
      `${JSON.stringify(
        {
          mcp: {
            [GOOGLE_STITCH_ADAPTER.serverName]: GOOGLE_STITCH_ADAPTER.getOpenCodePayload(),
          },
        },
        null,
        2,
      )}\n`,
    )

    try {
      const { code, messages } = await captureDoctorOutput({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("design tool:") && m.includes("google-stitch"))).toBe(true)
      expect(messages.some((m) => m.includes("design path:") && m.includes("./DESIGN.md"))).toBe(true)
      expect(messages.some((m) => m.includes("design MCP ownership:") && m.includes("wunderkind-managed"))).toBe(true)
      expect(messages.some((m) => m.includes("DESIGN.md present:") && m.includes("✓ yes"))).toBe(true)
      expect(messages.some((m) => m.includes("Stitch MCP detected:") && m.includes("✓ yes"))).toBe(true)
      expect(messages.some((m) => m.includes("Stitch config source:") && m.includes("project"))).toBe(true)
      expect(messages.some((m) => m.includes("Stitch in use:") && m.includes("✓ yes"))).toBe(true)
      expect(messages.some((m) => m.includes("project-local secret file present:") && m.includes("✓ yes"))).toBe(true)
      expect(messages.some((m) => m.includes("auth mode:") && m.includes("api-key-file"))).toBe(true)
      expect(messages.some((m) => m.includes(secretValue))).toBe(false)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("adds a compact non-verbose Stitch readiness line", async () => {
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-stitch-compact-"))
    writeProjectHealthFixture(tempProject)
    process.chdir(tempProject)

    const { projectOpenCodePath } = mockProjectDoctorContext(
      tempProject,
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "reused-project",
      },
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "reused-project",
      },
    )

    writeFileSync(join(tempProject, "DESIGN.md"), "# Design\n")
    writeFileSync(
      projectOpenCodePath,
      `${JSON.stringify(
        {
          mcp: {
            [GOOGLE_STITCH_ADAPTER.serverName]: GOOGLE_STITCH_ADAPTER.getOpenCodePayload(),
          },
        },
        null,
        2,
      )}\n`,
    )

    try {
      const { code, messages } = await captureDoctorOutput()
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Stitch readiness:") && m.includes("enabled") && m.includes("configured") && m.includes("reused"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns on partial managed Stitch setup when DESIGN.md and secret file are missing", async () => {
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-stitch-partial-"))
    writeProjectHealthFixture(tempProject)
    process.chdir(tempProject)

    const { projectOpenCodePath } = mockProjectDoctorContext(
      tempProject,
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      },
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      },
    )

    writeFileSync(
      projectOpenCodePath,
      `${JSON.stringify(
        {
          mcp: {
            [GOOGLE_STITCH_ADAPTER.serverName]: GOOGLE_STITCH_ADAPTER.getOpenCodePayload(),
          },
        },
        null,
        2,
      )}\n`,
    )

    try {
      const { code, messages } = await captureDoctorOutput({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("DESIGN.md present:") && m.includes("✗ no"))).toBe(true)
      expect(messages.some((m) => m.includes("project-local secret file present:") && m.includes("✗ no"))).toBe(true)
      expect(messages.some((m) => m.includes("Stitch in use:") && m.includes("✓ yes"))).toBe(true)
      expect(messages.some((m) => m.includes("Warnings"))).toBe(true)
      expect(messages.some((m) => m.includes("design workflow is enabled but the design brief is missing"))).toBe(true)
      expect(messages.some((m) => m.includes("project-local Stitch secret file is missing"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns when the Stitch MCP entry drifts from the adapter contract", async () => {
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-stitch-drift-"))
    writeProjectHealthFixture(tempProject)
    process.chdir(tempProject)

    const { projectOpenCodePath } = mockProjectDoctorContext(
      tempProject,
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "reused-project",
      },
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "reused-project",
      },
    )

    mockDetectStitchMcpPresence.mockImplementation(async () => "project-local")

    writeFileSync(join(tempProject, "DESIGN.md"), "# Design\n")
    writeFileSync(
      projectOpenCodePath,
      `${JSON.stringify(
        {
          mcp: {
            [GOOGLE_STITCH_ADAPTER.serverName]: {
              ...GOOGLE_STITCH_ADAPTER.getOpenCodePayload(),
              url: `${GOOGLE_STITCH_ADAPTER.remoteUrl}/v2`,
              oauth: true,
            },
          },
        },
        null,
        2,
      )}\n`,
    )

    try {
      const { code, messages } = await captureDoctorOutput({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Stitch MCP detected:") && m.includes("✓ yes"))).toBe(true)
      expect(messages.some((m) => m.includes("Warnings"))).toBe(true)
      expect(messages.some((m) => m.includes("Stitch MCP entry deviates from the adapter contract"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("warns when managed Stitch ownership is set but no Stitch MCP is detected", async () => {
    const originalCwd = process.cwd()
    const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-stitch-mismatch-"))
    writeProjectHealthFixture(tempProject)
    process.chdir(tempProject)

    mockProjectDoctorContext(
      tempProject,
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      },
      {
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      },
    )

    writeFileSync(join(tempProject, "DESIGN.md"), "# Design\n")

    try {
      const { code, messages } = await captureDoctorOutput({ verbose: true })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Stitch MCP detected:") && m.includes("✗ no"))).toBe(true)
      expect(messages.some((m) => m.includes("Stitch config source:") && m.includes("missing"))).toBe(true)
      expect(messages.some((m) => m.includes("design MCP ownership expects a managed Stitch config but none was detected"))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  describe("runDoctor /dream availability", () => {
    it("shows /dream available line in project health output", async () => {
      const originalCwd = process.cwd()
      const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-dream-line-"))
      writeProjectHealthFixture(tempProject)
      process.chdir(tempProject)

      const globalCommandsDir = join(tempProject, "global-commands")
      mkdirSync(globalCommandsDir, { recursive: true })
      writeFileSync(join(globalCommandsDir, "docs-index.md"), "# docs-index\n")
      writeFileSync(join(globalCommandsDir, "design-md.md"), "# design-md\n")
      writeFileSync(join(globalCommandsDir, "dream.md"), "# dream\n")
      const commandPaths = [
        join(globalCommandsDir, "docs-index.md"),
        join(globalCommandsDir, "design-md.md"),
        join(globalCommandsDir, "dream.md"),
      ]

      mockProjectDoctorContext(tempProject)
      mockDetectNativeCommandFiles.mockImplementation(() => ({
        dir: globalCommandsDir,
        presentCount: commandPaths.length,
        totalCount: commandPaths.length,
        allPresent: true,
      }))
      mockGetNativeCommandFilePaths.mockImplementation(() => commandPaths)

      try {
        const { code, messages } = await captureDoctorOutput()
        expect(code).toBe(0)
        expect(messages.some((m) => m.includes("/dream") && (m.includes("available") || m.includes("present")))).toBe(true)
      } finally {
        process.chdir(originalCwd)
        rmSync(tempProject, { recursive: true, force: true })
      }
    })

    it("verbose mode names dream.md as missing when native commands are stale", async () => {
      const originalCwd = process.cwd()
      const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-dream-stale-"))
      writeProjectHealthFixture(tempProject)
      process.chdir(tempProject)

      const globalCommandsDir = join(tempProject, "global-commands")
      mkdirSync(globalCommandsDir, { recursive: true })
      writeFileSync(join(globalCommandsDir, "docs-index.md"), "# docs-index\n")
      writeFileSync(join(globalCommandsDir, "design-md.md"), "# design-md\n")
      const commandPaths = [
        join(globalCommandsDir, "docs-index.md"),
        join(globalCommandsDir, "design-md.md"),
        join(globalCommandsDir, "dream.md"),
      ]

      mockProjectDoctorContext(tempProject)
      mockDetectNativeCommandFiles.mockImplementation(() => ({
        dir: globalCommandsDir,
        presentCount: 2,
        totalCount: commandPaths.length,
        allPresent: false,
      }))
      mockGetNativeCommandFilePaths.mockImplementation(() => commandPaths)

      try {
        const { code, messages } = await captureDoctorOutput({ verbose: true })
        expect(code).toBe(0)
        expect(messages.some((m) => m.includes("dream.md"))).toBe(true)
      } finally {
        process.chdir(originalCwd)
        rmSync(tempProject, { recursive: true, force: true })
      }
    })

    it("verbose mode does not mention dream.md when native commands are complete", async () => {
      const originalCwd = process.cwd()
      const tempProject = mkdtempSync(join(tmpdir(), "wk-doctor-dream-healthy-"))
      writeProjectHealthFixture(tempProject)
      process.chdir(tempProject)

      const globalCommandsDir = join(tempProject, "global-commands")
      mkdirSync(globalCommandsDir, { recursive: true })
      writeFileSync(join(globalCommandsDir, "docs-index.md"), "# docs-index\n")
      writeFileSync(join(globalCommandsDir, "design-md.md"), "# design-md\n")
      writeFileSync(join(globalCommandsDir, "dream.md"), "# dream\n")
      const commandPaths = [
        join(globalCommandsDir, "docs-index.md"),
        join(globalCommandsDir, "design-md.md"),
        join(globalCommandsDir, "dream.md"),
      ]

      mockProjectDoctorContext(tempProject)
      mockDetectNativeCommandFiles.mockImplementation(() => ({
        dir: globalCommandsDir,
        presentCount: commandPaths.length,
        totalCount: commandPaths.length,
        allPresent: true,
      }))
      mockGetNativeCommandFilePaths.mockImplementation(() => commandPaths)

      try {
        const { code, messages } = await captureDoctorOutput({ verbose: true })
        expect(code).toBe(0)
        expect(messages.some((m) => m.includes("dream.md") && m.includes("missing"))).toBe(false)
      } finally {
        process.chdir(originalCwd)
        rmSync(tempProject, { recursive: true, force: true })
      }
    })
  })
})
