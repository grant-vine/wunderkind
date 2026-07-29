import { describe, expect, it } from "bun:test"

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-efficacy.mjs", import.meta.url)

type BunSpawnResult = {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

type BunRuntime = {
  spawnSync(command: readonly string[], options: { readonly env: NodeJS.ProcessEnv }): BunSpawnResult
}

type EfficacyContract = {
  readonly contractMode: string
  readonly acceptedLevels: readonly string[]
  readonly preservationSuites: readonly string[]
  readonly requiredTopLevelKeys: readonly string[]
  readonly requiredBaselineKeys: readonly string[]
  readonly requiredAggregateKeys: readonly string[]
}

type EfficacyOutput = {
  readonly contractMode: string
  readonly repeatCount: number
  readonly stable: boolean
  readonly runFingerprints: readonly string[]
  readonly baseline: {
    readonly levels: ReadonlyArray<{
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
    }>
    readonly preservationSuites: ReadonlyArray<
      | {
          readonly suite: "prompt-optimization-v4-fixture"
          readonly passed: boolean
          readonly safeSavedBytes: number
          readonly riskyPassthroughReason: string
        }
      | {
          readonly suite: "prompt-optimization-contextual-level"
          readonly passed: boolean
          readonly transformedBytes: number
        }
      | {
          readonly suite: "prompt-optimization-transcript-level"
          readonly passed: boolean
          readonly retainedHistoryCount: number
        }
      | {
          readonly suite: "prompt-optimization-overlay-guard"
          readonly passed: boolean
          readonly trimmedSections: readonly string[]
        }
    >
    readonly aggregate: {
      readonly levelsWithSavings: number
      readonly exactTokenLevels: number
      readonly totalSavedBytes: number
      readonly allPublicEvidencePassed: boolean
      readonly allPreservationSuitesPassed: boolean
    }
  }
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
    throw new Error("Bun runtime is required for prompt-optimization efficacy tests")
  }

  const result = bunRuntime.spawnSync(["bun", HELPER_PATH.pathname, ...args], {
    env: process.env,
  })

  return {
    status: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  }
}

function readContract(): EfficacyContract {
  const helperRun = runHelper("--contract")
  expect(helperRun.status).toBe(0)

  return JSON.parse(helperRun.stdout.trim() || "{}") as EfficacyContract
}

