import * as p from "@clack/prompts"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"
import color from "picocolors"
import {
  detectCurrentConfig,
  removeNativeAgentFiles,
  removeNativeCommandFiles,
  removeNativeSkillFiles,
  removeGlobalWunderkindConfig,
  removePluginFromOpenCodeConfig,
} from "./config-manager/index.js"
import { GOOGLE_STITCH_ADAPTER } from "./mcp-adapters.js"
import type { DesignMcpOwnership, InstallRegistrationScope, InstallScope } from "./types.js"

type RemoveMcpMode = "ask" | "yes" | "no"

export interface UninstallOptions {
  scope?: InstallScope
  removeMcp?: RemoveMcpMode
}

interface OpenCodeConfig {
  $schema?: string
  mcp?: Record<string, unknown>
  [key: string]: unknown
}

function resolveScopes(scope: InstallScope | undefined, detectedScope: InstallRegistrationScope): InstallScope[] {
  if (scope === "global") return ["global"]
  if (scope === "project") return ["project"]
  if (detectedScope === "both") return ["project"]
  if (detectedScope === "project") return ["project"]
  if (detectedScope === "global") return ["global"]
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readProjectOpenCodeConfig(projectRoot: string): { config: OpenCodeConfig; path: string } | null {
  const configPath = join(projectRoot, "opencode.json")
  if (!existsSync(configPath)) {
    return null
  }

  const parsed = parseJsonc(readFileSync(configPath, "utf-8")) as unknown
  if (!isRecord(parsed)) {
    throw new Error(`Invalid OpenCode config format at ${configPath}`)
  }

  return {
    config: parsed as OpenCodeConfig,
    path: configPath,
  }
}

function removeProjectStitchMcpEntry(projectRoot: string): boolean {
  const loaded = readProjectOpenCodeConfig(projectRoot)
  if (loaded === null) {
    return false
  }

  const { config, path } = loaded
  const mcpEntries = isRecord(config.mcp) ? { ...config.mcp } : {}

  if (!Object.prototype.hasOwnProperty.call(mcpEntries, GOOGLE_STITCH_ADAPTER.serverName)) {
    return false
  }

  delete mcpEntries[GOOGLE_STITCH_ADAPTER.serverName]
  if (Object.keys(mcpEntries).length === 0) {
    delete config.mcp
  } else {
    config.mcp = mcpEntries
  }

  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`)
  return true
}

function removeManagedStitchSecret(projectRoot: string): boolean {
  const secretPath = join(projectRoot, GOOGLE_STITCH_ADAPTER.secretFilePath)
  if (!existsSync(secretPath)) {
    return false
  }

  rmSync(secretPath, { force: true })
  return true
}

async function confirmStitchRemoval(
  ownership: Exclude<DesignMcpOwnership, "none" | "reused-global">,
  removeMcp: RemoveMcpMode | undefined,
): Promise<boolean> {
  const isInteractive = process.stdin.isTTY === true && process.stdout.isTTY === true

  if (removeMcp === "yes") return true
  if (removeMcp === "no") return false
  if (!isInteractive) return false

  const confirmed = await p.confirm({
    message:
      ownership === "wunderkind-managed"
        ? "Also remove project-local Google Stitch MCP config and managed API key file?"
        : "Also remove the project-local Google Stitch MCP config entry?",
    initialValue: ownership === "wunderkind-managed",
  })

  if (p.isCancel(confirmed)) {
    p.cancel("Uninstall cancelled.")
    throw new Error("Uninstall cancelled")
  }

  return confirmed
}

async function handleProjectStitchCleanup(
  ownership: DesignMcpOwnership,
  removeMcp: RemoveMcpMode | undefined,
  projectRoot: string,
): Promise<void> {
  if (ownership === "none" || ownership === "reused-global") {
    return
  }

  const shouldRemove = await confirmStitchRemoval(ownership, removeMcp)
  if (!shouldRemove) {
    return
  }

  const mcpRemoved = removeProjectStitchMcpEntry(projectRoot)
  if (mcpRemoved) {
    console.log(`${color.green("✓")} Removed project-local Google Stitch MCP entry (${color.dim(join(projectRoot, "opencode.json"))})`)
  }

  if (ownership === "wunderkind-managed") {
    const secretRemoved = removeManagedStitchSecret(projectRoot)
    if (secretRemoved) {
      console.log(`${color.green("✓")} Removed managed Google Stitch API key file (${color.dim(join(projectRoot, GOOGLE_STITCH_ADAPTER.secretFilePath))})`)
    }
  }
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
      } else {
        await handleProjectStitchCleanup(detected.designMcpOwnership, options.removeMcp, process.cwd())
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
