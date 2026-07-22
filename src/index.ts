import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"
import { DURABLE_ARTIFACT_TOOL_NAME, writeDurableArtifact } from "./artifact-writer.js"
import { readWunderkindConfig } from "./cli/config-manager/index.js"
import { applyWunderkindSystemTransform, buildCompactionContext } from "./runtime-prompt-sections.js"

const NON_FULLSTACK_RETAINED_AGENTS = new Set([
  "marketing-wunderkind",
  "creative-director",
  "product-wunderkind",
  "ciso",
  "legal-counsel",
])

const SHELL_FILE_MUTATION_PATTERNS = [
  />/,
  />>/,
  /\btee\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\brm\b/,
  /\btouch\b/,
  /\bmkdir\b/,
  /\btruncate\b/,
  /\bsed\b/,
  /\bawk\b/,
  /\bperl\b/,
  /\bpython\b.*\bwrite\b/,
  /\bnode\b.*\bwrite\b/,
] as const

function inferPermissionAgent(metadata: Record<string, unknown>): string | null {
  const directAgent = metadata["agent"]
  if (typeof directAgent === "string" && directAgent.trim() !== "") return directAgent

  const nestedAgent = metadata["agentID"]
  if (typeof nestedAgent === "string" && nestedAgent.trim() !== "") return nestedAgent

  return null
}

function shouldDenyShellMutation(pattern: string | string[] | undefined, metadata: Record<string, unknown>): boolean {
  const agent = inferPermissionAgent(metadata)
  if (!agent || !NON_FULLSTACK_RETAINED_AGENTS.has(agent)) return false

  const rawPattern = Array.isArray(pattern) ? pattern.join(" ") : (pattern ?? "")
  const normalized = rawPattern.toLowerCase()

  return SHELL_FILE_MUTATION_PATTERNS.some((regex) => regex.test(normalized))
}

const WunderkindPlugin: Plugin = async (_input) => {
  return {
    tool: {
      [DURABLE_ARTIFACT_TOOL_NAME]: tool({
        description:
          "Append durable memory only inside protected Wunderkind lanes such as .omo/notepads or .omo/evidence. Use normal Write/Edit for ordinary repo files, docs-output, DESIGN.md, Stitch files, and planning files.",
        args: {
          relativePath: tool.schema.string().min(1),
          content: tool.schema.string(),
        },
        async execute(args, context) {
          const wunderkindConfig = readWunderkindConfig()
          const durableArtifactOptions =
            typeof wunderkindConfig?.docsPath === "string"
              ? { docsPath: wunderkindConfig.docsPath }
              : undefined

          const result = writeDurableArtifact(
            {
              relativePath: args.relativePath,
              content: args.content,
            },
            context.directory,
            durableArtifactOptions,
          )
          context.metadata({
            title: `Durable artifact written: ${result.relativePath}`,
            metadata: {
              path: result.relativePath,
              created: result.created,
              mode: "append",
            },
          })

          return `Durable artifact written to ${result.relativePath}`
        },
      }),
    },
    "permission.ask": async (input, output) => {
      if (input.type === "bash" && shouldDenyShellMutation(input.pattern, input.metadata)) {
        output.status = "deny"
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      const wunderkindConfig = readWunderkindConfig()
      output.context.push(...buildCompactionContext(wunderkindConfig))
    },
    "experimental.chat.system.transform": async (_input, output) => {
      const wunderkindConfig = readWunderkindConfig()
      applyWunderkindSystemTransform({
        system: output.system,
        wunderkindConfig,
      })
    },
  }
}

export { WunderkindPlugin as default }
