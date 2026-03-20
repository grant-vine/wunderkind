# Wunderkind Agent Harness Optimization Audit

> Historical note: this plan was completed under the harness-era contract. Some Desloppify-specific deliverables were later intentionally superseded by `.sisyphus/plans/remove-desloppify.md`; the checked items in this file reflect completion at the time of this plan, not the current post-removal product contract.

## TL;DR
> **Summary**: Audit and modernize Wunderkind’s docs, tests, skills, and multi-agent topology; then move from 12 peer-style agents toward an orchestrator-first harness with a smaller specialist set, stronger skill standards, and explicit OMO migration gates. This work assumes intentional breaking change is acceptable under the project’s 0.x release posture.
> **Deliverables**:
> - Docs/test audit and freshness fixes
> - Imported local benchmark skills: `write-a-skill`, `design-an-interface`, `tdd`
> - Opt-in `desloppify` code-health capability with init-time enablement plus first-trigger fallback guidance
> - Skill-authoring standard plus Matt Pocock-inspired skills/doctrine
> - Coverage expansion for currently weak harness surfaces
> - Capability inventory and fixed target topology decision
> - Orchestrator-first routing model and reduced retained-agent set
> - Optional per-persona `SOUL.md` architecture with slimmer base prompts
> - Overlay-vs-adjacent-runtime decision memo with explicit triggers
> **Effort**: XL
> **Parallel**: YES - 9 waves
> **Critical Path**: 1 → 3 → 4 → 7 → 8 → 9/10/11/12 → 13 → 14 → 15

## Context

### Original Request
- Audit all docs and code-facing documentation for freshness and drift.
- Review test coverage deeply and close harness blind spots.
- Assess where new skills fit best, who should use them, and which base-agent capabilities should become skills.
- Evaluate whether the 12-agent system can be reduced substantially, ideally toward half, without losing required capability.
- Research whether one top-level orchestrator is preferable and whether product owner should fill that role.
- Audit dependency on oh-my-openagent/OpenCode and decide whether Wunderkind should remain an overlay or eventually run alongside it.
- Include external reviews of Matt Pocock’s `write-a-skill`, `design-an-interface`, and `tdd` skills.
- Produce a comprehensive multi-phase plan, reviewed with Metis and then Momus.

### Interview Summary
- The preferred workflow remains filesystem-first (`.sisyphus/`) even when GitHub-backed flows are evaluated.
- The user is open to substantial agent-count reduction, but only if capability is preserved through better skills and routing.
- Product-wunderkind is the leading orchestrator candidate, but this must be validated against a thinner routing role and against overloading product with too much specialist depth.
- Less-used or circumstantial behavior should move into skills when it has a narrow trigger, repeatable method, and bounded filesystem/output scope.
- Breaking changes are acceptable and expected; the plan should optimize for the cleaner target architecture rather than spend effort on migration cushions.

### Metis Review (gaps addressed)
- Do not conflate **role simplification** with **platform migration**.
- Do not remove any agent until a capability-preservation map exists.
- Keep security/legal/compliance authority explicit unless evidence proves it can safely become skill-only advisory behavior.
- Add acceptance criteria for docs freshness, test coverage expansion, topology decision artifacts, routing safety, and OMO integration safety.
- Add migration gates for any future adjacent runtime instead of treating platform migration as default.

## Work Objectives

### Core Objective
Transform Wunderkind from a wide peer-agent overlay into a documented, tested, orchestrator-first harness with sharper skill boundaries, a smaller durable specialist set, and explicit platform-strategy gates.

### Deliverables
- Updated, current docs and maintainer guidance (`README.md`, `AGENTS.md`, command/help alignment)
- Imported local benchmark skills:
  - `skills/write-a-skill/SKILL.md`
  - `skills/design-an-interface/SKILL.md`
  - `skills/tdd/SKILL.md`
- Imported/adapted code-health capability for Desloppify as `skills/code-health/SKILL.md` with explicit opt-in enablement and install guidance
- Test coverage for currently weak harness surfaces
- `skills/SKILL-STANDARD.md`
- Capability matrix at `.sisyphus/plans/capability-matrix.md`
- Topology decision document at `.sisyphus/plans/topology-decision.md`
- Orchestrator-first routing contract
- SOUL architecture decision document at `.sisyphus/plans/soul-architecture.md`
- New/adopted skills/doctrine for `write-a-skill`, `design-an-interface`, and `tdd`
- OMO overlay-vs-adjacent-runtime decision memo at `.sisyphus/plans/overlay-decision.md`
- Maintainer guidance in `AGENTS.md` describing reviewer-lifecycle rules for audit-style critic agents (fresh Metis/Momus reviewer per new audit pass; no review-session reuse)

### Definition of Done (verifiable conditions with commands)
- `npx tsc --noEmit`
- `bun test tests/unit/`
- `bun run build`
- `node bin/wunderkind.js --help`
- `node bin/wunderkind.js upgrade --help` (regression check: command must remain available)
- `node bin/wunderkind.js uninstall --help` (regression check: command must remain available)
- `node bin/wunderkind.js init --help` (regression check: init help surface must remain available after Task 6 and Task 13 modifications)
- `node bin/wunderkind.js gitignore --help` (regression check: gitignore command must remain available after Task 6 additions)
- `node bin/wunderkind.js doctor --verbose`
- `ls skills/write-a-skill/SKILL.md skills/design-an-interface/SKILL.md skills/tdd/SKILL.md`
- `test -f .sisyphus/plans/capability-matrix.md && test -f .sisyphus/plans/topology-decision.md && test -f .sisyphus/plans/overlay-decision.md && test -f .sisyphus/plans/soul-architecture.md`
- `test -f .sisyphus/evidence/task-1-prompt-baseline.txt && test -f .sisyphus/evidence/task-15-prompt-after.txt` (before/after token-size evidence must both exist)
- `test -f skills/code-health/SKILL.md`
- `grep -n "desloppifyEnabled" schemas/wunderkind.config.schema.json README.md AGENTS.md src/cli/*.ts src/cli/config-manager/*.ts`
- `grep -En "0\.[0-9]+\.[0-9]+" README.md AGENTS.md` returns only the current intended version references
- `grep -n "prdPipelineMode" schemas/wunderkind.config.schema.json README.md AGENTS.md src/cli/*.ts` plus manual comparison of filesystem/github wording confirms aligned semantics

### Must Have
- One explicit orchestrator-first target topology
- Fixed retained base-agent set of exactly 6 agents unless a later task proves this target impossible
- Filesystem-first artifacts remain the default operating mode
- Skill extraction standard grounded in trigger boundaries and persona ownership
- Imported benchmark skills exist locally before any task claims to load them
- Token-use reduction is a measured deliverable with before/after prompt-size evidence
- Optional `SOUL.md` files exist only for explicitly customized personas; non-customized personas remain slim and neutral
- Desloppify is opt-in: users are asked during init/setup whether to enable it, and agent-triggered fallback can offer one-time enable/install guidance later
- Desloppify install guidance uses the officially documented upstream path: Python 3.11+ plus `python -m pip install --upgrade "desloppify[full]"`; OS-specific notes are limited to how users obtain Python, not alternate undocumented Desloppify package managers
- Coverage expansion for plugin transform, build pipeline, TUI/init flow depth, gitignore handling, and prompt snapshot/baseline surfaces
- OMO migration gates documented, not hand-waved
- Breaking-change posture is explicit in docs/release guidance so simplification work is not constrained by backward-compatibility padding
- Audit-style reviewer loops use a fresh critic agent for every new review round after fixes; prior Metis/Momus sessions may be cited for findings but must not be reused to judge revised artifacts

