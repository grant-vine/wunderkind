import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { generateCorpus, type CorpusEntry, type CorpusResult, type LatestTruthPair, type WeakSeedPair } from "../../generators/codebase-corpus.js"
import {
  emptyBenchmarkMetrics,
  scoreBenchmarkMetrics,
  type BenchmarkMetrics,
  type GraphNeighborhoodCase,
  type RankedRetrievalCase,
  type SupersedeCase,
  type WrongAgentLeakageCase,
} from "../../harness/score.js"
import { LocalVecGraphAdapter } from "./adapter.js"

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

const LOCAL_VEC_MODEL = "Xenova/e5-small-v2"
const DATASET_ID = "primary-synthetic-codebase-analysis"
const CANDIDATE = "local-vec-graph"
const SCALE = "large"

function runtimeLabel(): string {
  return `${process.release.name} ${process.version}`
}

function isLikelyModelCached(model: string): boolean {
  const normalized = `models--${model.replace(/\//g, "--")}`
  const candidates = [
    path.join(homedir(), ".cache", "huggingface", "hub", normalized),
    path.join(process.cwd(), ".cache", "huggingface", "hub", normalized),
    path.join(process.cwd(), ".cache", normalized),
  ]
  return candidates.some((candidate) => existsSync(candidate))
}

function createArtifact(metrics: BenchmarkMetrics, options?: { skippedReason?: string }): BenchmarkArtifact {
  const skippedReason = options?.skippedReason ?? null
  return {
    candidate: CANDIDATE,
    dataset: DATASET_ID,
    timestamp: new Date().toISOString(),
    environment: {
      os: process.platform,
      arch: process.arch,
      runtime: runtimeLabel(),
      external_services: [],
    },
    metrics,
    degraded: false,
    degraded_reason: null,
    skipped: skippedReason !== null,
    skipped_reason: skippedReason,
  }
}

function toBenchMemory(entry: CorpusEntry) {
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

async function ingestCorpus(corpus: CorpusResult, adapter: LocalVecGraphAdapter): Promise<void> {
  for (const entry of corpus.entries) {
    await adapter.write(entry.agent, toBenchMemory(entry))
  }
}

function relationshipPairs(weakSeedPairs: WeakSeedPair[]): WeakSeedPair[] {
  return weakSeedPairs.filter((pair) => pair.id.endsWith("-support") || pair.id.endsWith("-relationship"))
}

function wrongAgentLeakagePairs(weakSeedPairs: WeakSeedPair[], wrongAgentEntries: CorpusEntry[]): WeakSeedPair[] {
  const wrongAgents = new Set(wrongAgentEntries.map((entry) => entry.agent))
  return weakSeedPairs.filter((pair) => !wrongAgents.has(pair.agent))
}

async function buildWeakSeedCases(
  adapter: LocalVecGraphAdapter,
  pairs: WeakSeedPair[],
  mode: "semantic" | "graph",
): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    pairs.map(async (pair) => {
      const results = mode === "semantic"
        ? await adapter.semanticSearch(pair.agent, pair.query)
        : await adapter.search(pair.agent, pair.query)

      return {
        expectedEntryId: pair.expectedEntryId,
        resultEntryIds: results.map((result) => result.slug),
      }
    }),
  )
}

async function buildGraphNeighborhoodCases(
  adapter: LocalVecGraphAdapter,
  pairs: WeakSeedPair[],
): Promise<GraphNeighborhoodCase[]> {
  return Promise.all(
    pairs.map(async (pair) => {
      const detailed = await adapter.searchWithGraph(pair.agent, pair.query)
      const neighborhoodIds = new Set<string>([
        ...detailed.expandedNeighborhood.map((entry) => entry.slug),
        ...detailed.results.map((entry) => entry.slug),
      ])
      return {
        goldInExpandedNeighborhood: neighborhoodIds.has(pair.expectedEntryId),
      }
    }),
  )
}

async function buildSupersedeCases(adapter: LocalVecGraphAdapter, pairs: LatestTruthPair[]): Promise<SupersedeCase[]> {
  return Promise.all(
    pairs.map(async (pair) => ({
      olderEntryId: pair.olderEntryId,
      newerEntryId: pair.newerEntryId,
      resultEntryIds: (await adapter.search(pair.agent, pair.query)).map((result) => result.slug),
    })),
  )
}

