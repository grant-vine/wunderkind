# Host upgrade and rollback runbook

This runbook accompanies the `0.28.6` release candidate built from released `0.28.5` at `5727b5f7200f5fb6f58ae827fbebdf51774d8cd0`. It targets OpenCode plugin/SDK `1.19.4` and OMO/LazyCodex `5.1.44`, keeping the public runtime floor at Node `>=22.12.0` or Bun `1+`. Re-resolve versions and executable paths immediately before any consumer rollout.

<!-- wunderkind:upgrade-contract
{"candidate":"0.28.6","comparison":{"version":"0.28.5","commit":"5727b5f7200f5fb6f58ae827fbebdf51774d8cd0"},"sourceCommit":"5727b5f7200f5fb6f58ae827fbebdf51774d8cd0","openCode":{"plugin":"1.19.4","sdk":"1.19.4"},"omo":"5.1.44","codexPolicy":{"version":"5.1.44","trust":"verified-hash-bound-disposable-stage","sourceRoles":12,"stagedRoles":13},"runtime":{"node":">=22.12.0","bun":"1+"},"models":{"standard":"openai/gpt-6-sol","routine":"openai/gpt-6-luna","retainedSpecialists":"openai/gpt-6.1-sol","specialistReasoning":"high"},"astra":"opt-in","publicDeprecatedTotal":28,"rejectedRoutes":["supportability-incident"]}
-->

The managed model policy is Sol for orchestration, planning, high-complexity work and review, and Luna for routine/default/background work. OpenCode uses `openai/gpt-6-sol` and `openai/gpt-6-luna` for those tiers; six retained specialists explicitly use `openai/gpt-6.1-sol` with high reasoning. Astra is operator opt-in only: retain and report an existing user-owned override. Memory and team mode are also opt-in and are never enabled by install, upgrade, init, or doctor.

The separate `@typesafe-ai/sdk` 0.7.0 adapter upgrade remains on hold. Under Bun 1.4.3, its response buffering releases the original reader before body parsing and valid JSON responses can fail with `TypeError: Body already used`. Node fixture success does not resolve the supported Bun failure. The experimental adapter retains SDK 0.6.0; no public runtime or Node floor change follows from this hold.

Codex doctor reports LazyCodex version compatibility separately from exact policy repair trust. The explicit `wunderkind codex doctor --apply-model-policy` path is verified only for the reviewed, hash-bound 5.1.44 artifact graph and disposable stage. Unknown versions, changed bytes, extra roles, concurrent edits, and user-owned overrides remain held without mutation.

## Resolve the installed hosts

Record absolute executable paths and versions before mutation:

```sh
command -v codex; codex --version
command -v opencode; opencode --version
command -v bun; bun --version
command -v node; node --version
codex plugin list --json
```

The last command is an installed-state receipt, not proof of remote freshness. If it reports a failed remote request or no owner-supported catalog comparison exists, record catalog freshness as `unknown` and hold the update. A package listing or registry version alone never proves the active cache, payload, or host process resolved the candidate.

`omo-ai@5.1.29` is a separate native `omo` binary with a Node `>=24` engine declaration. It is not a Wunderkind dependency and must not be used to raise the public Node floor. The standalone System One adapter is experimental, not exported or memory-wired, disabled by default, and has no production or published benchmark claim. Its evaluation runner is only valid with the Task 14 Python Kev render/tokenizer preflight and a literal `--token-preflight` path.

## Private pre-mutation backup

Use a private backup outside the repository. The reviewed receipt used `~/.wunderkind/backups/stack-20261010`, mode `700`, with files and manifest mode `600`; do not copy its contents into project evidence or logs. Capture exact existence, bytes, modes, SHA-256, and executable identities for:

- `~/.codex/config.toml`, `~/.codex/agents/`, and relevant Codex state/receipts
- `~/.agents/.skill-lock.json` and `~/.agents/skills/`
- `~/.config/opencode/opencode.json` or `.jsonc`
- `~/.omo/omo.jsonc`
- marketplace/plugin registration and the active payload/cache identity

Create-only means an existing backup is never overwritten or recaptured. This disposable fixture exercises the restore path without reading or writing the real home directory:

