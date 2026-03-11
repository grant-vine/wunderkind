import { beforeEach, describe, expect, it, mock } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

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

const mockReadGlobalWunderkindConfig = mock(() => null)
const mockReadProjectWunderkindConfig = mock(() => null)
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/wunderkind.config.jsonc" }))
const mockWriteNativeAgentFiles = mock(() => ({ success: true, configPath: "/tmp/.opencode/agents" }))
const mockDetectNativeAgentFiles = mock((scope: "global" | "project") => ({
  dir: scope === "global" ? "/tmp/global-agents" : `${process.cwd()}/.opencode/agents`,
  presentCount: 12,
  totalCount: 12,
  allPresent: true,
}))
const mockResolveOpenCodeConfigPath = mock((scope: "global" | "project") =>
  scope === "global"
    ? { path: "/tmp/opencode.json", format: "json" as const, source: "opencode.json" as const }
    : { path: `${process.cwd()}/opencode.json`, format: "json" as const, source: "opencode.json" as const },
)

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  detectNativeAgentFiles: mockDetectNativeAgentFiles,
  readGlobalWunderkindConfig: mockReadGlobalWunderkindConfig,
  readProjectWunderkindConfig: mockReadProjectWunderkindConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
  writeNativeAgentFiles: mockWriteNativeAgentFiles,
  resolveOpenCodeConfigPath: mockResolveOpenCodeConfigPath,
}))

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

import { runDoctorWithOptions } from "../../src/cli/doctor.js"
import { isProjectContext, runInit } from "../../src/cli/init.js"

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
    mockDetectNativeAgentFiles.mockClear()
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

    try {
      const code = await runInit({ noTui: true })
      expect(code).toBe(0)
      expect(mockWriteNativeAgentFiles).toHaveBeenCalledTimes(1)
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
    mockReadGlobalWunderkindConfig.mockClear()
    mockReadProjectWunderkindConfig.mockClear()
    mockWriteNativeAgentFiles.mockClear()
    mockResolveOpenCodeConfigPath.mockClear()
    mockDetectCurrentConfig.mockImplementation(() => ({
      isInstalled: true,
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
    mockReadGlobalWunderkindConfig.mockImplementation(() => null)
    mockReadProjectWunderkindConfig.mockImplementation(() => null)
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
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctorWithOptions({})
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("missing native global agent files"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
    }
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
    } finally {
      console.log = originalLog
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(tempProject, { recursive: true, force: true })
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
})
    mockDetectNativeAgentFiles.mockImplementation((scope: "global" | "project") => ({
      dir: scope === "global" ? "/tmp/global-agents" : `${process.cwd()}/.opencode/agents`,
      presentCount: scope === "global" ? 0 : 12,
      totalCount: 12,
      allPresent: scope !== "global",
    }))
