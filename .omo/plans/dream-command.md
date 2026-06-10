# Implement `/dream` Command and Doctor Capability Detection

## TL;DR
> **Summary**: Add a shipped static `/dream` native command for `product-wunderkind` that coordinates a mixed ideation + SOUL-synthesis + exploration workflow across all 6 retained agents, then extend `wunderkind doctor` so project-local runs explicitly report whether `/dream` is available and whether the install is stale.
> **Deliverables**:
> - New `commands/dream.md` static native command asset
> - TDD coverage for packaging, install/upgrade refresh, uninstall removal, and doctor reporting
> - `doctor.ts` standard + verbose `/dream` availability diagnostics with filename-level stale-install detail in verbose mode
> - README updates documenting `/dream`, SOUL usage, and upgrade guidance
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 5 → 6 → 7 → 8

## Context
### Original Request
Deep investigation into a `dream` command for Wunderkind’s 6 retained agents that uses project-local SOUL files, performs the typical work a dream command should do, includes TDD, and is surfaced by project-local `wunderkind doctor` when the current install is or is not up to date.

### Interview Summary
- No official Claude Code `/dream` command exists, so this is a Wunderkind-defined workflow rather than a compatibility clone.
- `/dream` must be a **mixed workflow**: ideation + soul synthesis + exploration.
- The user wants **one shared `/dream`** command, not six separate commands.
- Default behavior is **chat-first, save optional**.
- `wunderkind doctor` must report `/dream` status in **standard output** and provide **filename-level detail in verbose output**.

### Metis Review (gaps addressed)
- Keep v1 additive: **static command asset + doctor diagnostics** only.
- Do **not** add new config keys, new init scaffolding, or SOUL runtime changes.
- Detect **presence skew only** for v1: packaged CLI contains `/dream` but installed native commands are missing `dream.md`.
- Avoid changing shared config-manager contracts unless necessary; compute filename-level diagnostics inside `doctor.ts`.

## Work Objectives
### Core Objective
Ship a stable Wunderkind-native `/dream` command that can leverage existing runtime SOUL overlays and project context, while making stale installs visible during doctor runs without expanding the configuration or initialization contract.

### Deliverables
- `commands/dream.md`
- Updated tests in `tests/unit/cli-installer.test.ts`
- Updated tests in `tests/unit/init-doctor.test.ts`
- Updated tests in `tests/unit/config-manager-coverage.test.ts`
- Updated tests in `tests/unit/uninstall.test.ts` or equivalent removal coverage file
- Updated `src/cli/doctor.ts`
- Updated `README.md`

### Definition of Done (verifiable conditions with commands)
- `tsc --noEmit` exits 0.
- `bun test tests/unit/cli-installer.test.ts` passes.
- `bun test tests/unit/init-doctor.test.ts` passes.
- `bun test tests/unit/config-manager-coverage.test.ts` passes.
- `bun test tests/unit/uninstall.test.ts` passes.
- `bun test tests/unit/` passes.
- `dream.md` is copied into the OpenCode global commands dir by install/upgrade flows.
- Project-context doctor output explicitly reports `/dream` availability and warns cleanly when `dream.md` is missing from installed native commands.

### Must Have
- `/dream` implemented as a **static native command asset** in `commands/dream.md`
- Frontmatter owner `agent: product-wunderkind`
- Mixed workflow instructions that explicitly use:
  - project-local SOUL overlays in `.wunderkind/souls/<agent-key>.md`
  - `AGENTS.md`
  - `.sisyphus/` context where relevant
- Default output remains in chat unless user explicitly asks to save
- Save targets restricted to existing lanes only:
  - `.sisyphus/notepads/`
  - `.sisyphus/evidence/`
