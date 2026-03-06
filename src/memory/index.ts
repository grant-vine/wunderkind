import path from "node:path"
import { homedir } from "node:os"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { parse } from "jsonc-parser"
import { zip as fflateZip, unzip as fflateUnzip, strToU8, strFromU8 } from "fflate"
import { FileAdapter } from "./adapters/file.js"
import { Mem0Adapter } from "./adapters/mem0.js"
import { SqliteAdapter } from "./adapters/sqlite.js"
import { StubAdapter } from "./adapters/stub.js"
import { VectorAdapter } from "./adapters/vector.js"
import type { MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "./adapters/types.js"
import { generateSlug } from "./format.js"
import { deriveProjectSlug } from "./slug.js"

interface WunderkindConfig {
  memoryAdapter?: string
  mem0Url?: string
  mem0ProjectSlug?: string
  mem0LlmProvider?: string
  mem0LlmModel?: string
  mem0LlmBaseUrl?: string
  mem0EmbedProvider?: string
  mem0EmbedModel?: string
  mem0EmbedDims?: number
  mem0EmbedBaseUrl?: string
  mem0VectorStore?: string
  mem0VectorStoreHost?: string
  mem0VectorStorePort?: number
  mem0VectorStoreCollection?: string
  qdrantUrl?: string
  vectorEmbedModel?: string
  vectorSize?: number
  vectorCollection?: string
  vectorCacheDir?: string
}

async function loadAdapter(projectDir: string): Promise<MemoryAdapter> {
  const legacyConfigPath = path.join(projectDir, "wunderkind.config.jsonc")
  const projectConfigPath = path.join(projectDir, ".wunderkind", "wunderkind.config.jsonc")
  const globalConfigPath = path.join(homedir(), ".wunderkind", "wunderkind.config.jsonc")

  if (existsSync(legacyConfigPath)) {
    throw new Error("Legacy config found at project root. Move it to .wunderkind/wunderkind.config.jsonc")
  }

  let config: WunderkindConfig = {}
  try { config = { ...config, ...(parse(await readFile(globalConfigPath, "utf-8")) as WunderkindConfig) } } catch { /* no global config */ }
  try { config = { ...config, ...(parse(await readFile(projectConfigPath, "utf-8")) as WunderkindConfig) } } catch { /* no project config */ }

  const projectSlug = deriveProjectSlug(projectDir)
  const adapter = config.memoryAdapter ?? "file"

  if (adapter === "file") return new FileAdapter(projectDir)
  if (adapter === "sqlite") {
    return new SqliteAdapter(path.join(projectDir, ".wunderkind", "memory.db"))
  }
  if (adapter === "mem0") {
    return new Mem0Adapter({
      url: config.mem0Url ?? "http://localhost:8000",
      projectSlug,
      ...(config.mem0LlmProvider ? { llmProvider: config.mem0LlmProvider } : {}),
      ...(config.mem0LlmModel ? { llmModel: config.mem0LlmModel } : {}),
      ...(config.mem0LlmBaseUrl ? { llmBaseUrl: config.mem0LlmBaseUrl } : {}),
      ...(config.mem0EmbedProvider ? { embedProvider: config.mem0EmbedProvider } : {}),
      ...(config.mem0EmbedModel ? { embedModel: config.mem0EmbedModel } : {}),
      ...(config.mem0EmbedDims ? { embedDims: config.mem0EmbedDims } : {}),
      ...(config.mem0EmbedBaseUrl ? { embedBaseUrl: config.mem0EmbedBaseUrl } : {}),
      ...(config.mem0VectorStore ? { vectorStore: config.mem0VectorStore } : {}),
      ...(config.mem0VectorStoreHost ? { vectorStoreHost: config.mem0VectorStoreHost } : {}),
      ...(config.mem0VectorStorePort ? { vectorStorePort: config.mem0VectorStorePort } : {}),
      ...(config.mem0VectorStoreCollection ? { vectorStoreCollection: config.mem0VectorStoreCollection } : {}),
    })
  }
  if (adapter === "vector") {
    return new VectorAdapter({
      qdrantUrl: config.qdrantUrl ?? "http://localhost:6333",
      model: config.vectorEmbedModel ?? "Xenova/all-MiniLM-L6-v2",
      vectorSize: config.vectorSize ?? 384,
      collectionName: config.vectorCollection ?? "wunderkind-memories",
      projectSlug,
      ...(config.vectorCacheDir ? { cacheDir: config.vectorCacheDir } : {}),
    })
  }
  return new StubAdapter()
}

export async function takeNote(
  projectDir: string,
  agent: string,
  note: string,
  options?: { slug?: string; pin?: boolean },
): Promise<MemoryEntry> {
  const adapter = await loadAdapter(projectDir)
  const entry: Omit<MemoryEntry, "id"> = {
    agent,
    slug: options?.slug ?? generateSlug(note),
    content: note,
    createdAt: Date.now(),
    pinned: options?.pin ?? false,
    metadata: {},
  }
  return adapter.write(agent, entry)
}

export async function searchMemories(
  projectDir: string,
  agent: string,
  query: string,
): Promise<MemoryEntry[]> {
  const adapter = await loadAdapter(projectDir)
  return adapter.search(agent, query)
}

export async function countMemories(
  projectDir: string,
  agent: string,
): Promise<MemoryCount> {
  const adapter = await loadAdapter(projectDir)
  return adapter.count(agent)
}

export async function analyzeStaleMemories(
  projectDir: string,
  agent: string,
): Promise<StaleAnalysis> {
  const adapter = await loadAdapter(projectDir)
  return adapter.analyzeStale(agent)
}

export async function pruneMemories(
  projectDir: string,
  agent: string,
  idsToRemove: string[],
): Promise<number> {
  const adapter = await loadAdapter(projectDir)
  return adapter.prune(agent, idsToRemove)
}

export async function memoryStatus(
  projectDir: string,
): Promise<{ ok: boolean; message: string }> {
  const adapter = await loadAdapter(projectDir)
  return adapter.status()
}

export async function exportMemories(projectDir: string, outputPath?: string): Promise<string> {
  const adapter = await loadAdapter(projectDir)
  const agents = await adapter.listAgents()

  const allEntries: MemoryEntry[] = []
  const fileMap: Record<string, Uint8Array> = {}

  for (const agent of agents) {
    const entries = await adapter.read(agent)
    allEntries.push(...entries)
    const agentContent = entries
      .map((entry) => `## [${entry.slug}]\n\nid: ${entry.id}\n\n${entry.content}\n\n---\n`)
      .join("\n")
    fileMap[`agents/${agent}.md`] = strToU8(agentContent)
  }

  const projectSlug = deriveProjectSlug(projectDir)
  const manifest = {
    version: "1",
    exportedAt: Date.now(),
    projectSlug,
    adapter: "file",
    agents,
    totalEntries: allEntries.length,
  }

  fileMap["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2))
  fileMap["entries.json"] = strToU8(JSON.stringify(allEntries))

  const zipBytes = await new Promise<Uint8Array>((resolve, reject) => {
    fflateZip(fileMap, { level: 6 }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

  const finalPath = outputPath ?? path.join(projectDir, ".wunderkind", "exports", `${Date.now()}.zip`)
  await mkdir(path.dirname(finalPath), { recursive: true })
  await writeFile(finalPath, zipBytes)
  return finalPath
}

export async function importMemories(
  projectDir: string,
  zipPath: string,
  strategy: "merge" | "overwrite",
): Promise<{ imported: number; skipped: number }> {
  const zipBytes = new Uint8Array(await readFile(zipPath))

  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    fflateUnzip(zipBytes, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

  const entriesRaw = files["entries.json"]
  if (!entriesRaw) throw new Error("Invalid zip: missing entries.json")
  const allEntries = JSON.parse(strFromU8(entriesRaw)) as MemoryEntry[]

  const adapter = await loadAdapter(projectDir)

  let imported = 0
  let skipped = 0

  const uniqueAgents = Array.from(new Set(allEntries.map((e) => e.agent)))

  if (strategy === "overwrite") {
    for (const agent of uniqueAgents) {
      await adapter.deleteAll(agent)
    }
    for (const entry of allEntries) {
      const { id: _id, ...rest } = entry
      await adapter.write(entry.agent, rest)
      imported += 1
    }
  } else {
    const existingSlugs = new Map<string, Set<string>>()
    for (const agent of uniqueAgents) {
      const existing = await adapter.read(agent)
      existingSlugs.set(agent, new Set(existing.map((e) => e.slug)))
    }
    for (const entry of allEntries) {
      const agentSlugs = existingSlugs.get(entry.agent)
      if (agentSlugs?.has(entry.slug)) {
        skipped += 1
      } else {
        const { id: _id, ...rest } = entry
        await adapter.write(entry.agent, rest)
        imported += 1
      }
    }
  }

  return { imported, skipped }
}
