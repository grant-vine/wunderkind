import color from "picocolors"
import { existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { detectCurrentConfig, removePluginFromOpenCodeConfig } from "./config-manager/index.js"

export async function runProjectCleanup(): Promise<number> {
  try {
    const cwd = process.cwd()
    const detected = detectCurrentConfig()
    let changed = false

    if (detected.projectInstalled === true || detected.registrationScope === "project" || detected.registrationScope === "both") {
      const result = removePluginFromOpenCodeConfig("project")
      if (!result.success) {
        console.error(`Failed to remove plugin from project OpenCode config: ${result.error}`)
        return 1
      }

      if (result.changed === true) {
        console.log(`${color.green("✓")} Removed project plugin registration (${color.dim(result.configPath)})`)
        changed = true
      } else {
        console.log(`${color.dim("- ")}Project plugin registration already absent (${color.dim(result.configPath)})`)
      }
    }

    const wunderkindDir = join(cwd, ".wunderkind")
    if (existsSync(wunderkindDir)) {
      rmSync(wunderkindDir, { recursive: true, force: true })
      console.log(`${color.green("✓")} Removed project Wunderkind state (${color.dim(wunderkindDir)})`)
      changed = true
    } else {
      console.log(`${color.dim("- ")}Project Wunderkind state already absent (${color.dim(wunderkindDir)})`)
    }

    const projectOpenCodeConfig = join(cwd, "opencode.json")
    if (existsSync(projectOpenCodeConfig) && readdirSync(cwd).includes("opencode.json") && !changed) {
      console.log(`${color.dim("- ")}No project-local Wunderkind cleanup was needed in ${color.dim(cwd)}`)
    }

    console.log()
    console.log(color.bold("Safety note"))
    console.log("Cleanup removes project-local Wunderkind registration and .wunderkind/ state only.")
    console.log("It leaves AGENTS.md, .sisyphus/, docs output, and shared global capabilities untouched.")

    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
