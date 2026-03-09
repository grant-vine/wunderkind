import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { pipeline, env as hfEnv } from "@huggingface/transformers"
import { Pool, type PoolConfig, type QueryResultRow } from "pg"
import { analyzeStale, generateId, generateSlug } from "../../../../src/memory/format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "../../../../src/memory/adapters/types.js"

export interface PostgresPgvectorAdapterConfig {
  connectionString?: string
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  ssl?: PoolConfig["ssl"]
  model?: string
  vectorSize?: number
  cacheDir?: string
}

export interface PostgresMemoryEdge {
  fromId: string
  toId: string
  weight: number
}

interface MemoryRow extends QueryResultRow {
  id: string
  agent: string
  slug: string
  content: string
  created_at: Date | string
  pinned: boolean
  metadata: unknown
  tags: string
}

interface HistoryRow extends QueryResultRow {
  action: string
  value: string
  timestamp: Date | string
}

interface AgentRow extends QueryResultRow {
  agent: string
}

interface CountRow extends QueryResultRow {
  total: string | number
  pinned: string | number | null
  oldest: Date | string | null
  newest: Date | string | null
}

interface SearchScoreRow extends MemoryRow {
  semantic_score?: number | string | null
  graph_score?: number | string | null
  min_depth?: number | string | null
}

type EmbedderMode = "transformers" | "hash"

interface EmbeddingOutput {
  data: Float32Array | ArrayLike<number>
}

interface FeatureExtractor {
  (text: string, options: { pooling: "mean"; normalize: true }): Promise<EmbeddingOutput>
}

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2"
const DEFAULT_VECTOR_SIZE = 384

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_created_at
  ON memories(agent, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_agent_slug
  ON memories(agent, slug);

CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine
  ON memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS memory_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY (from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_edges_from_id
  ON memory_edges(from_id);

CREATE INDEX IF NOT EXISTS idx_memory_edges_to_id
  ON memory_edges(to_id);

CREATE TABLE IF NOT EXISTS memory_history (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  value TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_history_memory_id
  ON memory_history(memory_id, timestamp DESC);
`

let extractorPromise: Promise<FeatureExtractor> | null = null
let extractorModel: string | null = null

async function createExtractor(model: string): Promise<FeatureExtractor> {
  const instance = await pipeline("feature-extraction", model, { dtype: "fp32" })
  return instance as unknown as FeatureExtractor
}

function isLikelyModelCached(model: string, cacheDir?: string): boolean {
  const normalized = `models--${model.replace(/\//g, "--")}`
  const candidates = [
    cacheDir ? path.join(cacheDir, normalized) : null,
    path.join(homedir(), ".cache", "huggingface", "hub", normalized),
    path.join(process.cwd(), ".cache", "huggingface", "hub", normalized),
    path.join(process.cwd(), ".cache", normalized),
  ]
  return candidates.some((candidate) => candidate !== null && existsSync(candidate))
}

async function getExtractor(model: string, cacheDir?: string): Promise<FeatureExtractor> {
  if (!extractorPromise || extractorModel !== model) {
    if (cacheDir) {
      hfEnv.cacheDir = cacheDir
    }
    extractorPromise = createExtractor(model)
    extractorModel = model
  }
  return extractorPromise
}

function normalizeVector(values: number[]): number[] {
  let magnitude = 0
  for (const value of values) {
    magnitude += value * value
  }
  if (magnitude === 0) {
    return values
  }
  const scale = Math.sqrt(magnitude)
  return values.map((value) => value / scale)
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hashEmbed(text: string, size: number): number[] {
  const vector = new Array<number>(size).fill(0)
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  if (tokens.length === 0) {
    return vector
  }

  for (const token of tokens) {
    const baseHash = hashToken(token)
    const indexA = baseHash % size
    const indexB = Math.imul(baseHash ^ 0x9e3779b9, 2654435761) >>> 0 % size
    const sign = (baseHash & 1) === 0 ? 1 : -1
    vector[indexA] = (vector[indexA] ?? 0) + sign
    vector[indexB] = (vector[indexB] ?? 0) - sign * 0.5
  }

  return normalizeVector(vector)
}

function serializeVector(vector: number[]): string {
  return `[${vector.join(",")}]`
}

function parseMetadata(raw: unknown): Record<string, string> {
  if (raw === null || raw === undefined) return {}
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === "object") {
        return Object.fromEntries(
          Object.entries(parsed).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
        )
      }
    } catch {
      return {}
    }
  }
  if (typeof raw === "object") {
    return Object.fromEntries(
      Object.entries(raw).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
    )
  }
  return {}
}

function timestampToMs(value: Date | string | null): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") return Date.parse(value)
  return 0
}

function numericValue(value: number | string | null | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  return 0
}

function mapRow(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    agent: row.agent,
    slug: row.slug,
    content: row.content,
    createdAt: timestampToMs(row.created_at),
    pinned: row.pinned,
    metadata: parseMetadata(row.metadata),
  }
}

