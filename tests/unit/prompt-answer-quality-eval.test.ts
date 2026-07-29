import { describe, expect, it } from "bun:test"

const HELPER_PATH = new URL("./helpers/run-prompt-answer-quality-eval.mjs", import.meta.url)
const COMMAND_PROVIDER_PATH = new URL("./helpers/prompt-answer-quality-command-provider.mjs", import.meta.url)

type BunSpawnResult = {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

type BunRuntime = {
  spawnSync(command: readonly string[], options: { readonly env: NodeJS.ProcessEnv }): BunSpawnResult
}

type PromptAnswerQualityHelperOutput = {
  readonly contractMode: string
  readonly repeatCount: number
  readonly stable: boolean
  readonly runFingerprints: readonly string[]
  readonly baseline: {
    readonly contractMode: string
    readonly executionMode: string
    readonly casePackId: string | null
    readonly providerId: string
    readonly modelId: string
    readonly cases: ReadonlyArray<Record<string, unknown>>
    readonly aggregate: Record<string, unknown>
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
    throw new Error("Bun runtime is required for prompt-answer-quality helper tests")
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

function buildProviderCommand(): string {
  return JSON.stringify(["bun", COMMAND_PROVIDER_PATH.pathname])
}

describe("prompt answer quality helper", () => {
  it("emits a passing stub baseline for the repo case pack and sanitizes protected summary output", () => {
    const helperRun = runHelper()

    expect(helperRun.status).toBe(0)
    expect(helperRun.stdout).not.toContain("bg_transcript123")

    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as PromptAnswerQualityHelperOutput
    expect(parsed.contractMode).toBe("prompt-answer-quality-helper-v1")
    expect(parsed.repeatCount).toBe(1)
    expect(parsed.stable).toBe(true)
    expect(parsed.runFingerprints.length).toBe(1)
    expect(new Set(parsed.runFingerprints).size).toBe(1)
    expect(parsed.baseline.contractMode).toBe("prompt-answer-quality-eval-v1")
    expect(parsed.baseline.executionMode).toBe("default-case-pack")
    expect(parsed.baseline.casePackId).toBe("prompt-answer-quality-default-case-pack-v1")
    expect(parsed.baseline.providerId).toBe("stub")
    expect(parsed.baseline.modelId).toBe("stub-deterministic-v1")
    expect(parsed.baseline.cases).toHaveLength(4)
    for (const result of parsed.baseline.cases) {
      expect(result["passed"]).toBe(true)
      expect(result["score"]).toBe(result["maxScore"])
    }
    expect(parsed.baseline.aggregate).toEqual({
      caseCount: 4,
      passedCaseCount: 4,
      totalScore: 64,
      maxScore: 64,
      normalizedScore: 1,
    })
  })

  it("supports a command provider over the stdin/stdout JSON protocol", () => {
    const helperRun = runHelper(
      "--provider",
      "command",
      "--provider-command",
      buildProviderCommand(),
    )

    expect(helperRun.status).toBe(0)
    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as PromptAnswerQualityHelperOutput
    expect(parsed.stable).toBe(true)
    expect(parsed.baseline.providerId).toBe("command-provider")
    expect(parsed.baseline.modelId).toBe("command-model-v1")
    expect(parsed.baseline.aggregate).toEqual({
      caseCount: 4,
      passedCaseCount: 4,
      totalScore: 64,
      maxScore: 64,
      normalizedScore: 1,
    })
  })
})
