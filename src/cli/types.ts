export type BooleanArg = "no" | "yes"
export type InstallScope = "global" | "project"
export type InstallRegistrationScope = InstallScope | "both" | "none"
export type DocHistoryMode = "overwrite" | "append-dated" | "new-dated-file" | "overwrite-archive"
export type PrdPipelineMode = "filesystem" | "github"
export type DesignTool = "none" | "google-stitch"
export type DesignMcpOwnership = "none" | "wunderkind-managed" | "reused-project" | "reused-global"

export type TeamCulture = "formal-strict" | "pragmatic-balanced" | "experimental-informal"
export type OrgStructure = "flat" | "hierarchical"
export type CisoPersonality = "paranoid-enforcer" | "pragmatic-risk-manager" | "educator-collaborator"
export type CtoPersonality = "grizzled-sysadmin" | "startup-bro" | "code-archaeologist"
export type CmoPersonality = "data-driven" | "brand-storyteller" | "growth-hacker"
export type ProductPersonality = "user-advocate" | "velocity-optimizer" | "outcome-obsessed"
export type CreativePersonality = "perfectionist-craftsperson" | "bold-provocateur" | "pragmatic-problem-solver"
export type LegalPersonality = "cautious-gatekeeper" | "pragmatic-advisor" | "plain-english-counselor"

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
  productPersonality: ProductPersonality
  creativePersonality: CreativePersonality
  legalPersonality: LegalPersonality
  docsEnabled: boolean
  docsPath: string
  docHistoryMode: DocHistoryMode
  prdPipelineMode: PrdPipelineMode
  designTool: DesignTool
  designPath: string
  designMcpOwnership: DesignMcpOwnership
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
  productPersonality?: string | undefined
  creativePersonality?: string | undefined
  legalPersonality?: string | undefined
  docsEnabled?: boolean | undefined
  docsPath?: string | undefined
  docHistoryMode?: string | undefined
}

export interface InstallConfig extends GlobalConfig, Omit<ProjectConfig, "designTool" | "designPath" | "designMcpOwnership"> {
  designTool?: DesignTool
  designPath?: string
  designMcpOwnership?: DesignMcpOwnership
}

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
  productPersonality: ProductPersonality
  creativePersonality: CreativePersonality
  legalPersonality: LegalPersonality
  docsEnabled: boolean
  docsPath: string
  docHistoryMode: DocHistoryMode
  prdPipelineMode: PrdPipelineMode
  designTool: DesignTool
  designPath: string
  designMcpOwnership: DesignMcpOwnership
}

export type OmoFreshnessStatus = "up-to-date" | "outdated" | "local-dev" | "pinned" | "error" | "unknown"

export interface OmoFreshnessInfo {
  status: OmoFreshnessStatus
  currentVersion: string | null
  latestVersion: string | null
  pinnedVersion: string | null
  renderedOutput: string | null
}

export interface PluginVersionInfo {
  packageName: string
  currentVersion: string | null
  registeredEntry: string | null
  registeredVersion: string | null
  loadedVersion: string | null
  configPath: string | null
  loadedPackagePath: string | null
  registered: boolean
  loadedSources?: {
    global: { version: string | null; packagePath: string | null }
    cache: { version: string | null; packagePath: string | null }
  }
  staleOverrideWarning?: string | null
  freshness?: OmoFreshnessInfo | null
}

export interface OmoInstallReadiness {
  installed: boolean
  registered: boolean
  loadedVersion: string | null
  configPath: string | null
  staleOverrideWarning: string | null
  freshness: OmoFreshnessInfo | null
  freshnessSummary: OmoFreshnessSummary
  interactiveInstallCommand: string
  nonTuiInstallCommand: string
  guidance: string
}

export type OmoFreshnessState =
  | "not-detected"
  | "stale-override"
  | "not-verified"
  | "up-to-date"
  | "update-available"
  | "local-dev"
  | "pinned"

export interface OmoFreshnessSummary {
  state: OmoFreshnessState
  guidance: string
}

export type BaselineConfigKey = keyof GlobalConfig
