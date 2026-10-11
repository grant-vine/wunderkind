import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it } from "bun:test"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { applyCodexModelPolicy, CodexModelPolicyError, inspectCodexModelPolicy } from "../../src/cli/codex/model-policy.js"
import { resolveCodexPaths } from "../../src/cli/codex/paths.js"
import { CODEX_POLICY_ROLES } from "../../src/cli/codex/policy-overrides.js"
import { __setPolicyBeforeWriteForTests, applyPolicyTransaction, policySnapshot } from "../../src/cli/codex/policy-transaction.js"
import { __setPolicyUpstreamRootForTests, resolvePolicyUpstream } from "../../src/cli/codex/policy-upstream.js"
import { editPolicyToml, policyTomlString, scanPolicyToml } from "../../src/cli/codex/policy-toml.js"
import { cleanup as cleanupFixture, configure, createFakeCodex, sandbox } from "./helpers/codex-lifecycle-fixtures.js"
const ORIGINAL_CWD = process.cwd()
function fixture() { const directory = sandbox(); configure(directory, createFakeCodex()); const home = directory.home; if (home === undefined) throw new Error("Fixture home is required"); process.chdir(home); return { directory, paths: resolveCodexPaths() } }
function cleanup(directory: ReturnType<typeof sandbox>): void { process.chdir(ORIGINAL_CWD); cleanupFixture(directory) }
function bundledRoles(paths: ReturnType<typeof resolveCodexPaths>): void {
  mkdirSync(paths.agentsDir, { recursive: true })
  for (const [id, source] of resolvePolicyUpstream().roles) cpSync(source, join(paths.agentsDir, `${id}.toml`))
}
function json(path: string): unknown { return JSON.parse(readFileSync(path, "utf8")) }
function model(path: string): unknown { return Bun.TOML.parse(readFileSync(path, "utf8"))["model"] }
afterEach(() => { process.chdir(ORIGINAL_CWD); __setPolicyBeforeWriteForTests(undefined); __setPolicyUpstreamRootForTests(undefined) })
describe("lossless policy TOML editing", () => {
  it("inserts a root model while preserving profile and multiline instruction assignments", () => {
    // Given
    const source = `developer_instructions = '''\nmodel = "inside-instruction"\n'''\n[profiles.operator]\nmodel = 'intentional-other' # keep\n`
    // When
    const result = editPolicyToml(source, { model: "gpt-6-sol" })
    // Then
    const parsed = Bun.TOML.parse(result); expect(parsed["model"]).toBe("gpt-6-sol"); expect(result).toContain(source.slice(source.indexOf("[profiles"))); expect(policyTomlString(scanPolicyToml(source), "model")).toBeUndefined()
  })
  it("preserves comments and quote-key spelling when replacing a scalar", () => {
    // Given
    const source = `# model = "false-match"\n'model'  = 'gpt-6-astra' # operator note\n[table]\nmodel = "table-value"\n`
    // When
    const result = editPolicyToml(source, { model: "gpt-6-sol" })
    // Then
    expect(Bun.TOML.parse(result)["model"]).toBe("gpt-6-sol"); expect(result).toContain(" # operator note"); expect(result).toContain('[table]\nmodel = "table-value"')
  })
  for (const source of ['model = "x"\nmodel = "y"\n', 'model = "unterminated\n', '[foo]\n[foo]\n', 'model = 123\n', '[[unsupported]]\nname = "x"\n']) it("holds unsupported or invalid policy syntax", () => {
    // Given an input outside the conservative editor contract
    // When / Then
    expect(() => editPolicyToml(source, { model: "gpt-6-sol" })).toThrow()
  })
})
describe("durable Codex policy", () => {
  it("uses the independently reviewed model and reasoning targets for every shipped role", () => {
    // Given: exact execution-plan role matrix
    const expected = [
      ["lazycodex-worker-high", "gpt-6-sol", "high"], ["lazycodex-code-reviewer", "gpt-6-sol", "high"],
      ["lazycodex-clone-fidelity-reviewer", "gpt-6-sol", "high"], ["metis", "gpt-6-sol", "high"],
      ["momus", "gpt-6-sol", "high"], ["lazycodex-gate-reviewer", "gpt-6-sol", "medium"],
      ["plan", "gpt-6-sol", "high"], ["lazycodex-worker-low", "gpt-6-luna", "low"],
      ["lazycodex-worker-medium", "gpt-6-luna", "medium"], ["explorer", "gpt-6-luna", "medium"],
      ["librarian", "gpt-6-luna", "medium"], ["lazycodex-qa-executor", "gpt-6-luna", "medium"],
    ]
    // When / Then
    expect(CODEX_POLICY_ROLES.map((role) => [role.id, role.model, role.reasoning])).toEqual(expected)
  })

  it("isolates the injected fake home before seeding absent literal durable role keys", () => {
    // Given
    const { directory, paths } = fixture()
    try {
      // When
      const report = applyCodexModelPolicy(paths)
      // Then
      expect(process.cwd()).toBe(paths.home); expect(report.missingAssignments).toContain("default"); expect(model(join(paths.codexHome, "config.toml"))).toBe("gpt-6-sol")
      const config = json(join(paths.home, ".omo/omo.jsonc")); expect(typeof config).toBe("object")
      const text = readFileSync(join(paths.home, ".omo/omo.jsonc"), "utf8")
      for (const role of CODEX_POLICY_ROLES) expect(text).toContain(`"${role.id}"`)
      expect(json(join(paths.ownershipRoot, "model-policy.json"))).toHaveProperty("policyVersion", 1)
    } finally { cleanup(directory) }
  })
  it("honors a project durable override outside the Codex home", () => {
    // Given
    const { directory, paths } = fixture(); const project = mkdtempSync(join(tmpdir(), "wunderkind codex policy project "))
    try {
      mkdirSync(join(project, ".omo"), { recursive: true }); writeFileSync(join(project, ".omo/omo.jsonc"), '{"[codex]":{"agents":{"explorer":{"model":"operator-project-model","reasoning":"high"}}}}'); process.chdir(project); bundledRoles(paths)
      // When
      applyCodexModelPolicy(paths)
      // Then
      expect(model(join(paths.agentsDir, "explorer.toml"))).toBe("operator-project-model"); expect(readFileSync(join(project, ".omo/omo.jsonc"), "utf8")).toContain("operator-project-model"); expect(readFileSync(join(paths.home, ".omo/omo.jsonc"), "utf8")).not.toContain('"explorer"')
    } finally { cleanup(directory); rmSync(project, { recursive: true, force: true }) }
  })
  it("repairs trusted shipped Astra roles using the actual upstream installer twice", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      // When: repeated operation exercises upstream model/default receipt reload
      applyCodexModelPolicy(paths); const report = applyCodexModelPolicy(paths)
      // Then
      expect(report.status).toBe("compliant"); expect(report.astraAssignments).toEqual([])
      for (const role of CODEX_POLICY_ROLES) expect(model(join(paths.agentsDir, `${role.id}.toml`))).toBe(role.model)
      expect(model(join(paths.agentsDir, "default.toml"))).toBe("gpt-6-luna")
      expect(readFileSync(join(paths.agentsDir, ".lazycodex-default.sha256"), "utf8")).toHaveLength(64)
    } finally { cleanup(directory) }
  })
  it("preserves intentional root/profile Astra and durable role overrides without receipts", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      mkdirSync(join(paths.home, ".omo"), { recursive: true }); writeFileSync(join(paths.home, ".omo/omo.jsonc"), '{"[codex]":{"agents":{"explorer":{"model":"gpt-6-astra","reasoning":"high"}}}}')
      writeFileSync(join(paths.codexHome, "config.toml"), 'model = "intentional-root" # preserve\n[profiles.operator]\nmodel = "gpt-6-astra"\n')
      // When
      const report = applyCodexModelPolicy(paths)
      // Then
      expect(model(join(paths.codexHome, "config.toml"))).toBe("intentional-root"); expect(readFileSync(join(paths.codexHome, "config.toml"), "utf8")).toContain('[profiles.operator]\nmodel = "gpt-6-astra"'); expect(model(join(paths.agentsDir, "explorer.toml"))).toBe("gpt-6-astra"); expect(report.userOwnedAssignments).toContain("explorer")
    } finally { cleanup(directory) }
  })
  it("preserves edited managed keys and does not silently reclaim removed keys", () => {
    // Given
    const { directory, paths } = fixture()
    try {
      applyCodexModelPolicy(paths); const file = join(paths.home, ".omo/omo.jsonc"); const before = readFileSync(file, "utf8")
      const changed = before.replace('"model": "gpt-6-sol"', '"model": "intentional-high"'); writeFileSync(file, changed)
      // When
      applyCodexModelPolicy(paths)
      // Then
      expect(readFileSync(file, "utf8")).toContain('"model": "intentional-high"')
      const removed = readFileSync(file, "utf8").replace(/\s*"reasoning": "high",?/u, ""); writeFileSync(file, removed)
      expect(() => applyCodexModelPolicy(paths)).toThrow("Removed managed")
      expect(readFileSync(file, "utf8")).toBe(removed)
    } finally { cleanup(directory) }
  })
  it("reclaims a removed managed key only through explicit reset", () => {
    // Given
    const { directory, paths } = fixture()
    try {
      applyCodexModelPolicy(paths); const file = join(paths.home, ".omo/omo.jsonc"); const config = JSON.parse(readFileSync(file, "utf8")); delete config["[codex]"].agents.explorer.model; writeFileSync(file, JSON.stringify(config))
      // When
      applyCodexModelPolicy(paths, { resetManagedKeys: true })
      // Then
      expect(JSON.parse(readFileSync(file, "utf8"))["[codex]"].agents.explorer.model).toBe("gpt-6-luna")
    } finally { cleanup(directory) }
  })
  it("holds an unreceipted historical model choice instead of inferring intent", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      const path = join(paths.agentsDir, "explorer.toml"); const bytes = editPolicyToml(readFileSync(path, "utf8"), { model: "gpt-5.5" }); writeFileSync(path, bytes)
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Unreceipted explorer")
      expect(readFileSync(path, "utf8")).toBe(bytes); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false)
    } finally { cleanup(directory) }
  })
  it("holds unknown prompt customization before writing any durable seed", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      const path = join(paths.agentsDir, "explorer.toml"); const bytes = readFileSync(path, "utf8") + '\n# operator prompt customization\n'; writeFileSync(path, bytes)
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Unrelated role customization")
      expect(readFileSync(path, "utf8")).toBe(bytes); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false)
    } finally { cleanup(directory) }
  })
  it("holds a user-owned default conflict without synthesizing its hash receipt", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      const path = join(paths.agentsDir, "default.toml"); writeFileSync(path, 'model = "operator-default"\n')
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Unowned default"); expect(model(path)).toBe("operator-default"); expect(existsSync(join(paths.agentsDir, ".lazycodex-default.sha256"))).toBe(false)
    } finally { cleanup(directory) }
  })
  it("reports unknown roles and missing required roles during read-only inspection", () => {
    // Given
    const { directory, paths } = fixture(); mkdirSync(paths.agentsDir, { recursive: true }); writeFileSync(join(paths.agentsDir, "custom.toml"), 'model = "operator-model"\n')
    try {
      // When
      const report = inspectCodexModelPolicy(paths)
      // Then
      expect(report.unknownAssignments).toEqual(["custom"]); expect(report.missingAssignments).toContain("default"); expect(existsSync(paths.ownershipRoot)).toBe(false)
    } finally { cleanup(directory) }
  })
  for (const target of ["file", "parent", "dangling"] as const) it("holds symlinks before mutating any policy path", () => {
    // Given
    const { directory, paths } = fixture(); const outside = join(directory.root, "outside"); mkdirSync(outside)
    try {
      if (target === "parent") symlinkSync(outside, paths.codexHome)
      else { mkdirSync(paths.codexHome); symlinkSync(target === "dangling" ? join(outside, "missing") : join(outside, "target"), join(paths.codexHome, "config.toml")) }
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Unsafe policy path"); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false)
    } finally { cleanup(directory) }
  })

  it("honors farthest-to-nearest project layers followed by active-profile overrides", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    const originalCwd = process.cwd(); const oldProfile = process.env["OMO_PROFILE"]
    try {
      const project = join(paths.home, "project"); const nested = join(project, "nested")
      mkdirSync(join(paths.home, ".omo"), { recursive: true }); mkdirSync(join(project, ".omo"), { recursive: true }); mkdirSync(nested)
      writeFileSync(join(paths.home, ".omo/omo.jsonc"), '{"[codex]":{"agents":{"explorer":{"model":"base-user"}}},"profiles":{"review":{"[codex]":{"agents":{"explorer":{"model":"gpt-6-astra","reasoning":"high"}}}}}}')
      const projectFile = join(project, ".omo/omo.jsonc"); const projectBytes = '{"[codex]":{"agents":{"explorer":{"model":"project-override"}}}}'; writeFileSync(projectFile, projectBytes)
      process.chdir(nested); process.env["OMO_PROFILE"] = "review"
      // When
      const report = applyCodexModelPolicy(paths)
      // Then
      expect(model(join(paths.agentsDir, "explorer.toml"))).toBe("gpt-6-astra"); expect(report.userOwnedAssignments).toContain("explorer"); expect(readFileSync(projectFile, "utf8")).toBe(projectBytes)
    } finally { process.chdir(originalCwd); if (oldProfile === undefined) delete process.env["OMO_PROFILE"]; else process.env["OMO_PROFILE"] = oldProfile; cleanup(directory) }
  })
  it("reloads durable ownership and real upstream synchronization in a cold process", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      applyCodexModelPolicy(paths)
      const entry = new URL("../../src/cli/codex/model-policy.ts", import.meta.url).pathname
      const program = `import { applyCodexModelPolicy } from ${JSON.stringify(entry)}; console.log(JSON.stringify(applyCodexModelPolicy(${JSON.stringify(paths)})));`
      // When
      const child = spawnSync(process.execPath, ["--eval", program], { cwd: paths.home, env: { PATH: process.env["PATH"], HOME: paths.home, USERPROFILE: paths.home, CODEX_HOME: paths.codexHome, OMO_DISABLE_POSTHOG: "1", OMO_CODEX_DISABLE_POSTHOG: "1" }, encoding: "utf8", timeout: 45000, maxBuffer: 1048576 })
      // Then
      expect(child.status).toBe(0); expect(JSON.parse(child.stdout).status).toBe("compliant"); expect(model(join(paths.agentsDir, "default.toml"))).toBe("gpt-6-luna")
    } finally { cleanup(directory) }
  })
  it("rolls back root, seeds and upstream role writes when default receipt commit fails", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    const before = new Map(CODEX_POLICY_ROLES.map((role) => [role.id, readFileSync(join(paths.agentsDir, `${role.id}.toml`), "utf8")]))
    __setPolicyBeforeWriteForTests((_index, path) => { if (path.endsWith(".lazycodex-default.sha256")) throw new Error("injected default receipt failure") })
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("rolled back")
      for (const [id, bytes] of before) expect(readFileSync(join(paths.agentsDir, `${id}.toml`), "utf8")).toBe(bytes)
      expect(existsSync(join(paths.codexHome, "config.toml"))).toBe(false); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false); expect(existsSync(join(paths.agentsDir, "default.toml"))).toBe(false); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })

  it("preserves an operator edit to seeded root reasoning independently from root model", () => {
    // Given
    const { directory, paths } = fixture()
    try {
      applyCodexModelPolicy(paths); const file = join(paths.codexHome, "config.toml"); writeFileSync(file, readFileSync(file, "utf8").replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "max"'))
      // When
      applyCodexModelPolicy(paths)
      // Then
      expect(Bun.TOML.parse(readFileSync(file, "utf8"))["model_reasoning_effort"]).toBe("max")
    } finally { cleanup(directory) }
  })
  it("maps staged manifest paths to the live root without copying temporary absolute paths", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      const manifest = join(paths.codexHome, ".tmp/marketplaces/sisyphuslabs/plugins/omo/.installed-agents.json"); mkdirSync(join(paths.codexHome, ".tmp/marketplaces/sisyphuslabs/plugins/omo"), { recursive: true }); writeFileSync(manifest, JSON.stringify({ agents: CODEX_POLICY_ROLES.map((role) => join(paths.agentsDir, `${role.id}.toml`)) }))
      // When
      applyCodexModelPolicy(paths)
      // Then
      const config = JSON.parse(readFileSync(manifest, "utf8")); expect(config.agents).toContain(join(paths.agentsDir, "default.toml")); expect(config.agents.every((path: string) => path.startsWith(paths.agentsDir + "/"))).toBe(true); expect(readFileSync(manifest, "utf8")).not.toContain("wunderkind-policy-stage-")
    } finally { cleanup(directory) }
  })
  it("distinguishes disabled optional roles from missing required roles", () => {
    // Given
    const { directory, paths } = fixture()
    try {
      mkdirSync(join(paths.home, ".omo"), { recursive: true }); writeFileSync(join(paths.home, ".omo/omo.jsonc"), '{"[codex]":{"agents":{"default":{"disable":true},"explorer":{"disable":true}}}}')
      // When
      const report = inspectCodexModelPolicy(paths)
      // Then
      expect(report.disabledAssignments).toEqual(["explorer", "default"]); expect(report.missingAssignments).not.toContain("default"); expect(report.missingAssignments).toContain("lazycodex-worker-high")
    } finally { cleanup(directory) }
  })
  it("holds invalid TOML or duplicate JSONC before all writes", () => {
    // Given
    const { directory, paths } = fixture()
    try {
      mkdirSync(paths.codexHome); writeFileSync(join(paths.codexHome, "config.toml"), 'model = "x" trailing-invalid\n')
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow(CodexModelPolicyError); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false)
      rmSync(join(paths.codexHome, "config.toml")); mkdirSync(join(paths.home, ".omo")); const file = join(paths.home, ".omo/omo.jsonc"); writeFileSync(file, '{"[codex]":{},"[codex]":{}}')
      expect(() => applyCodexModelPolicy(paths)).toThrow("duplicate JSONC"); expect(readFileSync(file, "utf8")).toBe('{"[codex]":{},"[codex]":{}}')
    } finally { cleanup(directory) }
  })
  it("rejects a modified shipped executable before staging or receipt creation", () => {
    // Given
    const { directory, paths } = fixture(); const upstream = resolvePolicyUpstream(); const fake = join(paths.home, "modified-upstream"); mkdirSync(join(fake, "packages/omo-codex/scripts/install-dist"), { recursive: true }); writeFileSync(join(fake, "package.json"), '{"version":"5.1.1"}'); writeFileSync(join(fake, "packages/omo-codex/scripts/install-dist/install-local.mjs"), readFileSync(upstream.bundle, "utf8") + "\n// tampered\n"); __setPolicyUpstreamRootForTests(fake)
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Untrusted policy synchronization executable"); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })
  it("rejects an unsupported LazyCodex release before staging or receipt creation", () => {
    // Given
    const { directory, paths } = fixture(); const upstream = resolvePolicyUpstream(); const fake = join(paths.home, "unsupported-version")
    cpSync(upstream.root, fake, { recursive: true }); writeFileSync(join(fake, "package.json"), JSON.stringify({ ...JSON.parse(readFileSync(join(fake, "package.json"), "utf8")), version: "5.1.30" })); __setPolicyUpstreamRootForTests(fake)
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("reviewed LazyCodex installer"); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })
  it("rejects an extra bundled role before staging or receipt creation", () => {
    // Given
    const { directory, paths } = fixture(); const upstream = resolvePolicyUpstream(); const fake = join(paths.home, "extra-role")
    cpSync(upstream.root, fake, { recursive: true }); writeFileSync(join(fake, "packages/omo-codex/plugin/components/ultrawork/agents/unreviewed.toml"), 'name = "unreviewed"\nmodel = "gpt-6-sol"\n'); __setPolicyUpstreamRootForTests(fake)
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Untrusted bundled role"); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })

  it("deletes only upstream-owned default bytes and registration when explicitly disabled", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      applyCodexModelPolicy(paths); const file = join(paths.home, ".omo/omo.jsonc"); const config = JSON.parse(readFileSync(file, "utf8")); config["[codex]"].agents.default = { disable: true }; writeFileSync(file, JSON.stringify(config))
      // When
      const report = applyCodexModelPolicy(paths)
      // Then
      expect(report.disabledAssignments).toContain("default"); expect(existsSync(join(paths.agentsDir, "default.toml"))).toBe(false); expect(existsSync(join(paths.agentsDir, ".lazycodex-default.sha256"))).toBe(false); expect(readFileSync(join(paths.codexHome, "config.toml"), "utf8")).not.toContain("[agents.default]")
    } finally { cleanup(directory) }
  })
  it("rejects missing or incompatible shared-skills exports before all writes", () => {
    // Given
    const { directory, paths } = fixture(); const upstream = resolvePolicyUpstream(); const fake = join(paths.home, "unsupported-upstream")
    mkdirSync(join(fake, "packages"), { recursive: true }); cpSync(join(upstream.root, "packages/omo-codex"), join(fake, "packages/omo-codex"), { recursive: true }); cpSync(join(upstream.root, "packages/shared-skills"), join(fake, "packages/shared-skills"), { recursive: true }); writeFileSync(join(fake, "package.json"), JSON.stringify({ version: upstream.version })); const manifest = join(fake, "packages/shared-skills/package.json"); writeFileSync(manifest, '{"name":"@oh-my-opencode/shared-skills","version":"0.1.0","exports":{}}'); __setPolicyUpstreamRootForTests(fake)
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Unsupported shared-skills exports"); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false)
    } finally { cleanup(directory) }
  })

  it("preserves retired-role files when trusted previous prompt provenance is unavailable", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      const path = join(paths.agentsDir, "codex-ultrawork-reviewer.toml"); const bytes = 'name = "codex-ultrawork-reviewer"\nmodel = "operator-model"\n'; writeFileSync(path, bytes)
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow("Retired role provenance requires review"); expect(readFileSync(path, "utf8")).toBe(bytes)
    } finally { cleanup(directory) }
  })

  it("holds concatenated multiline-string tokens before creating seeds or receipts", () => {
    // Given: Bun's TOML oracle rejects the source
    const { directory, paths } = fixture(); mkdirSync(paths.codexHome); const file = join(paths.codexHome, "config.toml"); const source = 'developer_instructions = """a""" junk """b"""\n'; writeFileSync(file, source)
    try {
      expect(() => Bun.TOML.parse(source)).toThrow()
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow(); expect(readFileSync(file, "utf8")).toBe(source); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })

  for (const source of ["developer_instructions = 'a\u0001b'\n", 'features = ["a\u0001b"]\n']) it("holds invalid raw control characters before all writes", () => {
    // Given: independent TOML oracle rejects literal/array raw controls
    const { directory, paths } = fixture(); mkdirSync(paths.codexHome); const file = join(paths.codexHome, "config.toml"); writeFileSync(file, source)
    try {
      expect(() => Bun.TOML.parse(source)).toThrow()
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow(); expect(readFileSync(file, "utf8")).toBe(source); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false)
    } finally { cleanup(directory) }
  })

  for (const source of ['x = ["\\U00110000"]\n', 'x = ["\\uD800"]\n', 'a.b = 1\n[a]\nc = 2\n', '[a]\nb.c = 1\n[a.b]\nd = 2\n', '[a.b]\nc = 1\n[a]\nb.d = 2\n']) it("holds Unicode scalar or dotted namespace inputs rejected by the independent TOML oracle", () => {
    // Given: Python tomllib rejection independently recorded in the review artifact
    const { directory, paths } = fixture(); mkdirSync(paths.codexHome); const file = join(paths.codexHome, "config.toml"); writeFileSync(file, source)
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow(CodexModelPolicyError); expect(readFileSync(file, "utf8")).toBe(source); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })

  it("holds an existing role table without config_file instead of appending a duplicate", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths); const file = join(paths.codexHome, "config.toml"); const source = '[agents.explorer]\ndescription = "operator setting"\n'; writeFileSync(file, source)
    try {
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow(CodexModelPolicyError); expect(readFileSync(file, "utf8")).toBe(source); expect(existsSync(join(paths.home, ".omo/omo.jsonc"))).toBe(false); expect(existsSync(join(paths.ownershipRoot, "model-policy.json"))).toBe(false)
    } finally { cleanup(directory) }
  })
  it("holds disabled default registration removal when it would delete operator settings", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      applyCodexModelPolicy(paths); const root = join(paths.codexHome, "config.toml"); const source = readFileSync(root, "utf8") + 'description = "operator setting"\n'; writeFileSync(root, source)
      const file = join(paths.home, ".omo/omo.jsonc"); const config = JSON.parse(readFileSync(file, "utf8")); config["[codex]"].agents.default = { disable: true }; writeFileSync(file, JSON.stringify(config)); const beforeDefault = readFileSync(join(paths.agentsDir, "default.toml"), "utf8")
      // When / Then
      expect(() => applyCodexModelPolicy(paths)).toThrow(CodexModelPolicyError); expect(readFileSync(root, "utf8")).toBe(source); expect(readFileSync(join(paths.agentsDir, "default.toml"), "utf8")).toBe(beforeDefault)
    } finally { cleanup(directory) }
  })

  it("reports generated role reasoning drift against the unchanged managed durable key", () => {
    // Given
    const { directory, paths } = fixture(); bundledRoles(paths)
    try {
      applyCodexModelPolicy(paths); const file = join(paths.agentsDir, "lazycodex-gate-reviewer.toml"); writeFileSync(file, editPolicyToml(readFileSync(file, "utf8"), { model_reasoning_effort: "high" }))
      // When
      const report = inspectCodexModelPolicy(paths)
      // Then
      expect(report.status).toBe("drifted"); expect(report.driftedAssignments).toContain("lazycodex-gate-reviewer:reasoning"); expect(report.userOwnedAssignments).not.toContain("lazycodex-gate-reviewer:reasoning")
    } finally { cleanup(directory) }
  })

})
describe("guarded policy transaction", () => {
  it("rolls back every prior write after an injected later failure", () => {
    // Given
    const { directory, paths } = fixture(); mkdirSync(paths.codexHome); const first = join(paths.codexHome, "first"); const second = join(paths.codexHome, "second"); writeFileSync(first, "before")
    const deltas = [{ before: policySnapshot(first), bytes: Buffer.from("after") }, { before: policySnapshot(second), bytes: Buffer.from("created") }]
    __setPolicyBeforeWriteForTests((index) => { if (index === 1) throw new Error("injected nth write") })
    try {
      // When / Then
      expect(() => applyPolicyTransaction(deltas, join(paths.ownershipRoot, "recovery.json"))).toThrow("rolled back"); expect(readFileSync(first, "utf8")).toBe("before"); expect(existsSync(second)).toBe(false)
    } finally { cleanup(directory) }
  })
  it("preserves a concurrent edit during rollback and records exact recovery snapshots", () => {
    // Given
    const { directory, paths } = fixture(); mkdirSync(paths.codexHome); const first = join(paths.codexHome, "first"); const second = join(paths.codexHome, "second"); writeFileSync(first, "before")
    const deltas = [{ before: policySnapshot(first), bytes: Buffer.from("after") }, { before: policySnapshot(second), bytes: Buffer.from("created") }]
    __setPolicyBeforeWriteForTests((index) => { if (index === 1) { writeFileSync(first, "concurrent"); throw new Error("injected") } })
    try {
      // When / Then
      expect(() => applyPolicyTransaction(deltas, join(paths.ownershipRoot, "recovery.json"))).toThrow("recovery journal"); expect(readFileSync(first, "utf8")).toBe("concurrent"); expect(json(join(paths.ownershipRoot, "recovery.json"))).toHaveProperty("conflicts", [first])
    } finally { cleanup(directory) }
  })
})
