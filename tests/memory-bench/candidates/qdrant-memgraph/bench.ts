import type { MemoryEntry } from "../../../../src/memory/adapters/types.js"
import { generateCorpus, type CorpusEntry, type LatestTruthPair, type WeakSeedPair } from "../../generators/codebase-corpus.js"
import {
  emptyBenchmarkMetrics,
  scoreBenchmarkMetrics,
  type BenchmarkMetrics,
  type GraphNeighborhoodCase,
  type RankedRetrievalCase,
  type SupersedeCase,
  type WrongAgentLeakageCase,
} from "../../harness/score.js"
import { QdrantMemgraphAdapter, createQdrantMemgraphAdapter } from "./adapter.js"

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

interface RelationshipValidation {
  candidate: string
  timestamp: string
  skipped: boolean
  skipped_reason: string | null
  graph: {
    node_count: number
    edge_count: number
  }
  samples: Array<{
    pair_id: string
    expected_entry_id: string
    top_seed_id: string | null
    expanded_hit: boolean
    path_ids: string[] | null
  }>
}

const DATASET_ID = "primary-synthetic-codebase-analysis"
const CANDIDATE_ID = "qdrant-memgraph"
const EXTERNAL_SERVICES = ["qdrant@6334", "memgraph@7688"]
const SKIP_REASON = "qdrant or memgraph unavailable"

function runtimeLabel(): string {
  return `${process.release.name} ${process.version}`
}

function buildArtifact(metrics: BenchmarkMetrics, skipped: boolean, skippedReason: string | null): BenchmarkArtifact {
  return {
    candidate: CANDIDATE_ID,
    dataset: DATASET_ID,
    timestamp: new Date().toISOString(),
    environment: {
      os: process.platform,
      arch: process.arch,
      runtime: runtimeLabel(),
      external_services: EXTERNAL_SERVICES,
    },
    metrics,
    degraded: false,
    degraded_reason: null,
    skipped,
    skipped_reason: skippedReason,
  }
}

function relationshipPairs(pairs: WeakSeedPair[]): WeakSeedPair[] {
  return pairs.filter((pair) => pair.id.endsWith("-support") || pair.id.endsWith("-relationship"))
}

function wrongAgentLeakagePairs(weakSeedPairs: WeakSeedPair[], wrongAgentEntries: CorpusEntry[]): WeakSeedPair[] {
  const wrongAgents = new Set(wrongAgentEntries.map((entry) => entry.agent))
  return weakSeedPairs.filter((pair) => !wrongAgents.has(pair.agent))
}

function toMemoryEntry(entry: CorpusEntry): Omit<MemoryEntry, "id"> {
  return {
    agent: entry.agent,
    slug: entry.id,
    content: entry.content,
    createdAt: Date.parse(entry.timestamp),
    pinned: false,
    metadata: {
      tags: entry.tags.join(","),
      ...(entry.supersedes ? { supersedesFactId: entry.supersedes } : {}),
    },
  }
}

async function ingestCorpus(adapter: QdrantMemgraphAdapter, corpus: ReturnType<typeof generateCorpus>): Promise<void> {
  const BATCH_SIZE = 50
  for (let i = 0; i < corpus.entries.length; i += BATCH_SIZE) {
    const batch = corpus.entries.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map((entry) => adapter.write(entry.agent, toMemoryEntry(entry))))
  }
}

async function cleanupBenchAgents(adapter: QdrantMemgraphAdapter, corpus: ReturnType<typeof generateCorpus>): Promise<void> {
  const agents = new Set(corpus.entries.map((entry) => entry.agent))
  for (const agent of agents) {
    await adapter.deleteAll(agent)
  }
}

async function buildWeakSeedCases(adapter: QdrantMemgraphAdapter, pairs: WeakSeedPair[]): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    pairs.map(async (pair) => {
      const seeds = await adapter.searchSemanticSeeds(pair.agent, pair.query)
      return {
        expectedEntryId: pair.expectedEntryId,
        resultEntryIds: seeds.map((seed) => seed.entry.slug),
      }
    }),
  )
}

async function buildExpandedCases(adapter: QdrantMemgraphAdapter, pairs: WeakSeedPair[]): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    pairs.map(async (pair) => {
      const inspection = await adapter.inspectSearch(pair.agent, pair.query)
      return {
        expectedEntryId: pair.expectedEntryId,
        resultEntryIds: inspection.expandedResults.map((result) => result.slug),
      }
    }),
  )
}

async function buildExpandedNeighborhoodCases(
  adapter: QdrantMemgraphAdapter,
  pairs: WeakSeedPair[],
): Promise<GraphNeighborhoodCase[]> {
  return Promise.all(
    pairs.map(async (pair) => {
      const inspection = await adapter.inspectSearch(pair.agent, pair.query)
      return { goldInExpandedNeighborhood: inspection.expandedNeighborhoodIds.includes(pair.expectedEntryId) }
    }),
  )
}

