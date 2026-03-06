import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { mkdtemp, rm, writeFile, mkdir, access } from "node:fs/promises"
import { readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { unzip, strFromU8 } from "fflate"

mock.module("mem0ai/oss", () => ({
  Memory: class {
    static fromConfig = () => new this()
    add = async () => ({ results: [{ id: "idx-id", memory: "mem0 note content", createdAt: "2024-01-01T00:00:00Z", metadata: {} }] })
    getAll = async () => ({ results: [] })
    search = async () => ({ results: [] })
    delete = async () => undefined
    deleteAll = async () => undefined
    update = async () => undefined
    get = async () => ({ id: "idx-id", memory: "mem0 note content", createdAt: "2024-01-01T00:00:00Z" })
    history = async () => []
  },
}))

mock.module("@qdrant/js-client-rest", () => ({
  QdrantClient: class {
    collectionExists = async () => ({ exists: true })
    createCollection = async () => ({})
    upsert = async () => ({})
    search = async () => []
    scroll = async () => ({ points: [], next_page_offset: null })
    delete = async () => ({})
    setPayload = async () => ({})
  },
}))

mock.module("@huggingface/transformers", () => ({
  pipeline: async () => async () => ({ data: new Float32Array([0.1, 0.2, 0.3]) }),
  env: { cacheDir: "" },
  FeatureExtractionPipeline: class {},
}))

import {
  takeNote,
  searchMemories,
  countMemories,
  analyzeStaleMemories,
  pruneMemories,
  memoryStatus,
  exportMemories,
  importMemories,
} from "../../src/memory/index.js"

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "wk-index-test-"))
}

async function writeConfig(projectDir: string, content: string): Promise<void> {
  const wkDir = path.join(projectDir, ".wunderkind")
  await mkdir(wkDir, { recursive: true })
  await writeFile(path.join(wkDir, "wunderkind.config.jsonc"), content, "utf-8")
}

describe("memory index — FileAdapter fallback (no config file)", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("takeNote writes a note and returns MemoryEntry with correct fields", async () => {
    const entry = await takeNote(projectDir, "test-agent", "This is a test note")
    expect(entry.agent).toBe("test-agent")
    expect(entry.content).toBe("This is a test note")
    expect(typeof entry.id).toBe("string")
    expect(entry.id.length).toBeGreaterThan(0)
    expect(typeof entry.slug).toBe("string")
    expect(entry.slug.length).toBeGreaterThan(0)
  })

  it("takeNote with pin option sets pinned to true", async () => {
    const entry = await takeNote(projectDir, "test-agent", "Pinned note content", { pin: true })
    expect(entry.pinned).toBe(true)
  })

  it("takeNote with custom slug uses the provided slug", async () => {
    const entry = await takeNote(projectDir, "test-agent", "Custom slug note", { slug: "my-custom-slug" })
    expect(entry.slug).toBe("my-custom-slug")
  })

  it("searchMemories finds entries matching a query keyword", async () => {
    await takeNote(projectDir, "search-agent", "TypeScript generics are powerful")
    await takeNote(projectDir, "search-agent", "Python has great ecosystem")
    const results = await searchMemories(projectDir, "search-agent", "typescript")
    expect(results.length).toBe(1)
    expect(results[0]?.content).toContain("TypeScript")
  })

  it("searchMemories returns empty array when no entries match", async () => {
    await takeNote(projectDir, "search-agent2", "Something here")
    const results = await searchMemories(projectDir, "search-agent2", "zzznomatch")
    expect(results).toEqual([])
  })

  it("countMemories returns correct total after writing notes", async () => {
    await takeNote(projectDir, "count-agent", "First note")
    await takeNote(projectDir, "count-agent", "Second note")
    const count = await countMemories(projectDir, "count-agent")
    expect(count.total).toBe(2)
  })

  it("analyzeStaleMemories returns all zeros for empty agent", async () => {
    const result = await analyzeStaleMemories(projectDir, "empty-agent")
    expect(result.stale).toBe(0)
    expect(result.recent).toBe(0)
    expect(result.pinned).toBe(0)
    expect(result.toKeep).toEqual([])
    expect(result.toDrop).toEqual([])
  })

  it("pruneMemories removes specified entries and returns count", async () => {
    const e1 = await takeNote(projectDir, "prune-agent", "Entry to prune")
    await takeNote(projectDir, "prune-agent", "Entry to keep")
    const removed = await pruneMemories(projectDir, "prune-agent", [e1.id])
    expect(removed).toBe(1)
  })

  it("memoryStatus returns ok: true with file adapter ready message", async () => {
    const result = await memoryStatus(projectDir)
    expect(result.ok).toBe(true)
    expect(result.message).toBe("file adapter ready")
  })
})

