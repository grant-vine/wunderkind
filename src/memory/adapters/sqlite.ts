import { mkdir } from "node:fs/promises"
import path from "node:path"
import { Database } from "bun:sqlite"
import { analyzeStale, generateId, generateSlug } from "../format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "./types.js"

interface MemoryRow {
  id: string
  agent_id: string
  slug: string
  content: string
  tags: string
  created_at: number
  updated_at: number
  pinned: number
  metadata: string
}

interface HistoryRow {
  action: string
  value: string
  timestamp: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id, created_at DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  tags,
  content = 'memories',
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', old.rowid, old.content, old.tags);
  INSERT INTO memories_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
END;

CREATE TABLE IF NOT EXISTS memory_history (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  value TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_memory ON memory_history(memory_id, timestamp DESC);
`

export class SqliteAdapter implements MemoryAdapter {
  #db: Database

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath)
    void mkdir(dir, { recursive: true })
    this.#db = new Database(dbPath, { create: true })
    this.#db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
    this.#db.exec(SCHEMA)
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    const stmt = this.#db.prepare<MemoryRow, { $agent: string }>(
      "SELECT * FROM memories WHERE agent_id = $agent ORDER BY created_at DESC",
    )
    const rows = stmt.all({ $agent: agent }) as MemoryRow[]
    return rows.map((row: MemoryRow) => this.#mapRow(row))
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    const id = generateId()
    const now = entry.createdAt
    const slug = entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content)
    const metadata = JSON.stringify(entry.metadata)
    const stmt = this.#db.prepare(
      "INSERT INTO memories (id, agent_id, slug, content, tags, created_at, updated_at, pinned, metadata) VALUES ($id, $agent, $slug, $content, '', $created, $updated, $pinned, $metadata)",
    )
    stmt.run({
      $id: id,
      $agent: agent,
      $slug: slug,
      $content: entry.content,
      $created: now,
      $updated: now,
      $pinned: entry.pinned ? 1 : 0,
      $metadata: metadata,
    })
    this.#insertHistory(id, "ADD", entry.content)
    return {
      id,
      agent,
      slug,
      content: entry.content,
      createdAt: entry.createdAt,
      pinned: entry.pinned,
      metadata: entry.metadata,
    }
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    const now = Date.now()
    const stmt = this.#db.prepare(
      "UPDATE memories SET content = $content, updated_at = $updated WHERE id = $id",
    )
    stmt.run({ $id: id, $content: content, $updated: now })
    this.#insertHistory(id, "UPDATE", content)
    const entry = this.#getById(id)
    if (!entry) {
      throw new Error(`Memory entry not found: ${id}`)
    }
    return entry
  }

  async delete(id: string): Promise<void> {
    const stmt = this.#db.prepare("DELETE FROM memories WHERE id = $id")
    stmt.run({ $id: id })
    this.#insertHistory(id, "DELETE", id)
  }

  async deleteAll(agent: string): Promise<void> {
    const stmt = this.#db.prepare("DELETE FROM memories WHERE agent_id = $agent")
    stmt.run({ $agent: agent })
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const escaped = query.replace(/"/g, '""')
    const search = `"${escaped}"`
    const stmt = this.#db.prepare<MemoryRow, { $query: string; $agent: string }>(
      "SELECT m.* FROM memories_fts JOIN memories m ON memories_fts.rowid = m.rowid WHERE memories_fts MATCH $query AND m.agent_id = $agent ORDER BY bm25(memories_fts, 5.0, 1.0) LIMIT 10",
    )
    const rows = stmt.all({ $query: search, $agent: agent }) as MemoryRow[]
    return rows.map((row: MemoryRow) => this.#mapRow(row))
  }

  async history(id: string): Promise<HistoryEntry[]> {
    const stmt = this.#db.prepare<HistoryRow, { $id: string }>(
      "SELECT action, value, timestamp FROM memory_history WHERE memory_id = $id ORDER BY timestamp DESC",
    )
    const rows = stmt.all({ $id: id }) as HistoryRow[]
    return rows.map((row: HistoryRow) => ({
      action: row.action,
      value: row.value,
      timestamp: row.timestamp,
    }))
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    const entries = await this.read(agent)
    return analyzeStale(entries)
  }

  async prune(agent: string, idsToRemove: string[]): Promise<number> {
    if (idsToRemove.length === 0) return 0
    let removed = 0
    const stmt = this.#db.prepare("DELETE FROM memories WHERE id = $id AND agent_id = $agent")
    const transaction = this.#db.transaction((ids: string[]) => {
      for (const id of ids) {
        const result = stmt.run({ $id: id, $agent: agent })
        if (result.changes > 0) removed += 1
      }
    })
    transaction(idsToRemove)
    return removed
  }

  async count(agent: string): Promise<MemoryCount> {
    const stmt = this.#db.prepare<
      { total: number; pinned: number | null; oldest: number | null; newest: number | null },
      { $agent: string }
    >(
      "SELECT COUNT(*) as total, SUM(pinned) as pinned, MIN(created_at) as oldest, MAX(created_at) as newest FROM memories WHERE agent_id = $agent",
    )
    const row = stmt.get({ $agent: agent })
    if (!row || row.total === 0) {
      return { total: 0, pinned: 0, oldest: 0, newest: 0 }
    }
    return {
      total: row.total,
      pinned: row.pinned ?? 0,
      oldest: row.oldest ?? 0,
      newest: row.newest ?? 0,
    }
  }

  async listAgents(): Promise<string[]> {
    const stmt = this.#db.prepare<{ agent_id: string }, []>(
      "SELECT DISTINCT agent_id FROM memories ORDER BY agent_id ASC",
    )
    const rows = stmt.all() as Array<{ agent_id: string }>
    return rows.map((r) => r.agent_id)
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      this.#db.query("SELECT 1").get()
      return { ok: true, message: "sqlite adapter ready" }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message }
    }
  }

  #mapRow(row: MemoryRow): MemoryEntry {
    return {
      id: row.id,
      agent: row.agent_id,
      slug: row.slug,
      content: row.content,
      createdAt: row.created_at,
      pinned: row.pinned !== 0,
      metadata: JSON.parse(row.metadata) as Record<string, string>,
    }
  }

  #getById(id: string): MemoryEntry | null {
    const stmt = this.#db.prepare<MemoryRow, { $id: string }>("SELECT * FROM memories WHERE id = $id")
    const row = stmt.get({ $id: id })
    if (!row) return null
    return this.#mapRow(row)
  }

  #insertHistory(memoryId: string, action: string, value: string): void {
    const stmt = this.#db.prepare(
      "INSERT INTO memory_history (id, memory_id, action, value, timestamp) VALUES ($id, $memoryId, $action, $value, $timestamp)",
    )
    stmt.run({
      $id: generateId(),
      $memoryId: memoryId,
      $action: action,
      $value: value,
      $timestamp: Date.now(),
    })
  }
}
