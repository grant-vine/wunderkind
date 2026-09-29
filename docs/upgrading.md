# Host upgrade and rollout runbook

This runbook records the reviewed compatibility candidate as of 2026-09-29. The published baseline remains Wunderkind `0.28.2` from immutable source commit `ded480c5b4b73179361f1c6b603b6754cfc6fe55`. Candidate targets are Wunderkind `0.28.3` (only if the npm version is still unused at release time), OpenCode `1.18.33`, `@opencode-ai/plugin` and `@opencode-ai/sdk` `1.18.33`, OMO `5.1.1`, LazyCodex payload `5.1.1`, and `@types/node` `^26.6.3`. These are candidate targets, not a published release claim. Re-inventory registry versions and installed hosts immediately before rollout.

Wunderkind's CLI supports Node `22.12+` or Bun `1+`; the OpenCode plugin runtime and memory operations require Bun because the plugin imports `bun:sqlite`. The optional OMO Native experiment has a separate Node `24+` requirement. Native is an isolated optional experiment, not an automatic host migration or Wunderkind dependency.

## Resolve which Codex is running

Codex desktop and the standalone CLI are distinct installations. The planning snapshot found the ChatGPT desktop bundle at `0.155.0-alpha.9.2`, while `0.158.0` is an optional standalone CLI candidate. Installing `@openai/codex` with npm changes a standalone executable only; it does not replace or update the app bundle. Update desktop through its supported app distribution and record the bundle's actual version. For the standalone candidate, resolve and record the absolute executable (`command -v codex`, real path, and `codex --version`) before invoking it; PATH precedence can select either binary.

For the Codex plugin, record all three identities: marketplace registration, active plugin cache directory, and payload version/hash. `codex plugin list --json` and `codex plugin marketplace list --json` are the planned inventory commands; inspect the installed CLI help first and use its supported equivalent if the syntax differs. A new npm package or marketplace registration does not prove that the active cache contains the expected payload. Do not edit downloaded cache files or broadly delete caches. Correct a stale registration through the supported Codex plugin operation, then re-resolve the active cache and hash.

OpenCode has a separate server and TUI resolution path. Check both against the exact OMO plugin spec and package versions. Updating `oh-my-openagent` in a repository does not prove that either OpenCode process resolves that copy. Keep OMO beta.86 as the known-good rollback baseline and do not infer compatibility from the identical 1.18.32/1.18.33 plugin hook interface alone.

## Preserve model intent before host migration

The managed routing target is Codex root Sol; Sol for orchestration, planning, high-complexity work and review; Luna for routine/default/background work. The OpenCode category mapping remains `openai/gpt-6-sol` for high-capability work and `openai/gpt-6-luna` for routine/background work. Astra is not a managed default. If an operator intentionally uses Astra, retain and report that user-owned override; never invoke it as part of a rollout smoke test.

OMO/LazyCodex 5.1.1 reads role overrides from the literal JSONC key `"[codex]"` in `~/.omo/omo.jsonc` and the active profile. The entries use unprefixed `model` and `reasoning` fields. This is separate from Codex's root model and selected profile in `config.toml`; do not put the role map in a TOML table or mistake a profile's model line for a role override. Example schema:

```jsonc
{
  "[codex]": {
    "agents": {
      "lazycodex-worker-medium": { "model": "gpt-6-luna", "reasoning": "medium" },
      "lazycodex-worker-high": { "model": "gpt-6-sol", "reasoning": "high" },
      "metis": { "model": "gpt-6-sol", "reasoning": "high" },
      "momus": { "model": "gpt-6-sol", "reasoning": "high" }
    }
  }
}
```

The example is illustrative, not a complete policy file: use the reviewed full role matrix at execution. 5.1.1 still bundles Astra defaults for its roles, so the durable override must be established before the first upstream migration. The default role is derived from the synchronized medium worker and its receipt; repair it through the supported medium-worker path, never by hand-editing `default.toml` or synthesizing `.lazycodex-default.sha256`. Root and active-profile overrides must be backed up and checked independently.

The source candidate exposes `wunderkind codex doctor --apply-model-policy` to seed absent reviewed durable keys and repair trusted managed roles while preserving operator overrides. Add `--reset-model-policy` only with `--apply-model-policy` to reclaim removed keys previously recorded as Wunderkind-managed; reset alone errors. Reset reclaims those removed managed keys only and does not overwrite existing or edited operator keys. The versioned ownership receipt lives at `~/.wunderkind/codex/model-policy.json`. Treat existing keys without a matching receipt as ambiguous/user-owned. An operator edit to a seeded value becomes user-owned. Role synchronization receipts are not proof of operator intent. Current `node bin/wunderkind.js codex doctor --help` output matches this grammar. Recheck help from the final release artifact before rollout; this snapshot does not establish global installation or full installation health.

