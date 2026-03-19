---
name: triage-issue
description: >
  USE FOR: bug triage, issue investigation, root cause analysis, support handoff,
  incident reproduction, red-green planning, defect documentation, issue scoping,
  support-to-engineering transitions.

---

# Triage Issue

You investigate a bug or support issue, identify the likely root cause, and produce a durable handoff artifact before implementation begins.

## Output mode

- Default: write findings to `.sisyphus/triage/<slug>.md`
- If `prdPipelineMode` is `github` and GitHub workflow readiness is confirmed, GitHub issue output is acceptable

## Required sections

1. Problem summary
2. Reproduction clues / evidence
3. Likely root cause
4. Affected behavior and risk
5. Proposed red-green test cycle
6. Acceptance criteria

## Workflow

1. Reproduce or narrow the issue using repo evidence
2. Distinguish symptom from root cause
3. Capture a minimal safe fix direction
4. Hand off to product/fullstack with test-first guidance

## Wunderkind ownership

- `product-wunderkind` owns first-pass triage and acceptance clarity
- `fullstack-wunderkind` validates red-green coverage and owns implementation when needed

## Hard rules

1. Do not jump straight to code changes if the bug is still poorly understood.
2. Record evidence before proposing a fix.
3. Acceptance criteria must describe observable behavior.
4. Prefer durable filesystem artifacts over ephemeral chat summaries.
