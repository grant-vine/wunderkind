import type { AgentFactory } from "./types.js"
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

export const WUNDERKIND_AGENT_DEFINITIONS: readonly WunderkindAgentDefinition[] = [
  {
    id: "marketing-wunderkind",
    roleLabel: "Marketing Wunderkind",
    summary:
      "CMO-calibre strategist for brand, community, developer advocacy, docs-led launches, adoption, PR, and go-to-market work.",
    factory: createMarketingWunderkindAgent,
  },
  {
    id: "creative-director",
    roleLabel: "Creative Director",
    summary: "Brand and UI/UX lead for design systems, visuals, and product experience.",
    factory: createCreativeDirectorAgent,
  },
  {
    id: "product-wunderkind",
    roleLabel: "Product Wunderkind",
    summary: "VP Product-style partner for strategy, prioritization, and roadmap decisions.",
    factory: createProductWunderkindAgent,
  },
  {
    id: "fullstack-wunderkind",
    roleLabel: "Fullstack Wunderkind",
    summary: "CTO-calibre engineer for architecture, implementation, and systems tradeoffs.",
    factory: createFullstackWunderkindAgent,
  },
  {
    id: "ciso",
    roleLabel: "CISO",
    summary: "Security and compliance lead for threat modeling, controls, and risk decisions.",
    factory: createCisoAgent,
  },
  {
    id: "legal-counsel",
    roleLabel: "Legal Counsel",
    summary: "Legal and regulatory advisor for contracts, licensing, and compliance posture.",
    factory: createLegalCounselAgent,
  },
] as const

export const WUNDERKIND_AGENT_IDS = WUNDERKIND_AGENT_DEFINITIONS.map((agent) => agent.id)