export class PostgresPgvectorAdapter implements MemoryAdapter {
  #pool: Pool
  #model: string
  #vectorSize: number
  #cacheDir?: string
  #embedderMode: EmbedderMode

  constructor(config: PostgresPgvectorAdapterConfig = {}) {
    this.#model = config.model ?? DEFAULT_MODEL
    this.#vectorSize = config.vectorSize ?? DEFAULT_VECTOR_SIZE
    this.#cacheDir = config.cacheDir
    this.#embedderMode = isLikelyModelCached(this.#model, config.cacheDir) ? "transformers" : "hash"
    this.#pool = new Pool({
      connectionString: config.connectionString,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl,
      max: 4,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 3000,
    })
  }

  embeddingMode(): EmbedderMode {
    return this.#embedderMode
  }

  async dispose(): Promise<void> {
    await this.#pool.end()
  }

  async reset(): Promise<void> {
    await this.#ensureSchema()
    await this.#pool.query("TRUNCATE TABLE memory_edges, memory_history, memories")
  }

  async addEdges(edges: PostgresMemoryEdge[]): Promise<number> {
    await this.#ensureSchema()
    if (edges.length === 0) return 0
    const client = await this.#pool.connect()
    try {
      await client.query("BEGIN")
      for (const edge of edges) {
        await client.query(
          `
            INSERT INTO memory_edges (from_id, to_id, weight)
            VALUES ($1, $2, $3)
            ON CONFLICT (from_id, to_id)
            DO UPDATE SET weight = EXCLUDED.weight
          `,
          [edge.fromId, edge.toId, edge.weight],
        )
      }
      await client.query("COMMIT")
      return edges.length
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async searchExpanded(agent: string, query: string, depth: number = 2, limit: number = 10): Promise<MemoryEntry[]> {
    await this.#ensureSchema()
    const seedRows = await this.#searchRows(agent, query, 5)
    if (seedRows.length === 0) return []

    const seeds = seedRows.map((row) => ({
      id: row.id,
      score: Math.max(numericValue(row.semantic_score), 0.0001),
    }))
    const result = await this.#pool.query<SearchScoreRow>(
      `
        WITH RECURSIVE
        seeded AS (
          SELECT seed.id::text AS id, seed.score::double precision AS seed_score
          FROM jsonb_to_recordset($1::jsonb) AS seed(id text, score double precision)
        ),
        walk AS (
          SELECT seeded.id, seeded.id AS root_id, 0 AS depth, seeded.seed_score AS path_score
          FROM seeded
          UNION ALL
          SELECT edge.to_id, walk.root_id, walk.depth + 1, walk.path_score * GREATEST(edge.weight::double precision, 0.01)
          FROM walk
          JOIN memory_edges AS edge ON edge.from_id = walk.id
          WHERE walk.depth < $2
        ),
        ranked AS (
          SELECT id, MAX(path_score) AS graph_score, MIN(depth) AS min_depth
          FROM walk
          GROUP BY id
        )
        SELECT
          memory.id,
          memory.agent,
          memory.slug,
          memory.content,
          memory.created_at,
          memory.pinned,
          memory.metadata,
          memory.tags,
          seeded.seed_score AS semantic_score,
          ranked.graph_score,
          ranked.min_depth
        FROM ranked
        JOIN memories AS memory ON memory.id = ranked.id
        LEFT JOIN seeded ON seeded.id = ranked.id
        WHERE memory.agent = $3
        ORDER BY ((COALESCE(seeded.seed_score, 0) * 0.55) + (ranked.graph_score * 0.45)) DESC,
                 ranked.min_depth ASC,
                 memory.created_at DESC
        LIMIT $4
      `,
      [JSON.stringify(seeds), depth, agent, limit],
    )

    return result.rows.map((row) => mapRow(row))
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    await this.#ensureSchema()
    const result = await this.#pool.query<MemoryRow>(
      `
        SELECT id, agent, slug, content, created_at, pinned, metadata, tags
        FROM memories
        WHERE agent = $1
        ORDER BY created_at DESC
      `,
      [agent],
    )
    return result.rows.map((row) => mapRow(row))
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    await this.#ensureSchema()
    const id = generateId()
    const slug = entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content)
    const embedding = await this.#embed(entry.content)
    const tags = entry.metadata["tags"] ?? ""
    await this.#pool.query(
      `
        INSERT INTO memories (id, agent, slug, content, embedding, created_at, tags, pinned, metadata)
        VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9::jsonb)
      `,
      [id, agent, slug, entry.content, serializeVector(embedding), new Date(entry.createdAt), tags, entry.pinned, JSON.stringify(entry.metadata)],
    )
    await this.#insertHistory(id, "ADD", entry.content)
    return { id, agent, slug, content: entry.content, createdAt: entry.createdAt, pinned: entry.pinned, metadata: entry.metadata }
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    await this.#ensureSchema()
    const existing = await this.#getById(id)
    if (!existing) {
      throw new Error(`Memory entry not found: ${id}`)
    }
    const embedding = await this.#embed(content)
    await this.#pool.query(
      `
        UPDATE memories
        SET content = $2,
            embedding = $3::vector
        WHERE id = $1
      `,
      [id, content, serializeVector(embedding)],
    )
    await this.#insertHistory(id, "UPDATE", content)
    return {
      ...existing,
      content,
    }
  }

  async delete(id: string): Promise<void> {
    await this.#ensureSchema()
    await this.#pool.query("DELETE FROM memory_edges WHERE from_id = $1 OR to_id = $1", [id])
    await this.#pool.query("DELETE FROM memory_history WHERE memory_id = $1", [id])
    await this.#pool.query("DELETE FROM memories WHERE id = $1", [id])
  }

  async deleteAll(agent: string): Promise<void> {
    await this.#ensureSchema()
    const idsResult = await this.#pool.query<{ id: string }>("SELECT id FROM memories WHERE agent = $1", [agent])
    const ids = idsResult.rows.map((row) => row.id)
    if (ids.length === 0) return
    await this.#pool.query("DELETE FROM memory_edges WHERE from_id = ANY($1::text[]) OR to_id = ANY($1::text[])", [ids])
    await this.#pool.query("DELETE FROM memory_history WHERE memory_id = ANY($1::text[])", [ids])
    await this.#pool.query("DELETE FROM memories WHERE agent = $1", [agent])
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    await this.#ensureSchema()
    const rows = await this.#searchRows(agent, query, 10)
    return rows.map((row) => mapRow(row))
  }

  async history(id: string): Promise<HistoryEntry[]> {
    await this.#ensureSchema()
    const result = await this.#pool.query<HistoryRow>(
      `
        SELECT action, value, timestamp
        FROM memory_history
        WHERE memory_id = $1
        ORDER BY timestamp DESC
      `,
      [id],
    )
    return result.rows.map((row) => ({
      action: row.action,
      value: row.value,
      timestamp: timestampToMs(row.timestamp),
    }))
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    const entries = await this.read(agent)
    return analyzeStale(entries)
  }

  async prune(agent: string, idsToRemove: string[]): Promise<number> {
    await this.#ensureSchema()
    if (idsToRemove.length === 0) return 0
    const result = await this.#pool.query(
      `
        DELETE FROM memories
        WHERE agent = $1 AND id = ANY($2::text[])
      `,
      [agent, idsToRemove],
    )
    await this.#pool.query("DELETE FROM memory_edges WHERE from_id = ANY($1::text[]) OR to_id = ANY($1::text[])", [idsToRemove])
    await this.#pool.query("DELETE FROM memory_history WHERE memory_id = ANY($1::text[])", [idsToRemove])
    return result.rowCount ?? 0
  }

  async count(agent: string): Promise<MemoryCount> {
    await this.#ensureSchema()
    const result = await this.#pool.query<CountRow>(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN pinned THEN 1 ELSE 0 END) AS pinned,
          MIN(created_at) AS oldest,
          MAX(created_at) AS newest
        FROM memories
        WHERE agent = $1
      `,
      [agent],
    )
    const row = result.rows[0]
    if (!row || numericValue(row.total) === 0) {
      return { total: 0, pinned: 0, oldest: 0, newest: 0 }
    }
    return {
      total: numericValue(row.total),
      pinned: numericValue(row.pinned),
      oldest: timestampToMs(row.oldest),
      newest: timestampToMs(row.newest),
    }
  }

  async listAgents(): Promise<string[]> {
    await this.#ensureSchema()
    const result = await this.#pool.query<AgentRow>("SELECT DISTINCT agent FROM memories ORDER BY agent ASC")
    return result.rows.map((row) => row.agent)
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.#ensureSchema()
      await this.#pool.query("SELECT 1")
      return { ok: true, message: `postgres-pgvector adapter ready (${this.#embedderMode})` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
  }

  async #ensureSchema(): Promise<void> {
    await this.#pool.query(SCHEMA_SQL)
  }

  async #embed(text: string): Promise<number[]> {
    if (this.#embedderMode === "hash") {
      return hashEmbed(text, this.#vectorSize)
    }
    const extractor = await getExtractor(this.#model, this.#cacheDir)
    const output = await extractor(text, { pooling: "mean", normalize: true })
    return Array.from(output.data as Float32Array)
  }

  async #searchRows(agent: string, query: string, limit: number): Promise<SearchScoreRow[]> {
    const embedding = await this.#embed(query)
    const result = await this.#pool.query<SearchScoreRow>(
      `
        SELECT
          id,
          agent,
          slug,
          content,
          created_at,
          pinned,
          metadata,
          tags,
          1 - (embedding <=> $2::vector) AS semantic_score
        FROM memories
        WHERE agent = $1
        ORDER BY embedding <=> $2::vector ASC, created_at DESC
        LIMIT $3
      `,
      [agent, serializeVector(embedding), limit],
    )
    return result.rows
  }

  async #getById(id: string): Promise<MemoryEntry | null> {
    const result = await this.#pool.query<MemoryRow>(
      `
        SELECT id, agent, slug, content, created_at, pinned, metadata, tags
        FROM memories
        WHERE id = $1
      `,
      [id],
    )
    const row = result.rows[0]
    return row ? mapRow(row) : null
  }

  async #insertHistory(memoryId: string, action: string, value: string): Promise<void> {
    await this.#pool.query(
      `
        INSERT INTO memory_history (id, memory_id, action, value, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [generateId(), memoryId, action, value, new Date()],
    )
  }
}
