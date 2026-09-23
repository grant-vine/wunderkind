import { existsSync, lstatSync, mkdirSync, realpathSync, statSync } from "node:fs"
import { basename, isAbsolute, join, relative, resolve } from "node:path"
import { MemoryLedgerError } from "./errors.js"

function isWithin(parent: string, candidate: string): boolean {
  const pathRelative = relative(parent, candidate)
  return pathRelative === "" || (!isAbsolute(pathRelative) && !pathRelative.split(/[\\/]/u).includes(".."))
}

function safeDatabaseName(input: string): string {
  if (input !== basename(input) || !/^[A-Za-z0-9][A-Za-z0-9_-]*\.sqlite$/u.test(input)) {
    throw new MemoryLedgerError("containment")
  }
  return input
}

function requireContainedDatabaseFile(memoryDirectory: string, filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }
  if (lstatSync(filePath).isSymbolicLink() || !statSync(filePath).isFile()) {
    throw new MemoryLedgerError("containment")
  }
  const resolvedFilePath = realpathSync(filePath)
  if (!isWithin(memoryDirectory, resolvedFilePath) || resolvedFilePath !== filePath) {
    throw new MemoryLedgerError("containment")
  }
}

export function resolveMemoryDirectory(projectRoot: string): string {
  let root: string
  try {
    root = realpathSync(resolve(projectRoot))
  } catch {
    throw new MemoryLedgerError("containment")
  }
  if (!statSync(root).isDirectory()) {
    throw new MemoryLedgerError("containment")
  }
  const memoryDirectory = join(root, ".wunderkind")
  if (existsSync(memoryDirectory)) {
    if (lstatSync(memoryDirectory).isSymbolicLink() || !statSync(memoryDirectory).isDirectory()) {
      throw new MemoryLedgerError("containment")
    }
  } else {
    mkdirSync(memoryDirectory)
  }
  const resolvedMemoryDirectory = realpathSync(memoryDirectory)
  if (!isWithin(root, resolvedMemoryDirectory) || resolvedMemoryDirectory !== memoryDirectory) {
    throw new MemoryLedgerError("containment")
  }
  return resolvedMemoryDirectory
}

export function resolveLedgerPath(projectRoot: string, databaseName: string): string {
  const resolvedMemoryDirectory = resolveMemoryDirectory(projectRoot)
  const safeName = safeDatabaseName(databaseName)
  const databasePath = join(resolvedMemoryDirectory, safeName)
  if (!isWithin(resolvedMemoryDirectory, databasePath)) {
    throw new MemoryLedgerError("containment")
  }
  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`]) {
    requireContainedDatabaseFile(resolvedMemoryDirectory, filePath)
  }
  return databasePath
}

export function resolveBackupDirectory(databasePath: string): string {
  const memoryDirectory = resolve(databasePath, "..")
  const backupDirectory = join(memoryDirectory, "memory-backups")
  if (existsSync(backupDirectory)) {
    if (lstatSync(backupDirectory).isSymbolicLink() || !statSync(backupDirectory).isDirectory()) {
      throw new MemoryLedgerError("containment")
    }
  } else {
    mkdirSync(backupDirectory)
  }
  const resolvedMemoryDirectory = realpathSync(memoryDirectory)
  const resolvedBackupDirectory = realpathSync(backupDirectory)
  if (!isWithin(resolvedMemoryDirectory, resolvedBackupDirectory) || resolvedBackupDirectory !== backupDirectory) {
    throw new MemoryLedgerError("containment")
  }
  return resolvedBackupDirectory
}
