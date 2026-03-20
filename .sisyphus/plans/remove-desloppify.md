# Remove Desloppify And Replace Code-Health Safely

## TL;DR
> **Summary**: Remove Desloppify from Wunderkind's runtime, CLI, config, docs, and uninstall contract, while preserving `code-health` as a safer audit-only skill inspired by Matt Pocock's architecture-review workflow.
> **Deliverables**:
> - Remove all Desloppify runtime/config/CLI/gitignore surfaces
> - Fix the global uninstall `ERR_FS_EISDIR` failure for `~/.wunderkind`
> - Redesign `skills/code-health/SKILL.md` into a filesystem-first audit/report skill with severity-ranked findings
> - Update schema, tests, README, and `AGENTS.md` to the new contract, including explicit breaking-change notes and a refreshed current commands/skills/docs snapshot
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 4 -> Task 5 -> Final Verification Wave

## Context
### Original Request
Remove Desloppify because it produces poor results and can break a codebase, investigate the uninstall failure seen on macOS, and keep the plan file name as `remove-desloppify.md` while exploring a safer replacement direction for `code-health` using Matt Pocock's `improve-codebase-architecture` skill as inspiration.

### Interview Summary
- The user wants Desloppify gone from the shipped product surface.
- The user also wants the uninstall failure investigated and fixed.
- `code-health` should not necessarily be deleted; if a safer replacement exists, it should become an audit/reporting skill rather than an auto-cleanup tool.
- The replacement skill should emit a detailed code-health audit with severities `critical/high/medium/low/informational`, target zero critical/high findings, and allow medium-or-lower findings to be explained or deferred.
- This repo can absorb breaking changes because no users are currently on this version; the shipped docs should say where the breaking changes land and when they start applying.
- Defaults applied: silently ignore stale `desloppifyEnabled` keys in existing configs; remove `.desloppify/` from managed gitignore entries; keep `code-health` owned by `fullstack-wunderkind`; emit the audit report as structured markdown in the skill response rather than writing to a fixed file path.

### Metis Review (gaps addressed)
- Guardrail: do not assume `code-health` exists in `src/agents/`; repo scan shows no `code-health` or Desloppify references under `src/agents/`.
- Guardrail: `src/cli/config-manager/index.ts:600` has comma/rendering logic coupled to `desloppifyEnabled`; source cleanup must preserve valid JSONC output.
- Guardrail: uninstall root cause sits in `removeGlobalWunderkindConfig()` and needs both source and test coverage, not just a one-line fix.
- Guardrail: the replacement `code-health` skill must be audit-only; no RFC generation, no interface design, no automatic code modifications.

## Work Objectives
### Core Objective
Eliminate Desloppify from Wunderkind's product contract while retaining a safer `code-health` capability that produces evidence-based audit reports instead of automated cleanup.

### Deliverables
- Source cleanup in `src/index.ts`, `src/cli/index.ts`, `src/cli/init.ts`, `src/cli/cli-installer.ts`, `src/cli/tui-installer.ts`, `src/cli/doctor.ts`, `src/cli/types.ts`, `src/cli/config-manager/index.ts`, and `src/cli/gitignore-manager.ts`
- Uninstall fix in `src/cli/config-manager/index.ts`; touch `src/cli/uninstall.ts` only if the orchestrating flow proves to require it during implementation
- Schema cleanup in `schemas/wunderkind.config.schema.json`
- Rewritten `skills/code-health/SKILL.md` as an audit/report skill
- Inventory/docs cleanup in `skills/SKILL-STANDARD.md`, `README.md`, and `AGENTS.md`
- README refresh that calls out the breaking-change release surface (CLI flags, config keys, gitignore behavior, docs wording, and code-health behavior) and refreshes current commands, skills, and lifecycle guidance where stale
- Updated tests covering the removed Desloppify contract and the uninstall edge case

