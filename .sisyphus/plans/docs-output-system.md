# Persistent Documentation Output System

> **Hub plan:** This file is the docs-output plan of record. It defines scope, ordering, guardrails, and final integration checks. Implementation work should happen from the child plans linked below.

## TL;DR

> **Quick Summary**: Add a `docsPath`-based permanent documentation output system to Wunderkind so agents can write durable docs artifacts into a user-configured project docs folder with a maintained index, opt-in during init flows, runtime prompt guidance, and agent-specific output conventions.
>
> **Execution model**:
> - Use this file as the hub
> - Execute the child plans in dependency order
> - Keep final integration verification here
>
> **Child plans**:
> - `docs-output-d1-foundation-and-config.md`
> - `docs-output-d2-installer-surfaces-and-bootstrap.md`
> - `docs-output-d3-runtime-docs-injection.md`
> - `docs-output-d4-agent-prompts-and-docs-surfaces.md`
> - `docs-output-d5-project-init-and-context-aware-doctor.md`

---

## Objective

Give every Wunderkind agent the ability to write permanent, well-structured documentation to a user-configured project docs folder, with a self-maintaining index and opt-in during init flows.

## Why this plan is now split

The original single-file plan mixed four different kinds of work:
- config-path and config-contract foundation
- installer/CLI/TUI surfaces
- runtime prompt injection behavior
- agent prompt/documentation surfaces

Those are related, but they do not need to be executed as one oversized task list. Splitting them reduces same-file edit collisions, makes TDD slices smaller, and makes verification more local and reliable.

## In Scope

- `docsEnabled`, `docsPath`, and `docHistoryMode` config support
- corrected Wunderkind config path references
- installer UI and CLI surfaces for docs-output
- project-init bootstrap for project-local customizations and soul files
- runtime documentation-output prompt injection
- shared docs-config helper and agent-specific static docs-output guidance
- init-side bootstrap of `<docsPath>/README.md`
- context-aware `wunderkind init` and `wunderkind doctor` behavior
- docs-output documentation updates in `README.md` and root `AGENTS.md`

## Key Product Boundaries

- `install` owns plugin registration; `init` owns project-local customizations and soul files.
- `init` does **not** add or update the local `opencode.json` plugin entry for the current project.
- Docs-output settings (`docsEnabled`, `docsPath`, `docHistoryMode`) are project-init customizations, not base-install questions.
- Project-local personality choices are collected only in init paths.
- No forced version bump is assumed as part of the D1-D5 docs-output solution.
- `/docs-index` remains prompt text only; no CLI subcommand is introduced here.

## Frozen Cross-Plan Contracts

### Config semantics

- D1 is authoritative for docs-output field names, requiredness, defaults, and config precedence rules.
- D1 must freeze the config merge rule as: project-local `.wunderkind/wunderkind.config.jsonc` overrides global `~/.wunderkind/wunderkind.config.jsonc` field-by-field when both exist; if no project-local config exists, runtime and CLI readers fall back to the global config; if neither exists, consumers use the D1 defaults.
- D2 owns the reusable init-side docs-output validation, path normalization, config mapping, and bootstrap helper contract.
- D5 must consume D2's helper contract rather than re-implementing docs-output validation or bootstrap rules.
- D4's `docs-config.ts` is a prompt-surface helper only; it is not the CLI/config validation helper.
- `docsPath` is stored as config data exactly as chosen by the user, but any filesystem/bootstrap operation must use the normalized form defined by D2.

### Path and bootstrap semantics

- `docsPath` is a project-local setting interpreted relative to the current project folder by default.
- Absolute paths are out of scope for this initial plan and must be rejected by validation.
- Parent-directory traversal via values like `../docs` is out of scope for this initial plan and must be rejected by validation.
- Bootstrap target is always `<normalized docsPath>/README.md`, never a hardcoded `docs/README.md` unless `docsPath` happens to be `./docs`.

