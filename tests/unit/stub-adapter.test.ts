import { describe, it, expect } from "bun:test"
import { StubAdapter } from "../../src/memory/adapters/stub.js"

const STUB_MESSAGE =
  "No memory system bootstrapped. Set memoryAdapter in wunderkind.config.jsonc to 'file', 'sqlite', or 'mem0'."

describe("StubAdapter", () => {
  it("read returns empty array", async () => {
    const adapter = new StubAdapter()
    const entries = await adapter.read("any-agent")
    expect(entries).toEqual([])
  })

  it("write returns entry with stub message as content", async () => {
    const adapter = new StubAdapter()
    const entry = await adapter.write("my-agent", {
      agent: "my-agent",
      slug: "my-slug",
      content: "real content that should be ignored",
      createdAt: 1000,
      pinned: false,
      metadata: {},
    })
    expect(entry.id).toBeTruthy()
    expect(entry.agent).toBe("my-agent")
    expect(entry.slug).toBe("my-slug")
    expect(entry.content).toBe(STUB_MESSAGE)
    expect(entry.createdAt).toBe(1000)
    expect(entry.pinned).toBe(false)
  })

  it("write with empty slug generates slug from content", async () => {
    const adapter = new StubAdapter()
    const entry = await adapter.write("my-agent", {
      agent: "my-agent",
      slug: "",
      content: "some interesting content here",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    expect(entry.slug.length).toBeGreaterThan(0)
    expect(entry.slug).not.toBe("")
  })

  it("update returns entry with stub message content", async () => {
    const adapter = new StubAdapter()
    const entry = await adapter.update("some-id", "new content")
    expect(entry.id).toBe("some-id")
    expect(entry.content).toBe(STUB_MESSAGE)
    expect(entry.agent).toBe("")
    expect(entry.pinned).toBe(false)
  })

  it("delete resolves without throwing", async () => {
    const adapter = new StubAdapter()
    await expect(adapter.delete("any-id")).resolves.toBeUndefined()
  })

  it("deleteAll resolves without throwing", async () => {
    const adapter = new StubAdapter()
    await expect(adapter.deleteAll("any-agent")).resolves.toBeUndefined()
  })

  it("search returns empty array", async () => {
    const adapter = new StubAdapter()
    const results = await adapter.search("any-agent", "any query")
    expect(results).toEqual([])
  })

  it("history returns empty array", async () => {
    const adapter = new StubAdapter()
    const history = await adapter.history("any-id")
    expect(history).toEqual([])
  })

  it("analyzeStale returns zero counts", async () => {
    const adapter = new StubAdapter()
    const result = await adapter.analyzeStale("any-agent")
    expect(result.toKeep).toEqual([])
    expect(result.toDrop).toEqual([])
    expect(result.pinned).toBe(0)
    expect(result.recent).toBe(0)
    expect(result.stale).toBe(0)
  })

  it("prune returns 0", async () => {
    const adapter = new StubAdapter()
    const removed = await adapter.prune("any-agent", ["id1", "id2"])
    expect(removed).toBe(0)
  })

  it("count returns all zeros", async () => {
    const adapter = new StubAdapter()
    const count = await adapter.count("any-agent")
    expect(count.total).toBe(0)
    expect(count.pinned).toBe(0)
    expect(count.oldest).toBe(0)
    expect(count.newest).toBe(0)
  })

  it("status returns ok: false with stub message", async () => {
    const adapter = new StubAdapter()
    const result = await adapter.status()
    expect(result.ok).toBe(false)
    expect(result.message).toBe(STUB_MESSAGE)
  })
})
