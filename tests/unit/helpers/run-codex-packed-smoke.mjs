import { createHash } from "node:crypto"
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const PACKAGE_VERSION = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8")).version
const AGENT_IDS = [
  "wunderkind-architecture",
  "wunderkind-ciso",
  "wunderkind-creative-director",
  "wunderkind-legal",
  "wunderkind-marketing",
  "wunderkind-product",
]
const SKILL_IDS = [
  "compliance-officer",
  "docs-index",
  "experimentation-analyst",
  "oss-licensing-advisor",
  "prd-pipeline",
  "release-upgrade",
  "setup-wunderkind-workflow",
  "social-media-maven",
  "supportability-review",
  "technical-writer",
  "wunderkind",
]

/** @typedef {{ readonly command: string, readonly args: readonly string[], readonly status: number | null, readonly stdout: string, readonly stderr: string }} CommandResult */

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function relativeToRoot(path, root) {
  const value = relative(root, path)
  return value === "" ? "." : value
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: false,
    timeout: options.timeout ?? 30_000,
  })
  const commandResult = {
    command,
    args,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
  if (result.error !== undefined) fail(`${command} ${args.join(" ")} failed to start: ${result.error.message}`)
  return commandResult
}

function requireSuccess(result, label) {
  if (result.status !== 0) fail(`${label} failed (${result.status}): ${result.stderr || result.stdout}`)
  return result
}

