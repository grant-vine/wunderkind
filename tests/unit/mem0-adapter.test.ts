import { describe, it, expect, mock, spyOn, beforeEach } from "bun:test"

// mock.module MUST come before the import of Mem0Adapter so Bun hoists it
const mockAdd = mock(async () => ({
  results: [{ id: "mem0-id-1", memory: "stored content", createdAt: "2024-01-01T00:00:00Z", metadata: {} }],
}))
const mockGetAll = mock(async () => ({ results: [] }))
const mockSearch = mock(async () => ({ results: [] }))
const mockDelete = mock(async () => undefined)
const mockDeleteAll = mock(async () => undefined)
const mockUpdate = mock(async () => undefined)
const mockGet = mock(async () => ({
  id: "mem0-id-1",
  memory: "updated content",
  createdAt: "2024-01-01T00:00:00Z",
}))
const mockHistory = mock(async () => [
  { event: "ADD", new_memory: "stored content", created_at: "2024-01-01T00:00:00Z" },
])

const mockFromConfig = mock(() => {
  const inst = new (class {
    add = mockAdd
    getAll = mockGetAll
    search = mockSearch
    delete = mockDelete
    deleteAll = mockDeleteAll
    update = mockUpdate
    get = mockGet
    history = mockHistory
  })()
  return inst
})

mock.module("mem0ai/oss", () => ({
  Memory: class {
    static fromConfig = mockFromConfig
    add = mockAdd
    getAll = mockGetAll
    search = mockSearch
    delete = mockDelete
    deleteAll = mockDeleteAll
    update = mockUpdate
    get = mockGet
    history = mockHistory
  },
}))

import { Mem0Adapter } from "../../src/memory/adapters/mem0.js"

