import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { FileAdapter } from "../../src/memory/adapters/file.js"
import { runAdapterContract } from "../shared/adapter-contract.js"

function makeProjectDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "wk-file-test-"))
}

async function makeAdapter(): Promise<{ adapter: FileAdapter; cleanup: () => Promise<void> }> {
  const dir = await makeProjectDir()
  const adapter = new FileAdapter(dir)
  return {
    adapter,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

runAdapterContract("FileAdapter (contract)", makeAdapter)

describe("FileAdapter (specific)", () => {
  let projectDir: string
  let adapter: FileAdapter

  beforeEach(async () => {
    projectDir = await makeProjectDir()
    adapter = new FileAdapter(projectDir)
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("write returns entry with generated id field", async () => {
    const entry = await adapter.write("my-agent", {
      agent: "my-agent",
      slug: "first-note",
      content: "Some content here",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    expect(entry.id).toBeTruthy()
    expect(entry.agent).toBe("my-agent")
    expect(entry.content).toBe("Some content here")
  })

  it("read returns [] for nonexistent agent", async () => {
    const entries = await adapter.read("nobody")
    expect(entries).toEqual([])
  })

  it("writing two entries makes read return both", async () => {
    await adapter.write("agent-x", {
      agent: "agent-x",
      slug: "note-a",
      content: "Alpha",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("agent-x", {
      agent: "agent-x",
      slug: "note-b",
      content: "Beta",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const entries = await adapter.read("agent-x")
    expect(entries.length).toBe(2)
  })

  it("delete removes entry from file", async () => {
    const e = await adapter.write("agent-y", {
      agent: "agent-y",
      slug: "delete-me",
      content: "To be removed",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.delete(e.id)
    const entries = await adapter.read("agent-y")
    expect(entries.find((x) => x.id === e.id)).toBeUndefined()
  })

  it("deleteAll clears all entries for agent", async () => {
    await adapter.write("agent-z", {
      agent: "agent-z",
      slug: "one",
      content: "One",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("agent-z", {
      agent: "agent-z",
      slug: "two",
      content: "Two",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.deleteAll("agent-z")
    const entries = await adapter.read("agent-z")
    expect(entries.length).toBe(0)
  })

  it("search finds matching entries by content", async () => {
    await adapter.write("searcher", {
      agent: "searcher",
      slug: "relevant",
      content: "TypeScript is great",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("searcher", {
      agent: "searcher",
      slug: "irrelevant",
      content: "Totally unrelated stuff",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const results = await adapter.search("searcher", "typescript")
    expect(results.length).toBe(1)
    const first = results[0]
    expect(first).toBeDefined()
    if (!first) return
    expect(first.content).toContain("TypeScript")
  })

  it("search returns [] when no entries match", async () => {
    await adapter.write("searcher2", {
      agent: "searcher2",
      slug: "something",
      content: "Nothing relevant",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const results = await adapter.search("searcher2", "zzznomatch")
    expect(results).toEqual([])
  })

  it("prune removes specified ids and returns count", async () => {
    const e1 = await adapter.write("pruner", {
      agent: "pruner",
      slug: "remove",
      content: "Remove this",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const e2 = await adapter.write("pruner", {
      agent: "pruner",
      slug: "keep",
      content: "Keep this",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const removed = await adapter.prune("pruner", [e1.id])
    expect(removed).toBe(1)
    const entries = await adapter.read("pruner")
    expect(entries.find((e) => e.id === e1.id)).toBeUndefined()
    expect(entries.find((e) => e.id === e2.id)).toBeDefined()
  })

  it("count returns correct total and pinned count", async () => {
    const now = Date.now()
    await adapter.write("counter", {
      agent: "counter",
      slug: "pinned-note",
      content: "Pinned",
      createdAt: now,
      pinned: true,
      metadata: {},
    })
    await adapter.write("counter", {
      agent: "counter",
      slug: "normal-note",
      content: "Normal",
      createdAt: now + 1,
      pinned: false,
      metadata: {},
    })
    const count = await adapter.count("counter")
    expect(count.total).toBe(2)
    expect(count.pinned).toBe(1)
  })

  it("pinned entries are preserved through prune", async () => {
    const pinned = await adapter.write("guard", {
      agent: "guard",
      slug: "pinned-guard",
      content: "Keep this pinned",
      createdAt: Date.now(),
      pinned: true,
      metadata: {},
    })
    const stale = await adapter.write("guard", {
      agent: "guard",
      slug: "stale-guard",
      content: "Remove this",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.prune("guard", [stale.id])
    const entries = await adapter.read("guard")
    expect(entries.find((e) => e.id === pinned.id)).toBeDefined()
    expect(entries.find((e) => e.id === stale.id)).toBeUndefined()
  })

  it("update changes the content of an existing entry", async () => {
    const e = await adapter.write("updater", {
      agent: "updater",
      slug: "update-target",
      content: "Original content",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const updated = await adapter.update(e.id, "Updated content")
    expect(updated.id).toBe(e.id)
    expect(updated.content).toBe("Updated content")
    const entries = await adapter.read("updater")
    const found = entries.find((x) => x.id === e.id)
    expect(found).toBeDefined()
    if (!found) return
    expect(found.content).toBe("Updated content")
  })

  it("update throws when id does not exist", async () => {
    await expect(adapter.update("non-existent-id", "new content")).rejects.toThrow(
      "Memory entry not found: non-existent-id",
    )
  })

  it("delete on non-existent id does not throw", async () => {
    await expect(adapter.delete("no-such-id")).resolves.toBeUndefined()
  })

  it("search finds entries by slug match", async () => {
    await adapter.write("slug-searcher", {
      agent: "slug-searcher",
      slug: "wunderkind-architecture-note",
      content: "Some unrelated body text",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("slug-searcher", {
      agent: "slug-searcher",
      slug: "other-topic",
      content: "Something else entirely",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const results = await adapter.search("slug-searcher", "architecture")
    expect(results.length).toBe(1)
    const first = results[0]
    expect(first).toBeDefined()
    if (!first) return
    expect(first.slug).toContain("architecture")
  })

  it("history always returns empty array", async () => {
    const e = await adapter.write("hist-agent", {
      agent: "hist-agent",
      slug: "hist-entry",
      content: "Some content",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const hist = await adapter.history(e.id)
    expect(hist).toEqual([])
  })

  it("analyzeStale returns correct analysis for entries", async () => {
    const now = Date.now()
    const staleTs = now - 60 * 24 * 60 * 60 * 1000
    await adapter.write("stale-agent", {
      agent: "stale-agent",
      slug: "recent-entry",
      content: "Recent note",
      createdAt: now - 1000,
      pinned: false,
      metadata: {},
    })
    await adapter.write("stale-agent", {
      agent: "stale-agent",
      slug: "stale-entry",
      content: "Old note from long ago",
      createdAt: staleTs,
      pinned: false,
      metadata: {},
    })
    const result = await adapter.analyzeStale("stale-agent")
    expect(result.recent).toBe(1)
    expect(result.stale).toBe(1)
    expect(result.toKeep.length).toBe(1)
    expect(result.toDrop.length).toBe(1)
  })
})
