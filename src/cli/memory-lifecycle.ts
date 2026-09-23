import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type MemoryWorkerStopResult = "not-running" | "stopped" | "failed"

function workerPidPath(projectRoot: string): string {
  return join(projectRoot, ".wunderkind", "worker.pid")
}

function isLive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function stopProjectMemoryWorker(projectRoot: string): Promise<MemoryWorkerStopResult> {
  const pidPath = workerPidPath(projectRoot)
  if (!existsSync(pidPath)) return "not-running"
  const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10)
  if (!Number.isSafeInteger(pid) || !isLive(pid)) return "not-running"
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    return "failed"
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
  return isLive(pid) ? "failed" : "stopped"
}
