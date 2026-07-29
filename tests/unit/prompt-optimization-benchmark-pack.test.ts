import { describe, expect, it } from "bun:test"

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-benchmark-pack.mjs", import.meta.url)

type BunSpawnResult = {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

type BunRuntime = {
  spawnSync(command: readonly string[], options: { readonly env: NodeJS.ProcessEnv }): BunSpawnResult
}

type BenchmarkContract = {
  readonly contractMode: string
  readonly benchmarkIds: readonly string[]
  readonly requiredTopLevelKeys: readonly string[]
  readonly requiredBenchmarkKeys: readonly string[]
  readonly requiredAggregateKeys: readonly string[]
}

type BenchmarkOutput = {
  readonly contractMode: string
  readonly modelId: string
  readonly benchmarks: ReadonlyArray<Record<string, unknown>>
  readonly aggregate: Record<string, unknown>
}

function isBunRuntime(value: unknown): value is BunRuntime {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "spawnSync") === "function"
}

function runHelper(...args: readonly string[]): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  const bunRuntime = Reflect.get(globalThis, "Bun")
  if (!isBunRuntime(bunRuntime)) {
    throw new Error("Bun runtime is required for prompt-optimization benchmark-pack tests")
  }
  const result = bunRuntime.spawnSync(["bun", HELPER_PATH.pathname, ...args], { env: process.env })
  return {
    status: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  }
}

function readContract(): BenchmarkContract {
  const helperRun = runHelper("--contract")
  expect(helperRun.status).toBe(0)
  return JSON.parse(helperRun.stdout.trim() || "{}") as BenchmarkContract
}

describe("prompt optimization benchmark pack helper", () => {
  it("freezes the benchmark-pack contract before first artifact generation", () => {
    expect(readContract()).toEqual({
      contractMode: "prompt-optimization-benchmark-pack-v1",
      benchmarkIds: [
        "latest-user-safe",
        "latest-user-risky",
        "runtime-tool-output-noisy",
        "contextual-selected-context",
        "transcript-history",
      ],
      requiredTopLevelKeys: ["contractMode", "modelId", "benchmarks", "aggregate"],
      requiredBenchmarkKeys: [
        "benchmarkId",
        "level",
        "fixtureSource",
        "metricBasis",
        "beforeValue",
        "afterValue",
        "savedValue",
        "beforeBytes",
        "afterBytes",
        "savedBytes",
        "exactTokenDelta",
        "trimApplied",
        "noTrimReason",
        "preservationPassed",
        "documentedOutcome",
      ],
      requiredAggregateKeys: [
        "benchmarkCount",
        "benchmarksWithSavings",
        "medianSavedBytes",
        "maxSavedBytes",
        "minSavedBytes",
        "totalSavedBytes",
        "preservationPassCount",
        "allBenchmarksPreserved",
      ],
    })
  })

  it("emits a sanitized benchmark pack with per-trace rows and aggregate results", () => {
    const contract = readContract()
    const helperRun = runHelper()

    expect(helperRun.status).toBe(0)
    expect(helperRun.stdout).not.toContain("SAFEUSERSENTINEL")
    expect(helperRun.stdout).not.toContain("RISKY_USER_SENTINEL")
    expect(helperRun.stdout).not.toContain("bg_transcript123")
    expect(helperRun.stdout).not.toContain("Latest request must remain untouched.")

    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as BenchmarkOutput
    expect(Object.keys(parsed)).toEqual(contract.requiredTopLevelKeys)
    expect(parsed.contractMode).toBe(contract.contractMode)
    expect(parsed.modelId).toBe("gpt-4.1")
    expect(parsed.benchmarks).toEqual([
      {
        benchmarkId: "latest-user-safe",
        level: "latest-user",
        fixtureSource: "safe-latest-user-message",
        metricBasis: "exact-tokens",
        beforeValue: 30,
        afterValue: 15,
        savedValue: 15,
        exactTokenDelta: { beforeTokens: 30, afterTokens: 15, savedTokens: 15 },
        beforeBytes: 138,
        afterBytes: 69,
        savedBytes: 69,
        trimApplied: true,
        noTrimReason: null,
        preservationPassed: true,
        documentedOutcome: "safe-latest-user-optimized",
      },
      {
        benchmarkId: "latest-user-risky",
        level: "latest-user",
        fixtureSource: "risky-immutable-user-message",
        metricBasis: "exact-tokens",
        beforeValue: 62,
        afterValue: 62,
        savedValue: 0,
        exactTokenDelta: { beforeTokens: 62, afterTokens: 62, savedTokens: 0 },
        beforeBytes: 290,
        afterBytes: 290,
        savedBytes: 0,
        trimApplied: false,
        noTrimReason: "v4-safety-command-or-path",
        preservationPassed: true,
        documentedOutcome: "risky-latest-user-preserved",
      },
      {
        benchmarkId: "runtime-tool-output-noisy",
        level: "runtime-and-tools",
        fixtureSource: "fixture-tool-output-noisy",
        metricBasis: "exact-tokens",
        beforeValue: 84,
        afterValue: 60,
        savedValue: 24,
        exactTokenDelta: { beforeTokens: 84, afterTokens: 60, savedTokens: 24 },
        beforeBytes: 384,
        afterBytes: 270,
        savedBytes: 114,
        trimApplied: true,
        noTrimReason: null,
        preservationPassed: true,
        documentedOutcome: "tool-output-compacted",
      },
      {
        benchmarkId: "contextual-selected-context",
        level: "contextual",
        fixtureSource: "selected-context-sanitized",
        metricBasis: "exact-tokens",
        beforeValue: 106,
        afterValue: 94,
        savedValue: 12,
        exactTokenDelta: { beforeTokens: 106, afterTokens: 94, savedTokens: 12 },
        beforeBytes: 592,
        afterBytes: 515,
        savedBytes: 77,
        trimApplied: true,
        noTrimReason: null,
        preservationPassed: true,
        documentedOutcome: "selected-context-compressed",
      },
      {
        benchmarkId: "transcript-history",
        level: "transcript",
        fixtureSource: "transcript-history-sanitized",
        metricBasis: "exact-tokens",
        beforeValue: 63,
        afterValue: 48,
        savedValue: 15,
        exactTokenDelta: { beforeTokens: 63, afterTokens: 48, savedTokens: 15 },
        beforeBytes: 358,
        afterBytes: 256,
        savedBytes: 102,
        trimApplied: true,
        noTrimReason: null,
        preservationPassed: true,
        documentedOutcome: "transcript-compressed",
      },
    ])
    expect(Object.keys(parsed.aggregate)).toEqual(contract.requiredAggregateKeys)
    expect(parsed.aggregate).toEqual({
      benchmarkCount: 5,
      benchmarksWithSavings: 4,
      medianSavedBytes: 77,
      maxSavedBytes: 114,
      minSavedBytes: 0,
      totalSavedBytes: 362,
      preservationPassCount: 5,
      allBenchmarksPreserved: true,
    })
  })
})