### Definition of Done (verifiable conditions with commands)
- `tsc --noEmit` exits 0
- `bun test tests/unit/` exits 0
- `bun run build` exits 0
- `node bin/wunderkind.js init --help` does not contain `--desloppify-enabled`
- `node bin/wunderkind.js gitignore --help` does not contain `.desloppify`
- `node bin/wunderkind.js doctor --verbose` does not contain `desloppifyEnabled` or Desloppify fallback messaging
- Running `bunx @grant-vine/wunderkind uninstall` equivalent logic in tests no longer throws `ERR_FS_EISDIR` when `~/.wunderkind/` exists as an empty directory
- `grep -r "desloppify\|Desloppify\|desloppifyEnabled" src/ schemas/ tests/ README.md AGENTS.md agents/` returns no matches after `bun run build`
- `skills/code-health/SKILL.md` remains present and describes only audit/reporting behavior with severity taxonomy and no auto-cleanup/install workflow
- `README.md` explicitly notes the breaking changes in this version and where users will encounter them (CLI/init, config, docs/gitignore, and code-health contract)

### Must Have
- No `desloppifyEnabled` field in runtime types, config parsing, config rendering, schema, or doctor output
- No `.desloppify/` entry in gitignore handling or docs
- No `--desloppify-enabled` CLI flag or help text
- No Desloppify system prompt injection in `src/index.ts`
- `skills/code-health/SKILL.md` preserved as an audit/reporting skill with explicit severity levels and report output
- Uninstall logic safely removes `~/.wunderkind` without `ERR_FS_EISDIR`
- Existing configs containing stale `desloppifyEnabled` are tolerated silently; no migration warning, no doctor warning, no compatibility shim
- `README.md` clearly documents that this version intentionally introduces breaking changes and enumerates the affected surfaces users would notice when upgrading

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT replace Desloppify with another auto-fix or auto-refactor engine
- Must NOT keep the current Python/Desloppify install path anywhere in docs, prompts, config, or skills
- Must NOT add deprecation shims or dual-mode behavior; the runtime contract after implementation is Desloppify-free
- Must NOT touch `.sisyphus/` or treat it as removable AI trace state
- Must NOT introduce GitHub RFC creation, issue creation, or interactive “choose one architecture option” flow into `code-health`
- Must NOT edit generated `agents/*.md` directly
- Must NOT describe the breaking changes as future or hypothetical once the implementation lands; document them as the current contract of this version

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after using TypeScript typecheck, Bun unit tests, CLI smoke tests, and grep-based contract audit
- QA policy: Every task includes binary acceptance criteria and concrete QA scenarios; integrated build/help/doctor tests happen only after all source surfaces are updated
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Task 1 source/config/runtime contract removal; Task 3 code-health skill redesign

Wave 2: Task 2 uninstall failure fix and tests; Task 4 docs and inventory cleanup

Wave 2 guardrail: Task 4 may run in parallel with Task 2, but only after both Wave 1 tasks (1 and 3) are complete and verified.

Wave 3: Task 5 unit test alignment and integrated verification

