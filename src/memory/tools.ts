import { tool } from "@opencode-ai/plugin/dist/tool.js"
import type { ToolContext, ToolDefinition } from "@opencode-ai/plugin/dist/tool.js"
import {
  analyzeStaleMemories,
  countMemories,
  pruneMemories,
  searchMemories,
  takeNote,
} from "./index.js"

export function createMemoryTools(): Record<string, ToolDefinition> {
  return {
    wunderkind_take_note: tool({
      description:
        "Save a note to your persistent memory. Use this to remember project-specific facts, decisions, patterns, and preferences for future sessions.",
      args: {
        note: tool.schema.string().describe("The content to remember"),
        slug: tool.schema
          .string()
          .optional()
          .describe("Short identifier slug (auto-generated if omitted)"),
        pin: tool.schema
          .boolean()
          .optional()
          .describe("Pin this memory so it is never pruned by reduce_noise"),
      },
      async execute(args: { note: string; slug?: string; pin?: boolean }, context: ToolContext) {
        const options: { slug?: string; pin?: boolean } = {}
        if (args.slug !== undefined) options.slug = args.slug
        if (args.pin !== undefined) options.pin = args.pin
        const entry = await takeNote(context.directory, context.agent, args.note, options)
        return `Memory saved [${entry.slug}] (id: ${entry.id})`
      },
    }),

    wunderkind_search_memories: tool({
      description:
        "Search your persistent memory for relevant past knowledge. Returns the most relevant memories for your query.",
      args: {
        query: tool.schema.string().describe("What to search for"),
      },
      async execute(args: { query: string }, context: ToolContext) {
        const results = await searchMemories(context.directory, context.agent, args.query)
        if (results.length === 0) return "No memories found matching your query."
        return results
          .map((e) => `[${e.slug}] ${e.content}${e.pinned ? " (pinned)" : ""}`)
          .join("\n\n")
      },
    }),

    wunderkind_count_memories: tool({
      description: "Get a count and summary of your persistent memories.",
      args: {},
      async execute(_args: Record<string, never>, context: ToolContext) {
        const stats = await countMemories(context.directory, context.agent)
        if (stats.total === 0) return "No memories stored yet."
        const oldest = stats.oldest > 0 ? new Date(stats.oldest).toISOString().split("T")[0] : "—"
        const newest = stats.newest > 0 ? new Date(stats.newest).toISOString().split("T")[0] : "—"
        return `Total: ${stats.total} | Pinned: ${stats.pinned} | Oldest: ${oldest} | Newest: ${newest}`
      },
    }),

    wunderkind_reduce_noise: tool({
      description:
        "Analyze your memories for stale entries. Without confirm=true, shows what would be removed. With confirm=true, removes the stale entries.",
      args: {
        confirm: tool.schema
          .boolean()
          .optional()
          .describe("Set to true to actually remove stale memories. Omit or false to preview only."),
      },
      async execute(args: { confirm?: boolean }, context: ToolContext) {
        const analysis = await analyzeStaleMemories(context.directory, context.agent)
        if (analysis.stale === 0) {
          return `All ${analysis.toKeep.length} memories are current. Nothing to prune.`
        }

        const preview = analysis.toDrop
          .map((e) => `  - [${e.slug}] ${e.content.slice(0, 80)}...`)
          .join("\n")

        if (!args.confirm) {
          return [
            `Found ${analysis.stale} stale memories to remove (${analysis.pinned} pinned, ${analysis.recent} recent kept):`,
            preview,
            "",
            "Call wunderkind_reduce_noise with confirm=true to proceed.",
          ].join("\n")
        }

        const removed = await pruneMemories(
          context.directory,
          context.agent,
          analysis.toDrop.map((e) => e.id),
        )
        return `Pruned ${removed} memories. Kept ${analysis.toKeep.length} (${analysis.pinned} pinned, ${analysis.recent} recent).`
      },
    }),
  }
}
