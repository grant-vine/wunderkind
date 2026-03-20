# Task 11 Shared Infrastructure Cleanup For Task 13

This file records the exact shared-file cleanup that Task 13 must apply after the prompt-side quality/support split is complete.

## Remove retired base-agent registrations

- `src/agents/manifest.ts`
  - Remove the import of `createQaSpecialistAgent` from `./qa-specialist.js`.
  - Remove the import of `createSupportEngineerAgent` from `./support-engineer.js`.
  - Remove the `WUNDERKIND_AGENT_DEFINITIONS` entry with `id: "qa-specialist"`.
  - Remove the `WUNDERKIND_AGENT_DEFINITIONS` entry with `id: "support-engineer"`.

- `oh-my-opencode.jsonc`
  - Remove the full `"wunderkind:qa-specialist"` agent block under the `// ── Quality ──` section.
  - Remove the full `"wunderkind:support-engineer"` agent block under the `// ── Support ──` section.

## Retire removed-agent personality surfaces

- `src/cli/personality-meta.ts`
  - Remove `"qa"` from the `PERSONALITY_META` key union.
  - Remove the `qa` object block (`rule-enforcer`, `risk-based-pragmatist`, `rubber-duck`).
  - Remove `"support"` from the `PERSONALITY_META` key union.
  - Remove the `support` object block (`empathetic-resolver`, `systematic-triage`, `knowledge-builder`).
  - Fold `qaPersonality` behavior into surviving owners:
    - `product` absorbs acceptance review, INVEST gating, backlog readiness, and story-quality enforcement.
    - `cto` absorbs TDD execution, regression rigor, coverage decisions, flaky-test handling, and technical defect diagnosis.
  - Fold `supportPersonality` behavior into surviving owners:
    - `product` absorbs issue intake, repro questioning, severity and priority framing, and backlog-ready triage.
    - `cto` absorbs technical triage, likely-owner diagnosis, debugging handoff quality, and defect follow-through.

- `schemas/wunderkind.config.schema.json`
  - Remove the `qaPersonality` property from the project-config `properties` block.
  - Remove `"qaPersonality"` from the project-config `required` array.
  - Remove the `supportPersonality` property from the project-config `properties` block.
  - Remove `"supportPersonality"` from the project-config `required` array.
  - Preserve the fold behavior documented above: QA traits split between `productPersonality` and `ctoPersonality`; support traits split between `productPersonality` and `ctoPersonality`.

## README ownership cleanup

- `README.md`
  - Keep `triage-issue` owned by `product-wunderkind` in the Sub-skills table.
  - Update the `triage-issue` domain text from `Root-cause triage and red-green handoff` to product-owned wording that matches the retained topology: issue intake, repro shaping, acceptance clarity, and backlog-ready handoff.
  - Ensure the row does not imply `qa-specialist` or `support-engineer` still exist as base-agent owners.
