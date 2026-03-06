import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

export async function checkMemoryStatus(url: string, adapter: "mem0" | "vector" = "mem0"): Promise<{ ok: boolean; message: string }> {
  if (adapter === "vector") {
    try {
      const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return { ok: true, message: `Qdrant is running at ${url}` }
      return { ok: false, message: `Qdrant returned HTTP ${res.status}` }
    } catch {
      return { ok: false, message: `Cannot reach Qdrant at ${url}` }
    }
  }
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return { ok: true, message: `mem0 is running at ${url}` }
    return { ok: false, message: `mem0 returned HTTP ${res.status}` }
  } catch {
    return { ok: false, message: `Cannot reach mem0 at ${url}` }
  }
}

export function startMemoryServices(_projectDir: string, adapter: "mem0" | "vector" = "mem0"): { success: boolean; message: string } {
  const composeFile = adapter === "vector" ? "docker-compose.vector.yml" : "docker-compose.mem0.yml"
  const composePath = path.join(homedir(), ".wunderkind", composeFile)
  const label = adapter === "vector" ? "Qdrant" : "mem0"
  if (!existsSync(composePath)) {
    return { success: false, message: "Run wunderkind install first to set up the global ~/.wunderkind/ directory" }
  }
  try {
    execSync(`docker compose -f "${composePath}" up -d`, { stdio: "pipe" })
    return { success: true, message: `${label} services started` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Failed to start ${label}: ${msg}` }
  }
}
