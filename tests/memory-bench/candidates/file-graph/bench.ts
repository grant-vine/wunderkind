import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { FileAdapter } from "../../../../src/memory/adapters/file.js"
import type { MemoryAdapter, MemoryEntry } from "../../../../src/memory/adapters/types.js"
import { generateCorpus, type CorpusEntry, type CorpusResult, type LatestTruthPair, type WeakSeedPair } from "../../generators/codebase-corpus.js"
import { generateStory, type TestCase } from "../../generators/story-generator.js"
import { ingestStory } from "../../harness/ingest.js"
import { queryStory } from "../../harness/query.js"
import {
  scoreBenchmarkMetrics,
  scoreResults,
  type BenchmarkMetrics,
  type GraphNeighborhoodCase,
  type RankedRetrievalCase,
  type ScoringReport,
  type SupersedeCase,
  type WrongAgentLeakageCase,
} from "../../harness/score.js"
import { FileGraphCandidateAdapter } from "./adapter.js"

interface QueryOutcome {
  testCase: TestCase
  prediction: string
}

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

interface StrongQuerySummary {
  fileBaselineHitAt1: number
  candidateHitAt1: number
  preserved: boolean
}

interface CandidateRun {
  report: ScoringReport
  artifact: BenchmarkArtifact
  strongQuery: StrongQuerySummary
}

const STORY_SEED = 42
const BENCH_AGENT = "bench"
const CODEBASE_DATASET_ID = "primary-synthetic-codebase-analysis"
const CODEBASE_SCALE = "large"
const CANDIDATE_NAME = "file-graph"
const TEST_CASE_TYPES: TestCase["type"][] = [
  "attribute",
  "relationship",
  "temporal",
  "knowledge-update",
  "abstention",
  "multi-hop",
]

function pad(value: string, width: number): string {
  return value.padEnd(width)
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatEmPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatF1(value: number): string {
  return value.toFixed(3)
}

function formatMetric(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3)
}

function runtimeLabel(): string {
  return `${process.release.name} ${process.version}`
}

function printSyntheticHeader(storyTestCount: number): void {
  console.log("Wunderkind Memory Recall Benchmark — file+graph candidate")
  console.log(`Synthetic story seed: ${STORY_SEED} | test cases: ${storyTestCount}`)
}

function printCodebaseHeader(corpus: CorpusResult): void {
  console.log(
    `Codebase corpus: ${corpus.entries.length} entries | weak-seed pairs: ${corpus.weakSeedQueryPairs.length} | latest-truth pairs: ${corpus.latestTruthPairs.length} | wrong-agent contamination entries: ${corpus.wrongAgentContaminationSet.length}`,
  )
}

function printAdapterTable(report: ScoringReport): void {
  const col0 = 18
  const col1 = 16
  const col2 = 12
  const col3 = 10
  const totalWidth = col0 + col1 + col2 + col3 + 8
  const border = `+${"-".repeat(totalWidth - 2)}+`

  console.log(`\n${CANDIDATE_NAME.toUpperCase()} recall breakdown`)
  console.log(border)
  console.log(`| ${pad("adapter", col0)}| ${pad("question type", col1)}| ${pad("EM%", col2)}| ${pad("mean F1", col3)}|`)
  console.log(border)

  for (const type of TEST_CASE_TYPES) {
    const bucket = report.byType[type]
    console.log(
      `| ${pad(CANDIDATE_NAME, col0)}| ${pad(type, col1)}| ${pad(formatEmPct(bucket.exactMatchPct), col2)}| ${pad(formatF1(bucket.meanF1), col3)}|`,
    )
  }

  console.log(border)
  console.log(
    `| ${pad(CANDIDATE_NAME, col0)}| ${pad("overall", col1)}| ${pad(formatEmPct(report.overall.exactMatchPct), col2)}| ${pad(formatF1(report.overall.meanF1), col3)}|`,
  )
  console.log(border)
}

function printBenchmarkMetrics(metrics: BenchmarkMetrics): void {
  console.log(`\n${CANDIDATE_NAME.toUpperCase()} benchmark metrics`)
  console.log(`- weak_seed_hit_at_1: ${formatMetric(metrics.weak_seed_hit_at_1)}`)
  console.log(`- graph_weak_seed_hit_at_1: ${formatMetric(metrics.graph_weak_seed_hit_at_1)}`)
  console.log(`- gold_in_expanded_neighborhood: ${formatMetric(metrics.gold_in_expanded_neighborhood)}`)
  console.log(`- chain_hit_at_3: ${formatMetric(metrics.chain_hit_at_3)}`)
  console.log(`- supersede_win_rate: ${formatMetric(metrics.supersede_win_rate)}`)
  console.log(`- wrong_agent_leakage_rate: ${formatMetric(metrics.wrong_agent_leakage_rate)}`)
}

