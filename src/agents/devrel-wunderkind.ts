import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types.js"
import { createAgentToolRestrictions } from "./types.js"
import { buildPersistentContextSection } from "./shared-prompt-sections.js"

const MODE: AgentMode = "all"

export const DEVREL_WUNDERKIND_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "DevRel Wunderkind (Deprecated Alias)",
  triggers: [
    {
      domain: "Deprecated DevRel Alias",
      trigger:
        "Legacy alias retained only until Task 13 removes shared manifest and registration entries",
    },
  ],
  useWhen: [
    "Only when older shared infrastructure still routes to the retired devrel-wunderkind alias",
  ],
  avoidWhen: [
    "Any real developer advocacy, docs, tutorials, migration, or DX work is needed (use marketing-wunderkind)",
  ],
}

export function createDevrelWunderkindAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "task",
  ])

  const persistentContextSection = buildPersistentContextSection({
    learnings: "legacy devrel-routing patterns and surviving marketing handoff notes",
    decisions: "deprecated alias redirects and surviving skill ownership guidance",
    blockers: "shared references still pointing at devrel-wunderkind before Task 13 cleanup",
  })

  return {
    description:
      "USE FOR: deprecated devrel-wunderkind alias compatibility, legacy routing cleanup, and redirecting developer advocacy, DX, tutorial, and docs-led launch requests into marketing-wunderkind until Task 13 removes shared references.",
    mode: MODE,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt: `# DevRel Wunderkind

You are the **DevRel Wunderkind** legacy alias. Before acting, read .wunderkind/wunderkind.config.jsonc and load:
- cmoPersonality — the surviving Personality surface for former devrel behavior now folded into marketing
- teamCulture for tone, documentation depth, and external-audience polish
- region and industry for audience expectations, compliance sensitivity, and launch framing

---

# Deprecated Compatibility Stub

This base agent is retained only so older shared infrastructure can still resolve the retired devrel-wunderkind alias before Task 13 removes it.

All former devrel authority now belongs to marketing-wunderkind, including:
- developer advocacy and developer-audience launch strategy
- docs-led launches, getting-started journeys, and migration planning
- DX audits, onboarding friction reduction, and time-to-first-value work
- open source community programs and technical education planning

The deep writing path for developer docs survives as the marketing-owned technical-writer skill.

If invoked, redirect the request to marketing-wunderkind and preserve the user goal, audience, and expected deliverable in the handoff.

Task 13 must remove the shared references to devrel-wunderkind, retire devrelPersonality, and fold the surviving behavior into cmoPersonality.

${persistentContextSection}

---`,
  }
}

createDevrelWunderkindAgent.mode = MODE
