import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AGENT_DOCS_CONFIG } from "./agents/docs-config.js"
import { DURABLE_ARTIFACT_TOOL_NAME, writeDurableArtifact } from "./artifact-writer.js"
import { resolveProjectLocalDocsPath } from "./cli/docs-output-helper.js"
import { readWunderkindConfig } from "./cli/config-manager/index.js"

const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"

function isReservedDocsPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "")
  return normalized === "DESIGN.md" || normalized.startsWith("DESIGN.md/")
}

function getDocsOutputRuntimeState(configuredDocsPath: string): {
  displayDocsPath: string
  docsTargets: string
  warning: string | null
} {
  try {
    const resolvedDocs = resolveProjectLocalDocsPath(configuredDocsPath, process.cwd()).docsPath

    if (isReservedDocsPath(resolvedDocs)) {
      return {
        displayDocsPath: configuredDocsPath,
        docsTargets: "- docs-output invalid: configured docsPath conflicts with reserved design-md path DESIGN.md",
        warning:
          `The configured docsPath (${configuredDocsPath}) is invalid for docs-output because it conflicts with the reserved design-md path \`DESIGN.md\`. Normal docs-output writes should be redirected to a non-conflicting directory before continuing.`,
      }
    }

    return {
      displayDocsPath: resolvedDocs,
      docsTargets: Object.entries(AGENT_DOCS_CONFIG)
        .filter(([, config]) => config.eligible)
        .map(([agentKey, config]) => `- ${agentKey}: ${resolvedDocs}/${config.canonicalFilename}`)
        .join("\n"),
      warning: null,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid docsPath"
    return {
      displayDocsPath: configuredDocsPath,
      docsTargets: `- docs-output invalid: configured docsPath is invalid (${reason})`,
      warning:
        `The configured docsPath (${configuredDocsPath}) is invalid for docs-output: ${reason}. Normal docs-output writes should be redirected to a valid project-local directory before continuing.`,
    }
  }
}

const SOUL_HEADING_MARKERS = [
  { heading: "# Product Wunderkind", agentKey: "product-wunderkind" },
  { heading: "# Fullstack Wunderkind", agentKey: "fullstack-wunderkind" },
  { heading: "# Marketing Wunderkind", agentKey: "marketing-wunderkind" },
  { heading: "# Creative Director", agentKey: "creative-director" },
  { heading: "# CISO", agentKey: "ciso" },
  { heading: "# Legal Counsel", agentKey: "legal-counsel" },
] as const

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

function detectActiveSoulAgent(systemSections: readonly string[]): (typeof SOUL_HEADING_MARKERS)[number]["agentKey"] | null {
  const systemText = systemSections.join("\n")
  for (const marker of SOUL_HEADING_MARKERS) {
    if (systemText.includes(marker.heading)) {
      return marker.agentKey
    }
  }
  return null
}

function readSoulOverlay(agentKey: (typeof SOUL_HEADING_MARKERS)[number]["agentKey"]): string | null {
  const soulPath = join(process.cwd(), ".wunderkind", "souls", `${agentKey}.md`)

  try {
    const content = readFileSync(soulPath, "utf-8").trim()
    return content === "" ? null : content
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }
    throw err
  }
}

function buildCompactionContext(wunderkindConfig: ReturnType<typeof readWunderkindConfig>): string[] {
  const context = [
    `## Wunderkind compaction priorities

Preserve any active retained-agent routing decisions, delegated specialists, loaded Wunderkind skills, and unfinished task graph state. If parallel subagents were launched, keep which subtasks are complete, still running, blocked, or waiting for synthesis. Do not collapse delegated findings into generic summaries that lose ownership or next-step clarity.`,
    `## Wunderkind delegation continuity

If the session already delegated research, exploration, or implementation work, preserve the delegated outputs and the synthesis still required. Do not restart the same search loop after compaction unless the preserved output says it was insufficient. Respect upstream background-agent depth limits by favoring continuation of existing delegated work over spawning redundant nested agents.`,
    `## Wunderkind mode continuity

Preserve whether caveman mode was enabled for the active chat. If the user explicitly turned terse mode on or off, keep that mode decision across compaction unless the user later changed it.`,
  ]

  if (wunderkindConfig) {
    context.push(`## Wunderkind runtime context

Preserve the resolved runtime context across compaction:
- region: ${wunderkindConfig.region ?? "Global"}
- industry: ${(wunderkindConfig.industry ?? "").trim() !== "" ? wunderkindConfig.industry : "(not set)"}
- primary regulation: ${(wunderkindConfig.primaryRegulation ?? "").trim() !== "" ? wunderkindConfig.primaryRegulation : "(not set)"}
- secondary regulation: ${(wunderkindConfig.secondaryRegulation ?? "").trim() !== "" ? wunderkindConfig.secondaryRegulation : "(not set)"}
- team culture: ${wunderkindConfig.teamCulture ?? "pragmatic-balanced"}
- org structure: ${wunderkindConfig.orgStructure ?? "flat"}`)

    if (wunderkindConfig.docsEnabled === true) {
      const docsPath = wunderkindConfig.docsPath ?? "./docs"
      const docHistoryMode = wunderkindConfig.docHistoryMode ?? "append-dated"
      const docsOutputRuntimeState = getDocsOutputRuntimeState(docsPath)
      context.push(`## Wunderkind docs-output continuity

Preserve docs-output decisions and pending writes:
- docsPath: ${docsOutputRuntimeState.displayDocsPath}
- docHistoryMode: ${docHistoryMode}
- docs scope: current project root only`)
    }

    if ((wunderkindConfig.prdPipelineMode ?? "filesystem") === "github") {
      context.push(`## Wunderkind workflow continuity

The project is using github PRD/workflow mode. Preserve any active GitHub issue, PRD, triage, or label-mapping decisions instead of downgrading them to generic filesystem-only guidance.`)
    }
  }

  return context
}

