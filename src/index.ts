import type { Plugin } from "@opencode-ai/plugin"
import { AGENT_DOCS_CONFIG } from "./agents/docs-config.js"
import { readWunderkindConfig } from "./cli/config-manager/index.js"

const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"

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
- primary regulation: ${wunderkindConfig.primaryRegulation ?? "GDPR"}
- secondary regulation: ${(wunderkindConfig.secondaryRegulation ?? "").trim() !== "" ? wunderkindConfig.secondaryRegulation : "(not set)"}
- team culture: ${wunderkindConfig.teamCulture ?? "pragmatic-balanced"}
- org structure: ${wunderkindConfig.orgStructure ?? "flat"}

If a prompt references .wunderkind/wunderkind.config.jsonc for baseline or personality context, use the resolved values above first.
`.trim())
      }

      output.system.push(`
## Wunderkind Native Agents

The following specialist agents are available as native OpenCode agents. Delegate to them when their domain matches.

### Primary Agents

- marketing-wunderkind — Brand strategy, go-to-market, content marketing, SEO/SEM, paid media, analytics, product marketing, PR, competitor analysis
- creative-director — Brand identity, design systems, UI/UX, typography, colour palettes, accessibility, design tokens, visual language
- product-wunderkind — Product strategy, roadmaps, OKRs, user research, PRDs, sprint planning, prioritisation, task decomposition
- fullstack-wunderkind — Full-stack engineering, frontend, backend, database, infrastructure, Vercel, AI integration, code review, architecture
- brand-builder — Community building, thought leadership, product forums, networking opportunities, PR narrative, cost gating, ROI assessment
- qa-specialist — TDD, test writing, Playwright, Vitest, coverage analysis, user story review, test optimisation, security boundary testing
- operations-lead — SRE/SLO, admin tooling (build-first), runbooks, incident response, observability, supportability assessment
- ciso — Security architecture, OWASP, threat modelling, compliance (GDPR/CCPA/POPIA/LGPD), pen testing coordination, breach response
- devrel-wunderkind — Developer relations, DX audits, API documentation, tutorials, migration guides, OSS community, getting started guides
- legal-counsel — OSS licensing, TOS/Privacy Policy drafting, DPAs, CLAs, contract review, GDPR/CCPA legal obligations
- support-engineer — Bug triage, issue classification, repro steps, severity rating (P0–P3), engineering handoff, support synthesis
- data-analyst — Product analytics, event tracking, funnel analysis, cohort analysis, A/B experiment design, metric definitions

### Delegation Rules

- Use ciso for security and compliance work.
- Use qa-specialist for test strategy, TDD, and boundary validation.
- Use product-wunderkind for planning, PRDs, and decomposition.
- Use fullstack-wunderkind for engineering implementation and architecture.
- Use marketing-wunderkind and brand-builder for GTM, channels, and community strategy.
- Use creative-director for visual, UX, and design-system work.
- Use operations-lead for reliability, incidents, and runbooks.
- Use devrel-wunderkind for docs, tutorials, and developer education.
- Use legal-counsel for OSS licensing and legal/compliance review.
- Use support-engineer for support triage and handoff.
- Use data-analyst for analytics, funnels, experiments, and metrics.

### Project Configuration

Global and project-local Wunderkind config are merged at runtime.
Treat the resolved runtime context above as the source of truth for region, industry, regulations, team culture, org structure, and personality guidance.
`.split("\u0000").join("").trim())
    },
  }
}

export { WunderkindPlugin as default }
