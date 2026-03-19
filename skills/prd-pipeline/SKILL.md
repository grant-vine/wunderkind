---
name: prd-pipeline
description: >
  USE FOR: PRD workflow, product requirements, PRD to plan, PRD to issues,
  implementation planning, vertical slices, tracer bullets, filesystem workflow,
  GitHub workflow, product handoff, plan generation.

---

# PRD Pipeline

This skill converts product intent into a durable delivery workflow.

## Workflow modes

Read `prdPipelineMode` from `.wunderkind/wunderkind.config.jsonc`.

- `filesystem` — write artifacts into `.sisyphus/`
- `github` — use `gh`-backed GitHub issues/PRD flow only when the repo is GitHub-ready

If the mode is missing, treat it as `filesystem`.

## Filesystem mode targets

- PRD: `.sisyphus/prds/<slug>.md`
- Plan: `.sisyphus/plans/<slug>.md`
- Work items: `.sisyphus/issues/<slug>-phase-N.md`

## GitHub mode targets

- Use `gh` commands only if GitHub workflow readiness has been confirmed by the current environment.
- If readiness is unclear, stop and tell the user exactly what is missing.

## Stages

### 1. Discovery → PRD
- Clarify the problem
- Capture goals, non-goals, actors, constraints, success criteria
- Prefer vertical slices over horizontal workstreams

### 2. PRD → Plan
- Break the work into phases
- Each phase should deliver an end-to-end tracer bullet where possible
- Avoid brittle file-path-level details in planning artifacts

### 3. Plan → Issues
- Split into independently executable work items
- Preserve dependency order
- Make acceptance criteria testable

## Wunderkind ownership

- `product-wunderkind` owns PRD creation, decomposition, and acceptance-criteria/testability review
- `fullstack-wunderkind` validates implementation sequencing, technical shape, and regression/testing execution needs

## Hard rules

1. Prefer filesystem mode unless GitHub mode is explicitly configured and ready.
2. Every artifact should be durable and readable without hidden tool state.
3. Plans should describe behavior and sequencing, not fragile implementation trivia.
4. Every issue/work item needs a clear outcome and acceptance criteria.
