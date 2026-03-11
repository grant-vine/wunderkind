export type BooleanArg = "no" | "yes"
export type InstallScope = "global" | "project"
export type InstallRegistrationScope = InstallScope | "both" | "none"
export type DocHistoryMode = "overwrite" | "append-dated" | "new-dated-file" | "overwrite-archive"

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
export type DevrelPersonality = "community-champion" | "docs-perfectionist" | "dx-engineer"
export type LegalPersonality = "cautious-gatekeeper" | "pragmatic-advisor" | "plain-english-counselor"
export type SupportPersonality = "empathetic-resolver" | "systematic-triage" | "knowledge-builder"
export type DataAnalystPersonality = "rigorous-statistician" | "insight-storyteller" | "pragmatic-quant"

export interface GlobalConfig {
  region: string
  industry: string
  primaryRegulation: string
  secondaryRegulation: string
}

export interface ProjectConfig {
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
  devrelPersonality: DevrelPersonality
  legalPersonality: LegalPersonality
  supportPersonality: SupportPersonality
  dataAnalystPersonality: DataAnalystPersonality
  docsEnabled: boolean
  docsPath: string
  docHistoryMode: DocHistoryMode
}

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
  devrelPersonality?: string | undefined
  legalPersonality?: string | undefined
  supportPersonality?: string | undefined
  dataAnalystPersonality?: string | undefined
  docsEnabled?: boolean | undefined
  docsPath?: string | undefined
  docHistoryMode?: string | undefined
}

export interface InstallConfig extends GlobalConfig, ProjectConfig {}

export interface ConfigMergeResult {
  success: boolean
  configPath: string
  changed?: boolean
  error?: string
}

export interface DetectedConfig {
  isInstalled: boolean
  scope: InstallScope
  projectInstalled?: boolean
  globalInstalled?: boolean
  registrationScope?: InstallRegistrationScope
  projectOpenCodeConfigPath?: string
  globalOpenCodeConfigPath?: string
  legacyGlobalProjectFields?: string[]
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
  devrelPersonality: DevrelPersonality
  legalPersonality: LegalPersonality
  supportPersonality: SupportPersonality
  dataAnalystPersonality: DataAnalystPersonality
  docsEnabled: boolean
  docsPath: string
  docHistoryMode: DocHistoryMode
}