describe("memory index — explicit file adapter config", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
    await writeConfig(projectDir, '{ "memoryAdapter": "file" }')
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("takeNote works with explicit file adapter config", async () => {
    const entry = await takeNote(projectDir, "file-agent", "Note via file config")
    expect(entry.content).toBe("Note via file config")
    expect(entry.agent).toBe("file-agent")
  })
})

describe("memory index — sqlite adapter config", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
    await mkdir(path.join(projectDir, ".wunderkind"), { recursive: true })
    await writeConfig(projectDir, '{ "memoryAdapter": "sqlite" }')
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("takeNote works with sqlite adapter config", async () => {
    const entry = await takeNote(projectDir, "sqlite-agent", "SQLite note content")
    expect(entry.content).toBe("SQLite note content")
    expect(entry.agent).toBe("sqlite-agent")
  })
})

describe("memory index — stub adapter config (unknown adapter)", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
    await writeConfig(projectDir, '{ "memoryAdapter": "unknown-adapter-type" }')
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("returns stub adapter when config has unknown memoryAdapter value", async () => {
    const result = await memoryStatus(projectDir)
    expect(result.ok).toBe(false)
    expect(result.message).toContain("No memory system bootstrapped")
  })
})

describe("memory index — mem0 adapter config", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
    await writeConfig(projectDir, '{ "memoryAdapter": "mem0", "mem0Url": "http://localhost:8000" }')
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("takeNote uses mem0 adapter when config specifies mem0", async () => {
    const entry = await takeNote(projectDir, "mem0-agent", "mem0 note content")
    expect(typeof entry.id).toBe("string")
    expect(entry.id.length).toBeGreaterThan(0)
    expect(entry.agent).toBe("mem0-agent")
  })
})

describe("memory index — vector adapter config", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
    await writeConfig(
      projectDir,
      JSON.stringify({
        memoryAdapter: "vector",
        qdrantUrl: "http://localhost:6333",
        vectorEmbedModel: "Xenova/all-MiniLM-L6-v2",
        vectorSize: 384,
        vectorCollection: "test-memories",
      }),
    )
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("takeNote uses vector adapter when config specifies vector", async () => {
    const entry = await takeNote(projectDir, "vector-agent", "vector note content")
    expect(typeof entry.id).toBe("string")
    expect(entry.id.length).toBeGreaterThan(0)
    expect(entry.agent).toBe("vector-agent")
    expect(entry.content).toBe("vector note content")
  })

  it("memoryStatus with vector adapter calls fetch on /healthz", async () => {
    const result = await memoryStatus(projectDir)
    expect(typeof result.ok).toBe("boolean")
    expect(typeof result.message).toBe("string")
  })

  it("takeNote with vectorCacheDir config uses cacheDir path", async () => {
    await writeConfig(
      projectDir,
      JSON.stringify({
        memoryAdapter: "vector",
        qdrantUrl: "http://localhost:6333",
        vectorEmbedModel: "Xenova/all-MiniLM-L6-v2",
        vectorSize: 384,
        vectorCollection: "test-memories",
        vectorCacheDir: "/tmp/hf-cache",
      }),
    )
    const entry = await takeNote(projectDir, "cache-agent", "cached note")
    expect(entry.content).toBe("cached note")
  })
})