### Init and doctor contract

- `install` owns plugin registration and never mutates project soul files unless the user explicitly enters an init path.
- `init` is current-folder bootstrap only and never mutates local `opencode.json`.
- Docs-output and project-local personality prompts appear only in init flows.
- `doctor` always shows install info and adds project info/checks only when the current working directory qualifies as project context under D5.

### Verification standard

- QA blocks in D2, D3, and D5 must use executable `Setup` / `Run` / `Assert` / `Evidence` steps.
- No bare “verify …” wording is acceptable in executable QA scenarios.
- Final integration checks in the hub are summary gates only; proof lives in the executable child-plan QA scenarios.

## Child Plan Index

### 1) Foundation and Config
**Plan**: `.sisyphus/plans/docs-output-d1-foundation-and-config.md`

Owns:
- config-path bug fix
- docs config types/defaults
- shared `readWunderkindConfig()` reader

Primary files:
- `src/index.ts`
- `src/agents/*.ts`
- `src/cli/types.ts`
- `src/cli/config-manager/index.ts`

### 2) Installer Surfaces and Bootstrap
**Plan**: `.sisyphus/plans/docs-output-d2-installer-surfaces-and-bootstrap.md`

Owns:
- docs-output customization validation and mapping used by init
- docs-output prompts inside init paths
- docs-dir/bootstrap during init
- the single reusable helper contract for docs-output validation, normalization, config mapping, and bootstrap that D5 must consume

Primary files:
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- likely shared init/bootstrap helper module consumed by D5

### 3) Runtime Docs Injection
**Plan**: `.sisyphus/plans/docs-output-d3-runtime-docs-injection.md`

Owns:
- runtime prompt injection in `src/index.ts`
- idempotency guard
- docs-injection tests

Primary files:
- `src/index.ts`
- `tests/unit/docs-injection.test.ts`

### 4) Agent Prompts and Docs Surfaces
**Plan**: `.sisyphus/plans/docs-output-d4-agent-prompts-and-docs-surfaces.md`

Owns:
- `docs-config.ts` helper + tests
- agent tool-restriction audit and static docs-output sections
- generated prompt rebuild checks
- docs-output documentation in `README.md` and root `AGENTS.md`

Primary files:
- `src/agents/docs-config.ts`
- `src/agents/*.ts`
- `tests/unit/docs-config.test.ts`
- `tests/unit/agent-factories.test.ts`
- `README.md`
- `AGENTS.md`

### 5) Project Init and Context-Aware Doctor
**Plan**: `.sisyphus/plans/docs-output-d5-project-init-and-context-aware-doctor.md`

Owns:
- project-context detection
- install-to-init routing when interactive install runs inside a project
- CLI-based `wunderkind init`
- project-local personality/docs-output customizations and soul files
- context-aware `wunderkind doctor`

Primary files:
- `src/cli/index.ts`
- likely new `src/cli/init.ts` and `src/cli/doctor.ts`
- `src/cli/tui-installer.ts`
- `src/cli/cli-installer.ts`
- `src/cli/config-manager/index.ts`
- related CLI/unit tests

## Dependency Order

```text
D1 → { D2, D3 } → D5 → D4
```

Notes:
- D1 is the hard prerequisite layer.
- D2 and D3 can proceed after D1.
- D5 depends on D2 because docs-output settings and bootstrap behavior are now owned by init flows.
- D5 also consumes D1's config contract and corrected config paths.
- D4 depends on D3 because the static heading contract must remain compatible with the runtime injection sentinel:
  - runtime section: `## Documentation Output`
  - static agent section: `## Documentation Output (Static Reference)`
- D4 also depends on D5 because README/root AGENTS should document the final `install` vs `init` vs `doctor` behavior, not an earlier partial model.

## Crosswalk from Original Mega-Plan

