# Wunderkind Openagent Brand Migration, Default Inheritance Alignment, and Plan Decomposition

## TL;DR
> **Summary**: Convert Wunderkind to a brand-first `oh-my-openagent` presentation while preserving upstream technical identifiers that still remain `oh-my-opencode`, then align the shipped sample config to inherit current upstream category defaults instead of hard-coded per-agent models, and finally decompose the oversized `docs-output-system` plan into smaller workstreams inside this master plan.
> **Deliverables**:
> - Brand/technical identifier contract with repo-wide allowlist and grep audits
> - Pre-1.0 breaking release update to `0.7.0` with explicit README migration note
> - README / AGENTS / CLI / source prompt copy updated to brand-first mixed terminology
> - `oh-my-opencode.jsonc` converted from hard-coded `model` values to category-based inheritance
> - Contract tests for config template, manifests, and generated prompt surfaces
> - Regenerated `agents/*.md` matching updated source wording
> - `docs-output-system.md` reduced from a mega-plan into a superseded overview + crosswalk
> **Effort**: XL
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 11

## Context
### Original Request
Review the plans folder, update the project from `oh-my-opencode` to `oh-my-openagent`, adopt the latest upstream OpenAI/default-model guidance via inheritance where possible, and split overly large plans into smaller projects/workstreams with more detailed tasks.

### Interview Summary
- Existing repo references span `package.json`, `README.md`, `.claude-plugin/plugin.json`, `src/cli/*`, `src/index.ts`, `src/agents/*.ts`, tests, generated `agents/*.md`, and `.sisyphus/plans/docs-output-system.md`.
- The user confirmed this can be a **breaking pre-1.0 release** because Wunderkind is not yet in real use; README must say the release breaks older installs.
- Rename scope is **brand-first**: use `oh-my-openagent` for user-facing branding, but preserve literal technical identifiers still required upstream (`oh-my-opencode` npm package, binary, schema filename, config filename).
- Verification strategy is **mixed TDD**: TDD for behavior/config changes, tests-after for mechanical copy or generated-output work.
- The user also wants the old `docs-output-system.md` mega-plan decomposed into smaller workstreams, but this master plan remains the single execution plan of record.

### Metis Review (gaps addressed)
- Freeze an explicit preserve-vs-rename matrix before editing; do **not** globally rename `oh-my-opencode`.
- Treat upstream technical identifiers as allowlisted literals until upstream actually changes them.
- Keep docs-output decomposition planning-only; do not smuggle feature implementation from the old docs plan into the rebrand work.
- Add contract checks for: allowed remaining `oh-my-opencode` strings, no hard-coded `model` keys in `oh-my-opencode.jsonc`, correct `12`-agent copy, and sync between `package.json` and `.claude-plugin/plugin.json`.
- Serialize same-file edits (`README.md`, `package.json`, `src/cli/index.ts`, `src/agents/*.ts`) and regenerate `agents/*.md` only from source.

## Work Objectives
### Core Objective
Ship a high-confidence pre-1.0 migration that presents Wunderkind as an `oh-my-openagent` addon, keeps compatibility with upstream’s still-old technical identifiers, updates Wunderkind’s shipped config to inherit current upstream defaults via categories, and replaces the oversized docs-output plan with a compact decomposed structure.

### Deliverables
- `package.json` and `.claude-plugin/plugin.json` updated to `0.7.0`, with brand-first descriptions and preserved upstream package dependency name `oh-my-opencode`
- `README.md`, `AGENTS.md`, and CLI/help/source copy updated to explain the repo-vs-package split (`oh-my-openagent` brand, `oh-my-opencode` technical identifiers)
- `oh-my-opencode.jsonc` updated to use category-based inheritance for all 12 Wunderkind agents using the matrix defined in Task 5
- New/updated tests covering config-template contract, manifest sync, and prompt-surface wording assumptions
- Regenerated `agents/*.md` after source changes
- `.sisyphus/plans/docs-output-system.md` rewritten as a superseded overview plus TODO-to-workstream crosswalk

### Definition of Done (verifiable conditions with commands)
- [ ] `tsc --noEmit` exits 0
- [ ] `bun test tests/unit/` exits 0
- [ ] `bun run build` exits 0
- [ ] `node -e "const p=require('./package.json'); const c=require('./.claude-plugin/plugin.json'); if(p.version!=='0.7.0'||c.version!=='0.7.0') process.exit(1)"`
- [ ] `node -e "const p=require('./package.json'); if(!p.dependencies['oh-my-opencode']||p.dependencies['oh-my-opencode']!=='^3.11.0') process.exit(1)"`
- [ ] `grep -R "github.com/code-yeongyu/oh-my-opencode" README.md AGENTS.md oh-my-opencode.jsonc src agents .claude-plugin package.json` returns no matches
- [ ] `node -e "const fs=require('fs'); const {parse}=require('jsonc-parser'); const c=parse(fs.readFileSync('oh-my-opencode.jsonc','utf8')); const names=['wunderkind:marketing-wunderkind','wunderkind:creative-director','wunderkind:product-wunderkind','wunderkind:fullstack-wunderkind','wunderkind:brand-builder','wunderkind:qa-specialist','wunderkind:operations-lead','wunderkind:ciso','wunderkind:devrel-wunderkind','wunderkind:legal-counsel','wunderkind:support-engineer','wunderkind:data-analyst']; if(!names.every(n=>c.agents[n]?.category) || Object.values(c.agents).some(v=>Object.prototype.hasOwnProperty.call(v,'model'))) process.exit(1)"`
- [ ] `grep -n "Breaking change" README.md` finds the pre-1.0 migration note
- [ ] `[ "$(grep -c '^- \[ \]' .sisyphus/plans/docs-output-system.md)" -lt 15 ]` passes

