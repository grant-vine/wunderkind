---
name: design-an-interface
description: >
  DEPRECATED: docs-history and detection-only reference for the retired
  design-an-interface route. Do not invoke for new work. Use
  improve-codebase-architecture for structural interface work, direct
  fullstack-wunderkind routing for narrow engineering judgement, or
  product/frontend exploration when user workflow or prototype evidence
  shapes the contract.

---

# Design an Interface

Deprecated in the upstream convergence release. This file is retained only for migration
history, replacement guidance, and detection-only diagnostics.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

This deprecated route was previously owned by `fullstack-wunderkind`.

New interface design work must route to `improve-codebase-architecture` for structural
friction or RFC-worthy boundary changes, directly to `fullstack-wunderkind` for narrow
engineering judgement, or through product/frontend exploration when user workflow or
prototype evidence shapes the contract.

## Filesystem scope

This file is documentation-only. It must not be used as an execution-time route.
Historical references may point to:

- `skills/design-an-interface/SKILL.md` for the deprecated route reference itself
- `.omo/notepads/` for short-lived exploration notes and tradeoff capture
- `.omo/rfcs/<slug>.md` for repo-shaping interface decisions
- implementation task or PR notes when the decision is narrow and immediate

## When to trigger

Do not trigger this skill for new work. The historical trigger signals below now route to
`improve-codebase-architecture` or direct `fullstack-wunderkind` judgement.

Historical signals:

- an API boundary between modules, services, or adapters needs an intentional contract
- multiple plausible public interfaces exist and the wrong shape will be costly to unwind
- callers and implementers have competing needs that force a contract tradeoff
- a significant refactor needs a new module or abstraction shape before code moves
- the team must compare materially different designs instead of defaulting to one obvious path

## Anti-triggers

Do NOT invoke this skill. It is deprecated.

Do not trigger this skill for:

- a simple helper with one obvious signature
- a minor parameter addition that does not change the interface contract
- local parameter naming cleanup
- routine CRUD handlers where the repo already has a clear pattern
- UI polish decisions that belong to `creative-director`
- broad architecture audits better handled by `improve-codebase-architecture`
- execution-time alias routing, fallback routing, or automatic invocation under this deprecated name

## Process

1. Stop if this file was selected as an execution route.
2. Re-route structural design work to `improve-codebase-architecture`.
3. Re-route narrow implementation judgement to `fullstack-wunderkind`.
4. Re-route workflow-driven or prototype-led contract shaping to product/frontend exploration.
5. Keep any remaining reference to this file as migration history or detection-only diagnostics.

## Evaluation lens

- Interface simplicity: fewer concepts, fewer ways to misuse
- Depth: small public surface hiding meaningful internal complexity
- Generality: flexible enough for expected change, not speculative abstraction
- Testability: easy to exercise through public behavior
- Migration cost: realistic adoption path in this repo

## Hard rules

1. Do not invoke this route for new work.
2. Do not preserve execution-time alias behavior for this deprecated skill name.
3. Keep this file only for migration history, replacement guidance, and detection-only diagnostics.
4. Route successor work to `improve-codebase-architecture`, direct `fullstack-wunderkind` judgement, or product/frontend exploration when workflow evidence shapes the contract.

## Review gate

This deprecated file is acceptable only when:

1. It is not promoted as a first-class skill route.
2. It names `improve-codebase-architecture`, direct `fullstack-wunderkind` judgement, and product/frontend exploration as replacements.
3. Any remaining reference is documentation, routing guidance, or detection-only diagnostics.
4. No runtime selection, fallback route, or command metadata depends on this deprecated name.
