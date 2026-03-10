import { describe, it, expect, mock, beforeEach } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { InstallArgs } from "../../src/cli/types.js"

const mockDetectCurrentConfig = mock(() => ({
  isInstalled: false,
  scope: "global" as const,
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
}))

const mockDetectLegacyConfig = mock(() => false)
const mockAddPluginToOpenCodeConfig = mock(() => ({ success: true, configPath: "/fake/opencode.json" }))
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectLegacyConfig: mockDetectLegacyConfig,
  addPluginToOpenCodeConfig: mockAddPluginToOpenCodeConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
}))

const mockAddAiTracesToGitignore = mock(() => ({
  success: true,
  added: [".wunderkind/"],
  alreadyPresent: [],
}))

mock.module("../../src/cli/gitignore-manager.js", () => ({
  addAiTracesToGitignore: mockAddAiTracesToGitignore,
}))

import { validateNonTuiArgs, runCliInstaller } from "../../src/cli/cli-installer.js"

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
    mockAddAiTracesToGitignore.mockClear()

    mockDetectLegacyConfig.mockImplementation(() => false)
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: false,
      scope: "global" as const,
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
    }))
    mockAddPluginToOpenCodeConfig.mockImplementation(() => ({ success: true, configPath: "/fake/opencode.json" }))
    mockWriteWunderkindConfig.mockImplementation(() => ({ success: true, configPath: "/fake/.wunderkind/config" }))
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

  it("passes docs-output defaults to writeWunderkindConfig", async () => {
    const restore = silenceConsole()
    try {
      await runCliInstaller(baseArgs())
      const calls = mockWriteWunderkindConfig.mock.calls
      const installConfigArg = calls[0]?.[0] as Record<string, unknown> | undefined
      expect(installConfigArg?.docsEnabled).toBe(false)
      expect(installConfigArg?.docsPath).toBe("./docs")
      expect(installConfigArg?.docHistoryMode).toBe("overwrite")
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

  it("merges project over global docs-output config field-by-field", async () => {
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
        docHistoryMode: "append-dated",
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
