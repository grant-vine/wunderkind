# Add Explicit Draft Support to wunderkind_write_artifact

## TL;DR
> **Summary**: Add a first-class `draft` durable-artifact kind so `product-wunderkind` can write `.sisyphus/drafts/*.md` through a bounded lane, without weakening existing `notepad` or other artifact security rules.
> **Deliverables**:
> - New `draft` kind in the artifact writer type and tool schema
> - Bounded `.sisyphus/drafts/` lane support for the intended agent(s)
> - Validation rules and tests for happy path, wrong agent, wrong path, and traversal safety
> - Updated tool/prompt wording where the durable writer enumerates supported artifact types
> **Effort**: Short
> **Parallel**: NO
> **Critical Path**: 1 → 2 → 3 → 4 → F1-F4

## Context
### Original Request
Fix the issue where Prometheus/`product-wunderkind` sometimes tries to use `wunderkind_write_artifact` for draft files and gets rejected. Preferred solution: add explicit draft support rather than broadening `notepad`.

### Interview Summary
- Current failure example used `agentKey=product-wunderkind`, `kind=notepad`, `relativePath=drafts/release-0-13-0.md`.
- The rejection is real under today’s bounded-lane policy.
- `.sisyphus/plans/*.md` is already allowed for `product-wunderkind`.
- The selected fix is to add an explicit `draft` artifact kind rather than letting `notepad` write drafts.

### Research Summary
- `src/artifact-writer.ts` currently defines `DurableArtifactKind = "prd" | "plan" | "issue" | "docs-output" | "design-md" | "notepad"`.
- `product-wunderkind` currently allows `.sisyphus/prds`, `.sisyphus/plans`, `.sisyphus/issues`, and `.sisyphus/notepads`.
- `kind="notepad"` additionally enforces `.sisyphus/notepads/` path restriction.
- `.sisyphus/drafts/*.md` is not currently an allowed lane.
- `src/index.ts` exposes the artifact kinds via tool schema enum and prompt-facing description text.

### Metis Review (gaps addressed)
- Keep the core fix narrow: `draft` kind + bounded lane + tests + prompt/tool schema updates.
- Do not silently broaden `notepad` semantics.
- Treat `wunderkind init` and broader docs/prompt updates as optional follow-ups unless intentionally included.
- Use tests-first to lock the new lane contract before implementation.

## Work Objectives
### Core Objective
Add explicit, secure, first-class support for draft artifacts in `wunderkind_write_artifact` so planners can create `.sisyphus/drafts/*.md` through the bounded writer without weakening existing artifact lane rules.

### Deliverables
- Updated `DurableArtifactKind` and lane-validation logic in `src/artifact-writer.ts`
- Updated tool schema and wording in `src/index.ts`
- Expanded artifact-writer unit coverage for the new `draft` kind
- Optional: bootstrap/docs follow-ups only if intentionally included during execution

### Definition of Done (verifiable conditions with commands)
- `bun test tests/unit/artifact-writer.test.ts` exits 0.
- `tsc --noEmit` exits 0.
- `bun test tests/unit/` exits 0.
- `product-wunderkind` can write to `.sisyphus/drafts/*.md` via `writeDurableArtifact` in tests.
- Disallowed agents and disallowed paths still fail with explicit errors.

### Must Have
- Add explicit `draft` kind support; do not overload `notepad`.
- Enforce `.sisyphus/drafts/` path restriction for `kind="draft"`.
- Preserve existing traversal protection and bounded-lane checks.
- Keep `.sisyphus/plans/` behavior unchanged because it already works.
- Update all prompt/tool-schema surfaces that enumerate artifact kinds.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No broadening of `notepad` to accept draft paths.
- No removal or weakening of existing lane restrictions.
- No unrelated artifact-kind changes.
- No automatic migration of existing `.sisyphus/drafts/*` files.
- No new CLI flags or new publish/release behavior.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **TDD / red-green-refactor** using the existing artifact-writer unit suite pattern
- QA policy: Every task includes agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> This change is intentionally narrow and sequential.

Wave 1: tests-first contract lock and core implementation
- Tasks 1-3

