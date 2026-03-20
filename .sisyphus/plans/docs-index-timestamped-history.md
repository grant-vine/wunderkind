# docs-index timestamped history standard

## TL;DR
> **Summary**: Replace vague date-only docs-history guidance with one canonical UTC timestamp contract that works for both `append-dated` section headers and `new-dated-file` filenames, without migrating legacy date-only artifacts.
> **Deliverables**:
> - shared docs-history timestamp helpers and collision rules
> - mode-aware docs-index planning/summary semantics
> - synchronized `/docs-index`, runtime injection, CLI hint, and README wording
> - targeted and full regression coverage
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Tasks 2-7 → Task 8

## Context
### Original Request
The current `/docs-index` behavior thinks in date-only terms, which fails when multiple code/documentation changes happen on the same day. The requested solution is to research and plan a timestamped history model, with UTC sortable text preferred over epoch values.

### Interview Summary
- User requirement: docs history must support multiple updates within the same day.
- User decision: use human-readable sortable UTC text, not epoch values.
- User decision: freeze second precision.
- User decision: require TDD.
- User decision: preserve existing date-only sections/files unchanged; do not migrate them in this change.

### Metis Review (gaps addressed)
- Freeze the exact token, heading template, filename template, collision policy, and legacy-file policy explicitly.
- Reconcile `new-dated-file` with the current fixed canonical-path model in `src/agents/docs-index-plan.ts`.
- Update all contract surfaces together: command asset, docs instructions, runtime injection, CLI/meta copy, config comments, README, and tests.
- Do not assume a concrete docs writer already exists; the first deliverable is a shared formatter/builder contract.

## Work Objectives
### Core Objective
Define and implement one repo-wide docs-history timestamp standard for Wunderkind documentation output so `/docs-index` can distinguish multiple same-day updates deterministically.

### Deliverables
- `src/cli/docs-output-helper.ts` exposes the canonical UTC timestamp token and mode-specific builders.
- `src/agents/docs-index-plan.ts` understands canonical managed lanes vs timestamped output-family paths.
- `src/agents/docs-config.ts`, `commands/docs-index.md`, and `src/index.ts` all describe the same timestamp behavior.
- CLI/init/config copy and `README.md` describe timestamped history accurately.
- Unit tests cover helper formatting, collision handling, docs-index planning semantics, and wording drift.

### Definition of Done (verifiable conditions with commands)
- `bun test tests/unit/docs-output-helper.test.ts tests/unit/docs-index-plan.test.ts tests/unit/docs-config.test.ts tests/unit/docs-injection.test.ts tests/unit/config-template.test.ts tests/unit/init-interactive.test.ts tests/unit/cli-installer.test.ts` exits `0`.
- `bun test` exits `0`.
- `tsc --noEmit` exits `0`.
- `bun run build` exits `0`.
- `npm pack --dry-run` exits `0`.
- Content verification confirms the new canonical examples are present and the stale vague wording is removed from touched files.

### Must Have
- Canonical token: `YYYY-MM-DDTHH-mm-ssZ` in UTC, e.g. `2026-03-12T18-37-52Z`.
- One `/docs-index` run uses one shared base timestamp token across all participating docs lanes.
- `append-dated` section heading template: `## Update <UTC_TOKEN>`.
- `append-dated` collision template: `## Update <UTC_TOKEN> (2)` then `(3)` and so on.
- `new-dated-file` filename template: `<basename>--<UTC_TOKEN>.md`.
- `new-dated-file` collision template: `<basename>--<UTC_TOKEN>--2.md` then `--3` and so on.
- Canonical ownership lane remains the unsuffixed file from `AGENT_DOCS_CONFIG`; timestamped files are managed family members, not stray legacy outputs.
- Existing date-only files/sections remain untouched and valid.
- Trust-boundary/path validation behavior remains unchanged.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No new `docHistoryMode` values.
- No locale-based timestamps, no epoch format, no configurable timezone/precision.
- No migration or renaming of existing date-only artifacts.
- No changes to eligible agents or canonical basenames in `AGENT_DOCS_CONFIG`.
- No new third-party date dependency.
- No regression to `overwrite` or `overwrite-archive` semantics beyond wording clarification.
- No logic that treats timestamped family files as non-canonical files to normalize away.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: TDD with Bun unit tests.
- QA policy: Every task includes agent-executed happy-path and failure/edge scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Task 1 freezes the timestamp contract; Tasks 2-5 then implement the model and contract surfaces in parallel.

