import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"
import { spawnSync } from "node:child_process"
import { DURABLE_ARTIFACT_TOOL_NAME, writeDurableArtifact } from "./artifact-writer.js"
import { readWunderkindConfig } from "./cli/config-manager/index.js"
import { applyWunderkindSystemTransform, buildCompactionContext } from "./runtime-prompt-sections.js"

const OMO_AST_GREP_SG_PATH_ENV_KEY = "OMO_AST_GREP_SG_PATH"

export interface AstGrepEnvOverrideResult {
  readonly applied: boolean
  readonly reason: "not-darwin" | "already-set" | "which-failed" | "version-probe-failed" | "configured"
  readonly binaryPath: string | null
}

function resolveAstGrepBinaryPath(): string | null {
  const result = spawnSync("which", ["ast-grep"], {
    encoding: "utf8",
    timeout: 1500,
    maxBuffer: 1024 * 32,
  })

  if (result.error || result.status !== 0) {
    return null
  }

  const binaryPath = result.stdout.trim()
  return binaryPath === "" ? null : binaryPath
}

function supportsAstGrepVersionProbe(binaryPath: string): boolean {
  const result = spawnSync(binaryPath, ["--version"], {
    encoding: "utf8",
    timeout: 1500,
    maxBuffer: 1024 * 32,
  })

  if (result.error || result.status !== 0) {
    return false
  }

  return `${result.stdout}${result.stderr}`.toLowerCase().includes("ast-grep")
}

export function applyAstGrepMacOsEnvOverride(input?: {
  readonly platform?: NodeJS.Platform
  readonly env?: NodeJS.ProcessEnv
  readonly resolveBinaryPath?: () => string | null
  readonly supportsVersionProbe?: (binaryPath: string) => boolean
}): AstGrepEnvOverrideResult {
  const platform = input?.platform ?? process.platform
  if (platform !== "darwin") {
    return { applied: false, reason: "not-darwin", binaryPath: null }
  }

  const env = input?.env ?? process.env
  const existingValue = env[OMO_AST_GREP_SG_PATH_ENV_KEY]
  if (typeof existingValue === "string" && existingValue.trim() !== "") {
    return { applied: false, reason: "already-set", binaryPath: existingValue }
  }

  const resolveBinaryPath = input?.resolveBinaryPath ?? resolveAstGrepBinaryPath
  const supportsVersionProbe = input?.supportsVersionProbe ?? supportsAstGrepVersionProbe

  const binaryPath = resolveBinaryPath()
  if (binaryPath === null) {
    return { applied: false, reason: "which-failed", binaryPath: null }
  }

  if (!supportsVersionProbe(binaryPath)) {
    return { applied: false, reason: "version-probe-failed", binaryPath }
  }

  env[OMO_AST_GREP_SG_PATH_ENV_KEY] = binaryPath
  return { applied: true, reason: "configured", binaryPath }
}

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
  applyAstGrepMacOsEnvOverride()

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
