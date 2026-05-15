---
name: docs-with-grill
description: >
  USE FOR: context-aware documentation grilling, Matt-style grill-with-docs adaptation,
  repo-aware questioning, `CONTEXT.md` maintenance, validating domain language against
  code and docs, and preparing Wunderkind-native docs follow-up without copying
  external filesystem layouts verbatim.

---

# Docs With Grill

Stress-test a docs topic, feature description, or product plan against the actual repo, then capture the compact shared context in Wunderkind-native artifacts before the final docs writing begins.

## Primary owner

**Owned by:** wunderkind:product-wunderkind

## Filesystem scope

Read:
- `CONTEXT.md`
- `AGENTS.md`
- `.wunderkind/wunderkind.config.jsonc`
- `.sisyphus/`
- docs-output settings if present
- relevant source files that answer the question more accurately than the user can

Write:
- `CONTEXT.md`
- docs-output lanes only when the user explicitly wants docs generated or refreshed
- `.sisyphus/evidence/*.md` only for hard-to-reverse decisions or reviewable durable proof

## When to trigger

- A feature, workflow, or docs topic needs Matt-style `grill-with-docs` behavior, but adapted to Wunderkind.
- The docs are drifting because the compact shared context is stale, missing, or contradictory.
- A maintainer wants one-question-at-a-time interrogation before drafting guides, PRDs, or docs-output updates.
- The request needs repo inspection plus documentation framing, not just plain writing.

## Anti-triggers

- Do not use this for trivial copyedits or small wording cleanups.
- Do not use this when the final task is already clear and only polished docs drafting remains — route that to `technical-writer`.
- Do not invent Matt's `CONTEXT.md` + `docs/adr/*` layout beyond the literal `CONTEXT.md` file adopted by this repo.
- Do not replace `setup-wunderkind-workflow`; setup still owns the wider workflow contract.

## Process

1. Inspect `CONTEXT.md`, `AGENTS.md`, `.sisyphus/`, and the relevant code before asking the user anything.
2. Ask one sharp question at a time only when the repo cannot answer it.
3. Keep a running picture of: product/domain summary, core workflows, shared language, important constraints, and open questions.
4. Update `CONTEXT.md` only when the clarified context becomes stable enough to help future work.
5. If the user also wants documentation output, hand off to the appropriate docs-writing lane after the context is no longer ambiguous.

## Hard rules

1. Repo truth beats user memory when the code clearly answers the question.
2. `CONTEXT.md` must stay compact — summarize, do not dump transcripts.
3. Ask one question at a time; do not unload a questionnaire.
4. Prefer Wunderkind-native outputs (`CONTEXT.md`, docs-output lanes, `.sisyphus/evidence/`) over copied external layouts.
5. If the task becomes pure docs drafting, switch to `technical-writer` instead of overextending this skill.

## Review gate

This skill is complete only when the docs/topic ambiguity has been collapsed, `CONTEXT.md` reflects the clarified shared context when needed, and any follow-on docs-writing path is now clear enough to execute without another discovery loop.
