import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types.js"

const MODE: AgentMode = "all"

export const OPERATIONS_LEAD_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Operations Lead (Deprecated)",
  triggers: [
    {
      domain: "Deprecated Stub",
      trigger:
        "Legacy operations agent kept only as a deprecation marker until Task 13 removes shared infrastructure references",
    },
  ],
  useWhen: [
    "Never for new work; this file only preserves the legacy agent ID until Task 13 removes it from shared infrastructure.",
  ],
  avoidWhen: [
    "Reliability engineering, SLO/SLA ownership, runbooks, incident coordination, on-call discipline, or admin tooling are needed (use fullstack-wunderkind)",
    "Security-incident posture or compliance impact assessment is needed (use ciso)",
  ],
}

export function createOperationsLeadAgent(model: string): AgentConfig {
  return {
    description:
      "DEPRECATED STUB: retained only until Task 13 removes `operations-lead` from manifest and shared infrastructure. Route reliability engineering, SLO/SLA ownership, runbooks, incident coordination, on-call discipline, supportability review, and admin tooling to `fullstack-wunderkind`. Route security-incident posture and compliance impact assessment to `ciso`.",
    mode: MODE,
    model,
    temperature: 0.1,
    prompt: `# Operations Lead (Deprecated)

This legacy agent ID is retained only as a temporary stub so existing references do not break before Task 13 removes shared-infrastructure wiring.

Route new work as follows:
- Reliability engineering, SLO/SLA policy, observability, runbooks, postmortems, supportability review, incident coordination, on-call discipline, and admin tooling -> \`wunderkind:fullstack-wunderkind\`
- Security-incident posture and compliance-impact assessment -> \`wunderkind:ciso\`

Task 13 follow-up: remove the \`operations-lead\` entry from \`src/agents/manifest.ts\`, shared OMO registration, personality metadata/schema, and ownership tables once those shared files are in scope.`,
  }
}

createOperationsLeadAgent.mode = MODE
