---
name: triage-issue
description: >
  USE FOR: bug triage, issue investigation, support handoff,
  incident reproduction, defect documentation, issue scoping,
  support-to-engineering transitions, acceptance clarity, backlog-ready issue shaping.

---

# Triage Issue

You investigate a bug or support issue, frame repro confidence and severity, and produce a durable handoff artifact before implementation begins. Engineering owns root-cause diagnosis and fix implementation; product owns intake quality and acceptance clarity.

## Output mode

- Default: write findings to `.sisyphus/triage/<slug>.md`
- If `prdPipelineMode` is `github` and GitHub workflow readiness is confirmed, GitHub issue output is acceptable

## Required sections

1. Problem summary
2. Reproduction clues / evidence
3. Suspected area and risk
4. Affected behavior and severity
5. Proposed red-green test cycle
6. Acceptance criteria

## Workflow

1. Assess and frame repro confidence from available evidence
2. Frame severity and acceptance criteria from observable behavior
3. Capture a safe fix direction for engineering handoff
4. Hand off to fullstack-wunderkind with test-first guidance and clear acceptance criteria

## Wunderkind ownership

- `product-wunderkind` owns first-pass triage: intake quality, repro confidence framing, severity classification, acceptance clarity, and backlog-ready handoff
- `fullstack-wunderkind` owns root-cause diagnosis, red-green coverage, and implementation when needed

## Hard rules

1. Do not jump straight to code changes if the bug is still poorly understood.
2. Record evidence before proposing a fix.
3. Acceptance criteria must describe observable behavior.
4. Prefer durable filesystem artifacts over ephemeral chat summaries.
