import neo4j, { type Driver, type Session } from "neo4j-driver"
import { QdrantClient } from "@qdrant/js-client-rest"
import { analyzeStale, generateId, generateSlug } from "../../../../src/memory/format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "../../../../src/memory/adapters/types.js"

export interface QdrantMemgraphAdapterConfig {
  qdrantUrl: string
  memgraphUrl: string
  collectionName: string
  vectorSize: number
  seedLimit?: number
  expandedLimit?: number
  graphDepth?: number
}

interface MemoryPayload {
  [key: string]: unknown
  agent_id: string
  raw_text: string
  slug: string
  created_at: number
  pinned: boolean
  metadata: Record<string, string>
  history: Array<{ action: string; value: string; timestamp: number }>
}

interface SemanticSeed {
  id: string
  score: number
  entry: MemoryEntry
}

interface GraphNeighbor {
  id: string
  weight: number
  hops: number
}

export interface SearchInspection {
  seedResults: MemoryEntry[]
  expandedResults: MemoryEntry[]
  expandedNeighborhoodIds: string[]
}

interface GraphStats {
  nodeCount: number
  edgeCount: number
}

const DEFAULT_SEED_LIMIT = 6
const DEFAULT_EXPANDED_LIMIT = 10
const DEFAULT_GRAPH_DEPTH = 2
const MIN_TAG_OVERLAP = 2
const GENERIC_TAG_PREFIXES = ["agent:", "period:"]

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
}

function tokenize(text: string): string[] {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? []
}

function hashText(text: string, seed: number): number {
  let hash = 2166136261 ^ seed
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pseudoEmbed(text: string, vectorSize: number): number[] {
  const vector = Array.from({ length: vectorSize }, () => 0)
  const tokens = tokenize(text)
  const features = tokens.length > 0 ? tokens : [normalize(text)]

  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index]
    if (!feature) {
      continue
    }

    const hashA = hashText(feature, index + 1)
    const hashB = hashText(feature, index + 17)
    const slotA = hashA % vectorSize
    const slotB = hashB % vectorSize
    const sign = (hashB & 1) === 0 ? 1 : -1
    vector[slotA] = (vector[slotA] ?? 0) + 1
    vector[slotB] = (vector[slotB] ?? 0) + sign * 0.5

    if (feature.length >= 3) {
      for (let offset = 0; offset <= feature.length - 3; offset += 1) {
        const trigram = feature.slice(offset, offset + 3)
        const trigramHash = hashText(trigram, offset + 101)
        const trigramSlot = trigramHash % vectorSize
        vector[trigramSlot] = (vector[trigramSlot] ?? 0) + 0.25
      }
    }
  }

  let magnitude = 0
  for (const value of vector) {
    magnitude += value * value
  }

  if (magnitude === 0) {
    return vector
  }

  const scale = Math.sqrt(magnitude)
  return vector.map((value) => value / scale)
}

function recencyScore(createdAt: number): number {
  const ageDays = Math.max(0, (Date.now() - createdAt) / 86_400_000)
  return 1 / (1 + ageDays / 30)
}

function parsePayload(raw: unknown): MemoryPayload | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined
  }

  const candidate = raw as Record<string, unknown>
  const agentId = candidate["agent_id"]
  const rawText = candidate["raw_text"]
  const slug = candidate["slug"]
  const createdAt = candidate["created_at"]
  const pinned = candidate["pinned"]
  const metadata = candidate["metadata"]
  const history = candidate["history"]

  if (typeof agentId !== "string" || typeof rawText !== "string" || typeof slug !== "string") {
    return undefined
  }

  if (typeof createdAt !== "number" || typeof pinned !== "boolean" || !Array.isArray(history)) {
    return undefined
  }

  const normalizedMetadata: Record<string, string> = {}
  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string") {
        normalizedMetadata[key] = value
      }
    }
  }

  const normalizedHistory: Array<{ action: string; value: string; timestamp: number }> = []
  for (const item of history) {
    if (item && typeof item === "object") {
      const historyItem = item as Record<string, unknown>
      const action = historyItem["action"]
      const value = historyItem["value"]
      const timestamp = historyItem["timestamp"]
      if (typeof action === "string" && typeof value === "string" && typeof timestamp === "number") {
        normalizedHistory.push({ action, value, timestamp })
      }
    }
  }

  return {
    agent_id: agentId,
    raw_text: rawText,
    slug,
    created_at: createdAt,
    pinned,
    metadata: normalizedMetadata,
    history: normalizedHistory,
  }
}

