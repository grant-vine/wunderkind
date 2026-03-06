import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test"

const mockCollectionExists = mock(async () => ({ exists: true }))
const mockCreateCollection = mock(async () => ({}))
const mockUpsert = mock(async () => ({}))
const mockSearch = mock(async () => [])
const mockScrollRaw = mock(async () => ({ points: [], next_page_offset: null }))
const mockRetrieve = mock(async () => [])
const mockDelete = mock(async () => ({}))
const mockSetPayload = mock(async () => ({}))

mock.module("@qdrant/js-client-rest", () => ({
  QdrantClient: class {
    collectionExists = mockCollectionExists
    createCollection = mockCreateCollection
    upsert = mockUpsert
    search = mockSearch
    scroll = mockScrollRaw
    retrieve = mockRetrieve
    delete = mockDelete
    setPayload = mockSetPayload
  },
}))

const mockExtractorFn = mock(async () => ({ data: new Float32Array([0.1, 0.2, 0.3]) }))
const mockPipeline = mock(async () => mockExtractorFn)

mock.module("@huggingface/transformers", () => ({
  pipeline: mockPipeline,
  env: { cacheDir: "" },
  FeatureExtractionPipeline: class {},
}))

import { VectorAdapter } from "../../src/memory/adapters/vector.js"

const DEFAULT_CONFIG = {
  qdrantUrl: "http://localhost:6333",
  model: "Xenova/all-MiniLM-L6-v2",
  vectorSize: 384,
  collectionName: "test-memories",
  projectSlug: "test-project",
}

function makeEntry(overrides: Partial<{
  agent: string
  slug: string
  content: string
  createdAt: number
  pinned: boolean
  metadata: Record<string, string>
}> = {}) {
  return {
    agent: "test-agent",
    slug: "test-slug",
    content: "test content",
    createdAt: 1000000,
    pinned: false,
    metadata: {},
    ...overrides,
  }
}

function makePayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    agent_id: "test-agent",
    group_id: "test-project",
    raw_text: "test content",
    slug: "test-slug",
    created_at: 1000000,
    last_accessed: 1000000,
    importance: 0.5,
    access_count: 0,
    pinned: false,
    metadata: {},
    history: [{ action: "ADD", value: "test content", timestamp: 1000000 }],
    ...overrides,
  }
}

