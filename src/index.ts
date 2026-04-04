import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AGENT_DOCS_CONFIG } from "./agents/docs-config.js"
import { DURABLE_ARTIFACT_TOOL_NAME, writeDurableArtifact } from "./artifact-writer.js"
import { readWunderkindConfig } from "./cli/config-manager/index.js"

const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"

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

const WunderkindPlugin: Plugin = async (_input) => {
  return {
    tool: {
      [DURABLE_ARTIFACT_TOOL_NAME]: tool({
        description:
          "Write a durable Wunderkind artifact within an agent-specific bounded lane such as .sisyphus PRDs/plans/issues, docs-output files, DESIGN.md, or notepads.",
        args: {
          agentKey: tool.schema.enum([
            "marketing-wunderkind",
            "creative-director",
            "product-wunderkind",
            "fullstack-wunderkind",
            "ciso",
            "legal-counsel",
          ]),
          kind: tool.schema.enum(["prd", "plan", "issue", "docs-output", "design-md", "notepad"]),
          relativePath: tool.schema.string().min(1),
          content: tool.schema.string(),
        },
        async execute(args, context) {
          await context.ask({
            permission: "edit",
            patterns: [args.relativePath],
            always: [args.relativePath],
            metadata: {
              title: `Write durable artifact: ${args.relativePath}`,
              agentKey: args.agentKey,
              kind: args.kind,
            },
          })

          const result = writeDurableArtifact(args, context.directory)
          context.metadata({
            title: `Durable artifact written: ${result.relativePath}`,
            metadata: {
              path: result.relativePath,
              created: result.created,
              agentKey: args.agentKey,
              kind: args.kind,
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
    "experimental.chat.system.transform": async (_input, output) => {
      const wunderkindConfig = readWunderkindConfig()
      const hasDocsOutputSentinel = output.system.join("").includes(DOCS_OUTPUT_SENTINEL)

      if (wunderkindConfig?.docsEnabled === true && !hasDocsOutputSentinel) {
        const docsPath = wunderkindConfig.docsPath ?? "./docs"
        const docHistoryMode = wunderkindConfig.docHistoryMode ?? "append-dated"
        const docsTargets = Object.entries(AGENT_DOCS_CONFIG)
          .filter(([, config]) => config.eligible)
          .map(([agentKey, config]) => `- ${agentKey}: ${docsPath}/${config.canonicalFilename}`)
          .join("\n")

        output.system.push(`
${DOCS_OUTPUT_SENTINEL}
## Documentation Output

Documentation output is enabled for this project. Use these resolved runtime values instead of re-reading config files.

- docsPath: ${docsPath}
- docHistoryMode: ${docHistoryMode}
- docs scope: current project root only

### History Mode Behavior

\`/docs-index\` uses a shared UTC timestamp contract (format: \`YYYY-MM-DDTHH-mm-ssZ\`, e.g. \`2026-03-12T18-37-52Z\`) for timestamped history modes:

- **\`append-dated\`**: Appends a new section heading \`## Update <UTC_TOKEN>\` to the canonical home file. Multiple same-day updates use collision suffixes: \`## Update <UTC_TOKEN> (2)\`, \`(3)\`, etc.
- **\`new-dated-file\`**: Writes a timestamped file \`<basename>--<UTC_TOKEN>.md\` alongside the canonical home file. For collisions, use suffixes: \`<basename>--<UTC_TOKEN>--2.md\`, \`--3.md\`, etc. These files are managed family members of the canonical home file, not legacy artifacts.

Treat the canonical unsuffixed files below as managed home files. Within \`/docs-index\`, refresh them if present or bootstrap them if missing for \`append-dated\`. For \`new-dated-file\`, write timestamped family files alongside the canonical home file.

Eligible Wunderkind docs targets:
${docsTargets}
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
- Use \`${DURABLE_ARTIFACT_TOOL_NAME}(...)\` for bounded durable artifact writes such as PRDs, plans, issues, docs-output lanes, DESIGN.md, and allowed notepads.

### Project Configuration

Global and project-local Wunderkind config are merged at runtime.
Treat the resolved runtime context above as the source of truth for region, industry, regulations, team culture, org structure, and personality guidance.
`.split("\u0000").join("").trim())
    },
  }
}

export { WunderkindPlugin as default }