function toMemoryEntry(id: string, payload: MemoryPayload): MemoryEntry {
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

function parseTags(metadata: Record<string, string>): string[] {
  const rawTags = metadata["tags"]
  if (!rawTags) {
    return []
  }

  const tags = rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => !GENERIC_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix)))

  return Array.from(new Set(tags)).sort()
}

function overlapWeight(a: string[], b: string[]): number {
  const right = new Set(b)
  let overlap = 0
  for (const tag of a) {
    if (right.has(tag)) {
      overlap += 1
    }
  }

  if (overlap < MIN_TAG_OVERLAP) {
    return 0
  }

  return overlap / Math.max(a.length, b.length)
}

function compareIds(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value
  }
  if (neo4j.isInt(value)) {
    return neo4j.integer.toNumber(value)
  }
  return 0
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === "string")
}

export class QdrantMemgraphAdapter implements MemoryAdapter {
  #qdrant: QdrantClient
  #driver: Driver
  #config: Required<QdrantMemgraphAdapterConfig>
  #tagIndex = new Map<string, Map<string, Set<string>>>()
  #tagCache = new Map<string, string[]>()

  constructor(config: QdrantMemgraphAdapterConfig) {
    this.#config = {
      ...config,
      seedLimit: config.seedLimit ?? DEFAULT_SEED_LIMIT,
      expandedLimit: config.expandedLimit ?? DEFAULT_EXPANDED_LIMIT,
      graphDepth: config.graphDepth ?? DEFAULT_GRAPH_DEPTH,
    }
    this.#qdrant = new QdrantClient({ url: this.#config.qdrantUrl, checkCompatibility: false })
    this.#driver = neo4j.driver(this.#config.memgraphUrl, neo4j.auth.basic("", ""), {
      disableLosslessIntegers: true,
    })
  }

  async close(): Promise<void> {
    await this.#driver.close()
  }

  async reset(): Promise<void> {
    await this.#ensureCollection()
    await this.#qdrant.delete(this.#config.collectionName, {
      filter: { must: [{ key: "slug", match: { except: "__never__" } }] },
    })
    await this.#withSession("WRITE", async (session) => {
      await session.run("MATCH (node:Memory) DETACH DELETE node")
    })
    this.#tagIndex.clear()
    this.#tagCache.clear()
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      const qdrantResponse = await fetch(`${this.#config.qdrantUrl}/collections`, { signal: AbortSignal.timeout(3000) })
      if (!qdrantResponse.ok) {
        return { ok: false, message: `Qdrant returned HTTP ${qdrantResponse.status}` }
      }

      await this.#withSession("READ", async (session) => {
        await session.run("RETURN 1 AS ok")
      })

      return { ok: true, message: "qdrant + memgraph ready" }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    const points = await this.#scrollAgent(agent)
    return points
      .sort((left, right) => right.payload.created_at - left.payload.created_at)
      .map(({ id, payload }) => toMemoryEntry(id, payload))
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    await this.#ensureCollection()

    const id = entry.slug.trim().length > 0 ? entry.slug : generateId()
    const slug = entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content)
    const payload: MemoryPayload = {
      agent_id: agent,
      raw_text: entry.content,
      slug,
      created_at: entry.createdAt,
      pinned: entry.pinned,
      metadata: entry.metadata,
      history: [{ action: "ADD", value: entry.content, timestamp: Date.now() }],
    }

    await this.#qdrant.upsert(this.#config.collectionName, {
      points: [{ id, vector: pseudoEmbed(entry.content, this.#config.vectorSize), payload }],
    })

    await this.#withSession("WRITE", async (session) => {
      await session.run(
        "MERGE (memory:Memory {id: $id}) SET memory.agent = $agent, memory.content = $content",
        { id, agent, content: entry.content },
      )
    })

    const currentTags = parseTags(entry.metadata)
    this.#tagCache.set(id, currentTags)
    await this.#upsertGraphEdges(agent, id, currentTags)

    return toMemoryEntry(id, payload)
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    await this.#ensureCollection()
    const existing = await this.#getById(id)
    if (!existing) {
      const createdAt = Date.now()
      return this.write("", { slug: id, agent: "", content, createdAt, pinned: false, metadata: {} })
    }

    const payload: MemoryPayload = {
      agent_id: existing.agent,
      raw_text: content,
      slug: existing.slug,
      created_at: existing.createdAt,
      pinned: existing.pinned,
      metadata: existing.metadata,
      history: [...(await this.history(id)), { action: "UPDATE", value: content, timestamp: Date.now() }],
    }

    await this.#qdrant.upsert(this.#config.collectionName, {
      points: [{ id, vector: pseudoEmbed(content, this.#config.vectorSize), payload }],
    })
    await this.#withSession("WRITE", async (session) => {
      await session.run("MATCH (memory:Memory {id: $id}) SET memory.content = $content", { id, content })
    })
    return toMemoryEntry(id, payload)
  }

  async delete(id: string): Promise<void> {
    await this.#ensureCollection()
    await this.#qdrant.delete(this.#config.collectionName, { points: [id] })
    await this.#withSession("WRITE", async (session) => {
      await session.run("MATCH (memory:Memory {id: $id}) DETACH DELETE memory", { id })
    })
    this.#removeFromTagIndex(id)
  }

  async deleteAll(agent: string): Promise<void> {
    await this.#ensureCollection()
    const existing = await this.#scrollAgent(agent)
    await this.#qdrant.delete(this.#config.collectionName, {
      filter: { must: [{ key: "agent_id", match: { value: agent } }] },
    })
    await this.#withSession("WRITE", async (session) => {
      await session.run("MATCH (memory:Memory {agent: $agent}) DETACH DELETE memory", { agent })
    })

    for (const item of existing) {
      this.#removeFromTagIndex(item.id)
    }
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const inspection = await this.inspectSearch(agent, query)
    return inspection.expandedResults
  }

  async inspectSearch(agent: string, query: string): Promise<SearchInspection> {
    const seeds = await this.searchSemanticSeeds(agent, query, this.#config.seedLimit)
    const seedIds = seeds.map((seed) => seed.id)
    if (seedIds.length === 0) {
      return { seedResults: [], expandedResults: [], expandedNeighborhoodIds: [] }
    }

    const seedScoreMap = new Map<string, number>()
    for (const seed of seeds) {
      seedScoreMap.set(seed.id, seed.score)
    }

    const graphNeighbors = await this.#expandNeighbors(agent, seedIds, this.#config.graphDepth, this.#config.expandedLimit * 3)
    const graphScoreMap = new Map<string, number>()
    const neighborhoodIds = new Set<string>(seedIds)

    for (const neighbor of graphNeighbors) {
      neighborhoodIds.add(neighbor.id)
      const score = neighbor.weight / Math.max(1, neighbor.hops)
      const current = graphScoreMap.get(neighbor.id) ?? 0
      if (score > current) {
        graphScoreMap.set(neighbor.id, score)
      }
    }

    const retrieved = await this.#retrieve(Array.from(neighborhoodIds))
    const expandedResults = retrieved
      .map(({ id, payload }) => {
        const entry = toMemoryEntry(id, payload)
        const semanticScore = seedScoreMap.get(id) ?? 0
        const graphScore = graphScoreMap.get(id) ?? 0
        const combined = semanticScore * 0.65 + graphScore * 0.25 + recencyScore(entry.createdAt) * 0.1
        return { entry, combined }
      })
      .sort((left, right) => right.combined - left.combined || right.entry.createdAt - left.entry.createdAt)
      .slice(0, this.#config.expandedLimit)
      .map((item) => item.entry)

    return {
      seedResults: seeds.map((seed) => seed.entry),
      expandedResults,
      expandedNeighborhoodIds: Array.from(neighborhoodIds),
    }
  }

  async searchSemanticSeeds(agent: string, query: string, limit: number = this.#config.expandedLimit): Promise<SemanticSeed[]> {
    await this.#ensureCollection()
    const results = await this.#qdrant.search(this.#config.collectionName, {
      vector: pseudoEmbed(query, this.#config.vectorSize),
      limit,
      filter: { must: [{ key: "agent_id", match: { value: agent } }] },
      with_payload: true,
      with_vector: false,
    })

    const seeds: SemanticSeed[] = []
    for (const result of results) {
      const payload = parsePayload(result.payload)
      if (!payload) {
        continue
      }
      const id = String(result.id)
      seeds.push({ id, score: result.score, entry: toMemoryEntry(id, payload) })
    }

    return seeds
  }

  async history(id: string): Promise<HistoryEntry[]> {
    const point = await this.#getPoint(id)
    if (!point) {
      return []
    }
    return point.payload.history.map((item) => ({ action: item.action, value: item.value, timestamp: item.timestamp }))
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    return analyzeStale(await this.read(agent))
  }

  async prune(_agent: string, idsToRemove: string[]): Promise<number> {
    for (const id of idsToRemove) {
      await this.delete(id)
    }
    return idsToRemove.length
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
      if (entry.pinned) {
        pinned += 1
      }
      if (entry.createdAt < oldest) {
        oldest = entry.createdAt
      }
      if (entry.createdAt > newest) {
        newest = entry.createdAt
      }
    }

    return { total: entries.length, pinned, oldest, newest }
  }

  async listAgents(): Promise<string[]> {
    await this.#ensureCollection()
    const results: string[] = []
    const seen = new Set<string>()
    let offset: string | number | undefined

    while (true) {
      const page = await this.#qdrant.scroll(this.#config.collectionName, {
        with_payload: true,
        with_vector: false,
        limit: 100,
        ...(offset === undefined ? {} : { offset }),
      })
      for (const point of page.points) {
        const payload = parsePayload(point.payload)
        if (payload && !seen.has(payload.agent_id)) {
          seen.add(payload.agent_id)
          results.push(payload.agent_id)
        }
      }

      const next = page.next_page_offset
      if (next === null || next === undefined || (typeof next !== "string" && typeof next !== "number")) {
        break
      }
      offset = next
    }

    return results.sort()
  }

  async graphStats(agent?: string): Promise<GraphStats> {
    return this.#withSession("READ", async (session) => {
      const nodeResult = agent
        ? await session.run("MATCH (memory:Memory {agent: $agent}) RETURN count(memory) AS count", { agent })
        : await session.run("MATCH (memory:Memory) RETURN count(memory) AS count")
      const edgeResult = agent
        ? await session.run(
            "MATCH (:Memory {agent: $agent})-[edge:RELATED_TO]-(:Memory {agent: $agent}) RETURN count(edge) AS count",
            { agent },
          )
        : await session.run("MATCH ()-[edge:RELATED_TO]-() RETURN count(edge) AS count")

      return {
        nodeCount: toNumber(nodeResult.records[0]?.get("count")),
        edgeCount: toNumber(edgeResult.records[0]?.get("count")),
      }
    })
  }

  async tracePath(agent: string, sourceId: string, targetId: string, depth: number = this.#config.graphDepth): Promise<string[] | null> {
    return this.#withSession("READ", async (session) => {
      const result = await session.run(
        `MATCH path = shortestPath((source:Memory {id: $sourceId, agent: $agent})-[:RELATED_TO*..${depth}]-(target:Memory {id: $targetId, agent: $agent})) RETURN [node IN nodes(path) | node.id] AS ids LIMIT 1`,
        { sourceId, targetId, agent },
      )
      const ids = result.records[0]?.get("ids")
      const pathIds = toStringArray(ids)
      return pathIds.length > 0 ? pathIds : null
    })
  }

  async #ensureCollection(): Promise<void> {
    const exists = await this.#qdrant.collectionExists(this.#config.collectionName)
    if (!exists.exists) {
      await this.#qdrant.createCollection(this.#config.collectionName, {
        vectors: { size: this.#config.vectorSize, distance: "Cosine" },
      })
    }
  }

  async #withSession<T>(mode: "READ" | "WRITE", fn: (session: Session) => Promise<T>): Promise<T> {
    const session = this.#driver.session({ defaultAccessMode: mode === "READ" ? neo4j.session.READ : neo4j.session.WRITE })
    try {
      return await fn(session)
    } finally {
      await session.close()
    }
  }

  async #getPoint(id: string): Promise<{ id: string; payload: MemoryPayload } | null> {
    await this.#ensureCollection()
    const points = await this.#qdrant.retrieve(this.#config.collectionName, { ids: [id], with_payload: true, with_vector: false })
    const point = points[0]
    if (!point) {
      return null
    }
    const payload = parsePayload(point.payload)
    if (!payload) {
      return null
    }
    return { id: String(point.id), payload }
  }

  async #getById(id: string): Promise<MemoryEntry | null> {
    const point = await this.#getPoint(id)
    return point ? toMemoryEntry(point.id, point.payload) : null
  }

  async #scrollAgent(agent: string): Promise<Array<{ id: string; payload: MemoryPayload }>> {
    await this.#ensureCollection()
    const entries: Array<{ id: string; payload: MemoryPayload }> = []
    let offset: string | number | undefined

    while (true) {
      const page = await this.#qdrant.scroll(this.#config.collectionName, {
        filter: { must: [{ key: "agent_id", match: { value: agent } }] },
        with_payload: true,
        with_vector: false,
        limit: 100,
        ...(offset === undefined ? {} : { offset }),
      })
      for (const point of page.points) {
        const payload = parsePayload(point.payload)
        if (payload) {
          entries.push({ id: String(point.id), payload })
        }
      }

      const next = page.next_page_offset
      if (next === null || next === undefined || (typeof next !== "string" && typeof next !== "number")) {
        break
      }
      offset = next
    }

    return entries
  }

  async #retrieve(ids: string[]): Promise<Array<{ id: string; payload: MemoryPayload }>> {
    if (ids.length === 0) {
      return []
    }
    const points = await this.#qdrant.retrieve(this.#config.collectionName, { ids, with_payload: true, with_vector: false })
    const results: Array<{ id: string; payload: MemoryPayload }> = []
    for (const point of points) {
      const payload = parsePayload(point.payload)
      if (payload) {
        results.push({ id: String(point.id), payload })
      }
    }
    return results
  }

  async #upsertGraphEdges(agent: string, id: string, tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return
    }

    const agentIndex = this.#tagIndex.get(agent) ?? new Map<string, Set<string>>()
    this.#tagIndex.set(agent, agentIndex)

    const candidates = new Set<string>()
    for (const tag of tags) {
      const tagMatches = agentIndex.get(tag)
      if (tagMatches) {
        for (const matchId of tagMatches) {
          if (matchId !== id) {
            candidates.add(matchId)
          }
        }
      }
    }

    for (const candidateId of candidates) {
      const candidateTags = this.#tagCache.get(candidateId) ?? []
      const weight = overlapWeight(tags, candidateTags)
      if (weight <= 0) {
        continue
      }

      const [leftId, rightId] = compareIds(id, candidateId)
      await this.#withSession("WRITE", async (session) => {
        await session.run(
          [
            "MATCH (left:Memory {id: $leftId, agent: $agent})",
            "MATCH (right:Memory {id: $rightId, agent: $agent})",
            "MERGE (left)-[edge:RELATED_TO]->(right)",
            "SET edge.weight = $weight",
          ].join(" "),
          { leftId, rightId, agent, weight },
        )
      })
    }

    for (const tag of tags) {
      const existing = agentIndex.get(tag) ?? new Set<string>()
      existing.add(id)
      agentIndex.set(tag, existing)
    }
  }

  #removeFromTagIndex(id: string): void {
    const tags = this.#tagCache.get(id)
    if (!tags) {
      return
    }

    for (const agentIndex of this.#tagIndex.values()) {
      for (const tag of tags) {
        const ids = agentIndex.get(tag)
        if (!ids) {
          continue
        }
        ids.delete(id)
        if (ids.size === 0) {
          agentIndex.delete(tag)
        }
      }
    }

    this.#tagCache.delete(id)
  }

  async #expandNeighbors(agent: string, seedIds: string[], depth: number, limit: number): Promise<GraphNeighbor[]> {
    if (seedIds.length === 0) {
      return []
    }

    const query = [
      "UNWIND $seedIds AS seedId",
      "MATCH (seed:Memory {id: seedId, agent: $agent})",
      `OPTIONAL MATCH path = (seed)-[edges:RELATED_TO*1..${depth}]-(neighbor:Memory {agent: $agent})`,
      "WHERE neighbor.id <> seed.id",
      "WITH neighbor, length(path) AS hops, reduce(total = 0.0, edge IN edges | total + coalesce(edge.weight, 0.0)) AS weight",
      "WHERE neighbor IS NOT NULL",
      "RETURN neighbor.id AS id, max(weight) AS weight, min(hops) AS hops",
      "ORDER BY weight DESC, hops ASC",
      "LIMIT $limit",
    ].join(" ")

    return this.#withSession("READ", async (session) => {
      const result = await session.run(query, { seedIds, agent, limit })
      return result.records.map((record) => ({
        id: String(record.get("id")),
        weight: toNumber(record.get("weight")),
        hops: toNumber(record.get("hops")),
      }))
    })
  }
}

export function createQdrantMemgraphAdapter(config?: Partial<QdrantMemgraphAdapterConfig>): QdrantMemgraphAdapter {
  return new QdrantMemgraphAdapter({
    qdrantUrl: config?.qdrantUrl ?? "http://127.0.0.1:6334",
    memgraphUrl: config?.memgraphUrl ?? "bolt://127.0.0.1:7688",
    collectionName: config?.collectionName ?? "wunderkind-memgraph-eval",
    vectorSize: config?.vectorSize ?? 384,
    ...(config?.seedLimit === undefined ? {} : { seedLimit: config.seedLimit }),
    ...(config?.expandedLimit === undefined ? {} : { expandedLimit: config.expandedLimit }),
    ...(config?.graphDepth === undefined ? {} : { graphDepth: config.graphDepth }),
  })
}
