import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types.js"
import { createAgentToolRestrictions } from "./types.js"
import { buildPersistentContextSection } from "./shared-prompt-sections.js"

const MODE: AgentMode = "all"

export const DATA_ANALYST_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Data Analyst (Deprecated)",
  triggers: [
    {
      domain: "Deprecated Stub",
      trigger:
        "Legacy analytics agent kept only as a deprecation marker until Task 13 removes shared infrastructure references",
    },
  ],
  useWhen: [
    "Only when older shared infrastructure still routes to the retired data-analyst alias",
  ],
  avoidWhen: [
    "Product usage analytics interpretation, feature adoption analysis, experiment synthesis, or prioritisation framing are needed (use product-wunderkind)",
    "Campaign performance analysis, funnel analytics, attribution, or channel ROI interpretation are needed (use marketing-wunderkind)",
  ],
}

export function createDataAnalystAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "task",
  ])

  const persistentContextSection = buildPersistentContextSection({
    learnings: "legacy analytics-routing patterns and surviving owner handoff notes",
    decisions: "deprecated alias redirects and measurement-ownership splits",
    blockers: "shared references still pointing at data-analyst before Task 13 cleanup",
  })

  return {
    description:
      "USE FOR: deprecated data-analyst alias compatibility, legacy analytics routing cleanup, and redirecting product usage interpretation into product-wunderkind while routing campaign and channel analytics into marketing-wunderkind until Task 13 removes shared references.",
    mode: MODE,
    model,
    temperature: 0.2,
    ...restrictions,
    prompt: `# Data Analyst

You are the **Data Analyst** legacy alias. Before acting, read .wunderkind/wunderkind.config.jsonc and load:
- dataAnalystPersonality — the legacy Personality surface retained only until Task 13 removes it
- productPersonality for surviving product analytics, feature adoption, and experiment-readout behavior
- cmoPersonality for surviving campaign, attribution, and channel-performance behavior
- teamCulture, region, industry, and primaryRegulation for measurement tone and compliance sensitivity

---

# Deprecated Compatibility Stub

This legacy agent ID is retained only as a temporary stub so older shared infrastructure can still resolve data-analyst before Task 13 removes the alias.

Route new work as follows:
- Product usage analytics interpretation, feature adoption analysis, experiment synthesis, and prioritisation framing -> wunderkind:product-wunderkind
- Campaign performance analysis, funnel analytics, attribution, and channel ROI interpretation -> wunderkind:marketing-wunderkind

Task 13 follow-up: remove the data-analyst entry from src/agents/manifest.ts, shared OMO registration, personality metadata/schema, and ownership tables once those shared files are in scope.

${persistentContextSection}

---`,
  }
}

createDataAnalystAgent.mode = MODE
