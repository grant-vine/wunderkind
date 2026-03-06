export interface MemoryEntry {
  id: string
  agent: string
  slug: string
  content: string
  createdAt: number
  pinned: boolean
  metadata: Record<string, string>
}

export interface HistoryEntry {
  action: string
  value: string
  timestamp: number
}

export interface StaleAnalysis {
  toKeep: MemoryEntry[]
  toDrop: MemoryEntry[]
  pinned: number
  recent: number
  stale: number
}

export interface MemoryCount {
  total: number
  pinned: number
  oldest: number
  newest: number
}

export interface MemoryAdapter {
  read(agent: string): Promise<MemoryEntry[]>
  write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry>
  update(id: string, content: string): Promise<MemoryEntry>
  delete(id: string): Promise<void>
  deleteAll(agent: string): Promise<void>
  search(agent: string, query: string): Promise<MemoryEntry[]>
  history(id: string): Promise<HistoryEntry[]>
  analyzeStale(agent: string): Promise<StaleAnalysis>
  prune(agent: string, idsToRemove: string[]): Promise<number>
  count(agent: string): Promise<MemoryCount>
  listAgents(): Promise<string[]>
  status(): Promise<{ ok: boolean; message: string }>
}
