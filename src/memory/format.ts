import type { MemoryEntry, StaleAnalysis } from "./adapters/types.js"

const DEFAULT_RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function generateSlug(content: string): string {
  const base = content
    .trim()
    .slice(0, 80)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  return base.slice(0, 40)
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function analyzeStale(
  entries: MemoryEntry[],
  recentWindowMs: number = DEFAULT_RECENT_WINDOW_MS,
): StaleAnalysis {
  const now = Date.now()
  const toKeep: MemoryEntry[] = []
  const toDrop: MemoryEntry[] = []
  let pinned = 0
  let recent = 0

  for (const entry of entries) {
    if (entry.pinned) {
      toKeep.push(entry)
      pinned += 1
      continue
    }
    if (now - entry.createdAt <= recentWindowMs) {
      toKeep.push(entry)
      recent += 1
      continue
    }
    toDrop.push(entry)
  }

  return {
    toKeep,
    toDrop,
    pinned,
    recent,
    stale: toDrop.length,
  }
}
