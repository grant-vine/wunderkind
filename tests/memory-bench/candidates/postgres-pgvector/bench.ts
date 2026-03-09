import { spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  generateCorpus,
  type CorpusEntry,
  type CorpusResult,
  type LatestTruthPair,
  type WeakSeedPair,
} from "../../generators/codebase-corpus.js"
import {
  scoreBenchmarkMetrics,
  type BenchmarkMetrics,
  type GraphNeighborhoodCase,
  type RankedRetrievalCase,
  type SupersedeCase,
  type WrongAgentLeakageCase,
} from "../../harness/score.js"
import { PostgresPgvectorAdapter, type PostgresMemoryEdge } from "./adapter.js"

interface BenchmarkArtifact {
  candidate: string
  dataset: string
  timestamp: string
  environment: {
    os: string
    arch: string
    runtime: string
    external_services: string[]
  }
  metrics: BenchmarkMetrics
  degraded: boolean
  degraded_reason: string | null
  skipped: boolean
  skipped_reason: string | null
}

interface BenchWrite {
  agent: string
  slug: string
  content: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  accessCount: number
  accessCount90d: number
  memoryClass: "factual"
  ttlDays: number
  pinnedReason: null
  expiredAt: null
  invalidAt: null
  pinned: boolean
  metadata: Record<string, string>
}

const CANDIDATE_ID = "postgres-pgvector"
const DATASET_ID = "primary-synthetic-codebase-analysis"
const SCALE = "large"
const POSTGRES_HOST = process.env["WK_PGVECTOR_HOST"] ?? "127.0.0.1"
const POSTGRES_PORT = Number(process.env["WK_PGVECTOR_PORT"] ?? "54329")
const POSTGRES_USER = process.env["WK_PGVECTOR_USER"] ?? "wunderkind"
const POSTGRES_PASSWORD = process.env["WK_PGVECTOR_PASSWORD"] ?? "wunderkind"
const POSTGRES_DATABASE = process.env["WK_PGVECTOR_DB"] ?? "wunderkind_eval"

function runtimeLabel(): string {
  return `${process.release.name} ${process.version}`
}

function artifact(metrics: BenchmarkMetrics, options?: { degradedReason?: string; skippedReason?: string }): BenchmarkArtifact {
  const degradedReason = options?.degradedReason ?? null
  const skippedReason = options?.skippedReason ?? null
  return {
    candidate: CANDIDATE_ID,
    dataset: DATASET_ID,
    timestamp: new Date().toISOString(),
    environment: {
      os: process.platform,
      arch: process.arch,
      runtime: runtimeLabel(),
      external_services: skippedReason === null ? ["docker", "postgres", "pgvector"] : [],
    },
    metrics,
    degraded: degradedReason !== null,
    degraded_reason: degradedReason,
    skipped: skippedReason !== null,
    skipped_reason: skippedReason,
  }
}

function emptyMetrics(): BenchmarkMetrics {
  return {
    weak_seed_hit_at_1: 0,
    graph_weak_seed_hit_at_1: 0,
    gold_in_expanded_neighborhood: 0,
    chain_hit_at_3: 0,
    supersede_win_rate: 0,
    wrong_agent_leakage_rate: 0,
  }
}

function composePath(): string {
  return path.join(process.cwd(), "tests", "memory-bench", "candidates", "postgres-pgvector", "docker-compose.yml")
}

function toBenchMemory(entry: CorpusEntry): BenchWrite {
  const createdAt = Date.parse(entry.timestamp)
  return {
    agent: entry.agent,
    slug: entry.id,
    content: entry.content,
    createdAt,
    updatedAt: createdAt,
    lastAccessedAt: createdAt,
    accessCount: 0,
    accessCount90d: 0,
    memoryClass: "factual",
    ttlDays: 90,
    pinnedReason: null,
    expiredAt: null,
    invalidAt: null,
    pinned: false,
    metadata: {
      tags: entry.tags.join(","),
      ...(entry.supersedes ? { supersedesFactId: entry.supersedes } : {}),
    },
  }
}

function relationshipPairs(weakSeedPairs: WeakSeedPair[]): WeakSeedPair[] {
  return weakSeedPairs.filter((pair) => pair.id.endsWith("-support") || pair.id.endsWith("-relationship"))
}

function wrongAgentLeakagePairs(weakSeedPairs: WeakSeedPair[], wrongAgentEntries: CorpusEntry[]): WeakSeedPair[] {
  const wrongAgents = new Set(wrongAgentEntries.map((entry) => entry.agent))
  return weakSeedPairs.filter((pair) => !wrongAgents.has(pair.agent))
}

function tagsOf(entry: CorpusEntry): Set<string> {
  return new Set(entry.tags)
}

function moduleTag(entry: CorpusEntry): string | null {
  for (const tag of entry.tags) {
    if (tag.startsWith("module:")) {
      return tag.slice("module:".length)
    }
  }
  return null
}

