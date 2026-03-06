import { describe, it, expect } from "bun:test"
import { generateSlug, generateId, analyzeStale } from "../../src/memory/format.js"
import type { MemoryEntry } from "../../src/memory/adapters/types.js"

function makeEntry(overrides: Partial<MemoryEntry> & { id: string; agent: string; slug: string; content: string; createdAt: number }): MemoryEntry {
  return {
    pinned: false,
    metadata: {},
    ...overrides,
  }
}

describe("generateSlug", () => {
  it("returns empty string for empty input", () => {
    expect(generateSlug("")).toBe("")
  })

  it("lowercases and replaces spaces with dashes", () => {
    expect(generateSlug("Hello World")).toBe("hello-world")
  })

  it("strips special characters", () => {
    expect(generateSlug("foo! bar@baz#")).toBe("foo-barbaz")
  })

  it("truncates to 40 chars after slicing 80 from input", () => {
    const long = "a".repeat(100)
    const slug = generateSlug(long)
    expect(slug.length).toBeLessThanOrEqual(40)
  })

  it("trims leading/trailing whitespace before processing", () => {
    expect(generateSlug("  hello  ")).toBe("hello")
  })

  it("handles a string longer than 80 chars by slicing first", () => {
    const base = "x".repeat(90)
    const result = generateSlug(base)
    expect(result.length).toBeLessThanOrEqual(40)
    expect(result).toMatch(/^[a-z0-9-]*$/)
  })

  it("a short string stays intact", () => {
    expect(generateSlug("hello-world-123")).toBe("hello-world-123")
  })
})

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId()
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })

  it("matches UUID v4 format", () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it("returns different values on successive calls", () => {
    const a = generateId()
    const b = generateId()
    expect(a).not.toBe(b)
  })
})

describe("analyzeStale", () => {
  it("returns all zeros for empty entries", () => {
    const result = analyzeStale([])
    expect(result.toKeep).toEqual([])
    expect(result.toDrop).toEqual([])
    expect(result.pinned).toBe(0)
    expect(result.recent).toBe(0)
    expect(result.stale).toBe(0)
  })

  it("puts all pinned entries in toKeep", () => {
    const entries: MemoryEntry[] = [
      makeEntry({ id: "1", agent: "a", slug: "s1", content: "c1", createdAt: 0, pinned: true }),
      makeEntry({ id: "2", agent: "a", slug: "s2", content: "c2", createdAt: 0, pinned: true }),
    ]
    const result = analyzeStale(entries)
    expect(result.toKeep.length).toBe(2)
    expect(result.toDrop.length).toBe(0)
    expect(result.pinned).toBe(2)
    expect(result.stale).toBe(0)
  })

  it("puts all recent entries (within 30 days) in toKeep", () => {
    const now = Date.now()
    const entries: MemoryEntry[] = [
      makeEntry({ id: "1", agent: "a", slug: "s1", content: "c1", createdAt: now - 1000 }),
      makeEntry({ id: "2", agent: "a", slug: "s2", content: "c2", createdAt: now - 86400 * 1000 }),
    ]
    const result = analyzeStale(entries)
    expect(result.toKeep.length).toBe(2)
    expect(result.toDrop.length).toBe(0)
    expect(result.recent).toBe(2)
    expect(result.stale).toBe(0)
  })

  it("puts stale (older than 30 days) unpinned entries in toDrop", () => {
    const now = Date.now()
    const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000
    const entries: MemoryEntry[] = [
      makeEntry({ id: "1", agent: "a", slug: "s1", content: "c1", createdAt: thirtyOneDaysAgo }),
    ]
    const result = analyzeStale(entries)
    expect(result.toDrop.length).toBe(1)
    expect(result.toKeep.length).toBe(0)
    expect(result.stale).toBe(1)
    expect(result.recent).toBe(0)
  })

  it("correctly categorizes a mix of pinned, recent, and stale entries", () => {
    const now = Date.now()
    const staleTs = now - 60 * 24 * 60 * 60 * 1000
    const recentTs = now - 1000

    const pinned = makeEntry({ id: "pin", agent: "a", slug: "pinned", content: "pinned", createdAt: staleTs, pinned: true })
    const recent = makeEntry({ id: "rec", agent: "a", slug: "recent", content: "recent", createdAt: recentTs })
    const stale = makeEntry({ id: "stl", agent: "a", slug: "stale", content: "stale", createdAt: staleTs })

    const result = analyzeStale([pinned, recent, stale])
    expect(result.pinned).toBe(1)
    expect(result.recent).toBe(1)
    expect(result.stale).toBe(1)
    expect(result.toKeep.length).toBe(2)
    expect(result.toDrop.length).toBe(1)
    expect(result.toKeep.some((e) => e.id === "pin")).toBe(true)
    expect(result.toKeep.some((e) => e.id === "rec")).toBe(true)
    expect(result.toDrop.some((e) => e.id === "stl")).toBe(true)
  })

  it("respects a custom recentWindowMs parameter", () => {
    const now = Date.now()
    const justOld = now - 2000
    const justNew = now - 500

    const entries: MemoryEntry[] = [
      makeEntry({ id: "old", agent: "a", slug: "old", content: "old", createdAt: justOld }),
      makeEntry({ id: "new", agent: "a", slug: "new", content: "new", createdAt: justNew }),
    ]

    const result = analyzeStale(entries, 1000)
    expect(result.stale).toBe(1)
    expect(result.recent).toBe(1)
    expect(result.toDrop.some((e) => e.id === "old")).toBe(true)
    expect(result.toKeep.some((e) => e.id === "new")).toBe(true)
  })
})