describe("VectorAdapter — collection bootstrap", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockCreateCollection.mockClear()
    mockScrollRaw.mockClear()
    mockSearch.mockClear()
    mockUpsert.mockClear()
    mockRetrieve.mockClear()
    mockDelete.mockClear()
    mockSetPayload.mockClear()
  })

  it("creates collection when it does not exist", async () => {
    mockCollectionExists.mockImplementationOnce(async () => ({ exists: false }))
    mockScrollRaw.mockImplementationOnce(async () => ({ points: [], next_page_offset: null }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    await adapter.read("agent-x")
    expect(mockCreateCollection).toHaveBeenCalledTimes(1)
  })

  it("does not create collection when it already exists", async () => {
    mockScrollRaw.mockImplementationOnce(async () => ({ points: [], next_page_offset: null }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    await adapter.read("agent-x")
    expect(mockCreateCollection).toHaveBeenCalledTimes(0)
  })
})

describe("VectorAdapter — read", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockScrollRaw.mockClear()
    mockPipeline.mockClear()
    mockExtractorFn.mockClear()
  })

  it("returns empty array when no points in collection", async () => {
    mockScrollRaw.mockImplementationOnce(async () => ({ points: [], next_page_offset: null }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.read("test-agent")
    expect(result).toEqual([])
  })

  it("returns mapped entries sorted by createdAt descending", async () => {
    const payload1 = makePayload({ created_at: 1000, raw_text: "older" })
    const payload2 = makePayload({ created_at: 2000, raw_text: "newer" })
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [
        { id: "id-1", payload: payload1 },
        { id: "id-2", payload: payload2 },
      ],
      next_page_offset: null,
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.read("test-agent")
    expect(result.length).toBe(2)
    expect(result[0]?.content).toBe("newer")
    expect(result[1]?.content).toBe("older")
  })

  it("skips points with invalid payload (missing agent_id)", async () => {
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [
        { id: "bad-id", payload: { notAnAgentId: "oops" } },
        { id: "good-id", payload: makePayload() },
      ],
      next_page_offset: null,
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.read("test-agent")
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe("good-id")
  })

  it("handles pagination by following next_page_offset", async () => {
    const payload1 = makePayload({ created_at: 1000, raw_text: "page1" })
    const payload2 = makePayload({ created_at: 2000, raw_text: "page2" })
    mockScrollRaw
      .mockImplementationOnce(async () => ({
        points: [{ id: "p1", payload: payload1 }],
        next_page_offset: 1,
      }))
      .mockImplementationOnce(async () => ({
        points: [{ id: "p2", payload: payload2 }],
        next_page_offset: null,
      }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.read("test-agent")
    expect(result.length).toBe(2)
    expect(mockScrollRaw).toHaveBeenCalledTimes(2)
  })

  it("stops pagination when next_page_offset is a non-string non-number value", async () => {
    const payload1 = makePayload({ raw_text: "only-page" })
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [{ id: "p1", payload: payload1 }],
      next_page_offset: { someObject: true },
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.read("test-agent")
    expect(result.length).toBe(1)
    expect(mockScrollRaw).toHaveBeenCalledTimes(1)
  })

  it("handles null and undefined payload on a point", async () => {
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [
        { id: "null-payload", payload: null },
        { id: "undef-payload", payload: undefined },
        { id: "good", payload: makePayload() },
      ],
      next_page_offset: null,
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.read("test-agent")
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe("good")
  })
})

describe("VectorAdapter — write", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockSearch.mockClear()
    mockScrollRaw.mockClear()
    mockUpsert.mockClear()
    mockExtractorFn.mockClear()
  })

  it("writes a new entry when no duplicates found", async () => {
    mockSearch.mockImplementationOnce(async () => [])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.write("test-agent", makeEntry())
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(result.content).toBe("test content")
    expect(result.agent).toBe("test-agent")
    expect(result.slug).toBe("test-slug")
  })

  it("generates slug from content when entry slug is empty", async () => {
    mockSearch.mockImplementationOnce(async () => [])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.write("test-agent", makeEntry({ slug: "" }))
    expect(result.slug.length).toBeGreaterThan(0)
    expect(result.slug).not.toBe("")
  })

  it("returns existing entry without upserting when duplicate detected by cosine threshold", async () => {
    const dupVector = Array.from({ length: 3 }, () => 0.577)
    mockSearch.mockImplementationOnce(async () => [
      { id: "dup-id", score: 0.95, vector: dupVector, payload: null },
    ])
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [{ id: "dup-id", payload: makePayload({ raw_text: "existing content" }) }],
      next_page_offset: null,
    }))
    mockExtractorFn.mockImplementationOnce(async () => ({
      data: new Float32Array(dupVector),
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.write("test-agent", makeEntry({ content: "existing content" }))
    expect(mockUpsert).toHaveBeenCalledTimes(0)
    expect(result.content).toBe("existing content")
  })

  it("writes new entry when dedup payload lookup returns no match", async () => {
    const dupVector = Array.from({ length: 3 }, () => 0.577)
    mockSearch.mockImplementationOnce(async () => [
      { id: "ghost-id", score: 0.95, vector: dupVector, payload: null },
    ])
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [],
      next_page_offset: null,
    }))
    mockExtractorFn.mockImplementationOnce(async () => ({
      data: new Float32Array(dupVector),
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.write("test-agent", makeEntry({ content: "some content" }))
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(result.content).toBe("some content")
  })

  it("writes new entry when dedup payload is invalid (asPayload returns undefined)", async () => {
    const dupVector = Array.from({ length: 3 }, () => 0.577)
    mockSearch.mockImplementationOnce(async () => [
      { id: "dup-id", score: 0.95, vector: dupVector, payload: null },
    ])
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [{ id: "dup-id", payload: { notAnAgentId: "bad" } }],
      next_page_offset: null,
    }))
    mockExtractorFn.mockImplementationOnce(async () => ({
      data: new Float32Array(dupVector),
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.write("test-agent", makeEntry())
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(result.content).toBe("test content")
  })

  it("writes new entry when top dup vector is not an array", async () => {
    mockSearch.mockImplementationOnce(async () => [
      { id: "dup-id", score: 0.95, vector: null, payload: null },
    ])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.write("test-agent", makeEntry())
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(result.content).toBe("test content")
  })

  it("uses cacheDir config when provided", async () => {
    mockSearch.mockImplementationOnce(async () => [])
    const adapter = new VectorAdapter({ ...DEFAULT_CONFIG, cacheDir: "/tmp/hf-cache" })
    const result = await adapter.write("test-agent", makeEntry())
    expect(result.content).toBe("test content")
  })
})

