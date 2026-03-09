import { Database } from "bun:sqlite"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { LocalVecAdapter, type LocalVecAdapterConfig } from "../../../../src/memory/adapters/local-vec.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "../../../../src/memory/adapters/types.js"

interface GraphNodeRow {
  id: string
  agent_id: string
  slug: string
  content: string
  created_at: number
  pinned: number
  metadata_json: string
  tags_json: string
}

interface GraphEdgeRow {
  agent_id: string
  from_id: string
  to_id: string
  weight: number
}

interface StoredNode {
  id: string
  agent: string
  slug: string
  content: string
  createdAt: number
  pinned: boolean
  metadata: Record<string, string>
  tags: string[]
}

export interface BenchmarkSeedEntry {
  agent: string
  slug: string
  content: string
  createdAt: number
  pinned: boolean
  metadata: Record<string, string>
}

export interface LocalVecGraphAdapterConfig extends LocalVecAdapterConfig {
  graphDbPath: string
  maxHops?: 1 | 2
  resultLimit?: number
}

export interface GraphSearchResult {
  seeds: MemoryEntry[]
  expandedNeighborhood: MemoryEntry[]
  results: MemoryEntry[]
}

const GRAPH_SCHEMA = `
CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  pinned INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  tags_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_agent ON graph_nodes(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS graph_edges (
  agent_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY (agent_id, from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(agent_id, from_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges(agent_id, to_id);
`

const SEED_BATCH_SIZE = 50
const PROGRESS_LOG_INTERVAL = 500

function runStatements(db: Database, sql: string): void {
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  for (const statement of statements) {
    db.query(statement).run()
  }
}

