import { mkdirSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Database } from "bun:sqlite"
import { FileAdapter } from "../../../../src/memory/adapters/file.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "../../../../src/memory/adapters/types.js"

interface EntryNodeRow {
  memory_id: string
  agent: string
  slug: string
  created_at: number
  tags: string
  supersedes_slug: string | null
}

interface NeighborRow {
  memory_id: string
  slug: string
  created_at: number
}

interface AdjacencyRow {
  to_id: string
  weight: number
}

interface SearchCandidate {
  entry: MemoryEntry
  score: number
  depth: number
}

export interface BenchmarkSeedEntry {
  agent: string
  slug: string
  content: string
  createdAt: number
  pinned: boolean
  metadata: Record<string, string>
}

export interface GraphSearchResult {
  baseResults: MemoryEntry[]
  rankedResults: MemoryEntry[]
  expandedNeighborhood: MemoryEntry[]
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entry_nodes (
  memory_id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  supersedes_slug TEXT
);
CREATE INDEX IF NOT EXISTS idx_entry_nodes_agent_slug ON entry_nodes(agent, slug);
CREATE INDEX IF NOT EXISTS idx_entry_nodes_agent_created ON entry_nodes(agent, created_at DESC);

CREATE TABLE IF NOT EXISTS entry_tags (
  memory_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_entry_tags_agent_tag ON entry_tags(agent, tag);

CREATE TABLE IF NOT EXISTS adjacency (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_adjacency_from ON adjacency(from_id);
CREATE INDEX IF NOT EXISTS idx_adjacency_to ON adjacency(to_id);
`

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "but",
  "can",
  "could",
  "does",
  "done",
  "first",
  "follow",
  "from",
  "gets",
  "have",
  "how",
  "into",
  "its",
  "lean",
  "leans",
  "more",
  "most",
  "need",
  "needs",
  "now",
  "real",
  "should",
  "sit",
  "sits",
  "still",
  "that",
  "the",
  "their",
  "them",
  "through",
  "today",
  "underneath",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "work",
])

const MAX_RESULTS = 10
const MAX_NEIGHBORHOOD = 32
const MAX_SEEDS = 4

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+/g)
  if (!matches) {
    return []
  }

  return matches.filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

function uniqueTags(rawTags: string): string[] {
  return Array.from(
    new Set(
      rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.startsWith("module:") || tag.startsWith("related:")),
    ),
  )
}

function lexicalScore(query: string, entry: MemoryEntry): number {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) {
    return 0
  }

  const haystack = `${entry.slug} ${entry.content}`.toLowerCase()
  let overlap = 0
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      overlap += 1
    }
  }

  if (overlap === 0) {
    return 0
  }

  const exactSlugBonus = entry.slug.toLowerCase() === query.trim().toLowerCase() ? 6 : 0
  return overlap / queryTokens.length + exactSlugBonus
}

function recencyBoost(createdAt: number, newestCreatedAt: number): number {
  if (newestCreatedAt <= 0) {
    return 0
  }

  const ageHours = Math.max(0, newestCreatedAt - createdAt) / (1000 * 60 * 60)
  return 1 / (1 + ageHours / 48)
}

export class FileGraphCandidateAdapter implements MemoryAdapter {
  #file: FileAdapter
  #db: Database
  #memoryDir: string
  #cache = new Map<string, MemoryEntry[]>()

  constructor(projectDir: string) {
    this.#file = new FileAdapter(projectDir)
    this.#memoryDir = path.join(projectDir, ".wunderkind", "memory")
    const dbPath = path.join(projectDir, ".wunderkind", "memory-graph.db")
    mkdirSync(path.dirname(dbPath), { recursive: true })
    this.#db = new Database(dbPath, { create: true })
    this.#db.prepare("PRAGMA journal_mode = WAL").run()
    this.#db.prepare("PRAGMA foreign_keys = ON").run()
    this.#db.run(SCHEMA)
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    return this.#entriesForAgent(agent)
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    const written = await this.#file.write(agent, entry)
    const existing = await this.#entriesForAgent(agent)
    this.#cache.set(agent, [...existing, written])
    this.#indexEntry(written, entry.metadata)
    return written
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    return this.#file.update(id, content)
  }

  async delete(id: string): Promise<void> {
    this.#removeGraphEntry(id)
    await this.#file.delete(id)
  }

  async deleteAll(agent: string): Promise<void> {
    this.#db.prepare("DELETE FROM adjacency WHERE from_id IN (SELECT memory_id FROM entry_nodes WHERE agent = $agent) OR to_id IN (SELECT memory_id FROM entry_nodes WHERE agent = $agent)").run({ $agent: agent })
    this.#db.prepare("DELETE FROM entry_tags WHERE agent = $agent").run({ $agent: agent })
    this.#db.prepare("DELETE FROM entry_nodes WHERE agent = $agent").run({ $agent: agent })
    this.#cache.delete(agent)
    await this.#file.deleteAll(agent)
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const result = await this.searchWithGraph(agent, query)
    return result.rankedResults
  }

  async searchBase(agent: string, query: string): Promise<MemoryEntry[]> {
    const entries = await this.#entriesForAgent(agent)
    return exactTokenSearch(entries, query)
  }

  async searchWithGraph(agent: string, query: string): Promise<GraphSearchResult> {
    const entries = await this.#entriesForAgent(agent)
    const entryMap = new Map(entries.map((entry) => [entry.id, entry]))
    const newestCreatedAt = entries.reduce((max, entry) => Math.max(max, entry.createdAt), 0)
    const baseResults = exactTokenSearch(entries, query)
    const relaxedSeeds = this.#relaxedSeeds(query, entries)
    const seedPool = new Map<string, SearchCandidate>()

    for (const [index, entry] of baseResults.entries()) {
      seedPool.set(entry.id, {
        entry,
        score: 8 - index + lexicalScore(query, entry) + recencyBoost(entry.createdAt, newestCreatedAt),
        depth: 0,
      })
    }

    for (const candidate of relaxedSeeds) {
      const existing = seedPool.get(candidate.entry.id)
      if (!existing || candidate.score > existing.score) {
        seedPool.set(candidate.entry.id, candidate)
      }
    }

    const rankedSeeds = Array.from(seedPool.values())
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return right.entry.createdAt - left.entry.createdAt
      })
      .slice(0, MAX_SEEDS)

    const ranked = new Map<string, SearchCandidate>()
    const expandedNeighborhood = new Map<string, MemoryEntry>()

    for (const seed of rankedSeeds) {
      const seedScore = seed.score + 4
      const existingSeed = ranked.get(seed.entry.id)
      if (!existingSeed || seedScore > existingSeed.score) {
        ranked.set(seed.entry.id, { entry: seed.entry, score: seedScore, depth: 0 })
      }
      expandedNeighborhood.set(seed.entry.id, seed.entry)

      const firstHop = this.#neighbors(seed.entry.id, 1)
      for (const neighbor of firstHop) {
        const entry = entryMap.get(neighbor.to_id)
        if (!entry) {
          continue
        }

        expandedNeighborhood.set(entry.id, entry)
        const score = seed.score + neighbor.weight * 2 + lexicalScore(query, entry) + recencyBoost(entry.createdAt, newestCreatedAt)
        const existing = ranked.get(entry.id)
        if (!existing || score > existing.score) {
          ranked.set(entry.id, { entry, score, depth: 1 })
        }

        const secondHop = this.#neighbors(neighbor.to_id, 2)
        for (const hop2 of secondHop) {
          if (hop2.to_id === seed.entry.id) {
            continue
          }

          const secondEntry = entryMap.get(hop2.to_id)
          if (!secondEntry) {
            continue
          }

          expandedNeighborhood.set(secondEntry.id, secondEntry)
          const secondScore =
            seed.score +
            neighbor.weight * 1.5 +
            hop2.weight +
            lexicalScore(query, secondEntry) +
            recencyBoost(secondEntry.createdAt, newestCreatedAt)
          const existingSecond = ranked.get(secondEntry.id)
          if (!existingSecond || secondScore > existingSecond.score) {
            ranked.set(secondEntry.id, { entry: secondEntry, score: secondScore, depth: 2 })
          }
        }
      }
    }

    const rankedResults = Array.from(ranked.values())
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }
        if (left.depth !== right.depth) {
          return left.depth - right.depth
        }
        return right.entry.createdAt - left.entry.createdAt
      })
      .slice(0, MAX_RESULTS)
      .map((candidate) => candidate.entry)

    return {
      baseResults,
      rankedResults,
      expandedNeighborhood: Array.from(expandedNeighborhood.values()).slice(0, MAX_NEIGHBORHOOD),
    }
  }

  async history(id: string): Promise<HistoryEntry[]> {
    return this.#file.history(id)
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    return this.#file.analyzeStale(agent)
  }

  async prune(agent: string, idsToRemove: string[]): Promise<number> {
    for (const id of idsToRemove) {
      this.#removeGraphEntry(id)
    }

    return this.#file.prune(agent, idsToRemove)
  }

  async count(agent: string): Promise<MemoryCount> {
    return this.#file.count(agent)
  }

  async listAgents(): Promise<string[]> {
    return this.#file.listAgents()
  }

  async status(): Promise<{ ok: boolean; message: string }> {
    try {
      this.#db.query("SELECT 1").get()
      return { ok: true, message: "file+graph candidate ready" }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
  }

  #entriesForAgent(agent: string): Promise<MemoryEntry[]> {
    return this.#mergeNodeTimestamps(agent)
  }

  async #mergeNodeTimestamps(agent: string): Promise<MemoryEntry[]> {
    const cached = this.#cache.get(agent)
    const entries = cached ? cached : await this.#file.read(agent)
    const stmt = this.#db.prepare<EntryNodeRow, { $agent: string }>(
      "SELECT memory_id, agent, slug, created_at, tags, supersedes_slug FROM entry_nodes WHERE agent = $agent",
    )
    const rows = stmt.all({ $agent: agent }) as EntryNodeRow[]
    const createdAtById = new Map(rows.map((row) => [row.memory_id, row.created_at]))
    const merged = entries.map((entry) => ({
      ...entry,
      createdAt: createdAtById.get(entry.id) ?? entry.createdAt,
    }))
    this.#cache.set(agent, merged)
    return merged
  }

  async seedCorpus(entries: BenchmarkSeedEntry[]): Promise<void> {
    const grouped = new Map<string, BenchmarkSeedEntry[]>()
    for (const entry of entries) {
      const existing = grouped.get(entry.agent) ?? []
      existing.push(entry)
      grouped.set(entry.agent, existing)
    }

    mkdirSync(this.#memoryDir, { recursive: true })
    for (const [agent, agentEntries] of grouped) {
      const sortedEntries = [...agentEntries].sort((left, right) => left.createdAt - right.createdAt)
      const filePath = path.join(this.#memoryDir, `${agent}.md`)
      const frontmatter = this.#frontmatter(agent)
      const memoryEntries: MemoryEntry[] = sortedEntries.map((entry) => ({
        id: entry.slug,
        agent: entry.agent,
        slug: entry.slug,
        content: entry.content,
        createdAt: entry.createdAt,
        pinned: entry.pinned,
        metadata: entry.metadata,
      }))
      const sections = memoryEntries.map((entry) => this.#formatSection(entry))
      const fileContent = sections.length === 0 ? frontmatter : `${frontmatter}\n\n${sections.join("\n\n")}`
      await writeFile(filePath, fileContent, "utf-8")
      this.#cache.set(agent, memoryEntries)
      const tx = this.#db.transaction(() => {
        for (const entry of memoryEntries) {
          this.#indexEntry(entry, entry.metadata)
        }
      })
      tx()
    }
  }

  #indexEntry(entry: MemoryEntry, metadata: Record<string, string>): void {
    const tags = uniqueTags(metadata.tags ?? "")
    const supersedesSlug = metadata.supersedesFactId ?? null
    this.#db.prepare(
      "INSERT OR REPLACE INTO entry_nodes (memory_id, agent, slug, created_at, tags, supersedes_slug) VALUES ($memoryId, $agent, $slug, $createdAt, $tags, $supersedesSlug)",
    ).run({
      $memoryId: entry.id,
      $agent: entry.agent,
      $slug: entry.slug,
      $createdAt: entry.createdAt,
      $tags: tags.join(","),
      $supersedesSlug: supersedesSlug,
    })

    this.#db.prepare("DELETE FROM entry_tags WHERE memory_id = $memoryId").run({ $memoryId: entry.id })
    for (const tag of tags) {
      this.#db.prepare("INSERT OR IGNORE INTO entry_tags (memory_id, agent, tag) VALUES ($memoryId, $agent, $tag)").run({
        $memoryId: entry.id,
        $agent: entry.agent,
        $tag: tag,
      })
    }

    const weights = new Map<string, number>()
    for (const tag of tags) {
      const stmt = this.#db.prepare<NeighborRow, { $agent: string; $tag: string; $memoryId: string }>(
        "SELECT n.memory_id, n.slug, n.created_at FROM entry_tags t JOIN entry_nodes n ON n.memory_id = t.memory_id WHERE t.agent = $agent AND t.tag = $tag AND n.memory_id != $memoryId",
      )
      const rows = stmt.all({ $agent: entry.agent, $tag: tag, $memoryId: entry.id }) as NeighborRow[]
      const increment = tag.startsWith("module:") ? 4 : 1.5
      for (const row of rows) {
        weights.set(row.memory_id, (weights.get(row.memory_id) ?? 0) + increment)
      }
    }

    if (supersedesSlug) {
      const stmt = this.#db.prepare<EntryNodeRow, { $agent: string; $slug: string }>(
        "SELECT memory_id, agent, slug, created_at, tags, supersedes_slug FROM entry_nodes WHERE agent = $agent AND slug = $slug LIMIT 1",
      )
      const previous = stmt.get({ $agent: entry.agent, $slug: supersedesSlug })
      if (previous) {
        weights.set(previous.memory_id, (weights.get(previous.memory_id) ?? 0) + 6)
      }
    }

    for (const [neighborId, weight] of weights) {
      this.#upsertEdge(entry.id, neighborId, weight)
      this.#upsertEdge(neighborId, entry.id, weight)
    }
  }

  #upsertEdge(fromId: string, toId: string, weight: number): void {
    this.#db.prepare(
      "INSERT INTO adjacency (from_id, to_id, weight) VALUES ($fromId, $toId, $weight) ON CONFLICT(from_id, to_id) DO UPDATE SET weight = CASE WHEN excluded.weight > adjacency.weight THEN excluded.weight ELSE adjacency.weight END",
    ).run({
      $fromId: fromId,
      $toId: toId,
      $weight: weight,
    })
  }

  #neighbors(memoryId: string, depth: 1 | 2): AdjacencyRow[] {
    const stmt = this.#db.prepare<AdjacencyRow, { $memoryId: string; $limit: number }>(
      "SELECT to_id, weight FROM adjacency WHERE from_id = $memoryId ORDER BY weight DESC LIMIT $limit",
    )
    const rows = stmt.all({ $memoryId: memoryId, $limit: depth === 1 ? MAX_NEIGHBORHOOD : MAX_NEIGHBORHOOD / 2 }) as AdjacencyRow[]
    return rows
  }

  #relaxedSeeds(query: string, entries: MemoryEntry[]): SearchCandidate[] {
    return entries
      .map((entry) => ({
        entry,
        score: lexicalScore(query, entry),
        depth: 0,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }
        return right.entry.createdAt - left.entry.createdAt
      })
      .slice(0, MAX_SEEDS * 2)
  }

  #removeGraphEntry(memoryId: string): void {
    this.#db.prepare("DELETE FROM adjacency WHERE from_id = $memoryId OR to_id = $memoryId").run({ $memoryId: memoryId })
    this.#db.prepare("DELETE FROM entry_tags WHERE memory_id = $memoryId").run({ $memoryId: memoryId })
    this.#db.prepare("DELETE FROM entry_nodes WHERE memory_id = $memoryId").run({ $memoryId: memoryId })
  }

  #frontmatter(agent: string): string {
    const date = new Date().toISOString().slice(0, 10)
    return ["---", `agent: ${agent}`, `compacted: ${date}`, "---"].join("\n")
  }

  #formatSection(entry: MemoryEntry): string {
    const date = new Date(entry.createdAt).toISOString().slice(0, 10)
    const pinnedLine = entry.pinned ? "\n> pinned" : ""
    return `## [${date}] ${entry.slug}\nid: ${entry.id}\n${entry.content}${pinnedLine}`
  }
}

function exactTokenSearch(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"))

  return entries.filter((entry) => {
    const text = `${entry.content} ${entry.slug}`
    return tokens.every((regex) => regex.test(text))
  })
}
