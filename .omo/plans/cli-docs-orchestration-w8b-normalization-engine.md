# CLI Docs Orchestration W8B — Normalization Engine

## Objective

Build the engine behind `/wunderkind:docs-index` that delegates documentation generation/audit tasks to individual eligible agents in parallel while normalizing existing documents into canonical filenames.

## Scope

- Develop the centralized documentation orchestration support behind `/wunderkind:docs-index`.
- Implement per-agent parallel background delegation logic based on `AGENT_DOCS_CONFIG`.
- Implement canonical filename normalization and drift reduction logic.

## Depends On

- W8A — Invocation Contract (for command surface)
- W2 — Config Contract Split (for docs settings)

## Files in Scope

- `src/agents/docs-config.ts`
- implementation module/path to be chosen only after W8A freezes the runtime invocation surface
- runtime integration files identified by W8A

## Product Decisions / Frozen Contract

- **Delegation**: The coordinator behind `/wunderkind:docs-index` triggers each eligible agent from `AGENT_DOCS_CONFIG` individually and in parallel as a background task.
- **Eligible Agent Set**: one task each for the docs-writing/auditing personalities currently marked `eligible: true` in `AGENT_DOCS_CONFIG`.
- **Normalization**:
  - Existing files with non-canonical names are ingested and then rewritten to the canonical filename.
  - If both canonical and non-canonical files exist, use one deterministic archive-and-promote rule only.
- **Collision Policy**: deterministic archive-and-promote — if `mktg-strat.md` is normalized to `marketing-strategy.md` but the latter already exists, archive the pre-existing canonical file to `.wunderkind/archive/docs/<timestamp>-marketing-strategy.md`, then write the normalized result to the canonical filename. No merge heuristics are allowed in this wave.
- **Idempotency**: Running the orchestrator multiple times should result in a stable and consistent docs folder.
- **Module Design**: Do NOT pre-assume module placement or logic structure until W8A completes surface discovery. W8B must adapt to the W8A-frozen surface.

## Deliverables

- Documentation orchestration implementation behind `/wunderkind:docs-index` at the module/path frozen by W8A.
- Tests for delegation and normalization.
- Proof that canonical filenames become authoritative without destructive ambiguity.

## Task Breakdown

### Task W8B.1 — Core Orchestrator Logic

- **Action:** Create the orchestration module at the path selected after W8A freeze.
- **Action:** Implement the delegation loop that iterates over `AGENT_DOCS_CONFIG` and launches one background task per eligible agent.
- **Action:** Implement the ingestion of current docs to prevent data loss.

### Task W8B.2 — Canonical Filename Normalization

- **Action:** Add logic to identify files that *should* be canonical but are not.
- **Action:** Implement safe renaming/merging logic to move content to the canonical filename.

### Task W8B.3 — Deterministic Collision and Idempotency Handling

- **Action:** Implement the frozen archive-and-promote collision rule.
- **Action:** Prove that reruns are idempotent once canonical files have been established.

## QA Scenarios

```text
Scenario: Normalization of non-canonical files
  Setup: A docs folder with `mktg-strat.md` instead of `marketing-strategy.md` and no canonical file present.
  Run: Execute the orchestration flow through the W8A-frozen surface.
  Assert: Content from `mktg-strat.md` is moved to `marketing-strategy.md`.
  Assert: `mktg-strat.md` is removed or archived according to the frozen rule.
  Evidence: .sisyphus/evidence/w8b-normalization-proof.txt

Scenario: Delegation to all eligible agents
  Setup: Freeze the exact eligible agent list from W8A.
  Run: Execute the orchestration flow.
  Assert: Traces show every frozen eligible agent was contacted/instructed exactly once.
  Assert: one background task is launched per eligible agent.
  Evidence: .sisyphus/evidence/w8b-delegation-trace.txt

Scenario: Canonical-plus-non-canonical collision follows archive-and-promote rule
  Setup: docs folder contains both `marketing-strategy.md` and `mktg-strat.md`.
  Run: Execute the orchestration flow.
  Assert: the pre-existing canonical file is archived to `.wunderkind/archive/docs/<timestamp>-marketing-strategy.md`, and the normalized canonical file remains at `marketing-strategy.md`.
  Assert: no merge heuristic is used.
  Evidence: .sisyphus/evidence/w8b-collision-policy.txt

Scenario: Idempotent behavior
  Setup: docs folder already normalized into canonical files.
  Run: Run the orchestration flow twice in succession.
  Assert: The second run results in no changes to the filesystem.
  Evidence: .sisyphus/evidence/w8b-idempotency-check.txt
```

## Commit Strategy

- **Commit W8B-A**: `feat(orchestration): implement core documentation delegation engine`
- **Commit W8B-B**: `feat(orchestration): add canonical filename normalization and collision handling`
- **Commit W8B-C**: `test(orchestration): add unit tests for docs normalization and collision handling`

## Exit Conditions

- [x] Documentation is accurately delegated to agents via one parallel background task per eligible docs personality.
- [x] Non-canonical filenames are moved to their canonical counterparts.
- [x] Filesystem state is stable and collision handling is deterministic.