const WunderkindPlugin: Plugin = async (_input) => {
  return {
    tool: {
      [DURABLE_ARTIFACT_TOOL_NAME]: tool({
        description:
          "Append durable memory only inside protected Wunderkind lanes such as .sisyphus/notepads or .sisyphus/evidence. Use normal Write/Edit for ordinary repo files, docs-output, DESIGN.md, Stitch files, and planning files.",
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
      const hasDocsOutputSentinel = output.system.join("").includes(DOCS_OUTPUT_SENTINEL)

      if (wunderkindConfig?.docsEnabled === true && !hasDocsOutputSentinel) {
        const docsPath = wunderkindConfig.docsPath ?? "./docs"
        const docHistoryMode = wunderkindConfig.docHistoryMode ?? "append-dated"
        const docsOutputRuntimeState = getDocsOutputRuntimeState(docsPath)
        const docsPathWarning = docsOutputRuntimeState.warning
          ? `\n\n### Docs Output Warning\n\n${docsOutputRuntimeState.warning}\n`
          : ""

        output.system.push(`
${DOCS_OUTPUT_SENTINEL}
## Documentation Output

Documentation output is enabled for this project. Use these resolved runtime values instead of re-reading config files.

- docsPath: ${docsOutputRuntimeState.displayDocsPath}
- docHistoryMode: ${docHistoryMode}
- docs scope: current project root only

### History Mode Behavior

\`/docs-index\` uses a shared UTC timestamp contract (format: \`YYYY-MM-DDTHH-mm-ssZ\`, e.g. \`2026-03-12T18-37-52Z\`) for timestamped history modes:

- **\`append-dated\`**: Appends a new section heading \`## Update <UTC_TOKEN>\` to the canonical home file. Multiple same-day updates use collision suffixes: \`## Update <UTC_TOKEN> (2)\`, \`(3)\`, etc.
- **\`new-dated-file\`**: Writes a timestamped file \`<basename>--<UTC_TOKEN>.md\` alongside the canonical home file. For collisions, use suffixes: \`<basename>--<UTC_TOKEN>--2.md\`, \`--3.md\`, etc. These files are managed family members of the canonical home file, not legacy artifacts.

Treat the canonical unsuffixed files below as managed home files. Within \`/docs-index\`, refresh them if present or bootstrap them if missing for \`append-dated\`. For \`new-dated-file\`, write timestamped family files alongside the canonical home file.

${docsPathWarning}

Eligible Wunderkind docs targets:
${docsOutputRuntimeState.docsTargets}
`.trim())
      }

      if (wunderkindConfig) {
        output.system.push(`
## Wunderkind Resolved Runtime Context

Use this resolved Wunderkind configuration as the authoritative runtime context for this session.

- region: ${wunderkindConfig.region ?? "Global"}
- industry: ${(wunderkindConfig.industry ?? "").trim() !== "" ? wunderkindConfig.industry : "(not set)"}
- primary regulation: ${(wunderkindConfig.primaryRegulation ?? "").trim() !== "" ? wunderkindConfig.primaryRegulation : "(not set)"}
- secondary regulation: ${(wunderkindConfig.secondaryRegulation ?? "").trim() !== "" ? wunderkindConfig.secondaryRegulation : "(not set)"}
- team culture: ${wunderkindConfig.teamCulture ?? "pragmatic-balanced"}
- org structure: ${wunderkindConfig.orgStructure ?? "flat"}

If a prompt references .wunderkind/wunderkind.config.jsonc for baseline or personality context, use the resolved values above first.
`.trim())
      }

      const activeSoulAgent = detectActiveSoulAgent(output.system)
      if (activeSoulAgent) {
        const soulSentinel = `<!-- wunderkind:soul-runtime-start:${activeSoulAgent} -->`
        const hasSoulSentinel = output.system.join("").includes(soulSentinel)

        if (!hasSoulSentinel) {
          const soulOverlay = readSoulOverlay(activeSoulAgent)
          if (soulOverlay) {
            output.system.push(`
${soulSentinel}
## Wunderkind SOUL Overlay

Use this project-local SOUL overlay as additive guidance for the active persona. It refines the neutral base prompt with project-specific customization and durable learned context. If it conflicts with an explicit user instruction, follow the user.

${soulOverlay}
`.trim())
          }
        }
      }

      output.system.push(`
## Wunderkind Native Agents

The following specialist agents are available as native OpenCode agents. Delegate to them when their domain matches.

### Orchestrator

- product-wunderkind — **Default front door for all Wunderkind requests.** Start here for mixed-domain, ambiguous, or cross-functional work. product-wunderkind clarifies intent, routes to the right specialist, and synthesises the final answer. VP Product authority: roadmaps, OKRs, PRDs, issue intake, acceptance review, sprint planning, experiments, and decomposition.

### Specialists

- marketing-wunderkind — Brand strategy, go-to-market, content marketing, SEO/SEM, paid media, PR, community, developer advocacy, docs-led launches, tutorials, migration guidance, funnels, attribution, and channel ROI
- creative-director — Brand identity, design systems, UI/UX, typography, colour palettes, accessibility, design tokens, visual language
- fullstack-wunderkind — Full-stack engineering, frontend, backend, database, infrastructure, Vercel, AI integration, architecture, TDD, technical diagnosis, reliability, runbooks, incidents, and admin tooling
- ciso — Security architecture, OWASP, threat modelling, compliance (GDPR/CCPA/POPIA/LGPD), pen testing coordination, security incidents, and breach response
- legal-counsel — OSS licensing, TOS/Privacy Policy drafting, DPAs, CLAs, contract review, GDPR/CCPA legal obligations

### Routing

- Default: route all Wunderkind requests to product-wunderkind first unless the domain is clearly single-specialist.
- Route directly to marketing-wunderkind for GTM, brand, community, developer advocacy, docs-led launches, tutorials, migration support, funnel interpretation, and adoption work.
- Route directly to fullstack-wunderkind for engineering implementation, architecture, TDD, technical diagnosis, reliability engineering, runbooks, incidents, and supportability.
- Route directly to creative-director for visual, UX, and design-system work.
- Route directly to ciso for security architecture, compliance controls, threat modeling, and security-incident posture.
- Route directly to legal-counsel for OSS licensing and legal/compliance review.

Legacy delegation shorthand remains valid: Use marketing-wunderkind for GTM, brand, community, developer advocacy, docs-led launches, tutorials, migration support, funnel interpretation, and adoption work. Use fullstack-wunderkind for engineering implementation, architecture, TDD, technical diagnosis, reliability engineering, runbooks, incidents, and supportability. Use legal-counsel for OSS licensing and legal/compliance review.

### Tool Usage

- Use \`task(...)\` for retained-agent or subagent delegation; always include explicit \`load_skills\` and \`run_in_background\`.
- Use \`skill(name="...")\` for shipped skills and sub-skills.
- Use normal \`Write\`/\`Edit\` for ordinary repo files, docs-output, \`DESIGN.md\`, \`.wunderkind/stitch/\`, and managed \`.sisyphus/\` planning files. Use \`${DURABLE_ARTIFACT_TOOL_NAME}(...)\` only for append-only Wunderkind memory lanes such as \`.sisyphus/notepads/\` and \`.sisyphus/evidence/\`.

### Caveman Mode

- Caveman mode is available in any chat when the user explicitly asks for \`caveman mode\`, \`be brief\`, \`less tokens\`, or similar terse-mode language.
- When a chat enables caveman mode, keep replies compressed but exact. Do not alter code blocks, commands, exact errors, or safety-critical warnings.
- Session-scoped caveman mode stays active until the user asks to turn it off or normal clarity is temporarily required for safety.
${wunderkindConfig?.cavemanEnabled === true
  ? `- This project has project-default caveman mode enabled. Product, fullstack, and marketing may use terse high-signal replies by default when they would preserve the same value. Creative may do this for status or logistics only. CISO and legal-counsel should stay in normal explicit mode unless the user asks for caveman mode directly.`
  : ""}

### Project Configuration

Global and project-local Wunderkind config are merged at runtime.
Treat the resolved runtime context above as the source of truth for region, industry, regulations, team culture, org structure, and personality guidance.
`.split("\u0000").join("").trim())
    },
  }
}

export { WunderkindPlugin as default }