Wave 2: Tasks 6-7 synchronize CLI/public documentation; Task 8 runs regression and packaging verification.

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 3, 4, 5, 6, 7, 8 |
| 2 | 1 | 8 |
| 3 | 1 | 5, 8 |
| 4 | 1 | 8 |
| 5 | 1, 3 | 7, 8 |
| 6 | 1 | 8 |
| 7 | 1, 5, 6 | 8 |
| 8 | 2, 3, 4, 5, 6, 7 | Final Verification Wave |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 5 tasks → `unspecified-low`, `quick`, `writing`
- Wave 2 → 3 tasks → `quick`, `writing`, `unspecified-low`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Freeze the shared UTC timestamp contract in docs-output helpers

  **What to do**:
  - Add shared helper(s) in `src/cli/docs-output-helper.ts` for the canonical docs-history token and mode-aware builders.
  - Implement the exact token formatter `YYYY-MM-DDTHH-mm-ssZ` using UTC components only.
  - Implement builders for append-dated headings and new-dated-file filenames, including ordinal collision suffixes.
  - Add a managed-family matcher/helper so timestamped files derived from canonical basenames can be recognized as valid family members.
  - Create `tests/unit/docs-output-helper.test.ts` with frozen-time assertions; keep existing validation tests in `tests/unit/cli-installer.test.ts` intact.

  **Must NOT do**:
  - Do not add any dependency such as `date-fns`.
  - Do not use locale formatting or `Date.toString()`/`toLocaleString()` output.
  - Do not change `validateDocsPath()` or `validateDocHistoryMode()` semantics.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: focused helper + unit-test task in one module.
  - Skills: `[]` — no specialist skill required.
  - Omitted: `["playwright"]` — no browser work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 6, 7, 8 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/docs-output-helper.ts:10-74` — existing docs-path/history-mode helper home; add timestamp helpers here.
  - Pattern: `tests/unit/cli-installer.test.ts:731-769` — current helper-test style for docs-output utilities.
  - Pattern: `README.md:145-152` — public wording that currently says only “dated section” / “date suffix”.
  - Pattern: `src/cli/personality-meta.ts:219-236` — short-form CLI hints that must ultimately match helper semantics.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `tests/unit/docs-output-helper.test.ts` asserts `formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:52.000Z")) === "2026-03-12T18-37-52Z"`.
  - [ ] `tests/unit/docs-output-helper.test.ts` asserts `buildAppendDatedHeading("2026-03-12T18-37-52Z", 1) === "## Update 2026-03-12T18-37-52Z"` and ordinal `2` yields `## Update 2026-03-12T18-37-52Z (2)`.
  - [ ] `tests/unit/docs-output-helper.test.ts` asserts `buildNewDatedFilename("marketing-strategy.md", "2026-03-12T18-37-52Z", 1) === "marketing-strategy--2026-03-12T18-37-52Z.md"` and ordinal `2` yields `marketing-strategy--2026-03-12T18-37-52Z--2.md`.
  - [ ] Lexicographic ordering tests prove the token sorts in chronological order.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Canonical UTC token and builders
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-output-helper.test.ts`
    Expected: Exit code 0; frozen-time token, heading, filename, and ordering assertions pass.
    Evidence: .sisyphus/evidence/task-1-docs-output-helper.txt

  Scenario: Same-second collision suffixes
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-output-helper.test.ts -t "collision"`
    Expected: Exit code 0; second occurrence uses `(2)` for headings and `--2` for filenames.
    Evidence: .sisyphus/evidence/task-1-docs-output-helper-collision.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `src/cli/docs-output-helper.ts`, `tests/unit/docs-output-helper.test.ts`