### Must Have
- Preserve the following literals until upstream changes them: `oh-my-opencode` npm package name, `bunx oh-my-opencode` / `npx oh-my-opencode`, `oh-my-opencode.jsonc`, `oh-my-opencode.schema.json`
- Change repo/documentation URLs to the new upstream repo path: `code-yeongyu/oh-my-openagent`
- Ship the migration as `0.7.0` with an explicit README breaking-change warning
- Use category inheritance in `oh-my-opencode.jsonc` instead of hard-coded `model` keys
- Update stale copy that still says Wunderkind ships 8 agents; canonical count is 12
- Regenerate `agents/*.md` from `src/agents/*.ts`; never hand-edit generated files
- Decompose `docs-output-system.md` without implementing its feature work as part of this migration

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No blind search/replace of `oh-my-opencode`
- No dependency rename to `oh-my-openagent` while upstream package name remains `oh-my-opencode`
- No config filename rename from `oh-my-opencode.jsonc` while upstream docs/schema still use that filename
- No piggyback fixes from the old docs-output plan (config-path bug, doctor command, personality gate, etc.) unless explicitly listed in this plan
- No direct edits to `agents/*.md`
- No version target other than `0.7.0` in this migration
- No business-logic assumptions about upstream technical renames that are not evidenced by current upstream docs

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **Mixed TDD** — TDD for config/default-resolution and contract tests; tests-after for copy, docs, and generated artifact updates
- QA policy: Every task includes explicit agent-run happy-path and edge/failure checks
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Workstream Map
- **R1 — Brand Contract + Release Surfaces**: Tasks 1-4
- **R2 — Default Inheritance + Test Contracts**: Tasks 5-7
- **P1 — Docs Plan Decomposition**: Tasks 8-10
- **R3 — Final Guardrail Sweep**: Task 11

### Parallel Execution Waves
> Target: 5-8 tasks per wave. Shared-file edits are serialized even when the wave contains multiple tasks.

Wave 1:
- Task 1 — identifier allowlist / denylist inventory
- Task 2 — release metadata and dependency alignment
- Task 5 — TDD config-template inheritance conversion
- Task 8 — docs-output mega-plan inventory and classification

Wave 2:
- Task 3 — README / AGENTS rebrand + migration note
- Task 4 — CLI / runtime / prompt source wording alignment
- Task 6 — contract test expansion and existing test updates
- Task 9 — superseded overview rewrite for `docs-output-system.md`

Wave 3:
- Task 7 — regenerate `agents/*.md` and verify generated output
- Task 10 — compact crosswalk rewrite for `docs-output-system.md`
- Task 11 — repo-wide contract verification sweep

### Dependency Matrix (full)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | — | 2, 3, 4, 5, 8, 11 |
| 2 | 1 | 3, 4, 6, 11 |
| 3 | 1, 2 | 6, 11 |
| 4 | 1, 2 | 6, 7, 11 |
| 5 | 1 | 6, 7, 11 |
| 6 | 3, 4, 5 | 7, 11 |
| 7 | 4, 5, 6 | 11 |
| 8 | 1 | 9, 10 |
| 9 | 8 | 10 |
| 10 | 8, 9 | 11 |
| 11 | 2, 3, 4, 5, 6, 7, 10 | F1, F2, F3, F4 |

### Agent Dispatch Summary
- Wave 1 → 4 tasks → `unspecified-high`, `quick`, `deep`, `writing`
- Wave 2 → 4 tasks → `writing`, `unspecified-high`, `unspecified-high`, `writing`
- Wave 3 → 3 tasks → `quick`, `writing`, `quick`

## TODOs
> Implementation + Test = ONE task. Never separate.
> Every task includes explicit QA scenarios and a fixed acceptance contract.

