export type BooleanArg = "no" | "yes"

export interface InstallArgs {
  tui: boolean
  region?: string | undefined
  industry?: string | undefined
  primaryRegulation?: string | undefined
  secondaryRegulation?: string | undefined
}

export interface InstallConfig {
  region: string
  industry: string
  primaryRegulation: string
  secondaryRegulation: string
}

export interface ConfigMergeResult {
  success: boolean
  configPath: string
  error?: string
}

export interface DetectedConfig {
  isInstalled: boolean
  region: string
  industry: string
  primaryRegulation: string
  secondaryRegulation: string
}
