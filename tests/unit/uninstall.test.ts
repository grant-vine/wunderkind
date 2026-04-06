import { beforeEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"
import type { DetectedConfig } from "../../src/cli/types.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href

const mockConfirm = mock(async () => true)
const mockIsCancel = mock(() => false)
const mockCancel = mock(() => {})

mock.module("@clack/prompts", () => ({
  confirm: mockConfirm,
  isCancel: mockIsCancel,
  cancel: mockCancel,
}))

function makeDetectedConfig(overrides: Partial<DetectedConfig> = {}): DetectedConfig {
  return {
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

const mockDetectCurrentConfig = mock(() => makeDetectedConfig())

const mockRemovePluginFromOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
const mockRemoveGlobalWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))
const mockRemoveNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
const mockRemoveNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
const mockRemoveNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/skills", changed: true }))
const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/tmp/opencode.json" }))
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockReadWunderkindConfigForScope = mock(() => null)
const mockReadGlobalWunderkindConfig = mock(() => null)
const mockReadProjectWunderkindConfig = mock(() => null)

const configManagerMockFactory = () => ({
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  detectCurrentConfig: mockDetectCurrentConfig,
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
  getNativeCommandFilePaths: () => [],
  getProjectOverrideMarker: () => ({ marker: "○" as const, sourceLabel: "inherited default" as const }),
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
  resolveOpenCodeConfigPath: () => ({ path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const }),
  getDefaultGlobalConfig: () => ({ region: "Global", industry: "", primaryRegulation: "", secondaryRegulation: "" }),
})

mock.module("../../src/cli/config-manager/index.js", configManagerMockFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, configManagerMockFactory)
mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, configManagerMockFactory)
mock.module(CONFIG_MANAGER_JS_URL, configManagerMockFactory)
mock.module(CONFIG_MANAGER_TS_URL, configManagerMockFactory)

import { runUninstall } from "../../src/cli/uninstall.js"

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function writeProjectStitchConfig(projectRoot: string): void {
  writeFileSync(
    join(projectRoot, "opencode.json"),
    `${JSON.stringify({
      $schema: "https://opencode.ai/config.json",
      mcp: {
        [GOOGLE_STITCH_ADAPTER.serverName]: GOOGLE_STITCH_ADAPTER.getOpenCodePayload(false),
      },
    }, null, 2)}\n`,
  )
}

function readProjectOpenCodeConfig(projectRoot: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(join(projectRoot, "opencode.json"), "utf-8")) as unknown
  if (!isRecord(parsed)) {
    throw new Error("Expected project OpenCode config to be a JSON object")
  }
  return parsed
}

function writeProjectStitchSecret(projectRoot: string): string {
  const secretPath = join(projectRoot, GOOGLE_STITCH_ADAPTER.secretFilePath)
  mkdirSync(join(projectRoot, ".wunderkind", "stitch"), { recursive: true })
  writeFileSync(secretPath, "top-secret-key")
  return secretPath
}

function setTTY(value: boolean): { stdin: boolean | undefined; stdout: boolean | undefined } {
  const stdin = process.stdin.isTTY
  const stdout = process.stdout.isTTY
  Object.defineProperty(process.stdin, "isTTY", { value, configurable: true })
  Object.defineProperty(process.stdout, "isTTY", { value, configurable: true })
  return { stdin, stdout }
}

function restoreTTY(original: { stdin: boolean | undefined; stdout: boolean | undefined }): void {
  Object.defineProperty(process.stdin, "isTTY", { value: original.stdin, configurable: true })
  Object.defineProperty(process.stdout, "isTTY", { value: original.stdout, configurable: true })
}