- Standard doctor output includes a `/dream` availability signal in project context
- Verbose doctor output identifies missing `dream.md` by filename when install is stale
- Upgrade guidance points users to the standard Wunderkind lifecycle command
- Full TDD coverage for new behavior

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No edits to `src/agents/*` or generated `agents/*.md`
- No new `wunderkind.config.jsonc` keys or schema changes
- No `init` prompt or bootstrap changes
- No SOUL runtime injection changes in `src/index.ts`
- No generated retained `/dream` command in `src/agents/slash-commands.ts`
- No content-hash/content-drift detection for v1; presence skew only
- No default writes to `.sisyphus/plans/`
- No automatic SOUL file mutation by `/dream`

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **TDD** with Bun unit tests and TypeScript no-emit verification
- QA policy: Every task includes agent-executed command/file assertions
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.log`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: command contract + packaging/lifecycle tests + doctor RED tests
- Tasks 1-6

Wave 2: doctor implementation + docs/usage updates + regression hardening
- Tasks 7-9

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 3, 4, 8 |
| 2 | 1 | 7 |
| 3 | 1 | 8 |
| 4 | 1 | 8 |
| 5 | 1 | 7 |
| 6 | 5 | 7 |
| 7 | 2, 5, 6 | 8, 9 |
| 8 | 1, 3, 4, 7 | 9 |
| 9 | 7, 8 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Categories |
|---|---:|---|
| Wave 1 | 6 | quick, unspecified-high |
| Wave 2 | 3 | unspecified-high, writing |
| Final Verification | 4 | oracle, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Lock `/dream` command contract and wording

  **What to do**: Create `commands/dream.md` as a shipped static native command asset owned by `product-wunderkind`. Mirror the structure used in `commands/docs-index.md` and `commands/design-md.md`: frontmatter, `## Command`, `## Responsibilities`, `## Constraints`, `## Notes`, and `<user-request>$ARGUMENTS</user-request>`. The command must define `/dream` as a mixed workflow that synthesizes project-local SOUL context, project knowledge, and exploration findings before producing a coordinated response. It must instruct the coordinator to consider all six retained agents, delegate selectively, default to chat output, and save only when explicitly requested.
  **Must NOT do**: Do not add `dream` to `src/agents/slash-commands.ts`. Do not reference non-existent Claude-native behavior. Do not permit default writes to `.sisyphus/plans/`. Do not instruct the command to mutate SOUL files.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: command-asset wording must be precise, constraint-heavy, and user-facing.
  - Skills: `[]` — Reason: no special skill is required; repo patterns are sufficient.
  - Omitted: `['technical-writer']` — Reason: this is command-contract authoring, not long-form docs production.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 4, 8 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `commands/docs-index.md:1-45` — static coordinator command structure and constraints style.
  - Pattern: `commands/design-md.md:1-49` — static command frontmatter including optional `name:` and explicit responsibilities.
  - API/Type: `src/cli/config-manager/index.ts:1080-1090` — packaged static commands are auto-discovered from `commands/*.md`.
  - API/Type: `src/cli/config-manager/index.ts:1181-1207` — `writeNativeCommandFiles()` copies shipped static command assets.
  - Context: `.sisyphus/plans/soul-architecture.md:5-10` — SOUL files are project-local runtime overlays.
  - Context: `.sisyphus/plans/soul-architecture.md:170-189` — SOUL file lookup convention and runtime usage contract.
  - External: `https://code.claude.com/docs/en/commands.md` — confirms there is no official Claude `/dream` command.
  - External: `https://code.claude.com/docs/en/memory.md` — closest analogue is project memory, not dream.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `commands/dream.md` exists and ends with `<user-request>` / `$ARGUMENTS` / `</user-request>`.
  - [ ] Frontmatter contains `agent: product-wunderkind`.
  - [ ] Command text explicitly references `.wunderkind/souls/`, `AGENTS.md`, and `.sisyphus/`.
  - [ ] Command text explicitly states chat-first behavior and save-on-explicit-request only.
  - [ ] Command text restricts durable output to `.sisyphus/notepads/` and `.sisyphus/evidence/`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Static command contract is valid
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('commands/dream.md').read_text()
assert 'agent: product-wunderkind' in text
assert '.wunderkind/souls/' in text
assert 'AGENTS.md' in text
assert '.sisyphus/notepads/' in text
assert '.sisyphus/evidence/' in text
assert '$ARGUMENTS' in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-1-dream-contract.log

  Scenario: Invalid write target is excluded
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('commands/dream.md').read_text()
assert '.sisyphus/plans/' not in text
assert 'update soul files' not in text.lower()
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-1-dream-contract-error.log
  ```

  **Commit**: YES | Message: `feat(commands): add dream native command contract` | Files: `commands/dream.md`

- [x] 2. Extend packaging and native-command coverage for `dream.md`

  **What to do**: Update the existing native-command writer coverage so it explicitly asserts that `writeNativeCommandFiles()` includes `dream.md` in the global OpenCode commands directory and that the file content contains the expected product-owned command frontmatter. Also add or extend a collision-safety assertion confirming the shipped static `dream` asset does not collide with generated retained command names.
  **Must NOT do**: Do not change command-discovery mechanics. Do not add a generated `/dream` command just to make the test pass.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: this is a focused test extension in an existing coverage file.
  - Skills: `[]` — Reason: repo-native test patterns are already established.
  - Omitted: `['tdd']` — Reason: the project already has direct Bun patterns; no special harness is needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Test: `tests/unit/config-manager-coverage.test.ts:543-572` — existing command-writer and collision coverage pattern.
  - Test: `tests/unit/cli-installer.test.ts:1310-1350` — command asset copy assertions in a dedicated install test.
  - API/Type: `src/cli/config-manager/index.ts:1080-1104` — packaged command enumeration and collision behavior.
  - API/Type: `src/cli/config-manager/index.ts:1142-1147` — generated + static native command file path set.
  - API/Type: `src/cli/config-manager/index.ts:1181-1207` — write path for copied static commands and generated retained commands.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A unit test explicitly checks for `dream.md` in the native commands dir after `writeNativeCommandFiles()`.
  - [ ] A unit test reads installed `dream.md` content and asserts `agent: product-wunderkind`.
  - [ ] Collision coverage still passes without requiring any slash-command registry changes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Command writer includes dream asset
    Tool: Bash
    Steps: run `bun test tests/unit/config-manager-coverage.test.ts`
    Expected: test file passes and includes dream command assertions
    Evidence: .sisyphus/evidence/task-2-packaging-coverage.log

  Scenario: No static/generated name collision introduced
    Tool: Bash
    Steps: run `bun test tests/unit/config-manager-coverage.test.ts --filter "duplicate command names"`
    Expected: collision-related assertions pass without any dream registry additions
    Evidence: .sisyphus/evidence/task-2-packaging-coverage-error.log
  ```

  **Commit**: YES | Message: `test(commands): cover dream packaging contract` | Files: `tests/unit/config-manager-coverage.test.ts`

