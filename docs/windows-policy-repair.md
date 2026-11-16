# Native Windows policy repair investigation

Status: fix targets 0.28.11 with portable/disposable validation; the operator will perform native Windows acceptance on the remote machine after release. Versions 0.28.9 and 0.28.10 do not contain this fix. The development host is macOS; PowerShell on macOS is not a substitute.

## Root causes and changes

The reported source manifest error is confirmed. Both live manifest readers compared an entry with `${codexHome}/agents/`; native Windows `join` emits backslashes. `C:\Users\GrantVine\.codex\agents\default.toml` fails that prefix comparison. The staged manifest reader repeated it. The isolated runner also checked its command working directory against a slash-built cache prefix and imported an absolute filesystem path as an ESM specifier, which is invalid for a Windows drive path and misinterprets URL control characters on POSIX.

`policy-manifest.ts` now parses live source, cache and staged manifests through one boundary. It chooses Windows drive-path semantics for a drive-absolute home, otherwise POSIX, normalizes separators and uses `relative` containment. Only direct known upstream role filenames and `default.toml` are accepted. It rejects raw traversal before normalization, nested/sibling/other-drive paths, drive-relative/root-relative Windows paths, UNC/device namespaces, streams, trailing dots/spaces, control characters, unknown names and duplicates. UNC/network Codex homes remain held; this fix targets the local drive home in the report. Filesystem link/junction rejection, exact executable/role hashes, provenance checks, source snapshots, receipt ownership and concurrent-edit/rollback checks remain in their existing owners. Manifest parsing alone is not a filesystem trust decision.

The disposable runner uses native `join`/`relative` containment for its npm command allowlist and `pathToFileURL` for the reviewed installer's dynamic import. No wider command or dependency provisioning is allowed. A trusted package path containing `#` fails when the file-URL fix is removed and passes with it. The shared test fixture uses `fileURLToPath` so Windows drive paths are not prefixed with an erroneous slash.

New tests cover Windows path acceptance and rejection, both live manifest locations, retained root/profile/Astra and durable overrides, custom-agent preservation, default hash receipts, receipt failure rollback, concurrent manifest edits and linked parent rejection. Existing policy tamper/override tests continue covering altered executables, added roles and unowned files. The native CLI smoke drives `codex doctor --apply-model-policy --json` through the built CLI in a credential-free temporary home with real trusted installer execution and fixture host metadata. It never calls Codex inference or changes the real installation. Fixture metadata does not verify a real Codex plugin host.

## Disposable Windows gate

In a disposable checkout of the reviewed source on native Windows, with Node and Bun available:

```powershell
powershell -NoProfile -File .\scripts\test-windows-codex-policy.ps1
```

The script refuses non-Windows hosts, downloads only the exact 5.1.70 npm source archive, verifies its SHA-512 SRI, extracts under a new temporary directory, installs frozen dependencies with scripts disabled, builds/typechecks, runs the focused regression suite, and exercises the built CLI policy action against that exact trusted graph. The policy implementation verifies its executable hashes again. All test homes and host registrations are fixtures; root/profile settings are deliberately user-owned, with explicit Astra opt-in. Environment changes are restored and disposable files removed in `finally`. No model weights, user credentials, live plugin cache changes or inference are involved. Keep the console transcript as Windows evidence; do not call this gate passed until it has run there.

## LazyCodex launcher ownership