- [ ] 2. Make docs-index planning mode-aware for timestamped file families

  **What to do**:
  - Update `src/agents/docs-index-plan.ts` so `buildDocsIndexPlan()` accepts `docHistoryMode` and distinguishes canonical managed lane paths from actual write targets.
  - Add fields to `DocsIndexPlanEntry` for the unsuffixed managed lane path and the output strategy (`in-place` vs `dated-file-family`).
  - For `new-dated-file`, expose a write pattern using `<basename>--<UTC_TOKEN>.md` rather than pretending the canonical lane is the write target.
  - Update `summarizeDocsIndexResults()` so it can report actual output paths for `new-dated-file` and never marks the canonical unsuffixed lane as failed solely because the dated artifact path was used.
  - Extend `tests/unit/docs-index-plan.test.ts` for new mode-aware behavior.

  **Must NOT do**:
  - Do not remove canonical filename ownership from `AGENT_DOCS_CONFIG`.
  - Do not require canonical unsuffixed files to exist in `new-dated-file` mode.
  - Do not change docs-path trust-boundary validation.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: small model/data-structure change with tests.
  - Skills: `[]` — no specialist skill required.
  - Omitted: `["playwright"]` — non-UI work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/agents/docs-index-plan.ts:4-97` — current fixed-target-path model and summary helper.
  - API/Type: `src/cli/types.ts:4-45` — `DocHistoryMode` contract.
  - Pattern: `src/agents/docs-config.ts:20-97` — canonical ownership map that must remain the source of truth.
  - Test: `tests/unit/docs-index-plan.test.ts:8-90` — existing plan/summarization assertions to extend.
  - Pattern: `commands/docs-index.md:24-37` — command trust-boundary and canonical-home-file language that the plan model must support.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `buildDocsIndexPlan("./docs", "append-dated")` still resolves the managed lane for marketing to `docs/marketing-strategy.md`.
  - [ ] `buildDocsIndexPlan("./docs", "new-dated-file")` marks the marketing lane as `dated-file-family` and exposes the pattern `docs/marketing-strategy--<UTC_TOKEN>.md`.
  - [ ] `summarizeDocsIndexResults()` reports actual timestamped output paths as `created` for `new-dated-file` runs.
  - [ ] Existing absolute-path and parent-traversal tests continue to pass unchanged.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Mode-aware docs-index planning
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-index-plan.test.ts`
    Expected: Exit code 0; append-dated remains in-place, new-dated-file exposes a family pattern and correct summary semantics.
    Evidence: .sisyphus/evidence/task-2-docs-index-plan.txt

  Scenario: Missing timestamped output is still a failure
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-index-plan.test.ts -t "failed"`
    Expected: Exit code 0; when neither lane nor actual timestamped output exists after the run, summary marks the entry failed.
    Evidence: .sisyphus/evidence/task-2-docs-index-plan-failure.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `src/agents/docs-index-plan.ts`, `tests/unit/docs-index-plan.test.ts`

- [ ] 3. Synchronize docs-agent instructions with the UTC timestamp contract

  **What to do**:
  - Update `buildDocsInstruction()` in `src/agents/docs-config.ts` so each history mode uses the exact UTC token contract.
  - Add explicit examples for append-dated headings and new-dated-file filenames.
  - State that one `/docs-index` run reuses one shared base token.
  - State that timestamped files derived from canonical basenames are managed family files, not legacy non-canonical files.
  - State that existing date-only files/sections remain untouched.
  - Extend `tests/unit/docs-config.test.ts` to assert the exact strings.

  **Must NOT do**:
  - Do not leave vague wording such as “dated section” or “date suffix” in this file.
  - Do not reintroduce transactional completion-tag language removed by the lightweight refresh plan.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: contract wording plus unit assertions.
  - Skills: `[]` — no external docs needed.
  - Omitted: `["frontend-ui-ux"]` — no UI design component.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/agents/docs-config.ts:20-97` — current ownership map and docs instruction string.
  - Test: `tests/unit/docs-config.test.ts:25-106` — current wording assertions.
  - Pattern: `commands/docs-index.md:33-38` — command-level refresh/bootstrap language that docs instructions must mirror.
  - Pattern: `README.md:145-152` — public descriptions that must eventually align.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `tests/unit/docs-config.test.ts` asserts the exact example `## Update 2026-03-12T18-37-52Z`.
  - [ ] `tests/unit/docs-config.test.ts` asserts the exact example `marketing-strategy--2026-03-12T18-37-52Z.md`.
  - [ ] `tests/unit/docs-config.test.ts` asserts that date-only legacy artifacts are preserved and timestamped family files are valid managed outputs.
  - [ ] `tests/unit/docs-config.test.ts` asserts the old vague phrases are absent from the built instruction string.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Docs instruction emits exact timestamp contract
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-config.test.ts`
    Expected: Exit code 0; the instruction string includes the exact UTC examples and legacy-preservation rule.
    Evidence: .sisyphus/evidence/task-3-docs-config.txt

  Scenario: Vague wording removed
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-config.test.ts -t "timestamp"`
    Expected: Exit code 0; tests fail if only generic “dated section/date suffix” wording remains.
    Evidence: .sisyphus/evidence/task-3-docs-config-wording.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `src/agents/docs-config.ts`, `tests/unit/docs-config.test.ts`

