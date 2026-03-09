import { mkdir, writeFile } from "node:fs/promises"
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
import { QdrantNeo4jAdapter, type GraphSearchResult } from "./adapter.js"

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

interface PathValidationResult {
  pairId: string
  query: string
  expectedEntryId: string
  seedIds: string[]
  expandedIds: string[]
  resultEntryIds: string[]
  goldInExpandedNeighborhood: boolean
}

const CANDIDATE = "qdrant-neo4j"
const DATASET = "primary-synthetic-codebase-analysis"
const COLLECTION = "wunderkind-neo4j-eval"
const VECTOR_SIZE = 384
const QDRANT_URL = "http://127.0.0.1:6335"
const NEO4J_URL = "bolt://127.0.0.1:7689"
const EVIDENCE_DIR = path.join(process.cwd(), ".sisyphus", "evidence", "architecture-eval")
const RUN_EVIDENCE_PATH = path.join(EVIDENCE_DIR, "task-14-qdrant-neo4j-run.txt")
const PATH_EVIDENCE_PATH = path.join(EVIDENCE_DIR, "task-14-path-query-validation.txt")

function runtimeLabel(): string {
  return `${process.release.name} ${process.version}`
}

function buildArtifact(metrics: BenchmarkMetrics, skipped = false, skippedReason: string | null = null): BenchmarkArtifact {
  return {
    candidate: CANDIDATE,
    dataset: DATASET,
    timestamp: new Date().toISOString(),
    environment: {
      os: process.platform,
      arch: process.arch,
      runtime: runtimeLabel(),
      external_services: ["qdrant", "neo4j"],
    },
    metrics,
    degraded: false,
    degraded_reason: null,
    skipped,
    skipped_reason: skippedReason,
  }
}

function toMemoryEntry(entry: CorpusEntry) {
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

function relationshipPairs(weakSeedPairs: WeakSeedPair[]): WeakSeedPair[] {
  return weakSeedPairs.filter((pair) => pair.id.endsWith("-support") || pair.id.endsWith("-relationship"))
}

function wrongAgentLeakagePairs(weakSeedPairs: WeakSeedPair[], wrongAgentEntries: CorpusEntry[]): WeakSeedPair[] {
  const wrongAgents = new Set(wrongAgentEntries.map((entry) => entry.agent))
  return weakSeedPairs.filter((pair) => !wrongAgents.has(pair.agent))
}

async function ingestCorpus(adapter: QdrantNeo4jAdapter, corpus: CorpusResult): Promise<void> {
  const BATCH_SIZE = 50
  for (let i = 0; i < corpus.entries.length; i += BATCH_SIZE) {
    const batch = corpus.entries.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map((entry) => adapter.write(entry.agent, toMemoryEntry(entry))))
  }
}

async function searchEntryIds(adapter: QdrantNeo4jAdapter, agent: string, query: string): Promise<string[]> {
  const results = await adapter.search(agent, query)
  return results.map((result) => result.slug)
}

