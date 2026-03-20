# Google Stitch MCP + DESIGN.md Integration

## TL;DR
> **Summary**: Add project-scoped Google Stitch support to Wunderkind by extending `init` and diagnostics, registering a remote MCP server through an adapter-oriented helper, and making a strict root-level `DESIGN.md` the canonical design artifact for both greenfield and existing-app workflows.
> **Deliverables**:
> - Project-local Stitch adapter config and secret-safe MCP registration
> - Strict six-section `DESIGN.md` scaffold plus validation helpers
> - `/design-md` command for greenfield and existing-app capture flows
> - Read-only doctor output for Stitch readiness and configuration state
> - TDD-backed unit coverage and evidence-driven QA
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 -> 2 -> 4 -> 5 -> 7

## Context
### Original Request
Plan support for Google Stitch MCP server install and configuration, including creating a new `DESIGN.md` through Q&A plus Stitch-assisted generation, handling existing applications by making brand assets available to Stitch, and shaping the work toward future bi-directional integration. Favor a single auth mechanism, prefer API key over OAuth, support a reuse-existing-installed path, and make the architecture adapter-oriented so future MCP servers can reuse the same pattern.

### Interview Summary
- V1 uses `init`, not `install`, as the activation surface for Stitch setup.
- V1 favors API-key authentication over OAuth.
- TDD is required for implementation work.
- Wunderkind enforces a stricter `DESIGN.md` contract than Stitch minimally requires: all 6 canonical sections always present in fixed order.
- The plan must include Momus-grade QA expectations now, especially explicit agent-executed verification and evidence files.
- The implementation must support two paths: reuse an already-working Stitch MCP setup, or register a project-local Stitch MCP entry with secret-safe API-key handling.
- The implementation must establish a reusable adapter pattern rather than a Stitch-only one-off.

### Metis Review (gaps addressed)
- Lock down the exact OpenCode MCP JSON shape instead of leaving merge semantics implicit.
- Keep secrets out of `.wunderkind/wunderkind.config.jsonc`; use OpenCode-supported variable/file substitution instead.
- Do not promise arbitrary live two-way sync; define v1 around artifact-driven iteration with `DESIGN.md` as source of truth.
- Make existing-MCP detection explicit across both project and global OpenCode configs.
- Add explicit QA for masked secret input, idempotent config merges, and partially configured projects.

## Work Objectives
### Core Objective
Add a project-scoped, adapter-oriented Google Stitch integration to Wunderkind that can bootstrap and validate a strict root-level `DESIGN.md`, register or reuse a Stitch MCP server safely, and support both new-design and existing-app capture workflows without storing secrets in repo-tracked config.

### Deliverables
- Project config support for design workflow selection and canonical `DESIGN.md` path.
- Adapter registry and helper layer for remote MCP server detection, project-local merge, and secret-file references.
- `init` UX for Stitch enablement, reuse-existing detection, project-local registration, and masked API-key entry.
- Read-only `doctor` reporting for Stitch readiness in both normal and verbose modes.
- Upgrade and uninstall lifecycle handling for managed versus reused Stitch MCP ownership.
- Strict `DESIGN.md` scaffold/validator helpers using Stitch’s official section order.
- `/design-md` native command asset for greenfield Q&A and existing-app capture flows.
- Updated maintainer-facing CLI/help/docs coverage for the new design workflow.

### Definition of Done (verifiable conditions with commands)
- `tsc --noEmit` passes after all new config/type/CLI changes.
- `bun test tests/unit/stitch-adapter.test.ts tests/unit/mcp-helpers.test.ts tests/unit/config-template.test.ts tests/unit/cli-installer.test.ts tests/unit/init-nontui.test.ts tests/unit/init-interactive.test.ts tests/unit/init-doctor.test.ts tests/unit/uninstall.test.ts tests/unit/cli-help-text.test.ts tests/unit/manifest-sync.test.ts` passes.
- A fixture-backed init run can produce project-local OpenCode MCP config containing a Stitch remote server entry with `oauth: false` and a file-based Authorization header reference.
- A fixture-backed init run can either reuse an existing Stitch MCP entry or create a new project-local one without duplicating unrelated OpenCode config.
- A fixture-backed command/test path can bootstrap a strict root-level `DESIGN.md` and validate its section order.
- `node bin/wunderkind.js init --help` exposes the new design/Stitch flags and descriptions.