describe("VectorAdapter — update", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockScrollRaw.mockClear()
    mockRetrieve.mockClear()
    mockUpsert.mockClear()
    mockExtractorFn.mockClear()
  })

  it("updates entry preserving existing slug and history", async () => {
    const existing = makePayload({ slug: "original-slug", history: [{ action: "ADD", value: "old", timestamp: 1 }] })
    mockRetrieve.mockImplementationOnce(async () => [{ id: "upd-id", payload: existing }])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.update("upd-id", "updated content")
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(result.content).toBe("updated content")
    expect(result.slug).toBe("original-slug")
    expect(result.id).toBe("upd-id")
  })

  it("generates slug from content when no existing entry found", async () => {
    mockRetrieve.mockImplementationOnce(async () => [])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.update("new-id", "brand new content")
    expect(result.id).toBe("new-id")
    expect(result.content).toBe("brand new content")
    expect(result.slug.length).toBeGreaterThan(0)
  })

  it("generates slug and uses empty agentId when existing payload is invalid", async () => {
    mockRetrieve.mockImplementationOnce(async () => [{ id: "bad-id", payload: { notAnAgentId: true } }])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.update("bad-id", "some content")
    expect(result.id).toBe("bad-id")
    expect(result.agent).toBe("")
  })
})

describe("VectorAdapter — delete and deleteAll", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockDelete.mockClear()
  })

  it("delete calls qdrant delete with the point id", async () => {
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    await adapter.delete("del-id")
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it("deleteAll calls qdrant delete with agent_id filter", async () => {
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    await adapter.deleteAll("my-agent")
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })
})

describe("VectorAdapter — search", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockSearch.mockClear()
    mockSetPayload.mockClear()
    mockExtractorFn.mockClear()
  })

  it("returns empty array when qdrant search returns no results", async () => {
    mockSearch.mockImplementationOnce(async () => [])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const results = await adapter.search("test-agent", "any query")
    expect(results).toEqual([])
    expect(mockSetPayload).toHaveBeenCalledTimes(0)
  })

  it("returns mapped entries and updates last_accessed for top results", async () => {
    const payload = makePayload({ access_count: 3 })
    mockSearch.mockImplementationOnce(async () => [
      { id: "r1", score: 0.85, payload, vector: null },
    ])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const results = await adapter.search("test-agent", "query")
    expect(results.length).toBe(1)
    expect(results[0]?.content).toBe("test content")
    expect(mockSetPayload).toHaveBeenCalledTimes(1)
  })

  it("skips results with invalid payload in search", async () => {
    mockSearch.mockImplementationOnce(async () => [
      { id: "bad", score: 0.9, payload: { notAnAgentId: "x" }, vector: null },
      { id: "good", score: 0.8, payload: makePayload(), vector: null },
    ])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const results = await adapter.search("test-agent", "query")
    expect(results.length).toBe(1)
    expect(results[0]?.id).toBe("good")
  })

  it("limits to top 10 results and sorts by combined score", async () => {
    const points = Array.from({ length: 15 }, (_, i) => ({
      id: `r${i}`,
      score: 0.5 + i * 0.01,
      payload: makePayload({ importance: 0.5, last_accessed: Date.now() - i * 1000 }),
      vector: null,
    }))
    mockSearch.mockImplementationOnce(async () => points)
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const results = await adapter.search("test-agent", "query")
    expect(results.length).toBe(10)
    expect(mockSetPayload).toHaveBeenCalledTimes(10)
  })
})

