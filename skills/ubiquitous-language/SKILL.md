---
name: ubiquitous-language
description: >
  USE FOR: glossary maintenance, shared terminology cleanup, naming alignment,
  canonical terms, alias resolution, domain-language drift, and explicit updates
  to `.omo/glossary.md`.

---

# Ubiquitous Language

Maintain a shared domain glossary so humans and agents keep using the same words for the same concepts. Wunderkind imports the upstream domain-modeling vocabulary pattern, then narrows it to product-owned glossary and naming alignment work in `.omo/glossary.md` so it supports PRDs, plans, triage, and architecture discussions without becoming a broad codebase-design workflow.

## Primary owner

**Owned by:** wunderkind:product-wunderkind

## Output target

Write or update `.omo/glossary.md`.

## When to trigger

- A term is overloaded or ambiguous and the team needs a canonical definition.
- Multiple aliases are drifting through PRDs, plans, code comments, or issues.
- A rename or terminology cleanup needs the glossary updated.
- Another skill or workflow already established the repo contract, and now the glossary itself needs maintenance.

## Anti-triggers

- Do not use this as the default repo setup workflow; prefer `setup-wunderkind-workflow` for initial workflow/domain setup.
- Do not use it when the real need is a broader discovery interview; prefer `grill-me` or `prd-pipeline`.
- Do not use it for full architecture seam design; prefer `improve-codebase-architecture` when vocabulary changes depend on structural code decisions.
- Do not hide unresolved ambiguity. Mark it explicitly instead of guessing.

## What to capture

- Canonical term
- Short concrete definition
- Aliases or deprecated synonyms
- Related distinctions that prevent future confusion
- Open questions that still need human resolution

## Process

1. Scan the conversation, PRD, plan, issue, and relevant repo context.
2. Extract candidate terms and detect collisions or synonym drift.
3. Choose canonical terms where the evidence is strong.
4. Mark unresolved ambiguity explicitly instead of forcing false consensus.
5. Update `.omo/glossary.md` incrementally.

## Formatting guidance

Prefer a compact markdown table:

| Term | Definition | Aliases | Notes |
|---|---|---|---|

Add an `## Open Questions` section when needed.

## Hard rules

1. One term should map to one concept whenever possible.
2. Do not silently merge distinct concepts just because the names sound similar.
3. Definitions should be short, concrete, and domain-specific.
4. Keep this skill narrow: glossary quality and naming alignment, not full workflow setup.

## Review gate

This skill is complete only when `.omo/glossary.md` reflects the canonical term decisions and unresolved ambiguities are clearly flagged.