- [x] 3. Cover install and upgrade refresh behavior for `dream.md`

  **What to do**: Extend CLI installer/upgrade tests so both install scopes and the explicit upgrade lifecycle continue to refresh global native commands and result in `dream.md` being copied into the OpenCode commands directory. Include one assertion that the project-scope install still refreshes global native commands, since command assets are globally managed.
  **Must NOT do**: Do not change install/upgrade plumbing unless tests reveal a real defect. Do not treat `/dream` as project-local only.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: test-only lifecycle assertions built on existing mocks.
  - Skills: `[]` — Reason: existing CLI tests already show the needed pattern.
  - Omitted: `['git-master']` — Reason: no git operations are involved.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Test: `tests/unit/cli-installer.test.ts:324-353` — project/global install calls `writeNativeCommandFiles()`.
  - Test: `tests/unit/cli-installer.test.ts:744-754` — upgrade command failure path for native commands.
  - API/Type: `src/cli/cli-installer.ts:162-181` — install flow writes native command files.
  - API/Type: `src/cli/cli-installer.ts:286-314` — upgrade flow refreshes native command files.
  - API/Type: `src/cli/init.ts:968-980` — project init also refreshes native commands through the same writer.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Install tests assert native command refresh still occurs for both project and global scope.
  - [ ] At least one test reads installed command files and confirms `dream.md` is among them.
  - [ ] Upgrade-path tests continue to pass with `dream.md` present.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Install lifecycle refreshes dream command
    Tool: Bash
    Steps: run `bun test tests/unit/cli-installer.test.ts`
    Expected: install and upgrade command tests pass, including dream asset assertions
    Evidence: .sisyphus/evidence/task-3-install-upgrade.log

  Scenario: Project-scope install still refreshes shared commands
    Tool: Bash
    Steps: run `bun test tests/unit/cli-installer.test.ts --filter "project scope install"`
    Expected: test passes and verifies shared native command refresh path remains intact
    Evidence: .sisyphus/evidence/task-3-install-upgrade-error.log
  ```

  **Commit**: YES | Message: `test(cli): verify dream command refresh on install and upgrade` | Files: `tests/unit/cli-installer.test.ts`

- [x] 4. Cover uninstall and removal behavior for the shared `dream` asset

  **What to do**: Extend removal-path coverage so global uninstall and low-level native-command removal expectations continue to include `dream.md` as part of the shared native command set. Ensure project uninstall remains unchanged and does not attempt to remove global native commands.
  **Must NOT do**: Do not add dream-specific uninstall branches. Do not make project uninstall remove global command files.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: focused test coverage against existing removal behavior.
  - Skills: `[]` — Reason: existing tests already model removal contracts.
  - Omitted: `['tdd']` — Reason: existing Bun patterns are already sufficient.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Test: `tests/unit/uninstall.test.ts:146-163` — global uninstall removes shared native commands.
  - Test: `tests/unit/uninstall.test.ts:169-214` — project uninstall preserves shared native capabilities.
  - Test: `tests/unit/config-manager-coverage.test.ts:525-528` — low-level `removeNativeCommandFiles()` removal expectations.
  - API/Type: `src/cli/config-manager/index.ts:1283-1299` — command-file removal implementation.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Removal-path tests continue to treat `dream.md` as part of the shared global native command set.
  - [ ] Project uninstall tests remain unchanged in behavior: no global command removal for project-only uninstall.
  - [ ] Global removal coverage still passes after adding `dream.md`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Global uninstall/removal covers dream command set
    Tool: Bash
    Steps: run `bun test tests/unit/uninstall.test.ts tests/unit/config-manager-coverage.test.ts`
    Expected: both test files pass with dream included in the shared command set
    Evidence: .sisyphus/evidence/task-4-uninstall.log

  Scenario: Project uninstall still preserves shared global commands
    Tool: Bash
    Steps: run `bun test tests/unit/uninstall.test.ts --filter "project uninstall"`
    Expected: assertions confirm no global native command removal occurs
    Evidence: .sisyphus/evidence/task-4-uninstall-error.log
  ```

  **Commit**: YES | Message: `test(uninstall): keep dream in shared command removal coverage` | Files: `tests/unit/uninstall.test.ts`, `tests/unit/config-manager-coverage.test.ts`

