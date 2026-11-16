import { readdirSync } from "node:fs"
import { join, posix, win32 } from "node:path"
import { CODEX_POLICY_ROLES } from "./policy-overrides.js"
import { policySnapshot, PolicyTransactionError, type PolicySnapshot } from "./policy-transaction.js"
import { lstatOrMissing } from "./state.js"

export function policyManifestRoles(codexHome: string, entries: unknown): readonly string[] {
  const windows = /^[A-Za-z]:[\\/]/u.test(codexHome)
  const paths = windows ? win32 : posix
  const directory = paths.join(codexHome, "agents")
  const allowed = new Set([...CODEX_POLICY_ROLES.map((role) => `${role.id}.toml`), "default.toml"])
  if (!paths.isAbsolute(codexHome) || (!windows && codexHome.includes("\\")) || !Array.isArray(entries)) {
    throw new PolicyTransactionError("Unsafe upstream agent manifest paths")
  }
  const roles: string[] = []
  for (const entry of entries) {
    if (typeof entry !== "string" || /[\u0000-\u001f\u007f]/u.test(entry)
      || (windows ? !/^[A-Za-z]:[\\/]/u.test(entry) : !posix.isAbsolute(entry) || entry.includes("\\"))) {
      throw new PolicyTransactionError("Unsafe upstream agent manifest paths")
    }
    const segments = entry.split(windows ? /[\\/]/u : /\//u)
    // Reject traversal before normalization, including traversal that lands back inside.
    if (segments.some((part) => part === "." || part === ".." || (windows && /[. ]$/u.test(part)))) {
      throw new PolicyTransactionError("Unsafe upstream agent manifest paths")
    }
    const name = paths.relative(directory, paths.normalize(entry))
    if (!allowed.has(name) || segments.at(-1) !== name || roles.includes(name)) {
      throw new PolicyTransactionError("Unsafe upstream agent manifest paths")
    }
    roles.push(name)
  }
  return roles
}

export function policyManifestSnapshots(codexHome: string): readonly PolicySnapshot[] {
  const manifestPaths: string[] = []
  const cacheRoot = join(codexHome, "plugins/cache/sisyphuslabs/omo")
  if (lstatOrMissing(cacheRoot) !== undefined) {
    policySnapshot(join(cacheRoot, ".path-probe"))
    for (const version of readdirSync(cacheRoot, { withFileTypes: true })) {
      if (!version.isDirectory()) throw new PolicyTransactionError("Unsafe upstream plugin cache entry")
      manifestPaths.push(join(cacheRoot, version.name, ".installed-agents.json"))
    }
  }
  manifestPaths.push(join(codexHome, ".tmp/marketplaces/sisyphuslabs/plugins/omo/.installed-agents.json"))
  const snapshots: PolicySnapshot[] = []
  for (const path of manifestPaths) {
    const snapshot = policySnapshot(path)
    if (snapshot.bytes === undefined) continue
    const manifest: unknown = JSON.parse(Buffer.from(snapshot.bytes).toString("utf8"))
    const entries: unknown = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "agents") : undefined
    policyManifestRoles(codexHome, entries)
    snapshots.push(snapshot)
  }
  return snapshots
}