async function buildWrongAgentLeakageCases(
  adapter: LocalVecGraphAdapter,
  pairs: WeakSeedPair[],
  wrongAgentEntries: CorpusEntry[],
): Promise<WrongAgentLeakageCase[]> {
  const wrongEntryIds = wrongAgentEntries.map((entry) => entry.id)
  return Promise.all(
    pairs.map(async (pair) => ({
      wrongEntryIds,
      resultEntryIds: (await adapter.search(pair.agent, pair.query)).map((result) => result.slug),
    })),
  )
}

function printMetric(label: string, value: number | null): void {
  const formatted = value === null ? "n/a" : value.toFixed(3)
  console.log(`- ${label}: ${formatted}`)
}

async function runBenchmark(): Promise<BenchmarkArtifact> {
  if (!isLikelyModelCached(LOCAL_VEC_MODEL)) {
    const skippedMetrics: BenchmarkMetrics = {
      ...emptyBenchmarkMetrics(),
      graph_weak_seed_hit_at_1: 0,
      gold_in_expanded_neighborhood: 0,
    }
    return createArtifact(skippedMetrics, { skippedReason: "embedding model not cached" })
  }

  const projectDir = await mkdtemp(path.join(tmpdir(), "wunderkind-bench-local-vec-graph-"))
  const corpus = generateCorpus({ scale: SCALE })
  const adapter = new LocalVecGraphAdapter({
    baseDir: path.join(projectDir, ".wunderkind", "local-vec-graph", "index"),
    graphDbPath: path.join(projectDir, ".wunderkind", "local-vec-graph", "graph.db"),
    model: LOCAL_VEC_MODEL,
    vectorSize: 384,
    queryPrefix: "query: ",
    maxHops: 2,
    resultLimit: 10,
  })

  try {
    await ingestCorpus(corpus, adapter)

    const weakSeedBaseline = await buildWeakSeedCases(adapter, corpus.weakSeedQueryPairs, "semantic")
    const weakSeedGraph = await buildWeakSeedCases(adapter, corpus.weakSeedQueryPairs, "graph")
    const graphNeighborhoodCases = await buildGraphNeighborhoodCases(adapter, corpus.weakSeedQueryPairs)
    const chainCases = await buildWeakSeedCases(adapter, relationshipPairs(corpus.weakSeedQueryPairs), "graph")
    const supersedeCases = await buildSupersedeCases(adapter, corpus.latestTruthPairs)
    const leakageCases = await buildWrongAgentLeakageCases(
      adapter,
      wrongAgentLeakagePairs(corpus.weakSeedQueryPairs, corpus.wrongAgentContaminationSet),
      corpus.wrongAgentContaminationSet,
    )

    const metrics = scoreBenchmarkMetrics({
      weakSeedHitAt1Cases: weakSeedBaseline,
      graphWeakSeedHitAt1Cases: weakSeedGraph,
      goldInExpandedNeighborhoodCases: graphNeighborhoodCases,
      chainHitAt3Cases: chainCases,
      supersedeCases,
      wrongAgentLeakageCases: leakageCases,
    })

    return createArtifact(metrics)
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  console.log("Wunderkind local-vec + graph supplement benchmark")
  console.log(`candidate: ${CANDIDATE}`)
  console.log(`dataset: ${DATASET_ID}`)
  console.log(`model: ${LOCAL_VEC_MODEL}`)

  const artifact = await runBenchmark()

  if (artifact.skipped) {
    console.log(`status: skipped (${artifact.skipped_reason ?? "unknown"})`)
  } else {
    console.log("status: completed")
    printMetric("weak_seed_hit_at_1 (baseline local-vec)", artifact.metrics.weak_seed_hit_at_1)
    printMetric("graph_weak_seed_hit_at_1", artifact.metrics.graph_weak_seed_hit_at_1)
    printMetric("gold_in_expanded_neighborhood", artifact.metrics.gold_in_expanded_neighborhood)
    printMetric("chain_hit_at_3", artifact.metrics.chain_hit_at_3)
    printMetric("supersede_win_rate", artifact.metrics.supersede_win_rate)
    printMetric("wrong_agent_leakage_rate", artifact.metrics.wrong_agent_leakage_rate)
  }

  console.log("artifact:")
  console.log(JSON.stringify(artifact, null, 2))
}

await main()
