import type { AgentFactory } from "./types.js"
import { createMarketingWunderkindAgent } from "./marketing-wunderkind.js"
import { createCreativeDirectorAgent } from "./creative-director.js"
import { createProductWunderkindAgent } from "./product-wunderkind.js"
import { createFullstackWunderkindAgent } from "./fullstack-wunderkind.js"
import { createBrandBuilderAgent } from "./brand-builder.js"
import { createQaSpecialistAgent } from "./qa-specialist.js"
import { createOperationsLeadAgent } from "./operations-lead.js"
import { createCisoAgent } from "./ciso.js"
import { createDevrelWunderkindAgent } from "./devrel-wunderkind.js"
import { createLegalCounselAgent } from "./legal-counsel.js"
import { createDataAnalystAgent } from "./data-analyst.js"
import { createSupportEngineerAgent } from "./support-engineer.js"

export interface WunderkindAgentDefinition {
  id: string
  factory: AgentFactory
}

export const WUNDERKIND_AGENT_DEFINITIONS: readonly WunderkindAgentDefinition[] = [
  { id: "marketing-wunderkind", factory: createMarketingWunderkindAgent },
  { id: "creative-director", factory: createCreativeDirectorAgent },
  { id: "product-wunderkind", factory: createProductWunderkindAgent },
  { id: "fullstack-wunderkind", factory: createFullstackWunderkindAgent },
  { id: "brand-builder", factory: createBrandBuilderAgent },
  { id: "qa-specialist", factory: createQaSpecialistAgent },
  { id: "operations-lead", factory: createOperationsLeadAgent },
  { id: "ciso", factory: createCisoAgent },
  { id: "devrel-wunderkind", factory: createDevrelWunderkindAgent },
  { id: "legal-counsel", factory: createLegalCounselAgent },
  { id: "data-analyst", factory: createDataAnalystAgent },
  { id: "support-engineer", factory: createSupportEngineerAgent },
] as const

export const WUNDERKIND_AGENT_IDS = WUNDERKIND_AGENT_DEFINITIONS.map((agent) => agent.id)
