import color from "picocolors"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  LEGACY_PROJECT_ARTIFACT_DIR,
  LEGACY_PROJECT_ARTIFACT_MESSAGE,
  PRIMARY_PROJECT_ARTIFACT_DIR,
} from "../project-artifacts.js"

export interface ProjectArtifactMigrationOptions {
  dryRun?: boolean
}

function printRemovedMigrationGuidance(cwd: string, hasLegacyRoot: boolean, hasPrimaryRoot: boolean, dryRun: boolean): void {
  const legacyRoot = join(cwd, LEGACY_PROJECT_ARTIFACT_DIR)
  const primaryRoot = join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR)

  console.error(`${color.red("✖")} wunderkind migrate was removed in this hard-cut release.`)
  console.error(`${color.dim("- ")}${LEGACY_PROJECT_ARTIFACT_MESSAGE}`)
  console.error(`${color.dim("- ")}Move legacy ${color.cyan(`${LEGACY_PROJECT_ARTIFACT_DIR}/`)} artifacts into ${color.cyan(`${PRIMARY_PROJECT_ARTIFACT_DIR}/`)} manually, then rerun doctor.`)

  if (dryRun) {
    console.error(`${color.dim("- ")}--dry-run no longer previews any moves because automated legacy migration is no longer supported.`)
  }

  if (hasLegacyRoot) {
    console.error(`${color.dim("- ")}Legacy artifacts detected at ${color.dim(legacyRoot)}`)
  }

  if (hasPrimaryRoot) {
    console.error(`${color.dim("- ")}Primary artifact root already present at ${color.dim(primaryRoot)}`)
  }
}

export async function runProjectArtifactMigration(options: ProjectArtifactMigrationOptions = {}): Promise<number> {
  try {
    const cwd = process.cwd()
    const legacyRoot = join(cwd, LEGACY_PROJECT_ARTIFACT_DIR)
    const primaryRoot = join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR)

    const hasLegacyRoot = existsSync(legacyRoot)
    const hasPrimaryRoot = existsSync(primaryRoot)

    printRemovedMigrationGuidance(cwd, hasLegacyRoot, hasPrimaryRoot, options.dryRun === true)
    return 1
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