- [x] 5. Define RED tests for doctor `/dream` availability reporting

  **What to do**: Add/extend doctor tests so project-context standard output includes an explicit `/dream` capability line and verbose output can name `dream.md` when the installed native command set is stale. Use mocks to simulate: (a) healthy install, (b) package contains dream but installed native commands are missing it, and (c) non-project or non-installed cases still behave gracefully.
  **Must NOT do**: Do not weaken existing aggregate health reporting. Do not make verbose output dump every command filename unless the file is missing.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: doctor behavior is user-facing and requires precise RED test coverage before implementation.
  - Skills: `[]` — Reason: current mock structure is enough.
  - Omitted: `['oracle']` — Reason: this is concrete CLI testing, not architecture review.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Test: `tests/unit/init-doctor.test.ts:201-219` — captured doctor output helper.
  - Test: `tests/unit/init-doctor.test.ts:231-265` — project doctor context mock helper.
  - Test: `tests/unit/init-doctor.test.ts:900-919` — current verbose path assertions for native command directories.
  - API/Type: `src/cli/doctor.ts:347-421` — project-context health and warning generation.
  - API/Type: `src/cli/doctor.ts:423-488` — verbose project config and warnings output.
  - API/Type: `src/cli/config-manager/index.ts:1242-1247` — current aggregate native command detection contract.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Standard doctor tests assert an explicit `/dream` availability line in project context.
  - [ ] Verbose doctor tests assert missing `dream.md` is named in stale-install warnings.
  - [ ] Non-stale doctor tests assert filename-level warning is absent when `dream.md` is available.
  - [ ] Added tests fail before doctor implementation changes are made.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: RED doctor tests capture missing dream filename behavior
    Tool: Bash
    Steps: run `bun test tests/unit/init-doctor.test.ts`
    Expected: newly added dream-related tests fail before doctor implementation is updated
    Evidence: .sisyphus/evidence/task-5-doctor-red.log

  Scenario: Existing doctor coverage remains readable and scoped
    Tool: Bash
    Steps: run `bun test tests/unit/init-doctor.test.ts --filter "verbose"`
    Expected: failures, if any, are limited to newly introduced dream diagnostics expectations
    Evidence: .sisyphus/evidence/task-5-doctor-red-error.log
  ```

  **Commit**: YES | Message: `test(doctor): define dream availability diagnostics` | Files: `tests/unit/init-doctor.test.ts`

- [x] 6. Decide and encode the doctor filename-diff mechanism inside `doctor.ts`

  **What to do**: Implement the smallest possible filename-level stale-install detection directly inside `src/cli/doctor.ts`. Reuse aggregate detection from `detectNativeCommandFiles()` for standard health lines, then add a local verbose-only comparison between packaged command names and installed command filenames so missing `dream.md` can be named explicitly. Keep the output additive: standard mode shows an explicit `/dream` availability signal, while verbose mode appends the missing filename detail.
  **Must NOT do**: Do not change the exported return type of `detectNativeCommandFiles()`. Do not add content-hash checks. Do not scan outside the global OpenCode commands directory.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this is a behavior change in a core diagnostics surface.
  - Skills: `[]` — Reason: repo-local logic is straightforward and should stay narrow.
  - Omitted: `['explore']` — Reason: all necessary repo facts are already established in this plan.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7, 8, 9 | Blocked By: 5

  **References** (executor has NO interview context — be exhaustive):
  - API/Type: `src/cli/doctor.ts:347-421` — current warning and project health logic.
  - API/Type: `src/cli/doctor.ts:423-488` — verbose output and warning section rendering.
  - API/Type: `src/cli/config-manager/index.ts:1080-1090` — packaged command names source.
  - API/Type: `src/cli/config-manager/index.ts:1142-1147` — native installed command file path set.
  - API/Type: `src/cli/config-manager/index.ts:1242-1247` — aggregate command-presence contract to preserve.
  - Test: `tests/unit/init-doctor.test.ts:900-919` — existing verbose assertions to keep additive.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `doctor.ts` reports `/dream available:` or equivalent explicit capability state in project context standard output.
  - [ ] Verbose mode names `dream.md` when it is missing from installed command files.
  - [ ] Aggregate `global native commands present:` behavior remains intact.
  - [ ] No public config-manager signatures change.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Doctor diagnostics now satisfy dream tests
    Tool: Bash
    Steps: run `bun test tests/unit/init-doctor.test.ts`
    Expected: dream-related doctor tests pass and no existing doctor assertions regress
    Evidence: .sisyphus/evidence/task-6-doctor-impl.log

  Scenario: Type-level doctor/config-manager contracts remain stable
    Tool: Bash
    Steps: run `tsc --noEmit`
    Expected: command exits 0 without requiring config-manager signature changes
    Evidence: .sisyphus/evidence/task-6-doctor-impl-error.log
  ```

  **Commit**: YES | Message: `feat(doctor): report dream availability and stale command files` | Files: `src/cli/doctor.ts`

