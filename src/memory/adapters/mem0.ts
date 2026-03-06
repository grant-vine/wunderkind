import { Memory } from "mem0ai/oss"
import { analyzeStale, generateId, generateSlug } from "../format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "./types.js"

export interface Mem0AdapterConfig {
  url: string
  projectSlug: string
  llmProvider?: string
  llmModel?: string
  llmBaseUrl?: string
  embedProvider?: string
  embedModel?: string
  embedDims?: number
  embedBaseUrl?: string
  vectorStore?: string
  vectorStoreHost?: string
  vectorStorePort?: number
  vectorStoreCollection?: string
  graphEnabled?: boolean
}

interface Mem0Item {
  id?: string
  memory?: string
  createdAt?: string | number
  metadata?: Record<string, string>
}

interface Mem0HistoryItem {
  event?: string
  new_memory?: string
  created_at?: string
}

type Mem0Config = {
  llm?: {
    provider: string
    config: {
      model: string
      temperature?: number
      max_tokens?: number
      ollama_base_url?: string
    }
  }
  embedder?: {
    provider: string
    config: {
      model: string
      embedding_dims?: number
      ollama_base_url?: string
    }
  }
  vector_store?: {
    provider: string
    config: {
      collection_name?: string
      host?: string
      port?: number
      embedding_model_dims?: number
    }
  }
  graph_store?: {
    provider: string
    config: Record<string, string>
  }
}

function buildMem0Config(cfg: Mem0AdapterConfig): Mem0Config {
  const result: Mem0Config = {}

  if (cfg.llmProvider) {
    const llmConfig: Mem0Config["llm"] = {
      provider: cfg.llmProvider,
      config: { model: cfg.llmModel ?? "llama3.1" },
    }
    if (cfg.llmBaseUrl) {
      llmConfig.config.ollama_base_url = cfg.llmBaseUrl
    }
    result.llm = llmConfig
  }

  if (cfg.embedProvider) {
    const embedConfig: Mem0Config["embedder"] = {
      provider: cfg.embedProvider,
      config: { model: cfg.embedModel ?? "nomic-embed-text" },
    }
    if (cfg.embedDims) {
      embedConfig.config.embedding_dims = cfg.embedDims
    }
    if (cfg.embedBaseUrl) {
      embedConfig.config.ollama_base_url = cfg.embedBaseUrl
    }
    result.embedder = embedConfig
  }

  if (cfg.vectorStore && cfg.vectorStore !== "memory") {
    const vsConfig: Mem0Config["vector_store"] = {
      provider: cfg.vectorStore,
      config: {},
    }
    if (cfg.vectorStoreCollection) {
      vsConfig.config.collection_name = cfg.vectorStoreCollection
    }
    if (cfg.vectorStoreHost) {
      vsConfig.config.host = cfg.vectorStoreHost
    }
    if (cfg.vectorStorePort) {
      vsConfig.config.port = cfg.vectorStorePort
    }
    if (cfg.embedDims) {
      vsConfig.config.embedding_model_dims = cfg.embedDims
    }
    result.vector_store = vsConfig
  }

  return result
}

export class Mem0Adapter implements MemoryAdapter {
  #memory: Memory
  #url: string
  #projectSlug: string
  #knownAgents: Set<string>

  constructor(config: Mem0AdapterConfig) {
    this.#url = config.url
    this.#projectSlug = config.projectSlug
    this.#knownAgents = new Set()
    const mem0Config = buildMem0Config(config)
    const hasConfig = Object.keys(mem0Config).length > 0
    this.#memory = hasConfig ? Memory.fromConfig(mem0Config) : new Memory()
  }

  #scopedAgent(agent: string): string {
    return `${this.#projectSlug}:${agent}`
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    this.#knownAgents.add(agent)
    const result = await this.#memory.add(
      [{ role: "user", content: entry.content }],
      { agentId: this.#scopedAgent(agent), infer: false, metadata: entry.metadata },
    )
    const item = result.results[0] as Mem0Item | undefined
    if (!item) {
      return {
        id: generateId(),
        agent,
        slug: entry.slug,
        content: entry.content,
        createdAt: entry.createdAt,
        pinned: entry.pinned,
        metadata: entry.metadata,
      }
    }
    return this.#mapItem(item, agent)
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    this.#knownAgents.add(agent)
    const result = await this.#memory.getAll({ agentId: this.#scopedAgent(agent) })
    return result.results.map((item) => this.#mapItem(item as Mem0Item, agent))
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    await this.#memory.update(id, content)
    const item = await this.#memory.get(id)
    const entry = this.#mapItem(item as Mem0Item, "")
    return { ...entry, id }
  }

  async delete(id: string): Promise<void> {
    await this.#memory.delete(id)
  }

  async deleteAll(agent: string): Promise<void> {
    await this.#memory.deleteAll({ agentId: this.#scopedAgent(agent) })
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const result = await this.#memory.search(query, { agentId: this.#scopedAgent(agent) })
    return result.results.map((item) => this.#mapItem(item as Mem0Item, agent))
  }

  async history(id: string): Promise<HistoryEntry[]> {
    const result = await this.#memory.history(id)
    return result.map((item: Mem0HistoryItem) => ({
      action: item.event ?? "",
      value: item.new_memory ?? "",
      timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
    }))
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    const entries = await this.read(agent)
    return analyzeStale(entries)
  }

  async prune(_agent: string, idsToRemove: string[]): Promise<number> {
    let removed = 0
    for (const id of idsToRemove) {
      await this.#memory.delete(id)
      removed += 1
    }
    return removed
  }

  async count(agent: string): Promise<MemoryCount> {
    const entries = await this.read(agent)
    if (entries.length === 0) {
      return { total: 0, pinned: 0, oldest: 0, newest: 0 }
    }
    let pinned = 0
    let oldest = entries[0]?.createdAt ?? 0
    let newest = entries[0]?.createdAt ?? 0
    for (const entry of entries) {
      if (entry.pinned) pinned += 1
      if (entry.createdAt < oldest) oldest = entry.createdAt
      if (entry.createdAt > newest) newest = entry.createdAt
    }
    return { total: entries.length, pinned, oldest, newest }
  }

  async listAgents(): Promise<string[]> {
    return Array.from(this.#knownAgents).sort()
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`${this.#url}/health`)
      if (res.ok) return { ok: true, message: "mem0 adapter ready" }
      return { ok: false, message: `mem0 returned HTTP ${res.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message }
    }
  }

  #mapItem(item: Mem0Item, agent: string): MemoryEntry {
    const id = item.id ?? generateId()
    const content = item.memory ?? ""
    const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : Date.now()
    return {
      id,
      agent,
      slug: generateSlug(content),
      content,
      createdAt,
      pinned: false,
      metadata: item.metadata ?? {},
    }
  }
}
