import { describe, expect, it } from "bun:test"

type LevelFixtureOutput = {
  readonly contractMode: string
  readonly level: string
  readonly modelId: string
  readonly metricBasis: "exact-tokens" | "bytes-fallback"
  readonly beforeValue: number
  readonly afterValue: number
  readonly savedValue: number
  readonly beforeBytes: number
  readonly afterBytes: number
  readonly savedBytes: number
  readonly trimApplied: boolean
  readonly noTrimReason: string | null
  readonly exactTokenDelta:
    | {
        readonly beforeTokens: number
        readonly afterTokens: number
        readonly savedTokens: number
      }
    | null
  readonly observabilityScore: number
  readonly publicEvidence: {
    readonly scalarOnly: boolean
    readonly summaryMatchesReport: boolean
    readonly protectedReasonRetainedOnReport: boolean
    readonly protectedReasonOmittedFromSummary: boolean
  }
}

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-level-fixture.mjs", import.meta.url)
const PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS = [
  "latest-user",
  "runtime-and-tools",
  "contextual",
  "transcript",
] as const

type BunSpawnResult = {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

type BunRuntime = {
  spawnSync(command: readonly string[], options: { readonly env: NodeJS.ProcessEnv }): BunSpawnResult
}

function isBunRuntime(value: unknown): value is BunRuntime {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "spawnSync") === "function"
}

function runHelper(...args: readonly string[]): {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
} {
  const bunRuntime = Reflect.get(globalThis, "Bun")
  if (!isBunRuntime(bunRuntime)) {
    throw new Error("Bun runtime is required for prompt-optimization level fixture tests")
  }

  const helperRun = bunRuntime.spawnSync(["bun", HELPER_PATH.pathname, ...args], {
    env: process.env,
  })

  return {
    status: helperRun.exitCode,
    stdout: new TextDecoder().decode(helperRun.stdout),
    stderr: new TextDecoder().decode(helperRun.stderr),
  }
}

function runLevelFixture(level: string): {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
} {
  return runHelper("--level", level)
}

function readHelperContract(): {
  readonly contractMode: string
  readonly acceptedLevels: readonly string[]
  readonly defaultModelId: string
  readonly metricPriority: readonly string[]
  readonly observabilityPriority: readonly string[]
  readonly requiredKeys: readonly string[]
} {
  const helperRun = runHelper("--contract")

  expect(helperRun.status).toBe(0)
  return JSON.parse(helperRun.stdout.trim() || "{}") as {
    readonly contractMode: string
    readonly acceptedLevels: readonly string[]
    readonly defaultModelId: string
    readonly metricPriority: readonly string[]
    readonly observabilityPriority: readonly string[]
    readonly requiredKeys: readonly string[]
  }
}

describe("prompt optimization level fixture helper", () => {
  it("freezes the accepted prompt-optimization levels for the level benchmark helper", () => {
    const contract = readHelperContract()

    expect(PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS).toEqual([
      "latest-user",
      "runtime-and-tools",
      "contextual",
      "transcript",
    ])
    expect(contract.acceptedLevels).toEqual(PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS)
  })

  it("freezes the helper contract keys and metric priority before first artifact generation", () => {
    expect(readHelperContract()).toEqual({
      contractMode: "prompt-optimization-level-fixture-v1",
      acceptedLevels: ["latest-user", "runtime-and-tools", "contextual", "transcript"],
      defaultModelId: "gpt-4.1",
      metricPriority: ["exact-tokens", "bytes-fallback"],
      observabilityPriority: [
        "protected-reason-report-only",
        "summary-measurement-alignment",
        "scalar-only-public-payload",
      ],
      requiredKeys: [
        "contractMode",
        "level",
        "modelId",
        "metricBasis",
        "beforeValue",
        "afterValue",
        "savedValue",
        "beforeBytes",
        "afterBytes",
        "savedBytes",
        "trimApplied",
        "noTrimReason",
        "exactTokenDelta",
        "observabilityScore",
        "publicEvidence",
      ],
    })
  })

  it("accepts only the frozen levels and emits the required benchmark keys", () => {
    const contract = readHelperContract()

    for (const level of PROMPT_OPTIMIZATION_LEVEL_FIXTURE_LEVELS) {
      const helperRun = runLevelFixture(level)

      expect(helperRun.status).toBe(0)

      const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as LevelFixtureOutput
      expect(Object.keys(parsed)).toEqual(contract.requiredKeys)
      expect(parsed.contractMode).toBe(contract.contractMode)
      expect(parsed.level).toBe(level)
      expect(parsed.modelId).toBe(contract.defaultModelId)
      expect(parsed.beforeBytes >= parsed.afterBytes).toBe(true)
      expect(parsed.savedBytes >= 0).toBe(true)
      expect(parsed.beforeValue >= parsed.afterValue).toBe(true)
      expect(parsed.savedValue >= 0).toBe(true)
      expect(parsed.observabilityScore >= 3).toBe(true)
      expect(parsed.publicEvidence).toEqual({
        scalarOnly: true,
        summaryMatchesReport: true,
        protectedReasonRetainedOnReport: true,
        protectedReasonOmittedFromSummary: true,
      })

      if (parsed.metricBasis === "exact-tokens") {
        expect(parsed.exactTokenDelta).not.toBe(null)
        expect(parsed.beforeValue).toBe(parsed.exactTokenDelta?.beforeTokens)
        expect(parsed.afterValue).toBe(parsed.exactTokenDelta?.afterTokens)
        expect(parsed.savedValue).toBe(parsed.exactTokenDelta?.savedTokens)
        continue
      }

      expect(parsed.metricBasis).toBe("bytes-fallback")
      expect(parsed.exactTokenDelta).toBe(null)
      expect(parsed.beforeValue).toBe(parsed.beforeBytes)
      expect(parsed.afterValue).toBe(parsed.afterBytes)
      expect(parsed.savedValue).toBe(parsed.savedBytes)
    }
  })

  it("rejects malformed levels instead of silently widening the helper contract", () => {
    const helperRun = runLevelFixture("runtime-plus-secrets")

    expect(helperRun.status).toBe(1)
    expect(helperRun.stdout.trim()).toBe("")
    expect(helperRun.stderr).toContain("Expected --level latest-user|runtime-and-tools|contextual|transcript")
  })
})
