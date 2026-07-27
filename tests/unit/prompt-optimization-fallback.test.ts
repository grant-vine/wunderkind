import { describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { getPromptOptimizationRuntimeReportContract } from "../../src/cli/prompt-runtime-contract.js"
import { getPromptOptimizationRuntimePublicModelId } from "../../src/cli/prompt-optimization-runtime-reporting.js"
import { runTokenAudit } from "../../src/cli/token-audit.js"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const CONFIG_MANAGER_MODULE_URL = new URL(
  `../../src/cli/config-manager/index.ts?prompt-optimization-fallback=${Date.now()}`,
  import.meta.url,
).href

interface ReportingModeProbeResult {
  readonly offResultSuccess: boolean
  readonly offFileContainsReportingMode: boolean
  readonly persistResultSuccess: boolean
  readonly persistFileContainsPersist: boolean
  readonly persistFileMentionsRedactedRuntimeReports: boolean
  readonly persistFileMentionsAuditOnlyTokenAudit: boolean
  readonly persistedReadReportingMode: string | null
  readonly persistedDetectedReportingMode: string | null
  readonly malformedWriteSuccess: boolean
  readonly malformedWriteError: string | null
  readonly malformedFileContainsLoud: boolean
  readonly malformedReadReportingMode: string | null
  readonly malformedDetectedReportingMode: string | null
}

async function runReportingModeProbe(testName: string): Promise<ReportingModeProbeResult> {
  const rootDir = mkdtempSync(join(tmpdir(), `wunderkind-${testName}-`))
  const homeDir = join(rootDir, "home")
  const projectDir = join(rootDir, "project")
  const projectConfigPath = join(projectDir, ".wunderkind", "wunderkind.config.jsonc")
  const projectOpenCodePath = join(projectDir, "opencode.json")
  const probeResultPath = join(rootDir, "probe-result.json")

  mkdirSync(homeDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(projectOpenCodePath, JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))

  const script = `
import { readFileSync, writeFileSync } from "node:fs"

const configManager = await import(${JSON.stringify(CONFIG_MANAGER_MODULE_URL)})
configManager.__setConfigManagerPathOverrideForTests({
  cwd: ${JSON.stringify(projectDir)},
  home: ${JSON.stringify(homeDir)},
})

try {
  const offResult = configManager.writeProjectWunderkindConfig({
    ...configManager.getDefaultProjectConfig(),
    promptOptimizationReportingMode: "off",
  })
  const offFileContainsReportingMode = offResult.success
    ? readFileSync(offResult.configPath, "utf8").includes('"promptOptimizationReportingMode"')
    : false

  const persistResult = configManager.writeProjectWunderkindConfig({
    ...configManager.getDefaultProjectConfig(),
    promptOptimizationReportingMode: "persist",
  })
  const persistRendered = persistResult.success
    ? readFileSync(persistResult.configPath, "utf8")
    : ""
  const persistFileContainsPersist = persistResult.success
    ? persistRendered.includes('"promptOptimizationReportingMode": "persist"')
    : false
  const persistFileMentionsRedactedRuntimeReports = persistResult.success
    ? persistRendered.includes("sanitized/redacted latest-report artifacts or summaries")
    : false
  const persistFileMentionsAuditOnlyTokenAudit = persistResult.success
    ? persistRendered.includes("audit-only token-audit surface")
    : false
  const persistedReadReportingMode = configManager.readProjectWunderkindConfig()?.promptOptimizationReportingMode ?? null
  const persistedDetectedReportingMode = configManager.detectCurrentConfig().promptOptimizationReportingMode ?? null

  const malformedWriterInput = JSON.parse(JSON.stringify({
    ...configManager.getDefaultProjectConfig(),
    promptOptimizationReportingMode: "loud",
  }))
  const malformedWriteResult = configManager.writeProjectWunderkindConfig(malformedWriterInput)
  const malformedFileContainsLoud = persistResult.success
    ? readFileSync(persistResult.configPath, "utf8").includes('"promptOptimizationReportingMode": "loud"')
    : false

  writeFileSync(
    ${JSON.stringify(projectConfigPath)},
    ${JSON.stringify(`{
  "$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json",
  "teamCulture": "pragmatic-balanced",
  "orgStructure": "flat",
  "cisoPersonality": "pragmatic-risk-manager",
  "ctoPersonality": "code-archaeologist",
  "cmoPersonality": "data-driven",
  "productPersonality": "outcome-obsessed",
  "creativePersonality": "pragmatic-problem-solver",
  "legalPersonality": "pragmatic-advisor",
  "docsEnabled": false,
  "docsPath": "./docs",
  "docHistoryMode": "append-dated",
  "promptOptimizationReportingMode": "loud"
}`)},
  )

  writeFileSync(${JSON.stringify(probeResultPath)}, JSON.stringify({
    offResultSuccess: offResult.success,
    offFileContainsReportingMode,
    persistResultSuccess: persistResult.success,
    persistFileContainsPersist,
    persistFileMentionsRedactedRuntimeReports,
    persistFileMentionsAuditOnlyTokenAudit,
    persistedReadReportingMode,
    persistedDetectedReportingMode,
    malformedWriteSuccess: malformedWriteResult.success,
    malformedWriteError: malformedWriteResult.success ? null : malformedWriteResult.error ?? null,
    malformedFileContainsLoud,
    malformedReadReportingMode: configManager.readProjectWunderkindConfig()?.promptOptimizationReportingMode ?? null,
    malformedDetectedReportingMode: configManager.detectCurrentConfig().promptOptimizationReportingMode ?? null,
  }))
} finally {
  configManager.__resetConfigManagerPathOverrideForTests()
}
`

  try {
    const result = Bun.spawnSync(["bun", "-e", script], {
      cwd: projectDir,
      env: process.env,
      stderr: "pipe",
      stdout: "pipe",
    })
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()

    if (result.exitCode !== 0) {
      throw new Error(stderr || stdout || "config-manager probe failed")
    }

    if (!Bun.file(probeResultPath).exists()) {
      throw new Error(stderr || stdout || `config-manager probe did not write ${probeResultPath}`)
    }

    return JSON.parse(readFileSync(probeResultPath, "utf8")) as ReportingModeProbeResult
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
}

describe("prompt optimization fallback policy", () => {
  it("emits the frozen three-state fallback policy in token-audit JSON", async () => {
    const logs: string[] = []

    const exitCode = await runTokenAudit({
      cwd: PROJECT_ROOT,
      surface: "all",
      format: "json",
      writeStdout: (line) => logs.push(line),
      writeStderr: () => {},
    })

    expect(exitCode).toBe(0)
    expect(logs).toHaveLength(1)

    const parsed = JSON.parse(logs[0] ?? "{}") as {
      readonly contract: {
        readonly supplementaryOptimization: {
          readonly countStates?: readonly {
            readonly state: string
            readonly label: string
          }[]
        }
      }
    }

    expect(parsed.contract.supplementaryOptimization.countStates).toEqual([
      { state: "exact-local", label: "supported OpenAI model map" },
      { state: "provider-api-only", label: "unmapped OpenAI aliases" },
      { state: "unsupported", label: "non-OpenAI providers" },
    ])
  })

  it("renders the frozen three-state fallback policy in token-audit table output", async () => {
    const logs: string[] = []

    const exitCode = await runTokenAudit({
      cwd: PROJECT_ROOT,
      surface: "all",
      format: "table",
      writeStdout: (line) => logs.push(line),
      writeStderr: () => {},
    })

    expect(exitCode).toBe(0)
    expect(logs).toContain("Prompt optimization count states:")
    expect(logs).toContain("- exact-local: supported OpenAI model map")
    expect(logs).toContain("- provider-api-only: unmapped OpenAI aliases")
    expect(logs).toContain("- unsupported: non-OpenAI providers")
  })

  it("defines a separate runtime reporting contract with explicit measurement and mutation axes", () => {
    const contract = getPromptOptimizationRuntimeReportContract()

    expect(contract.contractMode).toBe("prompt-optimization-runtime-report-v3")
    expect(contract.defaultReportingMode).toBe("off")
    expect(contract.reportingModes).toEqual([
      { mode: "off", persistsLatestReport: false, emitsSessionSummary: false },
      { mode: "persist", persistsLatestReport: true, emitsSessionSummary: false },
      { mode: "summary", persistsLatestReport: true, emitsSessionSummary: true },
    ])
    expect(contract.measurementAxisFields).toEqual(["budgetBasis", "budgetLimit"])
    expect(contract.mutationAxisFields).toEqual(["trimBasis", "trimBudgetLimit"])
    expect(contract.requiredFields).toContain("hookPath")
    expect(contract.requiredFields).toContain("promptOptimizationMode")
    expect(contract.requiredFields).toContain("noTrimReason")
    expect(contract.requiredFields).toContain("exactTokenDelta")
    expect(contract.requiredFields).toEqual([
      "hookPath",
      "modelId",
      "promptOptimizationMode",
      "countState",
      "budgetBasis",
      "budgetLimit",
      "trimBasis",
      "trimBudgetLimit",
      "eligibleSections",
      "beforeBytes",
      "afterBytes",
      "savedBytes",
      "trimApplied",
      "trimExhausted",
      "trimmedSections",
      "noTrimReason",
      "exactTokenDelta",
    ])
    expect(contract.latestArtifacts).toEqual([
      {
        hookPath: "experimental.chat.system.transform",
        filePath: ".wunderkind/runtime/prompt-optimization/system-transform.latest.json",
      },
      {
        hookPath: "experimental.session.compacting",
        filePath: ".wunderkind/runtime/prompt-optimization/session-compacting.latest.json",
      },
    ])
    expect(contract.publicFieldInventory).toEqual([
      { field: "hookPath", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "modelId", publicValueClass: "safe-literal", secretHandling: "redaction-candidate" },
      {
        field: "promptOptimizationMode",
        publicValueClass: "safe-scalar-enum-id",
        secretHandling: "never-redact",
      },
      { field: "countState", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "budgetBasis", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "budgetLimit", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "trimBasis", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      {
        field: "trimBudgetLimit",
        publicValueClass: "safe-scalar-enum-id",
        secretHandling: "never-redact",
      },
      {
        field: "eligibleSections",
        publicValueClass: "safe-scalar-enum-id",
        secretHandling: "never-redact",
      },
      { field: "beforeBytes", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "afterBytes", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "savedBytes", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      { field: "trimApplied", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      {
        field: "trimExhausted",
        publicValueClass: "safe-scalar-enum-id",
        secretHandling: "never-redact",
      },
      {
        field: "trimmedSections",
        publicValueClass: "safe-scalar-enum-id",
        secretHandling: "never-redact",
      },
      { field: "noTrimReason", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
      {
        field: "exactTokenDelta",
        publicValueClass: "safe-scalar-enum-id",
        secretHandling: "never-redact",
      },
    ])
    expect(contract.redactionPolicy).toEqual({
      unconstrainedStringCarriers: ["modelId"],
      omissionPrecedence: "omit-when-possible",
      stringFieldFallback: "preserve-safe-literal-unless-secret-rule-matches",
      secretMatchHandling: "mask-entire-public-value",
      redactionMask: "***",
    })
    expect(contract.secretRules).toEqual([
      { id: "openai-api-key-prefix", matcher: "starts with sk-" },
      { id: "github-classic-pat-prefix", matcher: "starts with ghp_" },
      { id: "github-fine-grained-pat-prefix", matcher: "starts with github_pat_" },
      { id: "slack-bot-token-prefix", matcher: "starts with xoxb-" },
      { id: "slack-user-token-prefix", matcher: "starts with xoxp-" },
      { id: "bearer-token-prefix", matcher: "starts with Bearer " },
      { id: "jwt-shape", matcher: "three dot-separated segments with each segment length >= 8" },
      { id: "credentialed-url-authority", matcher: "contains credentialed URL authority like ://user:pass@" },
      {
        id: "pem-private-key-sentinel",
        matcher: "contains -----BEGIN and PRIVATE KEY----- in the same public value",
      },
    ])
  })

  it("keeps ordinary model ids as safe literals and masks secret-bearing model ids as the whole public value", () => {
    expect(getPromptOptimizationRuntimePublicModelId(null)).toBe(null)
    expect(getPromptOptimizationRuntimePublicModelId("gpt-4.1")).toBe("gpt-4.1")
    expect(getPromptOptimizationRuntimePublicModelId("claude-3-5-sonnet")).toBe("claude-3-5-sonnet")
    expect(getPromptOptimizationRuntimePublicModelId("custom-model-with-sketch")).toBe(
      "custom-model-with-sketch",
    )
    expect(getPromptOptimizationRuntimePublicModelId("sk-live-12345678")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("ghp_12345678abcdefgh")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("github_pat_12345678_abcdefghABCDEFGH")).toBe(
      "***",
    )
    expect(getPromptOptimizationRuntimePublicModelId("xoxb-12345678-abcdefgh")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("xoxp-12345678-abcdefgh")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("Bearer abcdefghijklmnop")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("abcdefgh.ijklmnop.qrstuvwx")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("https://user:pass@example.com/model")).toBe("***")
    expect(getPromptOptimizationRuntimePublicModelId("-----BEGIN TEST PRIVATE KEY-----")).toBe("***")
  })

  it("keeps reporting mode sparse by default, rejects malformed writer input, and excludes malformed persisted values from config detection", async () => {
    const probe = await runReportingModeProbe("prompt-optimization-reporting-mode")

    expect(probe.offResultSuccess).toBe(true)
    expect(probe.offFileContainsReportingMode).toBe(false)
    expect(probe.persistResultSuccess).toBe(true)
    expect(probe.persistFileContainsPersist).toBe(true)
    expect(probe.persistFileMentionsRedactedRuntimeReports).toBe(true)
    expect(probe.persistFileMentionsAuditOnlyTokenAudit).toBe(true)
    expect(probe.persistedReadReportingMode).toBe("persist")
    expect(probe.persistedDetectedReportingMode).toBe("persist")
    expect(probe.malformedWriteSuccess).toBe(false)
    expect(probe.malformedWriteError).toContain("promptOptimizationReportingMode")
    expect(probe.malformedWriteError).toContain("off, persist, or summary")
    expect(probe.malformedFileContainsLoud).toBe(false)
    expect(probe.malformedReadReportingMode).toBe(null)
    expect(probe.malformedDetectedReportingMode).toBe(null)
  })
})
