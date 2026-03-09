import { createHash } from "node:crypto"
import neo4j, { type Driver, type Session } from "neo4j-driver"
import { QdrantClient } from "@qdrant/js-client-rest"
import { analyzeStale, generateId, generateSlug } from "../../../../src/memory/format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "../../../../src/memory/adapters/types.js"

export interface QdrantNeo4jAdapterConfig {
  qdrantUrl: string
  neo4jUrl: string
  collectionName: string
  vectorSize: number
}

export interface GraphSearchResult {
  seedIds: string[]
  expandedIds: string[]
  resultEntryIds: string[]
  entries: MemoryEntry[]
}

interface MemoryPayload {
  [key: string]: unknown
  agent_id: string
  raw_text: string
  slug: string
  created_at: number
  pinned: boolean
  metadata: Record<string, string>
  tags: string[]
  history: Array<{ action: string; value: string; timestamp: number }>
}

interface Neo4jMemoryNode {
  id: string
  agent: string
  slug: string
  content: string
  createdAt: number
  pinned: boolean
  metadataJson: string
}

function normalizeTokens(text: string): string[] {
  const matches = text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu)
  if (matches && matches.length > 0) {
    return matches
  }
  return [text.toLowerCase().normalize("NFKC")]
}

function hashEmbedding(text: string, vectorSize: number): number[] {
  const values = new Array<number>(vectorSize).fill(0)
  const tokens = normalizeTokens(text)

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest()
    for (let offset = 0; offset <= digest.length - 4; offset += 4) {
      const bucket = digest.readUInt32BE(offset)
      const index = bucket % vectorSize
      const sign = (bucket & 1) === 0 ? 1 : -1
      values[index] = (values[index] ?? 0) + sign
    }
  }

  let magnitude = 0
  for (const value of values) {
    magnitude += value * value
  }

  if (magnitude === 0) {
    values[0] = 1
    return values
  }

  const divisor = Math.sqrt(magnitude)
  return values.map((value) => value / divisor)
}

function parseTags(metadata: Record<string, string>): string[] {
  const rawTags = metadata["tags"]
  if (!rawTags) {
    return []
  }

  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index)
}

function asPayload(raw: unknown): MemoryPayload | undefined {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return undefined
  }

  const payload = raw as Record<string, unknown>
  if (typeof payload["agent_id"] !== "string") {
    return undefined
  }
  if (typeof payload["raw_text"] !== "string") {
    return undefined
  }
  if (typeof payload["slug"] !== "string") {
    return undefined
  }

  const createdAt = payload["created_at"]
  const pinned = payload["pinned"]
  const metadata = payload["metadata"]
  const tags = payload["tags"]
  const history = payload["history"]

  if (typeof createdAt !== "number") {
    return undefined
  }
  if (typeof pinned !== "boolean") {
    return undefined
  }
  if (!metadata || typeof metadata !== "object") {
    return undefined
  }
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    return undefined
  }
  if (!Array.isArray(history)) {
    return undefined
  }

  const normalizedMetadata: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") {
      normalizedMetadata[key] = value
    }
  }

  const normalizedHistory: Array<{ action: string; value: string; timestamp: number }> = []
  for (const item of history) {
    if (item === null || item === undefined || typeof item !== "object") {
      continue
    }
    const maybeHistory = item as Record<string, unknown>
    if (
      typeof maybeHistory["action"] === "string" &&
      typeof maybeHistory["value"] === "string" &&
      typeof maybeHistory["timestamp"] === "number"
    ) {
      normalizedHistory.push({
        action: maybeHistory["action"],
        value: maybeHistory["value"],
        timestamp: maybeHistory["timestamp"],
      })
    }
  }

  return {
    agent_id: payload["agent_id"],
    raw_text: payload["raw_text"],
    slug: payload["slug"],
    created_at: createdAt,
    pinned,
    metadata: normalizedMetadata,
    tags,
    history: normalizedHistory,
  }
}