function parseTags(metadata: Record<string, string>): string[] {
  const raw = metadata.tags
  if (!raw) {
    return []
  }

  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

function overlapCount(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const rightSet = new Set(right)
  let matches = 0
  for (const tag of left) {
    if (rightSet.has(tag)) {
      matches += 1
    }
  }
  return matches
}

function nodeToEntry(node: StoredNode): MemoryEntry {
  return {
    id: node.id,
    agent: node.agent,
    slug: node.slug,
    content: node.content,
    createdAt: node.createdAt,
    pinned: node.pinned,
    metadata: node.metadata,
  }
}

export class LocalVecGraphAdapter implements MemoryAdapter {
  readonly #base: LocalVecAdapter
  readonly #db: Database
  readonly #maxHops: 1 | 2
  readonly #resultLimit: number
  readonly #upsertNodeStatement: ReturnType<Database["prepare"]>

  constructor(config: LocalVecGraphAdapterConfig) {
    void mkdir(path.dirname(config.graphDbPath), { recursive: true })
    this.#base = new LocalVecAdapter(config)
    this.#db = new Database(config.graphDbPath, { create: true })
    this.#db.run("PRAGMA journal_mode = WAL;")
    this.#db.run("PRAGMA foreign_keys = ON;")
    runStatements(this.#db, GRAPH_SCHEMA)
    this.#upsertNodeStatement = this.#db.prepare(
      `INSERT INTO graph_nodes (id, agent_id, slug, content, created_at, pinned, metadata_json, tags_json)
       VALUES ($id, $agent, $slug, $content, $createdAt, $pinned, $metadata, $tags)
       ON CONFLICT(id) DO UPDATE SET
         agent_id = excluded.agent_id,
         slug = excluded.slug,
         content = excluded.content,
         created_at = excluded.created_at,
         pinned = excluded.pinned,
         metadata_json = excluded.metadata_json,
         tags_json = excluded.tags_json`,
    )
    this.#maxHops = config.maxHops ?? 2
    this.#resultLimit = config.resultLimit ?? 10
  }

  supportsGraph(): true {
    return true
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    return this.#base.read(agent)
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    const stored = await this.#base.write(agent, entry)
    this.#upsertNode(stored)
    this.#rebuildEdgesForNode(agent, stored.id, parseTags(stored.metadata))
    return stored
  }

  async seedCorpus(entries: BenchmarkSeedEntry[]): Promise<void> {
    const grouped = new Map<string, BenchmarkSeedEntry[]>()
    for (const entry of entries) {
      const existing = grouped.get(entry.agent)
      if (existing) {
        existing.push(entry)
        continue
      }
      grouped.set(entry.agent, [entry])
    }

    const total = entries.length
    let totalWritten = 0
    const storedEntriesByAgent = new Map<string, MemoryEntry[]>()

    for (const [agent, agentEntries] of grouped) {
      const storedEntries: MemoryEntry[] = []

      for (let index = 0; index < agentEntries.length; index += SEED_BATCH_SIZE) {
        const batch = agentEntries.slice(index, index + SEED_BATCH_SIZE)
        const results = await Promise.all(
          batch.map((entry) => this.#base.write(entry.agent, {
            agent: entry.agent,
            slug: entry.slug,
            content: entry.content,
            createdAt: entry.createdAt,
            pinned: entry.pinned,
            metadata: entry.metadata,
          })),
        )

        storedEntries.push(...results)
        totalWritten += results.length
        if (totalWritten % PROGRESS_LOG_INTERVAL === 0 && totalWritten > 0) {
          console.log(`[progress] ingested ${totalWritten}/${total} entries...`)
        }
      }

      storedEntriesByAgent.set(agent, storedEntries)
    }

    const deleteEdges = this.#db.prepare("DELETE FROM graph_edges WHERE agent_id = $agent")
    const deleteNodes = this.#db.prepare("DELETE FROM graph_nodes WHERE agent_id = $agent")
    const insertEdge = this.#db.prepare(
      `INSERT OR REPLACE INTO graph_edges (agent_id, from_id, to_id, weight)
       VALUES ($agent, $fromId, $toId, $weight)`,
    )

    const tx = this.#db.transaction((entriesByAgent: Map<string, MemoryEntry[]>) => {
      for (const [agent, storedEntries] of entriesByAgent) {
        const nodes = storedEntries.map((entry) => ({
          entry,
          tags: parseTags(entry.metadata),
        }))

        deleteEdges.run({ $agent: agent })
        deleteNodes.run({ $agent: agent })

        for (const node of nodes) {
          this.#upsertNode(node.entry)
        }

        for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
          const leftNode = nodes[leftIndex]
          if (!leftNode) {
            continue
          }

          for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
            const rightNode = nodes[rightIndex]
            if (!rightNode) {
              continue
            }

            const sharedTags = overlapCount(leftNode.tags, rightNode.tags)
            if (sharedTags === 0) {
              continue
            }

            insertEdge.run({
              $agent: agent,
              $fromId: leftNode.entry.id,
              $toId: rightNode.entry.id,
              $weight: sharedTags,
            })
            insertEdge.run({
              $agent: agent,
              $fromId: rightNode.entry.id,
              $toId: leftNode.entry.id,
              $weight: sharedTags,
            })
          }
        }
      }
    })

    tx(storedEntriesByAgent)

    if (totalWritten < total) {
      console.log(`[progress] ingested ${totalWritten}/${total} entries...`)
    }
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    const updated = await this.#base.update(id, content)
    this.#db
      .prepare("UPDATE graph_nodes SET content = $content WHERE id = $id")
      .run({ $id: id, $content: updated.content })
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.#base.delete(id)
    this.#removeNode(id)
  }

  async deleteAll(agent: string): Promise<void> {
    await this.#base.deleteAll(agent)
    this.#db.prepare("DELETE FROM graph_edges WHERE agent_id = $agent").run({ $agent: agent })
    this.#db.prepare("DELETE FROM graph_nodes WHERE agent_id = $agent").run({ $agent: agent })
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const result = await this.searchWithGraph(agent, query)
    return result.results
  }

  async semanticSearch(agent: string, query: string): Promise<MemoryEntry[]> {
    return this.#base.search(agent, query)
  }

  async searchWithGraph(agent: string, query: string): Promise<GraphSearchResult> {
    const seeds = await this.semanticSearch(agent, query)
    if (seeds.length === 0) {
      return { seeds: [], expandedNeighborhood: [], results: [] }
    }

    const nodes = this.#listNodes(agent)
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const edgesBySource = this.#edgesBySource(agent)
    const candidateScores = new Map<string, { entry: MemoryEntry; score: number; depth: number }>()
    const expandedIds = new Set<string>()

    for (let seedIndex = 0; seedIndex < seeds.length; seedIndex += 1) {
      const seed = seeds[seedIndex]
      if (!seed) {
        continue
      }

      const seedScore = 1 / (seedIndex + 1)
      this.#upsertCandidate(candidateScores, seed, seedScore, 0)

      const visited = new Set<string>([seed.id])
      const frontier: Array<{ id: string; depth: number; cumulativeWeight: number }> = [
        { id: seed.id, depth: 0, cumulativeWeight: 0 },
      ]

      while (frontier.length > 0) {
        const current = frontier.shift()
        if (!current) {
          break
        }
        if (current.depth >= this.#maxHops) {
          continue
        }

        const neighbors = edgesBySource.get(current.id) ?? []
        for (const edge of neighbors) {
          if (visited.has(edge.to_id)) {
            continue
          }

          visited.add(edge.to_id)
          const nextNode = nodeById.get(edge.to_id)
          if (!nextNode) {
            continue
          }

          const nextDepth = current.depth + 1
          const cumulativeWeight = current.cumulativeWeight + edge.weight
          const score = seedScore * (1 + cumulativeWeight / nextDepth)
          const nextEntry = nodeToEntry(nextNode)

          expandedIds.add(nextEntry.id)
          this.#upsertCandidate(candidateScores, nextEntry, score, nextDepth)

          if (nextDepth < this.#maxHops) {
            frontier.push({ id: edge.to_id, depth: nextDepth, cumulativeWeight })
          }
        }
      }
    }

    const results = Array.from(candidateScores.values())
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }
        if (left.depth !== right.depth) {
          return left.depth - right.depth
        }
        if (right.entry.createdAt !== left.entry.createdAt) {
          return right.entry.createdAt - left.entry.createdAt
        }
        return left.entry.slug.localeCompare(right.entry.slug)
      })
      .slice(0, this.#resultLimit)
      .map((item) => item.entry)

    const expandedNeighborhood = Array.from(expandedIds)
      .map((id) => nodeById.get(id))
      .filter((node): node is StoredNode => node !== undefined)
      .map((node) => nodeToEntry(node))
      .sort((left, right) => right.createdAt - left.createdAt)

    return { seeds, expandedNeighborhood, results }
  }

  async history(id: string): Promise<HistoryEntry[]> {
    return this.#base.history(id)
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    return this.#base.analyzeStale(agent)
  }

  async prune(agent: string, idsToRemove: string[]): Promise<number> {
    const removed = await this.#base.prune(agent, idsToRemove)
    if (removed > 0) {
      const transaction = this.#db.transaction((ids: string[]) => {
        const deleteEdges = this.#db.prepare(
          "DELETE FROM graph_edges WHERE from_id = $id OR to_id = $id",
        )
        const deleteNode = this.#db.prepare("DELETE FROM graph_nodes WHERE id = $id AND agent_id = $agent")
        for (const id of ids) {
          deleteEdges.run({ $id: id })
          deleteNode.run({ $id: id, $agent: agent })
        }
      })
      transaction(idsToRemove)
    }
    return removed
  }

  async count(agent: string): Promise<MemoryCount> {
    return this.#base.count(agent)
  }

  async listAgents(): Promise<string[]> {
    return this.#base.listAgents()
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    const baseStatus = await this.#base.status()
    if (!baseStatus.ok) {
      return baseStatus
    }

    try {
      this.#db.query("SELECT 1").get()
      return { ok: true, message: "local-vec graph adapter ready" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  #upsertNode(entry: MemoryEntry): void {
    const tags = parseTags(entry.metadata)
    this.#upsertNodeStatement.run({
      $id: entry.id,
      $agent: entry.agent,
      $slug: entry.slug,
      $content: entry.content,
      $createdAt: entry.createdAt,
      $pinned: entry.pinned ? 1 : 0,
      $metadata: JSON.stringify(entry.metadata),
      $tags: JSON.stringify(tags),
    })
  }

  #removeNode(id: string): void {
    this.#db.prepare("DELETE FROM graph_edges WHERE from_id = $id OR to_id = $id").run({ $id: id })
    this.#db.prepare("DELETE FROM graph_nodes WHERE id = $id").run({ $id: id })
  }

  #listNodes(agent: string): StoredNode[] {
    const rows = this.#db
      .prepare<GraphNodeRow, { $agent: string }>(
        "SELECT id, agent_id, slug, content, created_at, pinned, metadata_json, tags_json FROM graph_nodes WHERE agent_id = $agent",
      )
      .all({ $agent: agent }) as GraphNodeRow[]

    return rows.map((row) => ({
      id: row.id,
      agent: row.agent_id,
      slug: row.slug,
      content: row.content,
      createdAt: row.created_at,
      pinned: row.pinned !== 0,
      metadata: JSON.parse(row.metadata_json) as Record<string, string>,
      tags: JSON.parse(row.tags_json) as string[],
    }))
  }

  #edgesBySource(agent: string): Map<string, GraphEdgeRow[]> {
    const rows = this.#db
      .prepare<GraphEdgeRow, { $agent: string }>(
        "SELECT agent_id, from_id, to_id, weight FROM graph_edges WHERE agent_id = $agent",
      )
      .all({ $agent: agent }) as GraphEdgeRow[]

    const edgesBySource = new Map<string, GraphEdgeRow[]>()
    for (const row of rows) {
      const existing = edgesBySource.get(row.from_id)
      if (existing) {
        existing.push(row)
        continue
      }
      edgesBySource.set(row.from_id, [row])
    }
    return edgesBySource
  }

  #rebuildEdgesForNode(agent: string, nodeId: string, tags: string[]): void {
    this.#db.prepare("DELETE FROM graph_edges WHERE agent_id = $agent AND (from_id = $id OR to_id = $id)").run({
      $agent: agent,
      $id: nodeId,
    })

    const otherNodes = this.#db
      .prepare<GraphNodeRow, { $agent: string; $id: string }>(
        "SELECT id, agent_id, slug, content, created_at, pinned, metadata_json, tags_json FROM graph_nodes WHERE agent_id = $agent AND id != $id",
      )
      .all({ $agent: agent, $id: nodeId }) as GraphNodeRow[]

    const insertEdge = this.#db.prepare(
      `INSERT OR REPLACE INTO graph_edges (agent_id, from_id, to_id, weight)
       VALUES ($agent, $fromId, $toId, $weight)`,
    )

    const transaction = this.#db.transaction((rows: GraphNodeRow[]) => {
      for (const row of rows) {
        const otherTags = JSON.parse(row.tags_json) as string[]
        const sharedTags = overlapCount(tags, otherTags)
        if (sharedTags === 0) {
          continue
        }

        insertEdge.run({ $agent: agent, $fromId: nodeId, $toId: row.id, $weight: sharedTags })
        insertEdge.run({ $agent: agent, $fromId: row.id, $toId: nodeId, $weight: sharedTags })
      }
    })

    transaction(otherNodes)
  }

  #upsertCandidate(
    candidateScores: Map<string, { entry: MemoryEntry; score: number; depth: number }>,
    entry: MemoryEntry,
    score: number,
    depth: number,
  ): void {
    const existing = candidateScores.get(entry.id)
    if (!existing || score > existing.score) {
      candidateScores.set(entry.id, { entry, score, depth })
    }
  }
}
