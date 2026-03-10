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

const mockReadWunderkindConfig = mock(() => null)
const mockWriteWunderkindConfig = mock(() => ({ success: true, configPath: "/fake/.wunderkind/wunderkind.config.jsonc" }))

mock.module("../../src/cli/config-manager/index.js", () => ({
  detectCurrentConfig: mockDetectCurrentConfig,
  readWunderkindConfig: mockReadWunderkindConfig,
  writeWunderkindConfig: mockWriteWunderkindConfig,
}))

import { runDoctor } from "../../src/cli/doctor.js"
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
})

describe("runDoctor", () => {
  beforeEach(() => {
    mockDetectCurrentConfig.mockClear()
    mockReadWunderkindConfig.mockClear()
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
    mockReadWunderkindConfig.mockImplementation(() => null)
  })

  it("returns 0 and prints install information", async () => {
    const messages: string[] = []
    const originalLog = console.log
    const originalError = console.error
    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }
    console.error = () => {}

    try {
      const code = await runDoctor()
      expect(code).toBe(0)
      expect(messages.some((m) => m.includes("Install Information"))).toBe(true)
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  })
})