Wave 2: optional bootstrap/docs follow-up plus regression closure
- Tasks 4-5

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2 |
| 2 | 1 | 3 |
| 3 | 2 | 4, 5 |
| 4 | 3 | 5 |
| 5 | 3, 4 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Categories |
|---|---:|---|
| Wave 1 | 3 | unspecified-high |
| Wave 2 | 2 | unspecified-high, writing |
| Final Verification | 4 | oracle, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Add red tests for the new `draft` artifact contract

  **What to do**: Extend `tests/unit/artifact-writer.test.ts` with the new `draft` contract before any production changes. Add tests for the happy path, wrong agent rejection, wrong path-prefix rejection, and traversal safety. Follow the existing sandbox/cleanup pattern already used in this file.
  **Must NOT do**: Do not update production code first. Do not broaden existing tests into unrelated artifact behavior.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: test-first contract locking is the safest way to add a new bounded lane.
  - Skills: [`tdd`] - Reason: this task is explicitly red-phase work.
  - Omitted: [`technical-writer`] - Reason: no docs work yet.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Implementation target: `src/artifact-writer.ts`
  - Existing tests: `tests/unit/artifact-writer.test.ts`
  - Tool exposure: `src/index.ts:91-107`

  **Acceptance Criteria** (agent-executable only):
  - [ ] Four draft-focused tests exist: happy path, wrong agent, wrong path prefix, traversal safety.
  - [ ] The new tests fail before the implementation change.
  - [ ] Existing artifact-writer tests remain readable and follow the current suite pattern.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Red tests fail before implementation
    Tool: Bash
    Steps: run `bun test tests/unit/artifact-writer.test.ts`
    Expected: command exits non-zero with failures tied to missing `draft` support
    Evidence: .sisyphus/evidence/task-1-draft-red-tests.log

  Scenario: Test file still compiles structurally
    Tool: Bash
    Steps: run `tsc --noEmit`
    Expected: command exits 0 or fails only on the intentionally missing production support, not malformed tests
    Evidence: .sisyphus/evidence/task-1-draft-red-tests-error.log
  ```

  **Commit**: YES | Message: `test(artifact-writer): add draft kind contract coverage` | Files: `tests/unit/artifact-writer.test.ts`

- [ ] 2. Implement bounded `draft` support in `src/artifact-writer.ts`

  **What to do**: Add `draft` to `DurableArtifactKind`, extend the allowed artifact roots for the intended agent(s), and add explicit `validateArtifactKind` enforcement so `kind="draft"` only writes under `.sisyphus/drafts/`. Preserve the current traversal guard and all unrelated lane behavior unchanged.
  **Must NOT do**: Do not weaken the generic allowed-root check. Do not allow `draft` to write anywhere outside `.sisyphus/drafts/`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the core security-boundary implementation.
  - Skills: [`tdd`] - Reason: it must turn the red tests green cleanly.
  - Omitted: [`improve-codebase-architecture`] - Reason: the design is already chosen.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Artifact writer: `src/artifact-writer.ts`
  - Tests: `tests/unit/artifact-writer.test.ts`
  - Current allowed roots and validation branches in `src/artifact-writer.ts`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `draft` is part of `DurableArtifactKind`.
  - [ ] `product-wunderkind` can write `.sisyphus/drafts/*.md` through `writeDurableArtifact`.
  - [ ] Wrong-agent and wrong-path draft writes still fail with explicit errors.
  - [ ] Traversal attempts continue to fail.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Draft implementation turns tests green
    Tool: Bash
    Steps: run `bun test tests/unit/artifact-writer.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-2-draft-implementation.log

  Scenario: Type safety holds after adding new kind
    Tool: Bash
    Steps: run `tsc --noEmit`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-2-draft-implementation-error.log
  ```

  **Commit**: YES | Message: `feat(artifact-writer): add bounded draft lane support` | Files: `src/artifact-writer.ts`

- [ ] 3. Expose `draft` in the durable writer tool schema and prompt-facing descriptions

  **What to do**: Update `src/index.ts` so the `wunderkind_write_artifact` schema accepts `draft`, and all prompt-facing descriptions that enumerate artifact kinds mention drafts explicitly. Ensure the tool description and inline guidance stay in sync with the actual artifact-writer contract.
  **Must NOT do**: Do not add extra artifact kinds. Do not leave the schema and implementation out of sync.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: tool schema drift would create runtime confusion.
  - Skills: [`tdd`] - Reason: this should be validated immediately after the writer change.
  - Omitted: [`technical-writer`] - Reason: this is a bounded product-surface sync task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4, 5 | Blocked By: 2

  **References** (executor has NO interview context - be exhaustive):
  - Tool schema and descriptions: `src/index.ts:91-107`, `src/index.ts:241-245`
  - Artifact writer contract: `src/artifact-writer.ts`
  - Existing test coverage plus any relevant plugin-surface tests

  **Acceptance Criteria** (agent-executable only):
  - [ ] `draft` is accepted by the tool schema.
  - [ ] Tool descriptions mention drafts alongside the other bounded artifact lanes.
  - [ ] `tsc --noEmit` and artifact-writer tests still pass after the schema update.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Tool schema and writer stay aligned
    Tool: Bash
    Steps: run `tsc --noEmit && bun test tests/unit/artifact-writer.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-3-tool-schema-sync.log

  Scenario: Draft kind is visible in the prompt-facing surface
    Tool: Bash
    Steps: run `grep -n "draft" src/index.ts`
    Expected: command exits 0 with matches in the schema and description/guidance text
    Evidence: .sisyphus/evidence/task-3-tool-schema-sync-error.log
  ```

  **Commit**: YES | Message: `feat(plugin): expose draft durable artifact kind` | Files: `src/index.ts`

- [ ] 4. Optionally bootstrap `.sisyphus/drafts/` and document the new lane if implementation chooses first-class UX parity

  **What to do**: If the implementer determines that drafts should be a first-class bootstrapped lane rather than just a write-on-demand lane, update `wunderkind init` and the minimum necessary docs to create and explain `.sisyphus/drafts/`. If this parity is not selected, record the reason and skip code changes.
  **Must NOT do**: Do not make this task mandatory if the core draft-lane fix is already complete and secure.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is mostly UX/documentation parity work.
  - Skills: [`technical-writer`] - Reason: any docs change should stay crisp and minimal.
  - Omitted: [`tdd`] - Reason: this task may legitimately be a no-op by design.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: 3

  **References** (executor has NO interview context - be exhaustive):
  - Init bootstrap: `src/cli/init.ts`
  - Maintainer docs: `AGENTS.md`
  - User docs: `README.md`
  - Existing `.sisyphus` directory bootstrap patterns

  **Acceptance Criteria** (agent-executable only):
  - [ ] Either `.sisyphus/drafts/` is bootstrapped/documented intentionally, or a no-op decision is recorded with rationale.
  - [ ] No core draft-lane security behavior depends on this optional parity step.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Optional parity decision is explicit
    Tool: Bash
    Steps: run `grep -R "drafts" README.md AGENTS.md src/cli/init.ts .sisyphus/notepads 2>/dev/null`
    Expected: either intended parity references exist, or a recorded no-op rationale exists in notepads/evidence
    Evidence: .sisyphus/evidence/task-4-draft-parity.log

  Scenario: Core functionality does not depend on optional parity changes
    Tool: Bash
    Steps: run `bun test tests/unit/artifact-writer.test.ts`
    Expected: command exits 0 regardless of whether optional parity work was applied
    Evidence: .sisyphus/evidence/task-4-draft-parity-error.log
  ```

  **Commit**: YES/NO | Message: `docs(init): add optional draft lane parity` | Files: `src/cli/init.ts`, `README.md`, `AGENTS.md` if changed

- [ ] 5. Run full regression and release the lane fix as an isolated change set

  **What to do**: Run the focused and full repo verification gates after all selected changes land. Confirm that the artifact-writer change set is isolated, safe, and ready for normal commit/release flow.
  **Must NOT do**: Do not stop after the focused suite only. Do not mix in unrelated artifact or release changes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the regression gate.
  - Skills: `[]` - Reason: standard repo verification is enough.
  - Omitted: [`git-master`] - Reason: no history surgery is needed.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1-F4 | Blocked By: 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - `package.json:27-34` - build/test scripts
  - Touched files from Tasks 1-4

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test tests/unit/artifact-writer.test.ts` passes.
  - [ ] `tsc --noEmit` passes.
  - [ ] `bun test tests/unit/` passes.
  - [ ] The change set remains limited to the intended draft-lane support work.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Focused draft-lane gate succeeds
    Tool: Bash
    Steps: run `bun test tests/unit/artifact-writer.test.ts && tsc --noEmit`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-5-draft-regression.log

  Scenario: Full repo regression suite succeeds
    Tool: Bash
    Steps: run `bun test tests/unit/`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-5-draft-regression-error.log
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle

  **QA Scenario**:
  ```
  Scenario: Oracle confirms implementation matches this plan
    Tool: task(subagent_type="oracle")
    Steps: run a fresh oracle review against the completed branch diff plus `.sisyphus/plans/artifact-writer-draft-support.md`; require verification that `draft` was added as a distinct kind, `.sisyphus/drafts/` stayed bounded, `notepad` semantics were preserved, and no out-of-scope behavior was changed
    Expected: oracle returns APPROVE and evidence is saved to `.sisyphus/evidence/f1-plan-compliance.md`
    Evidence: .sisyphus/evidence/f1-plan-compliance.md
  ```

- [ ] F2. Code Quality Review — unspecified-high

  **QA Scenario**:
  ```
  Scenario: Code quality review approves the lane change
    Tool: task(category="unspecified-high")
    Steps: run a fresh reviewer over the touched files (`src/artifact-writer.ts`, `src/index.ts`, `tests/unit/artifact-writer.test.ts`, plus any optional parity files) and require review of type safety, bounded-lane logic, error clarity, and unnecessary complexity
    Expected: reviewer returns APPROVE and evidence is saved to `.sisyphus/evidence/f2-code-quality.md`
    Evidence: .sisyphus/evidence/f2-code-quality.md
  ```

- [ ] F3. Real Manual QA — unspecified-high

  **QA Scenario**:
  ```
  Scenario: Fresh agent executes the end-to-end verification commands
    Tool: task(category="unspecified-high")
    Steps: run `bun test tests/unit/artifact-writer.test.ts`, `tsc --noEmit`, and `bun test tests/unit/`; inspect outputs to confirm happy-path draft writes pass, wrong-agent/wrong-path/traversal protections fail in tests as intended, and no full-suite regressions remain
    Expected: reviewer returns APPROVE with command outputs summarized in `.sisyphus/evidence/f3-manual-qa.log`
    Evidence: .sisyphus/evidence/f3-manual-qa.log
  ```

- [ ] F4. Scope Fidelity Check — deep

  **QA Scenario**:
  ```
  Scenario: Deep reviewer confirms no scope creep beyond draft support
    Tool: task(category="deep")
    Steps: run a fresh deep review over the final diff to confirm the change set is limited to explicit `draft` support, bounded lane enforcement, necessary schema/prompt wording sync, and optional documented parity only; verify no unrelated artifact kinds, CLI flags, migrations, or release changes were introduced
    Expected: reviewer returns APPROVE and evidence is saved to `.sisyphus/evidence/f4-scope-fidelity.md`
    Evidence: .sisyphus/evidence/f4-scope-fidelity.md
  ```

## Commit Strategy
- Commit 1: `test(artifact-writer): add draft kind contract coverage`
- Commit 2: `feat(artifact-writer): add bounded draft lane support`
- Commit 3: `feat(plugin): expose draft durable artifact kind`
- Optional Commit 4: `docs(init): add optional draft lane parity`

## Success Criteria
- `product-wunderkind` can write `.sisyphus/drafts/*.md` through `wunderkind_write_artifact` using `kind="draft"`.
- `kind="notepad"` remains restricted to `.sisyphus/notepads/`.
- Existing bounded-lane and traversal protections remain intact.
- The tool schema and prompt-facing descriptions accurately reflect the new `draft` support.
- Full regression passes with no unrelated artifact-writer behavior changes.
