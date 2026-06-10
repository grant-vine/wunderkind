# Wunderkind OMO Task Contract Compliance

## TL;DR
> **Summary**: Align Wunderkind’s retained-agent guidance with the current oh-my-openagent task contract so agents stop emitting invalid delegation calls. The fix is prompt-contract work: add one canonical delegation section, tighten task-vs-skill wording, update runtime routing guidance, regenerate native agents, and pin the behavior with TDD-first regression tests.
> **Deliverables**:
> - shared delegation contract section for task-capable retained agents
> - updated retained prompt sources and slash-command delegation wording
> - updated runtime native-agent routing text in the plugin transform
> - maintainer-doc updates for internal guidance
> - regenerated `agents/*.md`
> - regression tests covering prompt, generated markdown, plugin transform, and markdown example compliance
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 4 → 5 → 6 → 8

## Context
### Original Request
Review the latest changes to OpenCode and oh-my-openagent, identify the Wunderkind changes required to comply, and address errors like: `Invalid arguments: 'run_in_background' parameter is REQUIRED.`

### Interview Summary
- User scope decision: **Runtime + internal docs**.
- User test decision: **TDD**.
- Repo findings: skill markdown examples are already mostly compliant, but retained-agent prompt templates and slash-command guidance still describe delegation abstractly.
- Upstream findings: OpenCode appears effectively frozen; the compatibility churn is in **oh-my-openagent**, where `run_in_background` is explicitly required again and `load_skills` should be treated as required in task examples.

### Metis Review (gaps addressed)
- Do **not** change working skill examples just for churn; use them as canonical references.
- Do **not** inject full task-delegation guidance into agents that deny the `task` tool.
- Treat `src/build-agents.ts` / `src/agents/render-markdown.ts` as republishers, not root-cause logic.
- Add regression coverage for markdown examples; current tests do not validate task-contract compliance.
- Keep historical `.sisyphus/` archives out of mutation scope; update maintainer-facing docs only.

## Work Objectives
### Core Objective
Ensure every Wunderkind surface that teaches or implies delegation uses the current oh-my-openagent contract: explicit `run_in_background`, explicit `load_skills`, and a clear distinction between `skill(...)` usage and `task(...)` delegation.

### Deliverables
- `src/agents/shared-prompt-sections.ts` exports a canonical delegation contract section.
- `src/agents/product-wunderkind.ts`, `src/agents/fullstack-wunderkind.ts`, and `src/agents/ciso.ts` include that section.
- `src/agents/slash-commands.ts` uses explicit wording that distinguishes skill invocation from task delegation.
- `src/index.ts` runtime native-agent routing text includes explicit task-vs-skill guidance.
- Maintainer-facing docs are updated in `AGENTS.md` and `skills/SKILL-STANDARD.md` if they contain delegation guidance.
- `agents/*.md` are regenerated from source.
- New/updated tests cover prompt contract presence, plugin-transform text, generated markdown, and markdown example compliance.

### Definition of Done (verifiable conditions with commands)
- `tsc --noEmit` passes.
- `bun test tests/unit/agent-factories.test.ts` passes with delegation-contract assertions.
- `bun test tests/unit/plugin-transform.test.ts` passes with runtime routing assertions.
- `bun test tests/unit/build-agents.test.ts` passes with generated-markdown assertions.
- `bun test tests/unit/skill-task-contract.test.ts` passes and scans markdown examples for required task fields.
- `bun test tests/unit/` passes with 0 failures.
- `bun run build` regenerates `agents/*.md` without errors.