function payloadToEntry(id: string, payload: MemoryPayload): MemoryEntry {
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

function neo4jNodeToEntry(node: Neo4jMemoryNode): MemoryEntry {
  let metadata: Record<string, string> = {}
  try {
    const parsed = JSON.parse(node.metadataJson) as unknown
    if (parsed && typeof parsed === "object") {
      const metadataRecord = parsed as Record<string, unknown>
      const normalizedMetadata: Record<string, string> = {}
      for (const [key, value] of Object.entries(metadataRecord)) {
        if (typeof value === "string") {
          normalizedMetadata[key] = value
        }
      }
      metadata = normalizedMetadata
    }
  } catch {
    metadata = {}
  }

  return {
    id: node.id,
    agent: node.agent,
    slug: node.slug,
    content: node.content,
    createdAt: node.createdAt,
    pinned: node.pinned,
    metadata,
  }
}

function nodeFromSessionRecord(record: Record<string, unknown>): Neo4jMemoryNode | null {
  const id = record["id"]
  const agent = record["agent"]
  const slug = record["slug"]
  const content = record["content"]
  const createdAt = record["createdAt"]
  const pinned = record["pinned"]
  const metadataJson = record["metadataJson"]

  if (
    typeof id !== "string" ||
    typeof agent !== "string" ||
    typeof slug !== "string" ||
    typeof content !== "string" ||
    typeof createdAt !== "number" ||
    typeof pinned !== "boolean" ||
    typeof metadataJson !== "string"
  ) {
    return null
  }

  return { id, agent, slug, content, createdAt, pinned, metadataJson }
}

export class QdrantNeo4jAdapter implements MemoryAdapter {
  readonly #client: QdrantClient
  readonly #driver: Driver
  readonly #config: QdrantNeo4jAdapterConfig

  constructor(config: QdrantNeo4jAdapterConfig) {
    this.#config = config
    this.#client = new QdrantClient({ url: config.qdrantUrl, checkCompatibility: false })
    this.#driver = neo4j.driver(config.neo4jUrl, neo4j.auth.basic("", ""), { disableLosslessIntegers: true })
  }

  async close(): Promise<void> {
    await this.#driver.close()
  }

  async resetStore(): Promise<void> {
    const exists = await this.#client.collectionExists(this.#config.collectionName)
    if (exists.exists) {
      await this.#client.deleteCollection(this.#config.collectionName)
    }

    await this.#ensureCollection()
    await this.#withWriteSession((session) => session.run("MATCH (m:Memory) DETACH DELETE m"))
  }

  async graphSearch(agent: string, query: string): Promise<GraphSearchResult> {
    await this.#ensureReady()
    const vector = hashEmbedding(query, this.#config.vectorSize)
    const seeds = await this.#client.search(this.#config.collectionName, {
      vector,
      limit: 10,
      filter: {
        must: [{ key: "agent_id", match: { value: agent } }],
      },
      with_payload: true,
      with_vector: false,
    })

    const seedEntries: MemoryEntry[] = []
    const seedIds: string[] = []
    for (const seed of seeds) {
      const payload = asPayload(seed.payload)
      if (!payload) {
        continue
      }
      seedIds.push(String(seed.id))
      seedEntries.push(payloadToEntry(String(seed.id), payload))
    }

    if (seedIds.length === 0) {
      return { seedIds: [], expandedIds: [], resultEntryIds: [], entries: [] }
    }

    const expandedRecords = await this.#withReadSession((session) =>
      session.run(
        `MATCH path = (m:Memory)-[:RELATED_TO*1..2]->(n:Memory)
         WHERE m.id IN $seedIds
         RETURN DISTINCT n.id AS id,
                         n.agent AS agent,
                         n.slug AS slug,
                         n.content AS content,
                         n.createdAt AS createdAt,
                         n.pinned AS pinned,
                         n.metadataJson AS metadataJson`,
        { seedIds },
      ),
    )

    const expandedEntries: MemoryEntry[] = []
    const expandedIds: string[] = []
    for (const record of expandedRecords.records) {
      const node = nodeFromSessionRecord(record.toObject())
      if (!node) {
        continue
      }
      expandedIds.push(node.id)
      expandedEntries.push(neo4jNodeToEntry(node))
    }

    const seen = new Set<string>()
    const combined: MemoryEntry[] = []
    for (const entry of [...seedEntries, ...expandedEntries]) {
      if (seen.has(entry.id)) {
        continue
      }
      seen.add(entry.id)
      combined.push(entry)
    }

    return {
      seedIds,
      expandedIds: expandedIds.filter((id) => !seedIds.includes(id)),
      resultEntryIds: combined.map((entry) => entry.slug),
      entries: combined,
    }
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    await this.#ensureReady()
    const page = await this.#client.scroll(this.#config.collectionName, {
      filter: {
        must: [{ key: "agent_id", match: { value: agent } }],
      },
      with_payload: true,
      with_vector: false,
      limit: 10_000,
    })

    const entries: MemoryEntry[] = []
    for (const point of page.points) {
      const payload = asPayload(point.payload)
      if (!payload) {
        continue
      }
      entries.push(payloadToEntry(String(point.id), payload))
    }

    return entries.sort((left, right) => right.createdAt - left.createdAt)
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    await this.#ensureReady()
    const id = generateId()
    const slug = entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content)
    const tags = parseTags(entry.metadata)
    const historyEntry = { action: "ADD", value: entry.content, timestamp: Date.now() }
    const payload: MemoryPayload = {
      agent_id: agent,
      raw_text: entry.content,
      slug,
      created_at: entry.createdAt,
      pinned: entry.pinned,
      metadata: entry.metadata,
      tags,
      history: [historyEntry],
    }

    await this.#client.upsert(this.#config.collectionName, {
      points: [{ id, vector: hashEmbedding(entry.content, this.#config.vectorSize), payload }],
    })
    await this.#syncNode(payloadToEntry(id, payload), tags)
    return payloadToEntry(id, payload)
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    await this.#ensureReady()
    const existing = await this.#getPayload(id)
    const now = Date.now()
    const payload: MemoryPayload = {
      agent_id: existing?.agent_id ?? "",
      raw_text: content,
      slug: existing?.slug ?? generateSlug(content),
      created_at: existing?.created_at ?? now,
      pinned: existing?.pinned ?? false,
      metadata: existing?.metadata ?? {},
      tags: existing?.tags ?? [],
      history: [...(existing?.history ?? []), { action: "UPDATE", value: content, timestamp: now }],
    }

    await this.#client.upsert(this.#config.collectionName, {
      points: [{ id, vector: hashEmbedding(content, this.#config.vectorSize), payload }],
    })
    await this.#syncNode(payloadToEntry(id, payload), payload.tags)
    return payloadToEntry(id, payload)
  }

  async delete(id: string): Promise<void> {
    await this.#ensureReady()
    await this.#client.delete(this.#config.collectionName, { points: [id] })
    await this.#withWriteSession((session) => session.run("MATCH (m:Memory {id: $id}) DETACH DELETE m", { id }))
  }

  async deleteAll(agent: string): Promise<void> {
    await this.#ensureReady()
    await this.#client.delete(this.#config.collectionName, {
      filter: {
        must: [{ key: "agent_id", match: { value: agent } }],
      },
    })
    await this.#withWriteSession((session) => session.run("MATCH (m:Memory {agent: $agent}) DETACH DELETE m", { agent }))
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const result = await this.graphSearch(agent, query)
    return result.entries.slice(0, 10)
  }

  async history(id: string): Promise<HistoryEntry[]> {
    const payload = await this.#getPayload(id)
    if (!payload) {
      return []
    }

    return payload.history.map((item) => ({
      action: item.action,
      value: item.value,
      timestamp: item.timestamp,
    }))
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    return analyzeStale(await this.read(agent))
  }

  async prune(_agent: string, idsToRemove: string[]): Promise<number> {
    if (idsToRemove.length === 0) {
      return 0
    }

    await this.#ensureReady()
    await this.#client.delete(this.#config.collectionName, { points: idsToRemove })
    await this.#withWriteSession((session) => session.run("MATCH (m:Memory) WHERE m.id IN $ids DETACH DELETE m", { ids: idsToRemove }))
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
    await this.#ensureReady()
    const result = await this.#withReadSession((session) =>
      session.run("MATCH (m:Memory) RETURN DISTINCT m.agent AS agent ORDER BY agent ASC"),
    )
    const agents: string[] = []
    for (const record of result.records) {
      const agent = record.get("agent")
      if (typeof agent === "string") {
        agents.push(agent)
      }
    }
    return agents
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      const qdrantHealth = await fetch(`${this.#config.qdrantUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
      if (!qdrantHealth.ok) {
        return { ok: false, message: `qdrant returned HTTP ${qdrantHealth.status}` }
      }

      const neo4jResult = await this.#withReadSession((session) => session.run("RETURN 1 AS ok"))
      if (neo4jResult.records.length === 0) {
        return { ok: false, message: "neo4j returned no rows" }
      }

      await this.#ensureReady()
      return { ok: true, message: "qdrant and neo4j ready" }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
  }

  async #ensureReady(): Promise<void> {
    await this.#ensureCollection()
    await this.#ensureGraphSchema()
  }

  async #ensureCollection(): Promise<void> {
    const exists = await this.#client.collectionExists(this.#config.collectionName)
    if (!exists.exists) {
      await this.#client.createCollection(this.#config.collectionName, {
        vectors: { size: this.#config.vectorSize, distance: "Cosine" },
      })
    }
  }

  async #ensureGraphSchema(): Promise<void> {
    await this.#withWriteSession((session) =>
      session.run("CREATE CONSTRAINT memory_id_unique IF NOT EXISTS FOR (m:Memory) REQUIRE m.id IS UNIQUE"),
    )
  }

  async #getPayload(id: string): Promise<MemoryPayload | undefined> {
    await this.#ensureReady()
    const retrieved = await this.#client.retrieve(this.#config.collectionName, {
      ids: [id],
      with_payload: true,
      with_vector: false,
    })
    const point = retrieved[0]
    return point ? asPayload(point.payload) : undefined
  }

  async #syncNode(entry: MemoryEntry, tags: string[]): Promise<void> {
    const metadataJson = JSON.stringify(entry.metadata)
    await this.#withWriteSession((session) =>
      session.run(
        `MERGE (m:Memory {id: $id})
         SET m.agent = $agent,
             m.slug = $slug,
             m.content = $content,
             m.createdAt = $createdAt,
             m.pinned = $pinned,
             m.metadataJson = $metadataJson,
             m.tags = $tags`,
        {
          id: entry.id,
          agent: entry.agent,
          slug: entry.slug,
          content: entry.content,
          createdAt: entry.createdAt,
          pinned: entry.pinned,
          metadataJson,
          tags,
        },
      ),
    )

    await this.#withWriteSession((session) => session.run("MATCH (m:Memory {id: $id})-[r:RELATED_TO]-() DELETE r", { id: entry.id }))

    if (tags.length === 0) {
      return
    }

    await this.#withWriteSession((session) =>
      session.run(
        `MATCH (current:Memory {id: $id})
         UNWIND $tags AS tag
         MATCH (other:Memory)
         WHERE other.id <> $id AND tag IN other.tags
         WITH current, other, count(DISTINCT tag) AS overlap, size($tags) AS currentTagCount, size(other.tags) AS otherTagCount
         WHERE overlap > 0
         WITH current, other, toFloat(overlap) / toFloat(currentTagCount + otherTagCount - overlap) AS weight
         MERGE (current)-[forward:RELATED_TO]->(other)
         SET forward.weight = weight
         MERGE (other)-[backward:RELATED_TO]->(current)
         SET backward.weight = weight`,
        { id: entry.id, tags },
      ),
    )
  }

  async #withReadSession<T>(run: (session: Session) => Promise<T>): Promise<T> {
    const session = this.#driver.session({ defaultAccessMode: neo4j.session.READ })
    try {
      return await run(session)
    } finally {
      await session.close()
    }
  }

  async #withWriteSession<T>(run: (session: Session) => Promise<T>): Promise<T> {
    const session = this.#driver.session({ defaultAccessMode: neo4j.session.WRITE })
    try {
      return await run(session)
    } finally {
      await session.close()
    }
  }
}