async function buildSupersedeCases(adapter: QdrantMemgraphAdapter, pairs: LatestTruthPair[]): Promise<SupersedeCase[]> {
  return Promise.all(
    pairs.map(async (pair) => {
      const inspection = await adapter.inspectSearch(pair.agent, pair.query)
      return {
        olderEntryId: pair.olderEntryId,
        newerEntryId: pair.newerEntryId,
        resultEntryIds: inspection.expandedResults.map((result) => result.slug),
      }
    }),
  )
}

async function buildWrongAgentLeakageCases(
  adapter: QdrantMemgraphAdapter,
  pairs: WeakSeedPair[],
  wrongAgentEntries: CorpusEntry[],
): Promise<WrongAgentLeakageCase[]> {
  const wrongEntryIds = wrongAgentEntries.map((entry) => entry.id)
  return Promise.all(
    pairs.map(async (pair) => {
      const inspection = await adapter.inspectSearch(pair.agent, pair.query)
      return {
        wrongEntryIds,
        resultEntryIds: inspection.expandedResults.map((result) => result.slug),
      }
    }),
  )
}

async function runBenchmark(adapter: QdrantMemgraphAdapter): Promise<BenchmarkArtifact> {
  const status = await adapter.status()
  if (!status.ok) {
    return buildArtifact(emptyBenchmarkMetrics(), true, SKIP_REASON)
  }

  const corpus = generateCorpus({ scale: "large" })
  try {
    await cleanupBenchAgents(adapter, corpus)
    await ingestCorpus(adapter, corpus)

    const weakSeedCases = await buildWeakSeedCases(adapter, corpus.weakSeedQueryPairs)
    const graphWeakSeedCases = await buildExpandedCases(adapter, corpus.weakSeedQueryPairs)
    const graphNeighborhoodCases = await buildExpandedNeighborhoodCases(adapter, corpus.weakSeedQueryPairs)
    const chainCases = await buildExpandedCases(adapter, relationshipPairs(corpus.weakSeedQueryPairs))
    const supersedeCases = await buildSupersedeCases(adapter, corpus.latestTruthPairs)
    const leakageCases = await buildWrongAgentLeakageCases(
      adapter,
      wrongAgentLeakagePairs(corpus.weakSeedQueryPairs, corpus.wrongAgentContaminationSet),
      corpus.wrongAgentContaminationSet,
    )

    return buildArtifact(
      scoreBenchmarkMetrics({
        weakSeedHitAt1Cases: weakSeedCases,
        graphWeakSeedHitAt1Cases: graphWeakSeedCases,
        goldInExpandedNeighborhoodCases: graphNeighborhoodCases,
        chainHitAt3Cases: chainCases,
        supersedeCases,
        wrongAgentLeakageCases: leakageCases,
      }),
      false,
      null,
    )
  } finally {
    await cleanupBenchAgents(adapter, corpus)
  }
}

async function validateRelationships(adapter: QdrantMemgraphAdapter): Promise<RelationshipValidation> {
  const status = await adapter.status()
  if (!status.ok) {
    return {
      candidate: CANDIDATE_ID,
      timestamp: new Date().toISOString(),
      skipped: true,
      skipped_reason: SKIP_REASON,
      graph: { node_count: 0, edge_count: 0 },
      samples: [],
    }
  }

  const corpus = generateCorpus({ scale: "large" })
  const samples = relationshipPairs(corpus.weakSeedQueryPairs).slice(0, 5)

  try {
    await cleanupBenchAgents(adapter, corpus)
    await ingestCorpus(adapter, corpus)
    const graph = await adapter.graphStats()

    const validations = await Promise.all(
      samples.map(async (pair) => {
        const inspection = await adapter.inspectSearch(pair.agent, pair.query)
        const topSeedId = inspection.seedResults[0]?.slug ?? null
        return {
          pair_id: pair.id,
          expected_entry_id: pair.expectedEntryId,
          top_seed_id: topSeedId,
          expanded_hit: inspection.expandedNeighborhoodIds.includes(pair.expectedEntryId),
          path_ids:
            topSeedId === null ? null : await adapter.tracePath(pair.agent, topSeedId, pair.expectedEntryId),
        }
      }),
    )

    return {
      candidate: CANDIDATE_ID,
      timestamp: new Date().toISOString(),
      skipped: false,
      skipped_reason: null,
      graph: {
        node_count: graph.nodeCount,
        edge_count: graph.edgeCount,
      },
      samples: validations,
    }
  } finally {
    await cleanupBenchAgents(adapter, corpus)
  }
}

async function main(): Promise<void> {
  const adapter = createQdrantMemgraphAdapter()
  try {
    if (process.argv.includes("--validate-relationships")) {
      console.log(JSON.stringify(await validateRelationships(adapter), null, 2))
      return
    }

    console.log(JSON.stringify(await runBenchmark(adapter), null, 2))
  } finally {
    await adapter.close()
  }
}

await main()
