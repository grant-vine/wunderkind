import { generateId, generateSlug } from "../format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "./types.js"

const STUB_MESSAGE =
  "No memory system bootstrapped. Set memoryAdapter in wunderkind.config.jsonc to 'file', 'sqlite', or 'mem0'."

export class StubAdapter implements MemoryAdapter {
  constructor() {}

  async read(_agent: string): Promise<MemoryEntry[]> {
    return []
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    return {
      id: generateId(),
      agent,
      slug: entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content),
      content: STUB_MESSAGE,
      createdAt: entry.createdAt,
      pinned: false,
      metadata: {},
    }
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    return {
      id,
      agent: "",
      slug: generateSlug(content),
      content: STUB_MESSAGE,
      createdAt: Date.now(),
      pinned: false,
      metadata: {},
    }
  }

  async delete(_id: string): Promise<void> {
    return
  }

  async deleteAll(_agent: string): Promise<void> {
    return
  }

  async search(_agent: string, _query: string): Promise<MemoryEntry[]> {
    return []
  }

  async history(_id: string): Promise<HistoryEntry[]> {
    return []
  }

  async analyzeStale(_agent: string): Promise<StaleAnalysis> {
    return { toKeep: [], toDrop: [], pinned: 0, recent: 0, stale: 0 }
  }

  async prune(_agent: string, _idsToRemove: string[]): Promise<number> {
    return 0
  }

  async count(_agent: string): Promise<MemoryCount> {
    return { total: 0, pinned: 0, oldest: 0, newest: 0 }
  }

  async listAgents(): Promise<string[]> {
    return []
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: STUB_MESSAGE }
  }
}