```sh
set -eu
fixture_home=$(mktemp -d "${TMPDIR:-/tmp}/wunderkind-rollback.XXXXXX")
trap 'rm -rf "$fixture_home"' EXIT
export HOME="$fixture_home/home"
backup="$HOME/.wunderkind/backups/stack-20261010"
umask 077
mkdir -p "$HOME/.config/opencode" "$HOME/.wunderkind/owned" "$HOME/.wunderkind/backups"
printf '%s\n' '{"plugins":["wunderkind"]}' > "$HOME/.config/opencode/opencode.json"
printf '%s\n' 'owned-payload-v1' > "$HOME/.wunderkind/owned/agent.md"
chmod 600 "$HOME/.config/opencode/opencode.json"
chmod 640 "$HOME/.wunderkind/owned/agent.md"
mkdir "$backup"
chmod 700 "$backup"
cp -p "$HOME/.config/opencode/opencode.json" "$backup/opencode.json"
cp -p "$HOME/.wunderkind/owned/agent.md" "$backup/agent.md"
printf '%s\n' "$(shasum -a 256 "$HOME/.config/opencode/opencode.json")" > "$backup/manifest.sha256"
printf '%s\n' "$(shasum -a 256 "$HOME/.wunderkind/owned/agent.md")" >> "$backup/manifest.sha256"
chmod 600 "$backup/manifest.sha256"
printf '%s\n' '{"plugins":[]}' > "$HOME/.config/opencode/opencode.json"
printf '%s\n' 'edited-payload' > "$HOME/.wunderkind/owned/agent.md"
cp -p "$backup/opencode.json" "$HOME/.config/opencode/opencode.json"
cp -p "$backup/agent.md" "$HOME/.wunderkind/owned/agent.md"
cmp "$backup/opencode.json" "$HOME/.config/opencode/opencode.json"
cmp "$backup/agent.md" "$HOME/.wunderkind/owned/agent.md"
test "$(shasum -a 256 "$HOME/.config/opencode/opencode.json" | awk '{print $1}')" = "$(awk 'NR == 1 {print $1}' "$backup/manifest.sha256")"
test "$(shasum -a 256 "$HOME/.wunderkind/owned/agent.md" | awk '{print $1}')" = "$(awk 'NR == 2 {print $1}' "$backup/manifest.sha256")"
test "$(stat -f '%Lp' "$backup/opencode.json")" = "$(stat -f '%Lp' "$HOME/.config/opencode/opencode.json")"
test "$(stat -f '%Lp' "$backup/agent.md")" = "$(stat -f '%Lp' "$HOME/.wunderkind/owned/agent.md")"
if mkdir "$backup" 2>/dev/null; then
  printf '%s\n' 'collision was not rejected' >&2
  exit 1
fi
printf '%s\n' 'PASS temporary-home restore: hashes, modes, and collision rejection'
```

If `mkdir` reports that the path already exists, stop and compare the immutable manifest to the same untouched baseline. A collision, missing source, source mutation, or post-mutation retry is a hold; retain the original backup. Never reveal secrets in an evidence receipt.

## Upgrade ownership and freshness

Native agents, commands, and skills are refreshed only when a trusted receipt covers the exact package, asset kind, relative path, and unchanged live hash. A current marker alone is not authorization. The lifecycle preserves edited, linked, missing, malformed, mixed, held, and ownership-unknown content; it reports the hold and returns a recovery-oriented non-zero result where mutation cannot be trusted. Deprecated routes remain excluded from discovery and installation. The `design-an-interface` directory is retired only when exact receipt ownership and byte equality prove it is Wunderkind-owned; unreceipted or edited content survives.

Codex payload changes use the same ownership boundary. An operator edit becomes user-owned; an absent or invalid receipt is unverified. Optional companions are advisory and non-owned. Do not manually edit downloaded caches, delete broad cache roots, or overwrite a user's custom config.

## Staged rollout

For a separately authorized rollout, first capture `git status --porcelain=v1 --untracked-files=all`, source identity, installed versions, and all receipts. Then use supported owner operations for OpenCode, OMO, Codex, and companion tools. Re-run `doctor --verbose` and `wunderkind codex doctor --json` after each mutation, after restart, and after a repeated upgrade. A zero exit is not a complete success claim when the report contains `HOLD`, `unknown`, `mixed`, or unverified ownership.

The original pre-write evidence did not prove an owner-supported prior-payload rollback for the OpenCode Homebrew/tap binary, Codex app catalog, app-managed Codex channel, or Bun. That historical gap remains a gap: it must not be retroclaimed as pre-write proof or as full restoration. Subsequent exact-owner evidence did prove a narrower OpenCode operation: the retained `wunderkind/task19-incident-recovery` tap and `opencode@1.18.34` keg supported rollback to OpenCode `1.18.34`, followed by supported relink to `1.18.35`; those owner artifacts remain required for the proof.

The incident library state remains held separately. Preexisting `libngtcp2 1.25.0` is currently absent because restoring it would also upgrade unrelated `pkgconf`; restore is held pending an exact owner operation that does not cross that boundary. `libnghttp3` prior ownership/version is unknown and it is also absent. The app catalog's prior payload, channel, and Node fan-out remain unknown; Bun's original pre-incident bytes remain unknown, with only the official post-baseline observation available. Treat these as `HOLD`/`unknown`, not as restored state, and do not use private backups or catalog files to manufacture rollback proof.

## Scoped rollback

If startup, cache resolution, model selection, or data behavior regresses:

1. Stop only hosts/workers started by the rollout. Stop a memory worker before any SQLite backup and preserve WAL state; do not copy only a live database file.
2. Re-check the live target bytes against the operation receipt. Restore only files whose bytes still match the recorded rollout output. On a concurrent edit, stop, preserve the edit, and write a recovery note rather than overwriting it.
3. Restore configs and owned payloads from the private hash-bound backup, then compare SHA-256 and modes independently. Restore the known-good source/package through supported host operations; do not patch catalog caches or use cleanup/uninstall as rollback shortcuts.
4. Restart the relevant host and repeat version, active-path, ownership, model-policy, and doctor checks. Report catalog/binary/app rollback as `HOLD` unless the owner-supported prior-payload operation itself succeeds.

The old beta stream (`oh-my-openagent@5.0.0-beta.*`, including `5.0.0-beta.86`) is rollback history, not the current target. The original released package `0.27.9` remains the comparison artifact; package/plugin version `0.28.5` is published through the authorized tag-triggered GitHub Actions workflow.

## Evidence contract

For every rollout or rollback attempt, retain the exact command, working directory, executable path/version, exit code, receipt/hash, and binary assertion in the current `.omo/evidence/` task lane. Keep private backup contents outside that lane. Distinguish `PASS`, `HOLD`, `unknown`, and `not_applicable`; never turn an unavailable catalog proof or a stale success string into a success claim.
