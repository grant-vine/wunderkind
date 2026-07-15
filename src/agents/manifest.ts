import type { AgentFactory } from "./types.js"
import { WUNDERKIND_CANONICAL_MANIFEST } from "./canonical-manifest.js"
import { createMarketingWunderkindAgent } from "./marketing-wunderkind.js"
import { createCreativeDirectorAgent } from "./creative-director.js"
import { createProductWunderkindAgent } from "./product-wunderkind.js"
import { createFullstackWunderkindAgent } from "./fullstack-wunderkind.js"
import { createCisoAgent } from "./ciso.js"
import { createLegalCounselAgent } from "./legal-counsel.js"

export interface WunderkindAgentDefinition {
  id: string
  roleLabel: string
  summary: string
  factory: AgentFactory
}

const AGENT_FACTORIES = {
  "marketing-wunderkind": createMarketingWunderkindAgent,
  "creative-director": createCreativeDirectorAgent,
  "product-wunderkind": createProductWunderkindAgent,
  "fullstack-wunderkind": createFullstackWunderkindAgent,
  ciso: createCisoAgent,
  "legal-counsel": createLegalCounselAgent,
} as const satisfies Record<(typeof WUNDERKIND_CANONICAL_MANIFEST.agents)[number]["factoryKey"], AgentFactory>

export const WUNDERKIND_AGENT_DEFINITIONS: readonly WunderkindAgentDefinition[] = WUNDERKIND_CANONICAL_MANIFEST.agents.map(
  (agent) => ({
    id: agent.id,
    roleLabel: agent.roleLabel,
    summary: agent.summary,
    factory: AGENT_FACTORIES[agent.factoryKey],
  }),
)

export const WUNDERKIND_AGENT_IDS = WUNDERKIND_AGENT_DEFINITIONS.map((agent) => agent.id)
