---
name: improve-codebase-architecture
description: >
  USE FOR: architecture improvement, codebase deepening, module boundaries, seam
  design, coupling reduction, dependency review, deletion-test analysis, RFC
  creation, structural refactoring, and AI-navigable interfaces.

---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** that turn shallow modules into deeper ones with clearer seams, better locality, and higher leverage. Wunderkind imports upstream codebase-design and seam-depth positioning, then narrows it to `fullstack-wunderkind` owned architecture work with `.omo` RFCs, repo evidence, and visual or workflow review when a proposed interface affects user-facing behavior.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

`product-wunderkind` may trigger this skill when recurring delivery pain points point to structural causes, but engineering owns the resulting architecture work.

This is the successor route for structural interface design after `design-an-interface` retirement; narrow engineering judgement can still go directly to `fullstack-wunderkind`, and product/frontend exploration should shape contracts driven by workflow or prototype evidence.

## Filesystem scope

Read:
- `AGENTS.md`
- `.omo/glossary.md` if present
- `.omo/rfcs/`
- existing ADR or docs folders relevant to the area
- the code paths involved in the candidate refactor

Write:
- `.omo/rfcs/<slug>.md`
- optionally `.omo/glossary.md` when the architecture discussion depends on a missing canonical term

## Architecture language

Use these terms consistently in your analysis:

- **Module** — anything with an interface and implementation: function, class, package, slice, route group, workflow, or subsystem.
- **Interface** — everything callers must know: types, invariants, ordering, config, error modes, and side effects.
- **Implementation** — the code hidden behind that interface.
- **Depth** — how much leverage the interface gives relative to the implementation it hides.
- **Seam** — where an interface lives and where behavior can change without editing in place.
- **Adapter** — a concrete implementation that satisfies a seam.
- **Leverage** — what callers gain from a deep module.
- **Locality** — what maintainers gain when change and knowledge stay concentrated.

## When to trigger

- A code path feels like a pass-through maze instead of a coherent module.
- Feature work repeatedly touches too many files for one concept.
- Tests are hard to write because the real behavior leaks across seams.
- The user asks for architecture improvement, structural refactoring, or deep-module opportunities.
- The codebase is becoming harder for humans or agents to navigate safely.

## Anti-triggers

- Do not use for a one-file cleanup or tiny bugfix.
- Do not split API shape exploration into the deprecated `design-an-interface` route; keep structural interface work here, ask `fullstack-wunderkind` for narrow engineering judgement, or use product/frontend exploration when user workflow or prototype evidence is driving the contract.
- Do not recommend broad rewrites without a migration path.
- Do not treat "more layers" as architecture quality. Deeper seams matter more than extra wrappers.

## Process

1. Read the project language first: `AGENTS.md`, `.omo/glossary.md`, and any relevant ADR/RFC history.
2. Explore the codebase organically and note where understanding one concept requires bouncing across too many shallow modules.
3. Apply the **deletion test** to suspected shallow modules: if deleting the module simply moves the same complexity into every caller, it was earning its keep; if complexity vanishes, it was probably a pass-through.
4. Present a numbered list of deepening opportunities. For each candidate include:
   - files or modules involved
   - current friction
   - proposed seam or deeper module
   - benefits in terms of locality, leverage, and testability
   - migration risk
5. Check whether the proposed seam changes a user-visible workflow, UI contract, or visual affordance. If it does, route that evidence through product/frontend review before locking the architecture.
6. Ask the user which candidate to explore before locking an interface or migration plan.
7. For the selected candidate, design at least two plausible approaches before recommending one.
8. Write an RFC with migration guidance, risks, and verification strategy.

## RFC sections

1. Problem
2. Current pain and evidence
3. Proposed seam / module boundary
4. Alternatives considered
5. Migration plan
6. Risks and mitigations
7. Verification strategy

## Hard rules

1. Ground every recommendation in repo evidence, not generic architecture taste.
2. Prefer deeper modules and clearer seams over surface-level reshuffling.
3. Show tradeoffs explicitly using locality, leverage, and testability.
4. If the conversation depends on a missing domain term, add or update it in `.omo/glossary.md` instead of letting terminology drift.
5. Never recommend a rewrite without a staged migration path.

## Review gate

This skill is complete only when:
- at least one real deepening opportunity is evidenced from the repo
- the recommendation uses consistent seam/depth/locality language
- an RFC exists at `.omo/rfcs/<slug>.md`
- the migration path is incremental and verifiable