function printStrongQuerySummary(summary: StrongQuerySummary): void {
  console.log("\nSTRONG QUERY PRESERVATION")
  console.log(`- file baseline hit@1: ${formatPct(summary.fileBaselineHitAt1)}`)
  console.log(`- file+graph hit@1: ${formatPct(summary.candidateHitAt1)}`)
  console.log(`- preserved_vs_file_baseline: ${summary.preserved ? "yes" : "no"}`)
}

function buildArtifact(metrics: BenchmarkMetrics): BenchmarkArtifact {
  return {
    candidate: CANDIDATE_NAME,
    dataset: CODEBASE_DATASET_ID,
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
    skipped: false,
    skipped_reason: null,
  }
}

function toBenchMemory(entry: CorpusEntry) {
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
    memoryClass: "factual" as const,
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

async function ingestCorpus(corpus: CorpusResult, adapter: FileGraphCandidateAdapter): Promise<void> {
  await adapter.seedCorpus(
    corpus.entries.map((entry) => ({
      agent: entry.agent,
      slug: entry.id,
      content: entry.content,
      createdAt: Date.parse(entry.timestamp),
      pinned: false,
      metadata: {
        tags: entry.tags.join(","),
        ...(entry.supersedes ? { supersedesFactId: entry.supersedes } : {}),
      },
    })),
  )
}

function relationshipPairs(weakSeedPairs: WeakSeedPair[]): WeakSeedPair[] {
  return weakSeedPairs.filter((pair) => pair.id.endsWith("-support") || pair.id.endsWith("-relationship"))
}

function wrongAgentLeakagePairs(weakSeedPairs: WeakSeedPair[], wrongAgentEntries: CorpusEntry[]): WeakSeedPair[] {
  const wrongAgents = new Set(wrongAgentEntries.map((entry) => entry.agent))
  return weakSeedPairs.filter((pair) => !wrongAgents.has(pair.agent))
}

async function buildRankedCases(
  pairs: WeakSeedPair[],
  search: (agent: string, query: string) => Promise<MemoryEntry[]>,
): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    pairs.map(async (pair) => ({
      expectedEntryId: pair.expectedEntryId,
      resultEntryIds: (await search(pair.agent, pair.query)).map((entry) => entry.slug),
    })),
  )
}

async function buildSupersedeCases(
  pairs: LatestTruthPair[],
  search: (agent: string, query: string) => Promise<MemoryEntry[]>,
): Promise<SupersedeCase[]> {
  return Promise.all(
    pairs.map(async (pair) => ({
      olderEntryId: pair.olderEntryId,
      newerEntryId: pair.newerEntryId,
      resultEntryIds: (await search(pair.agent, pair.query)).map((entry) => entry.slug),
    })),
  )
}

async function buildWrongAgentLeakageCases(
  pairs: WeakSeedPair[],
  wrongAgentEntries: CorpusEntry[],
  search: (agent: string, query: string) => Promise<MemoryEntry[]>,
): Promise<WrongAgentLeakageCase[]> {
  const wrongEntryIds = wrongAgentEntries.map((entry) => entry.id)
  return Promise.all(
    pairs.map(async (pair) => ({
      wrongEntryIds,
      resultEntryIds: (await search(pair.agent, pair.query)).map((entry) => entry.slug),
    })),
  )
}