- [ ] 4. Update runtime docs-output injection to describe timestamped history precisely

  **What to do**:
  - Update the docs-output block in `src/index.ts` so runtime guidance names the UTC token contract and distinguishes canonical home files from timestamped family files.
  - Keep the sentinel/idempotency behavior unchanged.
  - Mention that `/docs-index` refreshes canonical lanes in place for `append-dated` and writes timestamped family files for `new-dated-file`.
  - Extend `tests/unit/docs-injection.test.ts` to assert the new wording and the absence of vague date-only language.

  **Must NOT do**:
  - Do not change sentinel behavior or duplicate-injection prevention.
  - Do not remove `docsPath`, `docHistoryMode`, or project-root trust-boundary messaging.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: single-file runtime-string update plus test.
  - Skills: `[]` — no special skill required.
  - Omitted: `["playwright"]` — no browser validation needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/index.ts:5-35` — current runtime docs-output injection block.
  - Test: `tests/unit/docs-injection.test.ts:41-112` — existing runtime injection assertions.
  - Pattern: `AGENTS.md:82-99` — runtime vs static heading distinction; do not break sentinel behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Runtime injection still includes `docsPath`, `docHistoryMode`, docs scope, canonical targets, and sentinel idempotency behavior.
  - [ ] `tests/unit/docs-injection.test.ts` asserts presence of the exact UTC example and family-file wording.
  - [ ] `tests/unit/docs-injection.test.ts` asserts absence of vague “dated section/date suffix” guidance.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Runtime docs injection stays idempotent and precise
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-injection.test.ts`
    Expected: Exit code 0; docs block is injected once and includes the timestamp contract.
    Evidence: .sisyphus/evidence/task-4-docs-injection.txt

  Scenario: No duplicate docs section
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-injection.test.ts -t "does not duplicate docs section"`
    Expected: Exit code 0; sentinel count remains 1 after two transforms.
    Evidence: .sisyphus/evidence/task-4-docs-injection-idempotent.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `src/index.ts`, `tests/unit/docs-injection.test.ts`

- [ ] 5. Make the shipped `/docs-index` command contract explicit about timestamped writes

  **What to do**:
  - Update `commands/docs-index.md` so `/docs-index` explicitly instructs:
    - one shared UTC token per run,
    - `append-dated` appends `## Update <UTC_TOKEN>` sections in canonical files,
    - `new-dated-file` writes `<basename>--<UTC_TOKEN>[--N].md`,
    - timestamped files belonging to a canonical basename are managed family members and must not be normalized away as legacy files.
  - Preserve lightweight refresh/bootstrap, partial-success handling, and optional `init-deep` follow-up.
  - Update `tests/unit/config-template.test.ts` to assert the new contract examples.

  **Must NOT do**:
  - Do not broaden the command into a full docs-index redesign.
  - Do not remove the trust boundary or partial-success rules.
  - Do not leave `new-dated-file` behavior implicit.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: command contract + packaging test update.
  - Skills: `[]` — repo-local docs only.
  - Omitted: `["git-master"]` — no git operation required.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 8 | Blocked By: 1, 3

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `commands/docs-index.md:6-38` — existing command contract.
  - Test: `tests/unit/config-template.test.ts:45-60` — command-asset packaging assertions.
  - Pattern: `src/agents/docs-config.ts:81-96` — docs instruction wording that the command asset must mirror.
  - Pattern: `.sisyphus/plans/docs-index-lightweight-refresh.md:1-174` — prior lightweight refresh decision context; preserve partial success and optional `init-deep`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `commands/docs-index.md` contains the exact example `## Update 2026-03-12T18-37-52Z`.
  - [ ] `commands/docs-index.md` contains the exact example `marketing-strategy--2026-03-12T18-37-52Z.md`.
  - [ ] `tests/unit/config-template.test.ts` asserts the command does not normalize timestamped managed-family outputs away.
  - [ ] Existing partial-success and `init-deep` follow-up assertions remain true.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Command asset matches timestamp contract
    Tool: Bash
    Steps: Run `bun test tests/unit/config-template.test.ts`
    Expected: Exit code 0; packaged command asset contains the UTC examples and preserves lightweight refresh wording.
    Evidence: .sisyphus/evidence/task-5-config-template.txt

  Scenario: Timestamped family files are exempt from legacy normalization wording
    Tool: Grep
    Steps: Search `commands/docs-index.md` for the exact phrase `managed family` and for the exact example filename `marketing-strategy--2026-03-12T18-37-52Z.md`.
    Expected: Both matches are present.
    Evidence: .sisyphus/evidence/task-5-config-template-grep.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `commands/docs-index.md`, `tests/unit/config-template.test.ts`

