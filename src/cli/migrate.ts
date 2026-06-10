import color from "picocolors"
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { LEGACY_PROJECT_ARTIFACT_DIR, PRIMARY_PROJECT_ARTIFACT_DIR } from "../project-artifacts.js"

export interface ProjectArtifactMigrationOptions {
  dryRun?: boolean
}

interface PlannedMove {
  from: string
  to: string
}

interface MigrationPlan {
  moves: PlannedMove[]
  deletes: string[]
  conflicts: string[]
}

function compareFileContents(leftPath: string, rightPath: string): boolean {
  return readFileSync(leftPath).equals(readFileSync(rightPath))
}

function planMigration(sourcePath: string, targetPath: string, relativeLabel: string): MigrationPlan {
  if (!existsSync(targetPath)) {
    return {
      moves: [{ from: sourcePath, to: targetPath }],
      deletes: [],
      conflicts: [],
    }
  }

  const sourceStat = lstatSync(sourcePath)
  const targetStat = lstatSync(targetPath)

  if (sourceStat.isDirectory() && targetStat.isDirectory()) {
    return readdirSync(sourcePath).reduce<MigrationPlan>((acc, entry) => {
      const nestedSource = join(sourcePath, entry)
      const nestedTarget = join(targetPath, entry)
      const nestedLabel = relativeLabel === "" ? entry : `${relativeLabel}/${entry}`
      const nestedPlan = planMigration(nestedSource, nestedTarget, nestedLabel)
      acc.moves.push(...nestedPlan.moves)
      acc.deletes.push(...nestedPlan.deletes)
      acc.conflicts.push(...nestedPlan.conflicts)
      return acc
    }, { moves: [], deletes: [], conflicts: [] })
  }

  if (!sourceStat.isDirectory() && !targetStat.isDirectory()) {
    if (compareFileContents(sourcePath, targetPath)) {
      return {
        moves: [],
        deletes: [sourcePath],
        conflicts: [],
      }
    }

    return {
      moves: [],
      deletes: [],
      conflicts: [relativeLabel],
    }
  }

  return {
    moves: [],
    deletes: [],
    conflicts: [relativeLabel],
  }
}

function pruneEmptyDirectories(rootPath: string): void {
  if (!existsSync(rootPath) || !lstatSync(rootPath).isDirectory()) {
    return
  }

  for (const entry of readdirSync(rootPath)) {
    const childPath = join(rootPath, entry)
    if (lstatSync(childPath).isDirectory()) {
      pruneEmptyDirectories(childPath)
    }
  }

  if (readdirSync(rootPath).length === 0) {
    rmSync(rootPath, { recursive: true, force: true })
  }
}

export async function runProjectArtifactMigration(options: ProjectArtifactMigrationOptions = {}): Promise<number> {
  try {
    const cwd = process.cwd()
    const legacyRoot = join(cwd, LEGACY_PROJECT_ARTIFACT_DIR)
    const primaryRoot = join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR)

    const hasLegacyRoot = existsSync(legacyRoot)
    const hasPrimaryRoot = existsSync(primaryRoot)

    if (!hasLegacyRoot && !hasPrimaryRoot) {
      console.log(`${color.dim("- ")}No ${LEGACY_PROJECT_ARTIFACT_DIR}/ or ${PRIMARY_PROJECT_ARTIFACT_DIR}/ project artifact directories were found in ${color.dim(cwd)}`)
      return 0
    }

    if (!hasLegacyRoot && hasPrimaryRoot) {
      console.log(`${color.dim("- ")}Project already uses ${PRIMARY_PROJECT_ARTIFACT_DIR}/ as the primary artifact directory.`)
      return 0
    }

    if (!hasPrimaryRoot) {
      if (options.dryRun === true) {
        console.log(`${color.cyan("•")} Would rename ${color.dim(`${LEGACY_PROJECT_ARTIFACT_DIR}/`)} -> ${color.dim(`${PRIMARY_PROJECT_ARTIFACT_DIR}/`)}`)
        return 0
      }

      renameSync(legacyRoot, primaryRoot)
      console.log(`${color.green("✓")} Migrated ${color.dim(`${LEGACY_PROJECT_ARTIFACT_DIR}/`)} -> ${color.dim(`${PRIMARY_PROJECT_ARTIFACT_DIR}/`)}`)
      return 0
    }

    const plan = planMigration(legacyRoot, primaryRoot, "")

    if (plan.conflicts.length > 0) {
      console.error(`Conflict: ${LEGACY_PROJECT_ARTIFACT_DIR}/ and ${PRIMARY_PROJECT_ARTIFACT_DIR}/ both contain different content for:`)
      for (const conflict of plan.conflicts) {
        console.error(`- ${conflict}`)
      }
      console.error(`Resolve the conflicting paths, then rerun ${color.cyan("wunderkind migrate")}.`)
      return 1
    }

    if (options.dryRun === true) {
      console.log(`${color.cyan("•")} Would move ${plan.moves.length} path(s) and remove ${plan.deletes.length} duplicate legacy file(s).`)
      console.log(`${color.cyan("•")} Would finish with ${color.dim(`${PRIMARY_PROJECT_ARTIFACT_DIR}/`)} as the primary artifact directory.`)
      return 0
    }

    for (const move of plan.moves) {
      mkdirSync(dirname(move.to), { recursive: true })
      renameSync(move.from, move.to)
    }

    for (const filePath of plan.deletes) {
      rmSync(filePath, { force: true })
    }

    pruneEmptyDirectories(legacyRoot)

    console.log(`${color.green("✓")} Migrated legacy project artifacts into ${color.dim(`${PRIMARY_PROJECT_ARTIFACT_DIR}/`)}`)
    console.log(`${color.dim("- ")}Moved paths: ${plan.moves.length}`)
    console.log(`${color.dim("- ")}Removed duplicate legacy files: ${plan.deletes.length}`)
    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
