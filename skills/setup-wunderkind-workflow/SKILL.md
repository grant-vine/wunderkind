---
name: setup-wunderkind-workflow
description: >
  USE FOR: repo-local workflow setup, issue flow selection, triage vocabulary,
  glossary/docs location setup, `.sisyphus` conventions, and adapting
  Matt-style setup patterns to Wunderkind-native files like `AGENTS.md` and
  `.sisyphus/*`.

---

# Setup Wunderkind Workflow

Establish the repo-local workflow contract that other Wunderkind skills depend on, without duplicating `wunderkind init` or introducing Matt Pocock's filesystem layout verbatim.

## Primary owner

**Owned by:** wunderkind:product-wunderkind

## Filesystem scope

Read:
- `AGENTS.md`
- `.wunderkind/wunderkind.config.jsonc`
- `.sisyphus/`
- docs-output settings if present
- GitHub readiness signals when issue flow might use GitHub

Write:
- `AGENTS.md` (update or add a compact workflow-contract section)
- `.sisyphus/glossary.md`
- `.sisyphus/triage/README.md`

## When to trigger

- The repo needs a clear issue-tracker / PRD / triage contract before skills can operate consistently.
- A maintainer wants Matt-style setup behavior, but adapted to Wunderkind-native locations.
- The team has not agreed where glossary, triage, and workflow artifacts should live.
- `prdPipelineMode`, triage vocabulary, or glossary conventions are confusing or implicit.

## Anti-triggers

- Do not use this to replace `wunderkind init`; `init` still owns baseline config and project bootstrap.
- Do not invent a second docs tree like `docs/agents/` unless the user explicitly asks for it.
- Do not mutate `.wunderkind/wunderkind.config.jsonc` unless the user explicitly asks to change config values.

## Decisions to confirm

Walk these one at a time, not all at once:

1. **Workflow backend** — filesystem-first or GitHub-backed PRD / issue flow.
2. **Triage vocabulary** — the statuses, severity labels, or role terms the team actually uses.
3. **Domain-language locations** — where glossary and architecture language should live.

## Process

1. Explore the current repo state before proposing anything.
2. Summarize what already exists in `AGENTS.md`, `.wunderkind/`, `.sisyphus/`, and GitHub readiness.
3. Present one setup decision at a time, with a short explainer and a recommended default.
4. Show the user the draft workflow contract before writing.
5. Write the agreed contract into Wunderkind-native locations.

## Required outputs

### `AGENTS.md`

Add or update a compact section summarizing:
- issue / PRD flow backend
- triage vocabulary
- glossary / architecture-doc locations

### `.sisyphus/triage/README.md`

Record the canonical triage vocabulary and where issue/triage artifacts should live.

### `.sisyphus/glossary.md`

Create or refresh the shared domain glossary if terminology setup is part of the session.

## Hard rules

1. Preserve existing repo conventions where possible; do not flatten them into generic defaults.
2. Prefer Wunderkind-native locations (`AGENTS.md`, `.sisyphus/*`) over Matt's `docs/agents/*` layout.
3. Confirm each decision with the user before writing.
4. Keep the written contract concise enough that other skills can read it quickly.

## Review gate

This skill is complete only when the repo has an explicit, readable workflow contract in `AGENTS.md`, triage conventions are written under `.sisyphus/triage/`, and glossary ownership/location is no longer ambiguous.