describe("VectorAdapter — history", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockScrollRaw.mockClear()
    mockRetrieve.mockClear()
  })

  it("returns history entries for a known id", async () => {
    const payload = makePayload({
      history: [
        { action: "ADD", value: "original", timestamp: 1000 },
        { action: "UPDATE", value: "revised", timestamp: 2000 },
      ],
    })
    mockRetrieve.mockImplementationOnce(async () => [{ id: "hist-id", payload }])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const hist = await adapter.history("hist-id")
    expect(hist.length).toBe(2)
    expect(hist[0]?.action).toBe("ADD")
    expect(hist[0]?.value).toBe("original")
    expect(hist[1]?.action).toBe("UPDATE")
  })

  it("returns empty array when id is not found", async () => {
    mockRetrieve.mockImplementationOnce(async () => [])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const hist = await adapter.history("missing-id")
    expect(hist).toEqual([])
  })

  it("returns empty array when payload is invalid", async () => {
    mockRetrieve.mockImplementationOnce(async () => [{ id: "hist-id", payload: null }])
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const hist = await adapter.history("hist-id")
    expect(hist).toEqual([])
  })
})

describe("VectorAdapter — analyzeStale", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockScrollRaw.mockClear()
  })

  it("returns stale analysis based on read entries", async () => {
    const now = Date.now()
    const staleTs = now - 60 * 24 * 60 * 60 * 1000
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [
        { id: "stale", payload: makePayload({ created_at: staleTs, raw_text: "old" }) },
        { id: "fresh", payload: makePayload({ created_at: now - 1000, raw_text: "new" }) },
      ],
      next_page_offset: null,
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.analyzeStale("test-agent")
    expect(result.stale).toBe(1)
    expect(result.recent).toBe(1)
    expect(result.toDrop.length).toBe(1)
    expect(result.toKeep.length).toBe(1)
  })
})

describe("VectorAdapter — prune", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockDelete.mockClear()
  })

  it("returns 0 without calling delete when idsToRemove is empty", async () => {
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const removed = await adapter.prune("test-agent", [])
    expect(removed).toBe(0)
    expect(mockDelete).toHaveBeenCalledTimes(0)
  })

  it("calls delete and returns count of removed ids", async () => {
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const removed = await adapter.prune("test-agent", ["id1", "id2", "id3"])
    expect(removed).toBe(3)
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })
})

describe("VectorAdapter — count", () => {
  beforeEach(() => {
    mockCollectionExists.mockClear()
    mockScrollRaw.mockClear()
  })

  it("returns all zeros when no entries", async () => {
    mockScrollRaw.mockImplementationOnce(async () => ({ points: [], next_page_offset: null }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const count = await adapter.count("test-agent")
    expect(count.total).toBe(0)
    expect(count.pinned).toBe(0)
    expect(count.oldest).toBe(0)
    expect(count.newest).toBe(0)
  })

  it("returns correct totals for mixed entries", async () => {
    const now = Date.now()
    mockScrollRaw.mockImplementationOnce(async () => ({
      points: [
        { id: "a", payload: makePayload({ created_at: now - 5000, pinned: true }) },
        { id: "b", payload: makePayload({ created_at: now - 1000, pinned: false }) },
        { id: "c", payload: makePayload({ created_at: now - 3000, pinned: true }) },
      ],
      next_page_offset: null,
    }))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const count = await adapter.count("test-agent")
    expect(count.total).toBe(3)
    expect(count.pinned).toBe(2)
    expect(count.oldest).toBeLessThan(count.newest)
  })
})

describe("VectorAdapter — status", () => {
  it("returns ok: true when /healthz responds ok", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: true } as Response))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(true)
    expect(result.message).toBe("vector adapter ready")
  })

  it("returns ok: false with HTTP status when /healthz returns non-ok", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: false, status: 503 } as Response))
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("Qdrant returned HTTP 503")
  })

  it("returns ok: false with error message when fetch throws", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => {
      throw new Error("connection refused")
    })
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("connection refused")
  })

  it("returns ok: false with string coercion when fetch throws non-Error", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => {
      throw "plain string error"
    })
    const adapter = new VectorAdapter(DEFAULT_CONFIG)
    const result = await adapter.status()
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("plain string error")
  })
})
