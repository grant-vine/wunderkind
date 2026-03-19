---
name: design-an-interface
description: >
  USE FOR: high-complexity API design, module boundary design, interface comparison,
  design-it-twice exploration, and choosing between competing abstractions before
  implementation. Use when the shape of an interface is the main engineering risk.

---

# Design an Interface

Adapted from Matt Pocock's benchmark skill for Wunderkind's engineering workflow.

## Primary owner

This skill is explicitly owned by `fullstack-wunderkind`.

If the design question expands into broader structural friction or RFC-worthy boundary
changes, hand off to `improve-codebase-architecture` for the longer-form architecture work.

## Filesystem scope

This skill is analysis-first. It reads the current implementation and writes only the smallest
durable artifact needed for the decision:

- `skills/design-an-interface/SKILL.md` for the doctrine itself
- `.sisyphus/notepads/` for short-lived exploration notes and tradeoff capture
- `.sisyphus/rfcs/<slug>.md` for repo-shaping interface decisions
- implementation task or PR notes when the decision is narrow and immediate

## When to trigger

Use this skill only when a high-complexity engineering decision about API shape, module
boundaries, or abstraction depth will materially affect future implementation.

Typical signals:

- an API boundary between modules, services, or adapters needs an intentional contract
- multiple plausible public interfaces exist and the wrong shape will be costly to unwind
- callers and implementers have competing needs that force a contract tradeoff
- a significant refactor needs a new module or abstraction shape before code moves
- the team must compare materially different designs instead of defaulting to one obvious path

## Anti-triggers

Do NOT invoke for trivial helpers, minor parameter additions, or any task where there is only
one obvious solution.

Do not trigger this skill for:

- a simple helper with one obvious signature
- a minor parameter addition that does not change the interface contract
- local parameter naming cleanup
- routine CRUD handlers where the repo already has a clear pattern
- UI polish decisions that belong to `creative-director`
- broad architecture audits better handled by `improve-codebase-architecture`

## Process

1. Define the callers, constraints, and public behaviors the interface must support.
2. Generate at least two genuinely different designs; three is better when the tradeoffs are subtle.
3. Show a usage example for each design, not just a type signature.
4. Compare the designs for simplicity, misuse resistance, depth, and future change cost.
5. Recommend one direction and explain why the rejected options lost.

## Evaluation lens

- Interface simplicity: fewer concepts, fewer ways to misuse
- Depth: small public surface hiding meaningful internal complexity
- Generality: flexible enough for expected change, not speculative abstraction
- Testability: easy to exercise through public behavior
- Migration cost: realistic adoption path in this repo

## Hard rules

1. Produce multiple distinct designs before choosing one.
2. Evaluate interface quality, not coding speed.
3. Prefer hard-to-misuse boundaries over clever signatures.
4. Ground the recommendation in current repo constraints and file layout.
5. If the problem is bigger than one interface, escalate into architecture work instead of forcing it here.

## Review gate

This skill is complete only when:

1. `fullstack-wunderkind` ownership is explicit and the activation surface is limited to high-complexity engineering decisions.
2. At least two genuinely different interface designs were compared through usage examples, not just type signatures.
3. The chosen boundary is grounded in repo-specific callers, constraints, and migration cost.
4. The durable output path is named clearly when the decision needs to persist beyond the current task.
