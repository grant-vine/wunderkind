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
  roleLabel: string
  summary: string
  factory: AgentFactory
}

export const WUNDERKIND_AGENT_DEFINITIONS: readonly WunderkindAgentDefinition[] = [
  {
    id: "marketing-wunderkind",
    roleLabel: "Marketing Wunderkind",
    summary: "CMO-calibre strategist for brand, growth, and go-to-market work.",
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
    id: "brand-builder",
    roleLabel: "Brand Builder",
    summary: "Community and narrative lead for reputation, reach, and thought leadership.",
    factory: createBrandBuilderAgent,
  },
  {
    id: "qa-specialist",
    roleLabel: "QA Specialist",
    summary: "Test strategy and risk-based validation partner for quality and reliability.",
    factory: createQaSpecialistAgent,
  },
  {
    id: "operations-lead",
    roleLabel: "Operations Lead",
    summary: "SRE-minded operator for incident response, runbooks, and production readiness.",
    factory: createOperationsLeadAgent,
  },
  {
    id: "ciso",
    roleLabel: "CISO",
    summary: "Security and compliance lead for threat modeling, controls, and risk decisions.",
    factory: createCisoAgent,
  },
  {
    id: "devrel-wunderkind",
    roleLabel: "DevRel Wunderkind",
    summary: "Developer relations specialist for docs, DX, tutorials, and community adoption.",
    factory: createDevrelWunderkindAgent,
  },
  {
    id: "legal-counsel",
    roleLabel: "Legal Counsel",
    summary: "Legal and regulatory advisor for contracts, licensing, and compliance posture.",
    factory: createLegalCounselAgent,
  },
  {
    id: "data-analyst",
    roleLabel: "Data Analyst",
    summary: "Analytics specialist for funnels, experiments, metrics, and measurement clarity.",
    factory: createDataAnalystAgent,
  },
  {
    id: "support-engineer",
    roleLabel: "Support Engineer",
    summary: "Technical support lead for triage, severity assessment, and engineering handoff.",
    factory: createSupportEngineerAgent,
  },
] as const

export const WUNDERKIND_AGENT_IDS = WUNDERKIND_AGENT_DEFINITIONS.map((agent) => agent.id)
