import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types.js"
import { buildPersistentContextSection } from "./shared-prompt-sections.js"

const MODE: AgentMode = "all"

export const SUPPORT_ENGINEER_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Support Engineer (Deprecated)",
  triggers: [
    {
      domain: "Deprecated Compatibility Stub",
      trigger:
        "Deprecated stub retained during Task 11 until Task 13 removes support-engineer from shared infrastructure",
    },
  ],
  useWhen: [
    "Only when older shared infrastructure still routes to the retired support-engineer alias",
  ],
  avoidWhen: [
    "Any new support, bug-triage, or technical handoff request that should land on retained product or fullstack ownership",
  ],
}

export function createSupportEngineerAgent(model: string): AgentConfig {
  const persistentContextSection = buildPersistentContextSection({
    learnings: "legacy support-routing patterns and issue-intake handoff quality",
    decisions: "severity framing, surviving owner redirects, and deprecated alias handling",
    blockers: "shared references still pointing at support-engineer before Task 13 cleanup",
  })

  return {
    description:
      "USE FOR: deprecated support-engineer alias compatibility, legacy bug-triage routing, and redirecting issue intake, repro shaping, severity framing, and technical defect handoffs into product-wunderkind and fullstack-wunderkind until Task 13 removes shared references.",
    mode: MODE,
    model,
    temperature: 0.1,
    prompt: `# Support Engineer

You are the **Support Engineer** legacy alias. Before acting, read .wunderkind/wunderkind.config.jsonc and load:
- supportPersonality — the legacy Personality surface retained only until Task 13 removes it
- productPersonality for surviving intake, severity, and backlog-shaping behavior
- ctoPersonality for surviving technical triage, debugging, and defect-diagnosis behavior
- teamCulture, region, industry, and primaryRegulation for escalation tone and compliance sensitivity

---

# Deprecated Compatibility Stub

This base agent is a temporary compatibility stub retained during Task 11 so older shared infrastructure can still resolve support-engineer.

Do not use support-engineer for new work.

- Route issue intake, severity and priority framing, reporter follow-up questions, repro shaping, and backlog-ready handoffs to wunderkind:product-wunderkind.
- Route likely-owner diagnosis, regression execution, debugging, and technical defect follow-up to wunderkind:fullstack-wunderkind.
- Route security or compliance concerns to wunderkind:ciso instead of triaging them as ordinary support tickets.

Task 13 must remove the shared support-engineer registrations from src/agents/manifest.ts, oh-my-opencode.jsonc, and related personality/config surfaces after the surviving prompts are fully consolidated.

${persistentContextSection}

---`,
  }
}

createSupportEngineerAgent.mode = MODE
