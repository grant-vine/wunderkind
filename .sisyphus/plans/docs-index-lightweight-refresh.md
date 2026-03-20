# docs-index lightweight refresh/bootstrap redesign

## Explicit product decision

`/docs-index` becomes a **lightweight refresh/bootstrap command**.

Rules:

1. Keep `AGENT_DOCS_CONFIG` as the source of truth for docs-eligible agents and canonical home filenames.
2. Canonical filenames remain deterministic, but are treated as **managed home files**, not transactional orchestration targets.
3. Each docs-eligible Wunderkind subagent should **refresh its canonical file if present, or create it if missing**.
4. Partial success is acceptable and should be summarized plainly.
5. `init-deep` is no longer a hard gate. After the docs refresh, the command should **ask the user** whether they want to run `init-deep` as a follow-up.
6. Remove strict completion-tag and exact-one-result dependencies from the command contract and helper logic.
7. `skipped` is summary-only and should only be used when the coordinator intentionally does not touch a managed lane; it must not depend on child self-reporting protocols.

## Goals

1. Make `/docs-index` fast enough to use as a routine project documentation refresh.
2. Allow bootstrap from empty or sparse docs directories.
3. Preserve enough determinism to avoid chaos:
   - fixed eligible set
   - fixed canonical home file per eligible agent
4. Surface results as a flat summary: `created`, `refreshed`, `skipped`, `failed`.
5. Keep docs path trust-boundary enforcement and project-local path validation.
6. Update README in the same change so public docs do not describe the retired strict protocol.

## Non-goals

1. Do not build audit-grade transactional guarantees.
2. Do not add new plugin APIs or hidden runtime capabilities.
3. Do not require every docs-eligible subagent to return a structured completion tag.

## Wave 1 — TDD for helper/contract simplification

Add failing tests to reflect the new command contract:

1. `docs-index-plan.test.ts`
   - keep plan building and docs-path validation
   - replace completion-tag parsing / aggregation tests with a simple summary helper for created/refreshed/skipped/failed
   - keep canonical uniqueness as a static invariant
2. `docs-config.test.ts`
   - `buildDocsInstruction()` should describe refresh-or-create behavior
   - should no longer mention explicit completion tags, partial index writing, or init-deep gating
3. `config-template.test.ts`
   - command asset should no longer promise one background task per eligible agent as a hard requirement
   - should no longer promise explicit structured child completion results
   - should describe optional init-deep follow-up question instead

### QA Scenario

Run before implementation:

1. `bun test tests/unit/docs-index-plan.test.ts tests/unit/docs-config.test.ts tests/unit/config-template.test.ts`

Expected red outcomes:

1. docs-index plan tests fail because completion-tag / gating expectations no longer match the intended contract
2. docs-config and command-asset tests fail because stale orchestration wording still exists

Run after Wave 1 + Wave 2 implementation:

1. `bun test tests/unit/docs-index-plan.test.ts tests/unit/docs-config.test.ts tests/unit/config-template.test.ts`

Expected green outcomes:

1. plan tests pass with simple summary behavior and canonical uniqueness invariant
2. docs-config and command asset tests pass with refresh/bootstrap wording and optional init-deep question wording

## Wave 2 — Implement lightweight contract

Update:

- `commands/docs-index.md`
- `src/agents/docs-config.ts`
- `src/agents/docs-index-plan.ts`
- `README.md`

Behavior target:

- command describes phased refresh/bootstrap behavior
- docs instructions become simple refresh/create lane rules
- helpers support summary reporting rather than transactional completion-tag parsing
- public docs describe the lightweight refresh/bootstrap flow and optional init-deep question

### QA Scenario

Run content search after implementation:

1. content search across `commands/`, `src/agents/`, `tests/unit/`, and `README.md` for these retired phrases:
   - `explicit structured completion result`
   - `one parallel background task per docs-eligible Wunderkind agent`
   - `<wunderkind-docs-index-result>`
   - `only runs \`init-deep\` after full success`

Expected results:

1. zero matches for all retired transactional phrases in touched files
2. command/docs/README wording consistently describes lightweight refresh/bootstrap behavior

## Wave 3 — TDD for runtime docs guidance

Add or update tests ensuring runtime-injected docs guidance remains correct:

1. `docs-injection.test.ts`
   - still shows docsPath and history mode
   - may mention canonical managed targets
   - does not encode stale transactional wording

### QA Scenario

Run before implementation:

1. `bun test tests/unit/docs-injection.test.ts`

Expected result:

1. test may already pass behaviorally; if so, add/adjust assertions until it fails on stale wording only

Run after Wave 3 + Wave 4 implementation:

1. `bun test tests/unit/docs-injection.test.ts`

Expected result:

1. runtime docs injection passes with docsPath/history mode/canonical targets intact and no stale transactional wording

## Wave 4 — Implement runtime wording cleanup

Update:

- `src/index.ts`

Behavior target:

- runtime docs section remains helpful but aligned with the lightweight refresh/bootstrap model

### QA Scenario

Run content search against `src/index.ts` and relevant tests for stale orchestration phrases.

Expected result:

1. runtime guidance no longer implies transactional completion-tag or full-success init-deep gating behavior

## Wave 5 — Verification

1. Run targeted docs-index tests
2. Run `bun test`
3. Run `tsc --noEmit`
4. Run `bun run build`
5. Run `npm pack --dry-run`

### QA Scenario

1. `bun test tests/unit/docs-index-plan.test.ts tests/unit/docs-config.test.ts tests/unit/config-template.test.ts tests/unit/docs-injection.test.ts`
   - Expected: exit `0`
2. `bun test`
   - Expected: exit `0`
3. `tsc --noEmit`
   - Expected: exit `0`
4. `bun run build`
   - Expected: exit `0`
5. `npm pack --dry-run`
   - Expected: exit `0`

## Acceptance criteria

1. `/docs-index` is described as a refresh/bootstrap workflow, not a strict transactional fan-out protocol.
2. Canonical home files remain deterministic per eligible agent.
3. Docs-path trust-boundary enforcement remains intact.
4. No tests or source still require explicit completion tags or all-or-nothing init-deep gating for docs refresh.
5. The follow-up behavior is to ask the user whether to run `init-deep`.
6. README is aligned with the shipped docs-index behavior.
