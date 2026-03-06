import { pipeline, env as hfEnv, type FeatureExtractionPipeline } from "@huggingface/transformers"
import { QdrantClient } from "@qdrant/js-client-rest"
import { analyzeStale, generateId, generateSlug } from "../format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "./types.js"

export interface VectorAdapterConfig {
  qdrantUrl: string
  model: string
  vectorSize: number
  collectionName: string
  projectSlug: string
  cacheDir?: string
}

const DEDUP_THRESHOLD = 0.92
const RECENCY_LAMBDA = 0.995
const SCORE_WEIGHTS = { relevance: 0.4, recency: 0.3, importance: 0.3 }

interface MemoryPayload {
  [key: string]: unknown
  agent_id: string
  group_id: string
  raw_text: string
  slug: string
  created_at: number
  last_accessed: number
  importance: number
  access_count: number
  pinned: boolean
  metadata: Record<string, string>
  history: Array<{ action: string; value: string; timestamp: number }>
}

interface ScoredResult {
  id: string
  payload: MemoryPayload
  combined: number
}

let _extractor: FeatureExtractionPipeline | null = null

async function getExtractor(model: string, cacheDir?: string): Promise<FeatureExtractionPipeline> {
  if (!_extractor) {
    if (cacheDir) {
      hfEnv.cacheDir = cacheDir
    }
    const p = await pipeline("feature-extraction", model, { dtype: "fp32" })
    _extractor = p as FeatureExtractionPipeline
  }
  return _extractor
}

