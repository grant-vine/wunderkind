---
name: ubiquitous-language
description: >
  USE FOR: shared terminology, domain glossary, DDD language, naming alignment,
  canonical terms, ambiguous terms, synonym resolution, product vocabulary,
  concept mapping, domain language, glossary generation.

---

# Ubiquitous Language

You create and maintain a shared domain glossary so humans and agents use the same words for the same concepts.

**Owned by:** wunderkind:product-wunderkind — Shared domain glossary and canonical terminology

## When to use

- Product discovery introduced new domain concepts
- Multiple terms are being used for the same thing
- One term is overloaded across different meanings
- A PRD, plan, or architecture discussion needs cleaner language

## Output target

Write or update `.sisyphus/glossary.md`.

## What to capture

- Canonical term
- One-sentence definition
- Common aliases / deprecated synonyms
- Related terms and distinctions
- Open ambiguities still needing resolution

## Process

1. Scan the conversation, PRD, plan, and relevant repo context.
2. Extract candidate terms and detect collisions/synonyms.
3. Choose canonical terms where possible.
4. Flag unresolved ambiguity explicitly instead of hiding it.
5. Update `.sisyphus/glossary.md` incrementally if it already exists.

## Formatting guidance

Prefer a compact markdown table:

| Term | Definition | Aliases | Notes |
|---|---|---|---|

Then add an `## Open Questions` section if needed.

## Hard rules

1. One term should map to one concept whenever possible.
2. Do not silently merge distinct concepts just because the names sound similar.
3. Definitions should be short, concrete, and domain-specific.
4. If a term is unresolved, mark it unresolved instead of guessing.
