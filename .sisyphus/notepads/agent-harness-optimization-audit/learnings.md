# Learnings — agent-harness-optimization-audit

## [2026-03-19] Session ses_2f9bebd26ffeIzcqS5CpYhKFP0 — Initial Setup

### Codebase State
- Package version: 0.9.13
- 12 agents currently: marketing-wunderkind, creative-director, product-wunderkind, fullstack-wunderkind, brand-builder, qa-specialist, operations-lead, ciso, devrel-wunderkind, legal-counsel, support-engineer, data-analyst
- Current skills: agile-pm, compliance-officer, db-architect, experimentation-analyst, grill-me, improve-codebase-architecture, oss-licensing-advisor, pen-tester, prd-pipeline, security-analyst, social-media-maven, technical-writer, triage-issue, ubiquitous-language, vercel-architect, visual-artist
- No SKILL-STANDARD.md exists yet
- No write-a-skill, design-an-interface, or tdd skills exist yet
- No code-health skill exists yet
- No capability-matrix.md, topology-decision.md, soul-architecture.md, overlay-decision.md exist yet
- evidence/ dir exists with many previous task outputs (from prior work sessions)

### Key Files
- src/agents/manifest.ts — central agent registry
- src/index.ts — plugin entry + runtime injection
- oh-my-opencode.jsonc — OMO agent registration
- src/cli/personality-meta.ts — personality metadata
- src/cli/config-manager/index.ts — config persistence
- src/cli/init.ts — init CLI surface
- src/cli/doctor.ts — doctor output
- schemas/wunderkind.config.schema.json — JSON schema
- src/agents/docs-config.ts — docs-output config

### TypeScript Conventions (CRITICAL)
- exactOptionalPropertyTypes: true — NEVER pass undefined for optional props, omit instead
- noUncheckedIndexedAccess: true — array/object index access is T | undefined
- noUnusedLocals/Parameters: true — compile error if unused
- No as any, @ts-ignore, @ts-expect-error
- Module: ESNext, moduleResolution: bundler

## [2026-03-19T13:30:58Z] Harness coverage expansion

- Added focused Bun regression tests for `src/index.ts` plugin transform, including native-agent catalog injection, runtime context rendering, and docs sentinel idempotency.
- Added direct build-pipeline assertions for `src/build-agents.ts` that rerun the generator and verify each `agents/*.md` file matches `renderNativeAgentMarkdown()` output.
- Added filesystem-backed tests for `src/cli/gitignore-manager.ts` covering first-write behavior, idempotency, and insertion into an existing managed section.
- Added deeper non-interactive `runInit()` coverage for docs bootstrap, invalid docs path rejection, GitHub workflow warnings, and doc history normalization.

## 2026-03-19 Task 1 doc-contract audit
- README.md and AGENTS.md had drifted from the live CLI/help surface; src/cli/index.ts and node bin/wunderkind.js --help are the authoritative command contract.
- /docs-index is a shipped native command asset backed by commands/docs-index.md; maintainer docs should not describe it as prompt-only.
- init-deep should be documented as an oh-my-openagent bootstrap workflow that Wunderkind supports, not as a Wunderkind CLI command.
- The current shipped skill set is 16 skills, including technical-writer, oss-licensing-advisor, and experimentation-analyst.
- Version scrub rule for this task: docs should either omit embedded versions or use only 0.9.13.

## [2026-03-19] Task 3 benchmark skill imports