async function runCodebaseMetrics(adapter: FileGraphCandidateAdapter, corpus: CorpusResult): Promise<BenchmarkMetrics> {
  await ingestCorpus(corpus, adapter)

  const weakSeedCases = await buildRankedCases(corpus.weakSeedQueryPairs, (agent, query) => adapter.searchBase(agent, query))
  const graphWeakSeedCases = await buildRankedCases(corpus.weakSeedQueryPairs, (agent, query) => adapter.search(agent, query))
  const chainCases = await buildRankedCases(relationshipPairs(corpus.weakSeedQueryPairs), (agent, query) => adapter.search(agent, query))
  const supersedeCases = await buildSupersedeCases(corpus.latestTruthPairs, (agent, query) => adapter.search(agent, query))
  const leakageCases = await buildWrongAgentLeakageCases(
    wrongAgentLeakagePairs(corpus.weakSeedQueryPairs, corpus.wrongAgentContaminationSet),
    corpus.wrongAgentContaminationSet,
    (agent, query) => adapter.search(agent, query),
  )

  const graphNeighborhoodCases: GraphNeighborhoodCase[] = await Promise.all(
    corpus.weakSeedQueryPairs.map(async (pair) => {
      const result = await adapter.searchWithGraph(pair.agent, pair.query)
      return {
        goldInExpandedNeighborhood: result.expandedNeighborhood.some((entry) => entry.slug === pair.expectedEntryId),
      }
    }),
  )

  return scoreBenchmarkMetrics({
    weakSeedHitAt1Cases: weakSeedCases,
    graphWeakSeedHitAt1Cases: graphWeakSeedCases,
    goldInExpandedNeighborhoodCases: graphNeighborhoodCases,
    chainHitAt3Cases: chainCases,
    supersedeCases,
    wrongAgentLeakageCases: leakageCases,
  })
}

async function cleanupBenchAgents(adapter: MemoryAdapter, corpus: CorpusResult): Promise<void> {
  const agents = new Set<string>([BENCH_AGENT, ...corpus.entries.map((entry) => entry.agent)])
  for (const agent of agents) {
    await adapter.deleteAll(agent)
  }
}

async function runStrongQuerySummary(projectDir: string, corpus: CorpusResult, adapter: FileGraphCandidateAdapter): Promise<StrongQuerySummary> {
  const fileBaseline = new FileAdapter(projectDir)
  let fileHits = 0
  let candidateHits = 0
  for (const pair of corpus.weakSeedQueryPairs) {
    const exactQuery = pair.expectedEntryId
    const fileResults = await fileBaseline.search(pair.agent, exactQuery)
    const candidateResults = await adapter.search(pair.agent, exactQuery)
    if (fileResults[0]?.slug === pair.expectedEntryId) {
      fileHits += 1
    }
    if (candidateResults[0]?.slug === pair.expectedEntryId) {
      candidateHits += 1
    }
  }

  const total = corpus.weakSeedQueryPairs.length
  const fileBaselineHitAt1 = total === 0 ? 0 : fileHits / total
  const candidateHitAt1 = total === 0 ? 0 : candidateHits / total
  return {
    fileBaselineHitAt1,
    candidateHitAt1,
    preserved: candidateHitAt1 >= fileBaselineHitAt1,
  }
}

async function runCandidateBench(projectDir: string, adapter: FileGraphCandidateAdapter, corpus: CorpusResult): Promise<CandidateRun> {
  const story = generateStory(STORY_SEED, 5, 4, 3)
  try {
    await ingestStory(story, adapter, BENCH_AGENT)

    const outcomes: QueryOutcome[] = []
    for (const testCase of story.testCases) {
      const prediction = await queryStory(testCase, adapter, BENCH_AGENT)
      outcomes.push({ testCase, prediction })
    }

    const benchmarkMetrics = await runCodebaseMetrics(adapter, corpus)
    const strongQuery = await runStrongQuerySummary(projectDir, corpus, adapter)
    const report = scoreResults(
      outcomes.map((outcome) => ({ testCase: outcome.testCase, prediction: outcome.prediction })),
      benchmarkMetrics,
    )
    return {
      report,
      artifact: buildArtifact(benchmarkMetrics),
      strongQuery,
    }
  } finally {
    await cleanupBenchAgents(adapter, corpus)
  }
}

async function withTempProject<T>(run: (projectDir: string) => Promise<T>): Promise<T> {
  const projectDir = await mkdtemp(path.join(tmpdir(), "wunderkind-bench-file-graph-"))
  try {
    return await run(projectDir)
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const story = generateStory(STORY_SEED, 5, 4, 3)
  const corpus = generateCorpus({ scale: CODEBASE_SCALE })
  printSyntheticHeader(story.testCases.length)
  printCodebaseHeader(corpus)

  const result = await withTempProject(async (projectDir) => {
    const adapter = new FileGraphCandidateAdapter(projectDir)
    return runCandidateBench(projectDir, adapter, corpus)
  })

  printAdapterTable(result.report)
  printBenchmarkMetrics(result.report.benchmarkMetrics)
  printStrongQuerySummary(result.strongQuery)

  console.log("\nBENCHMARK ARTIFACT")
  console.log(JSON.stringify(result.artifact, null, 2))
}

await main()
