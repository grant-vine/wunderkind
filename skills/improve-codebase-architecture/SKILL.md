---
name: improve-codebase-architecture
description: >
  USE FOR: architecture improvement, module boundaries, deep modules, system design,
  interface design, coupling reduction, dependency review, RFC creation, structural
  refactoring, design-it-twice exploration.

---

# Improve Codebase Architecture

You look for structural friction in the codebase and turn it into a concrete architecture recommendation.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

This skill is primarily run by `fullstack-wunderkind`.

`product-wunderkind` may trigger it when discovery reveals recurring structural friction, but engineering owns the resulting architecture work.

## Output target

Write an RFC to `.sisyphus/rfcs/<slug>.md`.

## Evaluation lens

- Shallow vs deep modules
- Tight coupling vs replaceable boundaries
- Confusing interfaces vs hard-to-misuse interfaces
- Repeated incidental complexity
- AI navigability and human maintainability

## Process

1. Explore the current module boundaries and dependency shape.
2. Identify the most painful structural bottlenecks.
3. Design at least two plausible alternatives before recommending one.
4. Explain the tradeoffs in terms of correctness, testability, and future change cost.
5. Write an RFC with migration guidance and verification strategy.

## RFC sections

1. Problem
2. Current pain
3. Proposed boundary/interface
4. Alternatives considered
5. Migration plan
6. Risks and mitigations
7. Verification strategy

## Hard rules

1. Do not recommend broad rewrites without a migration path.
2. Prefer deeper modules and clearer interfaces over surface-level reshuffling.
3. Show tradeoffs explicitly.
4. Recommendations must be grounded in current repo evidence.