- Imported the upstream benchmark skill content for `write-a-skill`, `design-an-interface`, and `tdd` as reference inputs only; the repo-local versions were rewritten to match Wunderkind's existing SKILL.md tone and filesystem-first workflow.
- `design-an-interface` now explicitly belongs to `fullstack-wunderkind` and includes anti-trigger guidance so it is reserved for meaningful API or boundary decisions, not every simple helper.
- `tdd` is now a concrete Bun + TypeScript strict-mode skill that points at `bun test tests/unit/` and `tsc --noEmit`, with reminders about `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- `write-a-skill` now anchors future skill authoring in `skills/*/SKILL.md`, `.sisyphus/` artifacts, and the planned `skills/SKILL-STANDARD.md` contract.

## [2026-03-19] Task 4 skill standard audit
- Created `skills/SKILL-STANDARD.md` as the repo-level authoring contract derived from `skills/write-a-skill/SKILL.md`, with trigger-first descriptions, ownership metadata, filesystem scope, anti-triggers, progressive disclosure, optional deep assets, and review gates.
- Audited all 19 shipped skills and recorded an explicit disposition for each in the new Skill Inventory table so no skill remains owner-ambiguous under the six-agent target topology.
- Reassigned `triage-issue` to `product-wunderkind`, `technical-writer` to `marketing-wunderkind`, `tdd` to `fullstack-wunderkind`, and `experimentation-analyst` to `product-wunderkind` because its current scope is feature and product experiment oriented rather than campaign-only analysis.
- Updated `README.md` and `AGENTS.md` to point at the new standard and to expose the 19-skill ownership map on the public documentation surface.

## [2026-03-19] Task 6 Desloppify code-health opt-in
- Added `skills/code-health/SKILL.md` under `fullstack-wunderkind` with an explicit opt-in trigger boundary, the exact one-time fallback message, Python 3.11+ prerequisite notes, the official `python -m pip install --upgrade 'desloppify[full]'` command, and `.desloppify/` as local gitignored state.
- `desloppifyEnabled` works best as a sparse project config field: omit it when absent, default it to `false` in `detectCurrentConfig()`, and only write it into `.wunderkind/wunderkind.config.jsonc` when init explicitly sets it or an existing project config already has it enabled.
- The relevant CLI surfaces for this feature are split across `src/cli/index.ts` for `--desloppify-enabled`, `src/cli/init.ts` for the interactive prompt, `src/cli/config-manager/index.ts` for JSONC rendering/coercion, `src/cli/doctor.ts` for verbose marker output, and `src/cli/gitignore-manager.ts` for `.desloppify/`.

## [2026-03-19] Task 5 doctrine handoff

- `skills/design-an-interface/SKILL.md` needed more than imported benchmark wording: the stable Wunderkind trigger is high-complexity boundary design only, with explicit anti-triggers for trivial helpers, minor parameter additions, and one-obvious-solution work.
- `skills/tdd/SKILL.md` now acts as the repo-level TDD contract for `fullstack-wunderkind`, with red-green-refactor, public-interface testing, vertical-slice doctrine, and Bun/TypeScript strict-mode verification commands spelled out directly.
- QA doctrine was split cleanly across the surviving authority surfaces: `src/agents/fullstack-wunderkind.ts` now owns test execution, regression depth, and technical defect diagnosis; `src/agents/product-wunderkind.ts` now owns acceptance review, INVEST gating, and escalation of technical defects to engineering.
- A contradiction sweep was necessary beyond the four primary files: adjacent skills and agent prompts that still routed testing work to `qa-specialist` had to be minimally redirected so the handoff survives `bun run build` without regenerating stale guidance.

## [2026-03-19] Task 7 capability preservation matrix
- Created `.sisyphus/plans/capability-matrix.md` as the single authoritative crosswalk from the current 12-agent topology to the retained six-agent topology, using the exact schema `Current Owner | Capability/Skill | Disposition | Surviving Owner | Artifact Path | Notes`.
- Split removed-agent authority explicitly: `support-engineer` intake and repro shaping merge into `product-wunderkind`, technical handoff merges into `fullstack-wunderkind`; `operations-lead` reliability and runbooks merge into `fullstack-wunderkind`, while security-incident posture merges into `ciso`.
- Represented all 19 shipped skills as `extract-as-skill` rows and carried the Task 4 keep/revise inventory into notes so the matrix can stay topology-focused while still preserving the skill-standard disposition context.
- Explicitly called out the three audit-sensitive skills: `technical-writer` survives under `marketing-wunderkind`, `experimentation-analyst` survives under `product-wunderkind`, and `oss-licensing-advisor` stays under retained `legal-counsel`.
