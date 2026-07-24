import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import {
  captureCanonicalRuntimeFixture,
  collectPromptOptimizationEligibleSections,
  getRuntimeSectionGroup,
} from "../../src/cli/prompt-runtime-fixtures.js"
import { getPromptRuntimeContract } from "../../src/cli/prompt-surface-audit.js"

const HELPER_PATH = new URL("./helpers/run-prompt-optimization-fixture.mjs", import.meta.url)

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
      env: {
        ...process.env,
        WUNDERKIND_TEST_ENGINE: "active",
        WUNDERKIND_TEST_FIXTURE: "fixture-runtime-soul-overlay",
      },
      encoding: "utf8",
    })

    expect(helperRun.status).toBe(0)
    expect(helperRun.stdout.trim()).toBe(
      '{"modelId":null,"promptOptimizationMode":"active","countState":"unsupported","budgetBasis":"budget-unavailable","trimApplied":false,"trimExhausted":false,"trimmedSections":[]}',
    )
  })
})