describe("runUninstall", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockRemovePluginFromOpenCodeConfig.mockClear()
    mockRemoveNativeAgentFiles.mockClear()
    mockRemoveNativeCommandFiles.mockClear()
    mockRemoveNativeSkillFiles.mockClear()
    mockRemoveGlobalWunderkindConfig.mockClear()
    mockConfirm.mockClear()
    mockIsCancel.mockClear()
    mockCancel.mockClear()

    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/opencode.json", changed: true }))
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/skills", changed: true }))
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: true }))
    mockConfirm.mockImplementation(async () => true)
    mockIsCancel.mockImplementation(() => false)
  })

  it("removes global registration and global Wunderkind config on global uninstall", async () => {
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({})
      expect(code).toBe(0)
      const firstCallScope = mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]
      expect(firstCallScope).toBe("global")
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeAgentFiles).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeCommandFiles).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeCommandFiles.mock.calls[0]?.length ?? 0).toBe(0)
      expect(mockRemoveNativeSkillFiles).toHaveBeenCalledTimes(1)
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("defaults to project uninstall when both scopes are installed and preserves shared global capabilities", async () => {
    mockDetectCurrentConfig.mockImplementation(() => ({
      ...makeDetectedConfig(),
      registrationScope: "both" as const,
      projectInstalled: true,
      globalInstalled: true,
      scope: "project" as const,
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({})
      expect(code).toBe(0)
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      const first = mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]
      expect(first).toBe("project")
      expect(mockRemoveNativeAgentFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeCommandFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeSkillFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("removes only project registration and leaves shared global capabilities untouched", async () => {
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "project" })
      expect(code).toBe(0)
      const firstCallScope = mockRemovePluginFromOpenCodeConfig.mock.calls[0]?.[0]
      expect(firstCallScope).toBe("project")
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(1)
      expect(mockRemoveNativeAgentFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeCommandFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveNativeSkillFiles).toHaveBeenCalledTimes(0)
      expect(mockRemoveGlobalWunderkindConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("reports already absent when uninstall is a no-op", async () => {
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({
      success: true,
      configPath: "/tmp/opencode.json",
      changed: false,
    }))

    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("already absent"))).toBe(true)
      expect(messages.some((m) => m.includes("Removed plugin registration"))).toBe(false)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when native agent removal fails", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/agents",
      changed: false,
      error: "EISDIR",
    }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove native agent files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 0 when nothing is installed", async () => {
    mockDetectCurrentConfig.mockImplementation(() => ({
      ...makeDetectedConfig(),
      isInstalled: false,
      projectInstalled: false,
      globalInstalled: false,
      registrationScope: "none",
    }))

    const messages: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({})
      expect(code).toBe(0)
      expect(messages.some((message) => message.includes("not currently registered"))).toBe(true)
      expect(mockRemovePluginFromOpenCodeConfig).toHaveBeenCalledTimes(0)
    } finally {
      console.log = originalLog
    }
  })

  it("returns 1 when native command removal fails", async () => {
    mockRemoveNativeCommandFiles.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/global-commands",
      changed: false,
      error: "EPERM",
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when native skill removal fails", async () => {
    mockRemoveNativeSkillFiles.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/skills",
      changed: false,
      error: "EPERM",
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when global config removal fails", async () => {
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/.wunderkind/wunderkind.config.jsonc",
      changed: false,
      error: "EPERM",
    }))

    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = () => {}

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when plugin registration removal fails", async () => {
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({
      success: false,
      configPath: "/tmp/opencode.json",
      changed: false,
      error: "EPERM",
    }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove plugin"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("logs 'already absent' when native assets are not present during global uninstall", async () => {
    mockRemovePluginFromOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/opencode.json", changed: false }))
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: false }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: false }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/skills", changed: false }))
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({
      success: true,
      configPath: "/tmp/.wunderkind/wunderkind.config.jsonc",
      changed: false,
    }))

    const messages: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("already absent"))).toBe(true)
    } finally {
      console.log = originalLog
    }
  })

  it("returns 1 when native command file removal fails during global uninstall", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/global-commands", changed: false, error: "EACCES" }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove native command files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when native skill file removal fails during global uninstall", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: false, configPath: "/tmp/skills", changed: false, error: "EACCES" }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove native skill files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  it("returns 1 when global Wunderkind config removal fails during global uninstall", async () => {
    mockRemoveNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/agents", changed: true }))
    mockRemoveNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands", changed: true }))
    mockRemoveNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/skills", changed: true }))
    mockRemoveGlobalWunderkindConfig.mockImplementation(() => ({ success: false, configPath: "/tmp/.wunderkind/wunderkind.config.jsonc", changed: false, error: "ENOENT" }))

    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = () => {}
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({ scope: "global" })
      expect(code).toBe(1)
      expect(errors.some((m) => m.includes("Failed to remove global Wunderkind config"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })

  describe("Stitch MCP cleanup", () => {
    it("removes the managed Stitch MCP entry and secret file when removeMcp=yes", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-managed-yes-"))
      const originalCwd = process.cwd()

      try {
        process.chdir(projectRoot)
        writeProjectStitchConfig(projectRoot)
        const secretPath = writeProjectStitchSecret(projectRoot)

        mockDetectCurrentConfig.mockImplementation(() =>
          makeDetectedConfig({
            scope: "project",
            projectInstalled: true,
            globalInstalled: true,
            registrationScope: "both",
            designTool: "google-stitch",
            designMcpOwnership: "wunderkind-managed",
          }),
        )

        const restore = silenceConsole()
        try {
          const code = await runUninstall({ scope: "project", removeMcp: "yes" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const config = readProjectOpenCodeConfig(projectRoot)
        expect(config.mcp).toBeUndefined()
        expect(existsSync(secretPath)).toBe(false)
        expect(mockConfirm).toHaveBeenCalledTimes(0)
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("preserves the managed Stitch MCP entry and secret file when removeMcp=no", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-managed-no-"))
      const originalCwd = process.cwd()

      try {
        process.chdir(projectRoot)
        writeProjectStitchConfig(projectRoot)
        const secretPath = writeProjectStitchSecret(projectRoot)

        mockDetectCurrentConfig.mockImplementation(() =>
          makeDetectedConfig({
            scope: "project",
            projectInstalled: true,
            globalInstalled: true,
            registrationScope: "both",
            designTool: "google-stitch",
            designMcpOwnership: "wunderkind-managed",
          }),
        )

        const restore = silenceConsole()
        try {
          const code = await runUninstall({ scope: "project", removeMcp: "no" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const config = readProjectOpenCodeConfig(projectRoot)
        expect(isRecord(config.mcp)).toBe(true)
        expect(isRecord(config.mcp) && config.mcp[GOOGLE_STITCH_ADAPTER.serverName]).toBeDefined()
        expect(existsSync(secretPath)).toBe(true)
        expect(mockConfirm).toHaveBeenCalledTimes(0)
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("removes only the reused-project Stitch MCP entry when removeMcp=yes", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-reused-project-"))
      const originalCwd = process.cwd()

      try {
        process.chdir(projectRoot)
        writeProjectStitchConfig(projectRoot)
        const secretPath = writeProjectStitchSecret(projectRoot)

        mockDetectCurrentConfig.mockImplementation(() =>
          makeDetectedConfig({
            scope: "project",
            projectInstalled: true,
            globalInstalled: true,
            registrationScope: "both",
            designTool: "google-stitch",
            designMcpOwnership: "reused-project",
          }),
        )

        const restore = silenceConsole()
        try {
          const code = await runUninstall({ scope: "project", removeMcp: "yes" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const config = readProjectOpenCodeConfig(projectRoot)
        expect(config.mcp).toBeUndefined()
        expect(existsSync(secretPath)).toBe(true)
        expect(mockConfirm).toHaveBeenCalledTimes(0)
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("protects reused-global Stitch wiring even when removeMcp=yes", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-reused-global-"))
      const originalCwd = process.cwd()

      try {
        process.chdir(projectRoot)
        writeProjectStitchConfig(projectRoot)
        const secretPath = writeProjectStitchSecret(projectRoot)

        mockDetectCurrentConfig.mockImplementation(() =>
          makeDetectedConfig({
            scope: "project",
            projectInstalled: true,
            globalInstalled: true,
            registrationScope: "both",
            designTool: "google-stitch",
            designMcpOwnership: "reused-global",
          }),
        )

        const restore = silenceConsole()
        try {
          const code = await runUninstall({ scope: "project", removeMcp: "yes" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const config = readProjectOpenCodeConfig(projectRoot)
        expect(isRecord(config.mcp)).toBe(true)
        expect(isRecord(config.mcp) && config.mcp[GOOGLE_STITCH_ADAPTER.serverName]).toBeDefined()
        expect(existsSync(secretPath)).toBe(true)
        expect(mockConfirm).toHaveBeenCalledTimes(0)
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("defaults to preserving Stitch config in non-TTY mode when removeMcp is omitted", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-nontty-default-"))
      const originalCwd = process.cwd()
      const originalTTY = setTTY(false)

      try {
        process.chdir(projectRoot)
        writeProjectStitchConfig(projectRoot)
        const secretPath = writeProjectStitchSecret(projectRoot)

        mockDetectCurrentConfig.mockImplementation(() =>
          makeDetectedConfig({
            scope: "project",
            projectInstalled: true,
            globalInstalled: true,
            registrationScope: "both",
            designTool: "google-stitch",
            designMcpOwnership: "wunderkind-managed",
          }),
        )

        const restore = silenceConsole()
        try {
          const code = await runUninstall({ scope: "project" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const config = readProjectOpenCodeConfig(projectRoot)
        expect(isRecord(config.mcp)).toBe(true)
        expect(isRecord(config.mcp) && config.mcp[GOOGLE_STITCH_ADAPTER.serverName]).toBeDefined()
        expect(existsSync(secretPath)).toBe(true)
        expect(mockConfirm).toHaveBeenCalledTimes(0)
      } finally {
        process.chdir(originalCwd)
        restoreTTY(originalTTY)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })

    it("skips Stitch cleanup entirely when designTool=none", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "wk-uninstall-design-none-"))
      const originalCwd = process.cwd()

      try {
        process.chdir(projectRoot)
        writeProjectStitchConfig(projectRoot)
        const secretPath = writeProjectStitchSecret(projectRoot)

        mockDetectCurrentConfig.mockImplementation(() =>
          makeDetectedConfig({
            scope: "project",
            projectInstalled: true,
            globalInstalled: true,
            registrationScope: "both",
            designTool: "none",
            designMcpOwnership: "none",
          }),
        )

        const restore = silenceConsole()
        try {
          const code = await runUninstall({ scope: "project", removeMcp: "yes" })
          expect(code).toBe(0)
        } finally {
          restore()
        }

        const config = readProjectOpenCodeConfig(projectRoot)
        expect(isRecord(config.mcp)).toBe(true)
        expect(isRecord(config.mcp) && config.mcp[GOOGLE_STITCH_ADAPTER.serverName]).toBeDefined()
        expect(existsSync(secretPath)).toBe(true)
        expect(mockConfirm).toHaveBeenCalledTimes(0)
      } finally {
        process.chdir(originalCwd)
        rmSync(projectRoot, { recursive: true, force: true })
      }
    })
  })

  it("returns 1 on unexpected exceptions", async () => {
    mockDetectCurrentConfig.mockImplementation(() => {
      throw new Error("boom")
    })

    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      const code = await runUninstall({})
      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("Error: Error: boom"))).toBe(true)
    } finally {
      console.error = originalError
    }
  })

})
