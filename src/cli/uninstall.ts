import color from "picocolors"
import {
  detectCurrentConfig,
  removeNativeAgentFiles,
  removeNativeCommandFiles,
  removeNativeSkillFiles,
  removeGlobalWunderkindConfig,
  removePluginFromOpenCodeConfig,
} from "./config-manager/index.js"
import type { InstallRegistrationScope, InstallScope } from "./types.js"

export interface UninstallOptions {
  scope?: InstallScope
}

function resolveScopes(scope: InstallScope | undefined, detectedScope: InstallRegistrationScope): InstallScope[] {
  if (scope === "global") return ["global"]
  if (scope === "project") return ["project"]
  if (detectedScope === "both") return ["project"]
  if (detectedScope === "project") return ["project"]
  if (detectedScope === "global") return ["global"]
  return []
}

export async function runUninstall(options: UninstallOptions): Promise<number> {
  try {
    const detected = detectCurrentConfig()
    const targets = resolveScopes(options.scope, detected.registrationScope ?? "none")

    if (targets.length === 0) {
      console.log("Wunderkind plugin is not currently registered in OpenCode config.")
      console.log("No changes made.")
      return 0
    }

    for (const target of targets) {
      const result = removePluginFromOpenCodeConfig(target)
      if (!result.success) {
        console.error(`Failed to remove plugin from ${target} OpenCode config: ${result.error}`)
        return 1
      }
      if (result.changed === true) {
        console.log(`${color.green("✓")} Removed plugin registration from ${target} config (${color.dim(result.configPath)})`)
      } else {
        console.log(`${color.dim("- ")}Plugin registration already absent in ${target} config (${color.dim(result.configPath)})`)
      }

      if (target === "global") {
        const nativeAgentResult = removeNativeAgentFiles(target)
        if (!nativeAgentResult.success) {
          console.error(`Failed to remove native agent files from global scope: ${nativeAgentResult.error}`)
          return 1
        }
        if (nativeAgentResult.changed === true) {
          console.log(`${color.green("✓")} Removed global native agent files (${color.dim(nativeAgentResult.configPath)})`)
        } else {
          console.log(`${color.dim("- ")}Global native agent files already absent (${color.dim(nativeAgentResult.configPath)})`)
        }

        const nativeCommandResult = removeNativeCommandFiles()
        if (!nativeCommandResult.success) {
          console.error(`Failed to remove native command files from global scope: ${nativeCommandResult.error}`)
          return 1
        }
        if (nativeCommandResult.changed === true) {
          console.log(`${color.green("✓")} Removed global native command files (${color.dim(nativeCommandResult.configPath)})`)
        } else {
          console.log(`${color.dim("- ")}Global native command files already absent (${color.dim(nativeCommandResult.configPath)})`)
        }

        const nativeSkillResult = removeNativeSkillFiles(target)
        if (!nativeSkillResult.success) {
          console.error(`Failed to remove native skill files from global scope: ${nativeSkillResult.error}`)
          return 1
        }
        if (nativeSkillResult.changed === true) {
          console.log(`${color.green("✓")} Removed global native skill files (${color.dim(nativeSkillResult.configPath)})`)
        } else {
          console.log(`${color.dim("- ")}Global native skill files already absent (${color.dim(nativeSkillResult.configPath)})`)
        }

        const globalConfigResult = removeGlobalWunderkindConfig()
        if (!globalConfigResult.success) {
          console.error(`Failed to remove global Wunderkind config: ${globalConfigResult.error}`)
          return 1
        }
        if (globalConfigResult.changed === true) {
          console.log(`${color.green("✓")} Removed global Wunderkind config (${color.dim(globalConfigResult.configPath)})`)
        } else {
          console.log(`${color.dim("- ")}Global Wunderkind config already absent (${color.dim(globalConfigResult.configPath)})`)
        }
      }
    }

    console.log()
    console.log(color.bold("Safety note"))
    console.log(
      "Project-local customization files are intentionally left untouched for safety:",
    )
    console.log("- Project-local: .wunderkind/, AGENTS.md, .sisyphus/, docs output folders")
    console.log("- Shared global capabilities and global config are removed only during global uninstall")
    console.log("If you want project-local artifacts removed, delete those files manually.")

    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
