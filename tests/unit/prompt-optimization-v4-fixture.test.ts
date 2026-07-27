import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  capturePromptOptimizationV4UserPromptFixture,
  parsePromptOptimizationV4UserPromptFixtureId,
} from "../../src/cli/prompt-runtime-fixtures.js"
import { buildV4UserPromptOptimizationSurface } from "../../src/runtime-user-prompt-optimization.js"

type V4HelperOutput = {
  readonly fixtureId: string
  readonly hookPath: string
  readonly modelId: string | null
  readonly promptOptimizationMode: string
  readonly beforeBytes: number
  readonly afterBytes: number
  readonly savedBytes: number
  readonly trimApplied: boolean
  readonly noTrimReason: string | null
  readonly summaryMetadata: Record<string, unknown>
}

const V4_HELPER_PATH = new URL("./helpers/run-v4-user-prompt-fixture.mjs", import.meta.url)

function cloneFixtureInput<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function runV4Helper(options: {
  readonly fixtureId: string
  readonly cwd: string
  readonly modelId?: string
}): { readonly output: V4HelperOutput; readonly stdout: string } {
  const helperRun = spawnSync(
    process.execPath,
    [V4_HELPER_PATH.pathname, "--fixture", options.fixtureId, "--model", options.modelId ?? "gpt-4.1"],
    {
      cwd: options.cwd,
      encoding: "utf8",
    },
  )

  expect(helperRun.status).toBe(0)
  return {
    output: JSON.parse(helperRun.stdout.trim() || "{}") as V4HelperOutput,
    stdout: helperRun.stdout,
  }
}

describe("prompt optimization V4 helper fixtures", () => {
  it("freezes the V4 helper fixture id parser and fixture lookup", () => {
    expect(parsePromptOptimizationV4UserPromptFixtureId("safe-latest-user-message")).toBe(
      "safe-latest-user-message",
    )
    expect(parsePromptOptimizationV4UserPromptFixtureId("risky-immutable-user-message")).toBe(
      "risky-immutable-user-message",
    )
    expect(parsePromptOptimizationV4UserPromptFixtureId("fixture-runtime-active-trim")).toBe(null)
    expect(parsePromptOptimizationV4UserPromptFixtureId(null)).toBe(null)

    const safeFixture = capturePromptOptimizationV4UserPromptFixture("safe-latest-user-message")
    const riskyFixture = capturePromptOptimizationV4UserPromptFixture("risky-immutable-user-message")

    expect(safeFixture.expectation.kind).toBe("safe-optimization")
    expect(riskyFixture.expectation.kind).toBe("whole-message-passthrough")
  })

  it("optimizes only the latest safe user message while preserving earlier history byte-exact", () => {
    const fixture = capturePromptOptimizationV4UserPromptFixture("safe-latest-user-message")
    const input = cloneFixtureInput(fixture.input)

    const surface = buildV4UserPromptOptimizationSurface(input, {
      promptOptimizationEnabled: fixture.wunderkindConfig.promptOptimizationEnabled,
      promptOptimizationMode: fixture.wunderkindConfig.promptOptimizationMode,
    })

    expect(surface.latestUserMessage).toBe(fixture.expectation.beforeLatestUserMessage)
    expect(surface.latestUserMessagePassthroughReason).toBe(null)
    expect(surface.latestUserMessageOptimizationMeasurement?.afterMessage).toBe(
      fixture.expectation.afterLatestUserMessage,
    )
    expect(surface.latestUserMessageOptimizationMeasurement?.savedBytes).toBeGreaterThan(0)
    expect(input.messages).toEqual(fixture.expectation.expectedMessagesAfterOptimization)
    expect(surface.earlierUserMessages).toEqual([fixture.expectation.earlierUserMessage])
  })

  it("preserves mixed immutable latest-message content byte-exact and fail-closes whole-message passthrough", () => {
    const fixture = capturePromptOptimizationV4UserPromptFixture("risky-immutable-user-message")
    const input = cloneFixtureInput(fixture.input)

    const surface = buildV4UserPromptOptimizationSurface(input, {
      promptOptimizationEnabled: fixture.wunderkindConfig.promptOptimizationEnabled,
      promptOptimizationMode: fixture.wunderkindConfig.promptOptimizationMode,
    })

    expect(surface.latestUserMessage).toBe(fixture.expectation.beforeLatestUserMessage)
    expect(surface.latestUserMessageAnalysis?.reconstructedMessage).toBe(
      fixture.expectation.beforeLatestUserMessage,
    )
    expect(surface.latestUserMessagePassthroughReason).toBe(fixture.expectation.expectedPassthroughReason)
    expect(surface.latestUserMessageOptimizationMeasurement).toEqual({
      beforeMessage: fixture.expectation.beforeLatestUserMessage,
      afterMessage: fixture.expectation.beforeLatestUserMessage,
      beforeBytes: Buffer.byteLength(fixture.expectation.beforeLatestUserMessage, "utf8"),
      afterBytes: Buffer.byteLength(fixture.expectation.beforeLatestUserMessage, "utf8"),
      savedBytes: 0,
      trimApplied: false,
    })
    expect(input.messages).toEqual(fixture.expectation.expectedMessagesAfterOptimization)
    const observedRuleIds = surface.latestUserMessageAnalysis?.segments.map((segment) => segment.ruleId) ?? []
    for (const expectedRuleId of fixture.expectation.expectedImmutableRuleIds) {
      expect(observedRuleIds.includes(expectedRuleId)).toBe(true)
    }
  })

  it("regenerates safe and risky V4 runtime artifacts without widening summary metadata with passthrough reasons", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wunderkind-v4-helper-"))
    const systemReportPath = join(
      tempDir,
      ".wunderkind",
      "runtime",
      "prompt-optimization",
      "system-transform.latest.json",
    )
    const sessionReportPath = join(
      tempDir,
      ".wunderkind",
      "runtime",
      "prompt-optimization",
      "session-compacting.latest.json",
    )

    try {
      const safeRun = runV4Helper({
        fixtureId: "safe-latest-user-message",
        cwd: tempDir,
      })

      expect(safeRun.output.savedBytes).toBeGreaterThan(0)
      expect(safeRun.output.trimApplied).toBe(true)
      expect(safeRun.output.noTrimReason).toBe(null)
      expect(safeRun.output.summaryMetadata).not.toHaveProperty("passthroughReason")
      expect(Reflect.get(safeRun.output.summaryMetadata, "noTrimReason") ?? null).toBe(null)
      expect(existsSync(systemReportPath)).toBe(true)
      expect(existsSync(sessionReportPath)).toBe(true)
      expect(safeRun.stdout).not.toContain("SAFE_USER_SENTINEL")

      const riskyRun = runV4Helper({
        fixtureId: "risky-immutable-user-message",
        cwd: tempDir,
      })

      expect(riskyRun.output.savedBytes === 0 || riskyRun.output.beforeBytes === riskyRun.output.afterBytes).toBe(
        true,
      )
      expect(riskyRun.output.trimApplied).toBe(false)
      expect(riskyRun.output.noTrimReason).toBe("v4-safety-command-or-path")
      expect(riskyRun.output.summaryMetadata).not.toHaveProperty("noTrimReason")
      expect(riskyRun.output.summaryMetadata).not.toHaveProperty("passthroughReason")
      expect(riskyRun.stdout).not.toContain("RISKY_USER_SENTINEL")
      expect(readFileSync(systemReportPath, "utf-8")).not.toContain("RISKY_USER_SENTINEL")
      expect(readFileSync(sessionReportPath, "utf-8")).not.toContain("RISKY_USER_SENTINEL")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
