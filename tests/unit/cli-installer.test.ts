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
const mockWriteOmoAgentConfig = mock(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))
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
  writeOmoAgentConfig: mockWriteOmoAgentConfig,
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
})

describe("runCliInstaller", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockDetectLegacyConfig.mockClear()
    mockAddPluginToOpenCodeConfig.mockClear()
    mockWriteWunderkindConfig.mockClear()
    mockWriteOmoAgentConfig.mockClear()
    mockGetDefaultGlobalConfig.mockClear()
    mockReadWunderkindConfigForScope.mockClear()
    mockAddAiTracesToGitignore.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => makeDetectedConfig())
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/fake/opencode.json" }))
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
    mockWriteOmoAgentConfig.mockImplementation(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))
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

  it("calls writeOmoAgentConfig once for project scope install", async () => {
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "project" }))
      expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it("does NOT call writeOmoAgentConfig for global scope install", async () => {
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs({ scope: "global" }))
      expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(0)
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

  it("reports no-op when no global baseline changes are requested", async () => {
    const restore = silenceConsole()
    try {
      const code = await runCliUpgrade({ scope: "global" })
      expect(code).toBe(0)
      expect(mockWriteWunderkindConfig).toHaveBeenCalledTimes(0)
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

describe("writeOmoAgentConfig", () => {
  it("writes oh-my-opencode.jsonc to .opencode/ in target dir", async () => {
    const { writeOmoAgentConfig } = await import(`../../src/cli/config-manager/index.ts?omo-test=${Date.now()}`)
    const testRoot = mkdtempSync(join(tmpdir(), "wk-omo-writer-"))

    try {
      const result = writeOmoAgentConfig(testRoot)
      expect(result.success).toBe(true)

      const omoPath = join(testRoot, ".opencode", "oh-my-opencode.jsonc")
      expect(existsSync(omoPath)).toBe(true)

      const written = readFileSync(omoPath, "utf-8")
      expect(written).toContain("wunderkind:ciso")
      expect(written).toContain("wunderkind:marketing-wunderkind")
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("is idempotent — second call overwrites without error", async () => {
    const { writeOmoAgentConfig } = await import(`../../src/cli/config-manager/index.ts?omo-idempotent=${Date.now()}`)
    const testRoot = mkdtempSync(join(tmpdir(), "wk-omo-idempotent-"))

    try {
      const r1 = writeOmoAgentConfig(testRoot)
      const r2 = writeOmoAgentConfig(testRoot)

      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
