import { describe, it, expect, mock, beforeEach } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import type { InstallArgs } from "../../src/cli/types.js"
import type { DetectedConfig, InstallConfig, InstallScope } from "../../src/cli/types.js"

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
    ...overrides,
  }
}

const mockDetectCurrentConfig = mock(() => makeDetectedConfig())

const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/fake/opencode.json" }))
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/global-agents" }))
const mockWriteNativeCommandFiles = mock(() => ({ success: true, configPath: "/tmp/global-commands" }))
const mockWriteNativeSkillFiles = mock(() => ({ success: true, configPath: "/tmp/global-skills" }))
const mockGetDefaultGlobalConfig = mock<() => Pick<InstallConfig, "region" | "industry" | "primaryRegulation" | "secondaryRegulation">>(() => ({
  region: "Global",
  industry: "",
  primaryRegulation: "GDPR",
  secondaryRegulation: "",
}))
const mockReadWunderkindConfigForScope = mock<(scope: InstallScope) => Partial<InstallConfig> | null>(() => null)

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectLegacyConfig: mockDetectLegacyConfig,
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  writeNativeCommandFiles: mockWriteNativeCommandFiles,
  writeNativeSkillFiles: mockWriteNativeSkillFiles,
  getDefaultGlobalConfig: mockGetDefaultGlobalConfig,
  readWunderkindConfigForScope: mockReadWunderkindConfigForScope,
}))

const mockAddAiTracesToGitignore = mock(() => ({
  success: true,
  added: [".wunderkind/"],
  alreadyPresent: [],
}))

mock.module("../../src/cli/gitignore-manager.js", () => ({
  addAiTracesToGitignore: mockAddAiTracesToGitignore,
}))

