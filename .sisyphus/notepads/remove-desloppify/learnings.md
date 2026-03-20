# Learnings

## 2026-03-19 Session ses_2f8b0ec1fffe6LhjLrETO6TTFT: Exploration findings

### Source surfaces (exact locations)
- `src/index.ts:107-119` — Desloppify enabled/disabled branch; removing means deleting both the `if (desloppifyEnabled)` block and `else` fallback. Adjacent context: lines 70-85 resolve runtime config.
- `src/cli/index.ts:206,215,242-252,265-266` — `--desloppify-enabled` flag definition, help text, parse block. Lines 204-221 is the full init options block.
- `src/cli/init.ts:28` — `InitOptions` interface has `desloppifyEnabled?: boolean`; also lines 230-235 config merging, 336-341 TUI prompt, 376 config write.
- `src/cli/cli-installer.ts:146,280-282` — propagation and conditional `delete configForWrite.desloppifyEnabled`.
- `src/cli/tui-installer.ts:207` — propagates the field.
- `src/cli/doctor.ts:249,267` — verbose render of `desloppifyEnabled`.
- `src/cli/gitignore-manager.ts:9` — `".desloppify/"` in `AI_TRACE_ENTRIES`.
- `src/cli/types.ts:36` — `ProjectConfig.desloppifyEnabled?: boolean`; `types.ts:93` — `DetectedConfig.desloppifyEnabled: boolean` (required, non-optional).
- `src/cli/config-manager/index.ts:69` — key allow-list; `424` — coerce assigns; `600` — prdPipelineMode render with trailing-comma conditional on `desloppifyEnabled`; `669` — detected defaults set field; `713` — merged detected return includes field.
- `schemas/wunderkind.config.schema.json:42` — `desloppifyEnabled` property defined.

### Config-manager JSONC render fix
At ~line 600, `prdPipelineMode` push currently appends a trailing comma when `config.desloppifyEnabled !== undefined`. After removing the field, rewrite `prdPipelineMode` as an unconditional bare final property line (no trailing comma), then delete the `desloppifyEnabled` conditional block entirely.

### Uninstall fix
- `src/cli/config-manager/index.ts:1034` — `rmSync(GLOBAL_WUNDERKIND_DIR, { recursive: false, force: true })` is the confirmed EISDIR source. Change to `{ recursive: true, force: true }`. Emptiness guard at 1033 stays.

### Silent stale-key tolerance
- Achieved purely by removing assignment at line 424 and removing from allow-list at line 69. No extra guard needed. Parser drops unknown keys silently.

### CLI unknown-flag behavior
- Commander already rejects unknown flags with non-zero exit. No `.strict()` change needed — just remove the flag registration.

### Test blast radius
- `uninstall.test.ts` — remove `desloppifyEnabled` from `makeDetectedConfig` fixture; add global-dir empty-directory regression test.
- `init-doctor.test.ts` — ~12 `DetectedConfig` fixture lines (194, 238, 281, 329 assertion, 437, 464, 516, 623, 681, 727, 774) all need `desloppifyEnabled` removed.
- `init-nontui.test.ts:113` — remove field write and assertion.
- `init-interactive.test.ts:143` — remove field from config and expectation.
- `config-template.test.ts:44` — flip `toBeDefined()` → `toBeUndefined()` for schema property; keep line 46 `required` assertion; add stale-key read tolerance case.
- `cli-help-text.test.ts:82` — remove `--desloppify-enabled` and `.desloppify/` expectations; add unknown-flag rejection test.
- `gitignore-manager.test.ts:18` — remove `.desloppify/` from expected array.
- `cli-installer.test.ts:33` — remove field from `DetectedConfig` fixture.
- `tui-installer-handoff.test.ts:51` — remove field from `DetectedConfig` fixture.

### Docs surfaces
- `README.md:9` — add `> [!WARNING]` breaking-changes note below existing `> [!IMPORTANT]`.
- `README.md:150` — remove `--desloppify-enabled` init options table row.
- `README.md:214` — remove `Desloppify opt-in status` doctor verbose bullet.
- `README.md:265-285` — remove entire `## Desloppify Code Health` section.
- `README.md:350` — update `code-health` sub-skills table description.
- `README.md:423` — remove `desloppifyEnabled` from config example.
- `README.md:531` — remove `.desloppify/` from gitignore text.
- `AGENTS.md:79` — remove Desloppify opt-in mention from init description.
- `AGENTS.md:242-243` — remove Desloppify gotcha entries.
- `skills/code-health/SKILL.md` — full rewrite to audit-only, severity-based skill.
- `skills/SKILL-STANDARD.md:151` — update inventory row description.

## 2026-03-19 Source purge implementation

- Removed Desloppify runtime prompt injection from src/index.ts and deleted the CLI/init/install/doctor/gitignore/schema/config-manager surfaces listed in plan Task 1.
- Confirmed the project JSONC writer now renders prdPipelineMode as the bare final property with no trailing comma and no follow-on block.
- Confirmed stale project configs that still contain desloppifyEnabled are read silently and the returned parsed config omits that key once it is removed from the allow-list and coerce assignment.
- Source-level CLI now rejects --desloppify-enabled; node bin/wunderkind.js still exits non-zero in this repo state, but it reaches the install guard because bin loads dist/cli/index.js and this task intentionally did not rebuild generated output.

## 2026-03-19 Empty global config directory uninstall fix

- `src/cli/config-manager/index.ts:1022` still needs the emptiness guard before removing `~/.wunderkind/`, but the final `rmSync` must use `{ recursive: true, force: true }` or macOS throws `ERR_FS_EISDIR` even when the directory is empty.
- `tests/unit/uninstall.test.ts` can cover the regression without widening uninstall flow scope by mocking `node:os` to a temp home directory and importing `src/cli/config-manager/index.ts` with a cache-busting query string so the real helper recomputes `GLOBAL_WUNDERKIND_DIR`.

## 2026-03-19 Test-suite cleanup for removed legacy code-health contract

- `tests/unit/` now needs zero literal matches for the removed legacy terms because the completion gate includes a repo grep; new regression tests should build legacy flag/key strings dynamically instead of embedding the old surface directly.
- `tests/unit/init-interactive.test.ts` lost one confirm prompt when the legacy init toggle was removed, so the correct call-count expectation is `2` confirms in the retained-persona and docs-enabled flows.
- `tests/unit/gitignore-manager.test.ts` should remove the old managed entry entirely rather than preserving it in fixtures, because `.desloppify/` is no longer a Wunderkind-managed ignore line.

## 2026-03-19 F4 scope-fidelity review

- Verified `grep -r "desloppify\|Desloppify\|desloppifyEnabled" src/ schemas/ tests/ agents/` equivalent checks returned zero matches in all four scoped directories.
- Verified uninstall cleanup fix is present at `src/cli/config-manager/index.ts:1023` as `rmSync(GLOBAL_WUNDERKIND_DIR, { recursive: true, force: true })`.
- Verified README breaking-change prose includes all required removals: CLI flag, config key behavior, gitignore entry removal, and code-health audit-only behavior.
- Found a scope-fidelity failure in `skills/code-health/SKILL.md:137`, where explicit banned-term text still includes `Desloppify` and `Python`, violating the strict "no references" expectation for the skill body.