### Dependency Matrix (full, all tasks)
| Task | Depends On | Notes |
|---|---|---|
| 1 | none | Removes core Desloppify source/runtime/config contract |
| 2 | none | Uninstall bug is independent of Desloppify runtime removal |
| 3 | none | Skill redesign is independent of runtime source cleanup |
| 4 | 1, 3 | Docs/inventory must reflect both the removed Desloppify contract and the new code-health contract |
| 5 | 1, 2, 3, 4 | Tests and integrated verification only after all surfaced contracts are settled |
| F1-F4 | 1-5 | Final review after implementation and verification only |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 -> 2 tasks -> `unspecified-high`, `writing`
- Wave 2 -> 2 tasks -> `unspecified-high`, `writing`
- Wave 3 -> 1 task -> `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Remove Desloppify from source, CLI, config, schema, gitignore, and runtime prompt surfaces

  **What to do**: Edit `src/cli/types.ts`, `src/cli/config-manager/index.ts`, `src/cli/index.ts`, `src/cli/init.ts`, `src/cli/cli-installer.ts`, `src/cli/tui-installer.ts`, `src/cli/doctor.ts`, `src/cli/gitignore-manager.ts`, `src/index.ts`, and `schemas/wunderkind.config.schema.json` to remove all Desloppify runtime/config/CLI/schema behavior. This task owns the complete source-level contract removal, so no dependent source files remain broken after it finishes. Preserve silent tolerance for stale `desloppifyEnabled` keys in existing on-disk JSONC by dropping the key during parsing with no warning, no doctor output, and no runtime assignment. In `src/cli/config-manager/index.ts`, rewrite the `prdPipelineMode` render line so it is a bare unconditional final property line with no trailing comma, then delete the entire `desloppifyEnabled` render block. In `src/cli/index.ts`, rely on the CLI's existing unknown-option rejection after the option is removed and verify that `init` exits non-zero when `--desloppify-enabled=yes` is passed.
  **Must NOT do**: Do not modify uninstall logic here; that is Task 2. Do not edit docs or tests here except where an inline source fixture absolutely blocks compilation.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-cutting strict-TypeScript and CLI/runtime cleanup
  - Skills: `[]` — No extra skill required
  - Omitted: `['writing']` — This is source contract work, not prose drafting

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: none

  **References**:
  - Pattern: `src/index.ts:107` — Desloppify-enabled system prompt branch starts here
  - Pattern: `src/index.ts:115` — Desloppify-disabled fallback branch starts here
  - Pattern: `src/cli/index.ts:157` — gitignore description still mentions `.desloppify/`
  - Pattern: `src/cli/index.ts:206` — `--desloppify-enabled` option registration
  - Pattern: `src/cli/index.ts:243` — flag parsing block
  - Pattern: `src/cli/init.ts:336` — interactive Desloppify enable prompt
  - Pattern: `src/cli/cli-installer.ts:146` — installer still propagates `detected.desloppifyEnabled`
  - Pattern: `src/cli/cli-installer.ts:280` — installer still conditionally deletes `configForWrite.desloppifyEnabled`
  - Pattern: `src/cli/tui-installer.ts:207` — TUI installer still propagates the field
  - Pattern: `src/cli/doctor.ts:239` — verbose doctor still reports `desloppifyEnabled`
  - Pattern: `src/cli/gitignore-manager.ts:9` — managed `.desloppify/` entry
  - Pattern: `src/cli/types.ts:36` — `ProjectConfig` still contains the field
  - Pattern: `src/cli/types.ts:93` — `DetectedConfig` still contains the field
  - Pattern: `src/cli/init.ts:28` — `InitOptions` still declares `desloppifyEnabled`
  - Pattern: `src/cli/config-manager/index.ts:69` — key allow-list still includes `desloppifyEnabled`
  - Pattern: `src/cli/config-manager/index.ts:424` — parser still assigns `desloppifyEnabled`
  - Pattern: `src/cli/config-manager/index.ts:600` — JSONC rendering comma logic tied to removed field
  - Pattern: `src/cli/config-manager/index.ts:669` — detected defaults still set `desloppifyEnabled: false`
  - Pattern: `src/cli/config-manager/index.ts:713` — merged detected config still resolves the field
  - Pattern: `schemas/wunderkind.config.schema.json:42` — schema still declares `desloppifyEnabled`

  **Acceptance Criteria**:
  - [x] No source file listed above contains `desloppify`, `Desloppify`, or `desloppifyEnabled`
  - [x] `src/cli/config-manager/index.ts` still renders valid JSONC after field removal
  - [x] Existing config files that still contain `desloppifyEnabled` are parsed without throwing, warning, or surfacing the field in detected config output
  - [x] `node bin/wunderkind.js init --desloppify-enabled=yes` exits non-zero because the removed flag is rejected as unknown/unsupported
  - [x] `tsc --noEmit` exits 0 after this task completes

  **QA Scenarios**:
  ```text
  Scenario: Source contract is fully purged
    Tool: Bash
    Steps: Run `grep -n "desloppify\|Desloppify\|desloppifyEnabled" src/index.ts src/cli/index.ts src/cli/init.ts src/cli/cli-installer.ts src/cli/tui-installer.ts src/cli/doctor.ts src/cli/gitignore-manager.ts src/cli/types.ts src/cli/config-manager/index.ts schemas/wunderkind.config.schema.json`
    Expected: No matches in any listed file
    Evidence: .sisyphus/evidence/task-1-source-purge.txt

  Scenario: Source cleanup leaves the repo type-safe
    Tool: Bash
    Steps: Run `tsc --noEmit`
    Expected: Command exits 0
    Evidence: .sisyphus/evidence/task-1-typecheck.txt

  Scenario: Config writer still emits parseable JSONC after field removal
    Tool: Bash
    Steps: Run the targeted config-template/config-manager unit coverage that writes Wunderkind config, then re-read that generated config through the repo's existing config-reader path to prove the emitted JSONC still parses cleanly after removing `desloppifyEnabled`
    Expected: The generated config round-trips without syntax errors and does not reintroduce `desloppifyEnabled`
    Evidence: .sisyphus/evidence/task-1-config-roundtrip.txt

  Scenario: Existing stale config key is silently tolerated on read
    Tool: Bash
    Steps: Run the targeted config-manager/config-template unit coverage that reads a JSONC config fixture containing `desloppifyEnabled: true`
    Expected: The config parses successfully, emits no warning, and returns detected/project config without surfacing `desloppifyEnabled`
    Evidence: .sisyphus/evidence/task-1-stale-key-read.txt

  Scenario: Removed init flag is actively rejected
    Tool: Bash
    Steps: Run `node bin/wunderkind.js init --desloppify-enabled=yes`
    Expected: Command exits non-zero because the flag is unknown/unsupported after removal
    Evidence: .sisyphus/evidence/task-1-unknown-flag.txt
  ```

  **Commit**: YES | Message: `refactor(cli): remove desloppify product surfaces` | Files: `src/index.ts`, `src/cli/*.ts`, `schemas/wunderkind.config.schema.json`

- [x] 2. Fix global uninstall directory removal and add regression coverage for `ERR_FS_EISDIR`

  **What to do**: Fix the confirmed global uninstall root cause in `src/cli/config-manager/index.ts` so removing `~/.wunderkind` cannot throw `ERR_FS_EISDIR` after the config file is deleted. Keep the existing empty-directory guard, but change the final directory removal call on `GLOBAL_WUNDERKIND_DIR` to the explicit cross-platform-safe form `{ recursive: true, force: true }` rather than `{ recursive: false, force: true }`. Do not add a new abstraction or alternate deletion flow. Touch `src/cli/uninstall.ts` only if implementation proves the orchestrating flow needs adjustment. Add or extend unit tests in `tests/unit/uninstall.test.ts` to cover empty-directory removal and the macOS-style directory case.
  **Must NOT do**: Do not broaden uninstall scope to remove project-local bootstrap artifacts; preserve the existing uninstall contract aside from fixing the directory-removal bug. Do not remove a non-empty `~/.wunderkind` directory without first proving it is empty via the current guard.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: filesystem edge-case bugfix with test coverage
  - Skills: `[]` — No extra skill required
  - Omitted: `['writing']` — Source and test bugfix, not prose work

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: none

  **References**:
  - Pattern: `src/cli/uninstall.ts` — uninstall entry point orchestrates global removal flow
  - Pattern: `src/cli/config-manager/index.ts:1026` — `removeGlobalWunderkindConfig()` owns the failing directory cleanup
  - Pattern: `src/cli/config-manager/index.ts:1034` — current directory-removal call is the confirmed `EISDIR` source; preserve the preceding emptiness guard
  - Test: `tests/unit/uninstall.test.ts` — uninstall tests exist but do not currently cover this directory edge case
  - User report: `bunx @grant-vine/wunderkind@latest uninstall` succeeded on plugin/native asset removal but failed on `rm` against `/Users/grantv/.wunderkind`

  **Acceptance Criteria**:
  - [x] Global uninstall helper uses the current emptiness guard plus `rmSync(GLOBAL_WUNDERKIND_DIR, { recursive: true, force: true })` so an existing empty `~/.wunderkind` directory no longer throws `ERR_FS_EISDIR`
  - [x] Unit tests cover the fixed global config-directory removal behavior
  - [x] Existing uninstall behavior for plugin registration and native assets remains unchanged

  **QA Scenarios**:
  ```text
  Scenario: Uninstall regression test covers the directory-removal bug
    Tool: Bash
    Steps: Run `bun test tests/unit/uninstall.test.ts`
    Expected: Command exits 0 and includes the new regression coverage
    Evidence: .sisyphus/evidence/task-2-uninstall-test.txt

  Scenario: Source no longer uses the failing removal pattern
    Tool: Read
    Steps: Read the updated `src/cli/config-manager/index.ts` uninstall helper section
    Expected: The removal logic clearly handles directory deletion safely and intentionally
    Evidence: .sisyphus/evidence/task-2-uninstall-review.txt
  ```

  **Commit**: YES | Message: `fix(uninstall): handle empty global config directory safely` | Files: `src/cli/config-manager/index.ts`, `src/cli/uninstall.ts`, `tests/unit/uninstall.test.ts`

- [x] 3. Redesign `skills/code-health/SKILL.md` as a static audit/reporting skill

  **What to do**: Rewrite `skills/code-health/SKILL.md` so it no longer references Desloppify, Python, installation steps, `.desloppify/`, or automatic cleanup. Replace it with a filesystem-first audit skill influenced by Matt Pocock's `improve-codebase-architecture`: friction-driven discovery, coupling/seam analysis, testability assessment, dependency classification, and a deterministic markdown report with severities `critical/high/medium/low/informational`. Treat the Matt Pocock references as optional inspiration only; do not require network access during execution and do not copy them verbatim.
  **Must NOT do**: Do not add interface-design exercises, RFC creation, GitHub issue creation, or “pick one option” prompts. Do not allow the skill to mutate code or present itself as an auto-fix workflow.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this is a skill-contract rewrite with precise behavioral guidance
  - Skills: `[]` — No extra skill required
  - Omitted: `['unspecified-high']` — No source-code complexity if scope stays within the skill markdown

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: none

  **References**:
  - Pattern: `skills/code-health/SKILL.md:4` — current file still frames itself as Desloppify-driven cleanup
  - Pattern: `skills/code-health/SKILL.md:22` — current runtime toggle and `.desloppify/` state language to remove
  - Pattern: `skills/code-health/SKILL.md:49` — current workflow checks `desloppifyEnabled`
  - Pattern: `skills/code-health/SKILL.md:69` — current fallback message references install flow and Python command
  - Pattern: `skills/SKILL-STANDARD.md:151` — inventory row currently describes `code-health` as Desloppify cleanup
  - External: `https://github.com/mattpocock/skills/blob/main/improve-codebase-architecture/SKILL.md` — workflow inspiration source
  - External: `https://github.com/mattpocock/skills/blob/main/improve-codebase-architecture/REFERENCE.md` — dependency classification ideas to adapt
  - Ownership: keep `code-health` under `fullstack-wunderkind`; do not reassign to `product-wunderkind`

  **Acceptance Criteria**:
  - [x] `skills/code-health/SKILL.md` contains no `desloppify`, `Desloppify`, `.desloppify`, Python install guidance, or auto-cleanup language
  - [x] The skill defines a severity taxonomy: `critical`, `high`, `medium`, `low`, `informational`
  - [x] The skill includes explicit workflow steps, severity definitions, and named output sections rather than a minimal prose-only rewrite
  - [x] The skill specifies a report output shape including summary, findings, priorities, systemic patterns, and appendix
  - [x] The skill explicitly targets zero critical/high findings and permits medium-or-lower findings only when explained or deferred
  - [x] The skill states that the audit report is produced as structured markdown in the response, not written automatically to a fixed file path

  **QA Scenarios**:
  ```text
  Scenario: Replacement skill contract is fully Desloppify-free
    Tool: Bash
    Steps: Run `grep -n "desloppify\|Desloppify\|\.desloppify\|python -m pip" skills/code-health/SKILL.md`
    Expected: No matches
    Evidence: .sisyphus/evidence/task-3-skill-grep.txt

  Scenario: Replacement skill includes required audit structure
    Tool: Read
    Steps: Read `skills/code-health/SKILL.md`
    Expected: The file explicitly defines severity levels, audit workflow, output report sections, and non-mutating guardrails
    Evidence: .sisyphus/evidence/task-3-skill-review.txt
  ```

  **Commit**: YES | Message: `docs(skills): repurpose code-health as audit reporting skill` | Files: `skills/code-health/SKILL.md`

- [x] 4. Update public and maintainer docs to the new no-Desloppify, audit-style `code-health` contract

  **What to do**: Edit `README.md`, `AGENTS.md`, and `skills/SKILL-STANDARD.md` so all Desloppify references are removed while `code-health` remains listed as a safer audit/reporting skill. Update init, doctor, gitignore, config, and sub-skills sections to match the new shipped behavior. In `README.md`, add a concise breaking-changes section or equivalent release-note callout that states this version intentionally breaks the previous Desloppify-related contract and explicitly lists where the break shows up: removed init flag, removed config key, removed gitignore entry, removed fallback/install workflow, and the new audit-only `code-health` behavior. Also refresh stale README command/skill/lifecycle text opportunistically where it intersects this work so the README reflects the current shipped surface rather than only the removals. In `AGENTS.md`, limit edits to the repo's own maintained knowledge-base lines that mention Desloppify or describe `code-health`; do not rewrite unrelated inventory or conventions text.
  **Must NOT do**: Do not leave docs implying that `code-health` was deleted; it must be described consistently as an audit/report skill. Do not rewrite unrelated docs sections. Do not add migration-warning prose for stale `desloppifyEnabled` keys. Do not turn the README refresh into a wholesale marketing rewrite; keep it tied to current commands, skills, lifecycle behavior, and the breaking-change surfaces touched by this plan.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: cross-doc product contract cleanup
  - Skills: `[]` — No extra skill required
  - Omitted: `['unspecified-high']` — Documentation fidelity, not algorithmic work

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: 1, 3; must not start until both Wave 1 tasks are complete and verified

  **References**:
  - Pattern: `README.md:150` — init options table row for `--desloppify-enabled`
  - Pattern: `README.md:214` — doctor verbose bullet mentions Desloppify opt-in
  - Pattern: `README.md:265` — start of the `## Desloppify Code Health` section to remove/replace
  - Pattern: `README.md:350` — `code-health` row needs new description, not deletion
  - Pattern: `README.md:422` — config example still references `desloppifyEnabled`
  - Pattern: `README.md:531` — gitignore text still lists `.desloppify/`
  - Pattern: `AGENTS.md:78` — gitignore command description includes `.desloppify/`
  - Pattern: `AGENTS.md:79` — init description mentions Desloppify opt-in
  - Pattern: `AGENTS.md:184` — sub-skills list includes `code-health`; keep it but update surrounding gotchas/docs consistency
  - Pattern: `AGENTS.md:242` — Desloppify gotcha entries to remove or replace
  - Pattern: `skills/SKILL-STANDARD.md:151` — inventory row should describe audit/reporting skill, not Desloppify cleanup
  - Ownership: Task 4 owns the `skills/SKILL-STANDARD.md` inventory wording; Task 3 owns only `skills/code-health/SKILL.md`

  **Acceptance Criteria**:
  - [x] `README.md` and `AGENTS.md` contain no `desloppify`, `Desloppify`, `desloppifyEnabled`, or `.desloppify`
  - [x] `code-health` remains documented as a non-mutating audit/report skill
  - [x] Init, doctor, config, and gitignore docs read coherently after the removals
  - [x] `README.md` includes an explicit breaking-change note for this version and identifies the affected upgrade surfaces
  - [x] `README.md` command/skill/lifecycle sections touched by this work read as a current snapshot, not as a stale partial diff

  **QA Scenarios**:
  ```text
  Scenario: Docs are purged of Desloppify but retain code-health as an audit skill
    Tool: Bash
    Steps: Run `grep -n "desloppify\|Desloppify\|desloppifyEnabled\|\.desloppify" README.md AGENTS.md skills/SKILL-STANDARD.md`
    Expected: No matches
    Evidence: .sisyphus/evidence/task-4-doc-grep.txt

  Scenario: Code-health docs remain present with the new positioning
    Tool: Bash
    Steps: Run `grep -n "code-health" README.md AGENTS.md skills/SKILL-STANDARD.md`
    Expected: Matches remain and describe audit/reporting behavior, not Desloppify cleanup
    Evidence: .sisyphus/evidence/task-4-code-health-docs.txt

  Scenario: README documents the intentional breaking changes in the shipped version
    Tool: Read
    Steps: Read the updated `README.md`
    Expected: The README explicitly calls out the breaking changes, names the affected surfaces, and presents current commands/skills/lifecycle guidance consistently with the post-Desloppify contract
    Evidence: .sisyphus/evidence/task-4-readme-review.txt
  ```

  **Commit**: YES | Message: `docs: remove desloppify and document code-health audit flow` | Files: `README.md`, `AGENTS.md`, `skills/SKILL-STANDARD.md`

- [x] 5. Align unit tests and run the integrated post-change verification suite

  **What to do**: Update all Desloppify-related unit tests and fixtures to the new contract: no Desloppify runtime/config/CLI behavior, uninstall bug fixed, `code-health` retained as an audit skill. Then run the full integrated verification suite.
  **Must NOT do**: Do not broadly weaken assertions; only remove or rewrite assertions that exist because the old Desloppify contract existed.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: multi-file regression alignment and final automated verification
  - Skills: `[]` — No extra skill required
  - Omitted: `['writing']` — Test and command execution work only

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification Wave | Blocked By: 1, 2, 3, 4

  **References**:
  - Test: `tests/unit/gitignore-manager.test.ts:18` — expected arrays still include `.desloppify/`
  - Test: `tests/unit/cli-help-text.test.ts:82` — Desloppify-specific help text expectations
  - Test: `tests/unit/init-doctor.test.ts:194` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:238` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:281` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:329` — doctor output still asserts `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:437` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:464` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:516` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:623` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:681` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:727` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-doctor.test.ts:774` — detected-config fixture still includes `desloppifyEnabled`
  - Test: `tests/unit/init-nontui.test.ts:113` — non-TUI init asserts removed field is written
  - Test: `tests/unit/init-interactive.test.ts:143` — interactive init assertions inspect removed field
  - Test: `tests/unit/config-template.test.ts:44` — change the old schema field-presence assertion from `toBeDefined()` to `toBeUndefined()` for `projectSchema?.properties?.desloppifyEnabled`; keep the existing `required`-array assertion unless it no longer matches the post-removal schema shape; also add a stale on-disk config read case that tolerates `desloppifyEnabled` silently when read back through the config-manager path
  - Test: `tests/unit/cli-installer.test.ts:33` — fixture cleanup required
  - Test: `tests/unit/tui-installer-handoff.test.ts:51` — fixture cleanup required
  - Test: `tests/unit/uninstall.test.ts` — add uninstall regression coverage and keep existing uninstall assertions green

  **Acceptance Criteria**:
  - [x] All affected tests reflect the new contract without Desloppify expectations
  - [x] `tsc --noEmit` exits 0
  - [x] `bun test tests/unit/` exits 0
  - [x] `bun run build` exits 0
  - [x] `node bin/wunderkind.js init --help` omits `--desloppify-enabled`
  - [x] `node bin/wunderkind.js init --desloppify-enabled=yes` fails as an unknown/unsupported flag rather than silently enabling anything
  - [x] `node bin/wunderkind.js gitignore --help` omits `.desloppify`
  - [x] `node bin/wunderkind.js doctor --verbose` omits Desloppify references
  - [x] `grep -r "desloppify\|Desloppify\|desloppifyEnabled" src/ schemas/ tests/ README.md AGENTS.md agents/` returns no matches after `bun run build`
  - [x] `skills/code-health/SKILL.md` remains present and grep-clean of Desloppify terms

  **QA Scenarios**:
  ```text
  Scenario: Full regression and build pass after all contract changes
    Tool: Bash
    Steps: Run `tsc --noEmit && bun test tests/unit/ && bun run build`
    Expected: All three commands exit 0
    Evidence: .sisyphus/evidence/task-5-regression.txt

  Scenario: Shipped contract is correct end-to-end
    Tool: Bash
    Steps: Run `node bin/wunderkind.js init --help`; run `node bin/wunderkind.js init --desloppify-enabled=yes`; run `node bin/wunderkind.js gitignore --help`; run `node bin/wunderkind.js doctor --verbose`; run `grep -r "desloppify\|Desloppify\|desloppifyEnabled" src/ schemas/ tests/ README.md AGENTS.md agents/`; run `grep -n "desloppify\|Desloppify\|\.desloppify\|python -m pip" skills/code-health/SKILL.md`; run the targeted stale-config unit using an inline JSONC fixture such as `{ "$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json", "teamCulture": "pragmatic-balanced", "desloppifyEnabled": true }`
    Expected: Help/doctor commands omit removed Desloppify references, the removed init flag is rejected as unknown/unsupported, repo grep finds no Desloppify terms in shipped contract surfaces including generated `agents/`, `skills/code-health/SKILL.md` remains present without old workflow text, and the stale-key fixture is parsed without surfacing `desloppifyEnabled`
    Evidence: .sisyphus/evidence/task-5-contract-audit.txt
  ```

  **Commit**: YES | Message: `test(cli): align suite with desloppify removal and code-health audit flow` | Files: `tests/unit/*.test.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

  **Final-wave execution procedure**:
  ```text
  F1 Plan Compliance Audit
    Tool: task(subagent_type="oracle")
    Steps: Review `.sisyphus/plans/remove-desloppify.md` against the implemented diff; verify Desloppify removal, uninstall fix, and code-health redesign all landed exactly as planned.
    Expected: Explicit APPROVE or REJECT with file:line citations.

  F2 Code Quality Review
    Tool: task(category="unspecified-high")
    Steps: Review changed source, tests, and docs for regressions, weak assertions, and unintended behavior changes outside the scoped contract changes.
    Expected: Explicit APPROVE or REJECT with concrete blockers.

  F3 Real Manual QA
    Tool: Bash
    Steps: Run `tsc --noEmit && bun test tests/unit/ && bun run build`; then run `node bin/wunderkind.js init --help`; `node bin/wunderkind.js gitignore --help`; `node bin/wunderkind.js doctor --verbose`; finally run `grep -r "desloppify\|Desloppify\|desloppifyEnabled" src/ schemas/ tests/ README.md AGENTS.md agents/` and `grep -n "desloppify\|Desloppify\|\.desloppify\|python -m pip" skills/code-health/SKILL.md`.
    Expected: All commands exit 0; command output omits removed Desloppify references; code-health skill remains present and Desloppify-free.

  F4 Scope Fidelity Check
    Tool: task(category="deep")
    Steps: Audit shipped contract surfaces to confirm the final state is exactly: no Desloppify product support, uninstall fixed, and `code-health` retained only as an audit/report skill.
    Expected: Explicit APPROVE or REJECT with exact file:line citations.
  ```

## Commit Strategy
- Prefer 5-6 atomic commits aligned to the tasks above; do not mix uninstall bugfix, source contract removal, skill redesign, docs cleanup, and test alignment into one giant commit
- Keep Task 1 as the only cross-cutting source cleanup so the repository can typecheck before CLI smoke/build verification begins
- Pair Task 2 with its regression test in the same commit
- Keep `skills/SKILL-STANDARD.md` ownership in Task 4 only so the inventory wording is updated after the new `code-health` skill contract is finalized

## Success Criteria
- Wunderkind no longer ships, advertises, configures, or documents Desloppify
- Users cannot enable Desloppify through CLI, config, or project setup flows
- Global uninstall no longer fails when `~/.wunderkind` exists as an empty directory
- `code-health` survives as a non-mutating audit/report skill with explicit severity levels and zero critical/high target
- `README.md` clearly states that this version introduces breaking changes and names the exact contract surfaces that changed
- Typecheck, unit tests, build, CLI help, doctor output, and grep-based contract audit all confirm the new contract
