import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { FileAdapter } from "../../src/memory/adapters/file.js"
import { LocalVecAdapter } from "../../src/memory/adapters/local-vec.js"
import { SqliteAdapter } from "../../src/memory/adapters/sqlite.js"
import type { MemoryAdapter } from "../../src/memory/adapters/types.js"
import { generateCorpus, type CorpusEntry, type CorpusResult, type LatestTruthPair, type WeakSeedPair } from "./generators/codebase-corpus.js"
import { generateStory, type TestCase } from "./generators/story-generator.js"
import { ingestStory } from "./harness/ingest.js"
import { queryStory } from "./harness/query.js"
import {
  exactMatch,
  scoreBenchmarkMetrics,
  scoreResults,
  tokenF1,
  type BenchmarkMetrics,
  type GraphNeighborhoodCase,
  type RankedRetrievalCase,
  type ScoringReport,
  type SupersedeCase,
  type WrongAgentLeakageCase,
} from "./harness/score.js"

type AdapterName = "file" | "sqlite" | "local-vec"

interface AdapterRun {
  adapter: AdapterName
  report: ScoringReport
  artifact: BenchmarkArtifact
}

interface QueryOutcome {
  testCase: TestCase
  prediction: string
  exactMatch: 0 | 1
  f1: number
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

const STORY_SEED = 42
const BENCH_AGENT = "bench"
const LOCAL_VEC_MODEL = "Xenova/e5-small-v2"
const CODEBASE_DATASET_ID = "primary-synthetic-codebase-analysis"
const CODEBASE_SCALE = "large"
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
  return `${value.toFixed(1)}%`
}

function formatF1(value: number): string {
  return value.toFixed(3)
}

function formatMetric(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3)
}

