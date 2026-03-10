import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { detectCurrentConfig, readWunderkindConfig } from "./config-manager/index.js"
import { isProjectContext } from "./init.js"

function yesNo(value: boolean): string {
  return value ? "yes" : "no"
}

export async function runDoctor(): Promise<number> {
  try {
    const cwd = process.cwd()
    const inProject = isProjectContext(cwd)
    const detected = detectCurrentConfig()
    const mergedConfig = readWunderkindConfig()

    const globalOpenCodePath = join(homedir(), ".config", "opencode", "opencode.json")
    const globalConfigPath = join(homedir(), ".wunderkind", "wunderkind.config.jsonc")
    const localConfigPath = join(cwd, ".wunderkind", "wunderkind.config.jsonc")

    const warnings: string[] = []

    console.log("Install Information")
    console.log(`- installed: ${yesNo(detected.isInstalled)}`)
    console.log(`- global OpenCode config path: ${globalOpenCodePath}`)
    console.log(`- plugin registration detected: ${yesNo(detected.isInstalled)}`)
    console.log(`- global wunderkind config exists: ${yesNo(existsSync(globalConfigPath))}`)

    if (inProject) {
      const agentsPath = join(cwd, "AGENTS.md")
      const sisyphusPlansPath = join(cwd, ".sisyphus", "plans")
      const sisyphusNotepadsPath = join(cwd, ".sisyphus", "notepads")
      const sisyphusEvidencePath = join(cwd, ".sisyphus", "evidence")
      const docsPath = join(cwd, detected.docsPath)
      const docsReadmePath = join(docsPath, "README.md")

      const hasLocalConfig = existsSync(localConfigPath)
      const hasAgents = existsSync(agentsPath)
      const hasPlans = existsSync(sisyphusPlansPath)
      const hasNotepads = existsSync(sisyphusNotepadsPath)
      const hasEvidence = existsSync(sisyphusEvidencePath)
      const hasDocsReadme = existsSync(docsReadmePath)

      if (!hasLocalConfig) warnings.push(`missing local config: ${localConfigPath}`)
      if (!hasAgents) warnings.push(`missing soul file: ${agentsPath}`)
      if (!hasPlans) warnings.push(`missing soul directory: ${sisyphusPlansPath}`)
      if (!hasNotepads) warnings.push(`missing soul directory: ${sisyphusNotepadsPath}`)
      if (!hasEvidence) warnings.push(`missing soul directory: ${sisyphusEvidencePath}`)
      if (detected.docsEnabled && !hasDocsReadme) warnings.push(`missing docs README: ${docsReadmePath}`)

      console.log("")
      console.log("Project Information")
      console.log(`- cwd: ${cwd}`)
      console.log(`- local wunderkind config path: ${localConfigPath}`)
      console.log(`- local config exists: ${yesNo(hasLocalConfig)}`)
      console.log(`- AGENTS.md present: ${yesNo(hasAgents)}`)
      console.log(`- .sisyphus/plans present: ${yesNo(hasPlans)}`)
      console.log(`- .sisyphus/notepads present: ${yesNo(hasNotepads)}`)
      console.log(`- .sisyphus/evidence present: ${yesNo(hasEvidence)}`)

      if (mergedConfig) {
        console.log("- docs-output enabled: " + yesNo(mergedConfig.docsEnabled === true))
        if (typeof mergedConfig.docsPath === "string") {
          console.log(`- docs-output path: ${mergedConfig.docsPath}`)
        }
        if (typeof mergedConfig.docHistoryMode === "string") {
          console.log(`- docs-output history mode: ${mergedConfig.docHistoryMode}`)
        }
        if (mergedConfig.docsEnabled === true) {
          console.log(`- docs README present: ${yesNo(hasDocsReadme)}`)
        }
      }
    }

    if (warnings.length > 0) {
      console.log("")
      console.log("Warnings")
      for (const warning of warnings) {
        console.log(`- ${warning}`)
      }
    }

    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
