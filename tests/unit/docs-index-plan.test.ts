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
    expect(plan.entries.length).toBe(5)
    expect(plan.entries.every((entry) => entry.managedLanePath.startsWith("docs/"))).toBe(true)
  })

  it("normalizes trailing slash in docsPath", () => {
    const plan = buildDocsIndexPlan("./docs/")

    expect(plan.docsPath).toBe("docs")
    expect(plan.entries[0]?.managedLanePath.startsWith("docs/")).toBe(true)
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
    expect(plan.entries.every((entry) => entry.managedLanePath.startsWith("docs/"))).toBe(true)
  })

  it("validates canonical uniqueness for the current docs plan", () => {
    const plan = buildDocsIndexPlan("./docs")
    expect(validateDocsIndexPlan(plan)).toEqual([])
  })

  it("keeps append-dated outputs in the canonical managed lane", () => {
    const plan = buildDocsIndexPlan("./docs", process.cwd(), "append-dated")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    expect(marketing.managedLanePath).toBe("docs/marketing-strategy.md")
    expect(marketing.outputStrategy).toBe("in-place")
    expect(marketing.writePathPattern).toBe(marketing.managedLanePath)
  })

  it("models new-dated-file outputs as a managed family pattern", () => {
    const plan = buildDocsIndexPlan("./docs", process.cwd(), "new-dated-file")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    expect(marketing.managedLanePath).toBe("docs/marketing-strategy.md")
    expect(marketing.outputStrategy).toBe("dated-file-family")
    expect(marketing.writePathPattern).toBe("docs/marketing-strategy--<UTC_TOKEN>.md")
  })

  it("reports duplicate target paths in the plan", () => {
    const plan = buildDocsIndexPlan("./docs")
    const first = plan.entries[0]
    if (!first) throw new Error("Expected at least one docs plan entry")
    const duplicate = {
      agentKey: "product-wunderkind" as const,
      canonicalFilename: "product-strategy.md",
      managedLanePath: first.managedLanePath,
      outputStrategy: first.outputStrategy,
      writePathPattern: first.writePathPattern,
    }
    const planWithDuplicate = { ...plan, entries: [...plan.entries, duplicate] }
    const errors = validateDocsIndexPlan(planWithDuplicate)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(first.agentKey)
    expect(errors[0]).toContain("product-wunderkind")
    expect(errors[0]).toContain(first.managedLanePath)
  })

  it("summarizes created and refreshed outputs from pre-run existence", () => {
    const plan = buildDocsIndexPlan("./docs")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    const product = plan.entries.find((entry) => entry.agentKey === "product-wunderkind")
    if (!marketing || !product) throw new Error("Expected docs plan entries")

    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [marketing.managedLanePath],
      existingAfter: [marketing.managedLanePath, product.managedLanePath],
    })

    expect(summary.refreshed).toEqual([marketing.managedLanePath])
    expect(summary.created).toEqual([product.managedLanePath])
    expect(summary.failed).toHaveLength(plan.entries.length - 2)
    expect(summary.skipped).toEqual([])
  })

  it("summarizes new-dated-file outputs using the actual created paths", () => {
    const plan = buildDocsIndexPlan("./docs", process.cwd(), "new-dated-file")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    const outputPath = "docs/marketing-strategy--2026-03-12T18-37-52Z.md"
    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [],
      existingAfter: [outputPath],
      outputPathsAfterByAgentKey: { [marketing.agentKey]: [outputPath] },
    })

    expect(summary.created).toEqual([outputPath])
    expect(summary.refreshed).toEqual([])
  })

  it("treats a new timestamped file as created even when the canonical lane already existed", () => {
    const plan = buildDocsIndexPlan("./docs", process.cwd(), "new-dated-file")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    const outputPath = "docs/marketing-strategy--2026-03-12T18-37-52Z.md"
    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [marketing.managedLanePath],
      existingAfter: [marketing.managedLanePath, outputPath],
      outputPathsAfterByAgentKey: { [marketing.agentKey]: [outputPath] },
    })

    expect(summary.created).toEqual([outputPath])
    expect(summary.refreshed).toEqual([])
  })

  it("treats an already-existing timestamped family file as refreshed", () => {
    const plan = buildDocsIndexPlan("./docs", process.cwd(), "new-dated-file")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    const outputPath = "docs/marketing-strategy--2026-03-12T18-37-52Z.md"
    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [marketing.managedLanePath, outputPath],
      existingAfter: [marketing.managedLanePath, outputPath],
      outputPathsAfterByAgentKey: { [marketing.agentKey]: [outputPath] },
    })

    expect(summary.created).toEqual([])
    expect(summary.refreshed).toEqual([outputPath])
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

    expect(summary.skipped).toEqual([marketing.managedLanePath])
    expect(summary.failed).toHaveLength(plan.entries.length - 1)
  })

  it("fails a new-dated-file lane when no actual outputs were produced", () => {
    const plan = buildDocsIndexPlan("./docs", process.cwd(), "new-dated-file")
    const marketing = plan.entries.find((entry) => entry.agentKey === "marketing-wunderkind")
    if (!marketing) throw new Error("Expected docs plan entry")

    const summary = summarizeDocsIndexResults(plan, {
      existingBefore: [],
      existingAfter: [],
      outputPathsAfterByAgentKey: { [marketing.agentKey]: [] },
    })

    expect(summary.failed).toContain(marketing.managedLanePath)
  })
})