### Must NOT Have
- No premature adjacent-runtime migration
- No agent removal before capability preservation is documented
- No “one giant orchestrator prompt” that absorbs specialist identity without skill extraction
- No security/legal/compliance collapse without explicit risk rationale
- No undocumented dead skills or orphaned ownership
- No migration-only workstreams whose sole purpose is to preserve obsolete topology/contracts during 0.x cleanup
- No mandatory personality prose embedded in every generated base agent prompt when a persona is not customized
- No undocumented Homebrew/pipx/native-package-manager claim for Desloppify itself when upstream only documents pip installation
- No Metis/Momus session reuse for a new audit pass after findings are fixed; every new review round must start with a fresh reviewer session

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **tests-after** with expanded harness regression suite
- QA policy: Every task includes direct command-based verification plus a failure-mode check
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt`

## Execution Strategy

### Parallel Execution Waves
Wave 1: current-state baselines (`1,2`)

Wave 2: local benchmark-skill import (`3`)

Wave 3: skill standard publication (`4`)

Wave 4: doctrine + code-health + capability inventory (`5,6,7`)

Wave 5: orchestrator/topology decision (`8`)

Wave 6: soul architecture + retained-role consolidation (`9,10,11,12`)

Wave 7: manifest/routing/config/schema rewiring (`13`)

Wave 8: overlay-vs-adjacent runtime memo (`14`)

Wave 9: final docs/doctor/init/token reconciliation (`15`)

### Dependency Matrix (full)
| Task | Depends On | Notes |
|---|---|---|
| 1 | - | Freshness baseline and init-deep audit framing |
| 2 | - | Test harness baseline |
| 3 | 1 | Import local benchmark skills before later tasks claim to load them |
| 4 | 1,3 | Skill standard references current docs/contracts and imported benchmarks |
| 5 | 2,3,4 | TDD/design doctrine work depends on imported skills, standards, and baseline tests |
| 6 | 1,3,4 | Desloppify/code-health adoption depends on imported standards and docs surface |
| 7 | 1,4 | Capability matrix uses current docs + fixed skill standard |
| 8 | 7 | Orchestrator design depends on capability inventory |
| 9 | 1,4,8 | SOUL architecture depends on current personality/docs surfaces plus fixed topology |
| 10 | 7,8 | Growth/comms consolidation depends on fixed target topology |
| 11 | 5,7,8 | QA/support split depends on TDD doctrine and topology |
| 12 | 5,7,8 | Governance/data/ops retention decisions depend on topology and imported doctrine |
| 13 | 8,9,10,11,12 | Routing, manifest, config, schema, and soul updates after retained set is final |
| 14 | 8,13 | Overlay-vs-adjacent decision uses final harness target |
| 15 | 1,9,13,14 | Docs/doctor/init/token finalization happens after topology/platform/soul decisions |

### Agent Dispatch Summary
- Wave 1 → 2 tasks → writing / unspecified-high
- Wave 2 → 1 task → writing
- Wave 3 → 1 task → writing
- Wave 4 → 3 tasks → writing / unspecified-high
- Wave 5 → 1 task → unspecified-high
- Wave 6 → 4 tasks → writing / unspecified-high
- Wave 7 → 1 task → unspecified-high
- Wave 8 → 1 task → writing
- Wave 9 → 1 task → writing

## Target Retained Topology (fixed)

### Retained Base Agents (6 total)
1. `product-wunderkind` — single default orchestrator/front door
2. `fullstack-wunderkind`
3. `marketing-wunderkind`
4. `creative-director`
5. `ciso`
6. `legal-counsel`

### Removed / Merged Base Agents
- `brand-builder` → merge into `marketing-wunderkind`
- `devrel-wunderkind` → merge into `marketing-wunderkind`
- `qa-specialist` → remove as base agent; split into `product-wunderkind` + `fullstack-wunderkind`
- `support-engineer` → remove as base agent; split into `product-wunderkind` + `fullstack-wunderkind`
- `operations-lead` → remove as base agent; merge into `fullstack-wunderkind` + `ciso`
- `data-analyst` → remove as base agent; split into `product-wunderkind` + `marketing-wunderkind`

### Fixed Landing Rules
- Product analytics, usage interpretation, prioritization, issue intake, repro framing, acceptance review → `product-wunderkind`
- TDD execution, regression, coverage, root-cause debugging, reliability/runbooks/admin tooling → `fullstack-wunderkind`
- Campaign/funnel analysis, brand/community/dev-advocacy/docs launches → `marketing-wunderkind`
- UX, design systems, visual language, accessibility, tokens → `creative-director`
- Security/privacy/compliance controls, technical incident posture → `ciso`
- Licensing, contracts, legal interpretation, formal policy sign-off → `legal-counsel`

### Canonical ID Rules
- Reuse existing IDs for retained base agents; do not invent a new base-agent namespace
- The merged growth/comms role keeps the canonical ID `marketing-wunderkind`

### Personality-Key Rules
- Remove `brandPersonality`; fold behavior into `cmoPersonality`
- Remove `devrelPersonality`; fold behavior into `cmoPersonality`
- Remove `supportPersonality`; fold intake/prioritization behavior into `productPersonality`, technical triage into `ctoPersonality`
- Remove `qaPersonality`; fold test/reliability behavior into `ctoPersonality`, acceptance-review behavior into `productPersonality`
- Remove `opsPersonality`; fold reliability/runbook behavior into `ctoPersonality`, security-incident posture into `cisoPersonality`
- Remove `dataAnalystPersonality`; fold product analysis into `productPersonality`, campaign analysis into `cmoPersonality`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Audit and align documentation/contracts

  **What to do**: Refresh `README.md`, `AGENTS.md`, CLI help text, and any user-facing maintainer guidance so they accurately describe the current codebase, shipped skills, workflow modes, command surface, and versioned behavior. Formalize the current “init-deep” concept as an explicit audit/bootstrap workflow description instead of leaving it as ambiguous lore.
  **Must NOT do**: Do not redesign the product in this task. Do not introduce new runtime behavior beyond documentation/contract alignment.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: heavy docs reconciliation with code reality
  - Skills: [] — why needed: the writing category is sufficient; avoid depending on undocumented orphan skills before the skill audit runs
  - Omitted: [`prd-pipeline`] — why not needed: this is documentation audit, not workflow design

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3,4,6,7,9,15 | Blocked By: none

  **References**:
  - Pattern: `README.md` — current user-facing command/config/workflow documentation
  - Pattern: `AGENTS.md` — maintainer knowledge base and gotchas
  - Pattern: `src/cli/index.ts:18-296` — authoritative CLI command/help registration surface for docs alignment
  - Pattern: `src/cli/init.ts:97-427` — current init config shape, prompts, and workflow branches
  - Pattern: `src/cli/doctor.ts:77-188` — doctor output sections and terminology

  **Acceptance Criteria**:
  - [x] `grep -En "0\.[0-9]+\.[0-9]+" README.md AGENTS.md` returns only the current package version reference, or no version references if docs intentionally stop embedding a specific version number
  - [x] `node bin/wunderkind.js --help` remains consistent with documented command list
  - [x] `README.md` and `AGENTS.md` both describe the same current skill inventory and workflow semantics
  - [x] A prompt-size baseline is captured before topology/prompt changes using `wc -c agents/*.md > .sisyphus/evidence/task-1-prompt-baseline.txt`
  - [x] `AGENTS.md` no longer references `src/agents/AGENTS.md` or `src/cli/AGENTS.md` as sub-knowledge-base links (these files do not exist in the repo)

  **QA Scenarios**:
  ```
  Scenario: Fresh docs match shipped CLI surface
    Tool: Bash
    Steps: run `node bin/wunderkind.js --help`; compare command/help output against README and AGENTS command sections
    Expected: no documented command is missing or stale
    Evidence: .sisyphus/evidence/task-1-doc-contracts.txt

  Scenario: Stale version/reference regression check
    Tool: Bash
    Steps: compare `package.json` version against `grep -En "0\.[0-9]+\.[0-9]+" README.md AGENTS.md` output
    Expected: docs either reference the current package version only or intentionally contain no embedded version number
    Evidence: .sisyphus/evidence/task-1-doc-contracts-error.txt

  Scenario: Prompt-size baseline captured before refactor
    Tool: Bash
    Steps: run `wc -c agents/*.md > .sisyphus/evidence/task-1-prompt-baseline.txt`
    Expected: a before-state character-count baseline exists for later token-size comparison work
    Evidence: .sisyphus/evidence/task-1-prompt-baseline.txt
  ```

  **Commit**: YES | Message: `docs(harness): align docs with current workflows` | Files: `README.md`, `AGENTS.md`, `src/cli/index.ts`

- [x] 2. Expand harness test coverage to critical blind spots

  **What to do**: Add tests for the currently weak but high-risk surfaces: plugin transform behavior in `src/index.ts`, build output expectations around `src/build-agents.ts`, deeper init/TUI branching, gitignore handling, and snapshot/baseline coverage for generated prompt surfaces. Treat this as “100% of critical harness surfaces,” not vanity line coverage.
  **Must NOT do**: Do not attempt model-behavior integration tests that depend on live external APIs in this task.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: test architecture and harness regression design
  - Skills: [`agile-pm`] — why needed: isolate risk areas and enforce disciplined red-green-refactor loops; `tdd` is not yet available in Wave 1 (it is created in Task 3, Wave 2) — use `agile-pm` for decomposition discipline and apply TDD methodology from first principles until the skill exists
  - Omitted: [`design-an-interface`, `tdd`] — why not needed: `design-an-interface` is coverage expansion not API design; `tdd` does not exist as a repo skill until Task 3 completes

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5 | Blocked By: none

  **References**:
  - Pattern: `tests/unit/*.test.ts` — existing unit-test style and Bun conventions
  - Pattern: `src/index.ts:7-96` — plugin transform logic lacking deep regression coverage
  - Pattern: `src/cli/init.ts:97-427` — init branching and prompt flow
  - Pattern: `src/build-agents.ts:1-21` — build pipeline behavior that needs direct regression coverage
  - Pattern: `src/cli/doctor.ts:48-280` — verbose doctor rendering and workflow reporting
  - Pattern: `src/cli/config-manager/index.ts:37-147` — config defaults and merge logic

  **Acceptance Criteria**:
  - [x] New tests exist for plugin transform, build pipeline, gitignore manager, and deeper init/TUI surfaces
  - [x] `bun test tests/unit/` exits 0
  - [x] `npx tsc --noEmit` exits 0 after tests are added

  **QA Scenarios**:
  ```
  Scenario: Critical harness coverage suite passes
    Tool: Bash
    Steps: run `bun test tests/unit/`
    Expected: full unit suite passes with newly added harness coverage
    Evidence: .sisyphus/evidence/task-2-harness-tests.txt

  Scenario: Build and typecheck stay green after tests
    Tool: Bash
    Steps: run `npx tsc --noEmit && bun run build`
    Expected: no type or build regressions from expanded tests
    Evidence: .sisyphus/evidence/task-2-harness-tests-error.txt
  ```

  **Commit**: YES | Message: `test(harness): cover plugin and workflow surfaces` | Files: `tests/unit/*`, `src/index.ts` (only if test seams needed)

- [x] 3. Import and adapt external benchmark skills locally

  **What to do**: Create local adapted versions of the external benchmark skills so later tasks can load them as real repo skills instead of relying on external references. Add `skills/write-a-skill/SKILL.md`, `skills/design-an-interface/SKILL.md`, and `skills/tdd/SKILL.md` with Wunderkind-specific persona ownership, filesystem scope, and anti-trigger guidance.
  **Must NOT do**: Do not leave these as external links only if downstream tasks depend on them as actual loadable skills.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: careful adaptation of external methodology into repo-native skills
  - Skills: [] — why needed: this task creates repo-native skills and should not assume any undocumented helper skill already survives the audit
  - Omitted: [`agile-pm`] — why not needed: import/adaptation task, not decomposition

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 4,5,6 | Blocked By: 1

  **References**:
  - Pattern: `skills/*/SKILL.md` — existing local skill structure and tone
  - External: `https://github.com/mattpocock/skills/blob/main/write-a-skill/SKILL.md`
  - External: `https://github.com/mattpocock/skills/blob/main/design-an-interface/SKILL.md`
  - External: `https://github.com/mattpocock/skills/blob/main/tdd/SKILL.md`

  **Acceptance Criteria**:
  - [x] `skills/write-a-skill/SKILL.md` exists locally
  - [x] `skills/design-an-interface/SKILL.md` exists locally and explicitly names `fullstack-wunderkind` as owner
  - [x] `skills/tdd/SKILL.md` exists locally and is available for downstream QA tasks

  **QA Scenarios**:
  ```
  Scenario: Benchmark skills now exist locally
    Tool: Bash
    Steps: run `ls skills/write-a-skill/SKILL.md skills/design-an-interface/SKILL.md skills/tdd/SKILL.md`
    Expected: all three adapted skills exist as local repo assets
    Evidence: .sisyphus/evidence/task-3-import-benchmark-skills.txt

  Scenario: Imported skills are adapted, not copied blindly
    Tool: Bash
    Steps: inspect each imported skill for Wunderkind-specific ownership, filesystem scope, and trigger language
    Expected: imported skills mention Wunderkind personas/artifacts rather than remaining generic external copies
    Evidence: .sisyphus/evidence/task-3-import-benchmark-skills-error.txt
  ```

  **Commit**: YES | Message: `feat(skills): import benchmark skill patterns` | Files: `skills/write-a-skill/`, `skills/design-an-interface/`, `skills/tdd/`

