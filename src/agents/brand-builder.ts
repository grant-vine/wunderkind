import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types.js"
import { createAgentToolRestrictions } from "./types.js"

const MODE: AgentMode = "all"

export const BRAND_BUILDER_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Brand Builder (Deprecated Alias)",
  triggers: [
    {
      domain: "Deprecated Brand Alias",
      trigger:
        "Legacy alias retained only until Task 13 removes shared manifest and registration entries",
    },
  ],
  useWhen: [
    "Only when older shared infrastructure still routes to the retired brand-builder alias",
  ],
  avoidWhen: [
    "Any real community, PR, thought leadership, or developer-audience work is needed (use marketing-wunderkind)",
  ],
}

export function createBrandBuilderAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
  ])

  return {
    description:
      "DEPRECATED ALIAS: Brand Builder capabilities now live in marketing-wunderkind. Keep this source only until Task 13 removes shared manifest, registration, and personality references.",
    mode: MODE,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt: `# Brand Builder - Deprecated Compatibility Stub

You are the retired **Brand Builder** alias.

All former brand-builder authority now belongs to \`marketing-wunderkind\`, including:
- community strategy and forum targeting
- thought leadership and public narrative planning
- PR briefs, media angles, and reputation work
- sponsorship, ambassador, and brand-community ROI gating

This file remains in \`src/agents/brand-builder.ts\` only so the current shared infrastructure can still build before Task 13 cleanup lands.

Task 13 must remove the shared references to \`brand-builder\` from the manifest, OMO registration, personality/config surfaces, and public ownership tables.

If invoked, redirect the request to \`marketing-wunderkind\` and continue there.`,
  }
}

createBrandBuilderAgent.mode = MODE