## Stage and execute a future rollout

These steps are for a separately authorized rollout after the release candidate, policy implementation, and final verification gates pass. They are not commands to run as part of documentation work.

1. Inventory clean/dirty repository state, release ancestry, local executables and versions, registry availability, server/TUI OpenCode pins, Codex marketplace/cache/payload identities, and active profiles. Confirm the candidate's source includes the published `ded480c` lineage. Stop if the proposed npm version is already occupied.
2. Make a dated private backup outside the package source. Inventory exact files and record bytes, modes, existence and SHA-256 for Codex root/profile configuration, OMO JSONC layers, every upstream bundled role TOML including any retired role scheduled for purge, `default.toml`, `.lazycodex-default.sha256`, `.lazycodex-agent-models.json`, registration/manifest files, Wunderkind policy receipt/state, marketplace/plugin registrations, and active cache identity. Keep secrets private; save only redacted evidence. Do not write over an existing backup.
3. In a temporary consumer home, exercise model seeding, staged installer and shared-skills provisioning, upstream synchronization, two repeated upgrades and a cold restart. Verify root/profile values, every managed role, the Luna-derived default, intentional custom/Astra overrides, active cache path/version/hash, and unrelated role instructions. Stop on ambiguous ownership, missing receipts, modified role content, or partial-write failure; preserve files for review. A passing staged fixture does not establish global installation or full installation health.
4. After authorized publication, verify registry metadata and tarball integrity against the tagged source. Install the exact published Wunderkind version using the documented package manager, run global `wunderkind upgrade --scope=global`, and run project upgrades only in initialized targets. Run `wunderkind doctor --verbose`; for Codex, run `wunderkind codex upgrade` and `wunderkind codex doctor --json`. Use only the model-policy action and arguments present in the final release's actual `--help` output. A successful exit alone is not evidence of resolved runtime versions.
5. Restart OpenCode server and TUI plus the relevant Codex desktop/CLI host. Start a new Codex task so it loads refreshed agents and skills. Repeat version, marketplace, active cache, effective model and ownership checks after restart and after a second upgrade. Do not use paid model calls for this check; the local Ethara smoke uses startup/help/doctor and deterministic fake-provider paths only.
6. For the authorized Ethara smoke, capture `git status --porcelain=v1 --untracked-files=all` and hashes of tracked and untracked files first. Read instructions and config without logging credentials. Preserve CodeGraph MCP, auth and project instructions. Run help/version, OpenCode startup, Wunderkind doctor and Codex doctor using supported help-derived commands. Do not trigger a model prompt or rebuild the graph. Stop only processes started by the smoke, then compare status and hashes byte-for-byte.

Record each command, exit status, resolved executable or payload hash, and concrete assertion in `.omo/evidence/upstream-upgrade-2026-09-29/task-7-rollout.md`. Record unresolved, dirty or ambiguous state explicitly; never report success based on a registry version alone.

## Scoped rollback

Known-good snapshot versions are Wunderkind `0.28.2` / `ded480c`, OpenCode `1.18.32`, OpenCode OMO `5.0.0-beta.86`, Codex LazyCodex payload `5.0.1`, and desktop bundle `0.155.0-alpha.9.2`. Before rollout, confirm those exact artifacts remain available and retain the backup described above.

If startup, cache resolution, model selection, or data behavior regresses, stop only hosts/workers started during the rollout. Restore only files still matching this operation's recorded outputs; if a concurrent edit occurred, stop and create a recovery note rather than overwriting it. Revert plugin pins/registrations using supported host operations and reinstall the known-good package versions. Restore deliberate user overrides and restart, then repeat the resolution/doctor checks. Do not clear global caches, run cleanup/uninstall, or delete `.wunderkind` data as a rollback shortcut.

If a memory worker is running, stop it before making a database backup. Use a SQLite-consistent backup/export that accounts for WAL state; never copy only a live database file. No schema migration is part of this compatibility patch, so an unexpected migration is a stop condition. Preserve tombstones and restore the project snapshot only if required. Roll back desktop only through supported app distribution when the prior signed build is available; otherwise keep the current desktop and revert the separate plugin/CLI changes. A defective published package is superseded by a new patch; never rewrite its tag or history. Recheck Ethara's file inventory after rollback.

## Offline packaging smoke limits

`bun tests/unit/helpers/run-codex-packed-smoke.mjs` checks the packed helper against its offline beta.62 fixture. It proves packaging and discovery for that fixture only; it does not certify a live LazyCodex 5.1.1 install, active marketplace cache, desktop bundle, or effective model selection.