import { validateNonTuiArgs, runCliInstaller, runCliUpgrade } from "../../src/cli/cli-installer.js"

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
  it("returns error containing 'region' when region is missing", () => {
    const result = validateNonTuiArgs(baseArgs({ region: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("region"))).toBe(true)
  })

  it("returns error containing 'industry' when industry is missing", () => {
    const result = validateNonTuiArgs(baseArgs({ industry: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("industry"))).toBe(true)
  })

  it("returns error containing 'primary-regulation' when primaryRegulation is missing", () => {
    const result = validateNonTuiArgs(baseArgs({ primaryRegulation: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("primary-regulation"))).toBe(true)
  })

  it("returns empty errors array when all required fields are present", () => {
    const result = validateNonTuiArgs(baseArgs())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("allows project scope without baseline flags", () => {
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

describe("runCliInstaller", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockAddPluginToOpenCodeConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockGetDefaultGlobalConfig.mockClear()
    mockReadWunderkindConfigForScope.mockClear()
    mockAddAiTracesToGitignore.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/fake/opencode.json" }))
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
    mockWriteNativeAgentFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-agents" }))
    mockWriteNativeCommandFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-commands" }))
    mockWriteNativeSkillFiles.mockImplementation(() => ({ success: true, configPath: "/tmp/global-skills" }))
    mockReadWunderkindConfigForScope.mockImplementation(() => null)
    mockAddAiTracesToGitignore.mockImplementation(() => ({ success: true, added: [".wunderkind/"], alreadyPresent: [] }))
  })

  it("returns 1 when legacy config is detected", async () => {
    mockDetectLegacyConfig.mockImplementation(() => true)
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs())
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("returns 0 for a successful install with scope=global", async () => {
    const restore = silenceConsole()
    try {
      const code = await runCliInstaller(baseArgs({ scope: "global" }))
      expect(code).toBe(0)
    } finally {
      restore()
    }
  })

  it("allows successful project install without baseline flags", async () => {
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
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "project" }))
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("calls native command writer for project scope install and refreshes the global command copy", async () => {
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
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "global" }))
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("calls native command and skill writers for global scope install", async () => {
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
        qaPersonality: "rubber-duck",
        productPersonality: "velocity-optimizer",
        opsPersonality: "process-purist",
        creativePersonality: "bold-provocateur",
        brandPersonality: "pr-spinner",
        devrelPersonality: "community-champion",
        legalPersonality: "cautious-gatekeeper",
        supportPersonality: "empathetic-resolver",
        dataAnalystPersonality: "pragmatic-quant",
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
})

describe("runCliUpgrade", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockWriteNativeCommandFiles.mockClear()
    mockWriteNativeSkillFiles.mockClear()
    mockReadWunderkindConfigForScope.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig({ isInstalled: true, globalInstalled: true, registrationScope: "global" }))
    mockReadWunderkindConfigForScope.mockImplementation((scope: InstallScope) =>
      scope === "global"
        ? {
            region: "Australia",
            industry: "SaaS",
            primaryRegulation: "GDPR",
            secondaryRegulation: "",
          }
        : null,
    )
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
  })

  it("fails if Wunderkind is not installed in the requested scope", async () => {
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig({ isInstalled: false, globalInstalled: false, registrationScope: "none" }))
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(1)
    } finally {
      restore()
    }
  })

  it("refreshes native assets by default even when no baseline overrides are requested", async () => {
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
})

describe("readWunderkindConfig", () => {
  it("returns null when no project or global config exists", async () => {
    const projectConfigPath = join(process.cwd(), ".wunderkind", "wunderkind.config.jsonc")
    const globalConfigPath = join(homedir(), ".wunderkind", "wunderkind.config.jsonc")
    const projectBackup = existsSync(projectConfigPath) ? readFileSync(projectConfigPath, "utf-8") : null
    const globalBackup = existsSync(globalConfigPath) ? readFileSync(globalConfigPath, "utf-8") : null

    try {
      rmSync(projectConfigPath, { force: true })
      rmSync(globalConfigPath, { force: true })

      const { readWunderkindConfig } = await import(`../../src/cli/config-manager/index.ts?null-test=${Date.now()}`)
      expect(readWunderkindConfig()).toBe(null)
    } finally {
      if (projectBackup === null) {
        rmSync(projectConfigPath, { force: true })
      } else {
        writeFileSync(projectConfigPath, projectBackup)
      }

      if (globalBackup === null) {
        rmSync(globalConfigPath, { force: true })
      } else {
        writeFileSync(globalConfigPath, globalBackup)
      }
    }
  })

  it("uses only project docs-output config fields for effective project docs settings", async () => {
    const projectConfigDir = join(process.cwd(), ".wunderkind")
    const projectConfigPath = join(projectConfigDir, "wunderkind.config.jsonc")
    const globalConfigDir = join(homedir(), ".wunderkind")
    const globalConfigPath = join(globalConfigDir, "wunderkind.config.jsonc")
    const projectBackup = existsSync(projectConfigPath) ? readFileSync(projectConfigPath, "utf-8") : null
    const globalBackup = existsSync(globalConfigPath) ? readFileSync(globalConfigPath, "utf-8") : null

    try {
      mkdirSync(projectConfigDir, { recursive: true })
      mkdirSync(globalConfigDir, { recursive: true })

      writeFileSync(
        projectConfigPath,
        `{
  "docsEnabled": true,
  "docsPath": "./project-docs"
}`,
      )
      writeFileSync(
        globalConfigPath,
        `{
  "docsEnabled": false,
  "docsPath": "./global-docs",
  "docHistoryMode": "append-dated"
}`,
      )

      const { readWunderkindConfig } = await import(`../../src/cli/config-manager/index.ts?merge-test=${Date.now()}`)
      const merged = readWunderkindConfig()

      expect(merged).toEqual({
        docsEnabled: true,
        docsPath: "./project-docs",
      })
    } finally {
      if (projectBackup === null) {
        rmSync(projectConfigPath, { force: true })
      } else {
        writeFileSync(projectConfigPath, projectBackup)
      }

      if (globalBackup === null) {
        rmSync(globalConfigPath, { force: true })
      } else {
        writeFileSync(globalConfigPath, globalBackup)
      }
    }
  })
})

describe("writeWunderkindConfig schema field", () => {
  it("writes the schema URL into global config output", async () => {
    const globalConfigPath = join(homedir(), ".wunderkind", "wunderkind.config.jsonc")
    const globalBackup = existsSync(globalConfigPath) ? readFileSync(globalConfigPath, "utf-8") : null

    try {
      const { writeGlobalWunderkindConfig, getDefaultGlobalConfig } = await import(`../../src/cli/config-manager/index.ts?global-schema=${Date.now()}`)
      const result = writeGlobalWunderkindConfig(getDefaultGlobalConfig())
      expect(result.success).toBe(true)

      const written = readFileSync(globalConfigPath, "utf-8")
      expect(written).toContain('"$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"')
    } finally {
      if (globalBackup === null) {
        rmSync(globalConfigPath, { force: true })
      } else {
        writeFileSync(globalConfigPath, globalBackup)
      }
    }
  })

  it("writes the schema URL into project config output", async () => {
    const projectConfigDir = join(process.cwd(), ".wunderkind")
    const projectConfigPath = join(projectConfigDir, "wunderkind.config.jsonc")
    const projectBackup = existsSync(projectConfigPath) ? readFileSync(projectConfigPath, "utf-8") : null

    try {
      mkdirSync(projectConfigDir, { recursive: true })
      const { writeProjectWunderkindConfig, getDefaultProjectConfig } = await import(`../../src/cli/config-manager/index.ts?project-schema=${Date.now()}`)
      const result = writeProjectWunderkindConfig(getDefaultProjectConfig())
      expect(result.success).toBe(true)

      const written = readFileSync(projectConfigPath, "utf-8")
      expect(written).toContain('"$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"')
    } finally {
      if (projectBackup === null) {
        rmSync(projectConfigPath, { force: true })
      } else {
        writeFileSync(projectConfigPath, projectBackup)
      }
    }
  })

  it("writes sparse project config without baseline fields when they match the global baseline", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-project-sparse-config-"))
    const originalCwd = process.cwd()
    const fakeHome = join(testRoot, "fake-home")

    try {
      mkdirSync(fakeHome, { recursive: true })
      mock.module("node:os", () => ({ homedir: () => fakeHome }))
      process.chdir(testRoot)

      const {
        writeGlobalWunderkindConfig,
        writeWunderkindConfig,
        getDefaultGlobalConfig,
        getDefaultInstallConfig,
      } = await import(`../../src/cli/config-manager/index.ts?project-sparse-schema=${Date.now()}`)

      expect(writeGlobalWunderkindConfig({
        ...getDefaultGlobalConfig(),
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }).success).toBe(true)

      const result = writeWunderkindConfig({
        ...getDefaultInstallConfig(),
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }, "project")
      expect(result.success).toBe(true)

      const written = readFileSync(join(testRoot, ".wunderkind", "wunderkind.config.jsonc"), "utf-8")
      expect(written).not.toContain('"region"')
      expect(written).not.toContain('"industry"')
      expect(written).not.toContain('"primaryRegulation"')
      expect(written).not.toContain('"secondaryRegulation"')
      expect(written).toContain('"teamCulture"')
      expect(written).toContain('"docsEnabled"')
    } finally {
      process.chdir(originalCwd)
      mock.module("node:os", () => ({ homedir }))
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("writes project baseline overrides when they differ from the global baseline", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-project-override-config-"))
    const originalCwd = process.cwd()
    const fakeHome = join(testRoot, "fake-home")

    try {
      mkdirSync(fakeHome, { recursive: true })
      mock.module("node:os", () => ({ homedir: () => fakeHome }))
      process.chdir(testRoot)

      const {
        writeGlobalWunderkindConfig,
        writeWunderkindConfig,
        getDefaultGlobalConfig,
        getDefaultInstallConfig,
      } = await import(`../../src/cli/config-manager/index.ts?project-override-schema=${Date.now()}`)

      expect(writeGlobalWunderkindConfig({
        ...getDefaultGlobalConfig(),
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }).success).toBe(true)

      const result = writeWunderkindConfig({
        ...getDefaultInstallConfig(),
        region: "EU",
        industry: "Marketplace",
        primaryRegulation: "GDPR",
        secondaryRegulation: "",
      }, "project")
      expect(result.success).toBe(true)

      const written = readFileSync(join(testRoot, ".wunderkind", "wunderkind.config.jsonc"), "utf-8")
      expect(written).toContain('"region": "EU"')
      expect(written).toContain('"industry": "Marketplace"')
      expect(written).toContain('"primaryRegulation": "GDPR"')
      expect(written).toContain('"secondaryRegulation": ""')
    } finally {
      process.chdir(originalCwd)
      mock.module("node:os", () => ({ homedir }))
      rmSync(testRoot, { recursive: true, force: true })
    }
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
  it("writes native agent markdown files to the global OpenCode agents dir", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-native-agent-writer-"))
    const originalCwd = process.cwd()
    const fakeHome = join(testRoot, "fake-home")

    try {
      mkdirSync(fakeHome, { recursive: true })
      mock.module("node:os", () => ({
        homedir: () => fakeHome,
      }))
      process.chdir(testRoot)
      const { writeNativeAgentFiles } = await import(`../../src/cli/config-manager/index.ts?native-agent-test=${Date.now()}`)
      const result = writeNativeAgentFiles("project")
      expect(result.success).toBe(true)

      const agentsDir = join(fakeHome, ".config", "opencode", "agents")
      expect(existsSync(agentsDir)).toBe(true)

      const marketingPath = join(agentsDir, "marketing-wunderkind.md")
      const cisoPath = join(agentsDir, "ciso.md")
      expect(existsSync(marketingPath)).toBe(true)
      expect(existsSync(cisoPath)).toBe(true)

      const written = readFileSync(marketingPath, "utf-8")
      expect(written).toContain("mode: all")
      expect(written).toContain("# Marketing Wunderkind")
    } finally {
      process.chdir(originalCwd)
      mock.module("node:os", () => ({
        homedir,
      }))
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

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
  it("writes native command markdown files to the global OpenCode commands dir", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-native-command-writer-"))
    const originalCwd = process.cwd()
    const fakeHome = join(testRoot, "fake-home")

    try {
      mkdirSync(fakeHome, { recursive: true })
      mock.module("node:os", () => ({
        homedir: () => fakeHome,
      }))
      process.chdir(testRoot)
      const { writeNativeCommandFiles } = await import(`../../src/cli/config-manager/index.ts?native-command-test=${Date.now()}`)
      const result = writeNativeCommandFiles()
      expect(result.success).toBe(true)

      const commandsDir = join(fakeHome, ".config", "opencode", "commands")
      const docsIndexPath = join(commandsDir, "docs-index.md")
      expect(existsSync(commandsDir)).toBe(true)
      expect(existsSync(docsIndexPath)).toBe(true)

      const written = readFileSync(docsIndexPath, "utf-8")
      expect(written).toContain("/docs-index")
      expect(written).toContain("agent: product-wunderkind")
    } finally {
      process.chdir(originalCwd)
      mock.module("node:os", () => ({
        homedir,
      }))
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})

describe("writeNativeSkillFiles", () => {
  it("writes native skill directories recursively to the global OpenCode skills dir", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-native-skill-writer-"))
    const originalCwd = process.cwd()
    const fakeHome = join(testRoot, "fake-home")

    try {
      mkdirSync(fakeHome, { recursive: true })
      mock.module("node:os", () => ({
        homedir: () => fakeHome,
      }))
      process.chdir(testRoot)
      const { writeNativeSkillFiles } = await import(`../../src/cli/config-manager/index.ts?native-skill-test=${Date.now()}`)
      const result = writeNativeSkillFiles("project")
      expect(result.success).toBe(true)

      const skillsDir = join(fakeHome, ".config", "opencode", "skills")
      const agilePmSkill = join(skillsDir, "agile-pm", "SKILL.md")
      const securityAnalystSkill = join(skillsDir, "security-analyst", "SKILL.md")
      expect(existsSync(skillsDir)).toBe(true)
      expect(existsSync(agilePmSkill)).toBe(true)
      expect(existsSync(securityAnalystSkill)).toBe(true)

      const written = readFileSync(agilePmSkill, "utf-8")
      expect(written).toContain("Agile PM")
    } finally {
      process.chdir(originalCwd)
      mock.module("node:os", () => ({
        homedir,
      }))
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
