import color from "picocolors"
import { migrateLegacyOmoConfig } from "./config-manager/index.js"

export interface ProjectArtifactMigrationOptions {
  dryRun?: boolean
  json?: boolean
}

function printMigrationResult(options: ProjectArtifactMigrationOptions, result: ReturnType<typeof migrateLegacyOmoConfig>): void {
  if (options.json === true) {
    const output = {
      status: result.status,
      legacyConfigPath: result.legacyConfigPath,
      targetConfigPath: result.targetConfigPath,
      preview: result.preview,
      message: result.message,
      ...(result.error ? { error: result.error } : {}),
    }
    console.log(JSON.stringify(output, null, 2))
    return
  }

  if (result.status === "error") {
    console.error(`${color.red("✖")} ${result.message}`)
    if (result.error) {
      console.error(`${color.dim("- ")}${result.error}`)
    }
    return
  }

  console.log(result.message)
  if (result.legacyConfigPath !== null) {
    console.log(`${color.dim("- ")}legacy: ${color.dim(result.legacyConfigPath)}`)
  }
  console.log(`${color.dim("- ")}target: ${color.dim(result.targetConfigPath)} ${color.dim("(~/.omo/omo.jsonc)")}`)
  if (result.preview.copiedPaths.length > 0) {
    console.log(`${color.dim("- ")}copied: ${result.preview.copiedPaths.join(", ")}`)
  }
  if (result.preview.keptPaths.length > 0) {
    console.log(`${color.dim("- ")}kept existing: ${result.preview.keptPaths.join(", ")}`)
  }
}

export async function runProjectArtifactMigration(options: ProjectArtifactMigrationOptions = {}): Promise<number> {
  try {
    const result = migrateLegacyOmoConfig({ dryRun: options.dryRun === true })
    printMigrationResult(options, result)
    return result.status === "error" ? 1 : 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
