# Upgrade Wunderkind for New oh-my-openagent and OpenCode Capabilities

## TL;DR
> **Summary**: Upgrade Wunderkind from its current oh-my-openagent/OpenCode baseline to the latest compatible upstream surfaces, harden canonical naming and compatibility seams, then selectively integrate major new capabilities like richer plugin hooks, MCP-aware flows, ACP/editor-awareness, and agent guidance for LSP/AST-grep/background work — without violating Wunderkind’s synchronous overlay strategy.
> **Deliverables**:
> - Dependency and compatibility upgrade for `oh-my-openagent` and `@opencode-ai/plugin`
> - Canonical OMO naming/config migration (`oh-my-openagent` first, legacy tolerated)
> - Hardened install/upgrade/doctor compatibility reporting and migration paths
> - New/updated native commands, skills, prompts, and plugin hook usage that exploit high-value upstream capabilities
> - Full regression, compatibility, and release verification
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: 1 → 2 → 3 → 6 → 9 → 12 → F1-F4

## Context
### Original Request
Analyse all recent new features in oh-my-openagent plus relevant new features in the base OpenCode app and SDK, then plan a Wunderkind upgrade and integration of those new features.

### Interview Summary
- The user wants broad upstream feature analysis, not just a dependency bump.
- The user selected **Aggressive expansion** as the rollout posture.
- The upgrade plan must include both oh-my-openagent changes and OpenCode app/SDK/plugin-author changes.
- The target outcome is a decision-complete integration plan, not immediate implementation in this session.

### Research Summary
- Current Wunderkind integration points are concentrated in `src/index.ts`, installer/config-manager flows, native asset delivery, generated agent prompts, and docs/doctor surfaces.
- Current versions are `oh-my-openagent 3.12.3` and `@opencode-ai/plugin ^1.2.18`.
- Recent oh-my-openagent capabilities include canonical naming migration, ultrawork, background agents, hash-anchored edit, LSP/AST-grep, built-in MCPs, tmux integration, and stronger session/delegation contracts.
- Recent OpenCode capabilities include richer plugin hooks, more configurable commands/agents, mature MCP support, ACP/editor support, and a stronger SDK surface.

### Metis Review (gaps addressed)
- Treat compatibility seam verification as implementation work item #1, not an assumption.
- Separate core-platform compatibility work from optional product capability adoption.
- Keep all new capabilities behind graceful degradation rules; optional features must never become hidden prerequisites.
- Make `config-manager` and `doctor` the primary adaptation boundary for upstream churn rather than scattering compatibility logic across prompts.

### Oracle Review (architecture guardrails addressed)
- Preserve Wunderkind’s zero-runtime-process overlay strategy; do not add daemon/scheduler/session-store behavior.
- Integrate upstream capabilities by exposing, detecting, and routing to them — not by re-implementing them.
- Treat canonical naming migration, plugin-hook compatibility, native asset lifecycle, and doctor/install/upgrade intelligence as core.
- Defer any feature that would make Wunderkind own orchestration, retries, persistent task graphs, or MCP lifecycle management.

## Work Objectives
### Core Objective
Upgrade Wunderkind onto the latest viable oh-my-openagent and OpenCode plugin surfaces, while aggressively expanding the product’s ability to leverage new upstream capabilities through commands, prompts, routing, install/doctor intelligence, and compatibility-aware UX — without violating the current overlay architecture.

### Deliverables
- Updated dependency versions in `package.json`
- Updated canonical/legacy OMO config assets and detection behavior
- Updated plugin hook implementation and manifest metadata as required by the new SDK
- Updated install, upgrade, doctor, and config-manager behavior for canonical naming and capability detection
- Updated retained-agent prompts, skills, and native commands to exploit new upstream capabilities
- Updated tests, docs, changelog, and release workflow support

### Definition of Done (verifiable conditions with commands)
- `bun test tests/unit/` exits 0.
- `tsc --noEmit` exits 0.
- `bun run build` exits 0.
- `node bin/wunderkind.js doctor --verbose` exits 0 in both legacy-compatible and canonical-compatible fixture scenarios.
- `node bin/wunderkind.js install --no-tui --scope=global` exits 0 against current fixture coverage after the upgrade.
- `node bin/wunderkind.js upgrade --scope=global --dry-run` exits 0.
- Generated `agents/*.md` reflect the new guidance where planned.
- Canonical OMO naming is treated as primary while legacy naming remains explicitly supported where intended.

### Must Have
- Verify actual upstream hook names, CLI names, config basenames, and manifest requirements before changing implementation assumptions.
- Preserve Wunderkind as a synchronous overlay/plugin with zero runtime daemon/process ownership.
- Upgrade and harden canonical `oh-my-openagent` naming throughout install/upgrade/doctor/config handling.
- Maintain compatibility for legacy `oh-my-opencode` names where the repo contract already promises transitional support.
- Add graceful capability detection/reporting for high-value upstream features where Wunderkind chooses to depend on or recommend them.
- Integrate high-value upstream capabilities through prompts/commands/skills/plugin hooks where they materially improve retained-agent behavior.
- Keep install/upgrade/doctor as the primary operational adaptation layer.
- Ensure `.claude-plugin/plugin.json` stays version-synced with `package.json`.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No new Wunderkind runtime daemon, scheduler, queue, retry engine, or persistent task graph.
- No Wunderkind-owned MCP server lifecycle management.
- No breaking removal of legacy naming support without explicit migration handling and doctor guidance.
- No hidden prerequisite on optional upstream features; all optional integrations must degrade cleanly.
- No scattered compatibility hacks across all prompts when the issue belongs in config-manager, doctor, install, or plugin wiring.
- No unverified assumptions about upstream hook names, CLI commands, manifest schema, or config filenames.
- No semver release without aligned package/plugin manifest versions and explicit changelog updates.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **tests-after** with targeted RED/green additions where new behavior is introduced; Bun unit suite + TypeScript + build verification
- QA policy: Every task includes agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: upstream compatibility reconnaissance and dependency baseline
- Tasks 1-5

Wave 2: canonical naming/config-manager/doctor/install hardening
- Tasks 6-10

Wave 3: capability integrations across plugin surface, commands, prompts, and docs
- Tasks 11-16

