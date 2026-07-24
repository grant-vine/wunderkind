import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AGENT_DOCS_CONFIG } from "./agents/docs-config.js"
import { DURABLE_ARTIFACT_TOOL_NAME } from "./artifact-writer.js"
import { resolveProjectLocalDocsPath } from "./cli/docs-output-helper.js"
import { readWunderkindConfig } from "./cli/config-manager/index.js"

export const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"
export const RUNTIME_CONTEXT_SENTINEL = "<!-- wunderkind:runtime-context-start -->"
export const NATIVE_AGENTS_SENTINEL = "<!-- wunderkind:native-agents-start -->"
export const COMPACTION_CONTINUITY_FLOOR_TEXT =
  "Compaction continuity preserved. Earlier compaction context was removed only for byte budget."

export type PromptOptimizationRuntimeSectionId =
  | "runtime-docs-output"
  | "runtime-context"
  | "runtime-native-agents"
  | "compaction-continuity"

export interface PromptOptimizationRuntimeSection {
  readonly id: PromptOptimizationRuntimeSectionId
  readonly content: string
}

export interface PromptOptimizationRuntimeTrimResult {
  readonly sections: readonly PromptOptimizationRuntimeSection[]
  readonly trimApplied: boolean
  readonly trimExhausted: boolean
  readonly trimmedSections: readonly PromptOptimizationRuntimeSectionId[]
}

const ACTIVE_RUNTIME_TRIM_ORDER = [
  "runtime-native-agents",
  "runtime-docs-output",
  "compaction-continuity",
] as const satisfies readonly PromptOptimizationRuntimeSectionId[]

const SOUL_HEADING_MARKERS = [
  { heading: "# Product Wunderkind", agentKey: "product-wunderkind" },
  { heading: "# Fullstack Wunderkind", agentKey: "fullstack-wunderkind" },
  { heading: "# Marketing Wunderkind", agentKey: "marketing-wunderkind" },
  { heading: "# Creative Director", agentKey: "creative-director" },
  { heading: "# CISO", agentKey: "ciso" },
  { heading: "# Legal Counsel", agentKey: "legal-counsel" },
] as const

function joinRuntimeSections(sections: readonly PromptOptimizationRuntimeSection[]): string {
  return sections
    .map((section) => section.content)
    .filter((content) => content !== "")
    .join("\n")
}

function getTrimmedSectionContent(sectionId: PromptOptimizationRuntimeSectionId): string | null {
  switch (sectionId) {
    case "runtime-native-agents":
    case "runtime-docs-output":
      return ""
    case "compaction-continuity":
      return COMPACTION_CONTINUITY_FLOOR_TEXT
    case "runtime-context":
      return null
  }
}

function getActiveRuntimePromptOptimizationByteBudget(
  wunderkindConfig: ReturnType<typeof readWunderkindConfig>,
): number | null {
  if (wunderkindConfig?.promptOptimizationEnabled === false) {
    return null
  }

  if (wunderkindConfig?.promptOptimizationMode !== "active") {
    return null
  }

  return typeof wunderkindConfig.promptOptimizationByteBudget === "number"
    ? wunderkindConfig.promptOptimizationByteBudget
    : null
}

export function trimPromptOptimizationRuntimeSections(
  sections: readonly PromptOptimizationRuntimeSection[],
  byteBudget: number,
): PromptOptimizationRuntimeTrimResult {
  const trimmedSections = sections.map((section) => ({ ...section }))
  const appliedSectionIds: PromptOptimizationRuntimeSectionId[] = []

  if (Buffer.byteLength(joinRuntimeSections(trimmedSections), "utf8") <= byteBudget) {
    return {
      sections: trimmedSections,
      trimApplied: false,
      trimExhausted: false,
      trimmedSections: [],
    }
  }

  for (const sectionId of ACTIVE_RUNTIME_TRIM_ORDER) {
    if (Buffer.byteLength(joinRuntimeSections(trimmedSections), "utf8") <= byteBudget) {
      break
    }

    const sectionIndex = trimmedSections.findIndex((section) => section.id === sectionId)
    if (sectionIndex === -1) {
      continue
    }

    const replacementContent = getTrimmedSectionContent(sectionId)
    if (replacementContent === null) {
      continue
    }

    const section = trimmedSections[sectionIndex]
    if (!section || section.content === replacementContent) {
      continue
    }

    trimmedSections[sectionIndex] = {
      ...section,
      content: replacementContent,
    }
    appliedSectionIds.push(sectionId)
  }

  const remainingBytes = Buffer.byteLength(joinRuntimeSections(trimmedSections), "utf8")

  return {
    sections: trimmedSections,
    trimApplied: appliedSectionIds.length > 0,
    trimExhausted: appliedSectionIds.length > 0 && remainingBytes > byteBudget,
    trimmedSections: appliedSectionIds,
  }
}

function isReservedDocsPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "")
  return normalized === "DESIGN.md" || normalized.startsWith("DESIGN.md/")
}

function getDocsOutputRuntimeState(configuredDocsPath: string, cwd: string): {
  displayDocsPath: string
  docsTargets: string
  warning: string | null
} {
  try {
    const resolvedDocs = resolveProjectLocalDocsPath(configuredDocsPath, cwd).docsPath

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

function detectActiveSoulAgent(systemSections: readonly string[]): (typeof SOUL_HEADING_MARKERS)[number]["agentKey"] | null {
  const systemText = systemSections.join("\n")
  for (const marker of SOUL_HEADING_MARKERS) {
    if (systemText.includes(marker.heading)) {
      return marker.agentKey
    }
  }
  return null
}

function readSoulOverlay(agentKey: (typeof SOUL_HEADING_MARKERS)[number]["agentKey"], cwd: string): string | null {
  const soulPath = join(cwd, ".wunderkind", "souls", `${agentKey}.md`)

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

export function buildCompactionContext(
  wunderkindConfig: ReturnType<typeof readWunderkindConfig>,
  cwd: string = process.cwd(),
): string[] {
  const context = [
    `## Wunderkind compaction priorities

Preserve any active retained-agent routing decisions, delegated specialists, loaded Wunderkind skills, and unfinished task graph state. If parallel subagents were launched, keep which subtasks are complete, still running, blocked, or waiting for synthesis. Do not collapse delegated findings into generic summaries that lose ownership or next-step clarity.`,
    `## Wunderkind delegation continuity

If the session already delegated research, exploration, or implementation work, preserve the delegated outputs and the synthesis still required. Preserve every active background task id (\`bg_...\`) separately from any agent session id (\`ses_...\`), and keep whether the parent is still waiting for a completion reminder or is ready to call \`background_output\`. Do not restart the same search loop after compaction unless the preserved output says it was insufficient. Respect upstream background-agent depth limits by favoring continuation of existing delegated work over spawning redundant nested agents.`,
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
      const docsOutputRuntimeState = getDocsOutputRuntimeState(docsPath, cwd)
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

  const activeByteBudget = getActiveRuntimePromptOptimizationByteBudget(wunderkindConfig)
  if (activeByteBudget === null) {
    return context
  }

  const trimResult = trimPromptOptimizationRuntimeSections(
    [{ id: "compaction-continuity", content: context.join("\n") }],
    activeByteBudget,
  )

  if (!trimResult.trimApplied) {
    return context
  }

  const trimmedCompactionSection = trimResult.sections[0]
  if (!trimmedCompactionSection || trimmedCompactionSection.content === "") {
    return []
  }

  return [trimmedCompactionSection.content]
}

export function applyWunderkindSystemTransform(options: {
  system: string[]
  wunderkindConfig: ReturnType<typeof readWunderkindConfig>
  cwd?: string
}): void {
  const cwd = options.cwd ?? process.cwd()
  const existingSystemContent = options.system.join("")
  const hasDocsOutputSentinel = existingSystemContent.includes(DOCS_OUTPUT_SENTINEL)
  const hasRuntimeContextSentinel = existingSystemContent.includes(RUNTIME_CONTEXT_SENTINEL)
  const hasNativeAgentsSentinel = existingSystemContent.includes(NATIVE_AGENTS_SENTINEL)
  const wunderkindConfig = options.wunderkindConfig
  let docsOutputSection: string | null = null
  let runtimeContextSection: string | null = null
  let soulOverlaySection: string | null = null
  let nativeAgentsSection: string | null = null

  if (wunderkindConfig?.docsEnabled === true && !hasDocsOutputSentinel) {
    const docsPath = wunderkindConfig.docsPath ?? "./docs"
    const docHistoryMode = wunderkindConfig.docHistoryMode ?? "append-dated"
    const docsOutputRuntimeState = getDocsOutputRuntimeState(docsPath, cwd)
    const docsPathWarning = docsOutputRuntimeState.warning
      ? `\n\n### Docs Output Warning\n\n${docsOutputRuntimeState.warning}\n`
      : ""

    docsOutputSection = `
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
 `.trim()
  }

  if (wunderkindConfig && !hasRuntimeContextSentinel) {
    runtimeContextSection = `
${RUNTIME_CONTEXT_SENTINEL}
## Wunderkind Resolved Runtime Context

Use this resolved Wunderkind configuration as the authoritative runtime context for this session.

- region: ${wunderkindConfig.region ?? "Global"}
- industry: ${(wunderkindConfig.industry ?? "").trim() !== "" ? wunderkindConfig.industry : "(not set)"}
- primary regulation: ${(wunderkindConfig.primaryRegulation ?? "").trim() !== "" ? wunderkindConfig.primaryRegulation : "(not set)"}
- secondary regulation: ${(wunderkindConfig.secondaryRegulation ?? "").trim() !== "" ? wunderkindConfig.secondaryRegulation : "(not set)"}
- team culture: ${wunderkindConfig.teamCulture ?? "pragmatic-balanced"}
- org structure: ${wunderkindConfig.orgStructure ?? "flat"}

If a prompt references .wunderkind/wunderkind.config.jsonc for baseline or personality context, use the resolved values above first.
 `.trim()
  }

  const activeSoulAgent = detectActiveSoulAgent(options.system)
  if (activeSoulAgent) {
    const soulSentinel = `<!-- wunderkind:soul-runtime-start:${activeSoulAgent} -->`
    const hasSoulSentinel = options.system.join("").includes(soulSentinel)

    if (!hasSoulSentinel) {
      const soulOverlay = readSoulOverlay(activeSoulAgent, cwd)
      if (soulOverlay) {
        soulOverlaySection = `
${soulSentinel}
## Wunderkind SOUL Overlay

Use this project-local SOUL overlay as additive guidance for the active persona. It refines the neutral base prompt with project-specific customization and durable learned context. If it conflicts with an explicit user instruction, follow the user.

${soulOverlay}
 `.trim()
      }
    }
  }

  if (!hasNativeAgentsSentinel) {
    nativeAgentsSection = `
${NATIVE_AGENTS_SENTINEL}
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
- For background delegation, keep \`bg_...\` task ids separate from \`ses_...\` session ids, wait for the runtime completion signal, then call \`background_output\` with the background task id.
- Use \`skill(name="...")\` for shipped skills and sub-skills.
- Use normal \`Write\`/\`Edit\` for ordinary repo files, docs-output, \`DESIGN.md\`, \`.wunderkind/stitch/\`, and managed \`.omo/\` planning files. Use \`${DURABLE_ARTIFACT_TOOL_NAME}(...)\` only for append-only Wunderkind memory lanes such as \`.omo/notepads/\` and \`.omo/evidence/\`.

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
 `.split("\u0000").join("").trim()
  }

  const activeByteBudget = getActiveRuntimePromptOptimizationByteBudget(wunderkindConfig)
  if (activeByteBudget === null) {
    if (docsOutputSection) options.system.push(docsOutputSection)
    if (runtimeContextSection) options.system.push(runtimeContextSection)
    if (soulOverlaySection) options.system.push(soulOverlaySection)
    if (nativeAgentsSection) options.system.push(nativeAgentsSection)
    return
  }

  const trimResult = trimPromptOptimizationRuntimeSections(
    [
      ...(docsOutputSection ? [{ id: "runtime-docs-output" as const, content: docsOutputSection }] : []),
      ...(runtimeContextSection ? [{ id: "runtime-context" as const, content: runtimeContextSection }] : []),
      ...(nativeAgentsSection ? [{ id: "runtime-native-agents" as const, content: nativeAgentsSection }] : []),
    ],
    activeByteBudget,
  )

  const trimmedDocsOutputSection = trimResult.sections.find((section) => section.id === "runtime-docs-output")
  const trimmedRuntimeContextSection = trimResult.sections.find((section) => section.id === "runtime-context")
  const trimmedNativeAgentsSection = trimResult.sections.find((section) => section.id === "runtime-native-agents")

  if (trimmedDocsOutputSection && trimmedDocsOutputSection.content !== "") {
    options.system.push(trimmedDocsOutputSection.content)
  }
  if (trimmedRuntimeContextSection && trimmedRuntimeContextSection.content !== "") {
    options.system.push(trimmedRuntimeContextSection.content)
  }
  if (soulOverlaySection) {
    options.system.push(soulOverlaySection)
  }
  if (trimmedNativeAgentsSection && trimmedNativeAgentsSection.content !== "") {
    options.system.push(trimmedNativeAgentsSection.content)
  }
}
