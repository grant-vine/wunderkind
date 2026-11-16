import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { applyCodexModelPolicy } from "../../src/cli/codex/model-policy.js"
import { resolveCodexPaths } from "../../src/cli/codex/paths.js"
import { CODEX_POLICY_ROLES } from "../../src/cli/codex/policy-overrides.js"
import { __setPolicyBeforeWriteForTests, policySnapshot } from "../../src/cli/codex/policy-transaction.js"
import { __setPolicyUpstreamRootForTests, resolvePolicyUpstream } from "../../src/cli/codex/policy-upstream.js"
import { cleanup, configure, createFakeCodex, sandbox } from "./helpers/codex-lifecycle-fixtures.js"
import { policyTrace } from "../../src/cli/codex/policy-trace.js"

const originalCwd = process.cwd()
const policyTestTimeoutMs = 90_000
beforeEach(() => __setPolicyUpstreamRootForTests(process.env["WUNDERKIND_WINDOWS_POLICY_UPSTREAM"]))
afterEach(() => { process.chdir(originalCwd); __setPolicyBeforeWriteForTests(undefined); __setPolicyUpstreamRootForTests(undefined) })

function fixture() {
  const started = performance.now()
  policyTrace("fixture.begin")
  const directory = sandbox()
  configure(directory, createFakeCodex())
  process.chdir(directory.root)
  const paths = resolveCodexPaths()
  mkdirSync(paths.agentsDir, { recursive: true })
  const upstream = resolvePolicyUpstream()
  for (const [id, source] of upstream.roles) cpSync(source, join(paths.agentsDir, `${id}.toml`))
  const root = 'model = "operator-root"\nmodel_reasoning_effort = "high"\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"\n[profiles.operator]\nmodel = "gpt-6-astra"\n'
  writeFileSync(join(paths.codexHome, "config.toml"), root)
  mkdirSync(join(paths.home, ".omo"), { recursive: true })
  writeFileSync(join(paths.home, ".omo/omo.jsonc"), '{"[codex]":{"agents":{"explorer":{"model":"gpt-6-astra","reasoning":"high"}}}}')
  const custom = join(paths.agentsDir, "operator-custom.toml")
  writeFileSync(custom, 'model = "operator-custom"\n')
  policyTrace("fixture.end", { elapsedMs: Math.round(performance.now() - started), version: upstream.version })
  return { directory, paths, root, custom }
}

function finish(directory: ReturnType<typeof sandbox>): void { process.chdir(originalCwd); cleanup(directory) }
function addManifest(path: string, agentsDir: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ agents: CODEX_POLICY_ROLES.map((role) => join(agentsDir, `${role.id}.toml`)) }))
}

describe("native policy transaction with trusted upstream", () => {
  for (const location of [".tmp/marketplaces/sisyphuslabs/plugins/omo", "plugins/cache/sisyphuslabs/omo/test"] as const) {
    it(`repairs ${location} manifest with native paths while preserving operator choices`, () => {
      const { directory, paths, root, custom } = fixture()
      const manifest = join(paths.codexHome, location, ".installed-agents.json")
      addManifest(manifest, paths.agentsDir)
      try {
        const report = applyCodexModelPolicy(paths)
        expect(report.astraAssignments).toEqual(["profile:operator", "explorer"])
        for (const role of CODEX_POLICY_ROLES) {
          const parsed = Bun.TOML.parse(readFileSync(join(paths.agentsDir, `${role.id}.toml`), "utf8"))
          expect(parsed["model"]).toBe(role.id === "explorer" ? "gpt-6-astra" : role.model)
        }
        expect(readFileSync(join(paths.codexHome, "config.toml"), "utf8").startsWith(root)).toBe(true)
        expect(readFileSync(custom, "utf8")).toBe('model = "operator-custom"\n')
        const entries = JSON.parse(readFileSync(manifest, "utf8")).agents
        expect(entries).toContain(join(paths.agentsDir, "default.toml"))
        expect(entries.every((entry: string) => dirname(entry) === paths.agentsDir)).toBe(true)
        expect(readFileSync(manifest, "utf8")).not.toContain("wunderkind-policy-stage-")
        expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(true)
        expect(readFileSync(join(paths.agentsDir, ".lazycodex-default.sha256"), "utf8")).toBe(policySnapshot(join(paths.agentsDir, "default.toml")).digest)
      } finally { finish(directory) }
    }, policyTestTimeoutMs)
  }

  for (const conflict of ["rollback", "concurrent"] as const) {
    it(`preserves manifests, roles and receipt ownership on ${conflict}`, () => {
      const { directory, paths, root } = fixture()
      const manifest = join(paths.codexHome, ".tmp/marketplaces/sisyphuslabs/plugins/omo/.installed-agents.json")
      addManifest(manifest, paths.agentsDir)
      const manifestBefore = readFileSync(manifest, "utf8")
      const role = join(paths.agentsDir, "lazycodex-worker-high.toml")
      const roleBefore = readFileSync(role, "utf8")
      let conflictReached = false
      __setPolicyBeforeWriteForTests((_index, path) => {
        if (conflict === "concurrent" && path === manifest) { conflictReached = true; policyTrace("conflict.reached", { kind: conflict }); writeFileSync(manifest, "operator-concurrent-edit") }
        if (conflict === "rollback" && path === join(paths.ownershipRoot, "model-policy.json")) { conflictReached = true; policyTrace("conflict.reached", { kind: conflict }); throw new Error("injected receipt conflict") }
      })
      try {
        expect(() => applyCodexModelPolicy(paths)).toThrow()
        expect(conflictReached).toBe(true)
        expect(readFileSync(manifest, "utf8")).toBe(conflict === "concurrent" ? "operator-concurrent-edit" : manifestBefore)
        expect(readFileSync(role, "utf8")).toBe(roleBefore)
        expect(readFileSync(join(paths.codexHome, "config.toml"), "utf8")).toBe(root)
        expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
      } finally { finish(directory) }
    }, policyTestTimeoutMs)
  }

  it("holds a linked source-manifest parent before any live policy write", () => {
    const { directory, paths, root } = fixture()
    const outside = join(directory.root, "foreign")
    mkdirSync(outside)
    symlinkSync(outside, join(paths.codexHome, ".tmp"), "junction")
    try {
      expect(() => applyCodexModelPolicy(paths)).toThrow("Unsafe policy path")
      expect(readFileSync(join(paths.codexHome, "config.toml"), "utf8")).toBe(root)
      expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { finish(directory) }
  }, policyTestTimeoutMs)

  it("loads the trusted installer from a path containing URL control characters", () => {
    const { directory, paths } = fixture()
    const upstream = resolvePolicyUpstream()
    const copy = join(directory.root, "trusted # package")
    const copyStarted = performance.now()
    policyTrace("package-copy.begin")
    cpSync(join(upstream.root, "packages"), join(copy, "packages"), { recursive: true })
    cpSync(join(upstream.root, "package.json"), join(copy, "package.json"))
    policyTrace("package-copy.end", { elapsedMs: Math.round(performance.now() - copyStarted) })
    __setPolicyUpstreamRootForTests(copy)
    try {
      expect(applyCodexModelPolicy(paths).driftedAssignments).toEqual([])
    } finally { finish(directory) }
  }, policyTestTimeoutMs)
})