- [ ] 6. Sync CLI/init/config surfaced copy with the UTC timestamp standard

  **What to do**:
  - Update `src/cli/personality-meta.ts` hints so `append-dated` and `new-dated-file` reference UTC-timestamped sections/files rather than generic dated ones.
  - Update the config template comments in `src/cli/config-manager/index.ts` so history-mode descriptions reference UTC timestamped history accurately.
  - Keep `src/cli/init.ts` prompts functionally unchanged unless the changed hints require test updates.
  - Add or update lightweight assertions using existing tests and/or content verification so these strings cannot drift back.

  **Must NOT do**:
  - Do not change `DocHistoryMode` names.
  - Do not add new installer/init prompts.
  - Do not change the saved config shape.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: small wording sync across CLI-related files.
  - Skills: `[]` — no specialist skill required.
  - Omitted: `["frontend-ui-ux"]` — no UI work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/personality-meta.ts:219-236` — current short hints to update.
  - Pattern: `src/cli/config-manager/index.ts:470-476` — project config comment block.
  - Pattern: `src/cli/init.ts:312-323` — init surface that renders history mode choices.
  - Test: `tests/unit/init-interactive.test.ts:231-252` — existing init coverage around `append-dated` selection.
  - Test: `tests/unit/cli-installer.test.ts:748-755` — existing history-mode validation tests that must still pass.

  **Acceptance Criteria** (agent-executable only):
  - [ ] CLI hints use “UTC-timestamped” language for `append-dated` and `new-dated-file`.
  - [ ] Config template comments remain accurate and still enumerate the same four history modes.
  - [ ] `tests/unit/init-interactive.test.ts` and `tests/unit/cli-installer.test.ts` continue to pass unchanged unless explicit wording assertions are added.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: CLI surfaces preserve behavior
    Tool: Bash
    Steps: Run `bun test tests/unit/init-interactive.test.ts tests/unit/cli-installer.test.ts`
    Expected: Exit code 0; mode selection/validation behavior is unchanged.
    Evidence: .sisyphus/evidence/task-6-cli-tests.txt

  Scenario: CLI wording is synchronized
    Tool: Grep
    Steps: Search `src/cli/personality-meta.ts` and `src/cli/config-manager/index.ts` for `UTC-timestamped` and confirm zero matches for the old standalone phrases `dated section` and `date suffix` in those files.
    Expected: Updated phrase present; stale phrases absent.
    Evidence: .sisyphus/evidence/task-6-cli-grep.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `src/cli/personality-meta.ts`, `src/cli/config-manager/index.ts`, `src/cli/init.ts`, `tests/unit/init-interactive.test.ts`, `tests/unit/cli-installer.test.ts`

- [ ] 7. Update README and public docs to match the shipped timestamp contract

  **What to do**:
  - Update the history-mode table in `README.md` so `append-dated` and `new-dated-file` describe UTC timestamped outputs precisely.
  - Update the `## Documentation Output` section to explain that `/docs-index` uses canonical managed lanes plus timestamped family outputs where applicable.
  - Add at least one exact example token and filename to the README.
  - State explicitly that old date-only artifacts are preserved unchanged.

  **Must NOT do**:
  - Do not document behaviors not implemented in code/tests.
  - Do not reintroduce “prompt convention only” wording.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: public documentation sync.
  - Skills: `[]` — no external docs required.
  - Omitted: `["playwright"]` — no UI/browser work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1, 5, 6

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `README.md:128-152` — history-mode table needing precise UTC timestamp language.
  - Pattern: `README.md:233-239` — docs-output section describing `/docs-index`.
  - Pattern: `commands/docs-index.md:6-38` — shipped command wording the README must match.
  - Test: `tests/unit/config-template.test.ts:45-60` — command asset contract to keep aligned.

  **Acceptance Criteria** (agent-executable only):
  - [ ] README contains the exact token example `2026-03-12T18-37-52Z`.
  - [ ] README contains the exact filename example `marketing-strategy--2026-03-12T18-37-52Z.md`.
  - [ ] README explicitly says existing date-only artifacts are preserved.
  - [ ] README contains no stale generic phrasing for the two timestamped modes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: README reflects shipped timestamp contract
    Tool: Grep
    Steps: Search `README.md` for `2026-03-12T18-37-52Z`, `marketing-strategy--2026-03-12T18-37-52Z.md`, and `preserved unchanged`.
    Expected: All three matches are present.
    Evidence: .sisyphus/evidence/task-7-readme-grep.txt

  Scenario: Stale wording removed from README
    Tool: Grep
    Steps: Search `README.md` for the phrases `Appends a new dated section` and `Creates a new file with a date suffix`.
    Expected: Zero matches.
    Evidence: .sisyphus/evidence/task-7-readme-clean.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `README.md`

