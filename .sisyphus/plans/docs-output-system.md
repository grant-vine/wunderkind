# docs-output-system — SUPERSEDED

> **STATUS: SUPERSEDED** — This plan has been decomposed into workstreams. 
> Execute from the master plan: `.sisyphus/plans/openagent-migration-and-plan-restructure.md`

## Original Objective
Give every wunderkind agent the ability to write permanent, well-structured documentation to a user-configured `docs/` folder, with a self-maintaining index, opt-in at install time. This involves adding `docsEnabled`, `docsPath`, and `docHistoryMode` configuration fields, implementing runtime system-prompt injection, and updating agent factories with Documentation Output instructions.

## Why Decomposed
The original plan grew to 2,100+ lines with 38 TODOs mixing config path bugs, new feature work, personality gates, a doctor command, and agent prompt updates. This complexity across multiple domains (CLI, agents, runtime, installer) made it too large and cross-cutting to execute safely as a single plan.

## Child Workstreams
- **D1** — config-path correction + shared config reader
- **D2** — docs config schema + CLI/TUI prompts  
- **D3** — runtime docs injection + helper/test work
- **D4** — agent prompt docs-output sections + installer docs dir creation

## Deferred Items
Non-core items moved to the master plan for later execution: TUI personality gate, configVersion/upgrade detection, wunderkind doctor command, and version housekeeping (v0.6.0 bump).

## Cancelled Items
Initial and final verification tasks (tsc/bun test/build) have been cancelled as they are superseded by the verification steps in the child workstreams and final master plan verification.

## Execution Guardrails

1. Same-file edits within a workstream must be serialized (no concurrent edits to the same file).
2. Generated files (`agents/*.md`) must come from `bun run build` — never hand-edit them.
3. Unrelated items (doctor command, configVersion, personality gate, version housekeeping) are NOT blockers for docs output workstreams D1-D4.
4. Execution of docs-output work must NOT happen from this file — use the master plan (`.sisyphus/plans/openagent-migration-and-plan-restructure.md`) workstreams instead.

## TODO-to-Workstream Crosswalk

| Task # | Short Name | Bucket | Rationale |
|---|---|---|---|
| 79 | tsc clean (initial) | CANCELLED | Superseded by final verification tasks |
| 80 | bun test (initial) | CANCELLED | Superseded by final verification tasks |
| 81 | bun run build (initial) | CANCELLED | Superseded by final verification tasks |
| 82 | Non-interactive JSONC | D2 | Part of CLI/TUI docs output configuration |
| 83 | Default docsEnabled: false | D2 | Part of CLI/TUI docs output configuration |
| 84 | CLI --help docs flags | D2 | Part of CLI/TUI docs output configuration |
| 85 | Agent Documentation Output section | D4 | Agent prompt update task |
| 1 | Fix config path bug | D1 | config-path correction + shared reader |
| 2 | Add docs fields to types | D2 | docs config schema + CLI/TUI prompts |
| 3 | config-manager docs fields + reader | D1 | Shared config reader part of D1 |
| 4 | Add CLI docs flags | D2 | docs config schema + CLI/TUI prompts |
| 5 | TUI docs prompts | D2 | docs config schema + CLI/TUI prompts |
| 6 | TDD docs-config.ts | D3 | Runtime injection helper/test work |
| 7 | TDD inject docs config index | D3 | Runtime docs injection mechanism |
| 8 | Agent audit + sections | D4 | Updating agent *.ts files with docs sections |
| 9 | Installer pre-creates docs/ | D4 | Installer docs dir creation |
| 10 | Version bump + README | DEFERRED | Version housekeeping/documentation updates |
| 11 | TUI personality gate | DEFERRED | Personality gate is non-core docs work |
| 12 | Upgrade detection / configVersion | DEFERRED | configVersion/upgrade logic is non-core |
| 13 | wunderkind doctor | DEFERRED | doctor command is non-core feature |
| F1 | Plan Compliance Audit | CANCELLED | To be handled by final verification task |
| F2 | Code Quality Review | CANCELLED | To be handled by final verification task |
| F3 | Full QA Sweep | CANCELLED | To be handled by final verification task |
| 2127 | Must Have implemented | CANCELLED | General goal, not atomic task |
| 2128 | Guardrails confirmed | CANCELLED | General goal, not atomic task |
| 2129 | tsc clean (final) | CANCELLED | Superseded by task verification |
| 2130 | bun test (final) | CANCELLED | Superseded by task verification |
| 2131 | bun run build (final) | CANCELLED | Superseded by task verification |
| 2132 | package.json version v0.6.0 | DEFERRED | Version housekeeping |
| 2133 | Config-path bug fixed (13 locs) | D1 | Verification of D1 implementation |
| 2134 | Personality gate p.confirm | DEFERRED | Part of Task 11 |
| 2135 | Personality *Raw let variables | DEFERRED | Part of Task 11 |
| 2136 | configVersion field present | DEFERRED | Part of Task 12 |
| 2137 | KNOWN_CONFIG_KEYS length 22 | D2 | Verification of D2 implementation |
| 2138 | config-manager exports | D1 | Verification of D1 implementation |
| 2139 | wunderkind doctor visible | DEFERRED | Part of Task 13 |
| 2140 | Doctor legacy-config check | DEFERRED | Part of Task 13 |
| 2141 | Doctor verbose mode | DEFERRED | Part of Task 13 |