- [x] 7. Harden `/dream` command content against scope drift and mixed-workflow ambiguity

  **What to do**: After doctor implementation is in place, refine `commands/dream.md` so its responsibilities, constraints, and notes are specific enough that execution agents need zero judgment calls about when to use SOUL overlays, what to inspect, when to delegate, and when to save. Ensure the workflow explicitly covers ideation, soul synthesis, and exploration in one command. Make the coordinator responsible for pulling in the six-agent viewpoints selectively rather than always forcing all six to speak.
  **Must NOT do**: Do not broaden the command into a planning-only or docs-output-only workflow. Do not make saving mandatory. Do not imply that every `/dream` invocation must persist artifacts.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this is precision editing of a user-facing command contract.
  - Skills: `[]` — Reason: no additional skill support is required.
  - Omitted: `['product-wunderkind']` — Reason: this is command asset drafting, not agent delegation.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 8, 9 | Blocked By: 2, 5, 6

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `commands/docs-index.md:6-41` — coordinator-style responsibility and constraint wording.
  - Pattern: `commands/design-md.md:7-45` — exact-mode/constraint style for a workflow command.
  - Context: `.sisyphus/plans/dream-command.md:1-999` — preserve all decisions already fixed in this plan.
  - Context: `.sisyphus/plans/soul-architecture.md:44-99` — SOUL location and format rules that the command may rely on.
  - External: `https://code.claude.com/docs/en/skills.md` — closest analogue is a custom workflow/skill, reinforcing that `/dream` is Wunderkind-native.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `commands/dream.md` explicitly covers ideation, synthesis, and exploration in one workflow.
  - [ ] Command text states that specialist delegation is selective and evidence-driven.
  - [ ] Command text keeps saving optional and bounded to allowed lanes.
  - [ ] Command text contains no references to unsupported config/init contracts.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Dream contract remains decision-complete
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('commands/dream.md').read_text().lower()
assert 'ideation' in text or 'vision' in text
assert 'synthesis' in text or 'synthesize' in text
assert 'exploration' in text or 'explore' in text
assert 'save only' in text or 'only when explicitly requested' in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-7-dream-hardening.log

  Scenario: Dream contract avoids unsupported rollout surfaces
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('commands/dream.md').read_text().lower()
for forbidden in ['wunderkind.config.jsonc', 'new config key', 'init prompt', '.sisyphus/plans/']:
    assert forbidden not in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-7-dream-hardening-error.log
  ```

  **Commit**: YES | Message: `feat(commands): harden dream workflow guidance` | Files: `commands/dream.md`

- [x] 8. Update README and user-facing upgrade guidance for `/dream`

  **What to do**: Update `README.md` to document the new `/dream` command in the native-command/product-surface sections. Explain that `/dream` is a Wunderkind-native mixed workflow using existing project context and SOUL overlays. Add one explicit note that older installs must run the normal Wunderkind upgrade lifecycle to receive newly shipped native commands like `/dream`, and that `wunderkind doctor` will surface missing command assets.
  **Must NOT do**: Do not claim Claude Code compatibility. Do not document `/dream` as requiring re-init or new config keys.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this is concise product documentation and upgrade guidance.
  - Skills: `[]` — Reason: existing README style is sufficient.
  - Omitted: `['technical-writer']` — Reason: change is localized and product-contract focused.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 9 | Blocked By: 1, 3, 4, 6

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `README.md:109-121` — upgrade lifecycle explanation.
  - Pattern: `README.md:253-258` — native asset install note.
  - Pattern: `README.md:403-405` — SOUL overlay explanation in the Agents section.
  - Pattern: `README.md:454-459` — configuration section mentions durable SOUL context.
  - API/Type: `src/cli/doctor.ts:347-488` — doctor will be the diagnostic surface referenced in docs.

  **Acceptance Criteria** (agent-executable only):
  - [ ] README mentions `/dream` in a discoverable command/workflow section.
  - [ ] README explains `/dream` uses project-local SOUL overlays and current project context.
  - [ ] README tells users to run the standard Wunderkind upgrade lifecycle if `/dream` is missing after package update.
  - [ ] README does not claim any new init or config requirement.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: README includes dream and upgrade guidance
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('README.md').read_text().lower()
assert '/dream' in text
assert 'soul' in text
assert 'upgrade' in text
assert 'doctor' in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-8-readme.log

  Scenario: README avoids unsupported setup claims
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('README.md').read_text().lower()
assert 're-run init to get /dream' not in text
assert 'dream config key' not in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-8-readme-error.log
  ```

  **Commit**: YES | Message: `docs(readme): document dream workflow and upgrade guidance` | Files: `README.md`

