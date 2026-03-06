import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import type { MemoryAdapter } from "../../src/memory/adapters/types.js"

type AdapterFactory = () => Promise<{ adapter: MemoryAdapter; cleanup: () => Promise<void> }>

export function runAdapterContract(name: string, factory: AdapterFactory): void {
  describe(name, () => {
    let adapter: MemoryAdapter
    let cleanup: () => Promise<void>

    beforeEach(async () => {
      const result = await factory()
      adapter = result.adapter
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup()
    })

    it("write returns entry with generated id", async () => {
      const entry = await adapter.write("agent-a", {
        agent: "agent-a",
        slug: "test-entry",
        content: "Hello world",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      expect(entry.id).toBeTruthy()
      expect(typeof entry.id).toBe("string")
      expect(entry.content).toBe("Hello world")
      expect(entry.agent).toBe("agent-a")
    })

    it("read returns written entries", async () => {
      await adapter.write("agent-b", {
        agent: "agent-b",
        slug: "entry-one",
        content: "First entry",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      const entries = await adapter.read("agent-b")
      expect(entries.length).toBe(1)
      const first = entries[0]
      expect(first).toBeTruthy()
      if (!first) return
      expect(first.content).toBe("First entry")
    })

    it("read returns [] for nonexistent agent", async () => {
      const entries = await adapter.read("no-such-agent")
      expect(entries).toEqual([])
    })

    it("delete removes an entry", async () => {
      const entry = await adapter.write("agent-c", {
        agent: "agent-c",
        slug: "to-delete",
        content: "Delete me",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      await adapter.delete(entry.id)
      const entries = await adapter.read("agent-c")
      expect(entries.find((e) => e.id === entry.id)).toBeUndefined()
    })

    it("deleteAll clears all entries for agent", async () => {
      await adapter.write("agent-d", {
        agent: "agent-d",
        slug: "entry-1",
        content: "First",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      await adapter.write("agent-d", {
        agent: "agent-d",
        slug: "entry-2",
        content: "Second",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      await adapter.deleteAll("agent-d")
      const entries = await adapter.read("agent-d")
      expect(entries.length).toBe(0)
    })

    it("search finds matching entries", async () => {
      await adapter.write("agent-e", {
        agent: "agent-e",
        slug: "apple-note",
        content: "I love apples",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      await adapter.write("agent-e", {
        agent: "agent-e",
        slug: "banana-note",
        content: "Bananas are yellow",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      const results = await adapter.search("agent-e", "apple")
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((e) => e.content.includes("apple"))).toBe(true)
    })

    it("search with no match returns []", async () => {
      await adapter.write("agent-f", {
        agent: "agent-f",
        slug: "something",
        content: "No match here",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      const results = await adapter.search("agent-f", "zzznomatchxxx")
      expect(results).toEqual([])
    })

    it("prune removes specified ids and returns count", async () => {
      const e1 = await adapter.write("agent-g", {
        agent: "agent-g",
        slug: "prune-me-1",
        content: "Entry one",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      const e2 = await adapter.write("agent-g", {
        agent: "agent-g",
        slug: "keep-me",
        content: "Entry two keep",
        createdAt: Date.now(),
        pinned: false,
        metadata: {},
      })
      const removed = await adapter.prune("agent-g", [e1.id])
      expect(removed).toBe(1)
      const entries = await adapter.read("agent-g")
      expect(entries.find((e) => e.id === e1.id)).toBeUndefined()
      expect(entries.find((e) => e.id === e2.id)).toBeDefined()
    })

    it("count returns correct totals", async () => {
      const now = Date.now()
      await adapter.write("agent-h", {
        agent: "agent-h",
        slug: "count-1",
        content: "One",
        createdAt: now,
        pinned: true,
        metadata: {},
      })
      await adapter.write("agent-h", {
        agent: "agent-h",
        slug: "count-2",
        content: "Two",
        createdAt: now + 1,
        pinned: false,
        metadata: {},
      })
      const count = await adapter.count("agent-h")
      expect(count.total).toBe(2)
      expect(count.pinned).toBe(1)
    })

    it("status returns { ok: boolean, message: string }", async () => {
      const s = await adapter.status()
      expect(typeof s.ok).toBe("boolean")
      expect(typeof s.message).toBe("string")
    })
  })
}
