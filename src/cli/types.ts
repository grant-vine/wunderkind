export type BooleanArg = "no" | "yes"
export type InstallScope = "global" | "project"

export type TeamCulture = "formal-strict" | "pragmatic-balanced" | "experimental-informal"
export type OrgStructure = "flat" | "hierarchical"
export type CisoPersonality = "paranoid-enforcer" | "pragmatic-risk-manager" | "educator-collaborator"
export type CtoPersonality = "grizzled-sysadmin" | "startup-bro" | "code-archaeologist"
export type CmoPersonality = "data-driven" | "brand-storyteller" | "growth-hacker"
export type QaPersonality = "rule-enforcer" | "risk-based-pragmatist" | "rubber-duck"
export type ProductPersonality = "user-advocate" | "velocity-optimizer" | "outcome-obsessed"
export type OpsPersonality = "on-call-veteran" | "efficiency-maximiser" | "process-purist"
export type CreativePersonality = "perfectionist-craftsperson" | "bold-provocateur" | "pragmatic-problem-solver"
export type BrandPersonality = "community-evangelist" | "pr-spinner" | "authentic-builder"

export interface InstallArgs {
  tui: boolean
  scope: InstallScope
  region?: string | undefined
  industry?: string | undefined
  primaryRegulation?: string | undefined
  secondaryRegulation?: string | undefined
  teamCulture?: string | undefined
  orgStructure?: string | undefined
  cisoPersonality?: string | undefined
  ctoPersonality?: string | undefined
  cmoPersonality?: string | undefined
  qaPersonality?: string | undefined
  productPersonality?: string | undefined
  opsPersonality?: string | undefined
  creativePersonality?: string | undefined
  brandPersonality?: string | undefined
}

export interface InstallConfig {
  region: string
  industry: string
  primaryRegulation: string
  secondaryRegulation: string
  teamCulture: TeamCulture
  orgStructure: OrgStructure
  cisoPersonality: CisoPersonality
  ctoPersonality: CtoPersonality
  cmoPersonality: CmoPersonality
  qaPersonality: QaPersonality
  productPersonality: ProductPersonality
  opsPersonality: OpsPersonality
  creativePersonality: CreativePersonality
  brandPersonality: BrandPersonality
}

export interface ConfigMergeResult {
  success: boolean
  configPath: string
  error?: string
}

export interface DetectedConfig {
  isInstalled: boolean
  scope: InstallScope
  region: string
  industry: string
  primaryRegulation: string
  secondaryRegulation: string
  teamCulture: TeamCulture
  orgStructure: OrgStructure
  cisoPersonality: CisoPersonality
  ctoPersonality: CtoPersonality
  cmoPersonality: CmoPersonality
  qaPersonality: QaPersonality
  productPersonality: ProductPersonality
  opsPersonality: OpsPersonality
  creativePersonality: CreativePersonality
  brandPersonality: BrandPersonality
}