function fixturePath(fileName: string): string {
  return path.join(process.cwd(), "tests", "memory-bench", "fixtures", fileName)
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

function printSyntheticHeader(storyTestCount: number): void {
  console.log("Wunderkind Memory Recall Benchmark")
  console.log(`Synthetic story seed: ${STORY_SEED} | test cases: ${storyTestCount}`)
}

function printCodebaseHeader(corpus: CorpusResult): void {
  console.log(
    `Codebase corpus: ${corpus.entries.length} entries | weak-seed pairs: ${corpus.weakSeedQueryPairs.length} | latest-truth pairs: ${corpus.latestTruthPairs.length} | wrong-agent contamination entries: ${corpus.wrongAgentContaminationSet.length}`,
  )
}

function printOptionalFixtureStatus(): void {
  const longMemEval = fixturePath("longmemeval_oracle.json")
  const loCoMo = fixturePath("locomo_dataset.json")

  if (existsSync(longMemEval)) {
    console.log(`[fixtures] LongMemEval fixture detected: ${longMemEval}`)
  } else {
    console.log("[fixtures] LongMemEval fixture not present — synthetic benchmark remains sufficient.")
  }

  if (existsSync(loCoMo)) {
    console.log(`[fixtures] LoCoMo fixture detected (manual download): ${loCoMo}`)
  } else {
    console.log("[fixtures] LoCoMo fixture not present — manual-only dataset remains optional.")
  }
}

function printAdapterTable(adapter: AdapterName, report: ScoringReport): void {
  const col0 = 18
  const col1 = 16
  const col2 = 12
  const col3 = 10
  const totalWidth = col0 + col1 + col2 + col3 + 8
  const border = `+${"-".repeat(totalWidth - 2)}+`

  console.log(`\n${adapter.toUpperCase()} recall breakdown`)
  console.log(border)
  console.log(`| ${pad("adapter", col0)}| ${pad("question type", col1)}| ${pad("EM%", col2)}| ${pad("mean F1", col3)}|`)
  console.log(border)

  for (const type of TEST_CASE_TYPES) {
    const bucket = report.byType[type]
    console.log(
      `| ${pad(adapter, col0)}| ${pad(type, col1)}| ${pad(formatPct(bucket.exactMatchPct), col2)}| ${pad(formatF1(bucket.meanF1), col3)}|`,
    )
  }

  console.log(border)
  console.log(
    `| ${pad(adapter, col0)}| ${pad("overall", col1)}| ${pad(formatPct(report.overall.exactMatchPct), col2)}| ${pad(formatF1(report.overall.meanF1), col3)}|`,
  )
  console.log(border)
}

function printSummaryTable(results: AdapterRun[]): void {
  const col0 = 16
  const col1 = 12
  const col2 = 10
  const border = `+${"-".repeat(col0 + col1 + col2 + 6)}+`

  console.log("\nFINAL SUMMARY")
  console.log(border)
  console.log(`| ${pad("adapter", col0)}| ${pad("overall EM%", col1)}| ${pad("mean F1", col2)}|`)
  console.log(border)
  for (const result of results) {
    console.log(
      `| ${pad(result.adapter, col0)}| ${pad(formatPct(result.report.overall.exactMatchPct), col1)}| ${pad(formatF1(result.report.overall.meanF1), col2)}|`,
    )
  }
  console.log(border)
}

function printBenchmarkMetrics(adapter: AdapterName, metrics: BenchmarkMetrics): void {
  console.log(`\n${adapter.toUpperCase()} benchmark metrics`)
  console.log(`- weak_seed_hit_at_1: ${formatMetric(metrics.weak_seed_hit_at_1)}`)
  console.log(`- graph_weak_seed_hit_at_1: ${formatMetric(metrics.graph_weak_seed_hit_at_1)}`)
  console.log(`- gold_in_expanded_neighborhood: ${formatMetric(metrics.gold_in_expanded_neighborhood)}`)
  console.log(`- chain_hit_at_3: ${formatMetric(metrics.chain_hit_at_3)}`)
  console.log(`- supersede_win_rate: ${formatMetric(metrics.supersede_win_rate)}`)
  console.log(`- wrong_agent_leakage_rate: ${formatMetric(metrics.wrong_agent_leakage_rate)}`)
}

function printArtifacts(results: AdapterRun[]): void {
  console.log("\nRESULT ARTIFACTS")
  console.log(JSON.stringify(results.map((result) => result.artifact), null, 2))
}

function runtimeLabel(): string {
  return `${process.release.name} ${process.version}`
}

function supportsGraph(_adapterName: AdapterName): boolean {
  return false
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

async function ingestCorpus(corpus: CorpusResult, adapter: MemoryAdapter): Promise<void> {
  const BATCH_SIZE = 50
  for (let i = 0; i < corpus.entries.length; i += BATCH_SIZE) {
    const batch = corpus.entries.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map((entry) => adapter.write(entry.agent, toBenchMemory(entry))))
  }
}

async function searchEntryIds(adapter: MemoryAdapter, agent: string, query: string): Promise<string[]> {
  const results = await adapter.search(agent, query)
  return results.map((result) => result.slug)
}

function relationshipPairs(weakSeedPairs: WeakSeedPair[]): WeakSeedPair[] {
  return weakSeedPairs.filter((pair) => pair.id.endsWith("-support") || pair.id.endsWith("-relationship"))
}

function wrongAgentLeakagePairs(weakSeedPairs: WeakSeedPair[], wrongAgentEntries: CorpusEntry[]): WeakSeedPair[] {
  const wrongAgents = new Set(wrongAgentEntries.map((entry) => entry.agent))
  return weakSeedPairs.filter((pair) => !wrongAgents.has(pair.agent))
}

async function buildWeakSeedCases(adapter: MemoryAdapter, weakSeedPairs: WeakSeedPair[]): Promise<RankedRetrievalCase[]> {
  return Promise.all(
    weakSeedPairs.map(async (pair) => ({
      expectedEntryId: pair.expectedEntryId,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildSupersedeCases(adapter: MemoryAdapter, latestTruthPairs: LatestTruthPair[]): Promise<SupersedeCase[]> {
  return Promise.all(
    latestTruthPairs.map(async (pair) => ({
      olderEntryId: pair.olderEntryId,
      newerEntryId: pair.newerEntryId,
      resultEntryIds: await searchEntryIds(adapter, pair.agent, pair.query),
    })),
  )
}

async function buildWrongAgentLeakageCases(
  adapter: MemoryAdapter,
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

function buildArtifact(adapter: AdapterName, metrics: BenchmarkMetrics): BenchmarkArtifact {
  return {
    candidate: adapter,
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

async function runCodebaseMetrics(adapterName: AdapterName, adapter: MemoryAdapter, corpus: CorpusResult): Promise<BenchmarkMetrics> {
  await ingestCorpus(corpus, adapter)

  const weakSeedCases = await buildWeakSeedCases(adapter, corpus.weakSeedQueryPairs)
  const chainCases = await buildWeakSeedCases(adapter, relationshipPairs(corpus.weakSeedQueryPairs))
  const supersedeCases = await buildSupersedeCases(adapter, corpus.latestTruthPairs)
  const leakageCases = await buildWrongAgentLeakageCases(
    adapter,
    wrongAgentLeakagePairs(corpus.weakSeedQueryPairs, corpus.wrongAgentContaminationSet),
    corpus.wrongAgentContaminationSet,
  )

  const graphWeakSeedCases: RankedRetrievalCase[] | null = supportsGraph(adapterName) ? weakSeedCases : null
  const graphNeighborhoodCases: GraphNeighborhoodCase[] | null = supportsGraph(adapterName)
    ? weakSeedCases.map((item) => ({ goldInExpandedNeighborhood: item.resultEntryIds.includes(item.expectedEntryId) }))
    : null

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

async function runAdapterBench(adapterName: AdapterName, adapter: MemoryAdapter, corpus: CorpusResult): Promise<AdapterRun> {
  const story = generateStory(STORY_SEED, 5, 4, 3)
  try {
    await ingestStory(story, adapter, BENCH_AGENT)

    const outcomes: QueryOutcome[] = []
    for (const testCase of story.testCases) {
      const prediction = await queryStory(testCase, adapter, BENCH_AGENT)
      outcomes.push({
        testCase,
        prediction,
        exactMatch: exactMatch(prediction, testCase.expectedAnswer),
        f1: tokenF1(prediction, testCase.expectedAnswer),
      })
    }

    const benchmarkMetrics = await runCodebaseMetrics(adapterName, adapter, corpus)
    const report = scoreResults(
      outcomes.map((outcome) => ({ testCase: outcome.testCase, prediction: outcome.prediction })),
      benchmarkMetrics,
    )
    const artifact = buildArtifact(adapterName, benchmarkMetrics)
    return { adapter: adapterName, report, artifact }
  } finally {
    await cleanupBenchAgents(adapter, corpus)
  }
}

async function withTempProject<T>(adapterName: Exclude<AdapterName, "local-vec">, run: (projectDir: string) => Promise<T>): Promise<T> {
  const projectDir = await mkdtemp(path.join(tmpdir(), `wunderkind-bench-${adapterName}-`))
  try {
    return await run(projectDir)
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
}

async function runLocalVecBench(): Promise<AdapterRun | null> {
  if (!isLikelyModelCached(LOCAL_VEC_MODEL)) {
    console.log(`\n[local-vec] skipped — ${LOCAL_VEC_MODEL} is not cached locally.`)
    return null
  }

  const projectDir = await mkdtemp(path.join(tmpdir(), "wunderkind-bench-local-vec-"))
  try {
    const adapter = new LocalVecAdapter({
      baseDir: path.join(projectDir, ".wunderkind", "local-vec"),
      model: LOCAL_VEC_MODEL,
      vectorSize: 384,
      queryPrefix: "query: ",
    })

    return await runAdapterBench("local-vec", adapter, generateCorpus({ scale: CODEBASE_SCALE }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`\n[local-vec] skipped — ${message}`)
    return null
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const story = generateStory(STORY_SEED, 5, 4, 3)
  const corpus = generateCorpus({ scale: CODEBASE_SCALE })
  printSyntheticHeader(story.testCases.length)
  printCodebaseHeader(corpus)
  printOptionalFixtureStatus()

  const results: AdapterRun[] = []

  const fileRun = await withTempProject("file", async (projectDir) => {
    const adapter = new FileAdapter(projectDir)
    return runAdapterBench("file", adapter, corpus)
  })
  results.push(fileRun)
  printAdapterTable(fileRun.adapter, fileRun.report)
  printBenchmarkMetrics(fileRun.adapter, fileRun.report.benchmarkMetrics)

  const sqliteRun = await withTempProject("sqlite", async (projectDir) => {
    const adapter = new SqliteAdapter(path.join(projectDir, ".wunderkind", "memory.db"))
    return runAdapterBench("sqlite", adapter, corpus)
  })
  results.push(sqliteRun)
  printAdapterTable(sqliteRun.adapter, sqliteRun.report)
  printBenchmarkMetrics(sqliteRun.adapter, sqliteRun.report.benchmarkMetrics)

  const localVecRun = await runLocalVecBench()
  if (localVecRun) {
    results.push(localVecRun)
    printAdapterTable(localVecRun.adapter, localVecRun.report)
    printBenchmarkMetrics(localVecRun.adapter, localVecRun.report.benchmarkMetrics)
  }

  printSummaryTable(results)
  printArtifacts(results)
}

await main()
