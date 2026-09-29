import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, parse, resolve, sep } from "node:path"
import { lstatOrMissing, sha256Bytes } from "./state.js"
export class PolicyTransactionError extends Error { constructor(message: string) { super(message); this.name = "PolicyTransactionError" } }
export interface PolicySnapshot { readonly path: string; readonly bytes: Uint8Array | undefined; readonly mode: number | undefined; readonly digest: string | undefined }
export interface PolicyDelta { readonly before: PolicySnapshot; readonly bytes: Uint8Array | undefined }
export function safePolicyPath(path: string): void {
  const absolute = resolve(path); let current = parse(absolute).root
  const segments = absolute.slice(current.length).split(sep).filter(Boolean)
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment); const stat = lstatOrMissing(current)
    if (stat === undefined) continue
    if (stat.isSymbolicLink() || (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new PolicyTransactionError(`Unsafe policy path: ${current}`)
  }
}
export function policySnapshot(path: string): PolicySnapshot {
  safePolicyPath(path); const stat = lstatOrMissing(path); const bytes = stat === undefined ? undefined : readFileSync(path)
  if (bytes !== undefined && !Buffer.from(bytes.toString("utf8"), "utf8").equals(bytes)) throw new PolicyTransactionError(`Invalid UTF-8 policy file: ${path}`)
  return { path, bytes, mode: stat === undefined ? undefined : Number(stat.mode), digest: bytes === undefined ? undefined : sha256Bytes(bytes) }
}
let beforeWrite: ((index: number, path: string) => void) | undefined
export function __setPolicyBeforeWriteForTests(callback: ((index: number, path: string) => void) | undefined): void { beforeWrite = callback }
function replace(snapshot: PolicySnapshot, bytes: Uint8Array | undefined): void {
  safePolicyPath(snapshot.path)
  if (bytes === undefined) { rmSync(snapshot.path, { force: true }); return }
  mkdirSync(dirname(snapshot.path), { recursive: true }); safePolicyPath(snapshot.path)
  const temporary = `${snapshot.path}.wunderkind-policy-${process.pid}.tmp`
  try {
    writeFileSync(temporary, bytes, { flag: "wx", mode: snapshot.mode ?? 0o600 }); renameSync(temporary, snapshot.path)
    if (snapshot.mode !== undefined) chmodSync(snapshot.path, snapshot.mode)
  } finally { rmSync(temporary, { force: true }) }
}
export function applyPolicyTransaction(deltas: readonly PolicyDelta[], journalPath: string, guards: readonly PolicySnapshot[] = []): void {
  const applied: PolicyDelta[] = []
  // Every path, including the receipt/journal, is checked before any live mutation.
  for (const delta of deltas) safePolicyPath(delta.before.path)
  safePolicyPath(journalPath)
  try {
    for (const [index, delta] of deltas.entries()) {
      beforeWrite?.(index, delta.before.path)
      for (const guard of guards) {
        const prior = applied.find((entry) => entry.before.path === guard.path)
        const expected = prior === undefined ? guard.digest : prior.bytes === undefined ? undefined : sha256Bytes(prior.bytes)
        if (policySnapshot(guard.path).digest !== expected) throw new PolicyTransactionError(`Concurrent policy input change: ${guard.path}`)
      }
      if (policySnapshot(delta.before.path).digest !== delta.before.digest) throw new PolicyTransactionError(`Concurrent policy change: ${delta.before.path}`)
      replace(delta.before, delta.bytes); applied.push(delta)
    }
  } catch (error) {
    const conflicts: string[] = []
    for (const delta of [...applied].reverse()) {
      const candidate = delta.bytes === undefined ? undefined : sha256Bytes(delta.bytes)
      try {
        if (policySnapshot(delta.before.path).digest !== candidate) { conflicts.push(delta.before.path); continue }
        replace(delta.before, delta.before.bytes)
      } catch (rollbackError) {
        if (!(rollbackError instanceof Error)) throw rollbackError
        conflicts.push(delta.before.path)
      }
    }
    if (conflicts.length > 0) {
      const journal = policySnapshot(journalPath)
      replace(journal, Buffer.from(JSON.stringify({ schemaVersion: 1, conflicts, message: "Concurrent edits preserved; recover operation snapshots manually", snapshots: applied.map((entry) => ({ path: entry.before.path, digest: entry.before.digest, mode: entry.before.mode, previous: entry.before.bytes === undefined ? null : Buffer.from(entry.before.bytes).toString("base64") })) }, null, 2)))
    }
    if (error instanceof Error) throw new PolicyTransactionError(`${error.message}${conflicts.length > 0 ? `; recovery journal: ${journalPath}` : "; operation rolled back"}`)
    throw error
  }
}