- [x] 1. Freeze the `oh-my-opencode` preserve-vs-rename contract before any code or doc edits

  **What to do**: Create a repo-local identifier matrix covering every current `oh-my-opencode` reference and classify each as `PRESERVE_LITERAL`, `REPO_URL_RENAME`, `USER_FACING_BRAND_RENAME`, or `DELETE`. The matrix must explicitly preserve these literals: npm dependency `oh-my-opencode`, install command `bunx oh-my-opencode`, config filename `oh-my-opencode.jsonc`, schema filename `oh-my-opencode.schema.json`. It must explicitly rename repo/documentation URLs from `github.com/code-yeongyu/oh-my-opencode` to `github.com/code-yeongyu/oh-my-openagent`. Store the matrix inside the plan file as task output notes or in a short appendix added by the implementer during execution.
  **Must NOT do**: Do not edit source, docs, or tests in this task. Do not assume every `oh-my-opencode` string should change.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: broad inventory, contract-setting, and no single-file shortcut
  - Skills: []
  - Omitted: [`git-master`] — no git work required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 4, 5, 8, 11 | Blocked By: none

  **References**:
  - Pattern: `package.json:33-39` — current dependency still points to `oh-my-opencode`
  - Pattern: `README.md:42-57` — current install docs mix user-facing wording and technical install commands
  - Pattern: `AGENTS.md:53-65` — current project knowledge base still describes old upstream naming
  - Pattern: `oh-my-opencode.jsonc:1-12` — sample config still uses old repo URL and schema filename
  - External: `https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/package.json` — upstream repo renamed but package name still `oh-my-opencode`
  - External: `https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/docs/reference/configuration.md` — upstream still documents `oh-my-opencode.jsonc`

  **Acceptance Criteria**:
  - [ ] Matrix exists and classifies every preserved technical identifier and every intended repo URL rename
  - [ ] Matrix explicitly lists the four preserved literals and the repo URL rename rule
  - [ ] No later task in the branch changes any identifier outside the approved matrix

  **QA Scenarios**:
  ```
  Scenario: Preserve/rename matrix is complete
    Tool: Bash
    Steps: 1) Grep for `oh-my-opencode|oh-my-openagent` across package.json README.md AGENTS.md src tests oh-my-opencode.jsonc .claude-plugin 2) Compare every class of match against the matrix produced in this task
    Expected: Every match class has an explicit preserve/rename/delete decision
    Evidence: .sisyphus/evidence/task-1-identifier-matrix.txt

  Scenario: No unsupported global-rename intent slips into the matrix
    Tool: Bash
    Steps: 1) Inspect matrix text 2) Confirm it preserves `oh-my-opencode`, `oh-my-opencode.jsonc`, `oh-my-opencode.schema.json`, and `bunx oh-my-opencode`
    Expected: All four preserved literals are named exactly
    Evidence: .sisyphus/evidence/task-1-preserve-literals.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: none or plan-local notes only

- [x] 2. Update release metadata and package surfaces for the brand-first pre-1.0 break

  **What to do**: Update `package.json` and `.claude-plugin/plugin.json` to version `0.7.0`. Rewrite descriptions/keywords/files with the new brand-first posture while preserving the dependency name `oh-my-opencode`. Keep `oh-my-opencode.jsonc` in `files` unless Task 1’s matrix explicitly marks it for removal; preferred action is to keep it published because upstream still documents that filename. Update dependency version from `^3.10.0` to `^3.11.0` to match the upstream package manifest discovered during planning.
  **Must NOT do**: Do not rename the dependency to `oh-my-openagent`. Do not remove `oh-my-opencode.jsonc` from publish files without matrix approval.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: constrained manifest edits with clear contract
  - Skills: []
  - Omitted: [`git-master`] — no git work required

  **Parallelization**: Can Parallel: YES (with 5 and 8) | Wave 1 | Blocks: 3, 4, 6, 11 | Blocked By: 1

  **References**:
  - Pattern: `package.json:2-25` — current version/description/files list
  - Pattern: `package.json:33-39` — current dependency version
  - Pattern: `.claude-plugin/plugin.json:1-5` — version must stay in sync
  - External: upstream `package.json` fetched during planning — uses `version: 3.11.0` and still names package `oh-my-opencode`

  **Acceptance Criteria**:
  - [ ] `package.json` version is `0.7.0`
  - [ ] `.claude-plugin/plugin.json` version is `0.7.0`
  - [ ] `package.json.dependencies["oh-my-opencode"] === "^3.11.0"`
  - [ ] `package.json` description and keywords use brand-first wording without claiming the dependency/package name changed

  **QA Scenarios**:
  ```
  Scenario: Manifest versions and dependency align
    Tool: Bash
    Steps: 1) Run node expression checking package.json and plugin.json versions 2) Check oh-my-opencode dependency version
    Expected: Both versions equal 0.7.0 and dependency equals ^3.11.0
    Evidence: .sisyphus/evidence/task-2-manifest-contract.txt

  Scenario: Technical dependency name remains preserved
    Tool: Bash
    Steps: 1) Grep package.json for `oh-my-openagent` 2) Confirm dependency key is still `oh-my-opencode`
    Expected: No dependency key renamed to oh-my-openagent
    Evidence: .sisyphus/evidence/task-2-dependency-name.txt
  ```

  **Commit**: NO | Message: `Included in Task 4 grouped branding commit` | Files: `package.json`, `.claude-plugin/plugin.json`

- [ ] 3. Rewrite README and AGENTS knowledge-base copy to explain the brand/technical split and breaking change

  **What to do**: Update `README.md` and `AGENTS.md` so user-facing copy says Wunderkind is an addon for `oh-my-openagent`, but installation/config examples preserve upstream technical identifiers where required. Add a prominent breaking-change note near installation in `README.md` stating that `0.7.0` is a pre-1.0 breaking release and older installs/config assumptions are not supported. Correct stale “eight agents” references to `12` agents. Update upstream repo links to `code-yeongyu/oh-my-openagent` while preserving examples like `bunx oh-my-opencode install` and config filenames like `oh-my-opencode.jsonc`.
  **Must NOT do**: Do not claim the npm package or binary was renamed. Do not leave mixed old repo URLs in either file.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: high-signal documentation rewrite with consistency rules
  - Skills: []
  - Omitted: [`frontend-ui-ux`] — not relevant

  **Parallelization**: Can Parallel: YES (with 4, 6, 9 after deps satisfied) | Wave 2 | Blocks: 6, 11 | Blocked By: 1, 2

  **References**:
  - Pattern: `README.md:3-7` — current old-brand opening and old repo URL
  - Pattern: `README.md:42-57` — current installation instructions using old repo URLs
  - Pattern: `README.md:85-107` — current inaccurate inheritance description
  - Pattern: `AGENTS.md:3-7` — stale version and 8-agent count
  - Pattern: `AGENTS.md:49-66` — source-of-truth locations that mention `oh-my-opencode.jsonc`
  - External: upstream README/docs fetched during planning — mixed state shows branding can change faster than technical identifiers

  **Acceptance Criteria**:
  - [ ] README contains a visible `Breaking change` note mentioning `0.7.0`
  - [ ] README and AGENTS use `oh-my-openagent` for brand/repo references and `oh-my-opencode` only where technically required
  - [ ] README and AGENTS do not contain the phrase `eight professional agents` or `8 specialist AI agents`
  - [ ] README accurately describes config inheritance policy after Task 5’s implementation

  **QA Scenarios**:
  ```
  Scenario: Brand/technical split is documented correctly
    Tool: Bash
    Steps: 1) Grep README.md and AGENTS.md for `oh-my-opencode` 2) Manually verify each remaining occurrence is a command, package, filename, or schema reference 3) Grep for old repo URL
    Expected: Remaining oh-my-opencode mentions are allowlisted only; old repo URL absent
    Evidence: .sisyphus/evidence/task-3-doc-brand-audit.txt

  Scenario: Breaking-change and agent-count notes are present
    Tool: Bash
    Steps: 1) Grep README.md for `Breaking change` and `0.7.0` 2) Grep README.md and AGENTS.md for `eight|8 specialist|8 agents`
    Expected: Breaking note present; stale 8-agent wording absent
    Evidence: .sisyphus/evidence/task-3-breaking-note.txt
  ```

  **Commit**: NO | Message: `Included in Task 4 grouped branding commit` | Files: `README.md`, `AGENTS.md`

- [ ] 4. Align CLI, plugin runtime text, and agent source prompts to the brand-first contract

  **What to do**: Update `src/cli/index.ts`, `src/index.ts`, and all `src/agents/*.ts` references that are user-facing wording only. Convert branding references such as “Extends oh-my-opencode” and “inside an oh-my-opencode workflow” to the approved brand-first phrasing when they are descriptive, but preserve literal technical filename references like `wunderkind.config.jsonc` until separately changed by other scoped work. In `src/index.ts`, update the plugin system prompt so the project configuration section no longer falsely says config is at project root if that wording is being touched in this task. Also correct any stale 8-agent wording encountered in CLI/help or prompts.
  **Must NOT do**: Do not rename config filenames or upstream commands here. Do not edit generated `agents/*.md` directly.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: many source files with wording rules and shared-file collision risk
  - Skills: []
  - Omitted: [`git-master`] — no git work required

  **Parallelization**: Can Parallel: LIMITED | Wave 2 | Blocks: 6, 7, 11 | Blocked By: 1, 2

  **References**:
  - Pattern: `src/cli/index.ts:20-31` — current old-brand CLI description
  - Pattern: `src/index.ts:73-85` — current plugin prompt has stale config-path wording
  - Pattern: `src/agents/*.ts` grep results — descriptive references to `oh-my-opencode workflow (Atlas/Sisyphus)` across 12 agent factory files
  - Pattern: `src/build-agents.ts:42-49` — generated prompts will be rebuilt from source changes

  **Acceptance Criteria**:
  - [ ] No descriptive/source branding references to old upstream repo branding remain in `src/cli`, `src/index.ts`, or `src/agents/*.ts`
  - [ ] Preserved technical literals remain unchanged where required by Task 1 matrix
  - [ ] No generated file under `agents/` was edited directly in this task

  **QA Scenarios**:
  ```
  Scenario: Source wording uses approved mixed terminology
    Tool: Bash
    Steps: 1) Grep src/ for `oh-my-opencode` 2) Review each remaining occurrence against the preserve matrix
    Expected: All remaining src-level occurrences are technical literals only
    Evidence: .sisyphus/evidence/task-4-src-brand-audit.txt

  Scenario: Generated files were not hand-edited
    Tool: Bash
    Steps: 1) Verify no task touched `agents/*.md` before build regeneration 2) Compare git diff paths after this task
    Expected: Only source files changed prior to Task 7 regeneration
    Evidence: .sisyphus/evidence/task-4-generated-guardrail.txt
  ```

  **Commit**: YES | Message: `feat(branding): adopt openagent brand-first wording for pre-1.0 release` | Files: `package.json`, `.claude-plugin/plugin.json`, `README.md`, `AGENTS.md`, `src/cli/index.ts`, `src/index.ts`, `src/agents/*.ts`

- [x] 5. Convert `oh-my-opencode.jsonc` from hard-coded per-agent models to upstream-aligned category inheritance

  **What to do**: Rewrite `oh-my-opencode.jsonc` so all 12 Wunderkind agents use `category`-based inheritance instead of explicit `model` keys. Create or update a top-level `categories` section in the sample config using the latest upstream-recommended defaults discovered in planning: `quick` → `anthropic/claude-haiku-4-5`, `unspecified-low` → `anthropic/claude-sonnet-4-6`, `unspecified-high` → `openai/gpt-5.4` with `variant: high`, `writing` → `google/gemini-3-flash`, `visual-engineering` → `google/gemini-3.1-pro` with `variant: high`. Map Wunderkind agents to categories as follows: marketing/product/brand/devrel/legal/support/data-analyst → `writing`; fullstack/qa/operations/ciso → `unspecified-high`; creative-director → `visual-engineering`. Preserve `mode`, `color`, and `description` per agent. Update the file comments to explain that brand-facing docs refer to oh-my-openagent, but the file remains `oh-my-opencode.jsonc` to match current upstream technical identifiers.
  **Must NOT do**: Do not leave any per-agent `model` key in the file. Do not invent unsupported upstream fields or custom fallback chains unless directly documented.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: config contract change with inheritance semantics and no room for ambiguity
  - Skills: []
  - Omitted: [`git-master`] — not relevant

  **Parallelization**: Can Parallel: YES (with 2 and 8 after 1) | Wave 1 | Blocks: 6, 7, 11 | Blocked By: 1

  **References**:
  - Pattern: `oh-my-opencode.jsonc:13-120` — current agents hard-code `model`
  - External: `docs/reference/configuration.md` fetched during planning — category defaults and `category` inheritance supported
  - External: `docs/guide/agent-model-matching.md` fetched during planning — category fallback/model rationale
  - Pattern: `README.md:98-107` — downstream docs must match the post-change inheritance behavior

  **Acceptance Criteria**:
  - [ ] `oh-my-opencode.jsonc` contains a top-level `categories` section with the five specified categories and models
  - [ ] Each of the 12 Wunderkind agents has a `category` key and no `model` key
  - [ ] `creative-director` maps to `visual-engineering`; `fullstack`, `qa`, `operations`, and `ciso` map to `unspecified-high`
  - [ ] File comments explain the mixed state: openagent branding, opencode technical filename/schema

  **QA Scenarios**:
  ```
  Scenario: Sample config uses inheritance only
    Tool: Bash
    Steps: 1) Parse oh-my-opencode.jsonc with jsonc-parser 2) Assert all 12 agent entries include category 3) Assert no agent entry contains model
    Expected: Category inheritance only, zero per-agent model keys
    Evidence: .sisyphus/evidence/task-5-config-inheritance.txt

  Scenario: Category defaults match planning contract
    Tool: Bash
    Steps: 1) Parse categories from oh-my-opencode.jsonc 2) Verify quick/unspecified-low/unspecified-high/writing/visual-engineering values and variants
    Expected: Category definitions match the explicit matrix from this task
    Evidence: .sisyphus/evidence/task-5-category-matrix.txt
  ```

  **Commit**: NO | Message: `Included in Task 7 grouped config/inheritance commit` | Files: `oh-my-opencode.jsonc`

- [x] 6. Expand automated tests to lock the branding contract and config inheritance behavior

  **What to do**: Add or update unit tests so the repo now verifies the mixed brand/technical contract. Required test coverage: (a) `tests/unit/agent-factories.test.ts` updated for any prompt wording changes and no stale assumptions about config location wording if Task 4 changed it; (b) new or expanded manifest test asserting `package.json` and `.claude-plugin/plugin.json` versions stay in sync; (c) new config-template test that parses `oh-my-opencode.jsonc` and asserts all agents use `category` instead of `model`; (d) if CLI/help text changed, add a test or snapshot-style assertion for the revised old/new terminology in installer copy. Use TDD for new behavior checks.
  **Must NOT do**: Do not add brittle assertions that require upstream technical names to disappear entirely. Do not rely on live network fetches in tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: several test files, stable contract design, moderate coding effort
  - Skills: []
  - Omitted: [`playwright`] — no browser testing needed

  **Parallelization**: Can Parallel: LIMITED | Wave 2 | Blocks: 7, 11 | Blocked By: 3, 4, 5

  **References**:
  - Test: `tests/unit/agent-factories.test.ts:44-88` — existing prompt assumptions that must be updated carefully
  - Test: `tests/unit/cli-installer.test.ts:73-167` — existing installer test shape
  - Pattern: `package.json:26-31` — existing test command surface
  - Pattern: `oh-my-opencode.jsonc` post-Task-5 state — source of truth for template contract

  **Acceptance Criteria**:
  - [ ] `bun test tests/unit/` includes assertions for manifest version sync and config-template category inheritance
  - [ ] Existing agent-factory tests pass with updated prompt wording expectations
  - [ ] No test requires a full rename of preserved technical literals

  **QA Scenarios**:
  ```
  Scenario: New contract tests fail before implementation and pass after
    Tool: Bash
    Steps: 1) Run targeted bun tests for newly added/edited files 2) Confirm green after implementation
    Expected: Targeted suites pass and prove contract coverage exists
    Evidence: .sisyphus/evidence/task-6-targeted-tests.txt

  Scenario: Full unit suite stays green
    Tool: Bash
    Steps: 1) Run `bun test tests/unit/`
    Expected: Exit code 0 with all suites passing
    Evidence: .sisyphus/evidence/task-6-full-tests.txt
  ```

  **Commit**: NO | Message: `Included in Task 7 grouped config/inheritance commit` | Files: `tests/unit/*.ts`

- [x] 7. Regenerate `agents/*.md` from updated sources and verify generated output reflects the new contract

  **What to do**: Run the normal build pipeline after Tasks 4-6, allowing `src/build-agents.ts` to regenerate all 12 `agents/*.md` files. Then audit generated prompts for two things: (1) descriptive branding references reflect the new brand-first wording from source, and (2) preserved technical identifiers remain intact where required. Ensure generated files are non-empty and correspond only to source changes, not manual edits.
  **Must NOT do**: Do not patch generated files by hand. Do not skip build verification.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: deterministic build/regeneration plus grep-based validation
  - Skills: []
  - Omitted: [`git-master`] — not relevant

  **Parallelization**: Can Parallel: YES (with 10 after deps satisfied) | Wave 3 | Blocks: 11 | Blocked By: 4, 5, 6

  **References**:
  - Pattern: `src/build-agents.ts:42-49` — generation mechanism
  - Pattern: `agents/*.md` — generated outputs to inspect post-build
  - Command: `bun run build` — canonical regen path per repo conventions

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] All 12 `agents/*.md` files are regenerated and non-empty
  - [ ] Generated prompt wording matches source-level brand/technical contract after regeneration

  **QA Scenarios**:
  ```
  Scenario: Build and generation succeed
    Tool: Bash
    Steps: 1) Run `bun run build` 2) Check exit code 0 3) Verify all agents/*.md exist and are non-empty
    Expected: Build succeeds and 12 generated prompt files are present
    Evidence: .sisyphus/evidence/task-7-build.txt

  Scenario: Generated files carry approved terminology only
    Tool: Bash
    Steps: 1) Grep agents/*.md for `oh-my-opencode|oh-my-openagent` 2) Compare each remaining old-name occurrence against the preserve matrix
    Expected: Only allowlisted technical occurrences remain; repo URL/path branding updated
    Evidence: .sisyphus/evidence/task-7-generated-brand-audit.txt
  ```

  **Commit**: YES | Message: `refactor(config): inherit upstream categories and regenerate agent prompts` | Files: `oh-my-opencode.jsonc`, `tests/unit/*.ts`, `agents/*.md`, related source/test changes from Tasks 5-7`

- [x] 8. Inventory and classify every TODO in `.sisyphus/plans/docs-output-system.md` into smaller workstreams

  **What to do**: Read the existing mega-plan and map all 38 TODO items into exactly one of these buckets: `D1 config-path correction + shared reader`, `D2 docs config schema + CLI/TUI prompts`, `D3 runtime docs injection + helper/test work`, `D4 agent prompt docs-output sections + installer docs dir creation`, `DEFERRED`, or `CANCELLED`. Include section-level items from TL;DR/Context if they imply extra implementation not represented in a TODO. Produce a compact crosswalk table inside `docs-output-system.md` or an appended subsection within it.
  **Must NOT do**: Do not implement any docs-output feature tasks. Do not leave any TODO unmapped.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: plan analysis and structured decomposition
  - Skills: []
  - Omitted: [`git-master`] — not relevant

  **Parallelization**: Can Parallel: YES (with 2 and 5 after 1) | Wave 1 | Blocks: 9, 10 | Blocked By: 1

  **References**:
  - Plan: `.sisyphus/plans/docs-output-system.md:193-1675` — 38 TODO items to classify
  - Plan: `.sisyphus/plans/docs-output-system.md:23-107` — context and guardrails that may imply hidden workstream boundaries
  - Oracle review from planning — recommended split: config-path/shared reader, docs config/CLI/TUI, runtime docs injection/helpers/tests, agent prompt/docs dir creation; move doctor/configVersion/personality-gate/version housekeeping out of the core docs feature

  **Acceptance Criteria**:
  - [ ] Every existing TODO is mapped to one bucket exactly once
  - [ ] Non-core items are explicitly marked `DEFERRED` or `CANCELLED`
  - [ ] Crosswalk is concise enough to review quickly and does not restate full task bodies

  **QA Scenarios**:
  ```
  Scenario: All old-plan TODOs are accounted for
    Tool: Bash
    Steps: 1) Count original unchecked TODOs in docs-output-system.md 2) Count mapped rows in the crosswalk 3) Verify counts reconcile including deferred/cancelled items
    Expected: One-to-one mapping with no orphan TODOs
    Evidence: .sisyphus/evidence/task-8-crosswalk-count.txt

  Scenario: No feature implementation leaked into decomposition task
    Tool: Bash
    Steps: 1) Inspect changed files after this task 2) Confirm only docs-output-system.md changed
    Expected: No source or test files modified
    Evidence: .sisyphus/evidence/task-8-plan-only.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/plans/docs-output-system.md`

- [ ] 9. Rewrite `.sisyphus/plans/docs-output-system.md` as a superseded overview with explicit child workstreams

  **What to do**: Replace the giant execution body of `docs-output-system.md` with a short superseded plan overview that keeps only: original objective summary, why the plan was decomposed, the four child workstreams (`D1`-`D4`), deferred/cancelled items, and instructions that execution must happen from the new master plan rather than the old mega-plan. Preserve enough context that a reader understands what changed, but remove the 2,000+ line execution burden.
  **Must NOT do**: Do not delete the file entirely. Do not preserve the old 38-task execution checklist in full.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: plan rewrite and condensation
  - Skills: []
  - Omitted: [`frontend-ui-ux`] — not relevant

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 10 | Blocked By: 8

  **References**:
  - Plan: `.sisyphus/plans/docs-output-system.md` current sections at `1-2141`
  - Pattern: this master plan’s `Workstream Map` and Tasks 8-10 — canonical decomposition structure

  **Acceptance Criteria**:
  - [ ] `docs-output-system.md` no longer contains the full 38-task mega-plan body
  - [ ] File contains clear `Superseded` language and points execution to this master plan/workstreams
  - [ ] File still preserves enough context for historical traceability

  **QA Scenarios**:
  ```
  Scenario: Mega-plan is compacted successfully
    Tool: Bash
    Steps: 1) Count unchecked TODO lines in docs-output-system.md 2) Confirm count is under 15 3) Grep for `Superseded`
    Expected: Old mega-plan collapsed to a compact overview with clear superseded marker
    Evidence: .sisyphus/evidence/task-9-plan-compaction.txt

  Scenario: Historical context still exists
    Tool: Bash
    Steps: 1) Read top sections of docs-output-system.md 2) Confirm original objective, decomposition reason, and child workstream names are present
    Expected: Reader can still understand why the old plan existed and where work moved
    Evidence: .sisyphus/evidence/task-9-history-context.txt
  ```

  **Commit**: NO | Message: `Included in Task 10 grouped plan-decomposition commit` | Files: `.sisyphus/plans/docs-output-system.md`

- [x] 10. Add a TODO-to-workstream crosswalk and execution guardrails inside the superseded docs plan

  **What to do**: After compacting `docs-output-system.md`, append a concise crosswalk table mapping original task numbers to `D1`/`D2`/`D3`/`D4`/`DEFERRED`/`CANCELLED`, plus guardrails explaining that same-file edits must be serialized, generated files must come from source, and unrelated items (doctor command, configVersion, personality gate, version housekeeping) are not blockers for docs output. This turns the superseded plan into a safe handoff artifact instead of a trap.
  **Must NOT do**: Do not re-expand the file into a detailed execution plan. Do not omit deferred/cancelled rationale.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: structured summarization and guardrail capture
  - Skills: []
  - Omitted: [`git-master`] — not relevant

  **Parallelization**: Can Parallel: YES (with 7 after deps met) | Wave 3 | Blocks: 11 | Blocked By: 8, 9

  **References**:
  - Plan: `.sisyphus/plans/docs-output-system.md` after Task 9 rewrite
  - Metis findings in this planning session — explicit deferred/cancelled candidates and same-file serialization risks

  **Acceptance Criteria**:
  - [ ] Compact crosswalk table exists in `docs-output-system.md`
  - [ ] Deferred/cancelled items include rationale
  - [ ] Guardrails explicitly say docs-output implementation is no longer to be executed from the old mega-plan directly

  **QA Scenarios**:
  ```
  Scenario: Crosswalk is complete and reviewable
    Tool: Bash
    Steps: 1) Grep docs-output-system.md for child workstream labels and deferred/cancelled labels 2) Verify all labels appear
    Expected: D1, D2, D3, D4, DEFERRED, and CANCELLED are all represented where applicable
    Evidence: .sisyphus/evidence/task-10-crosswalk-labels.txt

  Scenario: Old plan cannot be misused as the execution source
    Tool: Bash
    Steps: 1) Read guardrail section in docs-output-system.md 2) Confirm it explicitly points execution to this master plan/workstreams
    Expected: Execution redirection is explicit and unambiguous
    Evidence: .sisyphus/evidence/task-10-execution-redirect.txt
  ```

  **Commit**: YES | Message: `docs(plans): decompose docs-output mega-plan into workstreams` | Files: `.sisyphus/plans/docs-output-system.md`

- [x] 11. Run the final repo-wide contract sweep for brand split, inheritance, and plan decomposition

  **What to do**: Perform the final verification wave for the rebrand/defaults/decomposition work before any release tagging. Run typecheck, unit tests, build, targeted grep audits, manifest/version checks, config-template parsing checks, and docs-plan compaction checks. If any forbidden old-brand repo URL, stale 8-agent wording, or per-agent `model` key remains, fix it before completion. Archive evidence files under `.sisyphus/evidence/` following the naming scheme in this plan.
  **Must NOT do**: Do not tag or publish. Do not ignore any grep failure as “expected” unless it is on the explicit preserve allowlist.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: deterministic verification and audit execution
  - Skills: []
  - Omitted: [`playwright`] — no UI/browser workflow involved

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: F1-F4 | Blocked By: 2, 3, 4, 5, 6, 7, 10

  **References**:
  - Definition of Done commands in this master plan
  - Pattern: `README.md`, `AGENTS.md`, `package.json`, `.claude-plugin/plugin.json`, `oh-my-opencode.jsonc`, `src/`, `agents/`, `.sisyphus/plans/docs-output-system.md`
  - Test/build commands from `package.json:26-31`

  **Acceptance Criteria**:
  - [ ] All Definition of Done commands in this plan pass
  - [ ] No forbidden old upstream repo URLs remain
  - [ ] No stale 8-agent wording remains in maintained surfaces
  - [ ] `docs-output-system.md` is compact and crosswalked

  **QA Scenarios**:
  ```
  Scenario: Full verification command wave passes
    Tool: Bash
    Steps: 1) Run `tsc --noEmit` 2) Run `bun test tests/unit/` 3) Run `bun run build` 4) Run manifest/config grep and parse checks from Definition of Done
    Expected: Every command exits 0
    Evidence: .sisyphus/evidence/task-11-full-verification.txt

  Scenario: Forbidden leftovers are absent
    Tool: Bash
    Steps: 1) Grep repo for old repo URL and stale `8 agents` copy 2) Parse oh-my-opencode.jsonc for stray per-agent model keys
    Expected: No forbidden leftovers remain
    Evidence: .sisyphus/evidence/task-11-leftover-audit.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: evidence only

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [ ] F1. Plan Compliance Audit — oracle

  **What to do**: Review the completed branch against this plan only. Confirm every Task 1-11 acceptance criterion and every Definition of Done command has corresponding evidence or passing output. Verify the preserve-vs-rename matrix was followed, grouped commit boundaries were respected, and no forbidden scope expansion occurred.
  **Approval Standard**: APPROVE only if every task in this plan is either demonstrably completed or explicitly marked not applicable with evidence.

  **QA Scenarios**:
  ```
  Scenario: Acceptance-criteria coverage audit
    Tool: Bash + Read
    Steps: 1) Read this plan file 2) Read evidence files under .sisyphus/evidence/ for tasks 1-11 3) Cross-check each task acceptance criterion and each Definition of Done item against available evidence
    Expected: No acceptance criterion or DoD item lacks evidence or a directly reproducible passing command
    Evidence: .sisyphus/evidence/f1-plan-compliance-audit.md

  Scenario: Guardrail compliance audit
    Tool: Bash
    Steps: 1) Grep changed files for forbidden patterns: blind oh-my-opencode removal, old repo URL leftovers, direct generated-file edits before build, extra docs-output implementation files 2) Compare changed paths against allowed scope in this plan
    Expected: No guardrail violations found
    Evidence: .sisyphus/evidence/f1-guardrail-audit.txt
  ```

- [ ] F2. Code Quality Review — unspecified-high

  **What to do**: Run a clean quality sweep on the completed changeset. Focus on manifest consistency, type/test/build health, test quality, prompt/source consistency, and plan-instructed code hygiene. Flag any brittle assertions, stale wording, or generated/source mismatch.
  **Approval Standard**: APPROVE only if there are no failing commands, no obvious contract-test gaps, and no mismatch between source prompts and regenerated `agents/*.md`.

  **QA Scenarios**:
  ```
  Scenario: Static quality sweep
    Tool: Bash
    Steps: 1) Run `tsc --noEmit` 2) Run `bun test tests/unit/` 3) Run `bun run build` 4) Review output for failures or warnings that indicate incomplete migration work
    Expected: All commands exit 0 with no unresolved failures
    Evidence: .sisyphus/evidence/f2-quality-sweep.txt

  Scenario: Source/generated consistency check
    Tool: Bash + Read
    Steps: 1) Read src/cli/index.ts, src/index.ts, src/agents/*.ts, and agents/*.md 2) Verify generated prompts reflect updated source wording and preserved technical identifiers exactly where intended
    Expected: No source/generated drift and no stale descriptive old-brand wording
    Evidence: .sisyphus/evidence/f2-source-generated-consistency.md
  ```

- [ ] F3. Real Manual QA — unspecified-high

  **What to do**: Perform agent-executed end-to-end verification of the repo artifacts exactly as a maintainer would inspect them: manifests, README install guidance, AGENTS knowledge base, sample config, generated prompts, and superseded docs plan. This is “manual QA” by the reviewing agent, not by a human user.
  **Approval Standard**: APPROVE only if the repo reads coherently end-to-end: branding is consistent, technical identifiers are explained, and a maintainer could follow the migration story without guessing.

  **QA Scenarios**:
  ```
  Scenario: Maintainer walkthrough
    Tool: Read
    Steps: 1) Read package.json, .claude-plugin/plugin.json, README.md, AGENTS.md, oh-my-opencode.jsonc, and .sisyphus/plans/docs-output-system.md 2) Evaluate whether the migration story is consistent from manifests through docs through sample config
    Expected: A maintainer can understand what changed, what stayed literal, and why
    Evidence: .sisyphus/evidence/f3-maintainer-walkthrough.md

  Scenario: Breaking-release messaging check
    Tool: Bash + Read
    Steps: 1) Grep README.md and AGENTS.md for version, breaking-change wording, agent count, and preserved technical command examples 2) Confirm there is no contradictory messaging
    Expected: Breaking pre-1.0 message is explicit and internally consistent
    Evidence: .sisyphus/evidence/f3-breaking-release-messaging.txt
  ```

- [ ] F4. Scope Fidelity Check — deep

  **What to do**: Verify that the completed work stayed inside the exact scope of this plan: rebrand/defaults/decomposition only. Confirm no unrelated fixes from the old docs-output mega-plan or opportunistic refactors were included unless explicitly called for here.
  **Approval Standard**: APPROVE only if all changed files and commits map back to Tasks 1-11 and no hidden feature work or speculative upstream rename was introduced.

  **QA Scenarios**:
  ```
  Scenario: Changed-path scope audit
    Tool: Bash
    Steps: 1) Review git diff --name-only for the completed branch 2) Map each changed path to a task number in this plan 3) Flag anything with no matching task
    Expected: Every changed path maps cleanly to a planned task
    Evidence: .sisyphus/evidence/f4-changed-path-scope.txt

  Scenario: No scope creep from superseded docs plan
    Tool: Bash + Read
    Steps: 1) Compare completed source/test changes against deferred/cancelled items from docs-output-system.md crosswalk 2) Confirm no deferred/cancelled item was implemented accidentally
    Expected: No deferred/cancelled docs-output work leaked into execution
    Evidence: .sisyphus/evidence/f4-docs-plan-scope.md
  ```

## Commit Strategy
- Commit A (after Tasks 2-4): `feat(branding): adopt openagent brand-first wording for pre-1.0 release`
- Commit B (after Tasks 5-7): `refactor(config): inherit upstream categories and regenerate agent prompts`
- Commit C (after Tasks 8-10): `docs(plans): decompose docs-output mega-plan into workstreams`
- Final verification only after all three commits are clean locally; no push in this plan

## Success Criteria
- Repo presents Wunderkind as an `oh-my-openagent` addon in all user-facing surfaces while retaining literal upstream technical identifiers where required
- Sample config no longer hard-codes per-agent `model` values and instead inherits upstream category defaults
- Generated agent markdown matches updated source prompts after rebuild
- The old docs-output plan is no longer an execution trap; it becomes a short superseded overview with a complete crosswalk
- No stale `8 agents` claims or old upstream repo URLs remain in maintained surfaces
