import { execSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { FileAdapter } from "../../src/memory/adapters/file.js"
import { SqliteAdapter } from "../../src/memory/adapters/sqlite.js"
import { LocalVecAdapter } from "../../src/memory/adapters/local-vec.js"
import { VectorAdapter } from "../../src/memory/adapters/vector.js"
import { Mem0Adapter } from "../../src/memory/adapters/mem0.js"
import type { MemoryAdapter } from "../../src/memory/adapters/types.js"

const SCENARIOS = [10, 100, 1000]
const MEM0_SCENARIOS = [10, 100]
const ACCURACY_N = 100
const SEARCH_KEYWORD = "benchmark"
const QDRANT_URL = "http://127.0.0.1:6333"
const QDRANT_IMAGE = "qdrant/qdrant:v1.17.0"
const QDRANT_CONTAINER = `qdrant_bench_${Date.now()}`
const MEM0_URL = process.argv.find((a) => a.startsWith("--mem0-url="))?.slice("--mem0-url=".length) ?? "http://localhost:8000"
const MEM0_OLLAMA_URL = process.argv.find((a) => a.startsWith("--mem0-ollama-url="))?.slice("--mem0-ollama-url=".length) ?? "http://localhost:11434"

const SKIP_VECTOR = process.argv.includes("--skip-vector")
const SKIP_LOCAL_VEC = process.argv.includes("--skip-local-vec")
const SKIP_MEM0 = !process.argv.includes("--with-mem0")
const SKIP_MODEL_COMPARE = process.argv.includes("--skip-model-compare")

const SEMANTIC_CORPUS = [
  "PostgreSQL connection pool must be configured with max_connections=100 to prevent exhaustion under load",
  "Always use pgBouncer in transaction mode for serverless database access patterns",
  "Database connection strings must never be committed to source control — use secrets manager",
  "Use read replicas for analytics queries to avoid impacting primary database performance",
  "Database indexes should be added for all foreign key columns and frequently queried fields",
  "Run VACUUM ANALYZE weekly on large tables to prevent bloat and maintain query planner accuracy",
  "JWT tokens must expire within 15 minutes for sensitive operations — use refresh tokens alongside",
  "Never store plaintext passwords — use bcrypt with cost factor 12 minimum",
  "OAuth2 redirect URIs must be explicitly whitelisted — reject wildcard patterns",
  "Session cookies require HttpOnly and SameSite=Strict attributes to prevent XSS and CSRF",
  "Implement rate limiting on authentication endpoints to prevent credential stuffing attacks",
  "Multi-factor authentication is mandatory for all admin accounts and service accounts",
  "All production deployments must go through the CI/CD pipeline — no manual pushes to main",
  "Environment variables must be injected via secrets manager — never hardcoded in source",
  "Docker images must be built from pinned base image digests — not floating tags like latest",
  "Kubernetes resource limits must be set for all containers to prevent noisy-neighbour problems",
  "Health check endpoints must respond within 200ms to pass load balancer liveness checks",
  "Blue-green deployment strategy is required for services with SLA > 99.5%",
  "Structured JSON logs are required — no unstructured log.Println statements in production code",
  "Every HTTP request must emit a trace ID to enable distributed tracing across service boundaries",
  "Alerting thresholds for p99 latency must be set below 500ms for user-facing APIs",
  "Dashboards must display error rate, latency, and saturation — the RED method",
  "Log retention policy is 90 days for production, 30 days for staging environments",
  "All API endpoints must validate input against a strict schema before processing",
  "Dependency audits must run in CI — fail the build on high-severity CVEs",
  "Network policies must restrict pod-to-pod communication to only required service pairs",
  "Secrets rotation schedule: API keys every 90 days, TLS certificates before 30-day expiry",
  "PII data must be encrypted at rest using AES-256 and in transit using TLS 1.3 minimum",
  "All admin actions must be logged to an immutable audit trail for compliance review",
  "The marketing team uses Notion for campaign planning and quarterly OKR tracking",
  "Design tokens are exported from Figma and synced to the component library on each release",
  "Sprint retrospectives are held every two weeks with the full cross-functional team",
  "Customer support tickets are triaged using a severity matrix agreed with the product team",
  "All new features require a product spec with user story acceptance criteria before dev starts",
]

function clusterOf(corpusIndex: number): number {
  if (corpusIndex <= 5) return 0
  if (corpusIndex <= 11) return 1
  if (corpusIndex <= 17) return 2
  if (corpusIndex <= 23) return 3
  if (corpusIndex <= 28) return 4
  return -1
}

const SEMANTIC_QUERIES: Array<{ query: string; targetCluster: number }> = [
  { query: "how should we manage connections to the relational database in production", targetCluster: 0 },
  { query: "security requirements for user login authentication and session management", targetCluster: 1 },
  { query: "rules for shipping code to production and managing infrastructure configuration", targetCluster: 2 },
  { query: "how we collect and monitor application performance signals and errors", targetCluster: 3 },
  { query: "protecting sensitive data and keeping third-party dependencies secure", targetCluster: 4 },
]

interface ModelCompareConfig {
  model: string
  vectorSize: number
  label: string
  queryPrefix?: string
}

const MODEL_COMPARE_CONFIGS: ModelCompareConfig[] = [
  { model: "Xenova/all-MiniLM-L6-v2", vectorSize: 384, label: "MiniLM-L6 (22MB)" },
  { model: "Xenova/bge-small-en-v1.5", vectorSize: 384, label: "BGE-small (32MB)", queryPrefix: "Represent this sentence for searching relevant passages: " },
  { model: "Xenova/bge-base-en-v1.5", vectorSize: 768, label: "BGE-base (105MB)", queryPrefix: "Represent this sentence for searching relevant passages: " },
]

interface BenchResult {
  write: number
  read: number
  search: number
  semanticSearch: number
  prune: number
}

interface AccuracyResult {
  keywordPrecision: number
  keywordRecall: number
  semanticPrecision: number
  semanticRecall: number
  perQuery: Array<{ query: string; precision: number; recall: number; hits: number; relevant: number }>
}

interface ModelAccuracyResult {
  label: string
  model: string
  accuracy: AccuracyResult
}

type AdapterName = "FileAdapter" | "SqliteAdapter" | "LocalVecAdapter" | "VectorAdapter" | "Mem0Adapter"

interface AllResults {
  FileAdapter: Map<number, BenchResult>
  SqliteAdapter: Map<number, BenchResult>
  LocalVecAdapter: Map<number, BenchResult>
  VectorAdapter: Map<number, BenchResult>
  Mem0Adapter: Map<number, BenchResult>
}

interface AllAccuracy {
  FileAdapter: AccuracyResult | null
  SqliteAdapter: AccuracyResult | null
  LocalVecAdapter: AccuracyResult | null
  VectorAdapter: AccuracyResult | null
  Mem0Adapter: AccuracyResult | null
}

function pad(s: string, width: number): string {
  return s.padEnd(width)
}

function padStart(s: string, width: number): string {
  return s.padStart(width)
}

function formatMs(ms: number): string {
  return ms.toFixed(1) + "ms"
}

function formatPct(v: number): string {
  return (v * 100).toFixed(0) + "%"
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function warmupAdapter(adapter: MemoryAdapter, agent: string): Promise<void> {
  const e = await adapter.write(agent, {
    agent,
    slug: "warmup",
    content: "warmup entry for model and service initialisation",
    createdAt: Date.now(),
    pinned: false,
    metadata: {},
  })
  await adapter.delete(e.id)
}

async function startQdrant(): Promise<boolean> {
  try {
    execSync(
      `docker run -d --rm -p 6333:6333 -p 6334:6334 -e QDRANT__SERVICE__GRPC_PORT=6334 --name ${QDRANT_CONTAINER} ${QDRANT_IMAGE}`,
      { stdio: "pipe" },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  [vector] docker run failed: ${msg}`)
    return false
  }

  console.log(`  [vector] container ${QDRANT_CONTAINER} starting — polling /collections ...`)
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${QDRANT_URL}/collections`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        console.log("  [vector] Qdrant ready")
        return true
      }
    } catch {
      /* not yet accepting connections */
    }
    await sleep(500)
  }
  console.warn("  [vector] timed out waiting for Qdrant to become ready")
  return false
}

function stopQdrant(): void {
  try {
    execSync(`docker stop ${QDRANT_CONTAINER}`, { stdio: "pipe" })
    console.log(`  [vector] container ${QDRANT_CONTAINER} stopped`)
  } catch {
    /* container may have already exited */
  }
}

async function checkOllama(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function seedAccuracyCorpus(
  adapter: MemoryAdapter,
  agent: string,
): Promise<{ idToCorpusIndex: Map<string, number>; keywordIds: Set<string> }> {
  const idToCorpusIndex = new Map<string, number>()
  const keywordIds = new Set<string>()
  const now = Date.now()

  for (let i = 0; i < ACCURACY_N; i++) {
    const corpusIndex = i % SEMANTIC_CORPUS.length
    const corpusEntry = SEMANTIC_CORPUS[corpusIndex] ?? ""
    const content =
      i % 3 === 0
        ? `This entry contains the ${SEARCH_KEYWORD} keyword for search testing — entry index ${i}`
        : `${corpusEntry} (index ${i})`
    const e = await adapter.write(agent, {
      agent,
      slug: `acc-entry-${i}`,
      content,
      createdAt: now + i,
      pinned: false,
      metadata: {},
    })
    idToCorpusIndex.set(e.id, corpusIndex)
    if (i % 3 === 0) keywordIds.add(e.id)
  }

  return { idToCorpusIndex, keywordIds }
}

async function runAccuracy(adapter: MemoryAdapter, isVector: boolean): Promise<AccuracyResult> {
  const agent = `acc-agent-${Date.now()}`
  const { idToCorpusIndex, keywordIds } = await seedAccuracyCorpus(adapter, agent)

  const totalKeywordRelevant = keywordIds.size

  const kwResults = await adapter.search(agent, SEARCH_KEYWORD)
  const kwReturned = kwResults.length
  const kwHits = kwResults.filter((e) => keywordIds.has(e.id)).length
  const keywordPrecision = kwReturned === 0 ? 0 : kwHits / kwReturned
  const keywordRecall = totalKeywordRelevant === 0 ? 0 : kwHits / totalKeywordRelevant

  const queryCount = isVector ? SEMANTIC_QUERIES.length : 2
  const perQuery: AccuracyResult["perQuery"] = []

  for (let qi = 0; qi < queryCount; qi++) {
    const qdef = SEMANTIC_QUERIES[qi]
    if (!qdef) continue

    let totalRelevant = 0
    for (const [, corpusIdx] of idToCorpusIndex) {
      if (clusterOf(corpusIdx) === qdef.targetCluster) totalRelevant += 1
    }

    const results = await adapter.search(agent, qdef.query)
    const returned = results.length
    let hits = 0
    for (const entry of results) {
      const cidx = idToCorpusIndex.get(entry.id)
      if (cidx !== undefined && clusterOf(cidx) === qdef.targetCluster) hits += 1
    }

    perQuery.push({
      query: qdef.query,
      precision: returned === 0 ? 0 : hits / returned,
      recall: totalRelevant === 0 ? 0 : hits / totalRelevant,
      hits,
      relevant: totalRelevant,
    })
  }

  const semanticPrecision =
    perQuery.length === 0 ? 0 : perQuery.reduce((s, q) => s + q.precision, 0) / perQuery.length
  const semanticRecall =
    perQuery.length === 0 ? 0 : perQuery.reduce((s, q) => s + q.recall, 0) / perQuery.length

  await adapter.deleteAll(agent)

  return { keywordPrecision, keywordRecall, semanticPrecision, semanticRecall, perQuery }
}

async function runScenario(
  adapter: MemoryAdapter,
  n: number,
  isVector: boolean,
): Promise<BenchResult> {
  const agent = `bench-agent-${n}-${Date.now()}`
  const now = Date.now()

  const t0 = performance.now()
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const corpusEntry = SEMANTIC_CORPUS[i % SEMANTIC_CORPUS.length] ?? ""
    const content =
      i % 3 === 0
        ? `This entry contains the ${SEARCH_KEYWORD} keyword for search testing — entry index ${i}`
        : `${corpusEntry} (index ${i})`
    const e = await adapter.write(agent, {
      agent,
      slug: `entry-${i}`,
      content,
      createdAt: now + i,
      pinned: false,
      metadata: {},
    })
    ids.push(e.id)
  }
  const writeMs = performance.now() - t0

  const t1 = performance.now()
  await adapter.read(agent)
  const readMs = performance.now() - t1

  const t2 = performance.now()
  await adapter.search(agent, SEARCH_KEYWORD)
  const searchMs = performance.now() - t2

  const queryCount = isVector ? 3 : 2
  const t3 = performance.now()
  for (let q = 0; q < queryCount; q++) {
    const qdef = SEMANTIC_QUERIES[q]
    if (qdef !== undefined) {
      await adapter.search(agent, qdef.query)
    }
  }
  const semanticSearchMs = (performance.now() - t3) / queryCount

  const half = ids.slice(0, Math.floor(n / 2))
  const t4 = performance.now()
  await adapter.prune(agent, half)
  const pruneMs = performance.now() - t4

  await adapter.deleteAll(agent)

  return { write: writeMs, read: readMs, search: searchMs, semanticSearch: semanticSearchMs, prune: pruneMs }
}

function printPerfTable(results: AllResults, adapters: AdapterName[]): void {
  const col0 = 16
  const col1 = 6
  const col2 = 12
  const col3 = 12
  const col4 = 14
  const col5 = 16
  const col6 = 12
  const totalWidth = col0 + col1 + col2 + col3 + col4 + col5 + col6 + 8
  const hline = "+" + "-".repeat(totalWidth - 2) + "+"

  console.log(hline)
  console.log(
    "| " + pad("Adapter", col0) +
    "| " + pad("N", col1) +
    "| " + pad("Write", col2) +
    "| " + pad("Read", col3) +
    "| " + pad("KeywordSearch", col4) +
    "| " + pad("SemanticSearch", col5) +
    "| " + pad("Prune", col6) + "|",
  )
  console.log(hline)

  for (const n of SCENARIOS) {
    for (const name of adapters) {
      const r = results[name].get(n)
      if (!r) continue
      console.log(
        "| " + pad(name, col0) +
        "| " + pad(String(n), col1) +
        "| " + pad(formatMs(r.write), col2) +
        "| " + pad(formatMs(r.read), col3) +
        "| " + pad(formatMs(r.search), col4) +
        "| " + pad(formatMs(r.semanticSearch), col5) +
        "| " + pad(formatMs(r.prune), col6) + "|",
      )
    }
    console.log(hline)
  }
}

function printAccuracyTable(accuracy: AllAccuracy, adapters: AdapterName[]): void {
  const col0 = 16
  const col1 = 14
  const col2 = 14
  const col3 = 16
  const col4 = 16
  const totalWidth = col0 + col1 + col2 + col3 + col4 + 6
  const hline = "+" + "-".repeat(totalWidth - 2) + "+"

  console.log(`\nACCURACY — at N=${ACCURACY_N} (Precision@K / Recall@K, higher = better)`)
  console.log(hline)
  console.log(
    "| " + pad("Adapter", col0) +
    "| " + pad("Keyword P@K", col1) +
    "| " + pad("Keyword R@K", col2) +
    "| " + pad("Semantic P@K", col3) +
    "| " + pad("Semantic R@K", col4) + "|",
  )
  console.log(hline)

  for (const name of adapters) {
    const a = accuracy[name]
    if (!a) {
      console.log(
        "| " + pad(name, col0) +
        "| " + pad("n/a", col1) +
        "| " + pad("n/a", col2) +
        "| " + pad("n/a", col3) +
        "| " + pad("n/a", col4) + "|",
      )
    } else {
      console.log(
        "| " + pad(name, col0) +
        "| " + pad(formatPct(a.keywordPrecision), col1) +
        "| " + pad(formatPct(a.keywordRecall), col2) +
        "| " + pad(formatPct(a.semanticPrecision), col3) +
        "| " + pad(formatPct(a.semanticRecall), col4) + "|",
      )
    }
  }
  console.log(hline)
  if (adapters.includes("Mem0Adapter")) {
    console.log("  * Mem0Adapter accuracy marked n/a: mem0 rewrites stored content via LLM inference,")
    console.log("    so stored entries cannot be reliably mapped back to original corpus indices.")
  }
}

function printAccuracyBreakdown(accuracy: AllAccuracy, adapters: AdapterName[]): void {
  for (const name of adapters) {
    const a = accuracy[name]
    if (!a || a.perQuery.length === 0) continue
    console.log(`\n  ${name} — semantic query breakdown`)
    for (const q of a.perQuery) {
      const short = q.query.length > 55 ? q.query.slice(0, 52) + "..." : q.query
      console.log(
        `    P=${formatPct(q.precision)} R=${formatPct(q.recall)} ` +
        `[${q.hits}/${q.relevant} relevant returned]  "${short}"`,
      )
    }
  }
}

function printModelCompareTable(results: ModelAccuracyResult[]): void {
  if (results.length === 0) return

  const col0 = 22
  const col1 = 14
  const col2 = 14
  const col3 = 16
  const col4 = 16
  const totalWidth = col0 + col1 + col2 + col3 + col4 + 6
  const hline = "+" + "-".repeat(totalWidth - 2) + "+"

  console.log(`\nMODEL COMPARISON (LocalVecAdapter) — accuracy at N=${ACCURACY_N}`)
  console.log("  Larger models → higher-dimensional embeddings → better semantic recall.")
  console.log(hline)
  console.log(
    "| " + pad("Model", col0) +
    "| " + pad("Keyword P@K", col1) +
    "| " + pad("Keyword R@K", col2) +
    "| " + pad("Semantic P@K", col3) +
    "| " + pad("Semantic R@K", col4) + "|",
  )
  console.log(hline)

  for (const r of results) {
    const a = r.accuracy
    console.log(
      "| " + pad(r.label, col0) +
      "| " + pad(formatPct(a.keywordPrecision), col1) +
      "| " + pad(formatPct(a.keywordRecall), col2) +
      "| " + pad(formatPct(a.semanticPrecision), col3) +
      "| " + pad(formatPct(a.semanticRecall), col4) + "|",
    )
  }
  console.log(hline)

  console.log("")
  for (const r of results) {
    const a = r.accuracy
    console.log(`  ${r.label} — semantic query breakdown`)
    for (const q of a.perQuery) {
      const short = q.query.length > 55 ? q.query.slice(0, 52) + "..." : q.query
      console.log(
        `    P=${formatPct(q.precision)} R=${formatPct(q.recall)} ` +
        `[${q.hits}/${q.relevant} relevant returned]  "${short}"`,
      )
    }
    console.log("")
  }
}

function printLimitations(adapters: AdapterName[]): void {
  console.log("\nADAPTER LIMITATIONS")
  console.log("=".repeat(70))

  const rows: Array<{ name: AdapterName; keyword: string; semantic: string; notes: string }> = [
    {
      name: "FileAdapter",
      keyword: "Yes — word-boundary regex (AND across tokens)",
      semantic: "No — substring/regex only; paraphrase queries return 0 hits",
      notes: "Reads entire file into memory before filtering. No index.",
    },
    {
      name: "SqliteAdapter",
      keyword: "Yes — FTS5 with Porter stemmer (BM25 ranked)",
      semantic: "Partial — stemming helps inflection but not synonyms or paraphrases",
      notes: "FTS5 is fast and ranked. Cannot retrieve by meaning.",
    },
    {
      name: "LocalVecAdapter",
      keyword: "Partial — vector search may miss exact keyword if context diverges",
      semantic: "Yes — cosine similarity via local ONNX model; no external service required",
      notes: "First run loads ONNX weights (~seconds). Pure in-process after warmup.",
    },
    {
      name: "VectorAdapter",
      keyword: "Partial — vector search may miss exact keyword if context diverges",
      semantic: "Yes — cosine similarity over MiniLM embeddings; retrieves by meaning",
      notes: "High write cost (embedding inference + 2 Qdrant calls). Requires Docker.",
    },
    {
      name: "Mem0Adapter",
      keyword: "Partial — mem0 may rewrite/merge stored content via LLM inference",
      semantic: "Yes — mem0 uses an embedding model for similarity search",
      notes: "LLM-backed memory consolidation. Requires Docker + Ollama (or OpenAI).",
    },
  ]

  for (const row of rows) {
    if (!adapters.includes(row.name)) continue
    console.log(`\n  ${row.name}`)
    console.log(`    Keyword search  : ${row.keyword}`)
    console.log(`    Semantic search : ${row.semantic}`)
    console.log(`    Notes           : ${row.notes}`)
  }
}

function printSummary(results: AllResults, adapters: AdapterName[]): void {
  type Category = keyof BenchResult
  const categories: Array<{ key: Category; label: string }> = [
    { key: "write", label: "write" },
    { key: "read", label: "read" },
    { key: "search", label: "keyword search" },
    { key: "semanticSearch", label: "semantic search" },
    { key: "prune", label: "prune" },
  ]

  console.log("\nPERFORMANCE SUMMARY — winner per category at each N (lower ms = better)")
  console.log("=".repeat(70))

  for (const n of SCENARIOS) {
    console.log(`\n  N = ${n}`)
    for (const { key, label } of categories) {
      let best: AdapterName | undefined
      let bestMs = Infinity
      for (const name of adapters) {
        const r = results[name].get(n)
        if (!r) continue
        if (r[key] < bestMs) {
          bestMs = r[key]
          best = name
        }
      }
      if (!best) continue
      const parts = adapters.map((name) => {
        const r = results[name].get(n)
        return r ? `${name}: ${formatMs(r[key])}` : `${name}: n/a`
      })
      console.log("    " + pad(label, 18) + " → " + pad(best, 16) + " wins  [" + parts.join("  |  ") + "]")
    }
  }
}

async function main(): Promise<void> {
  console.log("Wunderkind Adapter Performance Benchmark")
  console.log(`Scenarios: N = ${SCENARIOS.join(", ")}  |  Accuracy: N = ${ACCURACY_N}`)
  console.log("")

  const fileDir = await mkdtemp(path.join(os.tmpdir(), "wk-bench-file-"))
  const sqliteDir = await mkdtemp(path.join(os.tmpdir(), "wk-bench-sqlite-"))
  const localVecDir = await mkdtemp(path.join(os.tmpdir(), "wk-bench-localvec-"))
  const dbPath = path.join(sqliteDir, "bench.db")

  const allResults: AllResults = {
    FileAdapter: new Map(),
    SqliteAdapter: new Map(),
    LocalVecAdapter: new Map(),
    VectorAdapter: new Map(),
    Mem0Adapter: new Map(),
  }
  const allAccuracy: AllAccuracy = {
    FileAdapter: null,
    SqliteAdapter: null,
    LocalVecAdapter: null,
    VectorAdapter: null,
    Mem0Adapter: null,
  }
  const activeAdapters: AdapterName[] = ["FileAdapter", "SqliteAdapter"]
  const modelCompareResults: ModelAccuracyResult[] = []

  const fileAdapter = new FileAdapter(fileDir)
  for (const n of SCENARIOS) {
    process.stdout.write(`  FileAdapter     N=${padStart(String(n), 4)} ... `)
    allResults.FileAdapter.set(n, await runScenario(fileAdapter, n, false))
    console.log("done")
  }
  process.stdout.write(`  FileAdapter     accuracy ... `)
  allAccuracy.FileAdapter = await runAccuracy(fileAdapter, false)
  console.log("done")

  const sqliteAdapter = new SqliteAdapter(dbPath)
  for (const n of SCENARIOS) {
    process.stdout.write(`  SqliteAdapter   N=${padStart(String(n), 4)} ... `)
    allResults.SqliteAdapter.set(n, await runScenario(sqliteAdapter, n, false))
    console.log("done")
  }
  process.stdout.write(`  SqliteAdapter   accuracy ... `)
  allAccuracy.SqliteAdapter = await runAccuracy(sqliteAdapter, false)
  console.log("done")

  if (SKIP_LOCAL_VEC) {
    console.log("\n  [local-vec] skipped (--skip-local-vec flag)")
  } else {
    console.log("\n  [local-vec] Warming up ONNX model (Xenova/all-MiniLM-L6-v2) ...")
    const localVecAdapter = new LocalVecAdapter({
      baseDir: localVecDir,
      model: "Xenova/all-MiniLM-L6-v2",
      vectorSize: 384,
    })
    await warmupAdapter(localVecAdapter, "warmup-agent")
    console.log("  [local-vec] model ready")
    activeAdapters.push("LocalVecAdapter")
    for (const n of SCENARIOS) {
      process.stdout.write(`  LocalVecAdapter N=${padStart(String(n), 4)} ... `)
      allResults.LocalVecAdapter.set(n, await runScenario(localVecAdapter, n, true))
      console.log("done")
    }
    process.stdout.write(`  LocalVecAdapter accuracy ... `)
    allAccuracy.LocalVecAdapter = await runAccuracy(localVecAdapter, true)
    console.log("done")

    if (!SKIP_MODEL_COMPARE) {
      console.log("\n  [model-compare] Running accuracy comparison across embedding models ...")
      for (const cfg of MODEL_COMPARE_CONFIGS) {
        const modelDir = await mkdtemp(path.join(os.tmpdir(), "wk-bench-mc-"))
        try {
          process.stdout.write(`  [model-compare] Warming up ${cfg.label} ...`)
          const adapter = new LocalVecAdapter({
            baseDir: modelDir,
            model: cfg.model,
            vectorSize: cfg.vectorSize,
            ...(cfg.queryPrefix !== undefined ? { queryPrefix: cfg.queryPrefix } : {}),
          })
          await warmupAdapter(adapter, "warmup-agent")
          console.log(" ready")
          process.stdout.write(`  [model-compare] ${cfg.label} accuracy ... `)
          const accuracy = await runAccuracy(adapter, true)
          modelCompareResults.push({ label: cfg.label, model: cfg.model, accuracy })
          console.log("done")
        } finally {
          await rm(modelDir, { recursive: true, force: true })
        }
      }
    }
  }

  if (SKIP_VECTOR) {
    console.log("\n  [vector] skipped — pass without --skip-vector to include Qdrant benchmark")
  } else {
    console.log("\n  [vector] Starting Qdrant ...")
    const qdrantReady = await startQdrant()
    if (!qdrantReady) {
      console.warn("  [vector] Qdrant unavailable — skipping VectorAdapter benchmark")
      console.warn("           Ensure Docker is running, or pass --skip-vector to suppress")
    } else {
      const vectorAdapter = new VectorAdapter({
        qdrantUrl: QDRANT_URL,
        model: "Xenova/all-MiniLM-L6-v2",
        vectorSize: 384,
        collectionName: "wk-bench",
        projectSlug: `bench-${Date.now()}`,
      })
      console.log("  [vector] Warming up ONNX model + Qdrant connection ...")
      await warmupAdapter(vectorAdapter, "warmup-agent")
      console.log("  [vector] ready")
      activeAdapters.push("VectorAdapter")
      for (const n of SCENARIOS) {
        process.stdout.write(`  VectorAdapter   N=${padStart(String(n), 4)} ... `)
        allResults.VectorAdapter.set(n, await runScenario(vectorAdapter, n, true))
        console.log("done")
      }
      process.stdout.write(`  VectorAdapter   accuracy ... `)
      allAccuracy.VectorAdapter = await runAccuracy(vectorAdapter, true)
      console.log("done")
      stopQdrant()
    }
  }

  if (SKIP_MEM0) {
    console.log("\n  [mem0]   skipped (requires Ollama with qwen2:0.5b + nomic-embed-text)")
    console.log("           Start services: wunderkind memory start")
    console.log("           Then pass --with-mem0 to include it")
  } else {
    console.log(`\n  [mem0]   Checking Ollama at ${MEM0_OLLAMA_URL} ...`)
    const mem0Ready = await checkOllama(MEM0_OLLAMA_URL)
    if (!mem0Ready) {
      console.warn(`  [mem0]   Ollama unreachable at ${MEM0_OLLAMA_URL} — skipping Mem0Adapter benchmark`)
      console.warn("           Run: wunderkind memory start   (then retry with --with-mem0)")
    } else {
      const mem0Adapter = new Mem0Adapter({
        url: MEM0_URL,
        projectSlug: `bench-${Date.now()}`,
        llmProvider: "ollama",
        llmModel: "qwen2:0.5b",
        llmBaseUrl: MEM0_OLLAMA_URL,
        embedProvider: "ollama",
        embedModel: "nomic-embed-text",
        embedDims: 768,
        embedBaseUrl: MEM0_OLLAMA_URL,
      })
      console.log("  [mem0]   Warming up mem0 service connection ...")
      await warmupAdapter(mem0Adapter, "warmup-agent")
      console.log("  [mem0]   ready")
      activeAdapters.push("Mem0Adapter")
      for (const n of MEM0_SCENARIOS) {
        process.stdout.write(`  Mem0Adapter     N=${padStart(String(n), 4)} ... `)
        allResults.Mem0Adapter.set(n, await runScenario(mem0Adapter, n, true))
        console.log("done")
      }
      console.log("  [mem0]   Skipping accuracy benchmark — mem0 rewrites stored content via LLM")
      console.log("           inference, making corpus index mapping unreliable. See limitations.")
    }
  }

  console.log("\n")
  printPerfTable(allResults, activeAdapters)
  printAccuracyTable(allAccuracy, activeAdapters)
  printAccuracyBreakdown(allAccuracy, activeAdapters)
  if (modelCompareResults.length > 0) {
    printModelCompareTable(modelCompareResults)
  }
  printLimitations(activeAdapters)
  printSummary(allResults, activeAdapters)

  await rm(fileDir, { recursive: true, force: true })
  await rm(sqliteDir, { recursive: true, force: true })
  await rm(localVecDir, { recursive: true, force: true })
}

await main()
