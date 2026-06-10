---
name: diagnose
description: >
  USE FOR: deterministic bug diagnosis, reproducible failure loops, ranked
  hypotheses, focused instrumentation, root-cause isolation, and deciding the
  smallest proving regression surface before implementation starts.

---

# Diagnose

Adapted from Matt Pocock's `diagnose` skill for Wunderkind's engineering, triage, and
incident-debugging workflow.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

This skill is explicitly owned by `fullstack-wunderkind`.

Use it when the fault is still unclear and engineering must isolate the defect before
committing to a fix path.

## Filesystem scope

This skill is diagnosis-first. It reads the nearest repro surface and may write to:

- `src/` files only when adding temporary or minimal proving instrumentation
- `tests/unit/` or the nearest test surface when pinning the failure with a regression
- `.omo/notepads/` or `.omo/evidence/` when the diagnosis trail must persist
- `skills/diagnose/SKILL.md` for doctrine maintenance

## When to trigger

Use this skill for:

- bugs that are real but not yet isolated
- flaky behavior that needs a deterministic repro loop
- incidents where the likely failing layer is still uncertain
- regressions where several competing root-cause hypotheses exist
- product or support handoffs that still need engineering diagnosis before TDD execution

## Anti-triggers

Do not trigger this skill for:

- straightforward fixes where the broken contract and code path are already obvious
- pure feature work with no defect investigation
- architecture redesign discussions better served by `design-an-interface` or `improve-codebase-architecture`
- work that is already in a clear red-green-refactor loop; use `tdd` there instead

## Process

1. Restate the observed failure as a single testable contract.
2. Build the smallest deterministic repro loop possible.
3. List the leading hypotheses in ranked order.
4. Add the minimum instrumentation or probe that can eliminate one hypothesis at a time.
5. Identify the failing layer: contract, implementation, fixture, dependency, or environment.
6. Once the root cause is isolated, define the smallest regression surface that should stay green after the fix.
7. Hand off into `tdd` or direct implementation only after the diagnosis path is stable.

## Diagnostic doctrine

- Prefer deterministic repro over intuition.
- Change one variable at a time while investigating.
- Remove temporary instrumentation once the root cause is proven unless it provides lasting operational value.
- Name the failing layer explicitly before proposing a fix.
- If the evidence points to auth, authorization, or another security-control boundary, escalate to `ciso` instead of normalizing it as an ordinary bug.

## Hard rules

1. Do not jump to broad rewrites before a repro loop exists.
2. Do not batch multiple hypotheses into one opaque instrumentation change.
3. Do not call a problem fixed until the proving regression surface is named.
4. If the defect becomes clearly behavior-driven, transition into `tdd` instead of keeping diagnosis open-ended.

## Review gate

This skill is complete only when:

1. `fullstack-wunderkind` ownership is explicit.
2. The workflow is diagnosis-first rather than implementation-first.
3. The process includes deterministic repro, ranked hypotheses, minimal instrumentation, and a named regression surface.
4. The boundary with `tdd`, `ciso`, and architecture skills is explicit.