Wave 4: release prep and regression closure
- Tasks 17-19

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 3, 4, 5, 6 |
| 2 | 1 | 6, 11 |
| 3 | 1 | 6, 7, 8 |
| 4 | 1 | 9, 11 |
| 5 | 1 | 10, 18 |
| 6 | 1, 2, 3 | 7, 8, 9, 10 |
| 7 | 3, 6 | 17 |
| 8 | 3, 6 | 17 |
| 9 | 4, 6 | 12, 13, 17 |
| 10 | 5, 6 | 18 |
| 11 | 2, 4 | 12, 13, 14, 15 |
| 12 | 9, 11 | 16, 17 |
| 13 | 9, 11 | 16, 17 |
| 14 | 11 | 16, 17 |
| 15 | 11 | 16, 17 |
| 16 | 12, 13, 14, 15 | 17, 18 |
| 17 | 7, 8, 9, 12, 13, 14, 15, 16 | 18, 19 |
| 18 | 10, 16, 17 | 19 |
| 19 | 17, 18 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Categories |
|---|---:|---|
| Wave 1 | 5 | unspecified-high, deep |
| Wave 2 | 5 | unspecified-high, quick |
| Wave 3 | 6 | unspecified-high, writing, visual-engineering |
| Wave 4 | 3 | unspecified-high, writing |
| Final Verification | 4 | oracle, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Lock upstream compatibility facts before changing implementation

  **What to do**: Audit the actual latest upstream surfaces before any code changes. Verify the current oh-my-openagent CLI binary name, canonical config basenames, latest schema URL(s), actual `@opencode-ai/plugin` hook names and manifest expectations, and whether any of Wunderkind’s currently used hooks or plugin-loading assumptions changed. Convert every assumption into file-backed evidence and then update the relevant failing tests first if the current code is out of date.
  **Must NOT do**: Do not bump dependencies first and hope the compiler reveals everything. Do not change implementation before capturing the upstream facts in tests and notes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the compatibility gate for the whole upgrade and requires exactness across upstream APIs.
  - Skills: `[]` - Reason: direct repo/upstream comparison is sufficient.
  - Omitted: [`improve-codebase-architecture`] - Reason: this is fact-locking, not redesign.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Plugin: `src/index.ts:89-254` - current plugin hooks in use (`tool`, `permission.ask`, `experimental.chat.system.transform`).
  - Config: `src/cli/config-manager/index.ts:267-354` - OMO config-path resolution and freshness detection.
  - Manifest: `.claude-plugin/plugin.json:1-6` - current plugin manifest shape.
  - OMO config: `oh-my-opencode.jsonc:1-77` - current shipped legacy config template and schema URL.
  - Dependency baseline: `package.json:27-47` - current pinned/ranged versions.
  - External: `https://ohmyopenagent.com/docs` - canonical OMO docs.
  - External: `https://github.com/code-yeongyu/oh-my-openagent/releases` - release notes and migration clues.
  - External: `https://opencode.ai/docs/plugins` - current plugin API docs.
  - External: `https://opencode.ai/docs/agents` - current agent schema/deprecations.
  - External: `https://opencode.ai/docs/commands` - current command schema.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A repo-local evidence note enumerates the verified upstream facts that materially affect implementation.
  - [ ] Any outdated assumption is reflected in a failing or updated test before implementation tasks proceed.
  - [ ] No dependency bump occurs before the compatibility facts are locked.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Compatibility assumptions are evidence-backed
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('.sisyphus/notepads/omo-opencode-upgrade-analysis/learnings.md').read_text()
for needle in ['hook', 'cli', 'schema', 'manifest']:
    assert needle in text.lower()
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-1-upstream-facts.log

  Scenario: No dependency bump landed prematurely
    Tool: Bash
    Steps: run `git diff -- package.json | python - <<'PY'
import sys
data = sys.stdin.read()
assert 'oh-my-openagent' not in data
assert '@opencode-ai/plugin' not in data
PY`
    Expected: command exits 0 before dependency-change tasks begin
    Evidence: .sisyphus/evidence/task-1-upstream-facts-error.log
  ```

  **Commit**: YES | Message: `test(plugin): lock upstream compatibility assumptions` | Files: `tests/unit/*`, `.sisyphus/notepads/omo-opencode-upgrade-analysis/learnings.md`

- [ ] 2. Upgrade dependency baselines for OMO and OpenCode plugin SDK

  **What to do**: Update `package.json` to the latest explicitly chosen `oh-my-openagent` version and the latest compatible `@opencode-ai/plugin` version based on Task 1’s fact lock. Keep the dependency strategy explicit: retain a pinned OMO version unless a deliberate policy change is agreed, and choose the appropriate semver range or pin for the plugin SDK based on upstream compatibility guarantees.
  **Must NOT do**: Do not widen versions casually. Do not cross a major `@opencode-ai/plugin` boundary without simultaneously classifying the required Wunderkind release type and upgrade risk.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: dependency changes can trigger broad type/runtime shifts.
  - Skills: [`code-health`] - help inspect dependency-risk impact and upgrade caution.
  - Omitted: [`tdd`] - Reason: dependency selection precedes implementation changes.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 11 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Dependency baseline: `package.json:27-47`.
  - Release history: `CHANGELOG.md:1-40` - prior release cadence and release-note style.
  - External: `https://github.com/code-yeongyu/oh-my-openagent/releases`.
  - External: `https://opencode.ai/docs/plugins`.
  - External: `https://github.com/anomalyco/opencode/releases`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `package.json` reflects the chosen new `oh-my-openagent` and `@opencode-ai/plugin` versions.
  - [ ] Versioning policy is explicit in comments/notepad evidence for why pin/range choices were kept or changed.
  - [ ] `bun install` completes successfully after the version updates.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Dependencies resolve after version bump
    Tool: Bash
    Steps: run `bun install --frozen-lockfile || bun install`
    Expected: install exits 0 and lockfile/dependency graph resolves cleanly
    Evidence: .sisyphus/evidence/task-2-dependency-bump.log

  Scenario: Version policy remains explicit
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('package.json').read_text()
assert 'oh-my-openagent' in text
assert '@opencode-ai/plugin' in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-2-dependency-bump-error.log
  ```

  **Commit**: YES | Message: `chore(deps): upgrade omo and opencode plugin baselines` | Files: `package.json`, lockfile if changed

- [ ] 3. Update plugin hook and manifest compatibility for the new SDK

  **What to do**: Adjust `src/index.ts` and `.claude-plugin/plugin.json` to match the actual current plugin API. If `experimental.chat.system.transform` has been renamed or stabilized, update the hook accordingly and preserve the current runtime injection behavior. If the plugin manifest requires new fields for declared capabilities, hooks, or metadata, add them in the smallest valid shape and cover them with tests.
  **Must NOT do**: Do not redesign Wunderkind’s runtime behavior. Do not add new hooks “just because they exist” unless they are part of the selected aggressive integration wave.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is a high-risk core plugin boundary.
  - Skills: [`tdd`] - Reason: hook/manifest changes should be proven through tests first.
  - Omitted: [`design-an-interface`] - Reason: the upstream interface is already defined; this is adaptation work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7, 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Plugin implementation: `src/index.ts:89-254`.
  - Manifest: `.claude-plugin/plugin.json:1-6`.
  - Tests: `tests/unit/plugin-transform.test.ts`, `tests/unit/docs-injection.test.ts`, `tests/unit/manifest-sync.test.ts`.
  - External: `https://opencode.ai/docs/plugins`.
  - External: `https://github.com/anomalyco/opencode/releases/tag/v1.3.16`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Plugin hook names and manifest fields match the verified current SDK contract.
  - [ ] Existing runtime context/docs/soul injection behavior still passes under the updated hook path.
  - [ ] `tests/unit/plugin-transform.test.ts` and `tests/unit/docs-injection.test.ts` pass after the change.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Plugin transform compatibility remains intact
    Tool: Bash
    Steps: run `bun test tests/unit/plugin-transform.test.ts tests/unit/docs-injection.test.ts tests/unit/manifest-sync.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-3-plugin-hook-compat.log

  Scenario: Type-level plugin API stays valid
    Tool: Bash
    Steps: run `tsc --noEmit`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-3-plugin-hook-compat-error.log
  ```

  **Commit**: YES | Message: `fix(plugin): align hooks and manifest with new opencode sdk` | Files: `src/index.ts`, `.claude-plugin/plugin.json`, relevant tests

- [ ] 4. Define the selected OpenCode capability integrations at the plugin boundary

  **What to do**: Decide and encode which new OpenCode plugin/runtime capabilities Wunderkind will actively integrate in this wave. This must produce an explicit list of adopted capabilities versus detected-only versus deferred. Candidate areas include additional plugin hooks, richer command/agent metadata, ACP/editor-awareness, MCP-related routing guidance, and SDK-driven surfaces. The implementation work in later tasks must only build what is selected here.
  **Must NOT do**: Do not let “aggressive expansion” become “integrate everything.” Do not adopt capabilities that force Wunderkind to own runtime orchestration.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is scope control at the architecture seam.
  - Skills: [`improve-codebase-architecture`] - Reason: selection must preserve the overlay model.
  - Omitted: [`tdd`] - Reason: this is a design-selection task feeding later implementation.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 9, 11 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Plugin usage: `src/index.ts:89-254`.
  - Routing/runtime injection: `src/index.ts:176-251`.
  - External: `https://opencode.ai/docs/plugins`.
  - External: `https://opencode.ai/docs/agents`.
  - External: `https://opencode.ai/docs/commands`.
  - External: `https://opencode.ai/docs/acp`.
  - External: `https://opencode.ai/docs/sdk`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A repo-local decision record lists every considered OpenCode capability as adopt / detect-only / defer.
  - [ ] No deferred capability later appears in implementation tasks as an unreviewed dependency.
  - [ ] Selected capabilities preserve the synchronous overlay invariant.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Capability selection record is explicit
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('.sisyphus/notepads/omo-opencode-upgrade-analysis/decisions.md').read_text().lower()
for needle in ['adopt', 'detect-only', 'defer']:
    assert needle in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-4-capability-selection.log

  Scenario: Overlay guardrail is preserved in decision record
    Tool: Bash
    Steps: run `grep -i "zero-runtime\|overlay\|no daemon\|no scheduler" .sisyphus/notepads/omo-opencode-upgrade-analysis/decisions.md`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-4-capability-selection-error.log
  ```

  **Commit**: YES | Message: `docs(architecture): lock opencode capability adoption matrix` | Files: `.sisyphus/notepads/omo-opencode-upgrade-analysis/decisions.md`

- [ ] 5. Define the selected oh-my-openagent capability integrations and deferrals

  **What to do**: Produce the equivalent capability matrix for upstream oh-my-openagent features introduced since the current pinned version. Explicitly classify ultrawork, background agents, built-in MCPs, hash-anchored edit, LSP/AST-grep, tmux integration, Prometheus planner, and session/runtime hardening as adopt / leverage passively / detect-only / defer. Later implementation must follow this matrix.
  **Must NOT do**: Do not assume every OMO feature needs first-class Wunderkind UI or config. Do not convert platform features into Wunderkind-owned runtime concerns.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this sets the product/architecture boundary for OMO-specific expansion.
  - Skills: [`improve-codebase-architecture`] - Reason: the key risk is platform-boundary drift.
  - Omitted: [`db-architect`] - Reason: no database work exists.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 10, 18 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Current OMO template: `oh-my-opencode.jsonc:1-77`.
  - Current install/doctor notes: `README.md`, `AGENTS.md` sections on OMO compatibility and naming migration.
  - External: `https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v3.14.0`.
  - External: `https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v3.15.1`.
  - External: `https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v3.15.3`.
  - External: `https://ohmyopenagent.com/docs`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A decision record exists for every major new OMO capability area in scope.
  - [ ] No capability later implemented is missing from the matrix.
  - [ ] Deferred/runtime-owning capabilities are explicitly marked out of scope.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: OMO capability matrix covers major new features
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
text = Path('.sisyphus/notepads/omo-opencode-upgrade-analysis/decisions.md').read_text().lower()
for needle in ['ultrawork', 'background', 'mcp', 'lsp', 'ast', 'tmux', 'prometheus']:
    assert needle in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-5-omo-capability-matrix.log

  Scenario: Deferred runtime ownership is explicit
    Tool: Bash
    Steps: run `grep -i "defer\|out of scope\|no runtime ownership" .sisyphus/notepads/omo-opencode-upgrade-analysis/decisions.md`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-5-omo-capability-matrix-error.log
  ```

  **Commit**: YES | Message: `docs(architecture): lock omo capability adoption matrix` | Files: `.sisyphus/notepads/omo-opencode-upgrade-analysis/decisions.md`

- [ ] 6. Prefer canonical oh-my-openagent naming in config detection and emitted assets

  **What to do**: Update the repo’s shipped OMO config asset strategy and config-manager detection/writing logic so canonical `oh-my-openagent` naming is primary everywhere new output is emitted, while legacy `oh-my-opencode` names remain accepted during the compatibility window. This includes config basenames, schema URLs, doctor wording, and any install/upgrade messages that currently present legacy naming as the main path.
  **Must NOT do**: Do not remove legacy detection outright. Do not emit conflicting guidance where install says one name and doctor detects another.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is core compatibility behavior with user-visible effects.
  - Skills: [`tdd`] - Reason: naming migration must be covered before implementation.
  - Omitted: [`technical-writer`] - Reason: this is primarily code/test behavior with follow-on docs work later.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7, 8, 9, 10 | Blocked By: 1, 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - OMO path resolution: `src/cli/config-manager/index.ts:267-354`.
  - OMO freshness detection: `src/cli/config-manager/index.ts:354-539`.
  - Current template: `oh-my-opencode.jsonc:1-77`.
  - Tests: `tests/unit/config-manager-coverage.test.ts`, `tests/unit/cli-installer.test.ts`, `tests/unit/init-doctor.test.ts`.
  - External: `https://ohmyopenagent.com/docs`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Canonical `oh-my-openagent` naming is used in emitted/configured primary paths and messages.
  - [ ] Legacy filenames/configs are still detected where the current product contract says they should be.
  - [ ] Tests cover both canonical and legacy compatibility paths.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Config manager resolves canonical naming first
    Tool: Bash
    Steps: run `bun test tests/unit/config-manager-coverage.test.ts tests/unit/cli-installer.test.ts`
    Expected: command exits 0 with naming-migration assertions passing
    Evidence: .sisyphus/evidence/task-6-canonical-naming.log

  Scenario: Legacy compatibility path remains intact
    Tool: Bash
    Steps: run `bun test tests/unit/init-doctor.test.ts --filter "legacy\|canonical\|oh-my-openagent\|oh-my-opencode"`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-6-canonical-naming-error.log
  ```

  **Commit**: YES | Message: `feat(config): prefer canonical oh-my-openagent naming` | Files: `src/cli/config-manager/index.ts`, `oh-my-opencode.jsonc` or replacement canonical asset, relevant tests

- [ ] 7. Harden install flow for canonical naming and modern OMO expectations

  **What to do**: Update both TUI and non-interactive install flows so they guide users toward canonical OMO naming, detect modern OMO installations accurately, and emit correct remediation/install guidance. Ensure fresh installs produce the modern path and wording while still supporting existing users who are on transitional legacy naming.
  **Must NOT do**: Do not break non-interactive install. Do not require manual user cleanup of legacy files as a prerequisite to install.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused CLI flow updates once config-manager behavior is settled.
  - Skills: [`tdd`] - Reason: installer behavior should be pinned by tests.
  - Omitted: [`grill-me`] - Reason: requirements are already fixed by the plan.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 17 | Blocked By: 3, 6

  **References** (executor has NO interview context - be exhaustive):
  - Non-interactive install: `src/cli/cli-installer.ts`.
  - Interactive install: `src/cli/tui-installer.ts`.
  - CLI wiring: `src/cli/index.ts`.
  - Tests: `tests/unit/cli-installer.test.ts`, `tests/unit/cli-help-text.test.ts`.
  - Current docs text: `README.md` install sections.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Fresh install paths and messages use canonical OMO naming.
  - [ ] Existing transitional compatibility behavior still succeeds under tests.
  - [ ] Help text and install diagnostics remain accurate after the change.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Canonical install flow passes
    Tool: Bash
    Steps: run `bun test tests/unit/cli-installer.test.ts tests/unit/cli-help-text.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-7-install-flow.log

  Scenario: Non-interactive install still works under canonical expectations
    Tool: Bash
    Steps: run `bun run build && node bin/wunderkind.js install --no-tui --scope=global --help`
    Expected: command exits 0 and help text reflects valid install contract
    Evidence: .sisyphus/evidence/task-7-install-flow-error.log
  ```

  **Commit**: YES | Message: `feat(cli): harden install flow for canonical omo naming` | Files: `src/cli/cli-installer.ts`, `src/cli/tui-installer.ts`, relevant tests/docs

- [ ] 8. Harden upgrade and uninstall flows for canonical naming and compatibility migration

  **What to do**: Update upgrade and uninstall/cleanup flows so they correctly handle canonical naming, legacy compatibility cleanup, and transitional detection. Ensure upgrade refreshes the correct native assets and config references, and uninstall/cleanup remove Wunderkind-owned wiring without leaving naming-specific drift or removing user-owned upstream assets incorrectly.
  **Must NOT do**: Do not make uninstall destructive toward user-owned OMO state beyond Wunderkind’s contract. Do not let upgrade write conflicting canonical and legacy assets without a defined rule.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: once naming policy is fixed, the change is a bounded CLI consistency update.
  - Skills: [`tdd`] - Reason: uninstall/upgrade paths must remain regression-safe.
  - Omitted: [`git-master`] - Reason: no history work needed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 17 | Blocked By: 3, 6

  **References** (executor has NO interview context - be exhaustive):
  - Upgrade flow: `src/cli/cli-installer.ts` upgrade path.
  - Cleanup: `src/cli/cleanup.ts`.
  - Uninstall: `src/cli/uninstall.ts`.
  - Tests: `tests/unit/uninstall.test.ts`, `tests/unit/cleanup.test.ts`, `tests/unit/cli-installer.test.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Upgrade respects canonical naming and refreshes the intended assets.
  - [ ] Uninstall/cleanup preserve shared user-owned state per current Wunderkind contract.
  - [ ] Tests prove both upgrade and uninstall/cleanup behavior remain correct.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Upgrade and uninstall paths remain correct
    Tool: Bash
    Steps: run `bun test tests/unit/cli-installer.test.ts tests/unit/uninstall.test.ts tests/unit/cleanup.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-8-upgrade-uninstall.log

  Scenario: Upgrade dry-run contract remains valid
    Tool: Bash
    Steps: run `bun run build && tmpdir="$(mktemp -d)" && HOME="$tmpdir/home" XDG_CONFIG_HOME="$tmpdir/home/.config" node bin/wunderkind.js install --no-tui --scope=global >/dev/null && HOME="$tmpdir/home" XDG_CONFIG_HOME="$tmpdir/home/.config" node bin/wunderkind.js upgrade --scope=global --dry-run`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-8-upgrade-uninstall-error.log
  ```

  **Commit**: YES | Message: `feat(cli): harden upgrade and uninstall for canonical omo naming` | Files: `src/cli/cli-installer.ts`, `src/cli/uninstall.ts`, `src/cli/cleanup.ts`, relevant tests

- [ ] 9. Upgrade doctor to report canonical naming, freshness, and selected capability status

  **What to do**: Extend `wunderkind doctor` so it reflects the new naming policy, checks the correct OMO/OpenCode compatibility surfaces, and reports the selected upstream capability state clearly. At minimum it must improve freshness/version detection, canonical-vs-legacy naming diagnostics, and any selected feature flags/capabilities the aggressive integration wave depends on.
  **Must NOT do**: Do not dump raw implementation details. Do not make doctor depend on optional features being installed unless the message clearly classifies them as optional.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: doctor is the main supportability surface for this migration.
  - Skills: [`tdd`] - Reason: doctor output changes need explicit behavior locks.
  - Omitted: [`technical-writer`] - Reason: this is operational diagnostics logic, not long-form docs.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 12, 13, 17 | Blocked By: 4, 6

  **References** (executor has NO interview context - be exhaustive):
  - Doctor: `src/cli/doctor.ts`.
  - Config-manager freshness detection: `src/cli/config-manager/index.ts:354-539`.
  - Tests: `tests/unit/init-doctor.test.ts`.
  - Current docs: `README.md` doctor sections.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Doctor clearly distinguishes canonical naming, legacy compatibility, and stale/misconfigured states.
  - [ ] Doctor surfaces selected capability status in a way aligned with the adoption matrix.
  - [ ] Verbose mode remains readable and actionable.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Doctor diagnostics cover naming and capability state
    Tool: Bash
    Steps: run `bun test tests/unit/init-doctor.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-9-doctor-diagnostics.log

  Scenario: Real doctor command remains executable
    Tool: Bash
    Steps: run `bun run build && node bin/wunderkind.js doctor --verbose`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-9-doctor-diagnostics-error.log
  ```

  **Commit**: YES | Message: `feat(doctor): improve omo naming and capability diagnostics` | Files: `src/cli/doctor.ts`, relevant tests

- [ ] 10. Expand project config/schema only where the adoption matrix requires it

  **What to do**: If the selected aggressive integration wave truly needs new Wunderkind config keys, add them in a fully coherent, test-backed way across the entire project config stack. This includes types, default config, coercion, renderers, schema, doctor surfacing, init prompts if required, and backward-compatible read behavior. If no key is actually needed, explicitly record that and skip code changes.
  **Must NOT do**: Do not add config just to reflect platform capabilities that can be inferred or remain upstream-owned. Do not partially wire a new key.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: config changes have the highest long-tail support burden.
  - Skills: [`tdd`] - Reason: config additions must be test-first and exhaustive.
  - Omitted: [`design-an-interface`] - Reason: config schema shape should follow the minimal required contract.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 18 | Blocked By: 5, 6

  **References** (executor has NO interview context - be exhaustive):
  - Config stack: `src/cli/config-manager/index.ts:160-1015`.
  - Schema: `schemas/wunderkind.config.schema.json`.
  - Init prompts: `src/cli/init.ts`.
  - Tests: config-manager, init, doctor suites.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Every new config key, if any, is fully wired across type/default/coerce/render/schema/doctor/init/tests.
  - [ ] Backward compatibility for older sparse project configs is preserved.
  - [ ] If no new key is needed, that decision is recorded with evidence and no stray config changes exist.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Config stack remains coherent
    Tool: Bash
    Steps: run `bun test tests/unit/config-manager-coverage.test.ts tests/unit/init-interactive.test.ts tests/unit/init-nontui.test.ts tests/unit/init-doctor.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-10-config-stack.log

  Scenario: Schema/type contract stays valid
    Tool: Bash
    Steps: run `tsc --noEmit`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-10-config-stack-error.log
  ```

  **Commit**: YES | Message: `feat(config): add selected upgrade-wave settings` | Files: config/schema/init/doctor/test files as required

- [ ] 11. Integrate selected new OpenCode plugin hooks and runtime surfaces without changing Wunderkind’s runtime ownership model

  **What to do**: Implement the subset of newly available OpenCode plugin hooks and runtime surfaces that the adoption matrix selected. Examples may include additional session/message/tool hooks, shell env shaping, compaction-aware prompt handling, or capability-aware metadata/logging. Each added hook must have a specific purpose tied to Wunderkind’s overlay role and must degrade safely if the surrounding capability is absent.
  **Must NOT do**: Do not add hooks that merely mirror existing behavior or require Wunderkind to own orchestration or persistent state.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: plugin-surface changes are technically deep and support-sensitive.
  - Skills: [`tdd`] - Reason: each hook adoption must be proven by behavior tests.
  - Omitted: [`improve-codebase-architecture`] - Reason: the adoption matrix already fixed the architecture boundary.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12, 13, 14, 15 | Blocked By: 2, 4

  **References** (executor has NO interview context - be exhaustive):
  - Plugin entry: `src/index.ts:89-254`.
  - Existing tool/permission/system transform behavior: `src/index.ts` full file.
  - Tests: `tests/unit/plugin-transform.test.ts`, `tests/unit/docs-injection.test.ts`, any plugin-specific tests.
  - External: `https://opencode.ai/docs/plugins`.
  - External: `https://opencode.ai/docs/tools`.
  - External: `https://opencode.ai/docs/sdk`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Only selected new plugin/runtime hooks are added.
  - [ ] Each new hook has explicit tests proving purpose and non-regression.
  - [ ] No hook adoption introduces persistent runtime ownership behavior.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Plugin hook additions behave as intended
    Tool: Bash
    Steps: run `bun test tests/unit/plugin-transform.test.ts tests/unit/docs-injection.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-11-plugin-hook-adoption.log

  Scenario: Plugin API remains type-safe
    Tool: Bash
    Steps: run `tsc --noEmit`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-11-plugin-hook-adoption-error.log
  ```

  **Commit**: YES | Message: `feat(plugin): adopt selected new opencode hook surfaces` | Files: `src/index.ts`, relevant tests

- [ ] 12. Upgrade native commands to leverage selected new platform capabilities

  **What to do**: Update Wunderkind’s shipped native command assets to reference or exploit the newly selected upstream capabilities where they materially improve outcomes. Likely candidates include `/dream`, `/docs-index`, `/design-md`, and any command guidance that should now mention MCPs, background agents, ACP/editor constraints, or richer command metadata supported by OpenCode. Keep commands explicit, bounded, and capability-aware.
  **Must NOT do**: Do not add speculative commands with no clear job. Do not make commands assume optional upstream capabilities are always present.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: command assets are user-facing behavior contracts.
  - Skills: [`technical-writer`] - Reason: precise command wording and constraints matter.
  - Omitted: [`playwright`] - Reason: no browser UI work is involved.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 16, 17 | Blocked By: 9, 11

  **References** (executor has NO interview context - be exhaustive):
  - Commands: `commands/*.md`.
  - Native command plumbing: `src/cli/config-manager/index.ts:1142-1207`.
  - Tests: command-related unit tests and packaging coverage.
  - External: `https://opencode.ai/docs/commands`.
  - External: `https://opencode.ai/docs/acp`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Updated commands reflect selected platform capabilities without overclaiming availability.
  - [ ] Packaging/installation tests still pass for all touched command assets.
  - [ ] Command wording remains bounded to Wunderkind’s product contract.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Native command assets remain valid and packaged
    Tool: Bash
    Steps: run `bun test tests/unit/config-manager-coverage.test.ts tests/unit/cli-installer.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-12-command-upgrade.log

  Scenario: Command content references are capability-aware
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
for path in Path('commands').glob('*.md'):
    text = path.read_text().lower()
    assert 'always available' not in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-12-command-upgrade-error.log
  ```

  **Commit**: YES | Message: `feat(commands): integrate selected opencode capability guidance` | Files: `commands/*.md`, related tests if needed

- [ ] 13. Upgrade retained-agent prompts for LSP/AST-grep/background/MCP-aware execution patterns

  **What to do**: Update the relevant agent factory files in `src/agents/` so retained agents explicitly understand the new high-value platform capabilities selected in the adoption matrix. The focus should be on better tool-choice guidance, delegation behavior, and capability-aware routing — especially for `product-wunderkind` and `fullstack-wunderkind`, plus any other agent whose domain materially benefits from LSP, AST-grep, MCP, tmux, or background-agent support.
  **Must NOT do**: Do not bloat every agent equally. Do not promise capabilities that the adoption matrix deferred or marked detect-only.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is prompt-contract work with product and technical nuance.
  - Skills: [`technical-writer`] - Reason: specialized prompt guidance needs precise wording.
  - Omitted: [`frontend-ui-ux`] - Reason: this is not visual work.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 16, 17 | Blocked By: 9, 11

  **References** (executor has NO interview context - be exhaustive):
  - Agent factories: `src/agents/*.ts`.
  - Build pipeline: `src/build-agents.ts`, `package.json:27-34`.
  - Generated outputs: `agents/*.md` (read-only generated artifacts).
  - Current platform gotchas: `AGENTS.md`.
  - External: `https://ohmyopenagent.com/docs`.
  - External: `https://opencode.ai/docs/tools`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Only the selected agents gain the new capability-aware guidance.
  - [ ] `bun run build` regenerates `agents/*.md` successfully.
  - [ ] Generated prompts contain the new guidance and remain internally consistent.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Agent factories build successfully after prompt upgrades
    Tool: Bash
    Steps: run `bun run build`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-13-agent-prompt-upgrade.log

  Scenario: Generated agents include selected new guidance
    Tool: Bash
    Steps: run `grep -R "LSP\|AST\|MCP\|background" agents src/agents`
    Expected: command exits 0 with matches in the intended agent surfaces only
    Evidence: .sisyphus/evidence/task-13-agent-prompt-upgrade-error.log
  ```

  **Commit**: YES | Message: `feat(agents): teach retained agents new platform capabilities` | Files: `src/agents/*.ts`, generated `agents/*.md`

- [ ] 14. Upgrade shipped skills and standards for the new upstream capability set

  **What to do**: Update `skills/SKILL-STANDARD.md` and any individual SKILL.md files whose guidance should change because OMO/OpenCode now provide materially different primitives. Focus on delegation contracts, background-task usage, MCP guidance, tool selection rules, and any now-preferred capabilities like LSP/AST-grep where appropriate.
  **Must NOT do**: Do not rewrite every skill generically. Do not introduce contradictions between skill guidance and retained-agent prompt guidance.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: these are instruction contracts.
  - Skills: [`technical-writer`] - Reason: consistency and precision matter.
  - Omitted: [`write-a-skill`] - Reason: this is skill maintenance, not authoring a new skill framework.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 16, 17 | Blocked By: 11

  **References** (executor has NO interview context - be exhaustive):
  - Skill standard: `skills/SKILL-STANDARD.md`.
  - Existing skills: `skills/*/SKILL.md`.
  - Current repo conventions: `AGENTS.md`.
  - External: `https://ohmyopenagent.com/docs`.
  - External: `https://opencode.ai/docs/tools`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Only skills materially affected by new capabilities are updated.
  - [ ] Skill guidance stays aligned with retained-agent prompts and repo conventions.
  - [ ] No skill introduces invalid tool/delegation contracts.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Skill contract changes are internally consistent
    Tool: Bash
    Steps: run `bun test tests/unit/skill-task-contract.test.ts`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-14-skill-upgrade.log

  Scenario: Skill guidance does not contradict updated standards
    Tool: Bash
    Steps: run `grep -R "run_in_background\|load_skills\|MCP\|LSP\|AST" skills`
    Expected: command exits 0 with intended references only
    Evidence: .sisyphus/evidence/task-14-skill-upgrade-error.log
  ```

  **Commit**: YES | Message: `docs(skills): align skill standards with new platform capabilities` | Files: `skills/SKILL-STANDARD.md`, selected `skills/*/SKILL.md`

- [ ] 15. Add ACP/editor-awareness and capability degradation guidance where selected

  **What to do**: If ACP/editor support is in the selected adoption set, update the relevant product surfaces — commands, docs, possibly manifest metadata, and support text — so Wunderkind users understand what works in ACP/editor contexts and what remains terminal-only. If ACP is detect-only or deferred, document that clearly instead.
  **Must NOT do**: Do not imply ACP parity where upstream docs explicitly call out unsupported slash commands or limitations.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is primarily user-facing contract clarification.
  - Skills: [`technical-writer`] - Reason: capability limitations must be communicated precisely.
  - Omitted: [`frontend-ui-ux`] - Reason: no UI implementation is needed.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 16, 17 | Blocked By: 11

  **References** (executor has NO interview context - be exhaustive):
  - Manifest: `.claude-plugin/plugin.json`.
  - Commands/docs surfaces touched in Tasks 12 and 16.
  - External: `https://opencode.ai/docs/acp`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] ACP/editor support stance is explicitly documented in the selected surfaces.
  - [ ] Unsupported-command caveats are stated accurately where relevant.
  - [ ] No user-facing surface overstates ACP/editor capability.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: ACP/editor guidance is explicit
    Tool: Bash
    Steps: run `grep -R "ACP\|editor" README.md commands .claude-plugin src/agents skills`
    Expected: command exits 0 if ACP/editor is adopted or documented; exits 1 only if explicitly deferred and absent by plan
    Evidence: .sisyphus/evidence/task-15-acp-guidance.log

  Scenario: Unsupported slash-command caveats are not contradicted
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
paths = [Path('README.md')] + list(Path('commands').glob('*.md'))
for path in paths:
    text = path.read_text().lower()
    assert '/undo works everywhere' not in text
    assert '/redo works everywhere' not in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-15-acp-guidance-error.log
  ```

  **Commit**: YES | Message: `docs(acp): document selected editor and acp behavior` | Files: selected docs/commands/manifest surfaces

- [ ] 16. Refresh README, AGENTS, and migration docs for the new integration wave

  **What to do**: Update repo-facing docs so maintainers and users understand the new compatibility baseline, canonical naming, selected upstream capabilities, deferred runtime boundaries, ACP stance, and upgrade guidance. This must include `README.md` and any relevant maintainer guidance in `AGENTS.md`, plus changelog-ready notes if the release message shape needs preparation.
  **Must NOT do**: Do not leave stale docs that still imply old naming or old capability assumptions. Do not bury major migration notes only in implementation comments.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is a broad documentation contract refresh.
  - Skills: [`technical-writer`] - Reason: consistency and migration clarity are key.
  - Omitted: [`social-media-maven`] - Reason: this is product documentation, not launch marketing.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 17, 18 | Blocked By: 12, 13, 14, 15

  **References** (executor has NO interview context - be exhaustive):
  - User docs: `README.md`.
  - Maintainer docs: `AGENTS.md`.
  - Existing migration notes in repo docs.
  - External: `https://ohmyopenagent.com/docs`.
  - External: `https://opencode.ai/docs`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] README and AGENTS reflect canonical naming, new compatibility baseline, and selected capability integrations.
  - [ ] Deferred runtime boundaries are documented explicitly.
  - [ ] No stale installation or doctor guidance remains.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Core docs reflect new upgrade wave
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
for path in [Path('README.md'), Path('AGENTS.md')]:
    text = path.read_text().lower()
    assert 'oh-my-openagent' in text
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-16-doc-refresh.log

  Scenario: Stale naming guidance is removed or reframed
    Tool: Bash
    Steps: run `grep -R "oh-my-opencode" README.md AGENTS.md src/cli | sed -n '1,120p'`
    Expected: remaining matches are compatibility-context references only, not primary guidance
    Evidence: .sisyphus/evidence/task-16-doc-refresh-error.log
  ```

  **Commit**: YES | Message: `docs(upgrade): refresh migration guidance for new omo and opencode capabilities` | Files: `README.md`, `AGENTS.md`, related docs

- [ ] 17. Run the full compatibility and regression gate after platform integration changes

  **What to do**: Execute the full agreed verification sequence after all compatibility and capability work lands. This includes targeted suites for plugin/config/doctor/install/skills, then `tsc --noEmit`, then `bun run build`, then the full unit suite. Fix any failures before moving to release prep.
  **Must NOT do**: Do not stop after only targeted tests. Do not ship with passing build but broken CLI/doctor behavior.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the main regression gate.
  - Skills: `[]` - Reason: standard repo verification commands are enough.
  - Omitted: [`playwright`] - Reason: this upgrade is CLI/plugin/docs focused.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: 18, 19 | Blocked By: 7, 8, 9, 12, 13, 14, 15, 16

  **References** (executor has NO interview context - be exhaustive):
  - `package.json:27-34` - build/test scripts.
  - All touched unit suites from prior tasks.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Targeted platform-related test suites pass.
  - [ ] `tsc --noEmit` passes.
  - [ ] `bun run build` passes.
  - [ ] `bun test tests/unit/` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Targeted compatibility gate succeeds
    Tool: Bash
    Steps: run `bun test tests/unit/plugin-transform.test.ts tests/unit/docs-injection.test.ts tests/unit/config-manager-coverage.test.ts tests/unit/cli-installer.test.ts tests/unit/init-doctor.test.ts tests/unit/uninstall.test.ts tests/unit/skill-task-contract.test.ts && tsc --noEmit && bun run build`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-17-regression-gate.log

  Scenario: Full unit regression suite succeeds
    Tool: Bash
    Steps: run `bun test tests/unit/`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-17-regression-gate-error.log
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 18. Prepare release metadata and compatibility messaging for the integration wave

  **What to do**: Update release-facing metadata for the final upgrade wave: version bump strategy, changelog entry, plugin manifest version sync, and any release notes needed to explain canonical naming, compatibility, and selected new capabilities. Ensure the release wording explains what users need to do after upgrade and what remains optional/deferred.
  **Must NOT do**: Do not publish vague release notes. Do not omit migration guidance if canonical naming becomes primary.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: release metadata and migration messaging must be crisp.
  - Skills: [`technical-writer`] - Reason: release-note quality matters.
  - Omitted: [`git-master`] - Reason: history mechanics are not the primary risk here.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 19 | Blocked By: 5, 10, 16, 17

  **References** (executor has NO interview context - be exhaustive):
  - `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md`.
  - `.github/workflows/publish.yml`.
  - Prior release commit style in git log.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Version-bearing files are aligned.
  - [ ] Changelog/release notes explain migration and capability changes accurately.
  - [ ] Release metadata is consistent with publish workflow expectations.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Release metadata is aligned
    Tool: Bash
    Steps: run `python - <<'PY'
import json
from pathlib import Path
pkg = json.loads(Path('package.json').read_text())
plugin = json.loads(Path('.claude-plugin/plugin.json').read_text())
assert pkg['version'] == plugin['version']
PY`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-18-release-metadata.log

  Scenario: Changelog includes migration guidance
    Tool: Bash
    Steps: run `grep -n "oh-my-openagent\|migration\|doctor\|upgrade" CHANGELOG.md`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-18-release-metadata-error.log
  ```

  **Commit**: YES | Message: `chore(release): prepare metadata for omo/opencode integration wave` | Files: `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md`

- [ ] 19. Execute the release-ready dry run and prove publish path readiness

  **What to do**: Run the final pre-release dry run for the integration wave. Confirm the repo is releasable: clean intended diff, successful verification, correct version alignment, and publish workflow prerequisites in place. This task does not publish; it proves the branch is ready for the release command/tag.
  **Must NOT do**: Do not push or publish automatically from this task. Do not skip verification because earlier targeted checks passed.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the release-readiness gate.
  - Skills: `[]` - Reason: standard shell verification is enough.
  - Omitted: [`git-master`] - Reason: no history rewrite work needed.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: F1-F4 | Blocked By: 17, 18

  **References** (executor has NO interview context - be exhaustive):
  - Release workflow: `.github/workflows/publish.yml`.
  - Version files: `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md`.
  - Verification outputs from Task 17.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Release branch state is clean except for intended tracked release changes.
  - [ ] Release metadata and verification outputs agree.
  - [ ] Repo is ready for commit/tag/publish with no unresolved blockers.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Release dry run is clean
    Tool: Bash
    Steps: run `git status --short && git diff --stat HEAD && python - <<'PY'
import json
from pathlib import Path
pkg = json.loads(Path('package.json').read_text())
plugin = json.loads(Path('.claude-plugin/plugin.json').read_text())
assert pkg['version'] == plugin['version']
PY`
    Expected: commands exit 0 and show only intended release-prep changes
    Evidence: .sisyphus/evidence/task-19-release-dry-run.log

  Scenario: Publish workflow definition still matches release contract
    Tool: Bash
    Steps: run `grep -n "tags:\|v\*\|npm publish\|provenance" .github/workflows/publish.yml`
    Expected: command exits 0
    Evidence: .sisyphus/evidence/task-19-release-dry-run-error.log
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
> **Reviewer freshness rule**: each verification pass must use a fresh agent/session. Never reuse a previous reviewer session after fixes.
- [ ] F1. Plan Compliance Audit — oracle

  **What to do**: Ask a fresh Oracle reviewer to compare the final branch state against `.sisyphus/plans/omo-opencode-upgrade-integration.md` and identify any missing task, skipped dependency, unmet acceptance criterion, or verification gap.
  **Must NOT do**: Do not ask Oracle to implement fixes. Do not accept partial compliance.

  **QA Scenario**:
  ```
  Scenario: Oracle approves plan compliance
    Tool: Task
    Steps: run `task(subagent_type="oracle", load_skills=[], run_in_background=false, description="Plan compliance audit", prompt="Review the completed branch against .sisyphus/plans/omo-opencode-upgrade-integration.md. Return APPROVE or REJECT. Verify every completed task, dependency, acceptance criterion, and verification claim. Report only blocking gaps or explicit approval.")`
    Expected: reviewer returns APPROVE/OKAY with no blocking gaps
    Evidence: .sisyphus/evidence/f1-plan-compliance.md
  ```

- [ ] F2. Code Quality Review — unspecified-high

  **What to do**: Run a fresh code-quality review over all touched files, focusing on coherence, maintainability, prompt/skill/command consistency, type-safety, and migration clarity.
  **Must NOT do**: Do not limit the review to only the last commit. Do not ignore generated outputs if agent prompt sources changed.

  **QA Scenario**:
  ```
  Scenario: Fresh code-quality review passes
    Tool: Task
    Steps: run `task(category="unspecified-high", load_skills=["code-health"], run_in_background=false, description="Code quality review", prompt="Review all files changed for the OMO/OpenCode integration wave. Return APPROVE or REJECT. Check maintainability, consistency across source/generated docs, type-safety, migration clarity, and whether any AI-slop or unsupported assumptions remain.")`
    Expected: reviewer returns APPROVE/OKAY with no blocking quality issues
    Evidence: .sisyphus/evidence/f2-code-quality.md
  ```

- [ ] F3. Real Manual QA — unspecified-high (+ interactive_bash if CLI)

  **What to do**: Run a fresh end-to-end manual verification pass over the real CLI surfaces changed by this upgrade, including install/upgrade/doctor behavior in a clean temp environment and any user-visible capability messaging that changed.
  **Must NOT do**: Do not substitute static inspection for execution. Do not skip CLI paths that changed.

  **QA Scenario**:
  ```
  Scenario: Manual CLI QA passes in a clean temp environment
    Tool: Task
    Steps: run `task(category="unspecified-high", load_skills=[], run_in_background=false, description="Manual CLI QA", prompt="Execute real manual QA for the OMO/OpenCode upgrade wave. In a clean temporary environment, run the agreed verification commands for install/help, upgrade --dry-run, doctor --verbose, targeted tests, and build/typecheck where relevant. Use interactive_bash if needed for CLI interaction. Return APPROVE or REJECT with exact failing command/output if anything breaks.")`
    Expected: reviewer returns APPROVE/OKAY and cites the executed commands
    Evidence: .sisyphus/evidence/f3-manual-qa.log
  ```

- [ ] F4. Scope Fidelity Check — deep

  **What to do**: Run a fresh deep review that checks whether the delivered work matches the selected aggressive-integration scope while respecting the zero-runtime overlay boundary and all explicit deferrals.
  **Must NOT do**: Do not evaluate only technical correctness; verify product-scope correctness too. Do not approve if deferred capabilities slipped in unreviewed.

  **QA Scenario**:
  ```
  Scenario: Scope fidelity is approved
    Tool: Task
    Steps: run `task(category="deep", load_skills=[], run_in_background=false, description="Scope fidelity audit", prompt="Review the completed branch against the adoption/deferral decisions in .sisyphus/plans/omo-opencode-upgrade-integration.md. Return APPROVE or REJECT. Verify that aggressive expansion was implemented only where selected, that deferred capabilities stayed deferred, and that Wunderkind still does not own runtime orchestration, MCP lifecycle, or daemon behavior.")`
    Expected: reviewer returns APPROVE/OKAY with no scope drift
    Evidence: .sisyphus/evidence/f4-scope-fidelity.md
  ```

## Commit Strategy
- Commit 1: `chore(deps): upgrade omo and opencode plugin baselines`
- Commit 2: `test(plugin): lock upstream compatibility assumptions`
- Commit 3: `feat(config): prefer canonical oh-my-openagent naming`
- Commit 4: `feat(doctor): improve omo and capability diagnostics`
- Commit 5: `feat(cli): harden install and upgrade for canonical naming`
- Commit 6+: one atomic commit per capability family (plugin hooks, commands, prompts, docs)
- Final Commit: `chore(release): bump version and changelog for omo/opencode integration wave`

## Success Criteria
- Wunderkind runs correctly against the upgraded oh-my-openagent and OpenCode plugin surfaces.
- Canonical `oh-my-openagent` naming becomes primary without abandoning the repo’s documented transitional compatibility.
- Install, upgrade, and doctor accurately report capability state and migration guidance.
- High-value upstream capabilities are integrated into Wunderkind’s product surfaces without making Wunderkind own runtime orchestration.
- All retained prompts/commands/skills remain coherent, explicit, and test-backed after capability expansion.
- Full regression and release gates pass.