### Must Have
- TDD order: write failing/guard tests before prompt-source implementation.
- Canonical task guidance includes both required fields: `load_skills` and `run_in_background`.
- Canonical guidance states: use **either** `category` **or** `subagent_type`, never both.
- Canonical guidance states: use `skill(name="...")` for shipped skills/sub-skills; use `task(...)` for retained-agent / category / subagent delegation.
- Before finalizing shared contract wording, perform a **read-only upstream pattern check** against current oh-my-openagent prompt/agent-generation examples so Wunderkind mirrors upstream canonical style rather than inventing a local variant.
- Task-contract section appears only in task-capable retained prompts.
- Runtime routing text in the plugin transform reflects the same contract.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Do **not** change `src/build-agents.ts` or `src/agents/render-markdown.ts` unless a build bug is proven.
- Do **not** change task permissions for any retained agent.
- Do **not** rewrite already-compliant `skills/*/SKILL.md` examples unless a scanner test finds an actual missing field.
- Do **not** mutate historical `.sisyphus/plans/**`, `.sisyphus/notepads/**`, or evidence archives.
- Do **not** add ambiguous “use X” phrasing for skills when `skill(name="...")` is the correct tool.
- Do **not** add full `task(...)` delegation instructions to `marketing-wunderkind`, `creative-director`, or `legal-counsel`, which deny the `task` tool.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **TDD** with Bun unit tests.
- QA policy: Every task includes command-based verification and a negative/edge check.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt`
- Evidence directory rule: this repo already contains `.sisyphus/evidence/`; if missing in another checkout, prefix the first evidence-producing command with `mkdir -p .sisyphus/evidence &&`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

**Wave 1A (parallel): contract-first test scaffolding + shared helper**
- Task 1 — red/green prompt-contract tests for retained agents
- Task 2 — red/green plugin-transform routing contract tests
- Task 3 — markdown compliance scanner for skills and maintainer docs
- Task 4 — shared delegation contract section helper

**Wave 1B (sequential after Tasks 1 + 4): prompt wiring + slash-command disambiguation**
- Task 5 — inject contract into task-capable prompts and tighten slash-command wording

**Wave 2: runtime text, internal docs, generated assets, full verification prep**
- Task 6 — update runtime native-agent routing text in `src/index.ts`
- Task 7 — update maintainer-facing docs (`AGENTS.md`, `skills/SKILL-STANDARD.md`) to match the new contract
- Task 8 — regenerate `agents/*.md`, add generated-markdown assertions, and run full verification commands

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 5, 8 |
| 2 | none | 6, 8 |
| 3 | none | 7, 8 |
| 4 | none | 5 |
| 5 | 1, 4 | 8 |
| 6 | 2 | 8 |
| 7 | 3 | 8 |
| 8 | 1, 2, 3, 5, 6, 7 | F1-F4 |
| F1 | 8 | completion |
| F2 | 8 | completion |
| F3 | 8 | completion |
| F4 | 8 | completion |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Categories |
|---|---:|---|
| Wave 1 | 5 | quick, unspecified-low |
| Wave 2 | 3 | quick, writing, unspecified-low |
| Final Verification | 4 | oracle, unspecified-high, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add retained-agent prompt contract tests

  **What to do**: Update `tests/unit/agent-factories.test.ts` to codify the new delegation contract. Add assertions that `product-wunderkind`, `fullstack-wunderkind`, and `ciso` prompts contain a `## Delegation Contract` section plus explicit `load_skills` and `run_in_background` guidance. Add negative assertions that `marketing-wunderkind`, `creative-director`, and `legal-counsel` do **not** contain that section because they deny `task`. Also add string assertions for the exact disambiguation prefixes introduced by Task 5: skill-owned references must use `Invoke via \`skill(name="<skill>")\`` and retained-agent/subagent references in task-capable prompts must use `Delegate via \`task(...)\``.
  **Must NOT do**: Do not relax existing task-permission assertions. Do not add snapshot-style brittle whole-file assertions.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: single test file, precise assertions, low ambiguity
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5, 8] | Blocked By: []

  **References**:
  - Pattern: `tests/unit/agent-factories.test.ts:59-145` — existing prompt-content and permission assertions to extend
  - Pattern: `src/agents/types.ts:29-38` — permission model for tool deny-lists
  - Pattern: `src/agents/product-wunderkind.ts:44-63,165-209` — prompt composition and insertion point
  - Pattern: `src/agents/fullstack-wunderkind.ts:38-45,152-208` — prompt composition and insertion point
  - Pattern: `src/agents/ciso.ts:44-50,145-170` — prompt composition and insertion point

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test tests/unit/agent-factories.test.ts` initially fails on the new delegation-contract assertions before implementation, then passes after Tasks 4-5.
  - [ ] Positive assertions exist only for `product-wunderkind`, `fullstack-wunderkind`, and `ciso`.
  - [ ] Negative assertions exist for `marketing-wunderkind`, `creative-director`, and `legal-counsel`.
  - [ ] The test asserts the exact wording prefixes `Invoke via \`skill(name=` and `Delegate via \`task(... )\`` (without allowing bare “use X” phrasing for the updated references).

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Red/green retained-agent contract test
    Tool: Bash
    Steps: Run `bun test tests/unit/agent-factories.test.ts | tee .sisyphus/evidence/task-1-agent-contract.txt` before Tasks 4-5 and again after Tasks 4-5.
    Expected: First run fails on missing contract assertions; second run passes with 0 failures.
    Evidence: .sisyphus/evidence/task-1-agent-contract.txt

  Scenario: Task-denied agents remain excluded
    Tool: Bash
    Steps: Run `bun test tests/unit/agent-factories.test.ts | tee .sisyphus/evidence/task-1-agent-contract-negative.txt` after Tasks 4-5.
    Expected: Assertions confirm no `## Delegation Contract` section for marketing, creative, or legal prompts.
    Evidence: .sisyphus/evidence/task-1-agent-contract-negative.txt
  ```

  **Commit**: NO | Message: `test(prompts): pin retained delegation contract` | Files: [`tests/unit/agent-factories.test.ts`]

- [x] 2. Add plugin-transform routing contract tests

  **What to do**: Update `tests/unit/plugin-transform.test.ts` so the injected `## Wunderkind Native Agents` system section must mention the explicit task-vs-skill contract. Require the exact stable wording prefixes: `Use \`task(...)\` for retained-agent or subagent delegation; always include explicit \`load_skills\` and \`run_in_background\`.` and `Use \`skill(name="...")\` for shipped skills and sub-skills.`
  **Must NOT do**: Do not weaken current routing coverage. Do not assert on unrelated wording that is likely to churn.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: one focused test file, deterministic strings
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [6, 8] | Blocked By: []

  **References**:
  - Pattern: `tests/unit/plugin-transform.test.ts:74-103` — existing native-agent routing assertions to extend
  - Pattern: `src/index.ts:114-146` — current injected native-agent section to update

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun test tests/unit/plugin-transform.test.ts` initially fails on the new contract wording before Task 6, then passes after Task 6.
  - [ ] The test only checks stable routing-contract language, not broad prose snapshots.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Red/green runtime routing contract test
    Tool: Bash
    Steps: Before adding assertions, run `bun test tests/unit/plugin-transform.test.ts | tee .sisyphus/evidence/task-2-baseline.txt` to capture the pre-change baseline. Then run `bun test tests/unit/plugin-transform.test.ts | tee .sisyphus/evidence/task-2-plugin-transform.txt` before and after Task 6.
    Expected: Pre-change run fails on missing contract wording; post-change run passes with 0 failures.
    Evidence: .sisyphus/evidence/task-2-plugin-transform.txt

  Scenario: Skill-vs-task wording remains explicit
    Tool: Bash
    Steps: Re-run `bun test tests/unit/plugin-transform.test.ts | tee .sisyphus/evidence/task-2-plugin-transform-negative.txt` after Task 6.
    Expected: Assertions verify both `task(...)` and `skill(name="...")` guidance are present together.
    Evidence: .sisyphus/evidence/task-2-plugin-transform-negative.txt
  ```

  **Commit**: NO | Message: `test(plugin): pin runtime delegation contract` | Files: [`tests/unit/plugin-transform.test.ts`]

- [x] 3. Add markdown contract scanner tests for skills and maintainer docs

  **What to do**: Create `tests/unit/skill-task-contract.test.ts` as a **regression guard**, not a TDD-red test. Scan `skills/**/*.md`, `AGENTS.md`, and `skills/SKILL-STANDARD.md` for any literal `task(` examples. Do **not** include `README.md`. For every detected task block, assert explicit `run_in_background` and `load_skills` are present. The scanner must allow files with no `task(` examples and is expected to pass immediately on first run because the currently scanned markdown is already compliant.
  **Must NOT do**: Do not mutate any markdown file in this task. Do not require `task(` to exist everywhere.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: small new test file with deterministic file IO
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 8] | Blocked By: []

  **References**:
  - Pattern: `package.json:27-34` — Bun test scripts and unit-test entrypoints
  - Pattern: `tests/unit/plugin-transform.test.ts:7-9` — portable project-root pattern using `new URL(..., import.meta.url).pathname`
  - Pattern: `tests/unit/build-agents.test.ts:9-10` — file-path derivation pattern for repo content

  **Acceptance Criteria** (agent-executable only):
  - [ ] `tests/unit/skill-task-contract.test.ts` exists and scans the specified markdown surfaces.
  - [ ] `bun test tests/unit/skill-task-contract.test.ts` passes and fails only when a markdown task example omits `run_in_background` or `load_skills`.
  - [ ] Files without `task(` examples are treated as pass/no-op.
  - [ ] The task explicitly records that this scanner is a regression guard and is not expected to fail red on day one.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Markdown scanner passes on current compliant examples
    Tool: Bash
    Steps: Run `bun test tests/unit/skill-task-contract.test.ts | tee .sisyphus/evidence/task-3-markdown-scan.txt`.
    Expected: Test passes and reports no missing required fields in scanned markdown task blocks.
    Evidence: .sisyphus/evidence/task-3-markdown-scan.txt

  Scenario: Scanner protects against missing required fields
    Tool: Bash
    Steps: Re-run `bun test tests/unit/skill-task-contract.test.ts | tee .sisyphus/evidence/task-3-markdown-scan-negative.txt` after all markdown edits.
    Expected: Test remains green, proving no new stale task examples were introduced in maintainer docs.
    Evidence: .sisyphus/evidence/task-3-markdown-scan-negative.txt
  ```

  **Commit**: NO | Message: `test(markdown): guard task contract examples` | Files: [`tests/unit/skill-task-contract.test.ts`]

- [x] 4. Add shared delegation contract helper

  **What to do**: First do a read-only upstream pattern check against current oh-my-openagent examples using authoritative upstream sources in this priority order: (1) the GitHub repo at `https://github.com/code-yeongyu/oh-my-openagent`, searching current prompt/example files for task-call teaching patterns, then (2) upstream PRs/issues already identified in research (`PR #2634`, `PR #1663`) if no current example file is discoverable. Capture the exact task-example style taught upstream to `.sisyphus/evidence/task-4-upstream-pattern.txt`. If no canonical example is locatable, record the search attempt and proceed using Wunderkind’s already-compliant skill-example style as the fallback canonical style. Then extend `src/agents/shared-prompt-sections.ts` with `buildDelegationContractSection()`. The section must state: use `skill(name="...")` for shipped skills/sub-skills; use `task(...)` for retained-agent/category/subagent delegation; `load_skills` is required and must be `[]` when unused; `run_in_background` is required and must be explicitly `true` or `false`; provide exactly one canonical `category=` example and one canonical `subagent_type=` example; state that `category` and `subagent_type` are mutually exclusive.
  **Must NOT do**: Do not add agent-specific language here. Do not mention deprecated/defaulted task behavior. Do not use both `category` and `subagent_type` in the same example.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: shared prompt-contract logic with multiple downstream consumers
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5] | Blocked By: []

  **References**:
  - Pattern: `src/agents/shared-prompt-sections.ts:24-42` — shared reusable prompt-section helpers
  - Pattern: `src/agents/shared-prompt-sections.ts:45-61` — existing rendered-section composition style
  - Pattern: `src/agents/slash-commands.ts:145-163` — product delegation-pattern prose currently lacking canonical syntax
  - Pattern: `src/agents/slash-commands.ts:197-215` — fullstack delegation-pattern prose currently lacking canonical syntax
  - Pattern: `src/agents/slash-commands.ts:244-257` — ciso delegation-pattern prose currently lacking canonical syntax

  **Acceptance Criteria** (agent-executable only):
  - [ ] `buildDelegationContractSection()` is exported from `src/agents/shared-prompt-sections.ts`.
  - [ ] Upstream oh-my-openagent task-example wording/style is checked and captured to `.sisyphus/evidence/task-4-upstream-pattern.txt`, with any intentional deviation noted in the implementation summary.
  - [ ] The helper contains both required-field rules and both canonical example shapes.
  - [ ] `tsc --noEmit` passes after the helper is added.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Upstream pattern is captured before helper drafting
    Tool: WebFetch
    Steps: Inspect `https://github.com/code-yeongyu/oh-my-openagent` for current task-example teaching patterns; if none are discoverable, inspect the already-researched upstream PRs/issues and record the fallback decision. Save the findings summary to `.sisyphus/evidence/task-4-upstream-pattern.txt` before editing the helper.
    Expected: Evidence file exists and contains either at least one canonical upstream example/style note or an explicit “not found; used Wunderkind skill-example fallback” note.
    Evidence: .sisyphus/evidence/task-4-upstream-pattern.txt

  Scenario: Shared helper compiles cleanly
    Tool: Bash
    Steps: Run `tsc --noEmit | tee .sisyphus/evidence/task-4-shared-helper.txt` after editing `src/agents/shared-prompt-sections.ts`.
    Expected: TypeScript exits 0 with no errors.
    Evidence: .sisyphus/evidence/task-4-shared-helper.txt

  Scenario: Helper text includes both canonical shapes
    Tool: Bash
    Steps: Run `bun test tests/unit/agent-factories.test.ts | tee .sisyphus/evidence/task-4-shared-helper-negative.txt` after Task 5 wires the helper in.
    Expected: Prompt assertions pass because the shared section exposes both required fields and the heading.
    Evidence: .sisyphus/evidence/task-4-shared-helper-negative.txt
  ```

  **Commit**: NO | Message: `feat(prompts): add shared delegation contract` | Files: [`src/agents/shared-prompt-sections.ts`]

- [x] 5. Inject contract into task-capable prompts and disambiguate slash-command wording

  **What to do**: Update `src/agents/product-wunderkind.ts`, `src/agents/fullstack-wunderkind.ts`, and `src/agents/ciso.ts` to render `buildDelegationContractSection()` before their slash-command sections. Update `src/agents/slash-commands.ts` so skill-owned references use the exact prefix `Invoke via \`skill(name="<skill>")\`` and retained-agent/subagent handoffs in task-capable prompts use the exact prefix `Delegate via \`task(...)\``. Preserve each agent’s existing routing authority and domain boundaries.
  **Must NOT do**: Do not inject the contract section into `marketing-wunderkind`, `creative-director`, or `legal-counsel`. Do not change which slash commands exist. Do not rewrite unrelated prompt philosophy text.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: coordinated multi-file prompt update with routing nuance
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [8] | Blocked By: [1, 4]

  **References**:
  - Pattern: `src/agents/product-wunderkind.ts:49-50,165-205` — prompt insertion point before slash-command section
  - Pattern: `src/agents/fullstack-wunderkind.ts:43-44,170-205` — prompt insertion point before slash-command section
  - Pattern: `src/agents/ciso.ts:49-50,145-160` — prompt insertion point before slash-command section
  - Pattern: `src/agents/slash-commands.ts:37-52,65-72` — marketing skill references that should use explicit `skill(...)` wording
  - Pattern: `src/agents/slash-commands.ts:80-91,103-113` — creative skill/tool references that should be disambiguated
  - Pattern: `src/agents/slash-commands.ts:120-160` — product task/skill routing language to tighten
  - Pattern: `src/agents/slash-commands.ts:168-213` — fullstack task/skill routing language to tighten
  - Pattern: `src/agents/slash-commands.ts:220-255` — ciso task/skill routing language to tighten

  **Acceptance Criteria** (agent-executable only):
  - [ ] `product-wunderkind`, `fullstack-wunderkind`, and `ciso` prompts contain the shared delegation contract section.
  - [ ] `marketing-wunderkind`, `creative-director`, and `legal-counsel` still omit that section.
  - [ ] Updated slash-command wording explicitly distinguishes `skill(...)` usage from `task(...)` delegation using the exact prefixes above.
  - [ ] `bun test tests/unit/agent-factories.test.ts` passes after the implementation.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Task-capable prompts expose the new contract
    Tool: Bash
    Steps: Run `bun test tests/unit/agent-factories.test.ts | tee .sisyphus/evidence/task-5-prompt-injection.txt` after editing the prompt sources.
    Expected: The test passes and confirms contract presence only in the three task-capable retained prompts.
    Evidence: .sisyphus/evidence/task-5-prompt-injection.txt

  Scenario: Skill references stop using ambiguous prose
    Tool: Bash
    Steps: Run `bun test tests/unit/agent-factories.test.ts | tee .sisyphus/evidence/task-5-prompt-injection-negative.txt` to confirm the new exact-prefix assertions pass. Then run `tsc --noEmit | tee .sisyphus/evidence/task-5-tsc.txt` as a separate compile-only check.
    Expected: The test confirms the touched strings use explicit `skill(name="...")` / `task(...)` wording rather than bare “use X” phrasing, and TypeScript exits 0.
    Evidence: .sisyphus/evidence/task-5-prompt-injection-negative.txt
  ```

  **Commit**: NO | Message: `feat(prompts): wire delegation contract into retained agents` | Files: [`src/agents/product-wunderkind.ts`, `src/agents/fullstack-wunderkind.ts`, `src/agents/ciso.ts`, `src/agents/slash-commands.ts`]

- [x] 6. Update plugin-transform native-agent routing guidance

  **What to do**: Update the `## Wunderkind Native Agents` block in `src/index.ts` so runtime-injected routing guidance mirrors the new contract. Add a concise paragraph or bullets stating that retained-agent/subagent delegation uses `task(...)` with explicit `load_skills` and `run_in_background`, while shipped skills use `skill(name="...")`. Keep the current routing table intact.
  **Must NOT do**: Do not rewrite unrelated runtime-context or docs-output behavior. Do not turn the section into a long tutorial.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: one file, string-content update, test-backed
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [8] | Blocked By: [2]

  **References**:
  - Pattern: `src/index.ts:114-146` — injected native-agent routing section
  - Test: `tests/unit/plugin-transform.test.ts:74-103` — runtime assertions to keep in sync

  **Acceptance Criteria** (agent-executable only):
  - [ ] `src/index.ts` includes concise runtime guidance for `task(...)` vs `skill(...)`.
  - [ ] `bun test tests/unit/plugin-transform.test.ts` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Runtime routing guidance is updated
    Tool: Bash
    Steps: Run `bun test tests/unit/plugin-transform.test.ts | tee .sisyphus/evidence/task-6-plugin-guidance.txt`.
    Expected: Test passes and asserts the injected system section includes both explicit task and skill guidance.
    Evidence: .sisyphus/evidence/task-6-plugin-guidance.txt

  Scenario: Existing routing inventory remains intact
    Tool: Bash
    Steps: Re-run `bun test tests/unit/plugin-transform.test.ts | tee .sisyphus/evidence/task-6-plugin-guidance-negative.txt`.
    Expected: Assertions for the retained-agent names and routing bullets still pass alongside the new contract wording.
    Evidence: .sisyphus/evidence/task-6-plugin-guidance-negative.txt
  ```

  **Commit**: NO | Message: `feat(plugin): clarify task and skill delegation at runtime` | Files: [`src/index.ts`]

- [x] 7. Update maintainer-facing delegation docs

  **What to do**: Audit and update `AGENTS.md` and `skills/SKILL-STANDARD.md` so internal maintainer guidance reflects the same contract. Document that `run_in_background` and `load_skills` are explicit requirements in task examples, that `skill(name="...")` is the correct tool for shipped skills, and that historical `.sisyphus/` archives are intentionally excluded from cleanup. If either file has no delegation guidance section, add only a short maintainers-only note in the most relevant conventions area.
  **Must NOT do**: Do not mass-edit historical `.sisyphus/**` markdown. Do not add end-user install/tutorial content here.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: maintainer documentation with precision requirements
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [8] | Blocked By: [3]

  **References**:
  - Pattern: `src/agents/shared-prompt-sections.ts:24-61` — canonical reusable prompt language to mirror
  - Note: Re-read `src/agents/shared-prompt-sections.ts` fresh here; line numbers will shift after Task 4 adds `buildDelegationContractSection()`
  - Test: `tests/unit/skill-task-contract.test.ts` — markdown scanner that must stay green after doc edits
  - External: `oh-my-openagent` upstream contract summary from research — `run_in_background` explicitly required again; `load_skills` treated as required in examples

  **Acceptance Criteria** (agent-executable only):
  - [ ] `AGENTS.md` and `skills/SKILL-STANDARD.md` contain current maintainer guidance if they discuss delegation/examples.
  - [ ] The markdown scanner test remains green after doc edits.
  - [ ] The docs explicitly exclude historical `.sisyphus/**` cleanup from this compliance change.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Maintainer docs comply with scanner rules
    Tool: Bash
    Steps: Run `bun test tests/unit/skill-task-contract.test.ts | tee .sisyphus/evidence/task-7-maintainer-docs.txt` after editing maintainer docs.
    Expected: Test passes and no markdown task example omits `load_skills` or `run_in_background`.
    Evidence: .sisyphus/evidence/task-7-maintainer-docs.txt

  Scenario: Historical archives remain untouched by plan scope
    Tool: Bash
    Steps: Re-run `bun test tests/unit/skill-task-contract.test.ts | tee .sisyphus/evidence/task-7-maintainer-docs-negative.txt`.
    Expected: The scanner remains green, and the updated maintainer docs explicitly state that historical `.sisyphus/**` archives are out of scope for this compliance change.
    Evidence: .sisyphus/evidence/task-7-maintainer-docs-negative.txt
  ```

  **Commit**: NO | Message: `docs(maintainers): document current delegation contract` | Files: [`AGENTS.md`, `skills/SKILL-STANDARD.md`]

- [ ] 8. Regenerate native agents and finalize regression coverage

  **What to do**: Run `bun run build` to regenerate `agents/*.md`. Extend `tests/unit/build-agents.test.ts` with focused assertions that generated markdown contains `## Delegation Contract` for `fullstack-wunderkind`, `product-wunderkind`, and `ciso`, and omits it for `marketing-wunderkind`, `creative-director`, and `legal-counsel`. Then run the full required verification commands.
  **Must NOT do**: Do not hand-edit anything under `agents/`. Do not skip full-suite verification after regeneration.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: build output + test hardening across generated assets
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [F1, F2, F3, F4] | Blocked By: [1, 2, 3, 5, 6, 7]

  **References**:
  - Pattern: `src/build-agents.ts:13-21` — generator entrypoint writing `agents/*.md`
  - Pattern: `src/agents/render-markdown.ts:26-39` — generated markdown comes directly from prompt sources
  - Test: `tests/unit/build-agents.test.ts:48-75` — current generated-markdown assertions to extend
  - Test: `tests/unit/agent-factories.test.ts:148-168` — generated-markdown mode checks already in place

  **Acceptance Criteria** (agent-executable only):
  - [ ] `bun run build` succeeds.
  - [ ] `bun run build` is run before `tests/unit/build-agents.test.ts`; generated-markdown assertions are not considered meaningful against stale files.
  - [ ] `tests/unit/build-agents.test.ts` asserts presence for task-capable generated prompts and absence for task-denied prompts.
  - [ ] `tsc --noEmit`, targeted tests, and `bun test tests/unit/` all pass.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Generated agents are rebuilt from updated sources
    Tool: Bash
    Steps: Run `bun run build | tee .sisyphus/evidence/task-8-build.txt` and then `bun test tests/unit/build-agents.test.ts | tee .sisyphus/evidence/task-8-build-tests.txt`.
    Expected: Build succeeds, generated markdown matches source render output, and contract-presence assertions pass.
    Evidence: .sisyphus/evidence/task-8-build.txt

  Scenario: Full regression suite stays green
    Tool: Bash
    Steps: Run `tsc --noEmit | tee .sisyphus/evidence/task-8-tsc.txt`, `bun test tests/unit/agent-factories.test.ts | tee .sisyphus/evidence/task-8-agent-tests.txt`, `bun test tests/unit/plugin-transform.test.ts | tee .sisyphus/evidence/task-8-plugin-tests.txt`, `bun test tests/unit/skill-task-contract.test.ts | tee .sisyphus/evidence/task-8-markdown-tests.txt`, and `bun test tests/unit/ | tee .sisyphus/evidence/task-8-full-suite.txt`.
    Expected: All commands exit 0 with no failing tests.
    Evidence: .sisyphus/evidence/task-8-full-suite.txt
  ```

  **Commit**: NO | Message: `build(prompts): regenerate agents and lock contract coverage` | Files: [`agents/*.md`, `tests/unit/build-agents.test.ts`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle

  **What to do**: Run a fresh `oracle` review against the completed implementation and verification evidence. The oracle prompt must include the plan path, the list of touched files, and the evidence files from Tasks 1-8. Ask the reviewer to check whether the implementation matches the plan exactly: task-capable prompts only, explicit `load_skills` and `run_in_background`, exact wording prefixes, regenerated `agents/*.md`, and no forbidden file drift.
  **Must NOT do**: Do not ask oracle to redesign the solution. Do not omit the evidence paths.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: review orchestration wrapper around a direct specialist audit
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [completion] | Blocked By: [8]

  **References**:
  - Plan: `.sisyphus/plans/wunderkind-omo-task-contract-compliance.md`
  - Evidence: `.sisyphus/evidence/task-1-agent-contract.txt`, `.sisyphus/evidence/task-2-plugin-transform.txt`, `.sisyphus/evidence/task-3-markdown-scan.txt`, `.sisyphus/evidence/task-4-upstream-pattern.txt`, `.sisyphus/evidence/task-5-prompt-injection.txt`, `.sisyphus/evidence/task-6-plugin-guidance.txt`, `.sisyphus/evidence/task-7-maintainer-docs.txt`, `.sisyphus/evidence/task-8-full-suite.txt`

  **Acceptance Criteria** (agent-executable only):
  - [ ] A fresh `task(subagent_type="oracle", load_skills=[], run_in_background=false, ...)` review is executed.
  - [ ] Oracle returns an explicit approval or a concrete defect list.
  - [ ] Oracle output is saved to `.sisyphus/evidence/f1-plan-compliance.txt`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Oracle verifies implementation matches plan
    Tool: task
    Steps: Invoke `task(subagent_type="oracle", load_skills=[], run_in_background=false, prompt="Audit completed work against .sisyphus/plans/wunderkind-omo-task-contract-compliance.md using evidence files .sisyphus/evidence/task-1-agent-contract.txt, .sisyphus/evidence/task-2-plugin-transform.txt, .sisyphus/evidence/task-3-markdown-scan.txt, .sisyphus/evidence/task-4-upstream-pattern.txt, .sisyphus/evidence/task-5-prompt-injection.txt, .sisyphus/evidence/task-6-plugin-guidance.txt, .sisyphus/evidence/task-7-maintainer-docs.txt, and .sisyphus/evidence/task-8-full-suite.txt. Return APPROVE or a defect list.")`. Save the response to `.sisyphus/evidence/f1-plan-compliance.txt`.
    Expected: Oracle returns APPROVE or a concrete actionable defect list; no vague review.
    Evidence: .sisyphus/evidence/f1-plan-compliance.txt

  Scenario: Oracle rejection loops back into fixes
    Tool: task
    Steps: If oracle reports defects, fix the issues, rerun the same oracle review with a fresh agent, and overwrite `.sisyphus/evidence/f1-plan-compliance.txt` with the new result.
    Expected: Final stored evidence contains an approval result from a fresh oracle pass.
    Evidence: .sisyphus/evidence/f1-plan-compliance.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: [`.sisyphus/evidence/f1-plan-compliance.txt`]

- [ ] F2. Code Quality Review — unspecified-high

  **What to do**: Run a fresh high-effort review agent against the touched source, test, and generated files. Review for clarity, duplication, brittle assertions, prompt drift, exact-prefix correctness, and accidental scope expansion.
  **Must NOT do**: Do not accept style-only feedback that does not affect correctness or maintainability.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-file code and test quality audit
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [completion] | Blocked By: [8]

  **References**:
  - Files: `src/agents/shared-prompt-sections.ts`, `src/agents/product-wunderkind.ts`, `src/agents/fullstack-wunderkind.ts`, `src/agents/ciso.ts`, `src/agents/slash-commands.ts`, `src/index.ts`, `tests/unit/agent-factories.test.ts`, `tests/unit/plugin-transform.test.ts`, `tests/unit/skill-task-contract.test.ts`, `tests/unit/build-agents.test.ts`, `agents/*.md`, `AGENTS.md`, `skills/SKILL-STANDARD.md`
  - Evidence: `.sisyphus/evidence/task-8-full-suite.txt`

  **Acceptance Criteria** (agent-executable only):
  - [ ] A fresh `task(category="unspecified-high", load_skills=[], run_in_background=false, ...)` review is executed.
  - [ ] Reviewer returns APPROVE or a concrete defect list.
  - [ ] Review output is saved to `.sisyphus/evidence/f2-code-quality.txt`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: High-effort reviewer checks source and tests
    Tool: task
    Steps: Invoke `task(category="unspecified-high", load_skills=[], run_in_background=false, prompt="Review the completed Wunderkind OMO task-contract compliance changes for code quality, test quality, brittle assertions, prompt drift, duplication, and scope creep. Focus on touched source, tests, generated agents, and maintainer docs. Return APPROVE or a concrete defect list.")`. Save the response to `.sisyphus/evidence/f2-code-quality.txt`.
    Expected: Reviewer returns APPROVE or a concrete actionable defect list.
    Evidence: .sisyphus/evidence/f2-code-quality.txt

  Scenario: Re-review after fixes if defects are found
    Tool: task
    Steps: If defects are reported, fix them and rerun the review with a fresh `unspecified-high` agent, then overwrite `.sisyphus/evidence/f2-code-quality.txt` with the latest result.
    Expected: Final stored evidence contains an approval result from a fresh pass.
    Evidence: .sisyphus/evidence/f2-code-quality.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: [`.sisyphus/evidence/f2-code-quality.txt`]

- [ ] F3. Real Manual QA — unspecified-high

  **What to do**: Run a fresh reviewer to perform command-level manual QA over the finished work. The reviewer must validate the exact verification commands from Task 8 and inspect resulting outputs for binary pass/fail, not just trust prior claims.
  **Must NOT do**: Do not use vague “looks good” language. Do not skip re-checking the concrete commands.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: rigorous manual validation of command-driven outputs
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [completion] | Blocked By: [8]

  **References**:
  - Commands: `tsc --noEmit`, `bun test tests/unit/agent-factories.test.ts`, `bun test tests/unit/plugin-transform.test.ts`, `bun test tests/unit/skill-task-contract.test.ts`, `bun test tests/unit/build-agents.test.ts`, `bun test tests/unit/`, `bun run build`
  - Evidence: `.sisyphus/evidence/task-8-tsc.txt`, `.sisyphus/evidence/task-8-agent-tests.txt`, `.sisyphus/evidence/task-8-plugin-tests.txt`, `.sisyphus/evidence/task-8-markdown-tests.txt`, `.sisyphus/evidence/task-8-build.txt`, `.sisyphus/evidence/task-8-build-tests.txt`, `.sisyphus/evidence/task-8-full-suite.txt`

  **Acceptance Criteria** (agent-executable only):
  - [ ] A fresh `task(category="unspecified-high", load_skills=[], run_in_background=false, ...)` QA review is executed.
  - [ ] Reviewer explicitly verifies that the expected command outputs indicate pass/green status.
  - [ ] Review output is saved to `.sisyphus/evidence/f3-manual-qa.txt`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Reviewer validates command outputs, not just claims
    Tool: task
    Steps: Invoke `task(category="unspecified-high", load_skills=[], run_in_background=false, prompt="Perform manual QA over the completed Wunderkind OMO task-contract compliance work using evidence files .sisyphus/evidence/task-8-tsc.txt, .sisyphus/evidence/task-8-agent-tests.txt, .sisyphus/evidence/task-8-plugin-tests.txt, .sisyphus/evidence/task-8-markdown-tests.txt, .sisyphus/evidence/task-8-build.txt, .sisyphus/evidence/task-8-build-tests.txt, and .sisyphus/evidence/task-8-full-suite.txt. Confirm whether each command actually passed. Return APPROVE or a defect list.")`. Save the response to `.sisyphus/evidence/f3-manual-qa.txt`.
    Expected: Reviewer explicitly confirms green command outputs or returns a concrete defect list.
    Evidence: .sisyphus/evidence/f3-manual-qa.txt

  Scenario: Manual QA is rerun after defects
    Tool: task
    Steps: If defects are found, fix them, regenerate evidence as needed, and rerun the review with a fresh `unspecified-high` agent. Overwrite `.sisyphus/evidence/f3-manual-qa.txt` with the latest result.
    Expected: Final stored evidence contains an approval result from a fresh pass.
    Evidence: .sisyphus/evidence/f3-manual-qa.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: [`.sisyphus/evidence/f3-manual-qa.txt`]

- [ ] F4. Scope Fidelity Check — deep

  **What to do**: Run a fresh deep reviewer to confirm the delivered changes stayed inside scope: prompt contract, runtime routing text, maintainer docs, generated assets, and tests only. The reviewer must flag any accidental mutations to CLI/config logic, permissions, build/render logic, historical `.sisyphus/**`, or unrelated prompt copy.
  **Must NOT do**: Do not allow “small incidental cleanup” outside the approved scope.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: high-context scope-boundary audit across the full change set
  - Skills: `[]` — no extra skill needed
  - Omitted: `["git-master"]` — no git work required

  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [completion] | Blocked By: [8]

  **References**:
  - Plan: `.sisyphus/plans/wunderkind-omo-task-contract-compliance.md`
  - Must-NOT scope: `src/build-agents.ts`, `src/agents/render-markdown.ts`, task permissions, CLI/config-manager code, historical `.sisyphus/**`
  - Evidence: `.sisyphus/evidence/task-7-maintainer-docs-negative.txt`, `.sisyphus/evidence/task-8-full-suite.txt`

  **Acceptance Criteria** (agent-executable only):
  - [ ] A fresh `task(category="deep", load_skills=[], run_in_background=false, ...)` scope review is executed.
  - [ ] Reviewer returns APPROVE or a concrete scope-violation list.
  - [ ] Review output is saved to `.sisyphus/evidence/f4-scope-fidelity.txt`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Deep reviewer checks scope boundaries
    Tool: task
    Steps: Invoke `task(category="deep", load_skills=[], run_in_background=false, prompt="Audit the completed Wunderkind OMO task-contract compliance implementation against .sisyphus/plans/wunderkind-omo-task-contract-compliance.md. Confirm the changes stayed within scope: prompt-contract text, runtime routing text, maintainer docs, generated agents, and tests only. Flag any unauthorized edits to build/render logic, permissions, CLI/config-manager code, or historical .sisyphus archives. Return APPROVE or a scope-violation list.")`. Save the response to `.sisyphus/evidence/f4-scope-fidelity.txt`.
    Expected: Reviewer returns APPROVE or a concrete scope-violation list.
    Evidence: .sisyphus/evidence/f4-scope-fidelity.txt

  Scenario: Scope review is rerun after corrections
    Tool: task
    Steps: If scope violations are found, fix them and rerun the review with a fresh `deep` agent. Overwrite `.sisyphus/evidence/f4-scope-fidelity.txt` with the latest result.
    Expected: Final stored evidence contains an approval result from a fresh pass.
    Evidence: .sisyphus/evidence/f4-scope-fidelity.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: [`.sisyphus/evidence/f4-scope-fidelity.txt`]

## Commit Strategy
- Do **not** create commits unless the user explicitly requests them.
- If the user later requests commits, use these four logical commits in order:

| Commit | Message | Tasks | Files |
|---|---|---|---|
| 1 | `test(prompts): pin delegation contract coverage` | 1, 2, 3 | `tests/unit/agent-factories.test.ts`, `tests/unit/plugin-transform.test.ts`, `tests/unit/skill-task-contract.test.ts` |
| 2 | `feat(prompts): align retained delegation guidance with OMO contract` | 4, 5 | `src/agents/shared-prompt-sections.ts`, `src/agents/product-wunderkind.ts`, `src/agents/fullstack-wunderkind.ts`, `src/agents/ciso.ts`, `src/agents/slash-commands.ts` |
| 3 | `feat(plugin): clarify task and skill delegation at runtime` | 6 | `src/index.ts` |
| 4 | `build(prompts): regenerate agents, update maintainer docs, and lock contract coverage` | 7, 8 | `AGENTS.md`, `skills/SKILL-STANDARD.md`, `agents/*.md`, `tests/unit/build-agents.test.ts` |

- Never amend previously pushed commits.

## Success Criteria
- No retained-agent or runtime guidance teaches a `task(...)` call without explicit `run_in_background` and `load_skills`.
- Task-capable retained agents receive one shared canonical contract section; task-denied retained agents do not.
- Slash-command guidance clearly distinguishes `skill(name="...")` from `task(...)`.
- Maintainer docs match the same contract without rewriting historical archives.
- Generated native-agent markdown reflects the updated source prompts.
- All targeted and full-suite verification commands pass without manual intervention.
