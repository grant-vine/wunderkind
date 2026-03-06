import { Command } from "commander"
import {
  analyzeStaleMemories,
  countMemories,
  exportMemories,
  importMemories,
  memoryStatus,
  pruneMemories,
  searchMemories,
  takeNote,
} from "../memory/index.js"
import { startMemoryServices } from "../memory/docker.js"

const DEFAULT_AGENTS = [
  "marketing-wunderkind",
  "creative-director",
  "product-wunderkind",
  "fullstack-wunderkind",
  "brand-builder",
  "qa-specialist",
  "operations-lead",
  "ciso",
]

export function createMemoryCommand(): Command {
  const cmd = new Command("memory").description("Manage agent memories in .wunderkind/memory/")

  cmd
    .command("take-note")
    .description("Save a note to an agent's memory")
    .requiredOption("--agent <name>", "Agent name (e.g. ciso, fullstack-wunderkind)")
    .requiredOption("--note <text>", "The note content to save")
    .option("--pin", "Pin this memory (never pruned)")
    .option("--slug <slug>", "Custom slug identifier")
    .action(async (opts: { agent: string; note: string; pin?: boolean; slug?: string }) => {
      const options: { slug?: string; pin?: boolean } = {}
      if (opts.slug !== undefined) options.slug = opts.slug
      if (opts.pin !== undefined) options.pin = opts.pin
      const entry = await takeNote(process.cwd(), opts.agent, opts.note, options)
      console.log(`Saved [${entry.slug}] id:${entry.id}`)
    })

  cmd
    .command("search")
    .description("Search an agent's memories")
    .requiredOption("--agent <name>", "Agent name")
    .requiredOption("--query <text>", "Search query")
    .action(async (opts: { agent: string; query: string }) => {
      const results = await searchMemories(process.cwd(), opts.agent, opts.query)
      if (results.length === 0) {
        console.log("No results.")
        return
      }
      for (const e of results) {
        console.log(`[${e.slug}]${e.pinned ? " (pinned)" : ""}\n${e.content}\n`)
      }
    })

  cmd
    .command("count")
    .description("Show memory count and stats for an agent (or all agents)")
    .option("--agent <name>", "Agent name (omit for all agents)")
    .action(async (opts: { agent?: string }) => {
      const agents = opts.agent ? [opts.agent] : DEFAULT_AGENTS
      for (const agent of agents) {
        const stats = await countMemories(process.cwd(), agent)
        const oldest = stats.oldest > 0 ? new Date(stats.oldest).toISOString().split("T")[0] : "—"
        const newest = stats.newest > 0 ? new Date(stats.newest).toISOString().split("T")[0] : "—"
        console.log(`${agent}: total=${stats.total} pinned=${stats.pinned} oldest=${oldest} newest=${newest}`)
      }
    })

  cmd
    .command("reduce-noise")
    .description("Analyze and optionally prune stale memories for an agent")
    .requiredOption("--agent <name>", "Agent name")
    .option("--confirm", "Actually remove stale entries (default: preview only)")
    .action(async (opts: { agent: string; confirm?: boolean }) => {
      const analysis = await analyzeStaleMemories(process.cwd(), opts.agent)
      if (analysis.stale === 0) {
        console.log(`All ${analysis.toKeep.length} memories are current.`)
        return
      }
      console.log(`Stale: ${analysis.stale} | Recent: ${analysis.recent} | Pinned: ${analysis.pinned}`)
      for (const e of analysis.toDrop) {
        console.log(`  - [${e.slug}] ${e.content.slice(0, 80)}`)
      }
      if (!opts.confirm) {
        console.log("\nRun with --confirm to remove these entries.")
        return
      }
      const removed = await pruneMemories(process.cwd(), opts.agent, analysis.toDrop.map((e) => e.id))
      console.log(`Removed ${removed} entries.`)
    })

  cmd
    .command("status")
    .description("Check the health of the configured memory adapter")
    .action(async () => {
      const result = await memoryStatus(process.cwd())
      console.log(result.ok ? `OK: ${result.message}` : `ERROR: ${result.message}`)
      if (!result.ok) process.exit(1)
    })

  cmd
    .command("start")
    .description("Start memory services (Docker Compose for mem0 adapter; no-op for file/sqlite)")
    .action(() => {
      const result = startMemoryServices(process.cwd())
      console.log(result.success ? result.message : `Error: ${result.message}`)
      if (!result.success) process.exit(1)
    })

  cmd
    .command("export")
    .description("Export all agent memories to a zip file in .wunderkind/exports/")
    .option("--output <path>", "Custom output path for the zip file")
    .action(async (opts: { output?: string }) => {
      try {
        const outPath = opts.output !== undefined
          ? await exportMemories(process.cwd(), opts.output)
          : await exportMemories(process.cwd())
        console.log(`Exported memories to: ${outPath}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Export failed: ${msg}`)
        process.exit(1)
      }
    })

  cmd
    .command("import <zip>")
    .description("Import memories from a zip file created by 'memory export'")
    .option("--strategy <strategy>", "Import strategy: merge or overwrite", "merge")
    .action(async (zip: string, opts: { strategy: string }) => {
      if (opts.strategy !== "merge" && opts.strategy !== "overwrite") {
        console.error(`Error: --strategy must be "merge" or "overwrite", got: "${opts.strategy}"`)
        process.exit(1)
      }
      try {
        const result = await importMemories(process.cwd(), zip, opts.strategy)
        console.log(`Imported: ${result.imported}, Skipped: ${result.skipped}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Import failed: ${msg}`)
        process.exit(1)
      }
    })

  return cmd
}
