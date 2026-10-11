import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { sha256Bytes } from "./state.js"
import { policySnapshot, PolicyTransactionError } from "./policy-transaction.js"
import { CODEX_POLICY_ROLES } from "./policy-overrides.js"
import { withoutPolicySettings } from "./policy-toml.js"
export interface PolicyUpstream { readonly root: string; readonly version: string; readonly bundle: string; readonly artifacts: Readonly<Record<string, string>>; readonly roles: ReadonlyMap<string, string>; readonly roleContent: ReadonlyMap<string, string> }
let rootForTests: string | undefined
const TRUSTED_ARTIFACTS: Readonly<Record<string, string>> = {
  "packages/omo-codex/plugin/scripts/sync-skills.mjs": "f6bd3ecd47881881e3507f584bc724be6d94b338ecfda344eebad89cc596e13f",
  "packages/omo-codex/plugin/scripts/canonical-ultrawork-directive.mjs": "ea39c9a9a2a9ad7b4228cd41f0927d6242b2324b0fd05531b2685cc2a2355255",
  "packages/omo-codex/plugin/scripts/entry-guard.mjs": "44e7493bfad2cfdf510e1138f0c03f241985ebddfbf89f01a934c5a9262fa108",
  "packages/shared-skills/index.mjs": "e13dd7519712a015d54711d5df5591f6221fbfcff5e2478e97caf6e7747398dc",
  "packages/shared-skills/skill-source-filter.mjs": "6853d034a41801f6b9c05eecace902ea86bde16f3ff925489c41fca6e0530561",
  "packages/omo-codex/plugin/components/ultrawork/agents/explorer.toml": "43464388caff89bddf6d534b978bf520fa50ee8b243414c3084f513d098b9fcb",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-clone-fidelity-reviewer.toml": "7c00c1cb32af23697ab5eb8f21d6338c9288e387f79e74ac91d63b6a8e225a86",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-code-reviewer.toml": "692858b214a849fb8515cdc5a64272ca2b160eba6c38c346cb7dd034bf856ca3",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-gate-reviewer.toml": "b1c870f5366576c8a37f217e895bf2c03d3476be5b334374e6c286180610707c",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-qa-executor.toml": "d2b6c0d57ec954ebe1b8dcd85d56de49c809a35994ec0536bed98511ee0da6bb",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-worker-high.toml": "75992808efa18b9b7e2df331de92355597abca65fd7f44ed559d76670cbeaee4",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-worker-low.toml": "8f45221ac3ce766e294b9460dbe08e724d117efeaf900212555d777ec9ecd21a",
  "packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-worker-medium.toml": "7033ef9a93772a0a76b3cee1b38824f8bc1fbf50289749ab64b666342b3ebc33",
  "packages/omo-codex/plugin/components/ultrawork/agents/librarian.toml": "065e11abd54ef008c1abd62d3bba9a9a3301a3bf6c7a56d599d8b06311657213",
  "packages/omo-codex/plugin/components/ultrawork/agents/metis.toml": "944d3effed07c72167c13da4ee4d7593670062282ec34ddefac8d2513e2afd92",
  "packages/omo-codex/plugin/components/ultrawork/agents/momus.toml": "f30de18782766252f7a04e5415a4bffdf9cbff66f15d045943e618a1624830a8",
  "packages/omo-codex/plugin/components/ultrawork/agents/plan.toml": "931a12b363de8915d3aabae7352b6ecbef95cb1ecc93628e38a3e48d34606c8b",
}
const TRUSTED_RELEASES: Readonly<Record<string, { readonly artifacts: Readonly<Record<string, string>> }>> = {
  "5.1.1": { artifacts: { ...TRUSTED_ARTIFACTS, "packages/omo-codex/scripts/install-dist/install-local.mjs": "1b318ef8b414c49d7467f9e6dffa345c11b71895fa8fec97cf76912ddb9ffd33" } },
  "5.1.29": { artifacts: { ...TRUSTED_ARTIFACTS, "packages/omo-codex/scripts/install-dist/install-local.mjs": "d72a76623343c8cdc0ec4e02be8eed925755ad8a8ade40a5de09491d1358ebe2" } },
}
export function __setPolicyUpstreamRootForTests(root: string | undefined): void { rootForTests = root }
export function resolvePolicyUpstream(): PolicyUpstream {
  const root = rootForTests ?? resolve(dirname(fileURLToPath(import.meta.resolve("oh-my-openagent"))), "..")
  const bundle = join(root, "packages/omo-codex/scripts/install-dist/install-local.mjs")
  if (!existsSync(bundle)) throw new PolicyTransactionError("Supported LazyCodex installer bundle is unavailable; install the reviewed oh-my-openagent distribution before policy repair")
  const manifest: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  const version = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "version") : undefined
  const trusted = typeof version === "string" ? TRUSTED_RELEASES[version] : undefined
  if (trusted === undefined) throw new PolicyTransactionError("Model policy requires a reviewed LazyCodex installer")
  for (const [relative, digest] of Object.entries(trusted.artifacts)) {
    const snapshot = policySnapshot(join(root, relative))
    if (snapshot.digest !== digest) throw new PolicyTransactionError(`Untrusted policy synchronization executable: ${relative}`)
  }
  const shared: unknown = JSON.parse(readFileSync(join(root, "packages/shared-skills/package.json"), "utf8"))
  if (typeof shared !== "object" || shared === null || Reflect.get(shared, "name") !== "@oh-my-opencode/shared-skills" || Reflect.get(shared, "version") !== "0.1.0" || Reflect.get(shared, "dependencies") !== undefined) throw new PolicyTransactionError("Unreviewed shared-skills stage dependency")
  const exports: unknown = Reflect.get(shared, "exports")
  if (typeof exports !== "object" || exports === null || JSON.stringify(Reflect.get(exports, ".")) !== JSON.stringify({ types: "./index.d.ts", import: "./index.mjs" }) || JSON.stringify(Reflect.get(exports, "./skill-source-filter")) !== JSON.stringify({ types: "./skill-source-filter.d.ts", import: "./skill-source-filter.mjs" })) throw new PolicyTransactionError("Unsupported shared-skills exports")
  const roles = new Map<string, string>(); const roleContent = new Map<string, string>(); const components = join(root, "packages/omo-codex/plugin/components")
  for (const component of readdirSync(components, { withFileTypes: true })) {
    if (!component.isDirectory()) continue
    const directory = join(components, component.name, "agents")
    if (!existsSync(directory)) continue
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".toml")) continue
      const id = entry.name.slice(0, -5)
      if (roles.has(id)) throw new PolicyTransactionError(`Duplicate bundled role: ${id}`)
      const path = join(directory, entry.name); const snapshot = policySnapshot(path); const relative = `packages/omo-codex/plugin/components/${component.name}/agents/${entry.name}`
      if (snapshot.bytes === undefined || snapshot.digest !== trusted.artifacts[relative]) throw new PolicyTransactionError(`Untrusted bundled role: ${id}`)
      roles.set(id, path); roleContent.set(id, Buffer.from(snapshot.bytes).toString("utf8"))
    }
  }
  if (roles.size !== CODEX_POLICY_ROLES.length || CODEX_POLICY_ROLES.some((role) => !roles.has(role.id))) throw new PolicyTransactionError("Unreviewed LazyCodex role inventory; policy repair held")
  return { root, version, bundle, artifacts: trusted.artifacts, roles, roleContent }
}
export function assertRoleProvenance(installed: string, source: string): void {
  if (withoutPolicySettings(installed) !== withoutPolicySettings(source)) throw new PolicyTransactionError("Unrelated role customization or unknown source provenance; preserve the prompt and review the diff before repair")
}
export interface StagedPolicy { readonly changes: readonly { readonly path: string; readonly before: string | null; readonly after: string | null }[]; readonly manifestRoles: readonly string[]; readonly files: ReadonlyMap<string, Uint8Array>; readonly inventory: readonly string[] }
export function stageUpstreamPolicy(input: { readonly upstream: PolicyUpstream; readonly agents: ReadonlyMap<string, Uint8Array>; readonly root: string; readonly overrides: Readonly<Record<string, unknown>>; readonly layers?: readonly { readonly scope: "user" | "project"; readonly bytes: Uint8Array }[]; readonly profile?: string }): StagedPolicy {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), "wunderkind-policy-stage-"))
  try {
    const home = join(temporary, "home"); const codexHome = join(home, ".codex"); let project = join(home, "project")
    mkdirSync(join(codexHome, "agents"), { recursive: true }); mkdirSync(join(home, ".omo"), { recursive: true }); mkdirSync(project)
    writeFileSync(join(codexHome, "config.toml"), input.root)
    for (const [name, bytes] of input.agents) writeFileSync(join(codexHome, "agents", name), bytes)
    if (input.layers === undefined) writeFileSync(join(home, ".omo/omo.jsonc"), JSON.stringify({ "[codex]": { agents: input.overrides } }))
    else {
      const user = input.layers.find((layer) => layer.scope === "user")
      if (user === undefined) throw new PolicyTransactionError("Missing staged user configuration")
      writeFileSync(join(home, ".omo/omo.jsonc"), user.bytes)
      for (const [index, layer] of input.layers.filter((layer) => layer.scope === "project").entries()) {
        project = join(project, `layer-${index}`); mkdirSync(join(project, ".omo"), {recursive:true}); writeFileSync(join(project, ".omo/omo.jsonc"), layer.bytes)
      }
    }
    // The full supported installer runs only in this disposable tree. Dependencies/tool provisioning
    // are deliberately excluded; unexpected subprocesses fail closed, and telemetry is disabled.
    function treeInventory(): ReadonlyMap<string, string> {
      const result = new Map<string, string>()
      function walk(path: string, relative: string): void {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
          const name = `${relative}${entry.name}`; const absolute = join(path, entry.name)
          const value = entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? `symlink:${readlinkSync(absolute)}` : entry.isFile() ? sha256Bytes(readFileSync(absolute)) : "unsupported"
          result.set(name, value); if (entry.isDirectory()) walk(absolute, `${name}/`)
        }
      }
      walk(home, ""); return result
    }
    const beforeInventory = treeInventory()
    const runner = join(temporary, "runner.mjs")
    writeFileSync(runner, `
import { cp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const bundlePath = ${JSON.stringify(input.upstream.bundle)};
if (createHash("sha256").update(await readFile(bundlePath)).digest("hex") !== ${JSON.stringify(input.upstream.artifacts["packages/omo-codex/scripts/install-dist/install-local.mjs"])}) throw new Error("Installer changed before invocation");
const { installMarketplaceLocally } = await import(bundlePath);
const cacheRoot = ${JSON.stringify(codexHome + "/plugins/cache/")};
const commands = [];
const runCommand = async (command, args, options) => {
  const cwd = resolve(options.cwd);
  if (!cwd.startsWith(cacheRoot) || command !== "npm") throw new Error("Unexpected subprocess: " + command + " " + args.join(" "));
  const signature = JSON.stringify(args); commands.push({ command, args, cwd });
  if (signature === JSON.stringify(["install", "--omit=dev", "--no-audit", "--no-fund"]) || signature === JSON.stringify(["ci", "--omit=dev"])) {
    // Role regeneration uses the bundled installer. Skill synchronization needs only this
    // dependency-free, version/hash-verified shipped package; broader runtime provisioning
    // belongs to the normal upstream installation, not this policy-only operation.
    const destination = join(cwd, "node_modules/@oh-my-opencode/shared-skills");
    await mkdir(join(cwd, "node_modules/@oh-my-opencode"), {recursive:true});
    await cp(${JSON.stringify(join(input.upstream.root, "packages/shared-skills"))}, destination, {recursive:true});
    const manifest = JSON.parse(await readFile(join(destination,"package.json"),"utf8"));
    if (manifest.name !== "@oh-my-opencode/shared-skills" || manifest.version !== "0.1.0" || manifest.dependencies !== undefined || manifest.exports?.["."]?.import !== "./index.mjs" || manifest.exports?.["./skill-source-filter"]?.import !== "./skill-source-filter.mjs") throw new Error("Stage dependency exports changed during copy");
    for (const [file, digest] of ${JSON.stringify(Object.entries(input.upstream.artifacts).filter(([path]) => path.startsWith("packages/shared-skills/")).map(([path, digest]) => [path.slice("packages/shared-skills/".length), digest]))}) {
      if (createHash("sha256").update(await readFile(join(destination,file))).digest("hex") !== digest) throw new Error("Stage dependency changed during copy");
    }
    return;
  }
  if (signature === JSON.stringify(["run", "sync:skills"])) {
    for (const [file,digest] of ${JSON.stringify(Object.entries(input.upstream.artifacts).filter(([path]) => path.startsWith("packages/omo-codex/plugin/scripts/")).map(([path,digest]) => [path.slice("packages/omo-codex/plugin/".length),digest]))}) {
      if (createHash("sha256").update(await readFile(join(cwd,file))).digest("hex") !== digest) throw new Error("Stage executable changed before invocation");
    }
    const executable = join(cwd,"scripts/sync-skills.mjs");
    if (createHash("sha256").update(await readFile(executable)).digest("hex") !== ${JSON.stringify(input.upstream.artifacts["packages/omo-codex/plugin/scripts/sync-skills.mjs"])}) throw new Error("Untrusted stage sync executable");
    const child = spawnSync(process.execPath,[executable],{cwd,env:process.env,timeout:15000,killSignal:"SIGKILL",maxBuffer:1048576,encoding:"utf8"});
    if (child.error || child.status !== 0) throw new Error("Stage skill synchronization failed: " + (child.error?.message ?? child.stderr));
    return;
  }
  throw new Error("Unexpected subprocess: " + command + " " + args.join(" "));
};
const result = await installMarketplaceLocally({ repoRoot: ${JSON.stringify(input.upstream.root)}, codexHome: ${JSON.stringify(codexHome)}, binDir: ${JSON.stringify(join(home, "bin"))}, projectDirectory: ${JSON.stringify(project)}, env: process.env, autonomousPermissions: false, astGrepInstaller: async () => ({kind: "failed", reason: "Outside policy-only regeneration scope"}), runCommand });
console.log(JSON.stringify({installed:result.installed,commands}));
`)

    const env = { ...(input.profile === undefined ? {} : { OMO_PROFILE: input.profile }), PATH: process.env["PATH"], HOME: home, USERPROFILE: home, CODEX_HOME: codexHome, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), TMPDIR: temporary, TEMP: temporary, TMP: temporary, OMO_DISABLE_POSTHOG: "1", OMO_CODEX_DISABLE_POSTHOG: "1", OMO_SEND_ANONYMOUS_TELEMETRY: "0", OMO_CODEX_SEND_ANONYMOUS_TELEMETRY: "0" }
    const result = spawnSync("node", [runner], { cwd: project, env, timeout: 45_000, killSignal: "SIGKILL", maxBuffer: 1_048_576, encoding: "utf8" })
    if (result.error !== undefined || result.status !== 0) throw new PolicyTransactionError(`Isolated LazyCodex synchronization failed: ${result.error?.message ?? result.stderr.slice(-3000)}`)
    const files = new Map<string, Uint8Array>()
    for (const entry of readdirSync(join(codexHome, "agents"), { withFileTypes: true })) {
      if (!entry.isFile()) throw new PolicyTransactionError("Unexpected staged agent type")
      files.set(`agents/${entry.name}`, readFileSync(join(codexHome, "agents", entry.name)))
    }
    files.set("config.toml", readFileSync(join(codexHome, "config.toml")))
    const afterInventory = treeInventory(); const inventory = [...afterInventory.keys()]
    const changes = [...new Set([...beforeInventory.keys(), ...afterInventory.keys()])].filter((path) => beforeInventory.get(path) !== afterInventory.get(path)).map((path) => ({ path, before: beforeInventory.get(path) ?? null, after: afterInventory.get(path) ?? null }))
    // Never copy a manifest containing absolute temporary paths. A corresponding live manifest
    // is generated from the verified staged roles by the caller, or left untouched if absent.
    const manifestPath = inventory.find((path) => path === ".codex/.tmp/marketplaces/sisyphuslabs/plugins/omo/.installed-agents.json")
    if (manifestPath === undefined) throw new PolicyTransactionError(`Missing staged upstream agent manifest: ${inventory.filter((path) => path.includes("installed-agents"))}`)
    const manifest: unknown = JSON.parse(readFileSync(join(home, manifestPath), "utf8"))
    if (typeof manifest !== "object" || manifest === null) throw new PolicyTransactionError("Invalid staged upstream manifest")
    const agentPaths: unknown = Reflect.get(manifest, "agents")
    if (!Array.isArray(agentPaths) || !agentPaths.every((path: unknown) => typeof path === "string" && path.startsWith(`${codexHome}/agents/`) && /^[A-Za-z0-9-]+\.toml$/u.test(path.slice(`${codexHome}/agents/`.length)))) throw new PolicyTransactionError("Unsafe staged upstream manifest paths")
    const manifestRoles = agentPaths.filter((path): path is string => typeof path === "string").map((path) => path.slice(`${codexHome}/agents/`.length))
    return { files, inventory, manifestRoles, changes }
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}