async function embed(model: string, text: string, cacheDir?: string): Promise<number[]> {
  const extractor = await getExtractor(model, cacheDir)
  const output = await extractor(text, { pooling: "mean", normalize: true })
  return Array.from(output.data as Float32Array)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function recencyScore(lastAccessedMs: number): number {
  const hoursSince = (Date.now() - lastAccessedMs) / 3_600_000
  return Math.pow(RECENCY_LAMBDA, hoursSince)
}

function combineScore(qdrantScore: number, payload: MemoryPayload): number {
  return (
    SCORE_WEIGHTS.relevance * qdrantScore +
    SCORE_WEIGHTS.recency * recencyScore(payload.last_accessed) +
    SCORE_WEIGHTS.importance * payload.importance
  )
}

function asPayload(raw: unknown): MemoryPayload | undefined {
  if (raw === null || raw === undefined || typeof raw !== "object") return undefined
  const p = raw as Record<string, unknown>
  if (typeof p["agent_id"] !== "string") return undefined
  if (typeof p["group_id"] !== "string") return undefined
  return raw as MemoryPayload
}

function mapPayload(id: string, payload: MemoryPayload): MemoryEntry {
  return {
    id,
    agent: payload.agent_id,
    slug: payload.slug,
    content: payload.raw_text,
    createdAt: payload.created_at,
    pinned: payload.pinned,
    metadata: payload.metadata,
  }
}

function isStringOrNumber(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number"
}

export class VectorAdapter implements MemoryAdapter {
  #client: QdrantClient
  #config: VectorAdapterConfig

  constructor(config: VectorAdapterConfig) {
    this.#config = config
    this.#client = new QdrantClient({ url: config.qdrantUrl, checkCompatibility: false })
  }

  async #ensureCollection(): Promise<void> {
    const exists = await this.#client.collectionExists(this.#config.collectionName)
    if (!exists.exists) {
      await this.#client.createCollection(this.#config.collectionName, {
        vectors: { size: this.#config.vectorSize, distance: "Cosine" },
      })
    }
  }

  async #scrollAll(agentId: string): Promise<Array<{ id: string; payload: MemoryPayload }>> {
    await this.#ensureCollection()
    const results: Array<{ id: string; payload: MemoryPayload }> = []
    let offset: string | number | undefined = undefined

    while (true) {
      const page = await this.#client.scroll(this.#config.collectionName, {
        filter: {
          must: [
            { key: "agent_id", match: { value: agentId } },
            { key: "group_id", match: { value: this.#config.projectSlug } },
          ],
        },
        with_payload: true,
        with_vector: false,
        limit: 100,
        ...(offset !== undefined ? { offset } : {}),
      })
      for (const point of page.points) {
        const payload = asPayload(point.payload)
        if (payload) {
          results.push({ id: String(point.id), payload })
        }
      }
      const next = page.next_page_offset
      if (next === null || next === undefined || !isStringOrNumber(next)) break
      offset = next
    }

    return results
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    const points = await this.#scrollAll(agent)
    return points
      .sort((a, b) => b.payload.created_at - a.payload.created_at)
      .map(({ id, payload }) => mapPayload(id, payload))
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    await this.#ensureCollection()
    const vector = await embed(this.#config.model, entry.content, this.#config.cacheDir)

    const dupes = await this.#client.search(this.#config.collectionName, {
      vector,
      limit: 5,
      filter: {
        must: [
          { key: "agent_id", match: { value: agent } },
          { key: "group_id", match: { value: this.#config.projectSlug } },
        ],
      },
      with_payload: false,
      with_vector: true,
      score_threshold: DEDUP_THRESHOLD,
    })

    if (dupes.length > 0) {
      const top = dupes[0]
      if (top !== undefined) {
        const topVector = top.vector
        if (Array.isArray(topVector)) {
          const sim = cosineSimilarity(vector, topVector as number[])
          if (sim >= DEDUP_THRESHOLD) {
            const dupId = String(top.id)
            const dupPage = await this.#client.scroll(this.#config.collectionName, {
              filter: {
                must: [
                  { key: "agent_id", match: { value: agent } },
                  { key: "group_id", match: { value: this.#config.projectSlug } },
                ],
              },
              with_payload: true,
              with_vector: false,
              limit: 1,
            })
            const found = dupPage.points.find((p) => String(p.id) === dupId)
            const dupPayload = asPayload(found?.payload)
            if (dupPayload) {
              return mapPayload(dupId, dupPayload)
            }
          }
        }
      }
    }

    const id = generateId()
    const slug = entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content)
    const now = Date.now()
    const payload: MemoryPayload = {
      agent_id: agent,
      group_id: this.#config.projectSlug,
      raw_text: entry.content,
      slug,
      created_at: entry.createdAt,
      last_accessed: now,
      importance: 0.5,
      access_count: 0,
      pinned: entry.pinned,
      metadata: entry.metadata,
      history: [{ action: "ADD", value: entry.content, timestamp: now }],
    }
    await this.#client.upsert(this.#config.collectionName, { points: [{ id, vector, payload }] })
    return mapPayload(id, payload)
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    await this.#ensureCollection()
    const vector = await embed(this.#config.model, content, this.#config.cacheDir)
    const now = Date.now()

    const retrieved = await this.#client.retrieve(this.#config.collectionName, {
      ids: [id],
      with_payload: true,
      with_vector: false,
    })
    const existing = retrieved[0] !== undefined ? asPayload(retrieved[0].payload) : undefined

    const slug = existing ? existing.slug : generateSlug(content)
    const agentId = existing?.agent_id ?? ""
    const historyEntries: Array<{ action: string; value: string; timestamp: number }> = existing
      ? [...existing.history, { action: "UPDATE", value: content, timestamp: now }]
      : [{ action: "UPDATE", value: content, timestamp: now }]

    const payload: MemoryPayload = {
      agent_id: agentId,
      group_id: existing?.group_id ?? this.#config.projectSlug,
      raw_text: content,
      slug,
      created_at: existing?.created_at ?? now,
      last_accessed: now,
      importance: existing?.importance ?? 0.5,
      access_count: existing?.access_count ?? 0,
      pinned: existing?.pinned ?? false,
      metadata: existing?.metadata ?? {},
      history: historyEntries,
    }
    await this.#client.upsert(this.#config.collectionName, { points: [{ id, vector, payload }] })
    return mapPayload(id, payload)
  }

  async delete(id: string): Promise<void> {
    await this.#ensureCollection()
    await this.#client.delete(this.#config.collectionName, { points: [id] })
  }

  async deleteAll(agent: string): Promise<void> {
    await this.#ensureCollection()
    await this.#client.delete(this.#config.collectionName, {
      filter: {
        must: [
          { key: "agent_id", match: { value: agent } },
          { key: "group_id", match: { value: this.#config.projectSlug } },
        ],
      },
    })
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    await this.#ensureCollection()
    const vector = await embed(this.#config.model, query, this.#config.cacheDir)

    const results = await this.#client.search(this.#config.collectionName, {
      vector,
      limit: 20,
      filter: {
        must: [
          { key: "agent_id", match: { value: agent } },
          { key: "group_id", match: { value: this.#config.projectSlug } },
        ],
      },
      with_payload: true,
      with_vector: false,
      score_threshold: 0.3,
    })

    const scored: ScoredResult[] = []
    for (const r of results) {
      const payload = asPayload(r.payload)
      if (!payload) continue
      scored.push({ id: String(r.id), payload, combined: combineScore(r.score, payload) })
    }
    scored.sort((a, b) => b.combined - a.combined)
    const top = scored.slice(0, 10)

    const now = Date.now()
    for (const item of top) {
      await this.#client.setPayload(this.#config.collectionName, {
        payload: { last_accessed: now, access_count: (item.payload.access_count ?? 0) + 1 },
        points: [item.id],
      })
    }

    return top.map(({ id, payload }) => mapPayload(id, payload))
  }

  async history(id: string): Promise<HistoryEntry[]> {
    await this.#ensureCollection()
    const retrieved = await this.#client.retrieve(this.#config.collectionName, {
      ids: [id],
      with_payload: true,
      with_vector: false,
    })
    const payload = retrieved[0] !== undefined ? asPayload(retrieved[0].payload) : undefined
    if (!payload) return []
    return payload.history.map((h) => ({
      action: h.action,
      value: h.value,
      timestamp: h.timestamp,
    }))
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    const entries = await this.read(agent)
    return analyzeStale(entries)
  }

  async prune(_agent: string, idsToRemove: string[]): Promise<number> {
    if (idsToRemove.length === 0) return 0
    await this.#ensureCollection()
    await this.#client.delete(this.#config.collectionName, { points: idsToRemove })
    return idsToRemove.length
  }

  async count(agent: string): Promise<MemoryCount> {
    const entries = await this.read(agent)
    if (entries.length === 0) return { total: 0, pinned: 0, oldest: 0, newest: 0 }
    let pinned = 0
    let oldest = entries[0]?.createdAt ?? 0
    let newest = entries[0]?.createdAt ?? 0
    for (const e of entries) {
      if (e.pinned) pinned += 1
      if (e.createdAt < oldest) oldest = e.createdAt
      if (e.createdAt > newest) newest = e.createdAt
    }
    return { total: entries.length, pinned, oldest, newest }
  }

  async listAgents(): Promise<string[]> {
    await this.#ensureCollection()
    const agentIds = new Set<string>()
    let offset: string | number | undefined = undefined

    while (true) {
      const page = await this.#client.scroll(this.#config.collectionName, {
        filter: { must: [{ key: "group_id", match: { value: this.#config.projectSlug } }] },
        with_payload: true,
        with_vector: false,
        limit: 100,
        ...(offset !== undefined ? { offset } : {}),
      })
      for (const point of page.points) {
        const payload = asPayload(point.payload)
        if (payload) {
          agentIds.add(payload.agent_id)
        }
      }
      const next = page.next_page_offset
      if (next === null || next === undefined || !isStringOrNumber(next)) break
      offset = next
    }

    return Array.from(agentIds).sort()
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`${this.#config.qdrantUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return { ok: true, message: "vector adapter ready" }
      return { ok: false, message: `Qdrant returned HTTP ${res.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message }
    }
  }
}
