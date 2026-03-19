import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AGENT_DOCS_CONFIG } from "./agents/docs-config.js"
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
  } catch {
    return null
  }
}

const WunderkindPlugin: Plugin = async (_input) => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const wunderkindConfig = readWunderkindConfig()
      const hasDocsOutputSentinel = output.system.join("").includes(DOCS_OUTPUT_SENTINEL)

      if (wunderkindConfig?.docsEnabled === true && !hasDocsOutputSentinel) {
        const docsPath = wunderkindConfig.docsPath ?? "./docs"
        const docHistoryMode = wunderkindConfig.docHistoryMode ?? "overwrite"
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

Treat these canonical targets as managed home files. Within \`/docs-index\`, use a refresh or bootstrap flow: refresh them if present or bootstrap them if missing.

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

      if (wunderkindConfig?.desloppifyEnabled === true) {
        output.system.push(`
## Wunderkind Desloppify Code Health

Desloppify code-health support is enabled for this project. When you identify code-health work that qualifies (dead code, unused exports, lint violations, complexity hotspots), use the \`code-health\` skill.
`.trim())
      } else {
        output.system.push(`
## Wunderkind Desloppify Code Health

Desloppify code-health support is not enabled for this project. If a user or agent requests Desloppify-style code-health work, respond once with: "Desloppify code-health support is not enabled for this project. Run \`wunderkind init --no-tui --desloppify-enabled=yes\` to enable it, then install Desloppify with \`python -m pip install --upgrade 'desloppify[full]'\`." Do not repeat this message.
`.trim())
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

### Project Configuration

Global and project-local Wunderkind config are merged at runtime.
Treat the resolved runtime context above as the source of truth for region, industry, regulations, team culture, org structure, and personality guidance.
`.split("\u0000").join("").trim())
    },
  }
}

export { WunderkindPlugin as default }
