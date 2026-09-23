import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs"
import { join } from "node:path"
import { Database } from "bun:sqlite"
import type { Database as SqliteDatabase } from "bun:sqlite"
import { MemoryLedgerError } from "./errors.js"

export interface BackupRequest {
  readonly database: SqliteDatabase
  readonly databasePath: string
  readonly backupDirectory: string
  readonly fromVersion: number
  readonly toVersion: number
  readonly at: number
}

function backupName(request: BackupRequest): string {
  const timestamp = new Date(request.at).toISOString().replace(/[.:]/gu, "-")
  return `${request.fromVersion}-to-${request.toVersion}-${timestamp}.sqlite`
}

function verifyBackup(path: string, version: number): void {
  const backup = new Database(path)
  try {
    backup.exec("PRAGMA query_only = ON;")
    const integrity = backup.prepare<{ readonly integrity_check: string }>("PRAGMA integrity_check").get()
    const schema = backup.prepare<{ readonly user_version: number }>("PRAGMA user_version").get()
    if (integrity?.integrity_check !== "ok" || schema?.user_version !== version) {
      throw new MemoryLedgerError("schema_incompatible")
    }
  } finally {
    backup.close()
  }
}

export function createVerifiedBackup(request: BackupRequest): string {
  const destination = join(request.backupDirectory, backupName(request))
  const temporary = `${destination}.partial`
  if (existsSync(destination) || existsSync(temporary)) {
    throw new MemoryLedgerError("schema_incompatible")
  }
  let completed = false
  try {
    copyFileSync(request.databasePath, temporary)
    verifyBackup(temporary, request.fromVersion)
    renameSync(temporary, destination)
    completed = true
    return destination
  } finally {
    if (!completed && existsSync(temporary)) {
      rmSync(temporary)
    }
  }
}