- [x] 4. Publish and enforce a Wunderkind skill-authoring standard

  **What to do**: Create a repo-level standard for skills derived from `write-a-skill`: trigger-first descriptions, progressive disclosure, optional deep references/examples/scripts, filesystem/artifact scope, anti-triggers, ownership metadata, and review gates. Audit all existing shipped skills against it, including dead/unowned skills, and decide whether each is retained, revised, reassigned, or removed.
  **Must NOT do**: Do not mass-rewrite all skills without first publishing the standard and ownership matrix.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: methodology and standards authoring
  - Skills: [`write-a-skill`, `ubiquitous-language`] — why needed: imported benchmark plus consistent terminology and explicit skill-boundary quality
  - Omitted: [`tdd`] — why not needed: standardization task, not testing workflow execution

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 5,6,7,9 | Blocked By: 1,3

  **References**:
  - Pattern: `skills/*/SKILL.md` — current skill structure and variance
  - Pattern: `skills/agile-pm/SKILL.md` — existing detailed workflow skill example
  - External: `https://github.com/mattpocock/skills/blob/main/write-a-skill/SKILL.md` — trigger-driven skill authoring standard
  - Pattern: `README.md` — published skill list and user-facing ownership

  **Acceptance Criteria**:
  - [x] A documented skill standard exists in repo docs and is referenced by future skill work
  - [x] Every current shipped skill has an explicit disposition: keep, revise, merge, or retire
  - [x] Dead/unowned skills are no longer ambiguous in docs or package surface

  **QA Scenarios**:
  ```
  Scenario: Skill inventory is fully classified
    Tool: Bash
    Steps: list `skills/*/SKILL.md` and compare each against the published standard/disposition table
    Expected: no shipped skill lacks ownership or disposition
    Evidence: .sisyphus/evidence/task-4-skill-standard.txt

  Scenario: Standard survives packaging/build
    Tool: Bash
    Steps: run `bun run build` and inspect package file list/documented skills
    Expected: shipped skills and docs reflect the audited set without orphan entries
    Evidence: .sisyphus/evidence/task-4-skill-standard-error.txt
  ```

  **Commit**: YES | Message: `docs(skills): add skill authoring standard` | Files: `skills/SKILL-STANDARD.md`, `README.md`, `AGENTS.md`

- [x] 5. Adopt high-value external skill patterns into Wunderkind doctrine

  **What to do**: Convert the best parts of `design-an-interface` and `tdd` into Wunderkind-native capabilities. Add `design-an-interface` as a **fullstack-owned explicit high-complexity engineering skill** for option-comparison/interface design work rather than making it default persona behavior, and strengthen QA doctrine with public-interface, vertical-slice, red-green-refactor rules. Use the current `qa-specialist` prompt as an input source where helpful, but define the target doctrine in the surviving QA/testing authority surfaces so Task 11 can remove `qa-specialist` cleanly without losing testing guidance.
  **Must NOT do**: Do not make heavyweight design-comparison or full TDD ceremony the default for every trivial task. Do not re-create `skills/design-an-interface/SKILL.md` from scratch in this task — Task 3 (Wave 2) created the file; this task extends it with Wunderkind-specific doctrine, `fullstack-wunderkind` ownership confirmation, and high-complexity engineering trigger rules.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: skill authoring plus QA/engineering doctrine updates
  - Skills: [`design-an-interface`, `tdd`] — why needed: direct import of benchmarked methods
  - Omitted: [`agile-pm`] — why not needed: not a decomposition task

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 11,12 | Blocked By: 2,3,4

  **References**:
  - Pattern: `skills/improve-codebase-architecture/SKILL.md` — current engineering architecture skill baseline
  - Pattern: `src/agents/qa-specialist.ts` — current pre-consolidation QA doctrine source to mine before Task 11 removes the base agent
  - External: `https://github.com/mattpocock/skills/blob/main/design-an-interface/SKILL.md`
  - External: `https://github.com/mattpocock/skills/blob/main/tdd/SKILL.md`

  **Acceptance Criteria**:
  - [x] `design-an-interface` lives as `skills/design-an-interface/SKILL.md` and is explicitly owned by `fullstack-wunderkind`
  - [x] `tdd` lives as both `skills/tdd/SKILL.md` and embedded doctrine in the surviving QA/testing authority surfaces
  - [x] The TDD doctrine extracted from `qa-specialist` is preserved in the surviving authority surfaces with no contradictory guidance

  **QA Scenarios**:
  ```
  Scenario: QA doctrine is explicit and consistent
    Tool: Bash
    Steps: inspect the current `src/agents/qa-specialist.ts` as a source artifact together with any `skills/tdd/` files and the updated surviving doctrine surfaces; compare documented red-green-refactor and public-interface rules
    Expected: no contradictory TDD guidance remains
    Evidence: .sisyphus/evidence/task-5-doctrine.txt

  Scenario: Design skill is routed explicitly, not implicitly everywhere
    Tool: Bash
    Steps: grep for `design-an-interface` ownership and load paths in docs/skills/agent prompts
    Expected: it appears as an explicit high-complexity skill, not an accidental default behavior everywhere
    Evidence: .sisyphus/evidence/task-5-doctrine-error.txt
  ```

  **Commit**: YES | Message: `feat(skills): adopt interface-design and tdd standards` | Files: `skills/design-an-interface/`, `skills/tdd/`, surviving QA/testing doctrine surfaces, `README.md`

- [x] 6. Add Desloppify as a Wunderkind code-health function

  **What to do**: Integrate the required Desloppify capability into Wunderkind as a shared code-health function rather than a narrow fullstack-only prompt trick. **Surface decision for this plan cycle: implement as a repo-local skill at `skills/code-health/SKILL.md`, but gate its active inclusion behind explicit user opt-in.** Add a project-level `desloppifyEnabled` setting, ask about it during `wunderkind init` (interactive and no-TUI surfaces), and if the capability is later triggered by an agent while disabled or uninstalled, provide a one-time fallback prompt telling the user how to enable it and install upstream Desloppify. Installation guidance must be decision-complete and official: require Python 3.11+, recommend `python -m pip install --upgrade "desloppify[full]"`, document `.desloppify/` as local persistent state, and limit OS-specific guidance to how the user obtains Python on their platform.
  **Must NOT do**: Do not bury Desloppify as implicit fullstack lore only. Do not auto-install Python or Desloppify silently. Do not claim unsupported Homebrew/pipx/native-package-manager install paths for Desloppify itself unless upstream later documents them.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: external workflow adoption with CLI/skill surface implications
  - Skills: [`design-an-interface`] — why needed: compare wrapper-surface options and choose the cleanest integration shape
  - Omitted: [`tdd`] — why not needed: this is code-health workflow adoption, not test doctrine design

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: none | Blocked By: 1,3,4

  **References**:
  - External: `https://github.com/peteromallet/desloppify`
  - Pattern: `skills/*/SKILL.md` — current local skill packaging model
  - Pattern: `src/cli/index.ts` — init/install flag definitions and help text surface
  - Pattern: `src/cli/init.ts` — interactive/no-TUI project setup prompts
  - Pattern: `src/cli/types.ts` — CLI/project config argument and type surface that may need the new boolean field
  - Pattern: `src/cli/config-manager/index.ts` — sparse project-config persistence
  - Pattern: `src/cli/doctor.ts` — capability reporting surface
  - Pattern: `README.md` — user-facing workflow/command docs

  **Acceptance Criteria**:
  - [x] A Wunderkind-local code-health skill exists at `skills/code-health/SKILL.md`
  - [x] `wunderkind init` asks whether the user wants to enable Desloppify/code-health support, and the no-TUI surface exposes an equivalent explicit flag
  - [x] A project-level `desloppifyEnabled` config field exists in schema/config/docs/doctor and controls whether the capability is advertised/loaded
  - [x] If an agent encounters a Desloppify-worthy request while the capability is disabled or not installed, the user is shown a one-time fallback message describing how to enable it and install upstream Desloppify
  - [x] The repo docs explicitly state that Desloppify is a cross-cutting code-health capability with fullstack as steward, not a base-agent identity
  - [x] Installation guidance documents Python 3.11+, the official `python -m pip install --upgrade "desloppify[full]"` command, `.desloppify/` local state, and gitignore expectations
  - [x] `npx tsc --noEmit` exits 0 after the new `desloppifyEnabled` config surface is added
  - [x] `.desloppify/` is added to `AI_TRACE_ENTRIES` in `src/cli/gitignore-manager.ts` so `wunderkind gitignore` includes it automatically

  **QA Scenarios**:
  ```
  Scenario: Opt-in enablement surface exists and is aligned
    Tool: Bash
    Steps: inspect `src/cli/index.ts`, `src/cli/init.ts`, `src/cli/types.ts`, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, and the schema for `desloppifyEnabled` plus the interactive/no-TUI init prompt/flag; then run `npx tsc --noEmit`
    Expected: users can explicitly opt in during setup, and doctor/config surfaces report the setting consistently
    Evidence: .sisyphus/evidence/task-6-code-health.txt

  Scenario: Trigger fallback and dependency contract are explicit
    Tool: Bash
    Steps: inspect the adopted skill plus README/AGENTS prompt-contract language for first-trigger fallback messaging, Python/runtime prerequisites, `.desloppify/` state notes, and official pip install guidance
    Expected: no hidden dependency or workflow assumptions remain undocumented, and no unsupported install path is claimed
    Evidence: .sisyphus/evidence/task-6-code-health-error.txt
  ```

  **Commit**: YES | Message: `feat(code-health): add opt-in desloppify workflow surface` | Files: `skills/code-health/`, `src/cli/index.ts`, `src/cli/init.ts`, `src/cli/types.ts`, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, `src/cli/gitignore-manager.ts`, `schemas/wunderkind.config.schema.json`, docs files

- [x] 7. Build the capability-preservation matrix

  **What to do**: Create a single authoritative matrix at `.sisyphus/plans/capability-matrix.md` mapping every current agent capability and skill to one of four dispositions: retain as base agent authority, extract as skill, merge into another base agent, or retire. Use a fixed row schema: `Current Owner | Capability/Skill | Disposition | Surviving Owner | Artifact Path | Notes`. Explicitly include currently orphaned or underdocumented skills such as `technical-writer`, `experimentation-analyst`, and `oss-licensing-advisor` so later consolidation work cannot accidentally ignore them.
  **Must NOT do**: Do not remove or merge any agent before this matrix is approved by tests/docs and referenced by later tasks.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: analytical inventory and decision table authoring
  - Skills: [`agile-pm`, `ubiquitous-language`] — why needed: concern grouping and consistent terminology
  - Omitted: [`tdd`] — why not needed: this is taxonomy and ownership mapping

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 8,10,11,12 | Blocked By: 1,4

  **References**:
  - Pattern: `src/agents/manifest.ts:22-95` — current 12-agent inventory
  - Pattern: `src/index.ts:55-93` — current native-agent and delegation summary
  - Pattern: `oh-my-opencode.jsonc:14-131` — category/model registration and public descriptions
  - Pattern: `skills/*/SKILL.md` — current skill inventory and ownership surface

  **Acceptance Criteria**:
  - [x] Every current agent capability has a target disposition
  - [x] Every current skill has an owning base agent or explicit shared-ownership rule
  - [x] No later consolidation task introduces a capability not already present in the matrix
  - [x] The matrix explicitly classifies `technical-writer`, `experimentation-analyst`, and `oss-licensing-advisor`
  - [x] The matrix explicitly assigns a surviving owner/disposition for `triage-issue`, whose current owners are both removed later in the plan

  **QA Scenarios**:
  ```
  Scenario: Full capability matrix coverage
    Tool: Bash
    Steps: enumerate agents from `src/agents/manifest.ts` and skills from `skills/`; compare against matrix rows
    Expected: no agent or skill is missing from the inventory
    Evidence: .sisyphus/evidence/task-7-capability-matrix.txt

  Scenario: No orphaned/dead skill remains unclassified
    Tool: Bash
    Steps: grep for known low-signal/unowned skills and `triage-issue`; verify each disposition and surviving owner is documented
    Expected: every shipped skill is explicitly retained, revised, merged, or retired
    Evidence: .sisyphus/evidence/task-7-capability-matrix-error.txt
  ```

  **Commit**: YES | Message: `docs(topology): add capability preservation matrix` | Files: `.sisyphus/plans/capability-matrix.md`, `README.md` if referenced

- [x] 8. Establish the orchestrator-first target topology

  **What to do**: Reframe `product-wunderkind` into the top-level orchestrator that owns intake, clarification, routing, synthesis, and final answer quality. Preserve specialist product work by moving product-specific methods (`grill-me`, `ubiquitous-language`, `prd-pipeline`, `triage-issue`) into explicit product-owned skills so orchestration does not cannibalize product depth. Publish the topology decision to `.sisyphus/plans/topology-decision.md` using the fixed retained set in this plan.
  **Must NOT do**: Do not allow the orchestrator to self-delegate indefinitely or to absorb every specialist behavior into one giant prompt.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: high-impact prompt/routing architecture
  - Skills: [`grill-me`, `prd-pipeline`, `ubiquitous-language`] — why needed: preserve product depth while repurposing product as orchestrator
  - Omitted: [`design-an-interface`] — why not needed: this is routing/topology, not API shape design

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: 9,10,11,12,13,14 | Blocked By: 7

  **References**:
  - Pattern: `src/agents/manifest.ts:35-40` — current product agent identity
  - Pattern: `src/agents/product-wunderkind.ts` — current product prompt and methods that must be preserved while adding orchestrator behavior
  - Pattern: `src/index.ts:75-87` — current delegation rules with no orchestrator owner
  - External: `https://github.com/openai/openai-agents-python/blob/f25a4f95ed46ede55f363fb9410d4aab9f915cde/docs/multi_agent.md#L22-L31`
  - External: `https://github.com/openai/openai-agents-python/blob/f25a4f95ed46ede55f363fb9410d4aab9f915cde/docs/agents.md#L165-L205`

  **Acceptance Criteria**:
  - [x] `.sisyphus/plans/topology-decision.md` exists and names the fixed retained set: product, fullstack, marketing, creative, ciso, legal
  - [x] The orchestrator’s authority boundary is explicit: route/synthesize/final-answer ownership, not unlimited specialist duplication
  - [x] Product specialist depth remains available through skills after orchestration repurposing

  **QA Scenarios**:
  ```
  Scenario: Orchestrator topology contract is explicit
    Tool: Bash
    Steps: read topology decision artifact and verify it names the orchestrator, retained specialists, and self-delegation prohibition
    Expected: topology is concrete, not exploratory prose
    Evidence: .sisyphus/evidence/task-8-orchestrator-topology.txt

  Scenario: Product depth survives orchestrator conversion
    Tool: Bash
    Steps: inspect product agent prompt and owned skills after refactor
    Expected: PRD/discovery/product methods still exist as explicit skills rather than disappearing into generic routing text
    Evidence: .sisyphus/evidence/task-8-orchestrator-topology-error.txt
  ```

  **Commit**: YES | Message: `refactor(product): establish orchestrator-first topology` | Files: `src/agents/product-wunderkind.ts`, `skills/`, `.sisyphus/plans/topology-decision.md`

- [x] 9. Replace static personality embedding with optional per-persona SOUL files

  **What to do**: Produce the architecture decision for redesigning personality handling so soul customization is opt-in and persona-specific. The decision document must define the init/customization flow (first ask whether the user wants customization at all; if yes, present a multi-select of personas to customize, then ask 3–4 framing questions per selected persona), the per-persona `SOUL.md` location convention (for example `.wunderkind/souls/<agent-key>.md`), neutral-agent behavior, and how later learning events (for example `/docs-index`) append/update relevant SOUL files with durable pointers and project knowledge. **This task is decision-document only; implementation is deferred to Task 13.**
  **Must NOT do**: Do not keep full personality prose duplicated in every generated agent when no customization exists. Do not make SOUL files mandatory for neutral agents. Do not implement init/config/runtime changes in this task; those belong to Task 13.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: architecture + config + token-optimization design
  - Skills: [`write-a-skill`, `ubiquitous-language`] — why needed: define durable file format and consistent persona framing language
  - Omitted: [`tdd`] — why not needed: this is personality/state architecture, not test doctrine

  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: 13,15 | Blocked By: 1,4,8

  **References**:
  - Pattern: `src/cli/init.ts` — current personality customization prompting flow
  - Pattern: `src/cli/config-manager/index.ts` — current personality config persistence/merge logic
  - Pattern: `src/cli/doctor.ts` — current personality display surface
  - Pattern: `src/index.ts` — runtime context injection and docs-output injection
  - Pattern: `src/agents/shared-prompt-sections.ts` and `src/agents/*.ts` — repeated prompt/personality context areas
  - Pattern: `commands/docs-index.md` and `src/agents/docs-config.ts` — project-learning/doc refresh surfaces that may later update SOUL files

  **Acceptance Criteria**:
  - [x] A soul architecture decision document exists at `.sisyphus/plans/soul-architecture.md`
  - [x] The plan fixes the file location convention for per-persona SOUL files
  - [x] `.sisyphus/plans/soul-architecture.md` specifies the exact file format for per-persona SOUL files
  - [x] `.sisyphus/plans/soul-architecture.md` explicitly states whether SOUL content is injected at runtime or build time
  - [x] The plan explicitly states: no customization → no SOUL payload in base generated agent markdown
  - [x] The plan explicitly states how `/docs-index` and similar project-learning events update SOUL files
  - [x] `.sisyphus/plans/soul-architecture.md` is self-sufficient for a Task 13 implementer with no prior context: it specifies the injection mechanism (runtime vs. build time), exact file paths and naming convention, the init customization flow including question count per persona, and how `/docs-index` updates SOUL files — with no open questions remaining; a Task 13 implementer should be able to begin wiring SOUL support without needing to make any architectural judgment calls

  **QA Scenarios**:
  ```
  Scenario: Soul architecture is explicit and optional
    Tool: Bash
    Steps: inspect `.sisyphus/plans/soul-architecture.md` for file paths, opt-in flow, question count, neutral-agent behavior, and docs-index update rules
    Expected: no implementer judgment remains about where souls live or when they are used
    Evidence: .sisyphus/evidence/task-9-soul-architecture.txt

  Scenario: Prompt-slimming rule is explicit
    Tool: Bash
    Steps: grep the plan and related docs for the rule that non-customized agents exclude SOUL text from generated base prompts
    Expected: the neutral-agent token-saving rule is explicit and unambiguous
    Evidence: .sisyphus/evidence/task-9-soul-architecture-error.txt
  ```

  **Commit**: YES | Message: `docs(soul): define optional per-persona soul architecture` | Files: `.sisyphus/plans/soul-architecture.md`, `README.md`, `AGENTS.md` if referenced

- [x] 10. Consolidate marketing, brand, and devrel into one growth/comms specialist

  **What to do**: Merge `marketing-wunderkind`, `brand-builder`, and `devrel-wunderkind` into the retained base agent `marketing-wunderkind`. Preserve distinct capabilities as skills instead of keeping three peer agents. Remove `brandPersonality` and `devrelPersonality`; fold both into `cmoPersonality` and record the exact shared-file cleanup needed for Task 13 to apply.
  **Must NOT do**: Do not lose developer-docs/tutorial quality or community strategy coverage during consolidation. Do not edit shared infrastructure files (`src/agents/manifest.ts`, `oh-my-opencode.jsonc`, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, `src/cli/personality-meta.ts`, `schemas/wunderkind.config.schema.json`, README ownership tables) in this task; those changes are aggregated in Task 13/15.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: comms-heavy persona and skill merge
  - Skills: [`social-media-maven`] — why needed: preserve specialized channel/community methods under one base authority without pre-judging orphan-skill retention
  - Omitted: [`tdd`] — why not needed: not a testing-domain task

  **Parallelization**: Can Parallel: YES (domain-scoped files only) | Wave 6 | Blocks: none | Blocked By: 7,8

  **References**:
  - Pattern: `src/agents/manifest.ts:23-28,47-52,71-76` — current marketing/brand/devrel identities
  - Pattern: `oh-my-opencode.jsonc:23-66,95-102` — current public descriptions/categories for these agents
  - Pattern: `README.md` — published skill mapping for marketing/devrel-related sub-skills
  - Pattern: `src/cli/personality-meta.ts` — shared personality metadata to update later in Task 13 after Wave 6 decisions are complete

  **Acceptance Criteria**:
  - [x] All three current role domains map to one retained base agent plus explicit skills
  - [x] No public docs still describe the old three-agent external comms topology
  - [x] Developer-doc/tutorial/migration responsibilities remain explicitly owned
  - [x] The task records the exact `brandPersonality`/`devrelPersonality` removals and `cmoPersonality` landing rules that Task 13 must apply to shared infrastructure files

  **QA Scenarios**:
  ```
  Scenario: Growth/comms capability retention check
    Tool: Bash
    Steps: compare pre/post capability matrix rows for marketing, brand-builder, and devrel
    Expected: every prior capability has a surviving owner (base or skill)
    Evidence: .sisyphus/evidence/task-10-growth-comms.txt

  Scenario: No stale peer-agent references remain
    Tool: Bash
    Steps: inspect role-specific source/docs plus topology artifacts for `brand-builder` and `devrel-wunderkind`; verify surviving ownership is explicit and shared-file edits are deferred to Task 13
    Expected: no role-specific ambiguity remains, and the task does not mutate shared infrastructure files early
    Evidence: .sisyphus/evidence/task-10-growth-comms-error.txt
  ```

  **Commit**: YES | Message: `refactor(comms): merge marketing brand and devrel` | Files: marketing/brand/devrel domain files plus supporting plan artifacts; shared infrastructure/docs ownership tables deferred to Task 13/15

- [x] 11. Consolidate QA and support into the product/fullstack split

  **What to do**: Remove `qa-specialist` and `support-engineer` as base agents. Move issue intake, repro framing, severity, prioritization, acceptance-review, and `triage-issue` workflow ownership into `product-wunderkind`; move TDD execution, regression, coverage, and technical defect diagnosis into `fullstack-wunderkind`. Remove `qaPersonality` and `supportPersonality`; fold them into `productPersonality` and `ctoPersonality` as defined in the fixed personality-key rules, and record the exact shared-file cleanup that Task 13/15 must apply.
  **Must NOT do**: Do not lose user-facing repro/triage clarity or explicit TDD/testing doctrine during the split. Do not edit shared infrastructure files (`src/agents/manifest.ts`, `oh-my-opencode.jsonc`, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, `src/cli/personality-meta.ts`, `schemas/wunderkind.config.schema.json`, README ownership tables) in this task; those changes are aggregated in Task 13/15.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: prompt consolidation with behavior preservation
  - Skills: [`triage-issue`, `tdd`] — why needed: preserve support triage behavior and explicit testing doctrine
  - Omitted: [`agile-pm`] — why not needed: not a decomposition task

  **Parallelization**: Can Parallel: YES (domain-scoped files only) | Wave 6 | Blocks: none | Blocked By: 5,7,8

  **References**:
  - Pattern: `src/agents/manifest.ts:53-58,89-94` — current QA and support identities
  - Pattern: `src/index.ts:67,72,77-87` — current QA/support responsibilities and delegation rules
  - Pattern: `skills/triage-issue/SKILL.md` — shared triage workflow baseline
  - Pattern: `src/cli/personality-meta.ts` — shared personality metadata to update later in Task 13 after Wave 6 decisions are complete
  - External: `https://github.com/mattpocock/skills/blob/main/tdd/SKILL.md`

  **Acceptance Criteria**:
  - [x] `triage-issue` remains a first-class workflow owned by `product-wunderkind`
  - [x] TDD doctrine and regression/testing execution are explicitly owned by `fullstack-wunderkind`
  - [x] The task records the exact `qaPersonality`/`supportPersonality` removals and `triage-issue` surviving-owner change that Task 13/15 must apply to shared infrastructure/docs files

  **QA Scenarios**:
  ```
  Scenario: Quality/triage authority covers prior support scope
    Tool: Bash
    Steps: compare capability matrix rows for qa-specialist and support-engineer before/after merge
    Expected: no support triage/repro/severity capability is lost
    Evidence: .sisyphus/evidence/task-11-quality-triage.txt

  Scenario: Skill ownership remains valid after merge
    Tool: Bash
    Steps: inspect `triage-issue` references and agent ownership after consolidation; verify the shared-file update list for Task 13/15 explicitly includes README/sub-skill ownership cleanup and personality-surface cleanup
    Expected: the skill has an explicit surviving owner and no orphaned ownership decision remains
    Evidence: .sisyphus/evidence/task-11-quality-triage-error.txt
  ```

  **Commit**: YES | Message: `refactor(quality): split qa and support into product and fullstack` | Files: QA/support domain files plus supporting plan artifacts; shared infrastructure/docs ownership tables deferred to Task 13/15

- [x] 12. Reduce specialist count while preserving governance authority

  **What to do**: Keep `ciso`, `legal-counsel`, `fullstack-wunderkind`, and `creative-director` as durable specialists. Remove `operations-lead` and fold reliability/runbooks/admin tooling into `fullstack-wunderkind`; route security-incident posture and compliance impact to `ciso`. Remove `data-analyst` and split its capabilities explicitly: product/usage analytics → `product-wunderkind`; campaign/funnel analytics → `marketing-wunderkind`. Keep `legal-counsel` as a retained base authority and also preserve narrow licensing/policy workflows as explicit legal/governance skills. Record the exact shared-file cleanup that Task 13 must apply for ops/data personality and authority surfaces.
  **Must NOT do**: Do not remove `legal-counsel` or collapse security/legal authority domains. Do not edit shared infrastructure files (`src/agents/manifest.ts`, `oh-my-opencode.jsonc`, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, `src/cli/personality-meta.ts`, `schemas/wunderkind.config.schema.json`, README ownership tables) in this task; those changes are aggregated in Task 13/15.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: authority-boundary design with risk implications
  - Skills: [`compliance-officer`, `oss-licensing-advisor`, `design-an-interface`] — why needed: preserve governance/legal detail and narrow engineering methods without keeping extra base peers
  - Omitted: [`grill-me`] — why not needed: this is role-boundary implementation, not discovery intake

  **Parallelization**: Can Parallel: YES (domain-scoped files only) | Wave 6 | Blocks: none | Blocked By: 5,7,8

  **References**:
  - Pattern: `src/agents/manifest.ts:41-95` — current remaining specialist set
  - Pattern: `oh-my-opencode.jsonc:68-129` — security, ops, legal, support, data public categories/descriptions
  - Pattern: `src/index.ts:67-87` — current delegation rules that must be preserved or re-routed
  - Pattern: `src/cli/personality-meta.ts` — shared personality metadata to update later in Task 13 after Wave 6 decisions are complete
  - External: `https://github.com/openai/openai-agents-python/blob/f25a4f95ed46ede55f363fb9410d4aab9f915cde/docs/multi_agent.md#L33-L40`

  **Acceptance Criteria**:
  - [x] `legal-counsel` remains a retained base agent
  - [x] `operations-lead` and `data-analyst` are removed as base agents with explicit capability landing rules implemented
  - [x] No high-risk authority domain is removed solely for numerics
  - [x] The task records the exact `opsPersonality`/`dataAnalystPersonality` removals and authority landings that Task 13 must apply to shared infrastructure files

  **QA Scenarios**:
  ```
  Scenario: High-risk authority preservation check
    Tool: Bash
    Steps: inspect topology decision + capability matrix for ciso, ops, legal, and data domains
    Expected: every high-risk domain has an explicit surviving authority path
    Evidence: .sisyphus/evidence/task-12-governance-authority.txt

  Scenario: Removed agents have preserved capabilities
    Tool: Bash
    Steps: compare removed-agent capabilities to retained-agent/skill mappings; verify the shared-file update list for Task 13 explicitly includes ops/data personality-surface cleanup
    Expected: no removed agent leaves an unmapped critical capability or an undocumented shared-file cleanup dependency
    Evidence: .sisyphus/evidence/task-12-governance-authority-error.txt
  ```

  **Commit**: YES | Message: `refactor(topology): preserve authorities while reducing peers` | Files: ops/data/legal domain files plus supporting plan artifacts; shared infrastructure/docs ownership tables deferred to Task 13/15

- [x] 13. Rewire manifests, prompts, routing rules, config surfaces, and soul integration to the reduced topology

  **What to do**: Update `src/agents/manifest.ts`, `src/index.ts`, generated agent surfaces, OMO config, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, `src/cli/init.ts`, `src/cli/personality-meta.ts`, README ownership tables, `schemas/wunderkind.config.schema.json`, and `src/agents/docs-config.ts` so the new topology, removed personality keys, SOUL.md integration rules, and Desloppify opt-in gate are actually enforced. Remove or redirect the six removed-agent entries in `AGENT_DOCS_CONFIG` (`brand-builder`, `qa-specialist`, `operations-lead`, `devrel-wunderkind`, `data-analyst`, `support-engineer`) so the docs-output and `/docs-index` surfaces reference only retained agents. Add explicit no-self-delegation and shallow-recursion rules for the orchestrator and any remaining specialists. Ensure generated base prompts are slimmer when no soul customization exists and that code-health/Desloppify guidance is only advertised when enabled, with a first-trigger fallback path when disabled. Before implementation starts, read `.sisyphus/plans/soul-architecture.md` and confirm it resolves all SOUL decisions required for wiring.
  **Must NOT do**: Do not leave any stale agent IDs, config entries, generated markdown, or routing prose that reflects the old topology.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: central harness implementation and routing safety
  - Skills: [`agile-pm`] — why needed: sequence changes safely without file conflict or orphan surfaces
  - Omitted: [`tdd`] — why not needed: routing implementation, not testing doctrine design

  **Parallelization**: Can Parallel: NO | Wave 7 | Blocks: 14,15 | Blocked By: 8,9,10,11,12

  **References**:
  - Pattern: `src/agents/manifest.ts:22-97` — current durable agent registry
  - Pattern: `src/index.ts:55-93` — native-agent listing and delegation rules injected into runtime
  - Pattern: `oh-my-opencode.jsonc:14-131` — public agent/config registration surface
  - Pattern: `src/cli/init.ts:97-427` — init prompting surface for SOUL customization and Desloppify opt-in wiring
  - Pattern: `src/cli/personality-meta.ts` — shared human-readable personality metadata requiring consolidated key cleanup
  - Pattern: `.sisyphus/plans/soul-architecture.md` — authoritative SOUL decision document to implement
  - Pattern: `src/build-agents.ts` — generated agent markdown pipeline

  **Acceptance Criteria**:
  - [x] Manifest, runtime prompt injection, OMO config, README, and generated `agents/*.md` all describe the same retained topology
  - [x] Generated base prompts no longer embed mandatory soul/personality text for non-customized agents
  - [x] Generated/runtime capability surfaces respect `desloppifyEnabled` instead of advertising code-health integration unconditionally
  - [x] Shared infrastructure cleanup from Tasks 10–12 is fully applied in `manifest`, `schema`, `config-manager`, `doctor`, `personality-meta`, and README ownership tables
  - [x] `.sisyphus/plans/soul-architecture.md` is read and implemented as the authoritative SOUL decision source before any SOUL wiring changes are made
  - [x] Orchestrator routing contract explicitly forbids self-delegation loops
  - [x] `bun run build` regenerates a clean, aligned agent set
  - [x] `AGENT_DOCS_CONFIG` in `src/agents/docs-config.ts` contains entries only for the 6 retained agents; removed agent keys (`brand-builder`, `qa-specialist`, `operations-lead`, `devrel-wunderkind`, `data-analyst`, `support-engineer`) are deleted or migrated to surviving owners so docs-output and `/docs-index` do not reference non-existent agents

  **QA Scenarios**:
  ```
  Scenario: Topology alignment build check
    Tool: Bash
    Steps: run `bun run build`; compare manifest IDs, generated agents, and OMO config entries
    Expected: no orphan/missing agent IDs or stale generated prompts remain
    Evidence: .sisyphus/evidence/task-13-routing-topology.txt

  Scenario: Orchestrator recursion guard check
    Tool: Bash
    Steps: grep orchestrator prompt/routing rules for explicit no-self-delegation and shallow-recursion guidance
    Expected: routing contract blocks accidental self-routing loops
    Evidence: .sisyphus/evidence/task-13-routing-topology-error.txt
  ```

  **Commit**: YES | Message: `refactor(harness): rewire manifests routing and soul integration` | Files: `src/index.ts`, `src/agents/manifest.ts`, `src/agents/docs-config.ts`, `oh-my-opencode.jsonc`, `agents/`, `src/cli/config-manager/index.ts`, `src/cli/doctor.ts`, `src/cli/init.ts`, `schemas/wunderkind.config.schema.json`

- [x] 14. Produce the OMO overlay vs adjacent-runtime decision memo

  **What to do**: Audit exactly what Wunderkind relies on in OMO/OpenCode today and publish an explicit decision: remain overlay now, plus a concrete set of triggers for when to move adjacent to OMO. The default decision for this plan is **stay overlay** until proven limitations appear around persistent state, retries, explicit task graphs, or scheduler ownership.
  **Must NOT do**: Do not initiate migration work in this task.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: strategic decision memo with technical criteria
  - Skills: [`design-an-interface`] — why needed: compare platform-shape options and make interface/ownership tradeoffs explicit
  - Omitted: [`prd-pipeline`] — why not needed: this is platform strategy, not product artifact flow

  **Parallelization**: Can Parallel: NO | Wave 8 | Blocks: 15 | Blocked By: 8,13

  **References**:
  - Pattern: `src/index.ts:7-96` — current overlay implementation surface
  - Pattern: `src/cli/config-manager/index.ts:37-56,62-108,117-147` — config/runtime defaults and OMO package detection context
  - External: `https://github.com/opencode-ai/opencode/blob/c9c0318e0e5c2fcd80fc1c32a1ccfe360f182f90/packages/plugin/src/index.ts#L148-L234`
  - External: `https://github.com/opencode-ai/opencode/blob/c9c0318e0e5c2fcd80fc1c32a1ccfe360f182f90/packages/opencode/src/plugin/index.ts#L24-L105`
  - External: `https://github.com/code-yeongyu/oh-my-openagent/blob/05c744da726dbd1f0c41259ec3dae7e0e9fdb8c1/src/index.ts#L17-L96`

  **Acceptance Criteria**:
  - [x] `.sisyphus/plans/overlay-decision.md` exists and ends with an explicit recommendation: overlay now, adjacent-runtime later only if named triggers fire
  - [x] Migration triggers are concrete (persistent delegation, retries, explicit task graphs, scheduler ownership, observability)
  - [x] No code changes beyond documentation/guardrails are introduced by this task

  **QA Scenarios**:
  ```
  Scenario: Overlay decision is explicit and gated
    Tool: Bash
    Steps: inspect the decision memo for current recommendation and named migration triggers
    Expected: no vague "maybe migrate later" wording remains
    Evidence: .sisyphus/evidence/task-14-overlay-decision.txt

  Scenario: Current overlay still works after audit docs added
    Tool: Bash
    Steps: run `node bin/wunderkind.js doctor --verbose`
    Expected: doctor still reports current overlay/runtime details cleanly
    Evidence: .sisyphus/evidence/task-14-overlay-decision-error.txt
  ```

  **Commit**: YES | Message: `docs(platform): define overlay and migration gates` | Files: `.sisyphus/plans/overlay-decision.md`, `README.md`, `AGENTS.md` if referenced

- [x] 15. Finalize docs, doctor output, init-deep workflow, and token-usage measurement around the new harness

  **What to do**: Update docs, doctor/help surfaces, and workflow guidance to present the reduced topology, orchestrator-first model, retained skills, ownership rules, TDD doctrine location, optional SOUL.md behavior, the opt-in Desloppify/code-health workflow, and the explicit init-deep audit/bootstrap flow. Add measurable token-usage reporting with before/after prompt-size evidence and ensure docs-index/docs-output language reflects the cheaper slimmer-agent model. Explicitly document that setup asks whether to enable Desloppify, that first-trigger fallback can offer install/enable guidance later, and that upstream installation is via Python 3.11+ plus the pip command rather than undocumented platform-native package formulas. Add maintainer guidance to `AGENTS.md` stating that audit-style critic agents (Metis, Momus, or equivalent reviewer roles) must be spawned as fresh agents for each new review pass after fixes rather than reusing the previous reviewer session.
  **Must NOT do**: Do not leave old 12-peer mental models in published docs or doctor output.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: final user/admin-facing reconciliation task
  - Skills: [`write-a-skill`] — why needed: align final docs with the published skill standard without pre-committing to undocumented orphan-skill retention
  - Omitted: [`design-an-interface`] — why not needed: final docs alignment, not option exploration

  **Parallelization**: Can Parallel: NO | Wave 9 | Blocks: Final Verification Wave | Blocked By: 1,9,13,14

  **References**:
  - Pattern: `README.md` — primary user docs, including sub-skill ownership tables that must reflect the consolidated topology
  - Pattern: `AGENTS.md` — maintainer knowledge base
  - Pattern: `src/cli/doctor.ts:77-280` — doctor sections that must match the new harness
  - Pattern: `src/cli/init.ts:97-427` — init and workflow-mode prompts/guidance
  - Pattern: `src/index.ts:55-93` — runtime-injected native-agent summary and delegation rules

  **Acceptance Criteria**:
  - [x] Public docs and doctor output describe the same retained topology, SOUL model, and skill model
  - [x] The init-deep audit/bootstrap flow is explicitly documented and consistently named
  - [x] Public docs explain Desloppify opt-in, first-trigger fallback, Python 3.11+ requirement, official pip install command, and `.desloppify/` local-state behavior
  - [x] Users can identify who owns routing, who owns high-risk authority, what SOUL customization means, and what skills are available from docs alone
  - [x] Before/after token-size evidence exists for generated agent prompts or equivalent prompt surfaces; specifically, `.sisyphus/evidence/task-15-prompt-after.txt` exists containing `wc -c agents/*.md` output and its values are materially smaller than `.sisyphus/evidence/task-1-prompt-baseline.txt`
  - [x] `AGENTS.md` explicitly states that a new audit pass after fixes must use a fresh reviewer agent/session rather than reusing the previous Metis/Momus session
  - [x] README sub-skill ownership tables (including `triage-issue`) match the consolidated surviving owners

  **QA Scenarios**:
  ```
  Scenario: Doctor and docs tell the same story
    Tool: Bash
    Steps: run `node bin/wunderkind.js doctor --verbose`; compare sections against README/AGENTS topology and workflow docs; assert removed agents/roles do not appear in doctor output via negative grep checks on captured output
    Expected: no mismatch in retained agent set, skills, workflow mode semantics, or removed-agent references
    Evidence: .sisyphus/evidence/task-15-final-docs.txt

  Scenario: Init-deep workflow is no longer ambiguous
    Tool: Bash
    Steps: grep docs/help surfaces for `init-deep` and inspect referenced behavior
    Expected: the workflow is documented explicitly, not left as unexplained jargon
    Evidence: .sisyphus/evidence/task-15-final-docs-error.txt
  ```

  **Commit**: YES | Message: `docs(harness): finalize slim soul-aware workflow guidance` | Files: `README.md`, `AGENTS.md`, `src/cli/doctor.ts`, `src/cli/index.ts`, `src/cli/init.ts`, token evidence artifact(s)

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 6 verification checks are required: 5 reviewer-style checks (`F0a`, `F0b`, `F1`, `F2`, `F4`) plus 1 command-level QA pass (`F3`). Run the 5 reviewer checks in parallel; run `F3` in parallel with them when possible. ALL 6 checks must pass. Reviewer checks must explicitly approve; `F3` must exit successfully.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark any of `F0a`, `F0b`, `F1`, `F2`, `F3`, or `F4` as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
> **Reviewer freshness rule:** if any reviewer returns findings and the plan/work is updated, the next Metis/Momus/oracle/critic pass must use a brand-new agent/session. Do not continue the prior reviewer session for a new audit round; reused reviewer sessions may narrow their attention to previously reported findings instead of performing a fresh audit.
- [x] F0a. TDD Doctrine Review — unspecified-high

  **QA Scenario**:
  ```
  Scenario: Focused review of TDD doctrine and test-first workflow quality
    Tool: task(category="unspecified-high")
    Steps: provide the final diff, the surviving TDD doctrine locations (`skills/tdd/`, `src/agents/fullstack-wunderkind.ts`, `src/agents/product-wunderkind.ts`, and any shared prompt sections that now carry testing doctrine), plus this plan; ask the reviewer to assess whether the shipped TDD model is genuinely stronger than before, internally consistent, and operationally usable across QA/testing tasks; if `src/agents/qa-specialist.ts` was removed, the reviewer should treat that removal in the diff as part of the review rather than requiring the file to still exist
    Expected: reviewer explicitly approves the TDD/testing doctrine or returns concrete doctrine gaps to fix
    Evidence: .sisyphus/evidence/f0a-tdd-doctrine.txt
  ```

- [x] F0b. Architecture/Topology Review — unspecified-high

  **QA Scenario**:
  ```
  Scenario: Focused review of orchestrator-first topology and skill extraction design
    Tool: task(category="unspecified-high")
    Steps: provide the final diff, retained-topology docs, capability matrix, and this plan; ask the reviewer to assess orchestrator choice, base-agent reduction, authority preservation, and whether `design-an-interface` and other extracted skills are placed coherently
    Expected: reviewer explicitly approves the architecture/topology or returns concrete structural issues to fix
    Evidence: .sisyphus/evidence/f0b-architecture-topology.txt
  ```

- [x] F1. Plan Compliance Audit — oracle

  **QA Scenario**:
  ```
  Scenario: Oracle verifies final implementation against this plan
    Tool: task(subagent_type="oracle")
    Steps: provide the final changed file set plus this plan path; instruct oracle to compare delivered behavior, retained topology, skill ownership, and migration-gate documentation against the plan's task acceptance criteria
    Expected: oracle returns explicit approval with no missing planned deliverables or flags concrete deviations to fix
    Evidence: .sisyphus/evidence/f1-plan-compliance.txt
  ```

- [x] F2. Code Quality Review — unspecified-high

  **QA Scenario**:
  ```
  Scenario: Independent code review of harness changes
    Tool: task(category="unspecified-high")
    Steps: provide the final diff and ask for a code-quality review covering maintainability, prompt clarity, dead-code/orphan-skill risk, regression risk, and config/doctor consistency
    Expected: reviewer approves or returns a finite list of concrete issues; all blocking issues must be fixed before completion
    Evidence: .sisyphus/evidence/f2-code-quality.txt
  ```

- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)

  **QA Scenario**:
  ```
  Scenario: Command-level manual QA of the optimized harness
    Tool: Bash
    Steps: run `npx tsc --noEmit && bun test tests/unit/ && bun run build && node bin/wunderkind.js --help && node bin/wunderkind.js doctor --verbose`; if any UI/docs-output interaction was changed, additionally exercise the relevant flow with Playwright or interactive_bash
    Expected: all commands succeed, doctor output matches documented topology/workflow semantics, and any changed interactive flow behaves as documented
    Evidence: .sisyphus/evidence/f3-manual-qa.txt
  ```

- [x] F4. Scope Fidelity Check — unspecified-high

  **QA Scenario**:
  ```
  Scenario: Deep review for overbuild, underbuild, or scope drift
    Tool: task(category="unspecified-high")
    Steps: provide the final diff, the original request summary, and this plan; ask the reviewer to identify any capability lost, any unrequested expansion, and any unresolved ambiguity left in the shipped topology/skill/platform decisions
    Expected: reviewer confirms the work stayed within requested scope and did not leave hidden gaps; otherwise returns specific drift to correct
    Evidence: .sisyphus/evidence/f4-scope-fidelity.txt
  ```

## Commit Strategy
- Commit 1 → Task 1: docs/test audit freshness and init-deep clarification
- Commit 2 → Task 2: harness coverage expansion
- Commit 3 → Task 3: import/adapt benchmark skills locally
- Commit 4 → Task 4: publish skill standard
- Commit 5 → Task 5: adopt interface-design + tdd doctrine
- Commit 6 → Task 6: add opt-in Desloppify code-health workflow surface
- Commit 7 → Task 7: capability matrix artifact
- Commit 8 → Task 8: orchestrator-first product topology
- Commit 9 → Task 9: optional per-persona SOUL architecture
- Commit 10 → Task 10: growth/comms consolidation into marketing
- Commit 11 → Task 11: QA/support split into product + fullstack
- Commit 12 → Task 12: operations/data reduction with legal retained
- Commit 13 → Task 13: manifest/routing/config/schema rewiring
- Commit 14 → Task 14: overlay decision memo
- Commit 15 → Task 15: final docs/doctor/init alignment

## Success Criteria
- Wunderkind no longer presents 12 equal peers; one orchestrator and a smaller durable specialist set are explicit everywhere
- Every removed or merged agent capability survives as either a retained authority or a skill
- Skills have a published authoring standard and explicit ownership/trigger boundaries
- `design-an-interface` exists as an explicit high-complexity engineering skill rather than hidden default persona behavior
- TDD doctrine is materially stronger, explicit, and review-approved
- Desloppify is discoverable but opt-in, with explicit setup-time and first-trigger enablement guidance grounded in official upstream installation paths
- Critical harness surfaces have regression coverage
- The platform strategy is explicit: overlay now, adjacent runtime only after named triggers fire
- Docs, doctor output, manifests, generated agent files, and config registration all describe the same system
