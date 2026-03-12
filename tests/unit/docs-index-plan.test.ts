import { describe, expect, it } from "bun:test"
import {
  buildDocsIndexPlan,
  summarizeDocsIndexResults,
  validateDocsIndexPlan,
} from "../../src/agents/docs-index-plan.js"

describe("docs-index plan", () => {
  it("builds one entry per eligible docs agent", () => {
    const plan = buildDocsIndexPlan("./docs")

    expect(plan.docsPath).toBe("docs")
    expect(plan.entries.length).toBe(9)
    expect(plan.entries.every((entry) => entry.targetPath.startsWith("docs/"))).toBe(true)
  })

  it("normalizes trailing slash in docsPath", () => {
    const plan = buildDocsIndexPlan("./docs/")

    expect(plan.docsPath).toBe("docs")
    expect(plan.entries[0]?.targetPath.startsWith("docs/")).toBe(true)
  })

  it("rejects absolute docsPath values at runtime", () => {
    try {
      buildDocsIndexPlan("/tmp/docs")
      throw new Error("Expected buildDocsIndexPlan to reject absolute docsPath")
    } catch (error) {
      expect(error instanceof Error).toBe(true)
      const message = error instanceof Error ? error.message : ""
      expect(message).toBe("docsPath must be a relative path")
    }
  })

  it("rejects parent traversal docsPath values at runtime", () => {
    for (const invalidPath of ["../docs", "safe/../docs"]) {
      try {
        buildDocsIndexPlan(invalidPath)
        throw new Error(`Expected buildDocsIndexPlan to reject ${invalidPath}`)
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        const message = error instanceof Error ? error.message : ""
        expect(message).toBe("docsPath must not traverse parent directories")
      }
    }
  })

  it("falls back to ./docs for blank docsPath and keeps targets project-local", () => {
    const plan = buildDocsIndexPlan("   ")
    expect(plan.docsPath).toBe("docs")
    expect(plan.entries.every((entry) => entry.targetPath.startsWith("docs/"))).toBe(true)
  })

  it("validates canonical uniqueness for the current docs plan", () => {
    const plan = buildDocsIndexPlan("./docs")
    expect(validateDocsIndexPlan(plan)).toEqual([])
  })

  it("summarizes created and refreshed outputs from pre-run existence", () => {
    const plan = buildDocsIndexPlan("./docs")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    const product = plan.entries.find((entry) => entry.agentKey === "product-wunderkind")
    if (!marketing || !product) throw new Error("Expected docs plan entries")

    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [marketing.targetPath],
      existingAfter: [marketing.targetPath, product.targetPath],
    })

    expect(summary.refreshed).toEqual([marketing.targetPath])
    expect(summary.created).toEqual([product.targetPath])
    expect(summary.failed).toHaveLength(plan.entries.length - 2)
    expect(summary.skipped).toEqual([])
  })

  it("supports explicit skipped lanes without child completion tags", () => {
    const plan = buildDocsIndexPlan("./docs")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [],
      existingAfter: [],
      skippedAgentKeys: [marketing.agentKey],
    })

    expect(summary.skipped).toEqual([marketing.targetPath])
    expect(summary.failed).toHaveLength(plan.entries.length - 1)
  })
})