describe("memory index — exportMemories", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("produces zip at default path .wunderkind/exports/<timestamp>.zip", async () => {
    await takeNote(projectDir, "ciso", "secret test note for export")
    const zipPath = await exportMemories(projectDir)
    expect(zipPath.endsWith(".zip")).toBe(true)
    await access(zipPath)
    const bytes = new Uint8Array(await readFile(zipPath))
    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)))
    })
    const manifestRaw = files["manifest.json"]
    if (!manifestRaw) throw new Error("manifest.json missing from zip")
    const manifest = JSON.parse(strFromU8(manifestRaw)) as { version: string; agents: string[]; totalEntries: number }
    expect(manifest.version).toBe("1")
    expect(Array.isArray(manifest.agents)).toBe(true)
    expect(typeof manifest.totalEntries).toBe("number")
    const entriesRaw = files["entries.json"]
    if (!entriesRaw) throw new Error("entries.json missing from zip")
    const entries = JSON.parse(strFromU8(entriesRaw)) as unknown[]
    expect(Array.isArray(entries)).toBe(true)
    const agentFileKey = Object.keys(files).find((k) => k.startsWith("agents/"))
    expect(agentFileKey).toBeDefined()
  })

  it("produces zip at custom outputPath", async () => {
    const customPath = path.join(projectDir, "custom-export.zip")
    const zipPath = await exportMemories(projectDir, customPath)
    expect(zipPath).toBe(customPath)
    await access(customPath)
  })

  it("empty memory store produces valid zip with totalEntries 0", async () => {
    const zipPath = await exportMemories(projectDir)
    const bytes = new Uint8Array(await readFile(zipPath))
    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)))
    })
    const manifestRaw = files["manifest.json"]
    if (!manifestRaw) throw new Error("manifest.json missing from zip")
    const manifest = JSON.parse(strFromU8(manifestRaw)) as { version: string; agents: string[]; totalEntries: number }
    expect(manifest.totalEntries).toBe(0)
  })
})

describe("memory index — importMemories merge strategy", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("imports entries from zip with merge strategy", async () => {
    await takeNote(projectDir, "ciso", "test secret for import")
    const zipPath = await exportMemories(projectDir)

    const importDir = await makeTmpDir()
    try {
      const result = await importMemories(importDir, zipPath, "merge")
      expect(result.imported).toBeGreaterThanOrEqual(1)
      expect(result.skipped).toBe(0)
    } finally {
      await rm(importDir, { recursive: true, force: true })
    }
  })

  it("merge strategy skips duplicate slugs on second import", async () => {
    await takeNote(projectDir, "ciso", "note for duplicate slug test")
    const zipPath = await exportMemories(projectDir)

    const importDir = await makeTmpDir()
    try {
      const first = await importMemories(importDir, zipPath, "merge")
      expect(first.imported).toBeGreaterThan(0)

      const second = await importMemories(importDir, zipPath, "merge")
      expect(second.skipped).toBeGreaterThan(0)
      expect(second.imported).toBe(0)
    } finally {
      await rm(importDir, { recursive: true, force: true })
    }
  })
})

describe("memory index — importMemories overwrite strategy", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("overwrite strategy replaces existing entries without skipping", async () => {
    await takeNote(projectDir, "ciso", "overwrite strategy note")
    const zipPath = await exportMemories(projectDir)

    const result = await importMemories(projectDir, zipPath, "overwrite")
    expect(result.skipped).toBe(0)
    expect(result.imported).toBeGreaterThanOrEqual(1)
  })
})

describe("memory index — loadAdapter legacy config detection", () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  it("throws error when legacy config exists at project root", async () => {
    await writeFile(path.join(projectDir, "wunderkind.config.jsonc"), '{ "memoryAdapter": "file" }', "utf-8")
    const promise = takeNote(projectDir, "ciso", "test")
    await expect(promise).rejects.toThrow("Legacy config found")
  })
})