describe("prompt optimization efficacy helper", () => {
  it("freezes the efficacy helper contract before first artifact generation", () => {
    expect(readContract()).toEqual({
      contractMode: "prompt-optimization-efficacy-v1",
      acceptedLevels: ["latest-user", "runtime-and-tools", "contextual", "transcript"],
      preservationSuites: [
        "prompt-optimization-v4-fixture",
        "prompt-optimization-contextual-level",
        "prompt-optimization-transcript-level",
        "prompt-optimization-overlay-guard",
      ],
      requiredTopLevelKeys: ["contractMode", "repeatCount", "stable", "runFingerprints", "baseline"],
      requiredBaselineKeys: ["levels", "preservationSuites", "aggregate"],
      requiredAggregateKeys: [
        "levelsWithSavings",
        "exactTokenLevels",
        "totalSavedBytes",
        "allPublicEvidencePassed",
        "allPreservationSuitesPassed",
      ],
    })
  })

  it("emits a repeatable efficacy result for multiple consecutive runs", () => {
    const contract = readContract()
    const helperRun = runHelper("--repeat", "2", "--enforce-repeatable")
    const expectedFingerprint = "520807827e42cbe31fa5e70766bb055f9603a85f89a983c6b548de1123f88d50"

    expect(helperRun.status).toBe(0)

    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as EfficacyOutput
    expect(Object.keys(parsed)).toEqual(contract.requiredTopLevelKeys)
    expect(parsed.contractMode).toBe(contract.contractMode)
    expect(parsed.repeatCount).toBe(2)
    expect(parsed.stable).toBe(true)
    expect(parsed.runFingerprints).toEqual([expectedFingerprint, expectedFingerprint])
    expect(Object.keys(parsed.baseline)).toEqual(contract.requiredBaselineKeys)
    expect(parsed.baseline.levels).toEqual([
      {
        contractMode: "prompt-optimization-level-fixture-v1",
        level: "latest-user",
        modelId: "gpt-4.1",
        metricBasis: "exact-tokens",
        beforeValue: 1928,
        afterValue: 1913,
        savedValue: 15,
        beforeBytes: 9245,
        afterBytes: 9176,
        savedBytes: 69,
        trimApplied: true,
        noTrimReason: null,
        exactTokenDelta: { beforeTokens: 1928, afterTokens: 1913, savedTokens: 15 },
        observabilityScore: 4,
        publicEvidence: {
          scalarOnly: true,
          summaryMatchesReport: true,
          protectedReasonRetainedOnReport: true,
          protectedReasonOmittedFromSummary: true,
        },
      },
      {
        contractMode: "prompt-optimization-level-fixture-v1",
        level: "runtime-and-tools",
        modelId: "gpt-4.1",
        metricBasis: "exact-tokens",
        beforeValue: 1928,
        afterValue: 1889,
        savedValue: 39,
        beforeBytes: 9245,
        afterBytes: 9062,
        savedBytes: 183,
        trimApplied: true,
        noTrimReason: null,
        exactTokenDelta: { beforeTokens: 1928, afterTokens: 1889, savedTokens: 39 },
        observabilityScore: 4,
        publicEvidence: {
          scalarOnly: true,
          summaryMatchesReport: true,
          protectedReasonRetainedOnReport: true,
          protectedReasonOmittedFromSummary: true,
        },
      },
      {
        contractMode: "prompt-optimization-level-fixture-v1",
        level: "contextual",
        modelId: "gpt-4.1",
        metricBasis: "exact-tokens",
        beforeValue: 1928,
        afterValue: 1865,
        savedValue: 63,
        beforeBytes: 9245,
        afterBytes: 8908,
        savedBytes: 337,
        trimApplied: true,
        noTrimReason: null,
        exactTokenDelta: { beforeTokens: 1928, afterTokens: 1865, savedTokens: 63 },
        observabilityScore: 4,
        publicEvidence: {
          scalarOnly: true,
          summaryMatchesReport: true,
          protectedReasonRetainedOnReport: true,
          protectedReasonOmittedFromSummary: true,
        },
      },
      {
        contractMode: "prompt-optimization-level-fixture-v1",
        level: "transcript",
        modelId: "gpt-4.1",
        metricBasis: "exact-tokens",
        beforeValue: 1928,
        afterValue: 1830,
        savedValue: 98,
        beforeBytes: 9245,
        afterBytes: 8664,
        savedBytes: 581,
        trimApplied: true,
        noTrimReason: null,
        exactTokenDelta: { beforeTokens: 1928, afterTokens: 1830, savedTokens: 98 },
        observabilityScore: 4,
        publicEvidence: {
          scalarOnly: true,
          summaryMatchesReport: true,
          protectedReasonRetainedOnReport: true,
          protectedReasonOmittedFromSummary: true,
        },
      },
    ])
    expect(parsed.baseline.preservationSuites).toEqual([
      {
        suite: "prompt-optimization-v4-fixture",
        passed: true,
        safeSavedBytes: 69,
        riskyPassthroughReason: "v4-safety-command-or-path",
      },
      {
        suite: "prompt-optimization-contextual-level",
        passed: true,
        transformedBytes: 515,
      },
      {
        suite: "prompt-optimization-transcript-level",
        passed: true,
        retainedHistoryCount: 1,
      },
      {
        suite: "prompt-optimization-overlay-guard",
        passed: true,
        trimmedSections: ["runtime-native-agents", "runtime-docs-output", "compaction-continuity"],
      },
    ])
    expect(Object.keys(parsed.baseline.aggregate)).toEqual(contract.requiredAggregateKeys)
    expect(parsed.baseline.aggregate).toEqual({
      levelsWithSavings: 4,
      exactTokenLevels: 4,
      totalSavedBytes: 1170,
      allPublicEvidencePassed: true,
      allPreservationSuitesPassed: true,
    })
  })
})
