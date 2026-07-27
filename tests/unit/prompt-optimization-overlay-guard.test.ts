import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
  getRuntimeSectionGroup,
} from "../../src/cli/prompt-runtime-fixtures.js"
import { getPromptRuntimeContract } from "../../src/cli/prompt-surface-audit.js"
import { buildV4UserPromptOptimizationSurface } from "../../src/runtime-user-prompt-optimization.js"

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-fixture.mjs", import.meta.url)
const SOUL_BOUNDARY_HELPER_PATH = new URL("./helpers/run-runtime-soul-boundary-fixture.mjs", import.meta.url)

function createHelperEnv(overrides: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides }
  delete env.WUNDERKIND_TEST_MODEL
  delete env.WUNDERKIND_TEST_ENGINE
  delete env.WUNDERKIND_TEST_TOKEN_BUDGET
  delete env.WUNDERKIND_TEST_BYTE_BUDGET
  delete env.WUNDERKIND_TEST_FIXTURE
  delete env.WUNDERKIND_TEST_OUTPUT
  delete env.WUNDERKIND_TEST_HOOK_PATH

  return { ...env, ...overrides }
}

describe("prompt optimization overlay guard", () => {
  it("publishes explicit runtime-soul-overlay guardrail coverage in the runtime contract", () => {
    const contract = getPromptRuntimeContract()
    const soulOverlayLayer = contract.layers.find((layer) => layer.id === "runtime-soul-overlay")

    expect(soulOverlayLayer).toBeDefined()
    expect(soulOverlayLayer?.ownership).toBe("user-authored-excluded")
    expect(soulOverlayLayer?.collectionMode).toBe("runtime-fixture")
    expect(soulOverlayLayer?.includedInTotals).toBe(false)
    expect(soulOverlayLayer?.fixtureIds).toEqual(["fixture-runtime-soul-overlay"])
  })

  it("keeps runtime-soul-overlay outside the active-trimming eligible section set", () => {
    const fixture = captureCanonicalRuntimeFixture("fixture-runtime-soul-overlay")
    const fixtureGroups = fixture.sections.map((section) => getRuntimeSectionGroup(section))
    const eligibleSectionIds = collectPromptOptimizationEligibleSections(fixture).map((section) => section.id)

    expect(fixtureGroups).toContain("runtime-soul-overlay")
    expect(eligibleSectionIds).not.toContain("runtime-soul-overlay")
  })

  it("keeps the runtime-soul-overlay helper fixture byte-stable while active mode is enabled", () => {
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: createHelperEnv({
        WUNDERKIND_TEST_ENGINE: "active",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-soul-overlay",
      }),
      encoding: "utf8",
    })

    expect(helperRun.status).toBe(0)
    expect(helperRun.stdout.trim()).toBe(
      '{"modelId":null,"promptOptimizationMode":"active","countState":"unsupported","budgetBasis":"budget-unavailable","trimBasis":"configured-bytes","eligibleSections":["runtime-context","runtime-native-agents","compaction-continuity"],"beforeBytes":5987,"afterBytes":5987,"savedBytes":0,"trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
    )
  })

  it("keeps runtime-soul-overlay excluded in structured runtime-report helper output", () => {
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: createHelperEnv({
        WUNDERKIND_TEST_OUTPUT: "runtime-report",
        WUNDERKIND_TEST_ENGINE: "active",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-soul-overlay",
        WUNDERKIND_TEST_BYTE_BUDGET: "7000",
      }),
      encoding: "utf8",
    })

    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as {
      readonly eligibleSections?: readonly string[]
      readonly trimmedSections?: readonly string[]
      readonly noTrimReason?: string | null
      readonly exactTokenDelta?: unknown
    }

    expect(helperRun.status).toBe(0)
    expect((parsed as { readonly hookPath?: string }).hookPath).toBe("experimental.chat.system.transform")
    expect(parsed.eligibleSections).toEqual([
      "runtime-context",
      "runtime-native-agents",
      "compaction-continuity",
    ])
    expect(parsed.eligibleSections).not.toContain("runtime-soul-overlay")
    expect(parsed.trimmedSections).not.toContain("runtime-soul-overlay")
    expect(parsed.noTrimReason).toBe("within-trim-budget")
    expect(parsed.exactTokenDelta).toBe(null)
  })

  it("keeps secret-shaped SOUL content in raw runtime assembly while excluding it from reportable sections", () => {
    const helperRun = spawnSync(process.execPath, [SOUL_BOUNDARY_HELPER_PATH.pathname], {
      encoding: "utf8",
    })

    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as {
      readonly systemSections?: readonly string[]
      readonly eligibleSectionIds?: readonly string[]
      readonly eligibleContent?: string
      readonly trimmedSectionIds?: readonly string[]
    }

    expect(helperRun.status).toBe(0)
    expect(parsed.systemSections?.some((section) => section.includes("## Wunderkind SOUL Overlay"))).toBe(true)
    expect(parsed.systemSections?.some((section) => section.includes("sk-live-soul-boundary-proof"))).toBe(true)
    expect(parsed.eligibleSectionIds).toEqual(["runtime-context", "runtime-native-agents"])
    expect(parsed.eligibleContent).not.toContain("runtime-soul-overlay")
    expect(parsed.eligibleContent).not.toContain("## Wunderkind SOUL Overlay")
    expect(parsed.eligibleContent).not.toContain("sk-live-soul-boundary-proof")
    expect(parsed.trimmedSectionIds).not.toContain("runtime-soul-overlay")
  })

  it("keeps runtime-context eligible but never trimmed during forced over-budget active trimming", () => {
    const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
      env: createHelperEnv({
        WUNDERKIND_TEST_ENGINE: "active",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-active-trim",
        WUNDERKIND_TEST_BYTE_BUDGET: "1",
      }),
      encoding: "utf8",
    })

    const parsed = JSON.parse(helperRun.stdout.trim() || "{}") as {
      readonly trimBasis?: string
      readonly eligibleSections?: readonly string[]
      readonly beforeBytes?: number
      readonly afterBytes?: number
      readonly savedBytes?: number
      readonly trimApplied?: boolean
      readonly trimExhausted?: boolean
      readonly trimmedSections?: readonly string[]
    }

    expect(helperRun.status).toBe(0)
    expect(parsed.trimBasis).toBe("configured-bytes")
    expect(parsed.eligibleSections).toEqual([
      "runtime-docs-output",
      "runtime-context",
      "runtime-native-agents",
      "compaction-continuity",
    ])
    expect(parsed.trimApplied).toBe(true)
    expect(parsed.trimExhausted).toBe(true)
    expect(parsed.trimmedSections).toEqual([
      "runtime-native-agents",
      "runtime-docs-output",
      "compaction-continuity",
    ])
    expect(parsed.trimmedSections).not.toContain("runtime-context")
    expect(typeof parsed.beforeBytes).toBe("number")
    expect(typeof parsed.afterBytes).toBe("number")
    expect(typeof parsed.savedBytes).toBe("number")
    expect(parsed.beforeBytes).toBeGreaterThan(parsed.afterBytes ?? Number.POSITIVE_INFINITY)
    expect(parsed.savedBytes).toBe((parsed.beforeBytes ?? 0) - (parsed.afterBytes ?? 0))
  })

  it("keeps runtime-owned sections, compaction context, and soul overlays outside the V4 latest-user seam", () => {
    const fixture = captureCanonicalRuntimeFixture("fixture-runtime-soul-overlay")
    const runtimeOwnedTrimSurfaces = collectPromptOptimizationEligibleSections(fixture).map(
      (section) => section.content,
    )
    const soulOverlays = fixture.sections.filter((section) => getRuntimeSectionGroup(section) === "runtime-soul-overlay")
    const surface = buildV4UserPromptOptimizationSurface({
      messages: [
        { role: "user", content: "Earlier user history should stay excluded" },
        { role: "assistant", content: "Assistant acknowledgement" },
        { role: "user", content: "Latest user seam candidate" },
      ],
      retainedHistory: ["Retained history block"],
      transcriptWideCompaction: fixture.compactionContext,
      soulOverlays,
      runtimeOwnedTrimSurfaces,
    })

    expect(surface.latestUserMessage).toBe("Latest user seam candidate")
    expect(surface.earlierUserMessages).toEqual(["Earlier user history should stay excluded"])
    expect(surface.retainedHistory).toEqual(["Retained history block"])
    expect(surface.transcriptWideCompaction.join("\n")).toContain(
      "Preserve every active background task id",
    )
    expect(surface.soulOverlays.join("\n")).toContain("## Wunderkind SOUL Overlay")
    expect(surface.runtimeOwnedTrimSurfaces.join("\n")).toContain("## Wunderkind Resolved Runtime Context")
    expect(surface.runtimeOwnedTrimSurfaces.join("\n")).not.toContain(
      "Latest user seam candidate",
    )
    expect(surface.latestUserMessage).not.toContain("Preserve every active background task id")
    expect(surface.latestUserMessage).not.toContain("## Wunderkind SOUL Overlay")
    expect(surface.latestUserMessage).not.toContain("## Wunderkind Resolved Runtime Context")
  })

  it("keeps soul-overlay advisory helper output deterministic when parent env leaks runtime-report vars", () => {
    const originalOutput = process.env.WUNDERKIND_TEST_OUTPUT
    const originalHookPath = process.env.WUNDERKIND_TEST_HOOK_PATH

    process.env.WUNDERKIND_TEST_OUTPUT = "runtime-report"
    process.env.WUNDERKIND_TEST_HOOK_PATH = "experimental.session.compacting"

    try {
      const helperRun = spawnSync(process.execPath, [HELPER_PATH.pathname], {
        env: createHelperEnv({
          WUNDERKIND_TEST_ENGINE: "active",
          WUNDERKIND_TEST_FIXTURE: "fixture-runtime-soul-overlay",
        }),
        encoding: "utf8",
      })

      expect(helperRun.status).toBe(0)
      expect(helperRun.stdout.trim()).toBe(
        '{"modelId":null,"promptOptimizationMode":"active","countState":"unsupported","budgetBasis":"budget-unavailable","trimBasis":"configured-bytes","eligibleSections":["runtime-context","runtime-native-agents","compaction-continuity"],"beforeBytes":5987,"afterBytes":5987,"savedBytes":0,"trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
      )
    } finally {
      if (originalOutput === undefined) {
        delete process.env.WUNDERKIND_TEST_OUTPUT
      } else {
        process.env.WUNDERKIND_TEST_OUTPUT = originalOutput
      }

      if (originalHookPath === undefined) {
        delete process.env.WUNDERKIND_TEST_HOOK_PATH
      } else {
        process.env.WUNDERKIND_TEST_HOOK_PATH = originalHookPath
      }
    }
  })
})