async function buildWeakSeedCases(adapter: QdrantNeo4jAdapter, weakSeedPairs: WeakSeedPair[]): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    weakSeedPairs.map(async (pair) => ({
      expectedEntryId: pair.expectedEntryId,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildGraphCases(
  adapter: QdrantNeo4jAdapter,
  weakSeedPairs: WeakSeedPair[],
): Promise<{ rankedCases: RankedRetrievalCase[]; neighborhoodCases: GraphNeighborhoodCase[]; validations: GraphSearchResult[] }> {
  const validations = await Promise.all(weakSeedPairs.map((pair) => adapter.graphSearch(pair.agent, pair.query)))
  const rankedCases = weakSeedPairs.map((pair, index) => ({
    expectedEntryId: pair.expectedEntryId,
    resultEntryIds: validations[index]?.resultEntryIds ?? [],
  }))
  const neighborhoodCases = weakSeedPairs.map((pair, index) => ({
    goldInExpandedNeighborhood: (validations[index]?.resultEntryIds ?? []).includes(pair.expectedEntryId),
  }))
  return { rankedCases, neighborhoodCases, validations }
}

async function buildSupersedeCases(adapter: QdrantNeo4jAdapter, latestTruthPairs: LatestTruthPair[]): Promise<SupersedeCase[]> {
  return Promise.all(
    latestTruthPairs.map(async (pair) => ({
      olderEntryId: pair.olderEntryId,
      newerEntryId: pair.newerEntryId,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildWrongAgentLeakageCases(
  adapter: QdrantNeo4jAdapter,
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

function formatRunEvidence(artifact: BenchmarkArtifact): string {
  return [
    `candidate: ${CANDIDATE}`,
    `dataset: ${DATASET}`,
    `qdrant_url: ${QDRANT_URL}`,
    `neo4j_url: ${NEO4J_URL}`,
    "neo4j_auth: none",
    "embedding: deterministic hash-based pseudo-embedding (384 dims)",
    `timestamp: ${artifact.timestamp}`,
    "artifact:",
    JSON.stringify(artifact, null, 2),
  ].join("\n")
}

function formatPathEvidence(result: PathValidationResult | null, skippedReason: string | null): string {
  if (skippedReason) {
    return [
      `candidate: ${CANDIDATE}`,
      `dataset: ${DATASET}`,
      `status: skipped`,
      `reason: ${skippedReason}`,
      "neo4j_auth: none",
      "embedding: deterministic hash-based pseudo-embedding (384 dims)",
    ].join("\n")
  }

  if (!result) {
    return [
      `candidate: ${CANDIDATE}`,
      `dataset: ${DATASET}`,
      "status: no validation pair available",
      "neo4j_auth: none",
      "embedding: deterministic hash-based pseudo-embedding (384 dims)",
    ].join("\n")
  }

  return [
    `candidate: ${CANDIDATE}`,
    `dataset: ${DATASET}`,
    `validation_pair: ${result.pairId}`,
    `query: ${result.query}`,
    `expected_entry_id: ${result.expectedEntryId}`,
    `seed_ids: ${JSON.stringify(result.seedIds)}`,
    `expanded_ids: ${JSON.stringify(result.expandedIds)}`,
    `result_entry_ids: ${JSON.stringify(result.resultEntryIds)}`,
    `gold_in_expanded_neighborhood: ${String(result.goldInExpandedNeighborhood)}`,
    "neo4j_auth: none",
    "embedding: deterministic hash-based pseudo-embedding (384 dims)",
  ].join("\n")
}

async function writeEvidence(runText: string, pathText: string): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true })
  await writeFile(RUN_EVIDENCE_PATH, runText, "utf8")
  await writeFile(PATH_EVIDENCE_PATH, pathText, "utf8")
}

async function main(): Promise<void> {
  const adapter = new QdrantNeo4jAdapter({
    qdrantUrl: QDRANT_URL,
    neo4jUrl: NEO4J_URL,
    collectionName: COLLECTION,
    vectorSize: VECTOR_SIZE,
  })

  try {
    const status = await adapter.status()
    if (!status.ok) {
      const skippedReason = "qdrant or neo4j unavailable"
      const artifact = buildArtifact(emptyBenchmarkMetrics(), true, skippedReason)
      await writeEvidence(formatRunEvidence(artifact), formatPathEvidence(null, skippedReason))
      console.log(JSON.stringify(artifact, null, 2))
      return
    }

    const corpus = generateCorpus({ scale: "large" })
    await adapter.resetStore()
    await ingestCorpus(adapter, corpus)

    const weakSeedCases = await buildWeakSeedCases(adapter, corpus.weakSeedQueryPairs)
    const graphCases = await buildGraphCases(adapter, corpus.weakSeedQueryPairs)
    const chainCases = await buildWeakSeedCases(adapter, relationshipPairs(corpus.weakSeedQueryPairs))
    const supersedeCases = await buildSupersedeCases(adapter, corpus.latestTruthPairs)
    const leakageCases = await buildWrongAgentLeakageCases(
      adapter,
      wrongAgentLeakagePairs(corpus.weakSeedQueryPairs, corpus.wrongAgentContaminationSet),
      corpus.wrongAgentContaminationSet,
    )

    const metrics = scoreBenchmarkMetrics({
      weakSeedHitAt1Cases: weakSeedCases,
      graphWeakSeedHitAt1Cases: graphCases.rankedCases,
      goldInExpandedNeighborhoodCases: graphCases.neighborhoodCases,
      chainHitAt3Cases: chainCases,
      supersedeCases,
      wrongAgentLeakageCases: leakageCases,
    })

    const artifact = buildArtifact(metrics)
    const validationPair = relationshipPairs(corpus.weakSeedQueryPairs)[0]
    const validationResult = validationPair
      ? (() => {
          const validation = graphCases.validations[corpus.weakSeedQueryPairs.indexOf(validationPair)]
          return validation
            ? {
                pairId: validationPair.id,
                query: validationPair.query,
                expectedEntryId: validationPair.expectedEntryId,
                seedIds: validation.seedIds,
                expandedIds: validation.expandedIds,
                resultEntryIds: validation.resultEntryIds,
                goldInExpandedNeighborhood: validation.resultEntryIds.includes(validationPair.expectedEntryId),
              }
            : null
        })()
      : null

    await writeEvidence(formatRunEvidence(artifact), formatPathEvidence(validationResult, null))
    console.log(JSON.stringify(artifact, null, 2))
  } finally {
    await adapter.close()
  }
}

await main()