- [ ] 8. Run regression, resolve drift, and verify release readiness

  **What to do**:
  - Run the targeted timestamp/doc-history test suite first; fix any mismatches across helpers, models, runtime strings, command copy, CLI hints, and README.
  - Run the full repo test/build/package verification commands.
  - Verify that touched files all use the exact same example token/filename strings.
  - Prepare the repo for a green atomic commit sequence defined below.

  **Must NOT do**:
  - Do not leave any touched surface on vague date-only wording.
  - Do not skip failing tests or relax assertions to hide disagreement.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: cross-file regression pass and verification.
  - Skills: `[]` — no special skill required.
  - Omitted: `["git-master"]` — verification only; no commit action in this task.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification Wave | Blocked By: 2, 3, 4, 5, 6, 7

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/docs-output-helper.ts:10-74` — helper contract home.
  - Pattern: `src/agents/docs-index-plan.ts:4-97` — plan/summarization behavior.
  - Pattern: `src/agents/docs-config.ts:71-97` — docs instruction wording.
  - Pattern: `src/index.ts:21-35` — runtime injection wording.
  - Pattern: `commands/docs-index.md:6-38` — command contract.
  - Pattern: `README.md:145-152` and `README.md:233-239` — public docs surfaces.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Targeted docs-history test suite exits `0`.
  - [ ] Full `bun test`, `tsc --noEmit`, `bun run build`, and `npm pack --dry-run` all exit `0`.
  - [ ] Content verification finds the exact token and filename example consistently across all touched files.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Targeted docs-history regression suite
    Tool: Bash
    Steps: Run `bun test tests/unit/docs-output-helper.test.ts tests/unit/docs-index-plan.test.ts tests/unit/docs-config.test.ts tests/unit/docs-injection.test.ts tests/unit/config-template.test.ts tests/unit/init-interactive.test.ts tests/unit/cli-installer.test.ts`
    Expected: Exit code 0; all docs-history and wording tests pass together.
    Evidence: .sisyphus/evidence/task-8-targeted-suite.txt

  Scenario: Full release-readiness verification
    Tool: Bash
    Steps: Run `bun test && tsc --noEmit && bun run build && npm pack --dry-run`
    Expected: Exit code 0; tests, types, build, and package surface all succeed.
    Evidence: .sisyphus/evidence/task-8-release-ready.txt

  Scenario: Repo-wide timestamp wording drift check
    Tool: Grep
    Steps: Search `src/cli/docs-output-helper.ts`, `src/agents/docs-index-plan.ts`, `src/agents/docs-config.ts`, `src/index.ts`, `commands/docs-index.md`, `src/cli/personality-meta.ts`, `src/cli/config-manager/index.ts`, and `README.md` for `2026-03-12T18-37-52Z`, `marketing-strategy--2026-03-12T18-37-52Z.md`, `dated section`, and `date suffix`.
    Expected: The exact token and filename examples are present where intended; stale vague phrases are absent from touched files.
    Evidence: .sisyphus/evidence/task-8-wording-drift.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `all touched files above`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [ ] F1. Plan Compliance Audit — oracle
  - Tool: `task(subagent_type="oracle")`
  - Scope: read-only review of all touched files after Task 8
  - Steps: verify the implemented files match the frozen contract (`YYYY-MM-DDTHH-mm-ssZ`, collision rules, preserved legacy artifacts, canonical lane vs timestamped family semantics) and that no touched file reintroduces vague date-only wording
  - Pass condition: Oracle explicitly approves the implementation as consistent with the plan and calls out no blocking deviations
- [ ] F2. Code Quality Review — unspecified-high
  - Tool: delegated code-review task + direct `Read` on all touched files
  - Scope: helper/model/test quality, naming, type safety, and unnecessary complexity
  - Steps: review all touched files for correctness, overengineering, dead code, and type-safety regressions; confirm tests assert behavior rather than implementation details only
  - Pass condition: reviewer reports no blocking code-quality or type-safety concerns
- [ ] F3. Automated Behavioral QA — unspecified-high
  - Tool: `bash`, `grep`
  - Scope: fully automated verification only; no human/manual QA
  - Steps: rerun the targeted docs-history suite plus repo-wide wording drift grep, confirm expected examples are present and stale wording is absent
  - Pass condition: all commands exit `0` and grep results match the expected present/absent sets exactly
- [ ] F4. Scope Fidelity Check — deep
  - Tool: `task(category="deep")`
  - Scope: ensure the implementation stayed within scope and did not mutate adjacent docs-index/CLI behavior beyond the frozen plan
  - Steps: compare touched files and behavior against the Must Have / Must NOT Have sections and identify any scope creep or missed contract surface
  - Pass condition: reviewer explicitly approves scope fidelity with no blocking omissions or out-of-scope changes

### Final Verification Dependencies
- Final Verification Wave starts only after Task 8 completes successfully.
- No commit or final delivery until F1-F4 all pass.
- Any blocking finding from F1-F4 returns work to the relevant task owner before re-running the full verification wave.

## Commit Strategy
- Commit 1: `feat(docs-history): add UTC timestamp contract for docs outputs`
  - Files: `src/cli/docs-output-helper.ts`, `src/agents/docs-index-plan.ts`, `tests/unit/docs-output-helper.test.ts`, `tests/unit/docs-index-plan.test.ts`
- Commit 2: `docs(docs-history): sync docs-index timestamp guidance`
  - Files: `src/agents/docs-config.ts`, `src/index.ts`, `commands/docs-index.md`, `src/cli/personality-meta.ts`, `src/cli/config-manager/index.ts`, `README.md`, `tests/unit/docs-config.test.ts`, `tests/unit/docs-injection.test.ts`, `tests/unit/config-template.test.ts`, plus any CLI wording assertions added during implementation
- If cross-file dependency makes those boundaries unstable, collapse to one final green commit instead of forcing mid-stream commits.

## Success Criteria
- Multiple same-day docs refreshes are unambiguous because the contract uses second-precision UTC tokens.
- `append-dated` and `new-dated-file` use one shared timestamp standard and explicit collision rules.
- `new-dated-file` no longer conflicts conceptually with canonical managed home-file ownership.
- Legacy date-only artifacts remain untouched.
- All touched source, command, runtime, CLI, README, and test surfaces agree on the same examples and semantics.
- Verification commands complete successfully with no path-validation regressions.
