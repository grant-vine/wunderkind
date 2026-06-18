---
name: triage-issue
description: >
  USE FOR: bug triage, external PR triage, issue investigation, support handoff,
  incident reproduction, defect documentation, issue scoping,
  support-to-engineering transitions, acceptance clarity, backlog-ready issue shaping.

---

# Triage Issue

You investigate a bug or support issue, frame repro confidence and severity, and produce a durable handoff artifact before implementation begins. Engineering owns root-cause diagnosis and fix implementation; product owns intake quality and acceptance clarity.

If the repo treats external pull requests as an intake surface, triage them with the same discipline: verify the claim, identify the affected contract, and write the next-step brief before anyone starts implementation or merge work.

## Output mode

- Default: write findings to `.omo/triage/<slug>.md`
- If `prdPipelineMode` is `github` and GitHub workflow readiness is confirmed, GitHub issue output is acceptable

## Required sections

1. Problem summary
2. Reproduction clues / evidence
3. Suspected area and risk
4. Affected behavior and severity
5. Proposed red-green test cycle
6. Acceptance criteria

## Workflow

1. Gather the current issue or PR context, including prior notes, reproduction clues, and the nearest affected code paths.
2. Check whether the requested behavior already exists or was previously rejected so intake does not create duplicate work.
3. Assess and frame repro confidence from available evidence, and verify the claim where possible before shaping the handoff.
4. Frame severity and acceptance criteria from observable behavior.
5. Capture a safe fix direction for engineering handoff.
6. Hand off to fullstack-wunderkind with test-first guidance and clear acceptance criteria.

## Wunderkind ownership

**Owned by:** wunderkind:product-wunderkind

- `product-wunderkind` owns first-pass triage: intake quality, repro confidence framing, severity classification, acceptance clarity, and backlog-ready handoff
- `fullstack-wunderkind` owns root-cause diagnosis, red-green coverage, and implementation when needed

## Hard rules

1. Do not jump straight to code changes if the bug is still poorly understood.
2. Record evidence before proposing a fix.
3. Acceptance criteria must describe observable behavior.
4. Prefer durable filesystem artifacts over ephemeral chat summaries.
5. For GitHub-backed triage comments, prepend a clear AI-generated disclaimer before posting user-visible notes.