### Must Have
- Project-scoped support only; no global Stitch auto-registration in v1.
- API-key-first auth path only; OAuth is explicitly deferred.
- Secret-safe storage via `.wunderkind/stitch/google-stitch-api-key` and OpenCode header substitution, with adapter-owned fallback to `{env:GOOGLE_STITCH_API_KEY}` if file substitution proves unsupported.
- Canonical root-level `DESIGN.md` at `./DESIGN.md` by default.
- Reusable adapter metadata for future MCP servers.
- Persisted MCP ownership tracking so doctor, upgrade, and uninstall can distinguish `wunderkind-managed`, `reused-project`, and `reused-global` states.
- Existing-app capture flow that creates a durable, gitignored asset/context companion file for Stitch-assisted iteration.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT write raw API keys into `opencode.json`, `opencode.jsonc`, shell-history-oriented flags, or `.wunderkind/wunderkind.config.jsonc`.
- Must NOT add OAuth setup, token refresh, `gcloud` automation, or `opencode mcp auth` orchestration in v1.
- Must NOT promise full canvas-state round-tripping, conflict resolution, or arbitrary two-way sync semantics not confirmed by Stitch docs.
- Must NOT overload `wunderkind install` with design workflow state.
- Must NOT invent a loose `DESIGN.md` format; use the Stitch canonical order and a stricter compatible subset.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: TDD with Bun unit tests plus targeted CLI evidence commands
- TDD enforcement: Tasks 1-6 must capture one red-phase evidence artifact before implementation and one green-phase artifact after implementation. Use the naming convention `.sisyphus/evidence/task-{N}-{slug}-red.txt` for red-phase failures and keep the existing non-`-red` filenames for green-phase confirmation.
- QA policy: Every task includes happy-path and failure-path scenarios with explicit evidence files
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation contracts and adapter plumbing (Task 1 starts; Tasks 2-3 fan out after Task 1 completes)
Wave 2: init/doctor integration and artifact helpers (Tasks 4-6)
Wave 3: command workflow, docs/help, and integration hardening (Tasks 7-8)

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 3, 4, 5, 6, 7, 8 |
| 2 | 1 | 4, 5 |
| 3 | 1 | 4, 8 |
| 4 | 1, 2, 3 | 5, 8 |
| 5 | 1, 2, 4 | 7, 8 |
| 6 | 1 | 7, 8 |
| 7 | 4, 5, 6 | 8 |
| 8 | 3, 4, 5, 6, 7 | Final Verification |

