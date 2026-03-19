import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types.js"

const MODE: AgentMode = "all"

export const QA_SPECIALIST_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "QA Specialist (Deprecated)",
  triggers: [
    {
      domain: "Deprecated Compatibility Stub",
      trigger:
        "Deprecated stub retained during Task 11 until Task 13 removes qa-specialist from shared infrastructure",
    },
  ],
  useWhen: [
    "Never for new work; route acceptance review and issue shaping to product-wunderkind",
    "Never for new work; route TDD, regression, coverage, and technical defect diagnosis to fullstack-wunderkind",
  ],
  avoidWhen: [
    "Any new quality, testing, triage, or acceptance-review request",
    "Any task that should land on the retained six-agent topology",
  ],
}

export function createQaSpecialistAgent(model: string): AgentConfig {
  return {
    description:
      "DEPRECATED STUB ONLY: qa-specialist is retained temporarily for compatibility during Task 11. Route acceptance review and issue shaping to product-wunderkind, and route TDD, regression, coverage, and defect diagnosis to fullstack-wunderkind.",
    mode: MODE,
    model,
    temperature: 0,
    prompt: `# QA Specialist (Deprecated)

This base agent is a temporary compatibility stub retained during Task 11.

Do not use \`qa-specialist\` for new work.

- Route acceptance review, INVEST gating, story quality, and backlog readiness to \`wunderkind:product-wunderkind\`.
- Route TDD execution, regression defense, coverage analysis, flaky-test triage, and technical defect diagnosis to \`wunderkind:fullstack-wunderkind\`.
- If a discovered defect implies a security-control gap, escalate to \`wunderkind:ciso\`.

Task 13 must remove the shared \`qa-specialist\` registrations from \`src/agents/manifest.ts\`, \`oh-my-opencode.jsonc\`, and related personality/config surfaces after the surviving prompts are fully consolidated.`,
  }
}

createQaSpecialistAgent.mode = MODE