- [x] 9. Run the full verification gate and close regression risk

  **What to do**: Execute the agreed verification sequence after all feature work lands: targeted test files first, then `tsc --noEmit`, then the full `bun test tests/unit/` suite. If any failures occur, fix them before considering the feature complete. Ensure evidence logs are captured for the command asset, doctor output behavior, and lifecycle flows.
  **Must NOT do**: Do not stop after partial test success. Do not skip the full-unit-suite pass. Do not treat warnings-only behavior as sufficient if any assertions fail.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this is the regression and release gate.
  - Skills: `[]` — Reason: standard repo verification commands are enough.
  - Omitted: `['playwright']` — Reason: no browser verification is needed for this feature.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1-F4 | Blocked By: 6, 7, 8

  **References** (executor has NO interview context — be exhaustive):
  - Command: `package.json:27-35` — authoritative test and build scripts.
  - Test: `tests/unit/cli-installer.test.ts` — lifecycle verification target.
  - Test: `tests/unit/init-doctor.test.ts` — doctor verification target.
  - Test: `tests/unit/config-manager-coverage.test.ts` — native command plumbing verification target.
  - Test: `tests/unit/uninstall.test.ts` — shared native command removal verification target.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test tests/unit/cli-installer.test.ts` passes.
  - [ ] `bun test tests/unit/init-doctor.test.ts` passes.
  - [ ] `bun test tests/unit/config-manager-coverage.test.ts` passes.
  - [ ] `bun test tests/unit/uninstall.test.ts` passes.
  - [ ] `tsc --noEmit` passes.
  - [ ] `bun test tests/unit/` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Targeted verification gate succeeds
    Tool: Bash
    Steps: run `bun test tests/unit/cli-installer.test.ts && bun test tests/unit/init-doctor.test.ts && bun test tests/unit/config-manager-coverage.test.ts && bun test tests/unit/uninstall.test.ts && tsc --noEmit`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-9-verification.log

  Scenario: Full regression suite succeeds
    Tool: Bash
    Steps: run `bun test tests/unit/`
    Expected: command exits 0 with 0 failures
    Evidence: .sisyphus/evidence/task-9-verification-error.log
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle

  **What to do**: Run a fresh oracle review against the completed implementation and compare it directly to this plan file. Confirm that `/dream` was shipped as a static `commands/dream.md` asset, that doctor reports `/dream` availability in project context, that verbose doctor output names `dream.md` when missing, and that no forbidden scope expansions landed.
  **Must NOT do**: Do not review only the latest diff in isolation. Do not approve if any Must NOT Have item from this plan was violated.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is a cross-file compliance audit against the full plan contract.
  - Skills: `[]` — Reason: plan-vs-implementation comparison is sufficient.
  - Omitted: `['git-master']` — Reason: no git history work is required.

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: none | Blocked By: 9

  **References**:
  - Plan: `.sisyphus/plans/dream-command.md:1-999` — authoritative contract to audit against.
  - Command: `commands/dream.md` — shipped `/dream` asset to verify.
  - Code: `src/cli/doctor.ts` — dream availability diagnostics implementation.
  - Tests: `tests/unit/init-doctor.test.ts` — doctor behavior contract.

  **Acceptance Criteria**:
  - [ ] Oracle explicitly reports PASS/FAIL for plan compliance.
  - [ ] Oracle confirms no forbidden scope additions (init/config/schema/agent-factory changes).
  - [ ] Oracle report is saved for user review.

  **QA Scenarios**:
  ```
  Scenario: Oracle compliance audit passes
    Tool: task
    Steps: delegate to `oracle` with the completed diff/changed files plus this plan file and request a pass/fail compliance audit
    Expected: oracle returns an explicit approval with no critical gaps
    Evidence: .sisyphus/evidence/f1-plan-compliance.md

  Scenario: Oracle catches scope drift if present
    Tool: task
    Steps: require oracle to explicitly check for forbidden files or surfaces (`src/agents/*`, config/schema/init changes)
    Expected: oracle flags any scope drift as a failure instead of silently approving
    Evidence: .sisyphus/evidence/f1-plan-compliance-error.md
  ```

- [x] F2. Code Quality Review — unspecified-high

  **What to do**: Run a fresh code review focused on clarity, maintainability, duplication, and test quality across `commands/dream.md`, `src/cli/doctor.ts`, and all touched test files. Require explicit callouts for brittle assertions, over-coupled test setup, or logic that should have remained in existing generic plumbing.
  **Must NOT do**: Do not limit review to style-only feedback. Do not accept “looks good” without concrete file-based reasoning.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this is a general code-quality and test-quality audit.
  - Skills: `[]` — Reason: no specialized skill is necessary.
  - Omitted: `['tdd']` — Reason: the implementation is already complete; this is a review pass.

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: none | Blocked By: 9

  **References**:
  - Command: `commands/dream.md`
  - Code: `src/cli/doctor.ts`
  - Tests: `tests/unit/cli-installer.test.ts`
  - Tests: `tests/unit/init-doctor.test.ts`
  - Tests: `tests/unit/config-manager-coverage.test.ts`
  - Tests: `tests/unit/uninstall.test.ts`

  **Acceptance Criteria**:
  - [ ] Reviewer returns an explicit approval or a bounded issue list.
  - [ ] No unaddressed critical/high-severity quality issues remain.
  - [ ] Review output is saved for user review.

  **QA Scenarios**:
  ```
  Scenario: Fresh code review approves implementation quality
    Tool: task
    Steps: delegate to `unspecified-high` with the changed files and ask for a severity-ranked review of maintainability, duplication, brittleness, and test quality
    Expected: reviewer returns APPROVE or only non-blocking notes
    Evidence: .sisyphus/evidence/f2-code-quality.md

  Scenario: Review catches brittle or over-scoped changes if present
    Tool: task
    Steps: instruct reviewer to specifically inspect doctor diff size, duplicated logic, and overfit test assertions
    Expected: reviewer flags any critical/high issues instead of soft-passing them
    Evidence: .sisyphus/evidence/f2-code-quality-error.md
  ```

- [x] F3. Real Manual QA — unspecified-high

  **What to do**: Perform an agent-executed manual CLI QA pass in a disposable sandbox project. Validate healthy and stale-install behavior using real commands where feasible: confirm `/dream` is installed into the global OpenCode commands dir after refresh, confirm `wunderkind doctor` reports `/dream` availability in project context, and confirm verbose doctor output names `dream.md` when it is manually removed from the installed commands dir in the sandbox.
  **Must NOT do**: Do not rely only on unit-test output for this pass. Do not mutate the real user project state outside the disposable sandbox.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this is a real CLI behavior check rather than static review.
  - Skills: `[]` — Reason: shell-driven validation is sufficient.
  - Omitted: `['playwright']` — Reason: no browser surface exists.

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: none | Blocked By: 9

  **References**:
  - Command: `package.json:27-35` — build/test scripts if setup verification is needed.
  - Code: `src/cli/cli-installer.ts:162-181` — install writes native commands.
  - Code: `src/cli/cli-installer.ts:286-314` — upgrade refreshes native commands.
  - Code: `src/cli/doctor.ts:347-488` — project-context doctor behavior.

  **Acceptance Criteria**:
  - [ ] Sandbox QA confirms healthy `/dream` installation state.
  - [ ] Sandbox QA confirms stale-install warning path with missing `dream.md` in verbose mode.
  - [ ] QA notes and command outputs are saved for user review.

  **QA Scenarios**:
  ```
  Scenario: Healthy install reports dream as available
    Tool: Bash
    Steps: create a disposable temp project, run the local Wunderkind install/upgrade flow needed for the sandbox, then run `wunderkind doctor` inside the sandbox project
    Expected: doctor reports `/dream` as available and no missing-file warning appears
    Evidence: .sisyphus/evidence/f3-manual-qa.log

  Scenario: Stale install is detected by verbose doctor
    Tool: Bash
    Steps: in the disposable sandbox only, remove the installed `dream.md` from the global OpenCode commands dir, then run `wunderkind doctor --verbose`
    Expected: verbose doctor output explicitly names `dream.md` as missing
    Evidence: .sisyphus/evidence/f3-manual-qa-error.log
  ```

- [x] F4. Scope Fidelity Check — deep

  **What to do**: Run a fresh deep reviewer pass to verify that the implementation solved exactly the requested problem and did not smuggle in adjacent platform work. Confirm the shipped behavior is limited to `/dream`, doctor visibility, lifecycle refresh coverage, and docs updates.
  **Must NOT do**: Do not approve if the implementation adds unrelated workflow surfaces, extra command variants, config expansion, or non-v1 drift detection.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is a high-context scope-control audit.
  - Skills: `[]` — Reason: no special skill is needed.
  - Omitted: `['oracle']` — Reason: F1 already covers formal plan compliance.

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: none | Blocked By: 9

  **References**:
  - Plan: `.sisyphus/plans/dream-command.md:1-999`
  - Command: `commands/dream.md`
  - Code: `src/cli/doctor.ts`
  - Docs: `README.md`

  **Acceptance Criteria**:
  - [ ] Reviewer confirms the implementation is scope-accurate.
  - [ ] Reviewer explicitly checks for forbidden expansions and v2 ideas landing early.
  - [ ] Review output is saved for user review.

  **QA Scenarios**:
  ```
  Scenario: Deep scope audit passes
    Tool: task
    Steps: delegate to `deep` with the changed files and ask whether the implementation stayed within the exact requested scope and v1 decisions
    Expected: deep reviewer returns APPROVE with no critical scope drift
    Evidence: .sisyphus/evidence/f4-scope-fidelity.md

  Scenario: Deep scope audit rejects future-work leakage if present
    Tool: task
    Steps: require the reviewer to explicitly check for extra command variants, new config/init/schema work, and content-drift detection
    Expected: reviewer flags any such additions as failures
    Evidence: .sisyphus/evidence/f4-scope-fidelity-error.md
  ```

## Commit Strategy
- Commit 1: `feat(commands): add dream native command contract`
- Commit 2: `test(commands): cover dream packaging and lifecycle refresh`
- Commit 3: `test(doctor): define dream availability diagnostics`
- Commit 4: `feat(doctor): report dream availability and stale command files`
- Commit 5: `docs(readme): document dream workflow and upgrade guidance`

## Success Criteria
- `/dream` is shipped as a static command asset with product-owned coordination semantics.
- Existing SOUL architecture is reused exactly as-is; no new runtime/context plumbing is introduced.
- Install, init, and upgrade flows refresh the command asset through existing native command plumbing.
- Uninstall/removal paths continue to remove shared native commands through existing generic cleanup.
- Project-local doctor clearly answers whether `/dream` is available.
- Verbose doctor output pinpoints `dream.md` as missing when the package is newer than the installed native command set.
- All named test files and the full unit suite pass.
