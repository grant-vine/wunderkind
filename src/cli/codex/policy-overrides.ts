import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree, type Node, type ParseError } from "jsonc-parser"
import { dirname, join, resolve } from "node:path"
import { lstatOrMissing, sha256Bytes } from "./state.js"
import { policySnapshot, PolicyTransactionError, type PolicySnapshot } from "./policy-transaction.js"
export const CODEX_POLICY_ROLES = [
  { id: "lazycodex-worker-high", model: "gpt-6-sol", reasoning: "high" },
  { id: "lazycodex-code-reviewer", model: "gpt-6-sol", reasoning: "high" },
  { id: "lazycodex-clone-fidelity-reviewer", model: "gpt-6-sol", reasoning: "high" },
  { id: "metis", model: "gpt-6-sol", reasoning: "high" },
  { id: "momus", model: "gpt-6-sol", reasoning: "high" },
  { id: "lazycodex-gate-reviewer", model: "gpt-6-sol", reasoning: "medium" },
  { id: "plan", model: "gpt-6-sol", reasoning: "high" },
  { id: "lazycodex-worker-low", model: "gpt-6-luna", reasoning: "low" },
  { id: "lazycodex-worker-medium", model: "gpt-6-luna", reasoning: "medium" },
  { id: "explorer", model: "gpt-6-luna", reasoning: "medium" },
  { id: "librarian", model: "gpt-6-luna", reasoning: "medium" },
  { id: "lazycodex-qa-executor", model: "gpt-6-luna", reasoning: "medium" },
] as const
export interface PolicyKeyReceipt {
  readonly file: string; readonly scope: "root" | "user" | "project"; readonly profile: string | null
  readonly key: readonly string[]; readonly value: string; readonly preWriteDigest: string | null; readonly lastWriteDigest: string
}
export interface PolicyReceipt { readonly schemaVersion: 1; readonly policyVersion: 1; readonly keys: readonly PolicyKeyReceipt[] }
export interface PolicyLayer { readonly snapshot: PolicySnapshot; readonly scope: "user" | "project"; readonly tree: Node }
export interface ResolvedPolicyKey { readonly value: unknown; readonly layer: PolicyLayer; readonly key: readonly string[]; readonly profile: string | null }
function duplicateKeys(node: Node): boolean {
  if (node.type === "object") {
    const names = new Set<unknown>()
    for (const property of node.children ?? []) { const key: unknown = property.children?.[0]?.value; if (names.has(key)) return true; names.add(key) }
  }
  return (node.children ?? []).some(duplicateKeys)
}
export function policyJsonTree(text: string): Node {
  const errors: ParseError[] = []; const tree = parseTree(text, errors, { allowTrailingComma: true })
  if (tree === undefined || tree.type !== "object" || errors.length > 0 || duplicateKeys(tree)) throw new PolicyTransactionError("Invalid or duplicate JSONC policy configuration")
  return tree
}
export function readPolicyReceipt(path: string): PolicyReceipt {
  const snapshot = policySnapshot(path)
  if (snapshot.bytes === undefined) return { schemaVersion: 1, policyVersion: 1, keys: [] }
  const tree = policyJsonTree(Buffer.from(snapshot.bytes).toString("utf8")); const value: unknown = getNodeValue(tree)
  if (!record(value) || value["schemaVersion"] !== 1 || value["policyVersion"] !== 1 || !Array.isArray(value["keys"])) throw new PolicyTransactionError("Unsupported model policy receipt")
  const keys: PolicyKeyReceipt[] = []
  for (const item of value["keys"]) {
    if (!record(item) || typeof item["file"] !== "string" || !["root", "user", "project"].includes(String(item["scope"])) || !(item["profile"] === null || typeof item["profile"] === "string") || !Array.isArray(item["key"]) || !item["key"].every((key: unknown) => typeof key === "string") || typeof item["value"] !== "string" || !(item["preWriteDigest"] === null || hash(item["preWriteDigest"])) || !hash(item["lastWriteDigest"])) throw new PolicyTransactionError("Invalid model policy key receipt")
    const scope = item["scope"]; const profile = item["profile"]; const key: unknown[] = item["key"]
    if (scope !== "root" && scope !== "user" && scope !== "project") throw new PolicyTransactionError("Invalid receipt scope")
    if (profile !== null && typeof profile !== "string") throw new PolicyTransactionError("Invalid receipt profile")
    const stringKeys = key.filter((entry): entry is string => typeof entry === "string")
    const pre = item["preWriteDigest"]; const last = item["lastWriteDigest"]
    if ((pre !== null && typeof pre !== "string") || typeof last !== "string") throw new PolicyTransactionError("Invalid receipt digest")
    keys.push({ file: item["file"], scope, profile, key: stringKeys, value: item["value"], preWriteDigest: pre, lastWriteDigest: last })
  }
  return { schemaVersion: 1, policyVersion: 1, keys }
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function hash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
export function activePolicyProfile(): string | undefined { return process.env["OMO_PROFILE"] || process.env["OCX_PROFILE"] || /(?:^|[\\/])profiles[\\/]([^\\/]+)[\\/]*$/u.exec(process.env["OPENCODE_CONFIG_DIR"] ?? "")?.[1] }
export function readPolicyLayers(home: string, cwd: string): readonly PolicyLayer[] {
  function candidate(directory: string): string { const jsonc = join(directory, ".omo", "omo.jsonc"); return lstatOrMissing(jsonc) !== undefined ? jsonc : lstatOrMissing(join(directory, ".omo", "omo.json")) !== undefined ? join(directory, ".omo", "omo.json") : jsonc }
  const project: string[] = []; let current = resolve(cwd)
  for (let depth = 0; depth < 256 && current !== resolve(home); depth += 1) { const path = candidate(current); if (lstatOrMissing(path) !== undefined) project.push(path); const parent = dirname(current); if (parent === current) break; current = parent }
  const files = [{ path: candidate(home), scope: "user" as const }, ...project.reverse().map((path) => ({ path, scope: "project" as const }))]
  return files.map(({ path, scope }) => { const snapshot = policySnapshot(path); return { snapshot, scope, tree: policyJsonTree(snapshot.bytes === undefined ? "{}" : Buffer.from(snapshot.bytes).toString("utf8")) } })
}
export function resolvePolicyKey(layers: readonly PolicyLayer[], role: string, field: string, profile: string | undefined): ResolvedPolicyKey | undefined {
  let resolved: ResolvedPolicyKey | undefined
  for (const selectedProfile of [undefined, profile]) {
    if (selectedProfile === undefined && resolved !== undefined) continue
    for (const layer of layers) {
      const key = [...(selectedProfile === undefined ? [] : ["profiles", selectedProfile]), "[codex]", "agents", role, field]
      const node = findNodeAtLocation(layer.tree, key)
      if (node !== undefined) resolved = { value: getNodeValue(node), layer, key, profile: selectedProfile ?? null }
    }
    if (profile === undefined) break
  }
  return resolved
}
export function receiptForKey(receipt: PolicyReceipt, file: string, key: readonly string[]): PolicyKeyReceipt | undefined {
  return receipt.keys.find((entry) => entry.file === file && JSON.stringify(entry.key) === JSON.stringify(key))
}
export function seedPolicyLayer(layer: PolicyLayer, keys: readonly { readonly key: readonly string[]; readonly value: string }[]): { readonly bytes: Uint8Array; readonly receipts: readonly PolicyKeyReceipt[] } {
  const before = layer.snapshot.bytes === undefined ? "{}\n" : Buffer.from(layer.snapshot.bytes).toString("utf8")
  const after = keys.reduce((text, item) => applyEdits(text, modify(text, [...item.key], item.value, { formattingOptions: { insertSpaces: true, tabSize: 2 } })), before)
  const digest = sha256Bytes(after)
  return { bytes: Buffer.from(after), receipts: keys.map((item) => ({ file: layer.snapshot.path, scope: layer.scope, profile: item.key[0] === "profiles" ? item.key[1] ?? null : null, key: item.key, value: item.value, preWriteDigest: layer.snapshot.digest ?? null, lastWriteDigest: digest })) }
}

export function splitPolicyModel(value: string): { readonly model: string; readonly reasoning?: string } {
  const text = value.trim(); const separator = text.lastIndexOf(":"); const model = text.slice(0, separator).trim(); const token = text.slice(separator + 1).trim().toLowerCase()
  if (separator < 0 || model.length === 0 || !["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"].includes(token) || (token === "max" && !model.includes("/"))) return { model: text }
  return { model, reasoning: token }
}
