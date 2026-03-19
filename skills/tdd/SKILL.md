---
name: tdd
description: >
  USE FOR: test-driven development, red-green-refactor loops, bug fixes with new
  regression coverage, and feature work that should be proven through public behavior.
  Use when implementing or repairing TypeScript code under Wunderkind's Bun-based test workflow.

---

# TDD

Adapted from Matt Pocock's benchmark skill for Wunderkind's Bun + TypeScript strict-mode stack.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

This skill is explicitly owned by `fullstack-wunderkind`.

It carries forward the old QA doctrine, but `fullstack-wunderkind` now owns the execution of
red-green-refactor loops, regression coverage, and technical defect diagnosis.

## Filesystem scope

This skill reads the changed implementation plus its nearest test surface and may write to:

- `tests/unit/` and colocated `*.test.ts` files
- `src/` files whose public behavior is under test
- `skills/tdd/SKILL.md` for doctrine maintenance
- `.sisyphus/notepads/` or `.sisyphus/evidence/` when a test strategy or defect trail needs to persist

## Runtime context

- Test runner: `bun test tests/unit/`
- Typecheck: `npx tsc --noEmit`
- Build and generator checks: `bun run build`, plus `bun run dist/build-agents.js` when validating the agent build pipeline directly
- Language mode: strict TypeScript with `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals`, and `noUnusedParameters`
- Repo bias: test public behavior first; avoid implementation-coupled tests

## When to trigger

Use this skill for:

- adding or fixing behavior with clear observable outcomes
- reproducing a bug before changing the implementation
- building confidence around refactors with new regression tests
- downstream QA doctrine tasks that need a concrete repo-local TDD reference

## Anti-triggers

Do not trigger this skill for:

- docs-only changes
- trivial string or copy edits with no executable behavior
- generated files or asset refreshes without meaningful logic
- situations where the correct public behavior is still undefined

## Process

1. Pick one observable behavior and write the failing test first.
2. Run `bun test tests/unit/` and confirm the failure is for the expected reason.
3. Write the minimum production code needed to make that test pass.
4. Run the targeted tests again, then run `npx tsc --noEmit`.
5. Refactor only after green, keeping the tests locked to the public contract.
6. If the change touches the agent build pipeline, rerun `bun run dist/build-agents.js` or `bun run build` before declaring the slice complete.

## Testing doctrine

- Red-green-refactor is mandatory: fail first, pass minimally, then improve structure.
- Test the public interface: assert inputs, outputs, errors, and observable side effects through exported contracts rather than private helpers.
- Add the smallest regression that proves the bug or feature; do not batch unrelated test ideas into one cycle.
- Cover one complete vertical slice per scenario: for each meaningful user-facing slice, prove one end-to-end behavior from entry point to durable outcome.
- Treat strict TypeScript flags as part of the contract: omitting an optional property is different from passing `undefined`, and indexed access must account for `T | undefined` in assertions.

## Wunderkind testing heuristics

- Prefer integration-style unit tests that exercise exported interfaces.
- Add the smallest regression that proves the bug or feature.
- Respect strict flags while designing test data; omitting optional values is not the same as passing `undefined`.
- Treat indexed access carefully in both tests and implementation because `noUncheckedIndexedAccess` makes missing values explicit.
- Keep vertical slices thin: one scenario should cover the full behavior path without turning every test into a broad end-to-end suite.
- If a new behavior suggests broader story or risk coverage, coordinate with `triage-issue` or `agile-pm` rather than bloating one test cycle.

## Hard rules

1. One failing test at a time; no horizontal batches of speculative tests.
2. Tests must describe behavior through public interfaces, not private helpers.
3. Do not weaken types or strictness to make tests easier to write.
4. Always rerun `bun test tests/unit/` and `npx tsc --noEmit` before declaring green.
5. If the test reveals a structural boundary problem, hand off to interface or architecture skills instead of papering over it.

## Review gate

This skill is complete only when:

1. `fullstack-wunderkind` ownership is explicit and no removed-agent ownership remains.
2. The workflow states red-green-refactor, public-interface testing, and vertical-slice doctrine plainly.
3. Bun-native verification commands are named for both unit tests and build-pipeline checks.
4. Strict TypeScript flags are documented as active constraints on test design and assertions.
