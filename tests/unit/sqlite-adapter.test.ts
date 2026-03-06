import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { SqliteAdapter } from "../../src/memory/adapters/sqlite.js"
import { runAdapterContract } from "../shared/adapter-contract.js"

function makeDbPath(): Promise<{ dir: string; dbPath: string }> {
  return mkdtemp(path.join(os.tmpdir(), "wk-sqlite-test-")).then((dir) => ({
    dir,
    dbPath: path.join(dir, "test.db"),
  }))
}

async function makeAdapter(): Promise<{ adapter: SqliteAdapter; cleanup: () => Promise<void> }> {
  const { dir, dbPath } = await makeDbPath()
  const adapter = new SqliteAdapter(dbPath)
  return {
    adapter,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

runAdapterContract("SqliteAdapter (contract)", makeAdapter)

describe("SqliteAdapter (specific)", () => {
  let dir: string
  let dbPath: string
  let adapter: SqliteAdapter

  beforeEach(async () => {
    const result = await makeDbPath()
    dir = result.dir
    dbPath = result.dbPath
    adapter = new SqliteAdapter(dbPath)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("write returns entry with generated id", async () => {
    const entry = await adapter.write("agent-a", {
      agent: "agent-a",
      slug: "test-entry",
      content: "Hello sqlite",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    expect(entry.id).toBeTruthy()
    expect(typeof entry.id).toBe("string")
    expect(entry.content).toBe("Hello sqlite")
  })

  it("read returns [] for nonexistent agent", async () => {
    const entries = await adapter.read("no-one")
    expect(entries).toEqual([])
  })

  it("writing two entries makes read return both", async () => {
    await adapter.write("agent-b", {
      agent: "agent-b",
      slug: "first",
      content: "Entry A",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("agent-b", {
      agent: "agent-b",
      slug: "second",
      content: "Entry B",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const entries = await adapter.read("agent-b")
    expect(entries.length).toBe(2)
  })

  it("delete removes entry", async () => {
    const e = await adapter.write("agent-c", {
      agent: "agent-c",
      slug: "to-delete",
      content: "Delete me",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.delete(e.id)
    const entries = await adapter.read("agent-c")
    expect(entries.find((x) => x.id === e.id)).toBeUndefined()
  })

  it("deleteAll clears all entries for agent", async () => {
    await adapter.write("agent-d", {
      agent: "agent-d",
      slug: "one",
      content: "One",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("agent-d", {
      agent: "agent-d",
      slug: "two",
      content: "Two",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.deleteAll("agent-d")
    const entries = await adapter.read("agent-d")
    expect(entries.length).toBe(0)
  })

  it("search uses FTS5 and finds entries matching a unique keyword", async () => {
    await adapter.write("fts-agent", {
      agent: "fts-agent",
      slug: "golang-note",
      content: "golang concurrency patterns are elegant",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.write("fts-agent", {
      agent: "fts-agent",
      slug: "rust-note",
      content: "rust ownership model is revolutionary",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const results = await adapter.search("fts-agent", "concurrency")
    expect(results.length).toBe(1)
    const first = results[0]
    expect(first).toBeDefined()
    if (!first) return
    expect(first.content).toContain("concurrency")
  })

  it("search returns [] when no entries match", async () => {
    await adapter.write("fts-agent2", {
      agent: "fts-agent2",
      slug: "note",
      content: "Nothing here",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const results = await adapter.search("fts-agent2", "zzznomatchxxx")
    expect(results).toEqual([])
  })

  it("prune removes specified ids and returns count", async () => {
    const e1 = await adapter.write("pruner", {
      agent: "pruner",
      slug: "remove-me",
      content: "Remove",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    const e2 = await adapter.write("pruner", {
      agent: "pruner",
      slug: "keep-me",
      content: "Keep",
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
      slug: "pinned-one",
      content: "Pinned entry",
      createdAt: now,
      pinned: true,
      metadata: {},
    })
    await adapter.write("counter", {
      agent: "counter",
      slug: "normal-one",
      content: "Normal entry",
      createdAt: now + 1,
      pinned: false,
      metadata: {},
    })
    const count = await adapter.count("counter")
    expect(count.total).toBe(2)
    expect(count.pinned).toBe(1)
  })

  it("history returns entries for ADD and DELETE actions", async () => {
    const entry = await adapter.write("history-agent", {
      agent: "history-agent",
      slug: "hist-note",
      content: "Original content",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.delete(entry.id)
    const hist = await adapter.history(entry.id)
    expect(hist.length).toBeGreaterThanOrEqual(2)
    const actions = hist.map((h) => h.action)
    expect(actions).toContain("ADD")
    expect(actions).toContain("DELETE")
  })

  it("history returns entries for UPDATE action", async () => {
    const entry = await adapter.write("history-agent2", {
      agent: "history-agent2",
      slug: "update-note",
      content: "Before update",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    await adapter.update(entry.id, "After update")
    const hist = await adapter.history(entry.id)
    const actions = hist.map((h) => h.action)
    expect(actions).toContain("UPDATE")
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

  it("analyzeStale returns correct analysis for a mix of entries", async () => {
    const now = Date.now()
    const staleTs = now - 60 * 24 * 60 * 60 * 1000
    await adapter.write("stale-agent", {
      agent: "stale-agent",
      slug: "recent",
      content: "Recent note",
      createdAt: now - 1000,
      pinned: false,
      metadata: {},
    })
    await adapter.write("stale-agent", {
      agent: "stale-agent",
      slug: "old",
      content: "Old note",
      createdAt: staleTs,
      pinned: false,
      metadata: {},
    })
    const result = await adapter.analyzeStale("stale-agent")
    expect(result.recent).toBe(1)
    expect(result.stale).toBe(1)
  })
})