| Original Task | New Home | Notes |
|---|---|---|
| 1 | D1 | config-path correction |
| 2 | D1 | docs config types |
| 3 | D1 | config-manager defaults + shared reader |
| 4 | D5 | `init` command surface for current-folder docs/project bootstrap |
| 5 | D2 | interactive docs-output prompts inside init paths |
| 6 | D4 | `docs-config.ts` helper + tests |
| 7 | D3 | runtime docs injection |
| 8 | D4 | agent prompt/static docs-output sections |
| 9 | D2 | docs-dir/bootstrap during init |
| 10 | D4 (docs-only subset) | docs-output docs surfaces only; no version-bump work |
| 11 | D5 | personality customisation moved behind init |
| 12 | D5 (narrowed) | install/project context detection for init + doctor; explicit configVersion versioning is not required unless implementation proves necessary |
| 13 | D5 | context-aware `doctor` command |
| F1-F3 | hub | reduced to final integration checks here |

## Shared Guardrails

- No new npm dependencies.
- No `/docs-index` CLI subcommand; it remains prompt text only.
- No root `README.md` auto-update by agents; project `AGENTS.md` only.
- No gitignore changes for `docs/`.
- No pre-creation of per-agent sub-folders by installer.
- No config migration logic for old configs as part of core docs-output.
- No `as any`, `@ts-ignore`, or `@ts-expect-error`.
- No direct edits to `agents/*.md`; regenerate from source.
- No version-bump work inside the active docs-output child plans.
- `init` must not mutate local `opencode.json`; install remains responsible for plugin registration.
- Project-local personality and docs-output prompts must not appear in base-install flows unless the user explicitly enters init.
- Any reference to docs-output docs surfaces should target `README.md` and root `AGENTS.md` only.

## Atomic Commit Strategy

Plan-freeze edits in this document set are prerequisite documentation work for D2/D5 execution. Preserve the child-plan implementation commit boundaries below after the plan contract is frozen.

- **D1-A**: config-path fix only
- **D1-B**: docs config fields + shared reader
- **D2-A**: CLI flag plumbing + validation
- **D2-B**: TUI prompts + installer bootstrap
- **D3-A**: runtime docs injection + tests
- **D4-A**: `docs-config.ts` + tests
- **D4-B**: agent static docs-output sections + factory assertions + generated rebuild
- **D4-C**: docs-output docs surfaces in `README.md` and root `AGENTS.md`
- **D5-A**: project-context detection and install-to-init routing
- **D5-B**: CLI-based `wunderkind init` for current-folder bootstrap
- **D5-C**: init-only personality/docs-output customizations and soul files
- **D5-D**: context-aware `wunderkind doctor`
- **D5-E**: install/init/doctor integration coverage

## Final Integration Checks

Run these only after D1-D5 are complete:

- [x] `tsc --noEmit` exits 0
- [x] `bun test` exits 0
- [x] `bun run build` exits 0
- [x] `node bin/wunderkind.js init --help` documents current-folder bootstrap clearly
- [x] interactive install inside a project asks once whether to init the current folder
- [x] declining init skips project-local personality and docs-output customization prompts
- [x] standalone `wunderkind init` writes project-local customizations and soul files in the current folder
- [x] eligible generated `agents/*.md` files contain docs-output guidance
- [x] init creates `<docsPath>/README.md` only when docs output is enabled
- [x] `wunderkind doctor` outside a project reports install info only
- [x] `wunderkind doctor` inside a project reports install info plus project info/checks
- [x] root `README.md` and root `AGENTS.md` describe docs-output behavior coherently

## Success Criteria

- Docs-output work can be executed from smaller child plans instead of one mega-plan.
- The child plans have clear file ownership and dependency order.
- Project bootstrap (`init`) and project-aware diagnostics (`doctor`) are part of the active plan, not side-work.
- Base install remains separate from project init, and `init` provisions project-local customizations without mutating local plugin wiring.
- Final integration checks remain centralized here so the feature still has one completion gate.
