# Persistent Documentation Output System

## TL;DR

> **Quick Summary**: Add a `docsPath`-based permanent documentation output system to wunderkind — agents write audit artefacts to a configurable `docs/` folder with a maintained index, backed by new TUI/CLI options and runtime system-prompt injection.
>
> **Deliverables**:
> - `docsEnabled`, `docsPath`, `docHistoryMode` config fields (types + config-manager + TUI + CLI)
> - Runtime config reading in `src/index.ts` + docs injection into system prompt
> - Shared `src/agents/docs-config.ts` canonical filename map + `buildDocsInstruction()`
> - Per-agent "Documentation Output" sections in all 12 `src/agents/*.ts` factories (after tool-restriction audit)
> - Installer pre-creates `docs/` + `docs/README.md` when `docsEnabled=true`
> - Config-path bug fix: `.wunderkind/wunderkind.config.jsonc` corrected in all 13 locations
> - `/docs-index` refresh command as prompt text in all doc-producing agents
> - Version bump to v0.6.0 in `package.json` + `.claude-plugin/plugin.json`
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 5 → Task 7 → Task 8 → Task 9 → Task 10

---

## Context

### Original Request
Add a new installer option asking where permanent documentation is stored (default `./docs`). All agents that produce audits or documentation write to that folder. `docs/README.md` acts as an index, pointed to by `AGENTS.md`. Research oh-my-opencode `init-deep` as reference pattern.

### Interview Summary
**Key Discussions**:
- `docs/` committed to repo (not gitignored) — permanent, user-facing artefacts
- 4-mode doc history selection at install: overwrite (default), append-dated, new-dated-file, overwrite+archive
- Both inline agent maintenance of `docs/README.md` AND a `/docs-index` slash command
- Auto-update project `AGENTS.md` (not root README) when first doc created
- System prompt injection via `src/index.ts` — runtime config read
- Pre-defined sub-folders per agent (ops=`runbooks/`, devrel=`guides/`, fullstack=`adr/`)
- `docsEnabled` opt-in — off by default, TUI asks
- Write-restricted agents: audit + ring-fence write access to agent's own docs sub-path
- `/docs-index` is slash-command text only — no CLI subcommand

**Research Findings**:
- oh-my-opencode `init-deep` is prompt-template driven — no shared writer library. Pattern: hierarchical non-redundant markdown, edit if exists / write if new, no README updating.
- All 12 agents already write to `.sisyphus/notepads/` — `docs/` is a distinct, permanent system.
- `src/index.ts` injects a static system prompt string; must be extended to read config at runtime.
- Critical bug: all 13 locations (`src/index.ts` + 12 agent factories) reference `wunderkind.config.jsonc` at project root, but file is actually at `.wunderkind/wunderkind.config.jsonc`.

### Metis Review
**Identified Gaps (addressed)**:
- Config-path bug must be fixed first (unblocks all subsequent config reads) → scoped as Commit 1
- `src/index.ts` needs async FS read inside the `experimental.chat.system.transform` handler → scoped in Task 7
- `docsEnabled` toggle needed — off by default, absent keys = false → added to all type shapes
- TUI insertion point is AFTER `dataAnalystRaw`, BEFORE `const config = {}` assembly (not "after org structure") → corrected in Task 5
- Write-restricted agents need ring-fenced write access audit → scoped as Task 6
- Extract shared `readWunderkindConfig()` for reuse in `src/index.ts` → scoped in Task 3
- `/docs-index` locked to slash-command text only — no CLI subcommand
- AGENTS.md auto-update scoped to project AGENTS.md only (not root README.md)
- TDD for docs-config and docs-injection tasks

---

## Work Objectives

### Core Objective
Give every wunderkind agent the ability to write permanent, well-structured documentation to a user-configured `docs/` folder, with a self-maintaining index, opt-in at install time.

### Concrete Deliverables
- `src/cli/types.ts` — `docsEnabled`, `docsPath`, `docHistoryMode` on all three config interfaces
- `src/cli/config-manager/index.ts` — read + write + shared `readWunderkindConfig()` for new fields
- `src/cli/index.ts` + `src/cli/cli-installer.ts` — `--docs-enabled`, `--docs-path`, `--doc-history-mode` flags
- `src/cli/tui-installer.ts` — 3 new prompts after personality section
- `src/agents/docs-config.ts` — canonical filename map + `buildDocsInstruction()`
- `src/index.ts` — runtime config read + docs section injection (idempotent)
- All 12 `src/agents/*.ts` — per-agent Documentation Output section (post tool-restriction audit)
- `src/cli/tui-installer.ts` + `src/cli/cli-installer.ts` — installer pre-creates `docs/` + `docs/README.md`
- `tests/unit/docs-config.test.ts`, `tests/unit/docs-injection.test.ts` — new test files
- Version bump `package.json` + `.claude-plugin/plugin.json` to v0.6.0
- `README.md` + `src/agents/AGENTS.md` updated (stale "8 agents" reference, docs feature docs)

### Definition of Done
- [ ] `tsc --noEmit` exits 0
- [ ] `bun test` exits 0, all tests green including new docs-config and docs-injection suites
- [ ] `bun run build` exits 0, all `agents/*.md` non-empty
- [ ] Non-interactive install with `--docs-enabled --docs-path=./docs --doc-history-mode=overwrite` writes correct JSONC
- [ ] Without docs flags, install writes `docsEnabled: false` default
- [ ] `node bin/wunderkind.js install --help` shows `--docs-enabled`, `--docs-path`, `--doc-history-mode`
- [ ] All 12 (or audited subset) agent `.ts` files contain a `Documentation Output` section referencing their canonical `docs/` filename

### Must Have
- Config-path bug fixed in all 13 locations before any other work
- `docsEnabled: false` default — absent key in old configs treated as false, no injection
- Shared `readWunderkindConfig()` function in config-manager, consumed by `src/index.ts`
- Idempotent system prompt injection (sentinel: `## Documentation Output` heading)
- Installer pre-creates `docs/` + `docs/README.md` when `docsEnabled: true`
- TDD for `docs-config.ts` and docs injection in `src/index.ts`
- `exactOptionalPropertyTypes` compliance: all new config fields required, not optional, defaults in `detectCurrentConfig()`
- Version bump to v0.6.0 in both `package.json` and `.claude-plugin/plugin.json`