describe("Mem0Adapter", () => {
  const url = "http://localhost:8000"

  beforeEach(() => {
    mockAdd.mockClear()
    mockGetAll.mockClear()
    mockSearch.mockClear()
    mockDelete.mockClear()
    mockDeleteAll.mockClear()
    mockUpdate.mockClear()
    mockGet.mockClear()
    mockHistory.mockClear()
    mockFromConfig.mockClear()
  })

  it("write returns a MemoryEntry with id and content from mem0 result", async () => {
    const adapter = new Mem0Adapter({ url })
    mockAdd.mockImplementationOnce(async () => ({
      results: [{ id: "m1", memory: "test memory", createdAt: "2024-06-01T00:00:00Z", metadata: {} }],
    }))
    const entry = await adapter.write("agent-a", {
      agent: "agent-a",
      slug: "test-slug",
      content: "test memory",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    expect(entry.id).toBe("m1")
    expect(entry.content).toBe("test memory")
    expect(entry.agent).toBe("agent-a")
  })

  it("write falls back to generateId when results array is empty", async () => {
    const adapter = new Mem0Adapter({ url })
    mockAdd.mockImplementationOnce(async () => ({ results: [] }))
    const entry = await adapter.write("agent-b", {
      agent: "agent-b",
      slug: "fallback-slug",
      content: "fallback content",
      createdAt: 12345,
      pinned: false,
      metadata: {},
    })
    expect(typeof entry.id).toBe("string")
    expect(entry.id.length).toBeGreaterThan(0)
    expect(entry.content).toBe("fallback content")
    expect(entry.slug).toBe("fallback-slug")
    expect(entry.createdAt).toBe(12345)
  })

  it("read maps getAll results to MemoryEntry array", async () => {
    const adapter = new Mem0Adapter({ url })
    mockGetAll.mockImplementationOnce(async () => ({
      results: [
        { id: "r1", memory: "first entry", createdAt: "2024-01-01T00:00:00Z", metadata: {} },
        { id: "r2", memory: "second entry", createdAt: "2024-02-01T00:00:00Z", metadata: {} },
      ],
    }))
    const entries = await adapter.read("agent-c")
    expect(entries.length).toBe(2)
    expect(entries[0]?.id).toBe("r1")
    expect(entries[0]?.content).toBe("first entry")
    expect(entries[1]?.id).toBe("r2")
    expect(entries[1]?.content).toBe("second entry")
  })

  it("read returns empty array when getAll returns empty results", async () => {
    const adapter = new Mem0Adapter({ url })
    mockGetAll.mockImplementationOnce(async () => ({ results: [] }))
    const entries = await adapter.read("empty-agent")
    expect(entries).toEqual([])
  })

  it("update calls update and get, returns entry with updated content", async () => {
    const adapter = new Mem0Adapter({ url })
    mockUpdate.mockImplementationOnce(async () => undefined)
    mockGet.mockImplementationOnce(async () => ({
      id: "upd-id",
      memory: "fresh content",
      createdAt: "2024-05-01T00:00:00Z",
    }))
    const entry = await adapter.update("upd-id", "fresh content")
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(entry.id).toBe("upd-id")
    expect(entry.content).toBe("fresh content")
  })

  it("delete calls mem0 delete with the id", async () => {
    const adapter = new Mem0Adapter({ url })
    await adapter.delete("del-id")
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it("deleteAll calls mem0 deleteAll with agentId", async () => {
    const adapter = new Mem0Adapter({ url })
    await adapter.deleteAll("my-agent")
    expect(mockDeleteAll).toHaveBeenCalledTimes(1)
  })

  it("search returns mapped MemoryEntry array", async () => {
    const adapter = new Mem0Adapter({ url })
    mockSearch.mockImplementationOnce(async () => ({
      results: [{ id: "s1", memory: "searchable content", createdAt: "2024-03-01T00:00:00Z", metadata: {} }],
    }))
    const results = await adapter.search("agent-e", "searchable")
    expect(results.length).toBe(1)
    expect(results[0]?.content).toBe("searchable content")
  })

  it("history returns mapped HistoryEntry array", async () => {
    const adapter = new Mem0Adapter({ url })
    mockHistory.mockImplementationOnce(async () => [
      { event: "ADD", new_memory: "initial memory", created_at: "2024-01-15T12:00:00Z" },
      { event: "UPDATE", new_memory: "updated memory", created_at: "2024-01-20T12:00:00Z" },
    ])
    const hist = await adapter.history("h-id")
    expect(hist.length).toBe(2)
    expect(hist[0]?.action).toBe("ADD")
    expect(hist[0]?.value).toBe("initial memory")
    expect(hist[1]?.action).toBe("UPDATE")
    expect(hist[1]?.value).toBe("updated memory")
  })

  it("history handles missing event and new_memory fields", async () => {
    const adapter = new Mem0Adapter({ url })
    mockHistory.mockImplementationOnce(async () => [{ event: undefined, new_memory: undefined, created_at: undefined }])
    const hist = await adapter.history("empty-hist-id")
    expect(hist.length).toBe(1)
    expect(hist[0]?.action).toBe("")
    expect(hist[0]?.value).toBe("")
    expect(typeof hist[0]?.timestamp).toBe("number")
  })

  it("analyzeStale returns StaleAnalysis from read entries", async () => {
    const adapter = new Mem0Adapter({ url })
    const now = Date.now()
    const staleTs = now - 60 * 24 * 60 * 60 * 1000
    mockGetAll.mockImplementationOnce(async () => ({
      results: [
        { id: "stale1", memory: "old stuff", createdAt: staleTs, metadata: {} },
        { id: "new1", memory: "fresh stuff", createdAt: now - 1000, metadata: {} },
      ],
    }))
    const result = await adapter.analyzeStale("agent-f")
    expect(result.stale).toBe(1)
    expect(result.recent).toBe(1)
    expect(result.toKeep.length).toBe(1)
    expect(result.toDrop.length).toBe(1)
  })

  it("prune deletes each id and returns removed count", async () => {
    const adapter = new Mem0Adapter({ url })
    const removed = await adapter.prune("agent-g", ["id1", "id2"])
    expect(removed).toBe(2)
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })

  it("count returns correct totals from read entries", async () => {
    const adapter = new Mem0Adapter({ url })
    const now = Date.now()
    mockGetAll.mockImplementationOnce(async () => ({
      results: [
        { id: "c1", memory: "first", createdAt: now - 2000, metadata: {} },
        { id: "c2", memory: "second", createdAt: now - 1000, metadata: {} },
      ],
    }))
    const count = await adapter.count("agent-h")
    expect(count.total).toBe(2)
    expect(count.pinned).toBe(0)
    expect(count.oldest).toBeLessThan(count.newest)
  })

  it("count returns all zeros for empty agent", async () => {
    const adapter = new Mem0Adapter({ url })
    mockGetAll.mockImplementationOnce(async () => ({ results: [] }))
    const count = await adapter.count("empty-agent")
    expect(count.total).toBe(0)
    expect(count.pinned).toBe(0)
    expect(count.oldest).toBe(0)
    expect(count.newest).toBe(0)
  })

  it("status returns ok: true when fetch returns ok", async () => {
    const adapter = new Mem0Adapter({ url })
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: true } as Response))
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(true)
    expect(result.message).toBe("mem0 adapter ready")
  })

  it("status returns ok: false when fetch returns non-ok HTTP", async () => {
    const adapter = new Mem0Adapter({ url })
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: false, status: 503 } as Response))
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("mem0 returned HTTP 503")
  })

  it("status returns ok: false when fetch throws network error", async () => {
    const adapter = new Mem0Adapter({ url })
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => {
      throw new Error("Network unreachable")
    })
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("Network unreachable")
  })

  it("uses Memory.fromConfig when llmProvider is set", async () => {
    const adapter = new Mem0Adapter({
      url,
      llmProvider: "ollama",
      llmModel: "llama3.1",
      llmBaseUrl: "http://localhost:11434",
    })
    mockAdd.mockImplementationOnce(async () => ({
      results: [{ id: "cfg-id", memory: "cfg content", createdAt: "2024-01-01T00:00:00Z", metadata: {} }],
    }))
    const entry = await adapter.write("cfg-agent", {
      agent: "cfg-agent",
      slug: "cfg-slug",
      content: "cfg content",
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    })
    expect(mockFromConfig).toHaveBeenCalledTimes(1)
    expect(entry.content).toBe("cfg content")
  })

  it("uses Memory.fromConfig when embedProvider is set with dims and baseUrl", async () => {
    const adapter = new Mem0Adapter({
      url,
      embedProvider: "ollama",
      embedModel: "nomic-embed-text",
      embedDims: 768,
      embedBaseUrl: "http://localhost:11434",
    })
    expect(mockFromConfig).toHaveBeenCalledTimes(1)
    const status = await adapter.status()
    expect(typeof status.ok).toBe("boolean")
  })

  it("uses Memory.fromConfig when vectorStore is set with all fields", async () => {
    const adapter = new Mem0Adapter({
      url,
      vectorStore: "qdrant",
      vectorStoreHost: "localhost",
      vectorStorePort: 6333,
      vectorStoreCollection: "mem0-test",
      embedDims: 384,
    })
    expect(mockFromConfig).toHaveBeenCalledTimes(1)
    const status = await adapter.status()
    expect(typeof status.ok).toBe("boolean")
  })

  it("uses new Memory() when no llm/embed/vectorStore config is set", async () => {
    new Mem0Adapter({ url })
    expect(mockFromConfig).toHaveBeenCalledTimes(0)
  })
})
