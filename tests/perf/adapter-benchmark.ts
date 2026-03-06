import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { FileAdapter } from "../../src/memory/adapters/file.js"
import { SqliteAdapter } from "../../src/memory/adapters/sqlite.js"
import type { MemoryAdapter } from "../../src/memory/adapters/types.js"

const SCENARIOS = [10, 100, 1000]
const SEARCH_KEYWORD = "benchmark"

interface BenchResult {
  write: number
  read: number
  search: number
  prune: number
}

type AdapterName = "FileAdapter" | "SqliteAdapter"

interface AllResults {
  FileAdapter: Map<number, BenchResult>
  SqliteAdapter: Map<number, BenchResult>
}

function pad(s: string, width: number): string {
  return s.padEnd(width)
}

function padStart(s: string, width: number): string {
  return s.padStart(width)
}

async function runScenario(adapter: MemoryAdapter, n: number): Promise<BenchResult> {
  const agent = `bench-agent-${n}`
  const now = Date.now()

  const t0 = performance.now()
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const content = i % 2 === 0
      ? `This entry contains the ${SEARCH_KEYWORD} keyword for search testing`
      : `This is a plain entry number ${i} with no special words`
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

  const half = ids.slice(0, Math.floor(n / 2))
  const t3 = performance.now()
  await adapter.prune(agent, half)
  const pruneMs = performance.now() - t3

  await adapter.deleteAll(agent)

  return {
    write: writeMs,
    read: readMs,
    search: searchMs,
    prune: pruneMs,
  }
}

function formatMs(ms: number): string {
  return ms.toFixed(1) + "ms"
}

function printTable(results: AllResults): void {
  const col0 = 14
  const col1 = 12
  const col2 = 14
  const col3 = 14
  const col4 = 14
  const col5 = 14
  const totalWidth = col0 + col1 + col2 + col3 + col4 + col5 + 7

  const hline = "+" + "-".repeat(totalWidth - 2) + "+"

  console.log(hline)
  console.log(
    "| " +
    pad("Adapter", col0) +
    "| " + pad("N", col1) +
    "| " + pad("Write", col2) +
    "| " + pad("Read", col3) +
    "| " + pad("Search", col4) +
    "| " + pad("Prune", col5) +
    "|"
  )
  console.log(hline)

  for (const n of SCENARIOS) {
    const fr = results.FileAdapter.get(n)
    const sr = results.SqliteAdapter.get(n)
    if (!fr || !sr) continue

    console.log(
      "| " +
      pad("FileAdapter", col0) +
      "| " + pad(String(n), col1) +
      "| " + pad(formatMs(fr.write), col2) +
      "| " + pad(formatMs(fr.read), col3) +
      "| " + pad(formatMs(fr.search), col4) +
      "| " + pad(formatMs(fr.prune), col5) +
      "|"
    )
    console.log(
      "| " +
      pad("SqliteAdapter", col0) +
      "| " + pad(String(n), col1) +
      "| " + pad(formatMs(sr.write), col2) +
      "| " + pad(formatMs(sr.read), col3) +
      "| " + pad(formatMs(sr.search), col4) +
      "| " + pad(formatMs(sr.prune), col5) +
      "|"
    )
    console.log(hline)
  }
}

function printSummary(results: AllResults): void {
  type Category = "write" | "read" | "search" | "prune"
  const categories: Category[] = ["write", "read", "search", "prune"]

  console.log("\nSUMMARY — winner per category at each N (lower ms = better)")
  console.log("=" .repeat(60))

  for (const n of SCENARIOS) {
    const fr = results.FileAdapter.get(n)
    const sr = results.SqliteAdapter.get(n)
    if (!fr || !sr) continue

    console.log(`\n  N = ${n}`)
    for (const cat of categories) {
      const fv = fr[cat]
      const sv = sr[cat]
      const winner: AdapterName = fv <= sv ? "FileAdapter" : "SqliteAdapter"
      const diff = Math.abs(fv - sv)
      console.log(
        "    " +
        pad(cat, 8) +
        " → " +
        pad(winner, 14) +
        " (" + formatMs(diff) + " faster)"
      )
    }
  }
}

async function main(): Promise<void> {
  const fileDir = await mkdtemp(path.join(os.tmpdir(), "wk-bench-file-"))
  const sqliteDir = await mkdtemp(path.join(os.tmpdir(), "wk-bench-sqlite-"))
  const dbPath = path.join(sqliteDir, "bench.db")

  const fileAdapter = new FileAdapter(fileDir)
  const sqliteAdapter = new SqliteAdapter(dbPath)

  console.log("Wunderkind Adapter Performance Benchmark")
  console.log("Running scenarios: N =", SCENARIOS.join(", "))
  console.log("")

  const allResults: AllResults = {
    FileAdapter: new Map(),
    SqliteAdapter: new Map(),
  }

  for (const n of SCENARIOS) {
    process.stdout.write(`  FileAdapter   N=${padStart(String(n), 4)} ... `)
    const fr = await runScenario(fileAdapter, n)
    allResults.FileAdapter.set(n, fr)
    console.log("done")

    process.stdout.write(`  SqliteAdapter N=${padStart(String(n), 4)} ... `)
    const sr = await runScenario(sqliteAdapter, n)
    allResults.SqliteAdapter.set(n, sr)
    console.log("done")
  }

  console.log("")
  printTable(allResults)
  printSummary(allResults)

  await rm(fileDir, { recursive: true, force: true })
  await rm(sqliteDir, { recursive: true, force: true })
}

await main()