Pinned upstream [codex-process.ts at 5.1.70](https://github.com/code-yeongyu/oh-my-openagent/blob/v5.1.70/packages/omo-codex/src/install/codex-process.ts) lists `codex`, `npm`, and `npx` as unconditional Windows `.cmd` shims. Therefore doctor builds `codex exec ...` but the process adapter executes `cmd.exe /d /s /c codex.cmd ...`. A desktop-provided `codex.exe` is not selected. This is LazyCodex-owned, not a Wunderkind cache defect. The code remains unchanged at reviewed dev commit [f9f610d53affa20e218a25e205980219583f99cf](https://github.com/code-yeongyu/oh-my-openagent/blob/f9f610d53affa20e218a25e205980219583f99cf/packages/omo-codex/src/install/codex-process.ts). The previous [issue 138](https://github.com/code-yeongyu/lazycodex/issues/138) concerned npm-only shims; fixing that case by unconditionally selecting `.cmd` introduced the opposite assumption for desktop installs.

Proposed upstream fix: resolve Codex against the supplied environment's PATH/PATHEXT, distinguish native `.exe` from `.cmd`, and invoke a discovered executable directly without a shell. Use the existing Windows command adapter only for an actual batch shim, with tested argument quoting. Do not concatenate a doctor prompt into a shell command. Add Windows tests for exe-only, cmd-only, both with defined precedence, missing executable, paths containing spaces and shell metacharacters, and preservation of argv/env. Keep npm/npx behavior covered separately. No issue/PR was filed and no upstream cache was patched in this task.

There is no verified inference-free `lazycodex-ai doctor` mode in this version: `--json`, `--status`, and `--verbose` still dispatch the same Codex workflow. Its command includes `--sandbox danger-full-access` and requests a model run. Do not run it under this task's authorization. A supported diagnostic alternative is to invoke the installed `$omo:lcx-doctor` skill inside an existing Codex session with explicit instructions to inspect only files, CLI metadata and wiring, skip `codex exec`/inference, preserve sandbox settings and report the runtime probe as NOT RUN. This is a partial static doctor, not a full runtime pass.

Non-inference PowerShell probes:

```powershell
Get-Command codex -All
Get-Command codex.exe -ErrorAction Stop
& (Get-Command codex.exe -ErrorAction Stop).Source --version
codex plugin list --marketplace sisyphuslabs --json
codex plugin list --marketplace grant-vine --json
wunderkind codex doctor --json
```

These commands establish executable resolution and configured installation state, not successful hook execution, MCP connectivity or model routing. Do not install a second npm Codex distribution or create `codex.cmd` merely to mask the launcher error.

## Installer hooks, MCP and telemetry

The pinned installer calls `ensureHookTrusted` for its computed hook states and writes `trusted_hash` entries. It enables the plugin Context7 server and enables Git Bash MCP on Windows when its Git Bash discovery succeeds. Those are upstream installer defaults. An enabled registration or prewritten trust hash does not prove a person reviewed it or that the hook/server executed. Do not delete trust entries or reconfigure MCP during diagnosis; inspect source/targets and use Codex's hook review UI.

The installer defaults to anonymous PostHog usage telemetry unless opted out. Its disclosure says it excludes prompts, code, file paths and account data; this statement is the upstream disclosure, not a network audit. Install completion calls `trackActive("install_completed")` and awaits shutdown, which explains why a telemetry network timeout can appear after installation work. Telemetry failure is caught; it does not establish that installation failed or that a timed-out request was never received.

For a PowerShell session, set these before any upstream install/diagnostic command; children inherit them:

```powershell
$env:DO_NOT_TRACK = '1'
$env:OMO_DISABLE_TELEMETRY = '1'
```

Either is a supported opt-out in the pinned telemetry implementation. `OMO_DISABLE_POSTHOG=1` and `OMO_CODEX_DISABLE_POSTHOG=1` are also recognized. To persist opt-out for future sessions, explicitly set the desired user environment variable through Windows settings or `[Environment]::SetEnvironmentVariable('DO_NOT_TRACK','1','User')`; this is an operator choice, not something the fix changes. Restart the desktop app after changing persistent environment variables so its child processes inherit them.

After plugin installation/upgrade, restart the desktop application and start a new task to load the refreshed payload. Inspect `/hooks` if available in the installed client: new or changed hooks require review/trust against current bytes. Existing installer-written hashes may already mark entries trusted; that is configured state, not proof of execution or operator review. [Official hook trust guidance](https://learn.chatgpt.com/docs/hooks) says changed hooks are skipped until trusted; [plugin packaging guidance](https://developers.openai.com/plugins/build/plugins) calls for restarting the app after local plugin changes. Read-only doctor and metadata commands themselves do not require a restart.

## Safe existing-install recovery

Do not edit `.installed-agents.json` to replace slashes, delete ownership receipts, reset model policy, reinstall over edited assets, or copy patched files into a plugin cache. Use 0.28.11 or later containing this fix after verifying publication; upgrading from 0.28.9 to 0.28.10 alone does not fix it.

First pass the disposable native Windows gate. Then use a reviewed fixed package/check-out and its matching trusted LazyCodex version. For an existing 5.1.70 installation, a release/backport must carry the reviewed 5.1.70 dependency graph, or LazyCodex must separately be upgraded through its owner to the fixed package's reviewed version. The current source dependency is 5.1.72, so do not mistake its local trust for verification of a live 5.1.70 runtime. A version/trust mismatch is a hold, never a reason to bypass checks. Owner upgrades may change hooks/MCP and require renewed review; preserve existing permission choices (`--no-codex-autonomous` if using an installer that exposes it).

Before any live repair, privately back up the effective Codex `config.toml`, `.omo/omo.jsonc`, agents, source/cache manifests and Wunderkind ownership state, retaining exact bytes/hashes outside the repository. Keep credentials in place; do not include auth files or raw configuration in shared logs. Preserve edited destinations; the lifecycle should hold them rather than overwrite them.

After those prerequisites, choose the published fixed package or a validated fixed checkout. `$FixedRoot` below names the checkout, not the old npm version.

For the published 0.28.11 package (after verifying that npm serves it), the upgrade sequence is below. Back up first as described above. LazyCodex must match the reviewed 5.1.72 graph before live policy repair. Upgrade it separately through the existing installation's owner: a marketplace-managed install uses `codex plugin marketplace upgrade sisyphuslabs`; a known npx-managed install can use `npx --yes lazycodex-ai@5.1.72 install --no-tui --no-codex-autonomous`. Do not switch ownership methods or reinstall over customized assets. An owner upgrade can refresh hook/MCP wiring; it is not a read-only doctor, and a newer-than-reviewed payload must remain held. `--no-codex-autonomous` preserves existing permission choices when using that installer; compare other operator settings with the private backup before proceeding. This is a target-machine handoff, not a claim it has run on Windows:

```powershell
$env:DO_NOT_TRACK = '1'
$env:OMO_DISABLE_TELEMETRY = '1'
codex plugin list --marketplace sisyphuslabs --json
# If this still reports 5.1.70, perform the matching owner upgrade described above first.
npx --yes @grant-vine/wunderkind@0.28.11 codex upgrade
if ($LASTEXITCODE -ne 0) { throw 'Owned-asset upgrade held; preserve the conflicting files' }
$json = npx --yes @grant-vine/wunderkind@0.28.11 codex doctor --json
if ($LASTEXITCODE -ne 0) { throw 'Core installation is not ready' }
$report = $json | ConvertFrom-Json
if ($report.core.policyRepairTrust.status -ne 'verified') { throw 'Exact policy artifact trust is held' }
npx --yes @grant-vine/wunderkind@0.28.11 codex doctor --apply-model-policy --json
if ($LASTEXITCODE -ne 0) { throw 'Repair held or rolled back; inspect the reported conflict' }
npx --yes @grant-vine/wunderkind@0.28.11 codex doctor --json
```

For a reviewed source checkout rather than npm, use this equivalent sequence after aligning the upstream version:

```powershell
$env:DO_NOT_TRACK = '1'
$env:OMO_DISABLE_TELEMETRY = '1'
$cli = Join-Path $FixedRoot 'bin\wunderkind.js'
& node $cli codex upgrade
if ($LASTEXITCODE -ne 0) { throw 'Owned-asset upgrade held; inspect the conflict without deleting receipts' }
$json = & node $cli codex doctor --json
if ($LASTEXITCODE -ne 0) { throw 'Core installation is not ready; inspect doctor before applying policy' }
$report = $json | ConvertFrom-Json
if ($report.core.policyRepairTrust.status -ne 'verified') { throw 'Exact upstream policy trust is held' }
& node $cli codex doctor --apply-model-policy --json
if ($LASTEXITCODE -ne 0) { throw 'Repair held or rolled back; inspect the named conflict/recovery journal' }
& node $cli codex doctor --json
```

Do not add `--reset-model-policy`: removed managed keys and user-owned root/profile/role settings must remain operator choices. Review remaining advisory assignments, compare private backup hashes for unrelated settings/custom assets, then restart and inspect fresh-task discovery. Do not report model serving or full doctor runtime success without a separately authorized inference probe.