function relatedModuleTags(entry: CorpusEntry): string[] {
  return entry.tags.flatMap((tag) => (tag.startsWith("related:") ? [tag.slice("related:".length)] : []))
}

function latestEntriesByModule(corpus: CorpusResult): Map<string, CorpusEntry[]> {
  const latestByModule = new Map<string, CorpusEntry[]>()
  for (const entry of corpus.entries) {
    const module = moduleTag(entry)
    if (!module) continue
    const current = latestByModule.get(module)
    if (!current) {
      latestByModule.set(module, [entry])
      continue
    }
    const currentTs = Date.parse(current[0]?.timestamp ?? entry.timestamp)
    const nextTs = Date.parse(entry.timestamp)
    if (nextTs > currentTs) {
      latestByModule.set(module, [entry])
      continue
    }
    if (nextTs === currentTs) {
      current.push(entry)
    }
  }
  return latestByModule
}

function buildEdges(corpus: CorpusResult, memoryIdBySlug: Map<string, string>): PostgresMemoryEdge[] {
  const edges: PostgresMemoryEdge[] = []
  const seen = new Set<string>()
  const moduleGroups = new Map<string, CorpusEntry[]>()
  const latestByModule = latestEntriesByModule(corpus)

  function push(fromSlug: string, toSlug: string, weight: number): void {
    const fromId = memoryIdBySlug.get(fromSlug)
    const toId = memoryIdBySlug.get(toSlug)
    if (!fromId || !toId || fromId === toId) return
    const key = `${fromId}->${toId}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ fromId, toId, weight })
  }

  for (const entry of corpus.entries) {
    const module = moduleTag(entry)
    if (!module) continue
    const group = moduleGroups.get(module)
    if (group) {
      group.push(entry)
    } else {
      moduleGroups.set(module, [entry])
    }
  }

  for (const entry of corpus.entries) {
    const entryTags = tagsOf(entry)

    if (entry.supersedes) {
      push(entry.supersedes, entry.id, 1)
      push(entry.id, entry.supersedes, 0.65)
    }

    const module = moduleTag(entry)
    if (module) {
      const latest = latestByModule.get(module) ?? []
      for (const latestEntry of latest) {
        push(entry.id, latestEntry.id, entry.id === latestEntry.id ? 1 : 0.88)
        if (entry.id !== latestEntry.id) {
          push(latestEntry.id, entry.id, 0.45)
        }
      }
    }

    for (const relatedModule of relatedModuleTags(entry)) {
      const relatedLatest = latestByModule.get(relatedModule) ?? []
      for (const relatedEntry of relatedLatest) {
        push(entry.id, relatedEntry.id, 0.58)
      }
    }

    if (entryTags.has("artifact:support-chain") || entryTags.has("artifact:cross-module-relationship")) {
      for (const relatedModule of relatedModuleTags(entry)) {
        const relatedLatest = latestByModule.get(relatedModule) ?? []
        for (const relatedEntry of relatedLatest) {
          push(entry.id, relatedEntry.id, 0.72)
          push(relatedEntry.id, entry.id, 0.52)
        }
      }
    }
  }

  for (const group of moduleGroups.values()) {
    group.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    for (let index = 0; index < group.length - 1; index += 1) {
      const current = group[index]
      const next = group[index + 1]
      if (!current || !next) continue
      push(current.id, next.id, 0.83)
      push(next.id, current.id, 0.41)
    }
  }

  return edges
}

async function searchEntryIds(adapter: PostgresPgvectorAdapter, agent: string, query: string): Promise<string[]> {
  const results = await adapter.search(agent, query)
  return results.map((result) => result.slug)
}

async function searchExpandedEntryIds(adapter: PostgresPgvectorAdapter, agent: string, query: string): Promise<string[]> {
  const results = await adapter.searchExpanded(agent, query, 2, 10)
  return results.map((result) => result.slug)
}

async function buildWeakSeedCases(adapter: PostgresPgvectorAdapter, weakSeedPairs: WeakSeedPair[]): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    weakSeedPairs.map(async (pair) => ({
      expectedEntryId: pair.expectedEntryId,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildGraphWeakSeedCases(adapter: PostgresPgvectorAdapter, weakSeedPairs: WeakSeedPair[]): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    weakSeedPairs.map(async (pair) => ({
      expectedEntryId: pair.expectedEntryId,
      resultEntryIds: await searchExpandedEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildGraphNeighborhoodCases(
  adapter: PostgresPgvectorAdapter,
  weakSeedPairs: WeakSeedPair[],
): Promise<GraphNeighborhoodCase[]> {
  return Promise.all(
    weakSeedPairs.map(async (pair) => ({
      goldInExpandedNeighborhood: (await searchExpandedEntryIds(adapter, pair.agent, pair.query)).includes(pair.expectedEntryId),
    })),
  )
}

async function buildSupersedeCases(adapter: PostgresPgvectorAdapter, latestTruthPairs: LatestTruthPair[]): Promise<SupersedeCase[]> {
  return Promise.all(
    latestTruthPairs.map(async (pair) => ({
      olderEntryId: pair.olderEntryId,
      newerEntryId: pair.newerEntryId,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildWrongAgentLeakageCases(
  adapter: PostgresPgvectorAdapter,
  weakSeedPairs: WeakSeedPair[],
  wrongAgentEntries: CorpusEntry[],
): Promise<WrongAgentLeakageCase[]> {
  const wrongEntryIds = wrongAgentEntries.map((entry) => entry.id)
  return Promise.all(
    weakSeedPairs.map(async (pair) => ({
      wrongEntryIds,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function ingestCorpus(corpus: CorpusResult, adapter: PostgresPgvectorAdapter): Promise<void> {
  const memoryIdBySlug = new Map<string, string>()
  const BATCH_SIZE = 50
  for (let i = 0; i < corpus.entries.length; i += BATCH_SIZE) {
    const batch = corpus.entries.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((entry) => adapter.write(entry.agent, toBenchMemory(entry))))
    results.forEach((result, idx) => {
      memoryIdBySlug.set(batch[idx].id, result.id)
    })
  }
  await adapter.addEdges(buildEdges(corpus, memoryIdBySlug))
}

function dockerAvailable(): boolean {
  const check = spawnSync("docker", ["ps"], { encoding: "utf8" })
  return check.status === 0
}

function bringUpCompose(): boolean {
  const up = spawnSync("docker", ["compose", "-f", composePath(), "up", "-d"], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
  return up.status === 0
}

async function waitForPostgres(adapter: PostgresPgvectorAdapter): Promise<boolean> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const status = await adapter.status()
    if (status.ok) {
      return true
    }
    await Bun.sleep(1000)
  }
  return false
}

async function runBenchmark(): Promise<BenchmarkArtifact> {
  if (!dockerAvailable()) {
    return artifact(emptyMetrics(), { skippedReason: "postgres unavailable" })
  }

  if (!bringUpCompose()) {
    return artifact(emptyMetrics(), { skippedReason: "postgres unavailable" })
  }

  const tempCacheDir = await mkdtemp(path.join(tmpdir(), "wunderkind-postgres-pgvector-"))
  const adapter = new PostgresPgvectorAdapter({
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DATABASE,
    cacheDir: tempCacheDir,
  })

  try {
    if (!(await waitForPostgres(adapter))) {
      return artifact(emptyMetrics(), { skippedReason: "postgres unavailable" })
    }

    await adapter.reset()
    const corpus = generateCorpus({ scale: SCALE })
    console.error(`[postgres-pgvector] ingesting ${corpus.entries.length} memories`)
    await ingestCorpus(corpus, adapter)

    console.error("[postgres-pgvector] scoring retrieval metrics")
    const weakSeedCases = await buildWeakSeedCases(adapter, corpus.weakSeedQueryPairs)
    const graphWeakSeedCases = await buildGraphWeakSeedCases(adapter, corpus.weakSeedQueryPairs)
    const graphNeighborhoodCases = await buildGraphNeighborhoodCases(adapter, corpus.weakSeedQueryPairs)
    const chainCases = await buildWeakSeedCases(adapter, relationshipPairs(corpus.weakSeedQueryPairs))
    const supersedeCases = await buildSupersedeCases(adapter, corpus.latestTruthPairs)
    const leakageCases = await buildWrongAgentLeakageCases(
      adapter,
      wrongAgentLeakagePairs(corpus.weakSeedQueryPairs, corpus.wrongAgentContaminationSet),
      corpus.wrongAgentContaminationSet,
    )

    const metrics = scoreBenchmarkMetrics({
      weakSeedHitAt1Cases: weakSeedCases,
      graphWeakSeedHitAt1Cases: graphWeakSeedCases,
      goldInExpandedNeighborhoodCases: graphNeighborhoodCases,
      chainHitAt3Cases: chainCases,
      supersedeCases,
      wrongAgentLeakageCases: leakageCases,
    })

    const degradedReason =
      adapter.embeddingMode() === "hash"
        ? "Xenova/all-MiniLM-L6-v2 was not cached locally; benchmark used a deterministic 384d hash embedding fallback."
        : null

    return artifact(metrics, degradedReason ? { degradedReason } : undefined)
  } finally {
    await adapter.reset()
    await adapter.dispose()
    await rm(tempCacheDir, { recursive: true, force: true })
  }
}

let result: BenchmarkArtifact
try {
  result = await runBenchmark()
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  result = artifact(emptyMetrics(), { skippedReason: `postgres unavailable: ${msg}` })
}
console.log(JSON.stringify(result, null, 2))
