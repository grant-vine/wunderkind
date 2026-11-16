import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url))
const upstreamRoot = resolve(process.argv[2] ?? join(projectRoot, "node_modules/oh-my-openagent"))
const temporary = mkdtempSync(join(realpathSync(tmpdir()), "wunderkind-native-policy-"))
const runner = join(temporary, "runner.mjs")
try {
  writeFileSync(runner, `
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = ${JSON.stringify(projectRoot)};
const home = ${JSON.stringify(temporary)};
const load = (name) => import(new URL(name, ${JSON.stringify(pathToFileURL(join(projectRoot, "dist/cli/codex/")).href + "/")}).href);
const { __setCodexPathOverrideForTests, resolveCodexPaths } = await load("paths.js");
__setCodexPathOverrideForTests({home, codexHome:join(home,".codex"), wunderkindHome:join(home,".wunderkind")});
const { __setPolicyUpstreamRootForTests, resolvePolicyUpstream } = await load("policy-upstream.js");
__setPolicyUpstreamRootForTests(${JSON.stringify(upstreamRoot)});
const upstream = resolvePolicyUpstream();
const version = JSON.parse((await import("node:fs")).readFileSync(join(root,"package.json"),"utf8")).version;
const { __setCodexProcessRunnerForTests } = await load("process.js");
let marketplace;
let installed = false;
__setCodexProcessRunnerForTests({run(args) {
  let result;
  if (args.length === 1 && args[0] === "--version") return {status:0,stdout:"codex-cli 0.167.0-alpha.4.1",stderr:""};
  if (args[0] !== "plugin") throw new Error("Forbidden host command");
  if (args[1] === "list") result = {installed:args.includes("sisyphuslabs") ? [{pluginId:"omo@sisyphuslabs",version:upstream.version,installed:true,enabled:true}] : installed ? [{pluginId:"wunderkind@grant-vine",version,installed:true,enabled:true}] : [],available:[]};
  else if (args[1] === "marketplace" && args[2] === "list") result = {marketplaces:marketplace ? [{name:"grant-vine",path:marketplace}] : []};
  else if (args[1] === "marketplace" && args[2] === "add") {marketplace=args[3];result={marketplaceName:"grant-vine",installedRoot:marketplace,alreadyAdded:false};}
  else if (args[1] === "add") {installed=true;result={pluginId:"wunderkind@grant-vine",name:"wunderkind",marketplaceName:"grant-vine",version,installedPath:join(home,"plugin")};}
  else throw new Error("Unexpected host command: "+args.join(" "));
  return {status:0,stdout:JSON.stringify(result),stderr:""};
}});
const { installCodexWunderkind } = await load("install.js");
installCodexWunderkind();
const paths = resolveCodexPaths();
mkdirSync(paths.agentsDir,{recursive:true});
for (const [id, source] of upstream.roles) cpSync(source,join(paths.agentsDir,id+".toml"));
writeFileSync(join(paths.codexHome,"config.toml"),'model = "operator-root"\\n[profiles.operator]\\nmodel = "gpt-6-astra"\\n');
mkdirSync(join(home,".omo"),{recursive:true});
writeFileSync(join(home,".omo/omo.jsonc"),'{"[codex]":{"agents":{"explorer":{"model":"gpt-6-astra","reasoning":"high"}}}}');
const manifest = join(paths.codexHome,".tmp/marketplaces/sisyphuslabs/plugins/omo/.installed-agents.json");
mkdirSync(join(manifest,".."),{recursive:true});
writeFileSync(manifest,JSON.stringify({agents:[...upstream.roles.keys()].map(id=>join(paths.agentsDir,id+".toml"))}));
process.argv=[process.execPath,join(root,"bin/wunderkind.js"),"codex","doctor","--apply-model-policy","--json"];
await import(${JSON.stringify(pathToFileURL(join(projectRoot, "dist/cli/index.js")).href)});
`, { flag: "wx" })
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: temporary, USERPROFILE: temporary, CODEX_HOME: join(temporary, ".codex"), TEMP: temporary, TMP: temporary, TMPDIR: temporary, DO_NOT_TRACK: "1", OMO_DISABLE_TELEMETRY: "1", OMO_DISABLE_POSTHOG: "1" }
  const result = spawnSync(process.execPath, [runner], { cwd: temporary, env, encoding: "utf8", timeout: 60_000, maxBuffer: 2_000_000 })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  const report = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1))
  assert.equal(report.core.healthy, true)
  assert.equal(report.core.policyRepairTrust.status, "verified")
  assert.deepEqual(report.modelPolicy.astraAssignments, ["profile:operator", "explorer"])
  const config = readFileSync(join(temporary, ".codex/config.toml"), "utf8")
  assert.ok(config.startsWith('model = "operator-root"\n[profiles.operator]\nmodel = "gpt-6-astra"\n'))
  const receipt = JSON.parse(readFileSync(join(temporary, ".wunderkind/codex/model-policy.json"), "utf8"))
  assert.equal(receipt.policyVersion, 1)
  console.log(JSON.stringify({ platform: process.platform, node: process.version, upstream: report.core.lazyCodex.version, cliPolicyAction: "pass", hostDiscovery: "metadata-fixture-only", inference: "none", temporaryHome: "removed-on-exit" }))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