function json(result, label) {
  try {
    return JSON.parse(result.stdout)
  } catch {
    fail(`${label} returned invalid JSON: ${result.stdout}`)
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function checkAgentTomls(agentsDirectory) {
  const actual = readdirSync(agentsDirectory).filter((entry) => entry.startsWith("wunderkind-") && entry.endsWith(".toml")).sort()
  assert(JSON.stringify(actual) === JSON.stringify(AGENT_IDS.map((id) => `${id}.toml`).sort()), "expected exactly six installed Wunderkind agent TOMLs")
  for (const name of actual) {
    const content = readFileSync(join(agentsDirectory, name), "utf8")
    assert(/^name\s*=\s*"[^"]+"/mu.test(content), `${name} is missing name`)
    assert(/^description\s*=\s*"[^"]+"/mu.test(content), `${name} is missing description`)
    assert(/^developer_instructions\s*=\s*"""/mu.test(content), `${name} is missing developer instructions`)
  }
}

function checkSkills(pluginRoot) {
  const skillsRoot = join(pluginRoot, "skills")
  const actual = readdirSync(skillsRoot).sort()
  assert(JSON.stringify(actual) === JSON.stringify(SKILL_IDS), "expected exactly eleven packaged Wunderkind skills")
  for (const skill of SKILL_IDS) {
    const skillPath = join(skillsRoot, skill, "SKILL.md")
    assert(existsSync(skillPath), `missing packaged skill ${skill}`)
    assert(readFileSync(skillPath, "utf8").length > 0, `empty packaged skill ${skill}`)
  }
}

function createOmoFixture(root) {
  const marketplaceRoot = join(root, "omo-marketplace")
  const pluginRoot = join(marketplaceRoot, "plugins", "omo", "4.19.4")
  mkdirSync(join(marketplaceRoot, ".agents", "plugins"), { recursive: true })
  mkdirSync(join(pluginRoot, ".codex-plugin"), { recursive: true })
  mkdirSync(join(pluginRoot, "skills", "fixture"), { recursive: true })
  writeFileSync(join(marketplaceRoot, ".agents", "plugins", "marketplace.json"), `${JSON.stringify({
    name: "sisyphuslabs",
    plugins: [{ name: "omo", source: { source: "local", path: "./plugins/omo/4.19.4" } }],
  }, null, 2)}\n`)
  writeFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), `${JSON.stringify({
    name: "omo",
    version: "4.19.4",
    description: "Offline LazyCodex smoke fixture.",
    author: { name: "Wunderkind smoke" },
    license: "MIT",
    skills: "./skills/",
  }, null, 2)}\n`)
  writeFileSync(join(pluginRoot, "skills", "fixture", "SKILL.md"), "---\nname: fixture\ndescription: Offline fixture for Wunderkind packed smoke.\n---\n\nFixture.\n")
  return marketplaceRoot
}

function isolatedEnvironment(homeRoot) {
  const codeHome = join(homeRoot, ".codex")
  mkdirSync(codeHome, { recursive: true })
  return {
    ...process.env,
    HOME: homeRoot,
    CODEX_HOME: codeHome,
    XDG_CONFIG_HOME: join(homeRoot, ".config"),
    XDG_CACHE_HOME: join(homeRoot, ".cache"),
    XDG_DATA_HOME: join(homeRoot, ".local", "share"),
    NO_COLOR: "1",
  }
}

function runCodex(env, args, cwd) {
  return run("codex", args, { env, cwd })
}

function assertNoWunderkindRegistration(env, cwd, label) {
  const marketplaces = json(requireSuccess(runCodex(env, ["plugin", "marketplace", "list", "--json"], cwd), `${label} marketplace list`), `${label} marketplace list`)
  assert(Array.isArray(marketplaces.marketplaces), `${label} marketplace listing lacks marketplaces`)
  assert(!marketplaces.marketplaces.some((entry) => entry?.name === "grant-vine"), `${label} unexpectedly registered Wunderkind marketplace`)
  const plugins = json(requireSuccess(runCodex(env, ["plugin", "list", "--json"], cwd), `${label} plugin list`), `${label} plugin list`)
  assert(Array.isArray(plugins.installed), `${label} plugin listing lacks installed plugins`)
  assert(!plugins.installed.some((entry) => entry?.pluginId === "wunderkind@grant-vine"), `${label} unexpectedly installed Wunderkind plugin`)
}

function seedLazyCodex(root, env, cwd) {
  const fixture = createOmoFixture(root)
  const marketplaceResult = requireSuccess(runCodex(env, ["plugin", "marketplace", "add", fixture, "--json"], cwd), "seed OMO marketplace")
  const marketplace = json(marketplaceResult, "seed OMO marketplace")
  assert(marketplace.marketplaceName === "sisyphuslabs", "OMO fixture marketplace registration used an unexpected name")
  const pluginResult = requireSuccess(runCodex(env, ["plugin", "add", "omo@sisyphuslabs", "--json"], cwd), "seed OMO plugin")
  const plugin = json(pluginResult, "seed OMO plugin")
  assert(plugin.pluginId === "omo@sisyphuslabs" && plugin.version === "4.19.4", "OMO fixture plugin did not install the required version")
  const installed = json(requireSuccess(runCodex(env, ["plugin", "list", "--json"], cwd), "verify OMO fixture"), "verify OMO fixture")
  const omo = Array.isArray(installed.installed) ? installed.installed.find((entry) => entry?.pluginId === "omo@sisyphuslabs") : undefined
  assert(omo?.installed === true && omo?.enabled === true && omo?.version === "4.19.4", "OMO fixture is not installed and enabled")
}

function packAndExtract(root) {
  requireSuccess(run("bun", ["run", "build"], { cwd: PROJECT_ROOT, timeout: 120_000 }), "build packaged artifact")
  const archiveDirectory = join(root, "archive")
  mkdirSync(archiveDirectory, { recursive: true })
  requireSuccess(run("bun", ["pm", "pack", "--destination", archiveDirectory, "--quiet"], { cwd: PROJECT_ROOT, timeout: 120_000 }), "pack packaged artifact")
  const archives = readdirSync(archiveDirectory).filter((entry) => entry.endsWith(".tgz"))
  assert(archives.length === 1, "pack did not produce exactly one tarball")
  const archive = join(archiveDirectory, archives[0])
  const extracted = join(root, "extracted")
  mkdirSync(extracted, { recursive: true })
  requireSuccess(run("tar", ["-xzf", archive, "-C", extracted]), "extract packaged artifact")
  const packedRoot = join(extracted, "package")
  const packedCli = join(packedRoot, "bin", "wunderkind.js")
  assert(existsSync(packedCli), "extracted package does not contain the Wunderkind CLI")
  assert(relativeToRoot(packedCli, PROJECT_ROOT).startsWith(".."), "packed CLI unexpectedly resolves inside the source tree")
  const dependencies = join(PROJECT_ROOT, "node_modules")
  assert(existsSync(dependencies), "source dependency fixture is missing node_modules")
  symlinkSync(dependencies, join(packedRoot, "node_modules"), "dir")
  assert(lstatSync(join(packedRoot, "node_modules")).isSymbolicLink(), "packed dependency fixture was not linked")
  return { packedRoot, packedCli }
}

function runPackedCli(packedCli, env, args, cwd) {
  return run("node", [packedCli, "codex", ...args], { env, cwd, timeout: 60_000 })
}

function validateHappyLifecycle(root, packed) {
  const home = join(root, "happy-home")
  const project = join(root, "happy-project")
  mkdirSync(project, { recursive: true })
  const env = isolatedEnvironment(home)
  seedLazyCodex(join(root, "happy-fixture"), env, project)

  const installed = requireSuccess(runPackedCli(packed.packedCli, env, ["install"], project), "packed install")
  assert(installed.stdout.includes("Installed Wunderkind Codex"), "packed install did not report success")
  assert(installed.stdout.includes("Start a new Codex task"), "packed install omitted restart/new-task guidance")
  const wunderkindHome = join(home, ".wunderkind")
  const agentsDirectory = join(home, ".codex", "agents")
  const marketplaceRoot = join(wunderkindHome, "codex", "marketplace")
  const pluginRoot = join(marketplaceRoot, "plugins", "wunderkind", PACKAGE_VERSION)
  checkAgentTomls(agentsDirectory)
  checkSkills(pluginRoot)
  assert(existsSync(join(marketplaceRoot, ".agents", "plugins", "marketplace.json")), "Wunderkind marketplace descriptor was not installed")
  assert(existsSync(join(wunderkindHome, "codex", "install-state.json")), "Wunderkind install state was not recorded")

  const doctor = requireSuccess(runPackedCli(packed.packedCli, env, ["doctor", "--json"], project), "packed doctor")
  const report = json(doctor, "packed doctor")
  assert(report.schemaVersion === 1 && report.core?.healthy === true, "packed doctor did not report a healthy installation")
  assert(Object.keys(report.core.agents ?? {}).length === 6, "packed doctor did not discover six agents")
  assert(Object.keys(report.core.skills ?? {}).length === 11, "packed doctor did not discover eleven skills")

  const discovered = json(requireSuccess(runCodex(env, ["plugin", "list", "--available", "--json"], project), "Codex discovery list"), "Codex discovery list")
  const wunderkind = Array.isArray(discovered.installed) ? discovered.installed.find((entry) => entry?.pluginId === "wunderkind@grant-vine") : undefined
  assert(wunderkind?.installed === true && wunderkind?.enabled === true, "Codex discovery list did not report enabled Wunderkind")
  const loginStatus = runCodex(env, ["login", "status"], project)
  assert(loginStatus.status !== 0, "isolated Codex home unexpectedly has credentials; smoke must not run a billable agent task")

  requireSuccess(runPackedCli(packed.packedCli, env, ["init", "--docs-enabled", "no"], project), "packed project init")
  const configPath = join(project, ".wunderkind", "wunderkind.config.jsonc")
  const markerPath = join(project, ".wunderkind", "codex-project.json")
  const guidancePath = join(project, ".wunderkind", "runtime", "codex", "workflow-guidance.md")
  for (const path of [configPath, markerPath, guidancePath, join(project, "AGENTS.md"), join(project, "CONTEXT.md"), join(project, ".omo")]) {
    assert(existsSync(path), `packed project init did not create ${relativeToRoot(path, project)}`)
  }
  requireSuccess(runPackedCli(packed.packedCli, env, ["cleanup"], project), "packed project cleanup")
  assert(!existsSync(markerPath) && !existsSync(guidancePath), "packed cleanup did not remove Codex-only project files")
  for (const path of [configPath, join(project, "AGENTS.md"), join(project, "CONTEXT.md"), join(project, ".omo")]) {
    assert(existsSync(path), `packed cleanup removed preserved project artifact ${relativeToRoot(path, project)}`)
  }

  const upgrade = requireSuccess(runPackedCli(packed.packedCli, env, ["upgrade"], project), "packed upgrade")
  assert(upgrade.stdout.includes("Start a new Codex task"), "packed upgrade omitted restart/new-task guidance")

  const modifiedAgent = join(agentsDirectory, "wunderkind-ciso.toml")
  const modifiedBytes = `${readFileSync(modifiedAgent, "utf8")}\n# operator modification\n`
  writeFileSync(modifiedAgent, modifiedBytes)
  const modifiedDoctor = runPackedCli(packed.packedCli, env, ["doctor", "--json"], project)
  assert(modifiedDoctor.status === 1, "doctor accepted a modified owned agent")
  const modifiedReport = json(modifiedDoctor, "modified-agent doctor")
  assert(modifiedReport.core?.agents?.["wunderkind-ciso"] === "stale-owned", "doctor did not classify modified agent as stale-owned")
  const modifiedUpgrade = runPackedCli(packed.packedCli, env, ["upgrade"], project)
  assert(modifiedUpgrade.status === 1 && (modifiedUpgrade.stderr + modifiedUpgrade.stdout).includes("modified and was preserved"), "upgrade did not preserve the modified agent")
  assert(readFileSync(modifiedAgent, "utf8") === modifiedBytes, "upgrade overwrote a modified agent")
  const modifiedUninstall = runPackedCli(packed.packedCli, env, ["uninstall"], project)
  const modifiedUninstallOutput = modifiedUninstall.stderr + modifiedUninstall.stdout
  assert(modifiedUninstall.status === 1 && modifiedUninstallOutput.includes("preserved 1 modified agents") && modifiedUninstallOutput.includes("Recovery required"), `uninstall did not report modified-agent recovery: ${modifiedUninstallOutput}`)
  assert(readFileSync(modifiedAgent, "utf8") === modifiedBytes, "uninstall deleted a modified agent")
  assert(existsSync(join(wunderkindHome, "codex", "install-state.json")), "uninstall removed recovery state after preserving a modified agent")
  return { env, project }
}

function validatePayloadTamper(root, packed) {
  const tamperedPackage = join(root, "tampered-package")
  cpSync(packed.packedRoot, tamperedPackage, { recursive: true, dereference: false })
  const packagedDependencyLink = join(tamperedPackage, "node_modules")
  if (!existsSync(packagedDependencyLink)) symlinkSync(join(PROJECT_ROOT, "node_modules"), packagedDependencyLink, "dir")
  const corruptAgent = join(tamperedPackage, "codex", "agents", "wunderkind-ciso.toml")
  writeFileSync(corruptAgent, `${readFileSync(corruptAgent, "utf8")}\n# corrupt packed payload\n`)
  const home = join(root, "tampered-home")
  const project = join(root, "tampered-project")
  mkdirSync(project, { recursive: true })
  const env = isolatedEnvironment(home)
  seedLazyCodex(join(root, "tampered-fixture"), env, project)
  const install = runPackedCli(join(tamperedPackage, "bin", "wunderkind.js"), env, ["install"], project)
  assert(install.status === 1 && (install.stderr + install.stdout).includes("digest"), "corrupted packed payload did not block install before registration")
  assertNoWunderkindRegistration(env, project, "corrupted payload")
}

function validateCleanUninstall(root, packed) {
  const home = join(root, "clean-home")
  const project = join(root, "clean-project")
  mkdirSync(project, { recursive: true })
  const env = isolatedEnvironment(home)
  seedLazyCodex(join(root, "clean-fixture"), env, project)
  requireSuccess(runPackedCli(packed.packedCli, env, ["install"], project), "clean uninstall install")
  const uninstall = requireSuccess(runPackedCli(packed.packedCli, env, ["uninstall"], project), "clean uninstall")
  assert(uninstall.stdout.includes("Removed 6 Codex agents; preserved 0 modified agents."), "clean uninstall did not remove the six owned agents")
  for (const id of AGENT_IDS) assert(!existsSync(join(home, ".codex", "agents", `${id}.toml`)), `clean uninstall retained owned agent ${id}`)
  assert(!existsSync(join(home, ".wunderkind", "codex", "install-state.json")), "clean uninstall retained owned install state")
  assertNoWunderkindRegistration(env, project, "clean uninstall")
}

function main() {
  const originalHome = homedir()
  const root = mkdtempSync(join(tmpdir(), "wunderkind-codex-packed-smoke-"))
  let cleanupComplete = false
  try {
    const packed = packAndExtract(root)
    validateHappyLifecycle(root, packed)
    validateCleanUninstall(root, packed)
    validatePayloadTamper(root, packed)
    console.log("packed-codex-smoke: build-pack-extract=ok")
    console.log("packed-codex-smoke: install=ok doctor=ok discovery=on-disk-and-plugin-list (agent task skipped: isolated home has no credentials)")
    console.log("packed-codex-smoke: init=ok cleanup-preservation=ok upgrade=ok modified-agent-preservation=ok uninstall-recovery=ok clean-uninstall=ok")
    console.log("packed-codex-smoke: payload-tamper-preflight=ok")
  } finally {
    rmSync(root, { recursive: true, force: true })
    cleanupComplete = !existsSync(root)
    console.log(`packed-codex-smoke: temp-cleanup=${cleanupComplete ? "ok" : "failed"}`)
  }
  assert(cleanupComplete, "packed smoke temporary root survived cleanup")
  assert(homedir() === originalHome, "packed smoke changed the process home directory")
}

try {
  main()
} catch (error) {
  console.error(`packed-codex-smoke: failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