### Must NOT Have (Guardrails)
- No new npm dependencies — no JSONC merge library (template-string write approach only)
- No `/docs-index` CLI subcommand — slash-command text in agent prompts only
- No root `README.md` auto-update by agents — project `AGENTS.md` only
- No gitignore changes — `docs/` is committed, gitignore-manager untouched
- No pre-creation of per-agent sub-folders by installer (`docs/runbooks/`, `docs/guides/`, `docs/adr/` created lazily by agents)
- No config migration code — absent keys default silently to `docsEnabled: false`
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- No auto-commits at any stage
- No editing `agents/*.md` directly — changes go in `src/agents/*.ts`, then `bun run build`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (bun test, `tests/unit/`)
- **Automated tests**: TDD for Tasks 6 and 7; tests-after for CLI tasks
- **Framework**: `bun test`
- **TDD tasks**: Write failing test → implement → confirm green

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **CLI/config**: `Bash` — `node bin/wunderkind.js ...`, `cat .wunderkind/wunderkind.config.jsonc`, `grep`
- **Type checking**: `Bash` — `tsc --noEmit`
- **Tests**: `Bash` — `bun test [specific file]`
- **Build**: `Bash` — `bun run build`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + bug fix):
├── Task 1: Fix config-path bug in src/index.ts + all 12 src/agents/*.ts [quick]
└── Task 2: Add docsEnabled/docsPath/docHistoryMode/configVersion to types.ts [quick]

Wave 2 (After Wave 1 — config + CLI layer; tui-installer.ts tasks must be sequential in order 5 → 11 → 12):
├── Task 3: config-manager — read/write new fields + extract readWunderkindConfig() + exports [unspecified-high]
├── Task 4: cli-installer + CLI flags (--docs-enabled, --docs-path, --doc-history-mode) [unspecified-high]
├── Task 5: tui-installer — 3 new docs prompts after personality section [unspecified-high]  ← tui-installer.ts change #1
├── Task 11: tui-installer — personality customisation gate [quick]  ← tui-installer.ts change #2 (AFTER Task 5)
└── Task 12: types + config-manager + tui-installer — configVersion + upgrade detection [unspecified-high]  ← tui-installer.ts Step 4 = change #3 (LAST)

Wave 3 (After Wave 2 — behavioural layer, TDD first):
├── Task 6: TDD docs-config.ts — canonical filename map + buildDocsInstruction() [unspecified-high]
├── Task 7: TDD docs injection in src/index.ts — runtime config read + idempotent inject [deep]
└── Task 13: wunderkind doctor / --verbose command [unspecified-high]  ← depends on Task 12 exports

Wave 4 (After Wave 3 — agent prompts + installer setup + final polish):
├── Task 8: Agent tool-restriction audit + per-agent Documentation Output sections [deep]
├── Task 9: Installer pre-creates docs/ + docs/README.md when docsEnabled=true [unspecified-high]
└── Task 10: Version bump, README + AGENTS.md docs updates [quick]

Wave FINAL (After ALL — independent parallel review):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review (tsc + bun test + anti-pattern scan) [unspecified-high]
└── Task F3: Full QA sweep — install, config, build, agent prompt assertions [deep]
```

### Dependency Matrix

| Task | Depends On | Blocks |
|---|---|---|
| 1 | — | 3, 4, 5, 6, 7, 8 |
| 2 | — | 3, 4, 5, 12 |
| 3 | 1, 2 | 4, 5, 7, 9, 12 |
| 4 | 2, 3 | 13, F1, F2, F3 |
| 5 | 2, 3 | 11, F1, F2, F3 |
| 6 | 1 | 8 |
| 7 | 3 | 8, 9 |
| 8 | 1, 6, 7 | F1, F2, F3 |
| 9 | 3, 7 | F1, F2, F3 |
| 10 | 8 | F1 |
| 11 | 1, 2, 5 | 12, F1, F2, F3 |
| 12 | 1, 2, 3, 5, 11 | 13, F1, F2, F3 |
| 13 | 4, 12 | F1, F2, F3 |
| F1–F3 | 1–13 | — |

> Note: Task 7 no longer depends on Task 6. Task 7 injects a global docs config section (docsPath + docHistoryMode) and only needs `readWunderkindConfig()` from Task 3. Task 6's `buildDocsInstruction()` is used only by Task 8 (static per-agent sections). The `experimental.chat.system.transform` hook has no `agent` field in its input type — confirmed at `node_modules/@opencode-ai/plugin/dist/index.d.ts:197-202`.

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1 → `quick`, T2 → `quick`
- **Wave 2**: 5 tasks (tui-installer tasks sequential) — T3 → `unspecified-high`, T4 → `unspecified-high`, T5 → `unspecified-high`, T11 → `quick`, T12 → `unspecified-high`
- **Wave 3**: 3 tasks — T6 → `unspecified-high`, T7 → `deep`, T13 → `unspecified-high`
- **Wave 4**: 3 tasks — T8 → `deep`, T9 → `unspecified-high`, T10 → `quick`
- **Final**: 3 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `deep`

---

## TODOs

- [ ] 1. Fix `wunderkind.config.jsonc` path bug in `src/index.ts` and all 12 agent factories

  **What to do**:
  - In `src/index.ts`, find every occurrence of `wunderkind.config.jsonc` and change it to `.wunderkind/wunderkind.config.jsonc`. Also update the global fallback path to `~/.wunderkind/wunderkind.config.jsonc`.
  - In each of the 12 `src/agents/*.ts` files, find every occurrence of `wunderkind.config.jsonc` and apply the same correction (`.wunderkind/wunderkind.config.jsonc` for project scope, `~/.wunderkind/wunderkind.config.jsonc` for global fallback).
  - After editing, run `tsc --noEmit` to confirm zero type errors.
  - Run `bun test` to confirm all existing tests still pass.

  **Must NOT do**:
  - Do not change any logic — only the string path references
  - Do not edit `agents/*.md` directly — those are generated
  - Do not commit yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure find-and-replace string fix across 13 files — no logic changes
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: not needed; this is a file-edit task, not git history work

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7, 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/index.ts` — find the string `wunderkind.config.jsonc` (bare, without directory prefix) — this is the bug
  - `src/agents/brand-builder.ts`, `src/agents/ciso.ts`, etc. — same search in all 12 agent factory files

  **Why Each Reference Matters**:
  - The bare `wunderkind.config.jsonc` reference tells agents to read from the project root, but the installer writes to `.wunderkind/wunderkind.config.jsonc`. This means agents currently fail silently to read their own config. Fixing this is prerequisite to all subsequent work.

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: No bare config path references remain in src/
    Tool: Bash
    Preconditions: Task complete
    Steps:
      1. Run: grep -rn "\"wunderkind.config.jsonc\"" src/ | grep -v "\.wunderkind/"
      2. Assert output is empty
    Expected Result: Zero matches — all references now include the .wunderkind/ prefix
    Failure Indicators: Any line printed means the bug persists in that file
    Evidence: .sisyphus/evidence/task-1-path-grep.txt

  Scenario: TypeScript still compiles cleanly
    Tool: Bash
    Preconditions: Task complete
    Steps:
      1. Run: tsc --noEmit
      2. Assert exit code 0
    Expected Result: exit 0, no errors
    Failure Indicators: Any type error output
    Evidence: .sisyphus/evidence/task-1-tsc.txt

  Scenario: Existing tests still pass
    Tool: Bash
    Preconditions: tsc clean
    Steps:
      1. Run: bun test
      2. Assert exit code 0
    Expected Result: All tests pass, no regressions
    Failure Indicators: Any failing test
    Evidence: .sisyphus/evidence/task-1-bun-test.txt
  ```

  **Commit**: YES (Commit 1)
  - Message: `fix(agents): correct wunderkind config path to .wunderkind/ in all 13 locations`
  - Files: `src/index.ts`, `src/agents/brand-builder.ts`, `src/agents/ciso.ts`, `src/agents/creative-director.ts`, `src/agents/data-analyst.ts`, `src/agents/devrel-wunderkind.ts`, `src/agents/fullstack-wunderkind.ts`, `src/agents/legal-counsel.ts`, `src/agents/marketing-wunderkind.ts`, `src/agents/operations-lead.ts`, `src/agents/product-wunderkind.ts`, `src/agents/qa-specialist.ts`, `src/agents/support-engineer.ts`
  - Pre-commit: `tsc --noEmit && bun test`

---

- [ ] 2. Add `docsEnabled`, `docsPath`, `docHistoryMode` to config type interfaces

  **What to do**:
  - Open `src/cli/types.ts`.
  - Add `docsEnabled: boolean` to `InstallConfig`.
  - Add `docsPath: string` to `InstallConfig`.
  - Add `docHistoryMode: DocHistoryMode` to `InstallConfig`.
  - Define `DocHistoryMode` as a union type: `"overwrite" | "append-dated" | "new-dated-file" | "overwrite-archive"`. Export it.
  - Apply the same additions to `DetectedConfig` (which extends/mirrors `InstallConfig`).
  - Add `docsEnabled?: boolean`, `docsPath?: string`, `docHistoryMode?: string` to `InstallArgs` (optional because CLI flags are optional).
  - Run `tsc --noEmit` — expect type errors in `config-manager/index.ts`, `tui-installer.ts`, `cli-installer.ts` (they don't set the new fields yet). This is expected and correct — Task 3 fixes config-manager, Tasks 4/5 fix the installers.

  **Must NOT do**:
  - Do not add `?` to `docsEnabled`, `docsPath`, `docHistoryMode` in `InstallConfig` or `DetectedConfig` — they must be required fields (`exactOptionalPropertyTypes`)
  - Do not set defaults here — defaults belong in `detectCurrentConfig()` (Task 3)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definition additions — no logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/cli/types.ts` — look at how `TeamCulture`, `OrgStructure` etc. are defined as union types. Follow the same pattern for `DocHistoryMode`.
  - `src/cli/types.ts:InstallConfig` — every existing field is a required string or union. Match this pattern for the new fields.
  - `src/cli/types.ts:InstallArgs` — existing fields are `?: string`. `docsEnabled` should be `?: boolean`, others `?: string`.

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: DocHistoryMode union exported correctly
    Tool: Bash
    Preconditions: Task complete
    Steps:
      1. Run: tsc --noEmit 2>&1 | grep "types.ts" | wc -l
      2. Assert output is "0" (no errors in types.ts itself)
    Expected Result: types.ts compiles clean
    Failure Indicators: Any type error in types.ts
    Evidence: .sisyphus/evidence/task-2-tsc-types.txt

  Scenario: InstallConfig has all 3 new required fields
    Tool: Bash
    Steps:
      1. Run: grep -n "docsEnabled\|docsPath\|docHistoryMode\|DocHistoryMode" src/cli/types.ts
      2. Assert all 4 identifiers appear in the output
    Expected Result: 4 grep matches minimum
    Evidence: .sisyphus/evidence/task-2-grep-types.txt
  ```

  **Commit**: NO — defer to Commit 3 (bundle with Task 3)
  - **Reason**: Adding required fields to `types.ts` (Task 2) immediately causes type errors in `src/cli/config-manager/index.ts`, `src/cli/cli-installer.ts`, and `src/cli/tui-installer.ts` — all files that construct `InstallConfig` objects — until those files are updated in Task 3. Committing `types.ts` alone with `tsc --noEmit` would always fail. Instead, the Task 2 executor should **leave the changes staged/unstaged**, and Task 3 will commit both files together once both compile cleanly.

---

- [ ] 3. config-manager: read/write new docs fields + extract `readWunderkindConfig()`

  **What to do**:
  - Open `src/cli/config-manager/index.ts`.
  - In `detectCurrentConfig()`, add defaults for new fields: `docsEnabled: false`, `docsPath: "./docs"`, `docHistoryMode: "overwrite"` (type: `DocHistoryMode`). If the wunderkind JSONC config exists and has these keys, read and return them; otherwise use the defaults.
  - In `writeWunderkindConfig(installConfig, scope)`, add the three new fields to the emitted JSONC template string. Include descriptive JSONC comments above each field explaining valid values (matching the existing comment style).
  - Extract a new exported function `readWunderkindConfig(): Partial<InstallConfig> | null`. This function finds `.wunderkind/wunderkind.config.jsonc` (project scope) or `~/.wunderkind/wunderkind.config.jsonc` (global), reads it with the existing JSONC parser, and returns a partial config object (or `null` if neither exists). This function will be consumed by `src/index.ts` at runtime.
  - Import `DocHistoryMode` from `src/cli/types.ts` where needed.
  - Run `tsc --noEmit` — the only remaining type errors should be in `tui-installer.ts` and `cli-installer.ts` (not yet providing the new fields to `writeWunderkindConfig`). Errors in `config-manager/index.ts` itself should be zero.
  - Run `bun test` — existing `cli-installer.test.ts` mocks `detectCurrentConfig` and `writeWunderkindConfig`. Update the mock return values to include the three new fields with their defaults. All tests must pass.

  **Must NOT do**:
  - Do not add any new npm dependency for JSONC parsing — use the existing JSONC parser already in use
  - Do not change the JSONC write approach — template-string full-rewrite (no merge/patch logic)
  - Do not make `readWunderkindConfig()` throw — it must return `null` gracefully if no config file exists

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Non-trivial: extracting a shared reader, updating read + write paths, updating test mocks
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must follow Tasks 1 and 2
  - **Parallel Group**: Wave 2 (with Tasks 4 and 5)
  - **Blocks**: Tasks 4, 5, 7, 9
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/cli/config-manager/index.ts:detectCurrentConfig()` — see how existing JSONC fields are read with defaults. Follow the exact same pattern for the 3 new fields.
  - `src/cli/config-manager/index.ts:writeWunderkindConfig()` — see the JSONC template string with `// comments`. Add new fields with the same comment style.
  - `src/cli/config-manager/index.ts` — find the existing JSONC parse logic (likely using `jsonc-parser` or similar). `readWunderkindConfig()` reuses the same parser.
  - `tests/unit/cli-installer.test.ts` — find `mockDetectCurrentConfig` (or similar) mock. Add the 3 new fields with defaults to the mock return value.

  **API/Type References**:
  - `src/cli/types.ts:DocHistoryMode` — the union type for the `docHistoryMode` field (defined in Task 2)
  - `src/cli/types.ts:InstallConfig` — the full interface (now includes 3 new required fields)

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: writeWunderkindConfig emits new fields
    Tool: Bash
    Preconditions: Task complete, Task 1 complete (correct path)
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR 2>/dev/null || true
         (Note: this will fail until Tasks 4/5 add the new flags — use a direct test instead)
      2. Run: bun test tests/unit/cli-installer.test.ts
      2. Assert exit code 0
    Expected Result: All cli-installer tests pass with updated mocks
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-3-cli-installer-tests.txt

  Scenario: readWunderkindConfig returns null when no config exists
    Tool: Bash
    Steps:
      1. Run: bun test tests/unit/cli-installer.test.ts
      2. Assert exit code 0 and no errors related to readWunderkindConfig
    Expected Result: Tests pass; null-return path exercised
    Evidence: .sisyphus/evidence/task-3-read-null.txt

  Scenario: tsc compiles config-manager with no errors
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit 2>&1 | grep "config-manager"
      2. Assert output is empty
    Expected Result: config-manager/index.ts has zero type errors
    Evidence: .sisyphus/evidence/task-3-tsc-config-manager.txt
  ```

  **Commit**: YES (Commit 2+3, bundled with Task 2)
  - Message: `feat(types,config-manager): add docs config fields and readWunderkindConfig()`
  - Files: `src/cli/types.ts` (from Task 2, staged but not yet committed), `src/cli/config-manager/index.ts`
  - Pre-commit: `tsc --noEmit && bun test`
  - Note: Task 2's `types.ts` changes must be staged first, then this commit includes both files together. Running `tsc --noEmit` after Task 2 alone (before Task 3) would fail — this is expected and acceptable; only commit once both files are ready.

---

- [ ] 4. Add `--docs-enabled`, `--docs-path`, `--doc-history-mode` CLI flags

  **What to do**:
  - Open `src/cli/index.ts`. Find the `install` subcommand definition. Add three new options using the existing Commander pattern:
    - `--docs-enabled` (boolean flag, no value, default false)
    - `--docs-path <path>` (string, optional, no default here — default comes from config-manager)
    - `--doc-history-mode <mode>` (string, optional)
  - Open `src/cli/cli-installer.ts`. Update `validateNonTuiArgs()` (or equivalent validation function) to:
    - If `--docs-path` is provided, validate it is a non-empty string
    - If `--doc-history-mode` is provided, validate it is one of the four valid `DocHistoryMode` values: `"overwrite"`, `"append-dated"`, `"new-dated-file"`, `"overwrite-archive"`. Reject with a clear error message otherwise.
  - Update `runCliInstaller()` to pass `docsEnabled`, `docsPath`, and `docHistoryMode` through to the config object that gets written via `writeWunderkindConfig()`. If `--docs-enabled` is not set, `docsEnabled` defaults to `false`. If `--docs-path` is not set, use `"./docs"`. If `--doc-history-mode` is not set, use `"overwrite"`.
  - Update `tests/unit/cli-installer.test.ts` — add test cases:
    - `--docs-enabled` alone writes `docsEnabled: true`, uses default `docsPath: "./docs"` and `docHistoryMode: "overwrite"`
    - `--docs-path=./documentation` writes that value
    - `--doc-history-mode=append-dated` writes that value
    - `--doc-history-mode=invalid-value` exits 1 with an error message

  **Must NOT do**:
  - Do not implement the actual docs directory creation here — that is Task 9
  - Do not add a `--docs-index` CLI subcommand

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CLI flag plumbing + validation + test coverage
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5 — both are Wave 2, but 4 and 5 are independent)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1, F2, F3
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/cli/index.ts` — look at how `--scope`, `--region`, `--primary-regulation` are defined. Follow the same Commander `.option()` pattern.
  - `src/cli/cli-installer.ts:validateNonTuiArgs()` — the existing validation pattern for string flags. Add parallel validation for `docHistoryMode`.
  - `src/cli/cli-installer.ts:runCliInstaller()` — see how `InstallArgs` fields are mapped to `InstallConfig`. Follow this mapping for the 3 new fields.
  - `tests/unit/cli-installer.test.ts` — look at the existing test structure. Add new `describe` blocks for the docs flags.

  **API/Type References**:
  - `src/cli/types.ts:DocHistoryMode` — the union type; valid values must match exactly
  - `src/cli/types.ts:InstallArgs` — `docsEnabled?: boolean`, `docsPath?: string`, `docHistoryMode?: string`

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Help output includes all 3 new flags
    Tool: Bash
    Preconditions: Task complete, built
    Steps:
      1. Run: node bin/wunderkind.js install --help
      2. Assert output contains "--docs-enabled"
      3. Assert output contains "--docs-path"
      4. Assert output contains "--doc-history-mode"
    Expected Result: All 3 flags appear in help text
    Evidence: .sisyphus/evidence/task-4-help.txt

  Scenario: Invalid --doc-history-mode exits 1
    Tool: Bash
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR --doc-history-mode=invalid 2>&1; echo "EXIT:$?"
      2. Assert output contains "EXIT:1"
      3. Assert output contains an error message mentioning valid values
    Expected Result: Exit 1, helpful error
    Evidence: .sisyphus/evidence/task-4-invalid-mode.txt

  Scenario: CLI tests pass including new flag tests
    Tool: Bash
    Steps:
      1. Run: bun test tests/unit/cli-installer.test.ts
      2. Assert exit code 0
    Expected Result: All CLI tests pass
    Evidence: .sisyphus/evidence/task-4-cli-tests.txt
  ```

  **Commit**: YES (Commit 4)
  - Message: `feat(cli): add --docs-enabled, --docs-path, --doc-history-mode flags`
  - Files: `src/cli/index.ts`, `src/cli/cli-installer.ts`, `tests/unit/cli-installer.test.ts`
  - Pre-commit: `tsc --noEmit && bun test tests/unit/cli-installer.test.ts`

---

- [ ] 5. TUI: add docs prompts after personality section

  **What to do**:
  - Open `src/cli/tui-installer.ts`.
  - Find the line where `dataAnalystRaw` is collected (the last personality prompt, currently near line 522).
  - Immediately AFTER that prompt and BEFORE the `const config = { ... }` assembly block, add the following three new prompts using `@clack/prompts`:

    **Prompt A — docsEnabled** (`p.confirm`):
    - Label: `"Enable documentation output?"`
    - Hint: `"Agents will write audit reports and documents to a configured folder"`
    - Default: `false`

    **Prompt B — docsPath** (`p.text`, only shown if `docsEnabled === true`):
    - Label: `"Documentation folder path"`
    - Placeholder: `"./docs"`
    - Default: `"./docs"`
    - Validate: non-empty string; warn if path starts with `/` (absolute paths are unusual)

    **Prompt C — docHistoryMode** (`p.select`, only shown if `docsEnabled === true`):
    - Label: `"When an agent re-runs a document command, what should happen to the existing file?"`
    - Options (in order):
      - `{ value: "overwrite", label: "Overwrite", hint: "Always replace with latest output" }` ← initial value
      - `{ value: "append-dated", label: "Append dated section", hint: "Add a ## YYYY-MM-DD section to the existing file" }`
      - `{ value: "new-dated-file", label: "New dated file", hint: "Create e.g. security-audit-2026-03-10.md" }`
      - `{ value: "overwrite-archive", label: "Overwrite + archive previous", hint: "Replace file, move previous to docs/.archive/" }`

  - Add `docsEnabled`, `docsPath`, `docHistoryMode` to the `const config = { ... }` assembly block using the values from the new prompts. If `docsEnabled` is false, set `docsPath: "./docs"` and `docHistoryMode: "overwrite"` as defaults anyway (the config always has these fields).
  - Handle `p.isCancel()` checks for all new prompts, consistent with how existing prompts handle cancellation.
  - Run `tsc --noEmit` — should compile clean.

  **Must NOT do**:
  - Do not insert these prompts before the personality section — they must come AFTER all 12 personality prompts
  - Do not skip the conditional show of Prompts B and C when docsEnabled is false — they are only relevant if enabled

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: TUI prompt insertion requires understanding `@clack/prompts` API, conditional flow, and cancel handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1, F2, F3
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/cli/tui-installer.ts` — look at `dataAnalystRaw` and the prompt immediately before it. The new prompts go immediately after `dataAnalystRaw`.
  - `src/cli/tui-installer.ts` — look at a `p.confirm()` usage for the boolean prompt pattern, a `p.text()` usage for the path prompt, and a `p.select()` usage for the mode prompt.
  - `src/cli/tui-installer.ts` — look at how `p.isCancel()` is checked after each prompt. The cancel check pattern must be applied to all 3 new prompts.
  - `src/cli/tui-installer.ts:const config = { ... }` — the assembly block that gathers all prompts into an `InstallConfig`. Add the 3 new fields here.

  **API/Type References**:
  - `src/cli/types.ts:DocHistoryMode` — the 4 valid values for the select options
  - `src/cli/types.ts:InstallConfig` — `docsEnabled: boolean`, `docsPath: string`, `docHistoryMode: DocHistoryMode`

  **External References**:
  - `@clack/prompts` API: `p.confirm()`, `p.text()`, `p.select()` — follow the existing usage patterns already in the file

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: TypeScript compiles clean after TUI changes
    Tool: Bash
    Preconditions: Task complete
    Steps:
      1. Run: tsc --noEmit
      2. Assert exit code 0
    Expected Result: No type errors
    Evidence: .sisyphus/evidence/task-5-tsc.txt

  Scenario: docsEnabled/docsPath/docHistoryMode present in config assembly
    Tool: Bash
    Steps:
      1. Run: grep -n "docsEnabled\|docsPath\|docHistoryMode" src/cli/tui-installer.ts
      2. Assert at least 6 matches (definition + usage in config block for each field)
    Expected Result: All 3 fields referenced multiple times
    Evidence: .sisyphus/evidence/task-5-grep-tui.txt

  Scenario: Prompts are inserted AFTER data analyst personality
    Tool: Bash
    Steps:
      1. Run: grep -n "dataAnalyst\|docsEnabled" src/cli/tui-installer.ts | head -20
      2. Assert line number of docsEnabled prompt is greater than line number of dataAnalyst prompt
    Expected Result: docsEnabled comes after dataAnalyst in file order
    Evidence: .sisyphus/evidence/task-5-line-order.txt
  ```

  **Commit**: YES (Commit 5)
  - Message: `feat(tui): add docs prompts after personality section`
  - Files: `src/cli/tui-installer.ts`
  - Pre-commit: `tsc --noEmit`

- [ ] 6. TDD: `src/agents/docs-config.ts` — canonical filename map + `buildDocsInstruction()`

  **What to do**:

  **Step 1 — Write tests FIRST** (`tests/unit/docs-config.test.ts`):
  - Test that `AGENT_DOCS_CONFIG` exports a record mapping all 12 agent keys to a config object
  - Test that each agent config has: `primaryFile: string`, `subFolder?: string`, a non-empty `canonicalFiles: string[]`
  - Test that `buildDocsInstruction(agentKey, docsPath, docHistoryMode)` returns a markdown string containing the agent's canonical filename, the docsPath, and the docHistoryMode rules
  - Test that `buildDocsInstruction` with an unknown agent key throws a typed error (not silently returns garbage)
  - Run tests: they should all FAIL (red) — this is correct TDD

  **Step 2 — Implement** `src/agents/docs-config.ts`:
  - Export `DocAgentConfig` interface: `{ primaryFile: string; subFolder?: string; canonicalFiles: string[]; updateIndexInline: boolean }`
  - Export `AGENT_DOCS_CONFIG` as a `Record<string, DocAgentConfig>` with entries for all 12 agents. Use the canonical filename table below (exact values — do not deviate):

  ```
  brand-builder     → primaryFile: "community-audit.md",      subFolder: undefined,      canonicalFiles: ["community-audit.md", "thought-leadership-plan.md", "pr-brief.md", "spend-gate.md"]
  ciso              → primaryFile: "security-audit.md",        subFolder: undefined,      canonicalFiles: ["threat-model.md", "security-audit.md", "compliance-check.md", "incident-response.md", "dependency-audit.md", "security-risk-register.md"]
  creative-director → primaryFile: "brand-guidelines.md",      subFolder: undefined,      canonicalFiles: ["brand-guidelines.md", "design-audit.md", "color-palette.md", "creative-brief.md"]
  data-analyst      → primaryFile: "tracking-plan.md",         subFolder: undefined,      canonicalFiles: ["tracking-plan.md", "funnel-analysis.md", "experiment-design.md", "metric-catalogue.md"]
  devrel-wunderkind → primaryFile: "dx-audit.md",              subFolder: "guides",       canonicalFiles: ["dx-audit.md", "migration-guide.md", "guides/<topic>.md"]
  fullstack-wunderkind → primaryFile: "architecture-review.md", subFolder: "adr",         canonicalFiles: ["bundle-analysis.md", "database-audit.md", "architecture-review.md", "adr/<slug>.md"]
  legal-counsel     → primaryFile: "license-audit.md",         subFolder: undefined,      canonicalFiles: ["license-audit.md", "terms-of-service.md", "privacy-policy.md", "contract-review.md"]
  marketing-wunderkind → primaryFile: "gtm-plan.md",           subFolder: undefined,      canonicalFiles: ["gtm-plan.md", "content-calendar.md", "brand-audit.md", "seo-audit.md"]
  operations-lead   → primaryFile: "supportability-review.md", subFolder: "runbooks",    canonicalFiles: ["supportability-review.md", "runbooks/<service>.md", "postmortem.md", "slo-design.md"]
  product-wunderkind → primaryFile: "prd.md",                   subFolder: undefined,      canonicalFiles: ["prd.md", "okrs.md", "north-star-metric.md", "sprint-plan.md"]
  qa-specialist     → primaryFile: "test-strategy.md",          subFolder: undefined,      canonicalFiles: ["test-strategy.md", "coverage-audit.md", "flaky-triage.md"]
  support-engineer  → primaryFile: "known-issues.md",           subFolder: undefined,      canonicalFiles: ["known-issues.md", "feedback-synthesis.md", "faq.md"]
  ```

  - Export `buildDocsInstruction(agentKey: string, docsPath: string, docHistoryMode: DocHistoryMode): string`. This function:
    - Looks up the agent key in `AGENT_DOCS_CONFIG` (use `noUncheckedIndexedAccess`-safe lookup: check for undefined)
    - Throws `new Error(`Unknown agent key: ${agentKey}`)` if not found
    - Returns a multi-line markdown string containing the Documentation Output rules for that agent (see template below)
  - The returned string template:
    ```
    ## Documentation Output

    When you produce a document, audit, or written artefact, save it to the configured docs folder.

    **Docs folder**: `{docsPath}/`
    **Your primary output file**: `{docsPath}/{primaryFile}` (or sub-folder files as appropriate)
    **Your canonical outputs**: {comma-separated list}

    **File write rules ({docHistoryMode})**:
    - overwrite: Replace the existing file. Use `Edit` if the file exists, `Write` if it does not.
    - append-dated: Add a `## YYYY-MM-DD` section to the bottom of the existing file. Create the file if it does not exist.
    - new-dated-file: Write a new file named `{basename}-YYYY-MM-DD.md`. If that file already exists today, append a counter: `{basename}-YYYY-MM-DD-2.md`.
    - overwrite-archive: If the file exists, copy it to `{docsPath}/.archive/{basename}-PREV.md` first (create `.archive/` if needed), then overwrite. Use `Write` for new files.

    **After writing any file**:
    1. Update `{docsPath}/README.md` — add or update the entry for your file in the index table.
    2. If `{docsPath}/README.md` does not exist, create it using the standard template (see below).
    3. If this is the first file ever written to `{docsPath}/`, check whether `AGENTS.md` in the project root references `{docsPath}/README.md`. If not, append a one-line reference: `> 📄 [Documentation Index]({docsPath}/README.md)`.

    **docs/README.md standard template** (create this if it does not exist):
    ```md
    # Documentation Index

    > Auto-maintained by wunderkind agents. Do not hand-edit this table.

    | File | Agent | Last Updated | Description |
    |------|-------|--------------|-------------|
    ```

    **Sub-folder rule**: {subFolder instruction if applicable, else "All files go directly in {docsPath}/"}

    **Refresh command**: Use `/docs-index` to regenerate this README from scratch if it gets out of sync.
    ```

  **Step 3 — Re-run tests**: All tests should now PASS (green).

  **Must NOT do**:
  - Do not hardcode `"./docs"` inside `docs-config.ts` — `docsPath` is always passed as a parameter
  - Do not make `AGENT_DOCS_CONFIG` a non-exported const (it must be testable)
  - Do not use `as any` for the index access

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: TDD discipline required; canonical data table must be precise; template string generation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 7 — they are independent until Task 7 imports docs-config)
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `tests/unit/agent-factories.test.ts` — the existing TDD loop pattern. The new `docs-config.test.ts` should follow the same file/test structure (bun test, `describe`, `it`, `expect`).
  - `src/agents/types.ts` — look at how agent key strings are defined. The keys in `AGENT_DOCS_CONFIG` must match the agent identity strings used in `src/index.ts` agent list.

  **API/Type References**:
  - `src/cli/types.ts:DocHistoryMode` — must be imported in `docs-config.ts` for the `buildDocsInstruction` signature

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: TDD red phase — tests fail before implementation
    Tool: Bash
    Preconditions: Test file written, docs-config.ts does NOT yet exist
    Steps:
      1. Run: bun test tests/unit/docs-config.test.ts 2>&1
      2. Assert exit code non-zero
      3. Assert output contains "Cannot find module" or similar
    Expected Result: Tests fail because implementation doesn't exist yet
    Evidence: .sisyphus/evidence/task-6-tdd-red.txt

  Scenario: TDD green phase — all tests pass after implementation
    Tool: Bash
    Preconditions: docs-config.ts implemented
    Steps:
      1. Run: bun test tests/unit/docs-config.test.ts
      2. Assert exit code 0
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-6-tdd-green.txt

  Scenario: All 12 agents present in AGENT_DOCS_CONFIG
    Tool: Bash
    Steps:
      1. Run: grep -c "primaryFile" src/agents/docs-config.ts
      2. Assert output is "12"
    Expected Result: 12 entries
    Evidence: .sisyphus/evidence/task-6-agent-count.txt

  Scenario: TypeScript compiles clean
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit 2>&1 | grep "docs-config"
      2. Assert output is empty
    Expected Result: No type errors in docs-config.ts
    Evidence: .sisyphus/evidence/task-6-tsc.txt
  ```

  **Commit**: YES (Commit 6)
  - Message: `feat(agents): add docs-config.ts canonical filename map + buildDocsInstruction()`
  - Files: `src/agents/docs-config.ts`, `tests/unit/docs-config.test.ts`
  - Pre-commit: `tsc --noEmit && bun test tests/unit/docs-config.test.ts`

---

- [ ] 7. TDD: inject global Documentation Output configuration into `src/index.ts` system prompt

  **What to do**:

  **IMPORTANT — Plugin API constraint** (verified from `node_modules/@opencode-ai/plugin/dist/index.d.ts`):
  The `experimental.chat.system.transform` hook receives `input: { sessionID?: string; model: Model }` — it does **NOT** have an `agent` field. There is no way to identify which wunderkind agent is active inside this hook. Therefore, Task 7 injects a **global** docs configuration notice (applies to all agents), NOT per-agent canonical filename sections (those are handled exclusively by Task 8's static per-agent text). Do NOT attempt per-agent routing in this task.

  **Step 1 — Write tests FIRST** (`tests/unit/docs-injection.test.ts`):
  - Mock `readWunderkindConfig()` to return various configs (docsEnabled: true, docsEnabled: false, null/no config)
  - Test that when `docsEnabled: false`, `output.system` does NOT gain any new element containing `"## Documentation Output"`
  - Test that when `docsEnabled: true` with `docsPath: "./docs"` and `docHistoryMode: "overwrite"`, `output.system` gains exactly one new string containing `"## Documentation Output"`, the literal `docsPath` value (`"./docs"`), and the literal `docHistoryMode` value (`"overwrite"`)
  - Test idempotency: calling the transform twice does not add a second `"## Documentation Output"` element — check by counting occurrences of `"## Documentation Output"` across all strings in `output.system`
  - Test that when config is `null` (no config file), the transform treats it as `docsEnabled: false` and injects nothing
  - Run tests: they should all FAIL (red) — correct TDD

  **Step 2 — Implement** in `src/index.ts`:
  - Import `readWunderkindConfig` from `src/cli/config-manager/index.ts`.
  - Inside the `experimental.chat.system.transform` async handler, after the existing `output.system.push(...)` call:
    1. Call `readWunderkindConfig()` synchronously — returns `Partial<InstallConfig> | null`.
    2. If result is null or `result.docsEnabled !== true`, do nothing (no injection).
    3. If `docsEnabled: true`:
       - Normalize `docsPath`: strip trailing slashes from `result.docsPath` (default `"./docs"` if missing).
       - Read `result.docHistoryMode` (default `"overwrite"` if missing).
       - Check idempotency: if any string already in `output.system` contains `"## Documentation Output"`, skip injection (already injected).
       - Otherwise push a new string onto `output.system` with the following content:
         ```
         ## Documentation Output

         Docs output is enabled for this project. When producing audits, reviews, or documentation:
         - Write artefacts to the configured path: {docsPath}/
         - Follow the doc history mode: {docHistoryMode} (overwrite | append-dated | new-dated-file | overwrite-archive)
         - After each write: update {docsPath}/README.md index. Create it from the standard template if it doesn't exist.
         - Use /docs-index to regenerate the README index from scratch if needed.
         - Your agent-specific canonical filenames are listed in the ## Documentation Output (Static Reference) section of your system prompt.
         ```
       - Substitute `{docsPath}` and `{docHistoryMode}` with the actual runtime values (not template literals — string replace).
  - Note: `readWunderkindConfig()` uses `readFileSync` (synchronous) — do NOT `await` it or wrap it in a Promise.

  **Step 3 — Re-run tests**: All tests should now PASS (green).

  **Must NOT do**:
  - Do NOT import `buildDocsInstruction` or `AGENT_DOCS_CONFIG` in `src/index.ts` — this task does not do per-agent injection
  - Do NOT attempt to read the active agent key from `_input` — the `experimental.chat.system.transform` type does not have an `agent` field (confirmed: `node_modules/@opencode-ai/plugin/dist/index.d.ts` line 197–202)
  - Do NOT make `readWunderkindConfig()` async — it is a synchronous `readFileSync` helper
  - Do not throw if config is missing — return gracefully

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: TDD with mocking, integration with a plugin transform hook, idempotency logic, verified Plugin API type constraints
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Task 3 (needs `readWunderkindConfig()`)

  **References**:

  **Pattern References**:
  - `src/index.ts:5` — the `experimental.chat.system.transform` handler. The docs injection goes inside this handler, after the existing `output.system.push(...)` call.
  - `src/cli/config-manager/index.ts:readWunderkindConfig()` — the function extracted in Task 3. Import and call this synchronously.
  - `tests/unit/agent-factories.test.ts` — bun mock pattern for mocking module imports. Follow the same `mock.module()` pattern for mocking `readWunderkindConfig` in the new test file.

  **API/Type References**:
  - `node_modules/@opencode-ai/plugin/dist/index.d.ts:197–202` — `experimental.chat.system.transform` handler signature: `(input: { sessionID?: string; model: Model }, output: { system: string[] }) => Promise<void>`. Note `output.system` is `string[]` (array of strings, not a single string — each `push` adds a new system prompt section).
  - `node_modules/@opencode-ai/plugin/dist/index.d.ts:10–17` — `PluginInput` type (the outer plugin factory input, not the transform input).

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: TDD red phase
    Tool: Bash
    Preconditions: Test file written, src/index.ts not yet modified
    Steps:
      1. Run: bun test tests/unit/docs-injection.test.ts 2>&1
      2. Assert exit code non-zero
    Expected Result: Tests fail in red phase
    Evidence: .sisyphus/evidence/task-7-tdd-red.txt

  Scenario: TDD green phase — all injection tests pass
    Tool: Bash
    Preconditions: src/index.ts implementation complete
    Steps:
      1. Run: bun test tests/unit/docs-injection.test.ts
      2. Assert exit code 0
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-7-tdd-green.txt

  Scenario: docsEnabled=false produces no injection
    Tool: Bash
    Steps:
      1. Run: bun test tests/unit/docs-injection.test.ts --reporter=verbose 2>&1 | grep "docsEnabled=false\|disabled"
      2. Assert line contains "pass" or exit code is 0
    Expected Result: No "## Documentation Output" push when disabled
    Evidence: .sisyphus/evidence/task-7-disabled.txt

  Scenario: Idempotency — double transform call does not duplicate section
    Tool: Bash
    Steps:
      1. Run: bun test tests/unit/docs-injection.test.ts --reporter=verbose 2>&1 | grep "idempotent\|duplicate"
      2. Assert test passes
    Expected Result: output.system contains exactly one element containing "## Documentation Output"
    Evidence: .sisyphus/evidence/task-7-idempotent.txt

  Scenario: TypeScript compiles clean after Task 7
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit
      2. Assert exit code 0
    Expected Result: No type errors
    Evidence: .sisyphus/evidence/task-7-tsc.txt
  ```

  **Commit**: YES (Commit 7)
  - Message: `feat(index): inject global Documentation Output config section from runtime wunderkind config`
  - Files: `src/index.ts`, `tests/unit/docs-injection.test.ts`
  - Pre-commit: `tsc --noEmit && bun test tests/unit/docs-injection.test.ts`

---


- [ ] 8. Agent tool-restriction audit + per-agent Documentation Output sections

  **What to do**:

  **Step 1 — Tool restriction audit**:
  - Read all 12 `src/agents/*.ts` files and find every call to `createAgentToolRestrictions()` (or equivalent — whatever function sets which tools are denied per agent).
  - For each agent, record: which tools are denied (specifically whether `write`, `edit`, or file-write tools are in the deny list).
  - Produce a table in comments at the top of your changes: `Agent | Write Denied? | Resolution`.
  - For agents where `write`/`edit` is denied:
    - Attempt to ring-fence: modify the restriction so that the agent CAN use write/edit BUT ONLY for paths matching `{docsPath}/**` or the agent's specific sub-path (e.g. `docs/runbooks/**` for operations-lead).
    - If the tool restriction API does not support path-based ring-fencing, note this explicitly and EXCLUDE that agent from docs output (add a comment in the agent factory).
  - Agents that already have write access: include them in docs output unconditionally.

  **Step 2 — Add Documentation Output section to eligible agents**:
  - For each eligible agent (write-capable or successfully ring-fenced), add a `Documentation Output` section to the agent's system prompt string in `src/agents/<name>.ts`.
  - The section should call `buildDocsInstruction(agentKey, "{docsPath}", "{docHistoryMode}")` — BUT since agent factory files are build-time (they produce static `.md` files), the literal `docsPath` and `docHistoryMode` cannot be known at build time.
  - **Resolution**: The agent prompt should contain static template text (not a function call) that says:
    ```
    ## Documentation Output (Static Reference)

    When docs output is enabled (check wunderkind config at `.wunderkind/wunderkind.config.jsonc`), write your artefacts to the configured `docsPath`.

    Your canonical output files:
    - {list from AGENT_DOCS_CONFIG for this agent}

    Follow the `docHistoryMode` rule from config (overwrite / append-dated / new-dated-file / overwrite-archive).

    After each write: update `{docsPath}/README.md` index. If `{docsPath}/README.md` doesn't exist, create it from the standard template. If this is the first file in `{docsPath}/`, add a one-line reference to `AGENTS.md`.

    Use `/docs-index` to regenerate the README index from scratch if needed.
    ```
  - **CRITICAL**: Use the heading `## Documentation Output (Static Reference)` — NOT `## Documentation Output`. The runtime injection in `src/index.ts` (Task 7) uses `/^## Documentation Output$/m` regex as its sentinel to detect whether runtime injection has already been applied. A plain `## Documentation Output` heading in the static agent prompt would falsely trigger the sentinel and block the runtime injection of concrete `docsPath` and `docHistoryMode` values. The `(Static Reference)` suffix distinguishes the build-time fallback from the runtime-injected section.
  - Substitute `{list from AGENT_DOCS_CONFIG}` with the actual canonical filenames from the table in Task 6 (hardcoded in the agent's static prompt — the canonical filenames are build-time constants).

  **Step 3 — Update agent factory tests**:
  - Update `tests/unit/agent-factories.test.ts` to add a new assertion: for each eligible agent, the generated prompt string contains `"## Documentation Output (Static Reference)"` (the build-time static heading added in Step 2).

  **Step 4 — Rebuild agents/*.md**:
  - Run `bun run build` — this regenerates all `agents/*.md` from the updated factory functions.

  **Must NOT do**:
  - Do not grant unrestricted write access to agents that previously had write denied — ring-fence or exclude
  - Do not call `buildDocsInstruction()` at build time (agent factories are static string builders; `docsPath` is runtime config)
  - Do not edit `agents/*.md` directly

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires understanding the tool restriction API, making ring-fence decisions, adding correct static text to 12 agent factories, updating tests, and running a build
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1, 6, 7)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F2, F3
  - **Blocked By**: Tasks 1, 6, 7

  **References**:

  **Pattern References**:
  - `src/agents/ciso.ts` (or any agent) — find the tool restriction call. Understand the API surface for restriction rules.
  - `src/agents/brand-builder.ts` — example of an agent that likely has write access. Use as the "eligible" template.
  - `src/agents/legal-counsel.ts`, `src/agents/data-analyst.ts` — likely candidates for write restriction — examine carefully.
  - `tests/unit/agent-factories.test.ts` — the existing test loop that asserts on agent prompts. Add the new `"## Documentation Output"` assertion inside the loop.

  **API/Type References**:
  - `src/agents/docs-config.ts:AGENT_DOCS_CONFIG` — import and read the `canonicalFiles` array for each agent to populate the static list in each agent's Documentation Output section

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: All eligible agents have Documentation Output section
    Tool: Bash
    Preconditions: bun run build complete
    Steps:
      1. Run: grep -l "Documentation Output (Static Reference)" agents/*.md | wc -l
      2. Assert count matches the number of eligible agents (determined by audit — at minimum 8, at most 12)
    Expected Result: Correct count of eligible agent .md files contain the section
    Evidence: .sisyphus/evidence/task-8-eligible-agents.txt

  Scenario: Excluded agents do NOT have Documentation Output section
    Tool: Bash
    Steps:
      1. For each excluded agent (identified in audit), run: grep "Documentation Output" agents/<name>.md
      2. Assert no output for each excluded agent
    Expected Result: Excluded agents have no docs section
    Evidence: .sisyphus/evidence/task-8-excluded-agents.txt

  Scenario: Agent factory tests pass with new assertion
    Tool: Bash
    Steps:
      1. Run: bun test tests/unit/agent-factories.test.ts
      2. Assert exit code 0
    Expected Result: All factory tests pass including new Documentation Output assertion
    Evidence: .sisyphus/evidence/task-8-factory-tests.txt

  Scenario: Build succeeds and all agents/*.md regenerated
    Tool: Bash
    Steps:
      1. Run: bun run build
      2. Assert exit code 0
      3. Run: ls agents/*.md | wc -l
      4. Assert count is 12
    Expected Result: 12 .md files, build succeeds
    Evidence: .sisyphus/evidence/task-8-build.txt

  Scenario: Full test suite passes
    Tool: Bash
    Steps:
      1. Run: bun test
      2. Assert exit code 0
    Expected Result: All tests green
    Evidence: .sisyphus/evidence/task-8-full-tests.txt
  ```

  **Commit**: YES (Commit 8)
  - Message: `feat(agents): add Documentation Output section to all eligible agent factories`
  - Files: `src/agents/*.ts` (eligible after audit), `tests/unit/agent-factories.test.ts`
  - Pre-commit: `tsc --noEmit && bun test && bun run build`

---

- [ ] 9. Installer pre-creates `docs/` and `docs/README.md` when `docsEnabled=true`

  **What to do**:
  - Open `src/cli/tui-installer.ts`. After the spinner that calls `writeWunderkindConfig()`, add a new step: if `config.docsEnabled === true`, create the `docs/` directory (using `config.docsPath`, default `"./docs"`) if it doesn't exist, then create `docs/README.md` with the standard template (see template below) if it doesn't already exist. Log a spinner message like `"Creating docs folder..."`.
  - Apply the same logic to `src/cli/cli-installer.ts` in `runCliInstaller()`, after the `writeWunderkindConfig()` call.
  - The standard `docs/README.md` template:
    ```md
    # Documentation Index

    > Auto-maintained by wunderkind agents. Do not hand-edit this table.
    > Run `/docs-index` in any wunderkind agent chat to regenerate from scratch.

    | File | Agent | Last Updated | Description |
    |------|-------|--------------|-------------|
    ```
  - Normalize `docsPath` (strip trailing slash) before using as a filesystem path.
  - If `docsPath` is relative, resolve it relative to `process.cwd()`.
  - If the directory or README already exists, do NOT overwrite — skip silently with a note in the spinner.
  - Run `tsc --noEmit` and `bun test` — all tests should still pass.

  **Must NOT do**:
  - Do not create per-agent sub-folders (`runbooks/`, `guides/`, `adr/`) — agents create these lazily
  - Do not overwrite an existing `docs/README.md` — if it exists, leave it untouched
  - Do not add `docs/` to `.gitignore`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Filesystem operations in two installer files, path normalization, idempotency logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 3 and 7 for config shape)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F2, F3
  - **Blocked By**: Tasks 3, 7

  **References**:

  **Pattern References**:
  - `src/cli/tui-installer.ts` — find the spinner that calls `writeWunderkindConfig()`. The docs folder creation step goes immediately after.
  - `src/cli/cli-installer.ts:runCliInstaller()` — same: add docs folder creation after `writeWunderkindConfig()`.
  - `src/cli/gitignore-manager.ts` — look at how it creates directories with `mkdirSync`. Use the same pattern (or `mkdir` from `node:fs/promises`).

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Non-interactive install with --docs-enabled creates docs/ and README
    Tool: Bash
    Preconditions: No docs/ folder exists in cwd
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR --docs-enabled --docs-path=./docs-test 2>&1
      2. Assert exit code 0
      3. Run: ls docs-test/README.md
      4. Assert file exists
      5. Run: cat docs-test/README.md
      6. Assert content contains "Documentation Index" and the table header
      7. Cleanup: rm -rf docs-test
    Expected Result: docs-test/ and docs-test/README.md created with correct content
    Evidence: .sisyphus/evidence/task-9-install-with-docs.txt

  Scenario: Install without --docs-enabled does NOT create docs/
    Tool: Bash
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR 2>&1
      2. Assert exit code 0
      3. Run: ls docs/ 2>&1; echo "EXIT:$?"
      4. Assert output contains "EXIT:1" or "No such file"
    Expected Result: docs/ is not created when docsEnabled=false
    Evidence: .sisyphus/evidence/task-9-install-without-docs.txt

  Scenario: Re-running install does not overwrite existing README
    Tool: Bash
    Steps:
      1. Create docs-test/README.md with custom content "MY CUSTOM README"
      2. Run install with --docs-enabled --docs-path=./docs-test
      3. Run: cat docs-test/README.md
      4. Assert content still contains "MY CUSTOM README"
      5. Cleanup: rm -rf docs-test
    Expected Result: Existing README left untouched
    Evidence: .sisyphus/evidence/task-9-idempotent-readme.txt
  ```

  **Commit**: YES (Commit 9)
  - Message: `feat(installer): pre-create docs/ and docs/README.md when docsEnabled=true`
  - Files: `src/cli/tui-installer.ts`, `src/cli/cli-installer.ts`
  - Pre-commit: `tsc --noEmit && bun test`

---

- [ ] 10. Version bump, README + stale AGENTS.md updates

  **What to do**:
  - In `package.json`, update `"version"` from `"0.5.0"` to `"0.6.0"` (or whatever the current version is — check before editing).
  - In `.claude-plugin/plugin.json`, update `"version"` to match (GOTCHA: these must be manually kept in sync).
  - In `README.md`, add a section documenting the docs output feature: `docsEnabled`, `docsPath`, `docHistoryMode` options, what the `docs/README.md` index is, and the `/docs-index` command. Also update the agent count if it references "8 agents" anywhere — should be 12.
  - In `src/agents/AGENTS.md`, fix the stale "8 TypeScript agent factory files" reference — update to 12 and list all 12 agent keys.
  - In `src/cli/AGENTS.md`, check for any stale references and update if needed.
  - Run `tsc --noEmit && bun run build` to confirm everything still compiles and builds cleanly.

  **Must NOT do**:
  - Do not touch any `.ts` files in this task — docs and version only
  - Do not run `npm version` — edit `package.json` directly (Bun repo)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Docs and version string updates only — no logic
  - **Skills**: [`writing`]
    - `writing`: Ensuring docs are clear and well-structured

  **Parallelization**:
  - **Can Run In Parallel**: NO (do after Task 8 so README accurately describes the final eligible agent list)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1
  - **Blocked By**: Task 8

  **References**:

  **Pattern References**:
  - `README.md` — look at how existing features are documented. Follow the same style.
  - `src/agents/AGENTS.md` — find "8 TypeScript agent factory files" and update.
  - `.claude-plugin/plugin.json` — find `"version"` field. Must match `package.json`.

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: package.json and plugin.json versions match
    Tool: Bash
    Preconditions: Task complete
    Steps:
      1. Run: node -e "const p=require('./package.json'); const c=require('./.claude-plugin/plugin.json'); console.log(p.version===c.version?'MATCH':'MISMATCH')"
      2. Assert output is "MATCH"
    Expected Result: Versions are in sync
    Evidence: .sisyphus/evidence/task-10-version-sync.txt

  Scenario: README documents docs output feature
    Tool: Bash
    Steps:
      1. Run: grep -c "docsEnabled\|docsPath\|docHistoryMode\|docs-index" README.md
      2. Assert count >= 4
    Expected Result: All key terms present in README
    Evidence: .sisyphus/evidence/task-10-readme.txt

  Scenario: Build still succeeds after version bump
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit && bun run build
      2. Assert exit code 0
    Expected Result: Clean build
    Evidence: .sisyphus/evidence/task-10-build.txt
  ```

  **Commit**: YES (Commit 10)
  - Message: `chore: bump to v0.6.0, update README and AGENTS.md for docs feature`
  - Files: `package.json`, `.claude-plugin/plugin.json`, `README.md`, `src/agents/AGENTS.md`, `src/cli/AGENTS.md`
  - Pre-commit: `tsc --noEmit && bun run build`

---

- [ ] 11. TUI: personality customisation gate

  **What to do**:
  - Open `src/cli/tui-installer.ts`.
  - Find the `p.log.step` line that introduces the "Agent Personality Overrides" header (currently around line 213). The gate confirm prompt goes **immediately before** this header.
  - **IMPORTANT — variable scoping**: All 12 personality `*Raw` variables (e.g. `cisoRaw`) are currently `const` assigned by `await p.select(...)`. Wrapping them in an `if` block makes them block-scoped. **Before the gate prompt, declare all 12 as `let` in the outer function scope with explicit personality union types** so TypeScript can see them as fully assigned in both branches:
    ```typescript
    let cisoRaw: CisoPersonality
    let ctoRaw: CtoPersonality
    let cmoRaw: CmoPersonality
    let qaRaw: QaPersonality
    let productRaw: ProductPersonality
    let opsRaw: OpsPersonality
    let creativeRaw: CreativePersonality
    let brandRaw: BrandPersonality
    let devrelRaw: DevrelPersonality
    let legalRaw: LegalPersonality
    let supportRaw: SupportPersonality
    let dataAnalystRaw: DataAnalystPersonality
    ```
    Without this, TypeScript will error "Variable is used before being assigned" when the `config` object at line 527+ references them.
  - Add a `p.confirm` prompt (note: `ConfirmOptions` has no `hint` field — fold hint into `message`):
    ```typescript
    const customisePersonalities = await p.confirm({
      message: "Customise agent personalities? (If no, existing or default values are kept for all 12 agents)",
      initialValue: false,
    })
    if (p.isCancel(customisePersonalities)) {
      p.cancel("Installation cancelled.")
      return 1
    }
    ```
  - Wrap the existing `p.log.step` header AND all 12 `p.select` personality prompts in `if (customisePersonalities) { ... }`. Assign to the `let` variables declared above.
  - In the `else` branch (user answered No), assign each personality variable from `detected.*` if the field is present, otherwise fall back to the canonical default. **Never reset to defaults when the user has existing values** — preserve them:
    ```typescript
    } else {
      cisoRaw = detected.cisoPersonality   // already has the right value (existing or default)
      ctoRaw = detected.ctoPersonality
      cmoRaw = detected.cmoPersonality
      qaRaw = detected.qaPersonality
      productRaw = detected.productPersonality
      opsRaw = detected.opsPersonality
      creativeRaw = detected.creativePersonality
      brandRaw = detected.brandPersonality
      devrelRaw = detected.devrelPersonality
      legalRaw = detected.legalPersonality
      supportRaw = detected.supportPersonality
      dataAnalystRaw = detected.dataAnalystPersonality
    }
    ```
    (Note: `detected` already returns canonical defaults for missing fields, so this is safe for new installs too.)
  - In the installation summary section (the spinner / log messages shown at end), list all 12 personality values regardless of whether the user customised them or used defaults. The summary should show what was actually configured.
  - Run `tsc --noEmit` — zero errors expected.

  **Must NOT do**:
  - Do not reset existing personality values to canonical defaults when user answers No — keep their existing values
  - Do not add a `--use-default-personalities` CLI flag — the non-interactive CLI already uses defaults when personality flags are absent
  - Do not move the confirm prompt after the personality selects — it must come before them (as a gate)
  - Do not change anything in `src/cli/cli-installer.ts` for this task
  - Do not include `hint:` in the `p.confirm` call — `ConfirmOptions` has no `hint` field, it will cause a TypeScript excess-property error; fold hint text into the `message` string instead
  - Do not use `!` (non-null assertion) on the `*Raw` variables when building the `config` object — declare them as `let <name>: <PersonalityType>` and TypeScript will narrow correctly

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, wrapping existing code with a one `p.confirm` gate — minimal logic, no new types
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4 — all Wave 2 work)
  - **Parallel Group**: Wave 2 — **BUT** `src/cli/tui-installer.ts` is also modified by Task 5 (docs prompts) and Task 12 Step 4 (upgrade warnings). These three tasks MUST be applied sequentially by the same agent in strict order: **Task 5 → Task 11 → Task 12 Step 4**. This matches the wave diagram order (Task 5 listed first, then 11, then 12). Do NOT run them in separate parallel agents.
  - **Blocks**: Task 12 (Step 4 depends on 11 being applied first), F1, F2, F3
  - **Blocked By**: Tasks 1, 2, 5 (types must be defined; config-path must be corrected; docs prompts must be in place before personality gate is inserted)

  **References**:

  **Pattern References**:
  - `src/cli/tui-installer.ts` — find the `p.log.step` call with text "Agent Personality Overrides". The gate goes immediately before this line.
  - `src/cli/tui-installer.ts` — find any existing `p.confirm()` call for the cancel-check pattern. Apply same `p.isCancel()` guard.
  - `src/cli/tui-installer.ts` — look at how `detected.*` values are used as `initialValue` in existing selects. The else-branch reuses these same values.
  - `src/cli/tui-installer.ts` — find the installation summary block at the end (the spinner that logs what was installed). Ensure personality values are shown regardless of gate answer.

  **API/Type References**:
  - `src/cli/config-manager/index.ts:detectCurrentConfig()` — `detected.cisoPersonality` through `detected.dataAnalystPersonality` are the existing+default values already resolved correctly.

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Gate prompt appears before personality selects
    Tool: Bash
    Preconditions: Task complete
    Steps:
      1. Run: grep -n "Customise agent personalities\|Agent Personality Overrides" src/cli/tui-installer.ts | head -5
      2. Assert line number of "Customise agent personalities" is LESS THAN line number of "Agent Personality Overrides"
    Expected Result: Gate comes before the header (correct order)
    Evidence: .sisyphus/evidence/task-11-line-order.txt

  Scenario: p.confirm uses initialValue: false (not true)
    Tool: Bash
    Steps:
      1. Run: grep -n "initialValue: false" src/cli/tui-installer.ts
      2. Assert at least one match near the "Customise agent personalities" text
    Expected Result: Gate confirm defaults to No (false), not Yes
    Evidence: .sisyphus/evidence/task-11-initial-value.txt

  Scenario: p.confirm does NOT use hint: field (excess property would fail tsc)
    Tool: Bash
    Steps:
      1. Run: grep -A5 "Customise agent personalities" src/cli/tui-installer.ts | grep "hint:"
      2. Assert NO output (grep finds nothing)
    Expected Result: No hint: field on the p.confirm call
    Evidence: .sisyphus/evidence/task-11-no-hint.txt

  Scenario: TypeScript compiles clean
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit
      2. Assert exit code 0
    Expected Result: No type errors (especially no "used before assigned" on personality variables)
    Evidence: .sisyphus/evidence/task-11-tsc.txt

  Scenario: Personality variables are assigned in both branches
    Tool: Bash
    Steps:
      1. Run: grep -c "cisoRaw\|ctoRaw\|cmoRaw\|qaRaw\|productRaw\|opsRaw\|creativeRaw\|brandRaw\|devrelRaw\|legalRaw\|supportRaw\|dataAnalystRaw" src/cli/tui-installer.ts
      2. Assert count is at least 24 (each variable assigned in both if and else branch)
    Expected Result: All 12 personality variables assigned in both branches
    Evidence: .sisyphus/evidence/task-11-vars-both-branches.txt
  ```

  **Commit**: YES (Commit 11)
  - Message: `feat(tui): add personality customisation gate with sane defaults`
  - Files: `src/cli/tui-installer.ts`
  - Pre-commit: `tsc --noEmit`

---

- [ ] 12. Upgrade detection: `configVersion` field + install-state model

  **What to do**:

  **Step 1 — Add `configVersion` to types** (`src/cli/types.ts`):
  - Add `configVersion: string` to `InstallConfig` and `DetectedConfig` (required field).
  - Add `configVersion?: string` to `InstallArgs` (optional CLI flag, but not exposed — set programmatically).
  - Export a new union type:
    ```typescript
    export type InstallState = "not-installed" | "current" | "needs-upgrade" | "broken"
    ```

  **Step 2 — Emit `configVersion` in `writeWunderkindConfig()`** (`src/cli/config-manager/index.ts`):
  - **DO NOT** add `createRequire` to `config-manager/index.ts` or `tui-installer.ts` or `cli-installer.ts` — the project AGENTS.md explicitly says `createRequire` is only used in `src/cli/index.ts` and no additional `require()` calls should be added elsewhere.
  - Instead, add a `version: string` parameter to `writeWunderkindConfig(config, scope, version: string)`.
  - The version string originates in `src/cli/index.ts` (where `createRequire` already reads `package.json`). Pass `pkg.version` down the call chain:
    1. Update `runTuiInstaller(scopeHint?: InstallScope)` → `runTuiInstaller(scopeHint: InstallScope | undefined, version: string)`.
    2. Update `runCliInstaller(args: InstallArgs)` → `runCliInstaller(args: InstallArgs, version: string)`.
    3. In `src/cli/index.ts`, update the call sites: `runTuiInstaller(opts.scope as InstallScope, pkg.version)` and `runCliInstaller(args, pkg.version)`.
    4. Inside `runTuiInstaller` and `runCliInstaller`, pass `version` to `writeWunderkindConfig(config, scope, version)`.
  - Add `"configVersion": "${version}"` as the **first** key in the emitted JSONC template string (after the comment header), where `version` is the parameter passed in.

  **Step 3a — Also export these constants** (`src/cli/config-manager/index.ts`):
  - Export `WUNDERKIND_CONFIG`, `GLOBAL_WUNDERKIND_CONFIG` (currently module-private `const` — add `export` keyword). These are needed by the doctor command (Task 13).
  - Export `getConfigPath` (currently module-private function — add `export` keyword). Needed by the doctor's `opencode-config` check (Task 13).

  **Step 3b — Export `detectInstallState()`** (`src/cli/config-manager/index.ts`):
  - Export a new function:
    ```typescript
    export function detectInstallState(): InstallState
    ```
  - Add `configVersion: string` to the return of `detectCurrentConfig()`: read `wk["configVersion"]` from the JSONC, default to `""` (empty string) if absent. **IMPORTANT: `detectCurrentConfig()` has 4 return paths — add `configVersion: ""` to ALL of them**: the initial `defaults` object, the `!isInstalled` early return, the `catch` return, and the main parsed return at the bottom. Missing any one of these will cause a TypeScript compile error (required field not present on returned object).

  - Logic:
    1. Call `detectCurrentConfig()` to get `detected`.
    2. If `detected.isInstalled === false` → return `"not-installed"`.
    3. Try to read the wunderkind config file. If it throws or returns null → return `"broken"`.
    4. Parse the raw JSONC object. Check for presence of all **22 current known config keys** (18 existing fields + `docsEnabled`, `docsPath`, `docHistoryMode` added in Task 2 + `configVersion` = 22 total).
    5. If any of those keys is missing from the raw JSONC object → return `"needs-upgrade"`.
    6. Otherwise → return `"current"`.
  - The list of "all current known keys" should be defined as a `const KNOWN_CONFIG_KEYS: readonly string[]` at the top of the file (exported) so the doctor command (Task 13) can also import and iterate it.

  **Step 4 — Surface upgrade state in TUI** (`src/cli/tui-installer.ts`):
  - Import `detectInstallState` from config-manager.
  - At the top of `runTuiInstaller()`, after `const detected = detectCurrentConfig()`:
    ```typescript
    const installState = detectInstallState()
    if (installState === "needs-upgrade") {
      p.log.warn(
        "Your wunderkind config is from an older version and is missing some fields. " +
        "This installer will add the missing defaults. Your existing values are preserved."
      )
    } else if (installState === "broken") {
      p.log.warn(
        "Wunderkind appears to be installed but your config file is missing or unparseable. " +
        "Running install will create a fresh config."
      )
    }
    ```
  - The existing `if (isUpdate)` info message stays; add the upgrade/broken messages below it.

  **Step 5 — Update test mocks**:
  - In `tests/unit/cli-installer.test.ts`, add `configVersion: "0.6.0"` to any mock `DetectedConfig` return values.
  - Run `bun test` — all tests should pass.

  **Must NOT do**:
  - Do not add a `--config-version` CLI flag — `configVersion` is written programmatically, never set by the user
  - Do not implement migration/transformation logic — merely detect and report the upgrade state
  - Do not make `detectInstallState()` throw — it must return a state string gracefully even on broken installs
  - Do not add `createRequire` to `config-manager/index.ts` — violates the project AGENTS.md rule that `createRequire` is only in `src/cli/index.ts`; pass version as a parameter instead
  - Do not forget to update the `mock.module` registration in `tests/unit/cli-installer.test.ts` to include `detectInstallState` and `KNOWN_CONFIG_KEYS` in the exported mock shape — failing to do so will cause TypeScript compile errors in tests that import the module

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple files, new exported function, type additions, test mock updates, reading package.json at runtime
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4, 5, 11 — all Wave 2)
  - **Parallel Group**: Wave 2 — **BUT** Task 12 Step 4 (TUI warnings) modifies `src/cli/tui-installer.ts`, which is also modified by Tasks 5 and 11. Step 4 must be applied AFTER Tasks 5 and 11 are complete (same-file sequential ordering). Steps 1–3 of Task 12 (`types.ts` and `config-manager/index.ts`) can truly run in parallel.
  - **Blocks**: Task 13 (doctor imports `detectInstallState`, `KNOWN_CONFIG_KEYS`, `getConfigPath`, `WUNDERKIND_CONFIG`, `GLOBAL_WUNDERKIND_CONFIG` — all exported in this task)
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/cli/index.ts:97` — the `runTuiInstaller(opts.scope as InstallScope)` and `runCliInstaller(args)` call sites. Update both calls to pass `pkg.version` as a second argument. The `createRequire` + `pkg.version` pattern is already on lines 9–10 of this file — do NOT add `createRequire` to any other file.
  - `src/cli/config-manager/index.ts:detectCurrentConfig()` — the full function body (from audit). `detectInstallState()` calls this and then does additional raw-key checking.
  - `src/cli/config-manager/index.ts:writeWunderkindConfig()` — the JSONC template string. Add `version: string` parameter; embed as the very first key `"configVersion"`.
  - `src/cli/tui-installer.ts:82` — current signature `runTuiInstaller(scopeHint?: InstallScope)`. Update to `runTuiInstaller(scopeHint: InstallScope | undefined, version: string)`. Pass `version` to `writeWunderkindConfig`.
  - `src/cli/cli-installer.ts` — current signature `runCliInstaller(args: InstallArgs)`. Update to `runCliInstaller(args: InstallArgs, version: string)`. Pass `version` to `writeWunderkindConfig`.
  - `src/cli/tui-installer.ts` — find `const isUpdate = detected.isInstalled` line. The new `detectInstallState()` call and warn messages go immediately after.
  - `tests/unit/cli-installer.test.ts` — any mock that returns `DetectedConfig` — add `configVersion: "0.6.0"` to it.

  **API/Type References**:
  - `src/cli/types.ts:InstallState` — the new union type (defined in this task)
  - `src/cli/types.ts:InstallConfig` — `configVersion: string` is a new required field

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: writeWunderkindConfig emits configVersion field
    Tool: Bash
    Preconditions: Task complete, Tasks 3–4 complete (CLI flags work)
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR 2>/dev/null || true
      2. Run: cat .wunderkind/wunderkind.config.jsonc | grep configVersion
      3. Assert output contains "configVersion"
    Expected Result: configVersion key present in written config
    Evidence: .sisyphus/evidence/task-12-config-version.txt

  Scenario: detectInstallState returns "needs-upgrade" for old config missing docsEnabled
    Tool: Bash
    Steps:
      1. Run: bun test tests/unit/cli-installer.test.ts
      2. Assert all tests pass (mocks include configVersion now)
    Expected Result: Test suite passes with updated DetectedConfig mock
    Evidence: .sisyphus/evidence/task-12-upgrade-detect.txt

  Scenario: detectInstallState returns "broken" for invalid JSONC config
    Tool: Bash
    Preconditions: bun run build has completed (dist/ exists)
    Steps:
      1. Run: mkdir -p .wunderkind && cp .wunderkind/wunderkind.config.jsonc .wunderkind/wunderkind.config.jsonc.bak 2>/dev/null; echo '{invalid json' > .wunderkind/wunderkind.config.jsonc
      2. Run: bun -e "import { detectInstallState } from './dist/cli/config-manager/index.js'; const result = detectInstallState(); console.log(result); process.exit(result === 'broken' ? 0 : 1)" 2>&1
      3. Assert exit code 0 and output line equals "broken"
      4. Cleanup: cp .wunderkind/wunderkind.config.jsonc.bak .wunderkind/wunderkind.config.jsonc 2>/dev/null || rm .wunderkind/wunderkind.config.jsonc
    Expected Result: "broken" printed to stdout, exit code 0 (no exception thrown)
    Evidence: .sisyphus/evidence/task-12-broken-state.txt

  Scenario: detectInstallState returns "current" when all 22 keys are present
    Tool: Bash
    Preconditions: bun run build has completed; a valid fully-populated config already exists at .wunderkind/wunderkind.config.jsonc (written by a prior full install run including --docs-enabled)
    Steps:
      1. Run: bun -e "import { detectInstallState } from './dist/cli/config-manager/index.js'; const result = detectInstallState(); console.log(result); process.exit(result === 'current' ? 0 : 1)" 2>&1
      2. Assert exit code 0 and output line equals "current"
    Expected Result: "current" printed to stdout, exit code 0
    Evidence: .sisyphus/evidence/task-12-current-state.txt

  Scenario: KNOWN_CONFIG_KEYS exported and has exactly 22 entries
    Tool: Bash
    Steps:
      1. Run: bun -e "import { KNOWN_CONFIG_KEYS } from './dist/cli/config-manager/index.js'; console.log(KNOWN_CONFIG_KEYS.length)"
      2. Assert output is "22"
    Expected Result: KNOWN_CONFIG_KEYS has exactly 22 entries
    Evidence: .sisyphus/evidence/task-12-known-keys.txt

  Scenario: tsc compiles clean
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit
      2. Assert exit code 0
    Expected Result: No type errors
    Evidence: .sisyphus/evidence/task-12-tsc.txt
  ```

  **Commit**: YES (Commit 12)
  - Message: `feat(config-manager): add configVersion field and upgrade detection`
  - Files: `src/cli/types.ts`, `src/cli/config-manager/index.ts`, `src/cli/tui-installer.ts`, `tests/unit/cli-installer.test.ts`
  - Pre-commit: `tsc --noEmit && bun test`

---

- [ ] 13. `wunderkind doctor` / `wunderkind doctor --verbose` command

  **What to do**:

  **Step 1 — Create `src/cli/doctor.ts`**:
  - Export the following types:
    ```typescript
    export type DoctorCheckStatus = "pass" | "warn" | "fail"
    export interface DoctorIssue {
      title: string
      description: string
      fix?: string        // actionable command or instruction
      severity: "error" | "warning"
    }
    export interface DoctorCheckResult {
      id: string
      name: string
      status: DoctorCheckStatus
      issues: DoctorIssue[]
      detail?: string     // shown only in --verbose mode
    }
    export interface DoctorOptions {
      verbose: boolean
    }
    ```
  - Export `runDoctor(opts: DoctorOptions): Promise<number>` — returns exit code (`0` = all pass/warn, `1` = any fail).
  - Run all checks **concurrently** with `Promise.allSettled` (NOT `Promise.all` — `allSettled` waits for all checks to complete even if one rejects, preventing one crashed check from masking others). Each check is an `async` function that catches its own errors internally and returns a `DoctorCheckResult` — it should never throw to the outer `allSettled`. Errors thrown inside a check should be caught and returned as a `fail` result.
  - When iterating `Promise.allSettled` results, use **`for...of`** — never index access (`results[i]`). `noUncheckedIndexedAccess` makes `results[i]` return `PromiseSettledResult<DoctorCheckResult> | undefined`.
  - Define these shared constants at the top of `doctor.ts`:
    ```typescript
    // Guard for repo/dev-mode checks — true only when run inside the wunderkind repo itself
    const REPO_MODE = existsSync("src/build-agents.ts")
    // Canonical list of expected generated agent .md filenames
    const EXPECTED_AGENT_FILES = [
      "brand-builder.md", "ciso.md", "creative-director.md", "data-analyst.md",
      "devrel-wunderkind.md", "fullstack-wunderkind.md", "legal-counsel.md",
      "marketing-wunderkind.md", "operations-lead.md", "product-wunderkind.md",
      "qa-specialist.md", "support-engineer.md"
    ] as const
    ```
  - For optional fields `DoctorIssue.fix` and `DoctorCheckResult.detail`, use conditional spread to comply with `exactOptionalPropertyTypes`:
    ```typescript
    // ✅ Correct pattern for exactOptionalPropertyTypes:
    const issue: DoctorIssue = {
      title: "...", description: "...", severity: "error",
      ...(fix !== undefined && { fix }),
    }
    ```
  - After all checks complete, print output (see format below) then return exit code.

  **Step 2 — Implement the following 10 checks** (in separate named functions inside `src/cli/doctor.ts`):

  | Check ID | Name | Logic | Fail/Warn/Pass |
  |---|---|---|---|
  | `legacy-config` | Legacy config at project root | `existsSync("./wunderkind.config.jsonc")` | **FAIL** if exists (fix: move to `.wunderkind/`) |
  | `opencode-config` | OpenCode config presence | `getConfigPath()` returns non-"none" format | **FAIL** if none found |
  | `plugin-registered` | Wunderkind plugin registered | `detectCurrentConfig().isInstalled` | **FAIL** if not registered (fix: `bunx @grant-vine/wunderkind install`) |
  | `wk-config-file` | Wunderkind config file exists | `existsSync(WUNDERKIND_CONFIG) \|\| existsSync(GLOBAL_WUNDERKIND_CONFIG)` | **WARN** if missing but plugin registered; **PASS** if exists |
  | `wk-config-parse` | Wunderkind config parses cleanly | Parse the JSONC — check for errors | **FAIL** if file exists but unparseable |
  | `config-current` | Config fields up to date | Import `detectInstallState` + `KNOWN_CONFIG_KEYS` from config-manager. If state is `"needs-upgrade"`, list missing keys. | **WARN** if missing keys (fix: run install again) |
  | `gitignore-entries` | `.gitignore` AI trace entries | Check for `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, `.opencode/` | **WARN** per missing entry (fix: `wunderkind gitignore`) |
  | `agents-built` | Generated agent `.md` files present | If `REPO_MODE`: check `agents/` dir for each filename in `EXPECTED_AGENT_FILES`; else PASS immediately | **WARN** if any missing (list missing names in verbose) |
  | `version-sync` | `package.json` vs `.claude-plugin/plugin.json` version | If `REPO_MODE`: read both with `readFileSync` + `JSON.parse` (NOT `createRequire`) and compare; else PASS immediately | **WARN** if mismatch |
  | `omo-config` | oh-my-opencode companion config present | If `REPO_MODE`: `existsSync("oh-my-opencode.jsonc")`; else PASS immediately | **WARN** if missing |

  Note: checks 8–10 (`agents-built`, `version-sync`, `omo-config`) use the shared `REPO_MODE` constant (defined above) as their guard. They PASS silently for normal end-user installs. Only surface as WARN when `REPO_MODE === true`.

  **Step 3 — Output format**:

  Default mode (no `--verbose`):
  ```
  ● Wunderkind Doctor

  ✓ System OK   — if zero issues across all checks
  ─ OR ─
  ⚠ N issue(s) found:

  1. <title>               [FAIL/WARN]
     <description>
     Fix: <fix>
  ```

  Verbose mode (`--verbose`):
  - Show all checks, including passing ones:
    ```
    ✓  Legacy config check         PASS
    ✓  OpenCode config             PASS
    ✗  Wunderkind config fields    WARN — missing: docsEnabled, docsPath, configVersion
       Fix: Run wunderkind install to add the missing fields
    ✓  .gitignore entries          PASS
    ...

    Summary: N passed, N warned, N failed
    ```
  - For each WARN/FAIL, also show the `detail` field if present.

  Use `picocolors` for colouring (already a dep — check `package.json`). Green `✓` for pass, yellow `⚠` for warn, red `✗` for fail.

  **Step 4 — Wire up in `src/cli/index.ts`**:
  ```typescript
  program
    .command("doctor")
    .description("Check wunderkind installation health and diagnose issues")
    .option("--verbose", "Show detailed diagnostic information for all checks")
    .action(async (opts) => {
      const { runDoctor } = await import("./doctor.js")
      const exitCode = await runDoctor({ verbose: opts.verbose ?? false })
      process.exit(exitCode)
    })
  ```

  **Step 5 — Run `tsc --noEmit` and `bun test`** — all existing tests must still pass.

  **Must NOT do**:
  - Do not add `--json` or `--status` flags (those are OMO-specific; keep wunderkind doctor simpler)
  - Do not add a fourth mode or aliases — just default and `--verbose`
  - Do not check `opencode` binary existence — wunderkind is a plugin; the binary check belongs to OMO doctor
  - Do not check OMO config files relating to OMO's own user installation — that's OMO's responsibility. Exception: Check 10 (`omo-config`) checks for `oh-my-opencode.jsonc` in the **wunderkind repo root** using the `REPO_MODE` guard — this is checking the wunderkind dev repo's own config file (used at build time), not a user's OMO installation config. This check is valid and must remain.
  - Do not use `Promise.all` — use `Promise.allSettled` so one crashed check doesn't mask others
  - Do not use index access (`results[i]`) on `allSettled` results — use `for...of` (`noUncheckedIndexedAccess` makes index access return `T | undefined`)
  - Do not use `createRequire` in `doctor.ts` — use `readFileSync` + `JSON.parse` consistent with the `config-manager` pattern
  - Do not inline `existsSync("src/build-agents.ts")` in each dev-mode check — use the shared `REPO_MODE` constant defined at the top of the file

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New file with 10 async checks, two output formatters, Commander wiring, imports from multiple modules
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 12 for `detectInstallState`, `KNOWN_CONFIG_KEYS`, `getConfigPath`, `WUNDERKIND_CONFIG`, `GLOBAL_WUNDERKIND_CONFIG` — all exported in Task 12)
  - **Parallel Group**: Wave 3 (alongside Tasks 6 and 7)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: Task 12 (all 5 exports must be available); also depends on Task 4 changes to `src/cli/index.ts` being merged first (Task 13 adds another Commander subcommand to the same file)

  **References**:

  **Pattern References**:
  - `src/cli/gitignore-manager.ts` — see how it checks for gitignore entries. The `gitignore-entries` doctor check reuses the same logic.
  - `src/cli/config-manager/index.ts:detectCurrentConfig()` — used by `plugin-registered` and `wk-config-file` checks.
  - `src/cli/config-manager/index.ts:detectInstallState()` + `KNOWN_CONFIG_KEYS` — used by `config-current` check (defined in Task 12).
  - `src/cli/index.ts` — look at how the `gitignore` subcommand is wired. The `doctor` subcommand follows the exact same pattern.
  - oh-my-opencode doctor reference (from research): `src/cli/doctor/runner.ts` — `Promise.all` for parallel check execution; each check returns a typed result; errors caught per-check. Follow this architectural pattern.
  - oh-my-opencode doctor reference: output format for default mode (show only issues) vs verbose mode (show all checks). Mirror this UX pattern with wunderkind-specific checks.

  **External References**:
  - oh-my-opencode `determineExitCode()`: exit 0 if all checks are pass/warn; exit 1 if any check is fail. Use exactly this rule.
  - oh-my-opencode `DoctorIssue`: `{ title, description, fix?, severity }`. Use the same shape.

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: doctor command appears in help
    Tool: Bash
    Preconditions: Task complete, tsc compiled
    Steps:
      1. Run: node bin/wunderkind.js --help
      2. Assert output contains "doctor"
      3. Run: node bin/wunderkind.js doctor --help
      4. Assert output contains "--verbose"
    Expected Result: doctor subcommand visible in help
    Evidence: .sisyphus/evidence/task-13-help.txt

  Scenario: doctor runs without crashing (exit code present)
    Tool: Bash
    Steps:
      1. Run: node bin/wunderkind.js doctor 2>&1; echo "EXIT:$?"
      2. Assert output contains "EXIT:" (process exits with a code, not unhandled exception)
      3. Assert output does NOT contain "TypeError" or "ReferenceError"
    Expected Result: Doctor runs to completion without crashing
    Evidence: .sisyphus/evidence/task-13-doctor-no-crash.txt

  Scenario: doctor exits 1 and shows FAIL when legacy config exists at project root
    Tool: Bash
    Steps:
      1. Run: echo '{}' > wunderkind.config.jsonc
      2. Run: node bin/wunderkind.js doctor 2>&1; echo "EXIT:$?"
      3. Assert output contains "Legacy config" or "wunderkind.config.jsonc"
      4. Assert output contains "EXIT:1"
      5. Cleanup: rm wunderkind.config.jsonc
    Expected Result: FAIL status and exit 1 when legacy config present at project root
    Evidence: .sisyphus/evidence/task-13-legacy-config-fail.txt

  Scenario: wk-config-parse check fires FAIL for invalid JSONC
    Tool: Bash
    Steps:
      1. Run: mkdir -p .wunderkind && echo '{invalid' > .wunderkind/wunderkind.config.jsonc
      2. Run: node bin/wunderkind.js doctor 2>&1; echo "EXIT:$?"
      3. Assert output contains "wk-config-parse" or "config" and "FAIL" or "✗"
      4. Assert output contains "EXIT:1"
      5. Cleanup: rm .wunderkind/wunderkind.config.jsonc
    Expected Result: FAIL status reported for unparseable config
    Evidence: .sisyphus/evidence/task-13-parse-fail.txt

  Scenario: --verbose shows all 10 checks including passing ones
    Tool: Bash
    Steps:
      1. Run: node bin/wunderkind.js doctor --verbose 2>&1 | grep -cE "^\s*(✓|✗|⚠)"
      2. Assert count equals 10 (one line per check)
      3. Run: node bin/wunderkind.js doctor --verbose 2>&1 | grep "Summary:"
      4. Assert "Summary:" line is present with counts
    Expected Result: Verbose output shows all 10 checks with summary line
    Evidence: .sisyphus/evidence/task-13-doctor-verbose.txt

  Scenario: tsc compiles clean
    Tool: Bash
    Steps:
      1. Run: tsc --noEmit
      2. Assert exit code 0
    Expected Result: No type errors in doctor.ts or index.ts
    Evidence: .sisyphus/evidence/task-13-tsc.txt
  ```

  **Commit**: YES (Commit 13)
  - Message: `feat(cli): add wunderkind doctor / doctor --verbose command`
  - Files: `src/cli/doctor.ts`, `src/cli/index.ts`
  - Pre-commit: `tsc --noEmit && bun test`

---

## Final Verification Wave

> All four review tasks run in PARALLEL after ALL implementation tasks are complete.
> ALL must APPROVE. Any REJECT → fix the identified files → re-run that reviewer.

- [ ] F1. **Plan Compliance Audit** — `oracle`

  **What to do**: Read this plan end-to-end. For each "Must Have" item, verify implementation exists by reading the relevant file or running the listed command. For each "Must NOT Have" guardrail, search the codebase for the forbidden pattern and REJECT with `file:line` if found. Check evidence files exist in `.sisyphus/evidence/`. Compare final deliverables against plan definition of done.

  **Must NOT do**:
  - Mark APPROVE without running every verification command below
  - Skip any "Must NOT Have" grep check

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave FINAL (with F2, F3)
  - **Blocked By**: Tasks 1–13 (all must complete first)

  **QA Scenarios (agent-executable)**:

  ```
  Scenario: Must Have — config-path bug fixed
    Tool: Bash
    Preconditions: tsc --noEmit exits 0; bun run build exits 0
    Steps:
      1. Run: grep -rn "wunderkind\.config\.jsonc" src/ | grep -v "\.wunderkind/"
      2. Assert: exit 0 with EMPTY output (no match means all refs include .wunderkind/)
    Expected Result: Zero unqualified config-path references in src/
    Failure Indicators: Any line printed — means a ref still missing .wunderkind/ prefix
    Evidence: .sisyphus/evidence/f1-config-path-check.txt

  Scenario: Must Have — docs fields in JSONC after non-interactive install
    Tool: Bash
    Preconditions: Clean project (no existing .wunderkind/); tsc --noEmit exits 0
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR --docs-enabled --docs-path=./docs --doc-history-mode=overwrite
      2. Run: grep -E "docsEnabled|docsPath|docHistoryMode|configVersion" .wunderkind/wunderkind.config.jsonc
      3. Assert: All 4 keys appear in output
      4. Cleanup: rm -rf .wunderkind/ opencode.json
    Expected Result: All 4 config keys written to .wunderkind/wunderkind.config.jsonc
    Failure Indicators: Any key missing from grep output
    Evidence: .sisyphus/evidence/f1-docs-fields.txt

  Scenario: Must Have — agents/*.md regenerated with Documentation Output section
    Tool: Bash
    Preconditions: bun run build exits 0
    Steps:
      1. Run: bun run build 2>&1; echo "BUILD_EXIT:$?"
      2. Assert: output contains "BUILD_EXIT:0"
      3. Run: grep -l "Documentation Output" agents/*.md
      4. Assert: at least 5 files listed (the eligible agents)
      5. Run: ls agents/*.md | wc -l
      6. Assert: 12 files (one per agent factory — 12 agents total)
    Expected Result: All 12 agent markdown files exist; eligible agents contain "Documentation Output" section
    Failure Indicators: BUILD_EXIT non-zero; fewer than 5 agents contain the section
    Evidence: .sisyphus/evidence/f1-agents-md.txt

  Scenario: Must Have — doctor subcommand registered
    Tool: Bash
    Preconditions: tsc --noEmit exits 0
    Steps:
      1. Run: node bin/wunderkind.js --help 2>&1 | grep doctor
      2. Assert: output contains "doctor"
    Expected Result: doctor subcommand visible in help
    Failure Indicators: No output from grep — doctor not registered
    Evidence: .sisyphus/evidence/f1-doctor-registered.txt

  Scenario: Must NOT Have — no as-any or ts-suppress in src/
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: grep -rn "as any\|@ts-ignore\|@ts-expect-error" src/
      2. Assert: EMPTY output (exit 0 with no lines)
    Expected Result: Zero suppressions in source
    Failure Indicators: Any line printed — report file:line and REJECT
    Evidence: .sisyphus/evidence/f1-no-suppressions.txt

  Scenario: Must NOT Have — docs/ not added to .gitignore
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: grep "^docs/" .gitignore 2>/dev/null; echo "EXIT:$?"
      2. Assert: NO line matching "docs/" appears (grep exits 1 = not found = good)
    Expected Result: docs/ absent from .gitignore
    Failure Indicators: A "docs/" line appears in .gitignore — REJECT
    Evidence: .sisyphus/evidence/f1-no-docs-gitignore.txt
  ```

  **Output**: `Must Have [N/N] | Must NOT Have [N/N] | Evidence [N files] | VERDICT: APPROVE/REJECT`

---

- [ ] F2. **Code Quality Review** — `unspecified-high`

  **What to do**: Run the full build + test suite. Review every `.ts` file touched by Tasks 1–13 for TypeScript hygiene, forbidden patterns, and AI-slop indicators. Check `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` compliance. Report each issue with file and line number.

  **Must NOT do**:
  - Mark APPROVE if `tsc --noEmit` exits non-zero
  - Mark APPROVE if `bun test` has any failures
  - Skip files that were only "lightly touched"

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave FINAL (with F1, F3)
  - **Blocked By**: Tasks 1–13 (all must complete first)

  **QA Scenarios (agent-executable)**:

  ```
  Scenario: TypeScript build clean
    Tool: Bash
    Preconditions: All source files written
    Steps:
      1. Run: tsc --noEmit 2>&1; echo "TSC_EXIT:$?"
      2. Assert: output ends with "TSC_EXIT:0" and no error lines before it
    Expected Result: Zero type errors across entire src/
    Failure Indicators: Any "error TS" line — report each with file:line and REJECT
    Evidence: .sisyphus/evidence/f2-tsc.txt

  Scenario: Test suite green
    Tool: Bash
    Preconditions: tsc --noEmit exits 0
    Steps:
      1. Run: bun test 2>&1; echo "TEST_EXIT:$?"
      2. Assert: output ends with "TEST_EXIT:0"
      3. Assert: output contains "pass" and does NOT contain "fail" (case-insensitive)
    Expected Result: All tests pass, zero failures
    Failure Indicators: Any "fail" in output, or TEST_EXIT non-zero
    Evidence: .sisyphus/evidence/f2-bun-test.txt

  Scenario: No forbidden patterns in new/modified source files
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: grep -rn "as any\|@ts-ignore\|@ts-expect-error\|console\.log" src/ --include="*.ts" | grep -v "tests/"
      2. Assert: EMPTY output
      3. Run: grep -rn "catch\s*(.*)\s*{[[:space:]]*}" src/ --include="*.ts"
      4. Assert: EMPTY output (no empty catch blocks)
    Expected Result: Zero suppressions, zero empty catch blocks in non-test source
    Failure Indicators: Any line printed — report file:line and REJECT
    Evidence: .sisyphus/evidence/f2-no-forbidden.txt

  Scenario: No AI-slop naming patterns in new files
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: grep -n "\bconst data\b\|\bconst result\b\|\bconst item\b\|\bconst temp\b" src/agents/docs-config.ts src/cli/doctor.ts 2>/dev/null
      2. Assert: EMPTY output
    Expected Result: No generic variable names in newly created files
    Failure Indicators: Any match — report and note as code quality issue
    Evidence: .sisyphus/evidence/f2-no-slop.txt

  Scenario: exactOptionalPropertyTypes compliance in config-manager
    Tool: Bash
    Preconditions: tsc --noEmit exits 0 (already checked above)
    Steps:
      1. Run: grep -n "= undefined" src/cli/config-manager/index.ts src/cli/types.ts 2>/dev/null
      2. Assert: EMPTY output (no explicit undefined assignment to optional fields)
    Expected Result: No explicit undefined assignments (exactOptionalPropertyTypes compliant)
    Failure Indicators: Any "= undefined" line in those files
    Evidence: .sisyphus/evidence/f2-optional-types.txt
  ```

  **Output**: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT: APPROVE/REJECT`

---

- [ ] F3. **Full QA Sweep** — `deep`

  **What to do**: Execute ALL QA scenarios from ALL tasks (Tasks 1–13) in sequence from a clean state. Then verify cross-task integration. Save evidence for every scenario. This is the final gate before the plan is declared complete.

  **Must NOT do**:
  - Skip any scenario from any task (even if it seems redundant)
  - Mark APPROVE without creating evidence files in `.sisyphus/evidence/final-qa/`
  - Proceed past a blocking failure without noting it

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave FINAL (with F1, F2)
  - **Blocked By**: Tasks 1–13 (all must complete first)

  **QA Scenarios (agent-executable)**:

  ```
  Scenario: Non-interactive install writes all expected config fields
    Tool: Bash
    Preconditions: tsc --noEmit exits 0; bun run build exits 0; no existing .wunderkind/ in cwd
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR --docs-enabled --docs-path=./docs --doc-history-mode=overwrite 2>&1; echo "INSTALL_EXIT:$?"
      2. Assert: INSTALL_EXIT:0
      3. Run: cat .wunderkind/wunderkind.config.jsonc
      4. Assert: output contains "docsEnabled", "docsPath", "docHistoryMode", "configVersion"
      5. Assert: "docsEnabled" value is true (not false or string)
      6. Assert: "docsPath" value is "./docs"
      7. Cleanup: rm -rf .wunderkind/ opencode.json
    Expected Result: All 4 new config fields present with correct values
    Failure Indicators: Any key missing; INSTALL_EXIT non-zero; wrong values
    Evidence: .sisyphus/evidence/final-qa/f3-install-with-docs.txt

  Scenario: Non-interactive install without docs flags writes docsEnabled=false
    Tool: Bash
    Preconditions: tsc --noEmit exits 0; no existing .wunderkind/ in cwd
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR 2>&1; echo "INSTALL_EXIT:$?"
      2. Assert: INSTALL_EXIT:0
      3. Run: grep "docsEnabled" .wunderkind/wunderkind.config.jsonc
      4. Assert: output contains "false" (docsEnabled defaults to false)
      5. Cleanup: rm -rf .wunderkind/ opencode.json
    Expected Result: docsEnabled defaults to false when no --docs-enabled flag provided
    Failure Indicators: docsEnabled not present; or value is true
    Evidence: .sisyphus/evidence/final-qa/f3-install-no-docs.txt

  Scenario: Install help shows all 3 new flags
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: node bin/wunderkind.js install --help 2>&1
      2. Assert: output contains "--docs-enabled"
      3. Assert: output contains "--docs-path"
      4. Assert: output contains "--doc-history-mode"
    Expected Result: All 3 docs-related flags visible in install help
    Failure Indicators: Any flag missing from help output
    Evidence: .sisyphus/evidence/final-qa/f3-install-help-flags.txt

  Scenario: Build regenerates agents/*.md with Documentation Output sections
    Tool: Bash
    Preconditions: All agent factory src/agents/*.ts files have been modified
    Steps:
      1. Run: bun run build 2>&1; echo "BUILD_EXIT:$?"
      2. Assert: BUILD_EXIT:0
      3. Run: grep -l "Documentation Output" agents/*.md | wc -l
      4. Assert: count is >= 5 (at least 5 eligible agents)
      5. Run: grep -c "Documentation Output" agents/ciso*.md agents/qa-specialist*.md agents/fullstack*.md agents/operations*.md agents/product*.md 2>/dev/null | grep -v ":0" | wc -l
      6. Assert: all 5 core eligible agents contain the section (count >= 5)
    Expected Result: Eligible agents contain "Documentation Output" section in generated markdown
    Failure Indicators: BUILD_EXIT non-zero; fewer than 5 eligible agents have the section
    Evidence: .sisyphus/evidence/final-qa/f3-agents-md-sections.txt

  Scenario: docs/ directory created by installer when docsEnabled=true
    Tool: Bash
    Preconditions: tsc --noEmit exits 0
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR --docs-enabled 2>&1; echo "INSTALL_EXIT:$?"
      2. Assert: INSTALL_EXIT:0
      3. Run: ls docs/README.md 2>&1; echo "LS_EXIT:$?"
      4. Assert: LS_EXIT:0 (docs/README.md exists)
      5. Run: cat docs/README.md
      6. Assert: output is non-empty and contains agent name(s) or "Documentation"
      7. Cleanup: rm -rf .wunderkind/ opencode.json docs/
    Expected Result: docs/ and docs/README.md created with non-empty index content
    Failure Indicators: LS_EXIT non-zero; README.md empty
    Evidence: .sisyphus/evidence/final-qa/f3-docs-dir-created.txt

  Scenario: All 13 config-path references use .wunderkind/ prefix
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: grep -rn "wunderkind\.config\.jsonc" src/ | grep -v "\.wunderkind/"
      2. Assert: EMPTY output (no unqualified references)
      3. Run: grep -rn "\.wunderkind/wunderkind\.config\.jsonc" src/ | wc -l
      4. Assert: count >= 13 (all references include prefix)
    Expected Result: Zero unqualified config-path references; at least 13 qualified ones
    Failure Indicators: Any line from step 1; count < 13 in step 3
    Evidence: .sisyphus/evidence/final-qa/f3-config-path-refs.txt

  Scenario: Personality gate confirm prompt appears before personality selects
    Tool: Bash
    Preconditions: none
    Steps:
      1. Run: grep -n "Customise agent personalities\|customise.*personalities\|customize.*personalities" src/cli/tui-installer.ts
      2. Assert: at least one match — capture the line number (LINE_A)
      3. Run: grep -n "Agent Personality Overrides\|cisoPersonality\|ctoPersonality" src/cli/tui-installer.ts | head -1
      4. Assert: at least one match — capture the line number (LINE_B)
      5. Assert: LINE_A < LINE_B (gate prompt appears before personality selects)
    Expected Result: Personality gate confirm appears earlier in the file than personality select prompts
    Failure Indicators: No match for gate prompt; LINE_A >= LINE_B
    Evidence: .sisyphus/evidence/final-qa/f3-personality-gate.txt

  Scenario: configVersion written after fresh install
    Tool: Bash
    Preconditions: tsc --noEmit exits 0; no existing .wunderkind/
    Steps:
      1. Run: node bin/wunderkind.js install --no-tui --scope=project --region=EU --industry=SaaS --primary-regulation=GDPR 2>&1; echo "INSTALL_EXIT:$?"
      2. Assert: INSTALL_EXIT:0
      3. Run: grep "configVersion" .wunderkind/wunderkind.config.jsonc
      4. Assert: output contains "configVersion" with a non-empty string value
      5. Cleanup: rm -rf .wunderkind/ opencode.json
    Expected Result: configVersion field present in written config
    Failure Indicators: configVersion missing from output
    Evidence: .sisyphus/evidence/final-qa/f3-config-version.txt

  Scenario: KNOWN_CONFIG_KEYS exported with correct length
    Tool: Bash
    Preconditions: tsc --noEmit exits 0; bun run build exits 0 (dist/ exists)
    Steps:
      1. Run: bun -e "import { KNOWN_CONFIG_KEYS } from './dist/cli/config-manager/index.js'; console.log(KNOWN_CONFIG_KEYS.length)" 2>&1
      2. Assert: output is "22"
    Expected Result: KNOWN_CONFIG_KEYS array has exactly 22 entries
    Failure Indicators: Output is not "22"; import error
    Evidence: .sisyphus/evidence/final-qa/f3-known-config-keys.txt

  Scenario: doctor subcommand visible in CLI help
    Tool: Bash
    Preconditions: tsc --noEmit exits 0
    Steps:
      1. Run: node bin/wunderkind.js --help 2>&1 | grep doctor
      2. Assert: output contains "doctor"
    Expected Result: doctor visible in top-level help output
    Failure Indicators: No output from grep
    Evidence: .sisyphus/evidence/final-qa/f3-doctor-help.txt

  Scenario: doctor exits 1 on legacy config at project root
    Tool: Bash
    Preconditions: tsc --noEmit exits 0; no .wunderkind/ in cwd
    Steps:
      1. Run: echo '{}' > wunderkind.config.jsonc
      2. Run: node bin/wunderkind.js doctor 2>&1; echo "EXIT:$?"
      3. Assert: output contains "EXIT:1"
      4. Assert: output contains "wunderkind.config.jsonc" or "Legacy" or "FAIL"
      5. Cleanup: rm wunderkind.config.jsonc
    Expected Result: doctor reports FAIL and exits 1 when legacy config at root
    Failure Indicators: EXIT:0; no FAIL/legacy message
    Evidence: .sisyphus/evidence/final-qa/f3-doctor-legacy-config.txt

  Scenario: doctor --verbose shows exactly 10 check lines
    Tool: Bash
    Preconditions: tsc --noEmit exits 0
    Steps:
      1. Run: node bin/wunderkind.js doctor --verbose 2>&1 | grep -cE "^\s*(✓|✗|⚠)"; echo "GREP_EXIT:$?"
      2. Assert: count output is "10"
      3. Run: node bin/wunderkind.js doctor --verbose 2>&1 | grep "Summary:"
      4. Assert: output contains "Summary:" line
    Expected Result: Verbose output has 10 status-prefixed check lines and a Summary line
    Failure Indicators: Count != 10; no Summary line
    Evidence: .sisyphus/evidence/final-qa/f3-doctor-verbose.txt
  ```

  **Output**: `Scenarios [N/N pass] | Integration [N/N] | VERDICT: APPROVE/REJECT`

---

## Commit Strategy

- **Commit 1** (Task 1): `fix(agents): correct wunderkind config path to .wunderkind/ in all 13 locations`
  - Files: `src/index.ts`, all 12 `src/agents/*.ts`
  - Pre-commit: `tsc --noEmit && bun test`

- **Commit 2+3 (bundled)** (Tasks 2 + 3): `feat(types,config-manager): add docs config fields and readWunderkindConfig()`
  - Files: `src/cli/types.ts`, `src/cli/config-manager/index.ts`
  - Pre-commit: `tsc --noEmit && bun test`
  - Note: Task 2 (`types.ts`) must NOT be committed standalone — adding required fields to `InstallConfig` immediately breaks downstream consumers. Bundle with Task 3 which satisfies the new type requirements.

- **Commit 3** (superseded — see Commit 2+3 above)

- **Commit 4** (Task 4): `feat(cli): add --docs-enabled, --docs-path, --doc-history-mode flags`
  - Files: `src/cli/index.ts`, `src/cli/cli-installer.ts`
  - Pre-commit: `tsc --noEmit && bun test tests/unit/cli-installer.test.ts`

- **Commit 5** (Task 5): `feat(tui): add docs prompts after personality section`
  - Files: `src/cli/tui-installer.ts`
  - Pre-commit: `tsc --noEmit`

- **Commit 6** (Task 6): `feat(agents): add docs-config.ts canonical filename map + buildDocsInstruction()`
  - Files: `src/agents/docs-config.ts`, `tests/unit/docs-config.test.ts`
  - Pre-commit: `tsc --noEmit && bun test tests/unit/docs-config.test.ts`

- **Commit 7** (Task 7): `feat(index): inject Documentation Output section from runtime wunderkind config`
  - Files: `src/index.ts`, `tests/unit/docs-injection.test.ts`
  - Pre-commit: `tsc --noEmit && bun test tests/unit/docs-injection.test.ts`

- **Commit 8** (Task 8): `feat(agents): add Documentation Output section to all eligible agent factories`
  - Files: `src/agents/*.ts` (eligible after audit), `tests/unit/agent-factories.test.ts`
  - Pre-commit: `tsc --noEmit && bun test && bun run build`

- **Commit 9** (Task 9): `feat(installer): pre-create docs/ and docs/README.md when docsEnabled=true`
  - Files: `src/cli/tui-installer.ts`, `src/cli/cli-installer.ts`
  - Pre-commit: `tsc --noEmit && bun test`

- **Commit 10** (Task 10): `chore: bump to v0.6.0, update README and AGENTS.md for docs feature`
  - Files: `package.json`, `.claude-plugin/plugin.json`, `README.md`, `src/agents/AGENTS.md`, `src/cli/AGENTS.md`
  - Pre-commit: `tsc --noEmit && bun run build`

- **Commit 11** (Task 11): `feat(tui): add personality customisation gate with sane defaults`
  - Files: `src/cli/tui-installer.ts`
  - Pre-commit: `tsc --noEmit`
  - Note: Apply AFTER Task 5 (also modifies `tui-installer.ts`) — same-file sequential ordering required

- **Commit 12** (Task 12): `feat(config-manager): add configVersion field and upgrade detection`
  - Files: `src/cli/types.ts`, `src/cli/config-manager/index.ts`, `src/cli/tui-installer.ts`, `src/cli/tui-installer.ts`, `src/cli/cli-installer.ts`, `tests/unit/cli-installer.test.ts`
  - Pre-commit: `tsc --noEmit && bun test`
  - Note: Task 12 Step 4 (`tui-installer.ts` warnings) must be applied AFTER Tasks 5 and 11; Steps 1–3 (`types.ts`, `config-manager/index.ts`) can run earlier. Exports `getConfigPath`, `WUNDERKIND_CONFIG`, `GLOBAL_WUNDERKIND_CONFIG` as a side effect — Task 13 depends on these.

- **Commit 13** (Task 13): `feat(cli): add wunderkind doctor / doctor --verbose command`
  - Files: `src/cli/doctor.ts` (new file), `src/cli/index.ts`
  - Pre-commit: `tsc --noEmit && bun test`
  - Note: Applied on top of all Wave 2 commits; `src/cli/index.ts` diff must be conflict-free with Task 4's flag additions

---

## Success Criteria

### Verification Commands
```bash
tsc --noEmit                    # Expected: exit 0
bun test                        # Expected: all pass
bun run build                   # Expected: exit 0, agents/*.md regenerated

node bin/wunderkind.js install --help
# Expected: output contains --docs-enabled, --docs-path, --doc-history-mode

node bin/wunderkind.js install --no-tui --scope=project \
  --region=EU --industry=SaaS --primary-regulation=GDPR \
  --docs-enabled --docs-path=./docs --doc-history-mode=overwrite && \
  grep -E "docsEnabled|docsPath|docHistoryMode" .wunderkind/wunderkind.config.jsonc
# Expected: all 3 keys present with correct values

grep configVersion .wunderkind/wunderkind.config.jsonc
# Expected: configVersion field present

grep -r "wunderkind\.config\.jsonc" src/ | grep -v ".wunderkind/"
# Expected: no output (all references now include .wunderkind/ prefix)

grep -r "Documentation Output" agents/
# Expected: output for all eligible agents

node bin/wunderkind.js --help | grep doctor
# Expected: doctor subcommand listed

node bin/wunderkind.js doctor --help | grep verbose
# Expected: --verbose flag listed

echo '{}' > wunderkind.config.jsonc && node bin/wunderkind.js doctor 2>&1; echo "EXIT:$?"; rm wunderkind.config.jsonc
# Expected: output contains "Legacy config" and "EXIT:1"

node bin/wunderkind.js doctor --verbose 2>&1 | grep -c "✓\|✗\|⚠"
# Expected: 10 (one line per check)
```

### Final Checklist
- [ ] All "Must Have" items implemented and verified
- [ ] All "Must NOT Have" guardrails confirmed absent
- [ ] `tsc --noEmit` exits 0
- [ ] `bun test` exits 0
- [ ] `bun run build` exits 0, `agents/*.md` regenerated
- [ ] `package.json` and `.claude-plugin/plugin.json` both show v0.6.0
- [ ] Config-path bug fixed in all 13 locations
- [ ] Personality gate `p.confirm` present before `p.log.step("Agent Personality Overrides")`
- [ ] All 12 personality `*Raw` variables declared as `let` in outer scope with explicit type
- [ ] `configVersion` field present in all written JSONC configs
- [ ] `KNOWN_CONFIG_KEYS` exported, length === 22
- [ ] `getConfigPath`, `WUNDERKIND_CONFIG`, `GLOBAL_WUNDERKIND_CONFIG` exported from config-manager
- [ ] `wunderkind doctor` subcommand registered and visible in `--help`
- [ ] Doctor legacy-config check fires FAIL + exits 1 when `wunderkind.config.jsonc` exists at project root
- [ ] Doctor verbose mode shows all 10 checks with summary line
