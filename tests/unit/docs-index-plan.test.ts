import { describe, expect, it } from "bun:test"
import {
  aggregateDocsIndexResults,
  buildDocsIndexPlan,
  buildDocsIndexCompletionTag,
  detectDocsIndexCollisions,
  hasCompleteDocsIndexOutputs,
  parseDocsIndexCompletionTag,
} from "../../src/agents/docs-index-plan.js"

describe("docs-index plan", () => {
  it("builds one entry per eligible docs agent", () => {
    const plan = buildDocsIndexPlan("./docs")

    expect(plan.docsPath).toBe("./docs")
    expect(plan.entries.length).toBe(9)
    expect(plan.entries.every((entry) => entry.targetPath.startsWith("./docs/"))).toBe(true)
  })

  it("normalizes trailing slash in docsPath", () => {
    const plan = buildDocsIndexPlan("./docs/")

    expect(plan.docsPath).toBe("./docs")
    expect(plan.entries[0]?.targetPath.startsWith("./docs/")).toBe(true)
  })

  it("detects no collisions for the current canonical map", () => {
    const plan = buildDocsIndexPlan("./docs")

    expect(detectDocsIndexCollisions(plan)).toEqual([])
  })

  it("requires every planned canonical output for success", () => {
    const plan = buildDocsIndexPlan("./docs")
    const completePaths = plan.entries.map((entry) => entry.targetPath)
    const incompletePaths = completePaths.slice(0, -1)

    expect(hasCompleteDocsIndexOutputs(plan, completePaths)).toBe(true)
    expect(hasCompleteDocsIndexOutputs(plan, incompletePaths)).toBe(false)
  })

  it("builds and parses a child completion tag", () => {
    const tag = buildDocsIndexCompletionTag({
      agentKey: "marketing-wunderkind",
      targetPath: "./docs/marketing-strategy.md",
      status: "complete",
      notes: ["updated canonical file"],
    })

    expect(tag).toContain("<wunderkind-docs-index-result>")
    expect(parseDocsIndexCompletionTag(tag)).toEqual({
      agentKey: "marketing-wunderkind",
      targetPath: "./docs/marketing-strategy.md",
      status: "complete",
      notes: ["updated canonical file"],
    })
  })

  it("aggregates partial success while blocking init-deep", () => {
    const plan = buildDocsIndexPlan("./docs")
    const complete = plan.entries[0]
    const failed = plan.entries[1]
    if (!complete || !failed) throw new Error("Expected plan entries")

    const aggregation = aggregateDocsIndexResults(
      plan,
      [
        { agentKey: complete.agentKey, targetPath: complete.targetPath, status: "complete", notes: [] },
        { agentKey: failed.agentKey, targetPath: failed.targetPath, status: "timed_out", notes: ["child timed out"] },
      ],
      [complete.targetPath],
    )

    expect(aggregation.completed).toHaveLength(1)
    expect(aggregation.incomplete).toHaveLength(plan.entries.length - 1)
    expect(aggregation.canRunInitDeep).toBe(false)
  })

  it("rejects duplicate completion results for the same planned entry", () => {
    const plan = buildDocsIndexPlan("./docs")
    const first = plan.entries[0]
    if (!first) throw new Error("Expected plan entry")

    const aggregation = aggregateDocsIndexResults(
      plan,
      [
        { agentKey: first.agentKey, targetPath: first.targetPath, status: "complete", notes: [] },
        { agentKey: first.agentKey, targetPath: first.targetPath, status: "complete", notes: ["duplicate"] },
      ],
      [first.targetPath],
    )

    expect(aggregation.completed).toHaveLength(0)
    expect(aggregation.incomplete.some((entry) => entry.notes.includes("duplicate completion results"))).toBe(true)
    expect(aggregation.canRunInitDeep).toBe(false)
  })

  it("rejects cross-claimed target paths from the wrong agent", () => {
    const plan = buildDocsIndexPlan("./docs")
    const first = plan.entries[0]
    const second = plan.entries[1]
    if (!first || !second) throw new Error("Expected plan entries")

    const aggregation = aggregateDocsIndexResults(
      plan,
      [
        { agentKey: first.agentKey, targetPath: second.targetPath, status: "complete", notes: ["forged target"] },
      ],
      [second.targetPath],
    )

    expect(aggregation.completed).toHaveLength(0)
    expect(aggregation.incomplete.some((entry) => entry.agentKey === first.agentKey || entry.agentKey === second.agentKey)).toBe(true)
    expect(aggregation.canRunInitDeep).toBe(false)
  })

  it("does not count stale files without a matching completion result toward partial success", () => {
    const plan = buildDocsIndexPlan("./docs")
    const first = plan.entries[0]
    const second = plan.entries[1]
    if (!first || !second) throw new Error("Expected plan entries")

    const aggregation = aggregateDocsIndexResults(
      plan,
      [
        { agentKey: first.agentKey, targetPath: first.targetPath, status: "complete", notes: [] },
      ],
      [first.targetPath, second.targetPath],
    )

    expect(aggregation.completed).toHaveLength(1)
    expect(aggregation.incomplete.some((entry) => entry.targetPath === second.targetPath)).toBe(true)
    expect(aggregation.canRunInitDeep).toBe(false)
  })
})