### Agent Dispatch Summary
- Wave 1 -> 3 tasks -> `unspecified-high`, `quick`
- Wave 2 -> 3 tasks -> `unspecified-high`, `writing`
- Wave 3 -> 2 tasks -> `writing`, `unspecified-high`
- Final Verification -> 4 tasks -> `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.
> Field placement is locked: `designTool`, `designPath`, and `designMcpOwnership` are persisted `ProjectConfig`/`DetectedConfig` fields; `stitchSetup`, `stitchApiKeyFile`, and uninstall-time cleanup choices are `InitOptions`/CLI-only inputs and are never written to Wunderkind config.

- [x] 1. Add design-workflow config contract and adapter registry

  **What to do**: Extend project-level config types/defaults/schema to resolve `designTool`, `designPath`, and `designMcpOwnership` with defaults of `"none"`, `"./DESIGN.md"`, and `"none"`, while introducing a new adapter registry module at `src/cli/mcp-adapters.ts` that defines the first reusable MCP adapter entry for Google Stitch. `designTool`, `designPath`, and `designMcpOwnership` must be added to `ProjectConfig`, `InstallConfig`, and `DetectedConfig`; `stitchSetup` and `stitchApiKeyFile` remain ephemeral init-only inputs. `designMcpOwnership` must allow exactly `none | wunderkind-managed | reused-project | reused-global`. Export the adapter constant as `GOOGLE_STITCH_ADAPTER`, and store the canonical DESIGN headings on `GOOGLE_STITCH_ADAPTER.designSections`. The adapter entry must pin the exact server identifier `google-stitch`, remote URL `https://stitch.googleapis.com/mcp`, auth mode `api-key-file`, secret file path `.wunderkind/stitch/google-stitch-api-key`, fallback env var `GOOGLE_STITCH_API_KEY`, verification command `curl -s -o /dev/null -w "%{http_code}" https://stitch.googleapis.com/mcp`, canonical DESIGN section list as adapter-owned data, and OpenCode remote MCP JSON shape:

  ```json
  {
    "mcp": {
      "google-stitch": {
        "type": "remote",
        "url": "https://stitch.googleapis.com/mcp",
        "enabled": true,
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {file:.wunderkind/stitch/google-stitch-api-key}"
        }
      }
    }
  }
  ```

  Newly written project configs must include `designTool`, `designPath`, and `designMcpOwnership`; existing configs must remain readable when those keys are absent. The adapter registry must also expose a fallback header template of `Bearer {env:GOOGLE_STITCH_API_KEY}` so the implementation can switch in one place if upstream behavior proves `{file:...}` is unsupported inside MCP headers.
  **Must NOT do**: Do not add global Stitch config; do not store API keys in Wunderkind config; do not define a second auth path.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: touches types, schema, defaults, and a new reusable adapter contract
  - Skills: `[]` — no repo-specific skill exists
  - Omitted: `['writing']` — implementation detail work outweighs prose needs

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 4, 5, 6, 7, 8 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/types.ts:1` — current config/type definitions for project settings
  - Pattern: `src/cli/config-manager/index.ts:73` — default install/project config values and merge defaults
  - Pattern: `src/cli/config-manager/index.ts:531` — project config renderer that must be extended carefully
  - Pattern: `src/cli/config-manager/index.ts:647` — effective config merge path used by doctor/init
  - Pattern: `schemas/wunderkind.config.schema.json:22` — strict project-config schema; new keys must be added without breaking legacy configs
  - Test: `tests/unit/stitch-adapter.test.ts` — new adapter-registry test file to add in this task
  - External: `https://opencode.ai/docs/config/` — config precedence and `{file:...}` substitution
  - External: `https://opencode.ai/docs/mcp-servers/` — exact remote MCP JSON shape and `oauth: false` pattern for API-key servers
  - External: `https://stitch.withgoogle.com/docs/mcp/setup/` — Stitch remote MCP setup guidance

  **Acceptance Criteria** (agent-executable only):
  - [ ] `DetectedConfig` resolves `designTool`, `designPath`, and `designMcpOwnership` defaults even when project config omits them
  - [ ] Project config schema accepts new keys and remains backward-compatible with configs that do not contain them
  - [ ] A reusable adapter definition exists for `google-stitch` with the exact pinned endpoint, server name, secret file path, fallback env var, DESIGN section list, verification command, and OpenCode MCP payload
  - [ ] No code path writes raw API key material into Wunderkind config files

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Red phase for config and adapter contract
    Tool: Bash
    Steps: 1. Write targeted failing tests first, then run: bun test tests/unit/config-template.test.ts tests/unit/stitch-adapter.test.ts
    Expected: Non-zero exit code proving the new design config fields or adapter constants are not yet implemented
    Evidence: .sisyphus/evidence/task-1-config-defaults-red.txt

  Scenario: Backward-compatible config resolution
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/config-template.test.ts tests/unit/stitch-adapter.test.ts
    Expected: Exit code 0 and targeted tests prove missing design keys resolve to defaults and the adapter exports the canonical constants
    Evidence: .sisyphus/evidence/task-1-config-defaults.txt

  Scenario: Schema rejects invalid designTool values
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/config-template.test.ts tests/unit/stitch-adapter.test.ts
    Expected: Exit code 0 and targeted tests prove unsupported designTool values fail coercion/schema validation
    Evidence: .sisyphus/evidence/task-1-config-invalid.txt
  ```

  **Commit**: YES | Message: `feat(cli): add design config and stitch adapter contract` | Files: `src/cli/types.ts`, `src/cli/config-manager/index.ts`, `schemas/wunderkind.config.schema.json`, new adapter helper module, `tests/unit/stitch-adapter.test.ts`, tests

- [x] 2. Add generic OpenCode MCP merge, detection, and secret-file helpers

  **What to do**: Add helper(s) that read existing global and project OpenCode config, detect whether Stitch is already configured by server name or remote URL match, and idempotently merge a project-local MCP entry without disturbing unrelated config. Add secret-file helpers that create `.wunderkind/stitch/` and write the API key into `.wunderkind/stitch/google-stitch-api-key` with trimmed contents only when the user explicitly provides a key. Put the helper tests in a dedicated `tests/unit/mcp-helpers.test.ts` file rather than burying them inside `tests/unit/cli-installer.test.ts`. All merged OpenCode config must include `$schema: "https://opencode.ai/config.json"` when creating a new file from scratch, and must retroactively add that schema key when merging into an existing file that lacks it. Existing project/global config detection must produce one of four explicit statuses: `missing`, `project-local`, `global-only`, `both`. Adapter drift is defined exactly as: `url` after trimming one trailing slash differs from adapter `url`, or `oauth === true`; missing `oauth` is treated as equivalent to `false`. The MCP merge helper, not `addPluginToOpenCodeConfig()`, owns `$schema` injection for any file it creates or touches because Stitch MCP setup only mutates project `opencode.json` during `init`, while `addPluginToOpenCodeConfig()` belongs to the separate install-time plugin path.
  **Must NOT do**: Do not overwrite unrelated `mcp`, `plugin`, `agent`, or `tools` config; do not write secrets into shell-command arrays or raw headers; do not mutate global config in v1.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: merge safety and secret handling are high-risk infrastructure work
  - Skills: `[]` — no specialized helper skill available
  - Omitted: `['quick']` — too much config-merge edge-case complexity

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/config-manager/index.ts:126` — config path resolution for global vs project OpenCode files
  - Pattern: `src/cli/config-manager/index.ts:151` — JSON/JSONC parse helper behavior
  - Pattern: `src/cli/config-manager/index.ts:706` — current idempotent plugin merge approach to mirror for MCP entries
  - Pattern: `src/cli/docs-output-helper.ts:10` — path validation helper style for project-local outputs
  - Test: `tests/unit/cli-installer.test.ts:53` — mock.module pattern for config-manager tests
  - Test: `tests/unit/mcp-helpers.test.ts` — dedicated helper test file to add in this task
  - External: `https://opencode.ai/docs/mcp-servers/` — remote MCP entry structure and `oauth: false`
  - External: `https://opencode.ai/docs/config/` — config merge precedence and file substitution behavior

  **Acceptance Criteria** (agent-executable only):
  - [ ] A helper can classify existing Stitch MCP presence across project/global OpenCode config as `missing`, `project-local`, `global-only`, or `both`
  - [ ] A helper can idempotently merge the canonical `google-stitch` project-local MCP entry without changing unrelated keys
  - [ ] Secret-file helper writes only the trimmed API key to `.wunderkind/stitch/google-stitch-api-key`
  - [ ] Freshly created or schema-less `opencode.json` includes the OpenCode schema URL and the canonical Stitch MCP block
  - [ ] The helper can switch to the adapter-owned env-header fallback if `{file:...}` substitution is proven unsupported for MCP headers during implementation verification

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Red phase for MCP helper behavior
    Tool: Bash
    Steps: 1. Write targeted failing tests first, then run: bun test tests/unit/mcp-helpers.test.ts
    Expected: Non-zero exit code proving MCP merge/detection helpers are not yet implemented or drift semantics are missing
    Evidence: .sisyphus/evidence/task-2-mcp-merge-red.txt

  Scenario: MCP merge preserves unrelated config
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/mcp-helpers.test.ts
    Expected: Exit code 0 and targeted tests prove unrelated plugin/agent/tools keys survive MCP merge unchanged
    Evidence: .sisyphus/evidence/task-2-mcp-merge.txt

  Scenario: Secret helper never writes raw key into opencode config
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/mcp-helpers.test.ts
    Expected: Exit code 0 and targeted tests prove the config contains `{file:.wunderkind/stitch/google-stitch-api-key}` rather than the secret value
    Evidence: .sisyphus/evidence/task-2-secret-safety.txt

  Scenario: oauth-absent Stitch entry is treated as non-drifted
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/mcp-helpers.test.ts
    Expected: Exit code 0 and targeted tests prove an existing Stitch MCP entry that omits `oauth` is classified as equivalent to `oauth: false` rather than drifted
    Evidence: .sisyphus/evidence/task-2-oauth-absent.txt
  ```

  **Commit**: YES | Message: `feat(cli): add generic mcp config merge helpers` | Files: `src/cli/config-manager/index.ts`, new MCP helper module, `tests/unit/mcp-helpers.test.ts`

- [x] 3. Extend init CLI flags and help text for design workflow activation

  **What to do**: Extend `wunderkind init` CLI parsing and help text to support design workflow activation without touching base install. Add explicit flags for `--design-tool <none|google-stitch>`, `--design-path <path>`, `--stitch-setup <reuse|project-local|skip>`, and `--stitch-api-key-file <path>` for non-TUI operation. Do not add a raw `--stitch-api-key` flag because it would leak to shell history. Keep defaults fixed as `design-tool=none`, `design-path=./DESIGN.md`, and no Stitch config mutation unless the user opts in.
  **Must NOT do**: Do not add Stitch options to `install`; do not accept insecure plaintext secret flags; do not make design workflow required during init.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: localized CLI surface and help-text changes once contracts exist
  - Skills: `[]` — no skill needed
  - Omitted: `['unspecified-high']` — logic is constrained once Task 1 is complete

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/index.ts:193` — current `init` command registration
  - Pattern: `src/cli/index.ts:205` — flag parsing style for current docs options
  - Pattern: `README.md` — maintainer-facing CLI docs style and examples
  - Test: `tests/unit/cli-help-text.test.ts` — existing CLI help coverage location; extend this file for Stitch flag parsing and invalid-value rejection tests

  **Acceptance Criteria** (agent-executable only):
  - [ ] `wunderkind init --help` shows the new design/Stitch flags with correct defaults and descriptions
  - [ ] CLI parsing rejects unsupported `--design-tool` and `--stitch-setup` values
  - [ ] No raw API-key flag exists on the command surface

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Red phase for init CLI flags
    Tool: Bash
    Steps: 1. Write targeted failing tests first, then run: bun test tests/unit/cli-help-text.test.ts
    Expected: Non-zero exit code proving the new Stitch init flags or invalid-value rejections are not yet implemented
    Evidence: .sisyphus/evidence/task-3-init-help-red.txt

  Scenario: Init help exposes new design workflow flags
    Tool: Bash
    Steps: 1. Run: node bin/wunderkind.js init --help
    Expected: Exit code 0 and output includes `--design-tool`, `--design-path`, `--stitch-setup`, and `--stitch-api-key-file`
    Evidence: .sisyphus/evidence/task-3-init-help.txt

  Scenario: Invalid Stitch CLI values fail fast
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/cli-help-text.test.ts
    Expected: Exit code 0 and targeted tests prove invalid values are rejected with clear errors
    Evidence: .sisyphus/evidence/task-3-cli-invalid.txt
  ```

  **Commit**: YES | Message: `feat(cli): add init flags for stitch design workflow` | Files: `src/cli/index.ts`, tests

- [x] 4. Implement init-time Stitch activation, reuse detection, and masked secret capture

  **What to do**: Extend `runInit()` so interactive init can optionally enable design workflow, choose `google-stitch`, detect whether Stitch MCP already exists in project/global OpenCode config, and then offer exactly 3 actions in this order: `reuse existing`, `create project-local`, `skip`. Default to `reuse existing` when detection status is `project-local`, `global-only`, or `both`; default to `create project-local` only when status is `missing`. Use `p.password()` from `@clack/prompts` for masked API-key capture. If `reuse existing` is selected for `project-local`, set `designMcpOwnership` to `reused-project`; if selected for `global-only` or `both`, write only `designTool`, `designPath`, and `designMcpOwnership="reused-global"` to Wunderkind project config and do not write a project-local Stitch MCP entry. If `create project-local` is selected, set `designMcpOwnership` to `wunderkind-managed`; prompt for API key with masked input; if provided, write `.wunderkind/stitch/google-stitch-api-key`; if blank, still create the MCP config and leave doctor to warn that the secret file is missing. If Stitch is skipped or design workflow is disabled, persist `designMcpOwnership="none"`. Non-TUI init must support the same behavior via the new flags plus `--stitch-api-key-file`; when that flag is present, explicit intent means overwrite the existing secret file, otherwise preserve any existing secret file. In non-TUI mode, `--stitch-setup=project-local` without `--stitch-api-key-file` is a valid partial setup that creates the MCP config but no secret file, mirroring the blank interactive path. Non-TUI mode never falls back to stdin secret capture. Stitch interactive tests must be added to `tests/unit/init-interactive.test.ts`, not a new test file. Always create or preserve the root `DESIGN.md` path value in project config when design workflow is enabled.
  **Must NOT do**: Do not touch `wunderkind install`; do not overwrite an existing secret file unless the user explicitly re-enters a non-blank key or supplies `--stitch-api-key-file`; do not create duplicate Stitch MCP entries.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: combines interactive flow, config writes, detection logic, and secret-file lifecycle
  - Skills: `[]` — no skill available
  - Omitted: `['writing']` — UX copy matters, but correctness dominates

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5, 7, 8 | Blocked By: 1, 2, 3

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/init.ts:233` — main init orchestration entry point
  - Pattern: `src/cli/init.ts:447` — pre-write validation branch style
  - Pattern: `src/cli/init.ts:460` — project config write then native assets/bootstrap order
  - Pattern: `src/cli/init.ts:484` — soul/bootstrap filesystem pattern
  - Pattern: `src/cli/config-manager/index.ts:497` — read project config for existing state
  - Test: `tests/unit/init-nontui.test.ts:79` — fixture-backed non-TUI init assertions
  - Test: `tests/unit/init-interactive.test.ts:1` — existing interactive prompt test file with `@clack/prompts` mocking already in place
  - External: `https://opencode.ai/docs/mcp-servers/` — project-local remote MCP semantics

  **Acceptance Criteria** (agent-executable only):
  - [ ] Interactive init offers `reuse existing`, `create project-local`, and `skip` with defaults based on detected Stitch presence
  - [ ] Non-TUI init can register project-local Stitch config and optional secret file using safe inputs only
  - [ ] Blank masked API-key entry does not crash init and leaves a warning-ready partial setup
  - [ ] Existing unrelated OpenCode config survives, and Stitch MCP config is not duplicated on repeated init runs
  - [ ] The `global-only` reuse path writes no project-local MCP entry and relies on inherited global config explicitly
  - [ ] `designMcpOwnership` is persisted as `wunderkind-managed`, `reused-project`, `reused-global`, or `none` according to the chosen path

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Red phase for Stitch init flows
    Tool: Bash
    Steps: 1. Write targeted failing tests first, then run: bun test tests/unit/init-nontui.test.ts tests/unit/init-interactive.test.ts
    Expected: Non-zero exit code proving Stitch init prompts, reuse logic, or partial-setup semantics are not yet implemented
    Evidence: .sisyphus/evidence/task-4-init-stitch-red.txt

  Scenario: Non-TUI init creates project-local Stitch MCP config and secret reference
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/init-nontui.test.ts
    Expected: Exit code 0 and targeted tests prove `opencode.json` gets the canonical Stitch MCP block plus `{file:.wunderkind/stitch/google-stitch-api-key}`
    Evidence: .sisyphus/evidence/task-4-init-stitch-nontui.txt

  Scenario: Interactive init reuses existing global Stitch setup without duplicate writes
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/init-interactive.test.ts
    Expected: Exit code 0 and targeted tests prove the reuse path leaves OpenCode config unchanged except for project design settings
    Evidence: .sisyphus/evidence/task-4-init-stitch-reuse.txt
  ```

  **Commit**: YES | Message: `feat(init): add stitch activation and safe api key capture` | Files: `src/cli/init.ts`, `src/cli/index.ts`, config helpers, tests

- [x] 5. Add Stitch diagnostics to doctor output

  **What to do**: Extend `doctor` so project-context output reports design workflow and Stitch readiness without leaking secrets. In verbose mode, print: `design tool`, `design path`, `design MCP ownership`, `DESIGN.md present`, `Stitch MCP detected`, `Stitch config source (project/global/both/missing)`, `Stitch in use`, `project-local secret file present`, and `auth mode: api-key-file`. In non-verbose mode, add one compact `Stitch readiness` line that summarizes enabled/disabled, configured/not configured, and whether the project is using a managed or reused Stitch setup. `Stitch in use` means `designTool === google-stitch` and either a project/global Stitch MCP entry exists or `designMcpOwnership === wunderkind-managed` with a pending partial setup. Warn on exactly these states: design enabled but `DESIGN.md` missing; design enabled and project-local Stitch selected but secret file missing; config contains Stitch MCP entry but URL or `oauth` settings deviate from adapter contract; ownership/config source mismatch.
  **Must NOT do**: Do not print secret contents; do not attempt network auth checks; do not claim OAuth readiness.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: read-only reporting once config helpers exist
  - Skills: `[]` — none needed
  - Omitted: `['unspecified-high']` — bounded diagnostics work

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8 | Blocked By: 1, 2, 4

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/doctor.ts:44` — doctor entry point and section rendering
  - Pattern: `src/cli/doctor.ts:176` — current workflow configuration output pattern
  - Pattern: `src/cli/doctor.ts:190` — project-health warning accumulation style
  - Pattern: `src/cli/config-manager/index.ts:647` — resolved effective config source values
  - Test: `tests/unit/init-doctor.test.ts` — doctor output coverage location

  **Acceptance Criteria** (agent-executable only):
  - [ ] Verbose doctor reports design/Stitch state, ownership, source, and usage without exposing secrets
  - [ ] Non-verbose doctor gives a compact readiness signal covering configured and in-use status
  - [ ] Warning cases cover missing `DESIGN.md`, missing secret file, adapter drift in MCP config, and ownership/source mismatch

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Red phase for doctor readiness reporting
    Tool: Bash
    Steps: 1. Write targeted failing tests first, then run: bun test tests/unit/init-doctor.test.ts
    Expected: Non-zero exit code proving Stitch readiness lines or warnings are not yet implemented
    Evidence: .sisyphus/evidence/task-5-doctor-red.txt

  Scenario: Doctor reports ready Stitch project cleanly
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/init-doctor.test.ts
    Expected: Exit code 0 and targeted tests prove verbose doctor prints Stitch status lines without secret leakage
    Evidence: .sisyphus/evidence/task-5-doctor-ready.txt

  Scenario: Doctor warns on partial Stitch setup
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/init-doctor.test.ts
    Expected: Exit code 0 and targeted tests prove missing `DESIGN.md` or secret file produce clear warnings
    Evidence: .sisyphus/evidence/task-5-doctor-partial.txt
  ```

  **Commit**: YES | Message: `feat(doctor): report stitch readiness safely` | Files: `src/cli/doctor.ts`, config helpers, tests

- [x] 6. Add strict DESIGN.md path, scaffold, and validation helpers

  **What to do**: Create a dedicated helper module for `DESIGN.md` analogous to `docs-output-helper`, but specific to design workflow. Validate `designPath` as project-local and relative, default to `./DESIGN.md`, and always normalize to a root-level-looking project-relative path. The canonical section names and order must come from the adapter registry constant, not hard-coded copies inside the validator, so any upstream naming correction is made in exactly one place. Section matching must use exact string equality against that adapter-owned list with no case-folding or punctuation normalization. Add a scaffold generator that always emits these exact `##` headings in order: `Overview`, `Colors`, `Typography`, `Elevation`, `Components`, `Do's and Don'ts`. The default scaffold must include deterministic placeholders so validators can detect incomplete files. Add a validator that checks exact heading order, forbids duplicate top-level sections, requires color entries for `Primary`, `Secondary`, `Tertiary`, and `Neutral`, and requires at least 2 `Do` bullets plus 2 `Don't` bullets.
  **Must NOT do**: Do not mirror Stitch’s optional omission behavior in v1; do not attempt to parse Stitch’s internal token model; do not place `DESIGN.md` under `.wunderkind/`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: file-contract and validation logic are central to the feature
  - Skills: `[]` — no fit
  - Omitted: `['quick']` — validation specifics need care

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `src/cli/docs-output-helper.ts:10` — path-validation and normalization helper style
  - Pattern: `src/cli/init.ts:499` — bootstrap-on-enable pattern
  - External: `https://stitch.withgoogle.com/docs/design-md/format/?pli=1` — canonical section order and compatible markdown contract
  - External: `https://stitch.withgoogle.com/docs/design-md/overview?pli=1` — DESIGN.md portability intent
  - External: `https://stitch.withgoogle.com/docs/learn/prompting/` — specificity guidance that should shape scaffold placeholders

  **Acceptance Criteria** (agent-executable only):
  - [ ] `designPath` validation rejects absolute paths and parent traversal
  - [ ] Bootstrap helper creates a strict six-section `DESIGN.md` scaffold when absent and preserves an existing file
  - [ ] Validator catches missing headings, wrong order, duplicate sections, and incomplete required bullets
  - [ ] The scaffold remains Stitch-compatible while being stricter than Stitch’s minimum allowed format

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Red phase for strict DESIGN.md helpers
    Tool: Bash
    Steps: 1. Write targeted failing tests first, then run: bun test tests/unit/config-template.test.ts
    Expected: Non-zero exit code proving `DESIGN.md` path validation, scaffold generation, or strict section checks are not yet implemented
    Evidence: .sisyphus/evidence/task-6-design-bootstrap-red.txt

  Scenario: Strict DESIGN.md scaffold bootstraps successfully
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/config-template.test.ts tests/unit/init-nontui.test.ts
    Expected: Exit code 0 and targeted tests prove `DESIGN.md` is created with exact heading order when enabled
    Evidence: .sisyphus/evidence/task-6-design-bootstrap.txt

  Scenario: Invalid DESIGN.md structure is rejected deterministically
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/config-template.test.ts
    Expected: Exit code 0 and targeted tests prove missing or reordered sections fail validation
    Evidence: .sisyphus/evidence/task-6-design-validate.txt
  ```

  **Commit**: YES | Message: `feat(design): add strict design md helpers` | Files: new design helper module, `src/cli/init.ts`, tests

- [x] 7. Ship `/design-md` command for greenfield and existing-app capture workflows

  **What to do**: Add a new native command asset `commands/design-md.md` owned by `creative-director`. The command must treat `DESIGN.md` as the source of truth and support exactly two modes: `new` and `capture-existing`. In `new`, the command asks a constrained Q&A set covering product type, audience, vibe, palette, typography, density, accessibility, and component priorities, then writes or updates `DESIGN.md` in the strict scaffold. In `capture-existing`, the command inspects the current project for existing design signals and writes both `DESIGN.md` and a gitignored companion file `.wunderkind/stitch/source-assets.md` that lists project-relative references for logos, icons, screenshots, CSS/theme sources, and token sources to make those assets available to Stitch-driven prompting. `.wunderkind/stitch/source-assets.md` is already covered by the existing `.wunderkind/` gitignore rule, so no new gitignore entry is needed. The command must instruct the agent to make one major design change at a time when iterating with Stitch.
  **Must NOT do**: Do not call the workflow `/sync`; do not promise canvas-state synchronization; do not write source-assets under the project root outside `.wunderkind/`.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: command asset quality and workflow instructions are prompt-heavy
  - Skills: `[]` — no dedicated skill exists
  - Omitted: `['unspecified-high']` — most complexity is in command contract rather than code branching

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 8 | Blocked By: 4, 5, 6

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `commands/docs-index.md:1` — shipped native command asset format and constraint style
  - Pattern: `tests/unit/docs-index-plan.test.ts:1` — existing unit-test style for command-adjacent plan logic
  - Pattern: `tests/unit/manifest-sync.test.ts` — update this existing test file to cover `commands/design-md.md`
  - External: `https://stitch.withgoogle.com/docs/learn/prompting/` — one-major-change-at-a-time prompting guidance
  - External: `https://stitch.withgoogle.com/docs/design-md/format/?pli=1` — required scaffold order for output file
  - External: `https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/` — product intent for DESIGN.md import/export and iterative design

  **Acceptance Criteria** (agent-executable only):
  - [ ] `/design-md` exists as a shipped command asset with `new` and `capture-existing` modes only
  - [ ] The command contract names `DESIGN.md` as canonical and `.wunderkind/stitch/source-assets.md` as the companion capture file
  - [ ] The command instructs incremental Stitch prompting and explicit asset/path references
  - [ ] Repeated runs update artifacts in place rather than creating drifted duplicates

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Command asset ships with both supported modes
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/manifest-sync.test.ts
    Expected: Exit code 0 and targeted tests prove `commands/design-md.md` exists, is included in packaging coverage, and contains valid frontmatter with `agent: creative-director`
    Evidence: .sisyphus/evidence/task-7-command-ship.txt

  Scenario: Command contract rejects sync-style overclaiming
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/manifest-sync.test.ts
    Expected: Exit code 0 and targeted assertions prove `commands/design-md.md` avoids `/sync` and full synchronization claims while preserving artifact-driven wording
    Evidence: .sisyphus/evidence/task-7-command-guardrails.txt

  Scenario: Capture-existing contract writes source-assets companion under .wunderkind
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/manifest-sync.test.ts
    Expected: Exit code 0 and targeted assertions prove the command contract writes `.wunderkind/stitch/source-assets.md` and never a project-root `source-assets.md`
    Evidence: .sisyphus/evidence/task-7-source-assets-path.txt
  ```

  **Commit**: YES | Message: `feat(commands): add design md stitch workflow command` | Files: `commands/design-md.md`, tests

- [ ] 8. Extend upgrade, uninstall, docs, and end-to-end lifecycle coverage

  **What to do**: Update maintainer-facing docs and lifecycle commands so the new feature is discoverable and stable across upgrade and uninstall. Extend `runCliUpgrade()` so project-scope upgrades preserve `reused-project` and `reused-global` Stitch MCP entries unchanged, but reconcile `wunderkind-managed` project-local Stitch entries back to the current adapter contract without re-prompting for credentials or overwriting the secret file contents. Extend `runUninstall()` and CLI help text with an explicit `--remove-mcp <ask|yes|no>` option. In TTY mode, uninstall must ask before removing any Stitch MCP config; recommended default is `yes` for `wunderkind-managed`, `no` for `reused-project`, and no prompt for `reused-global` because global reused config must remain untouched. In non-TTY mode, default `--remove-mcp` behavior is `no` unless the user explicitly passes `yes`. When removal is approved for `wunderkind-managed`, remove only the project-local `google-stitch` MCP entry and `.wunderkind/stitch/google-stitch-api-key`; when removal is approved for `reused-project`, remove only the project-local `google-stitch` MCP entry and preserve any unrelated MCP config. `reused-global` always preserves the inherited global Stitch entry. Also extend README/init/uninstall help examples for Stitch activation and DESIGN.md workflows, ensure packaged command/native asset copy logic includes `design-md`, and add end-to-end regression tests covering: fresh project-local Stitch setup, reuse-existing detection, partial setup warnings, strict `DESIGN.md` bootstrap, upgrade reconciliation for managed entries, uninstall prompts/cleanup decisions, and repeated init idempotency. Add one explicit regression proving that a project with design workflow disabled remains unchanged. Extend the existing native-command packaging coverage so it proves `commands/design-md.md` is written alongside `docs-index` rather than relying only on typecheck success.
  **Must NOT do**: Do not add marketing copy about unsupported live bi-directional sync; do not silently change unrelated docs examples; do not remove reused global Stitch config during uninstall.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: integration hardening spans docs, packaging, and regression coverage
  - Skills: `[]` — none available
  - Omitted: `['quick']` — this is multi-surface integration work

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification | Blocked By: 3, 4, 5, 6, 7

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `README.md` — user-facing command docs and config reference
  - Pattern: `package.json:17` — packaged files include `commands/` and schema artifacts
  - Pattern: `src/cli/cli-installer.ts:211` — current upgrade flow to extend for managed-vs-reused Stitch behavior
  - Pattern: `src/cli/init.ts:472` — native command writer invoked during init
  - Pattern: `src/cli/uninstall.ts:25` — current uninstall flow and safety-note behavior
  - Pattern: `tests/unit/init-nontui.test.ts:79` — fixture-based integration coverage
  - Pattern: `tests/unit/uninstall.test.ts:55` — uninstall test harness and scope-preservation expectations
  - Pattern: `.github/workflows/publish.yml:24` — CI currently builds only, so local regression tests matter
  - External: `https://opencode.ai/docs/mcp-servers/` — authoritative MCP config examples for user-facing docs

  **Acceptance Criteria** (agent-executable only):
  - [ ] README and init help include Stitch activation and DESIGN.md usage examples consistent with implemented flags
  - [ ] Upgrade preserves reused Stitch config and reconciles only `wunderkind-managed` project-local entries
  - [ ] Uninstall asks about MCP cleanup in TTY mode and preserves reused global Stitch config by default
  - [ ] Regression coverage exercises fresh setup, reuse path, partial setup, strict scaffold bootstrap, upgrade lifecycle, uninstall lifecycle, and no-op disabled mode
  - [ ] Native command packaging includes `design-md` without regressing `docs-index`
  - [ ] `tsc --noEmit` and the targeted Bun suites pass together

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: End-to-end targeted regression suite passes
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/stitch-adapter.test.ts tests/unit/mcp-helpers.test.ts tests/unit/config-template.test.ts tests/unit/cli-installer.test.ts tests/unit/init-nontui.test.ts tests/unit/init-interactive.test.ts tests/unit/init-doctor.test.ts tests/unit/uninstall.test.ts tests/unit/cli-help-text.test.ts tests/unit/manifest-sync.test.ts
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-8-regression.txt

  Scenario: Upgrade and uninstall honor Stitch ownership lifecycle
    Tool: Bash
    Steps: 1. Run: bun test tests/unit/cli-installer.test.ts tests/unit/uninstall.test.ts
    Expected: Exit code 0 and targeted tests prove upgrades only reconcile `wunderkind-managed` entries while uninstall prompts or preserves config according to ownership and `--remove-mcp`
    Evidence: .sisyphus/evidence/task-8-lifecycle.txt

  Scenario: TypeScript passes after all integration changes
    Tool: Bash
    Steps: 1. Run: tsc --noEmit
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-8-tsc.txt
  ```

  **Commit**: YES | Message: `feat(stitch): harden lifecycle docs upgrade and uninstall flows` | Files: `README.md`, `src/cli/cli-installer.ts`, `src/cli/uninstall.ts`, `src/cli/index.ts`, tests, command packaging surfaces

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Success Criteria
- Wunderkind can opt a project into Google Stitch support through `init` without changing base install semantics.
- Project-local OpenCode config can safely reference a Stitch API key via `.wunderkind/stitch/google-stitch-api-key` and never stores the raw secret inline.
- A strict root-level `DESIGN.md` can be bootstrapped, validated, and used as the canonical artifact for new and existing-app workflows.
- Existing Stitch MCP config can be detected and reused deterministically.
- The architecture for Stitch is adapter-oriented so a second MCP server can follow the same pattern with a new adapter entry instead of new bespoke plumbing.
- QA evidence proves config safety, idempotency, partial-state warnings, strict artifact contract enforcement, and targeted regression coverage.
