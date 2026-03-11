# CLI Evolution and Audit Roadmap

> **Hub plan:** This file is the plan of record for the next CLI/product-audit wave. It covers command-surface changes, config contract changes, docs orchestration, and the repository-wide audit requested by the user.

## TL;DR

> **Quick Summary**: Evolve Wunderkind from a basic install/init/doctor CLI into a safer lifecycle tool with explicit `upgrade`, non-default command invocation, normal/verbose diagnostics, improved TUI UX, scoped config/schema support, centralized documentation orchestration, and a full best-practices/test/audit pass.
>
> **Execution model**:
> - Use this file as the hub
> - Execute child plans in dependency order
> - Keep integration, migration, and audit gates here

## Execution Status

- [x] W1 — Command Surface and Lifecycle Semantics
- [x] W2 — Config Contract Split: Global vs Project Personality Ownership
- [x] W3 — Upgrade Command and Safe Config Preservation
- [x] W4 — Doctor v2 (Normal + Verbose)
- [x] W5 — TUI UX Review and Refresh
- [x] W6 — Uninstall v2
- [x] W7 — JSON Schema Publication and Config Authoring UX
- [x] W8-A — Plugin command `docs-index` invocation and packaging contract
- [x] W8-B — Normalization engine + collision policy
- [x] W8-C — `init-deep` handoff + partial-success/full-success semantics
- [x] W9-A — Baseline audit report and evidence capture
- [x] W9-B — Audit remediation
- [x] W9-C — Final post-change audit closure

---

## Objectives

1. Add explicit lifecycle commands and contracts:
   - `upgrade`
   - non-default CLI behavior (no implicit install)
   - safer install/upgrade config preservation
2. Improve operator UX:
   - normal + `--verbose` doctor modes
   - TUI layout/color review and refinement
   - optional gitignore prompt during install→init flow
3. Formalize config contract:
   - JSON Schema support and published schema URL
   - project-local personality/soul settings only
   - sane defaults when a project is not initialized
4. Add centralized docs orchestration:
   - one slash command that delegates documentation generation to eligible agents
   - canonical filename normalization / anti-drift behavior
   - final `init-deep` refresh so all agents ingest the refreshed documentation structure
5. Perform a repo-wide engineering audit:
   - code reuse and architecture consistency
   - best-practices audit
   - test coverage posture and gaps

---

## User Requests Covered

1. Add `upgrade` command with customization-safe behavior.
2. Add normal and verbose doctor modes.
3. Review and improve TUI look and feel.
4. Ask whether gitignore updates should run during install when init is selected.
5. Add JSON Schema definition and publish it via GitHub URL.
6. Remove default implicit install behavior; Wunderkind must require an explicit command.
7. Allow uninstall to remove the global Wunderkind config file because Wunderkind is no longer installed.
8. Add a central docs-generation slash command that delegates to doc-writing agents, normalizes existing docs, and finishes with `init-deep`.
9. Confirm and enforce that personality/soul definitions are project-local; global config should define defaults/model-adjacent baseline only, and uninitialized projects should use sane defaults.
10. Run a complete code review / audit of best practices, reuse, and test coverage.

---

## Final-State Findings (Grounded in repo)

### CLI surface now

- `src/cli/index.ts` now exposes: `install`, `upgrade`, `gitignore`, `init`, `doctor`, `uninstall`.
- `install` is no longer the default command; bare invocation shows help and exits.
- `doctor` supports concise default mode plus `--verbose`.
- `uninstall` removes plugin registration and global config on global uninstall while preserving project-local artifacts.

### Config flow now

- `src/cli/config-manager/index.ts` is the shared config hub.
- Global config: `~/.wunderkind/wunderkind.config.jsonc`
- Project config: `./.wunderkind/wunderkind.config.jsonc`
- Global baseline fields and project-local soul/docs fields are split by ownership.
- Runtime uses project-local soul/docs config and packaged defaults for uninitialized projects.
- Generated config files include a published `$schema` URL.

### Personality ownership now

- Interactive `init` now collects team culture, org structure, and all personality fields.
- Install no longer prompts for personalities and its TUI summary explicitly says advanced settings are managed via `wunderkind init`.
- Global config stores baseline region/industry/regulation only; project config stores soul/personality/docs settings.

### Docs-output now

- Eligible agents are defined in `src/agents/docs-config.ts` via `AGENT_DOCS_CONFIG`.
- Runtime prompt injection in `src/index.ts` adds docs-output instructions when enabled.
- A real plugin command surface now exists at `commands/docs-index.md` for `/wunderkind:docs-index`.
- Deterministic local planning/aggregation support exists in `src/agents/docs-index-plan.ts`.
- Child docs agents own their own canonical outputs; the coordinator owns the index.

### TUI now

- TUI install is in `src/cli/tui-installer.ts` using `@clack/prompts` + `picocolors`.
- Summary/output treatment was refined and gitignore prompting is now gated on install→init flow.

### Test / audit posture now

- Unit-test-only suite under `tests/unit/`
- No coverage runner configured in `package.json`
- No explicit “100% coverage” instrumentation or gate exists; this was documented as part of the audit wave rather than guessed.

---

## Product Decisions to Lock Before Implementation

> **Execution gate:** The items in this section must be frozen into explicit cross-plan contracts before implementation starts. No child plan may reinterpret them independently.

### A. `upgrade` command semantics

**Frozen contract to adopt:**
- `upgrade` is an explicit alias-style lifecycle command, but not a thin synonym for install.
- first implementation wave is **non-TUI-first**; TUI upgrade UX can follow only if needed after the non-TUI contract is stable
- It should:
  - preserve existing user customizations by default
  - update plugin registration / package-facing config surfaces safely
  - avoid rewriting init-owned project-local personality/doc settings unless explicitly requested
  - support both global and project scopes
- if Wunderkind is not already installed in the requested scope, `upgrade` must fail with an actionable message rather than silently behaving like install
- no-op upgrades must be surfaced as no-ops, not as successful rewrites
- “user customizations” must be defined field-by-field in a preservation matrix before W3 begins

**Reasoning:** users think in lifecycle terms (`install`, `upgrade`, `uninstall`) even if the internal implementation reuses installer logic.

### B. Doctor modes

**Frozen contract to adopt:**
- `doctor` = concise, operator-friendly health summary
- `doctor --verbose` = expanded diagnostics, including:
  - resolved config sources/paths and precedence
  - current project health + docs-output state
  - selected config sections relevant to prompt injection / personality state
  - short summaries of relevant AGENTS/docs sections where useful, not full file dumps
- verbose mode must use a fixed section schema and bounded output rules; no whole-file dumps
- verbose mode must redact or avoid sensitive content if future config grows beyond current fields

### C. Personality scope contract

**Frozen contract to adopt:**
- Project-local config owns:
  - `teamCulture`
  - `orgStructure`
  - all personality/soul fields
  - docs-output settings
- Global config should retain only global install/runtime defaults that are safe across projects.
- If a project is not initialized, agents use packaged sane defaults at runtime.
- Existing global personality fields require an explicit compatibility-window policy:
  - whether they are read as deprecated fallback
  - whether they emit warnings
  - when they stop affecting runtime behavior

**Implication:** this likely requires a config contract split and migration strategy for existing global personality fields.

### D. Uninstall contract (latest user instruction)

**Frozen contract to adopt:**
- Remove Wunderkind plugin registration from OpenCode config.
- Remove global `~/.wunderkind/wunderkind.config.jsonc` because Wunderkind is no longer installed.
- Do **not** remove project codebase artifacts (`.wunderkind/`, `AGENTS.md`, `.sisyphus/`, docs folders) automatically.
- Tell users that project-local bootstrap/customization artifacts must be cleaned manually.
- Add an uninstall scope/state matrix before implementation:
  - global only
  - project only
  - both installed
  - no-op / already absent
  - whether empty `~/.wunderkind/` dir is removed after deleting the file
- default directory cleanup rule: remove the empty `~/.wunderkind/` directory only if it is empty after deleting Wunderkind's global config file

### E. Docs orchestration slash command

**Frozen contract to adopt:**
- Add a real Wunderkind plugin slash command named `docs-index`.
- It should be packaged via the plugin command surface (`commands/docs-index.md`), not implemented as a normal CLI command.
- It should pin one coordinator agent that fans out parallel background tasks.
- It should trigger each docs-eligible agent individually in parallel using background task orchestration.
- It should normalize existing docs into canonical filenames from `AGENT_DOCS_CONFIG`.
- It should reduce drift by making agent-owned files canonical and discoverable.
- It should finish by running `init-deep` so all agents refresh shared project knowledge after docs regeneration.
- It must define collision/idempotency rules explicitly:
  - what happens when canonical and non-canonical files both exist
  - when existing files are ingested vs replaced
  - whether backups/archives are created
  - whether `init-deep` is skipped on partial failure

**Decision:** default to a real plugin slash-command entry point (`commands/docs-index.md`) rather than a first-class CLI command.

### F. Schema URL/versioning contract

**Frozen contract to adopt:**
- Publish a stable Wunderkind schema URL from `main` as the latest alias.
- Also define an immutable per-release/tag schema URL strategy so older configs can pin if needed.
- `$schema` generation must target the frozen URL contract, not an ad-hoc path.
- default repo location: `schemas/wunderkind.config.schema.json`
- default latest URL: raw GitHub URL on `main`
- default immutable URL: raw GitHub URL on release tags

### G. Gitignore prompt contract

**Frozen contract to adopt:**
- prompt about `.gitignore` updates only when the user has chosen to initialize the current project during install flow
- non-interactive flows keep current explicit behavior via flags/command defaults; no hidden prompt semantics

### H. Audit wave contract

**Frozen contract to adopt:**
- audit runs in the same wave as remediation
- this wave does **not** add an enforced global coverage threshold gate unless the audit explicitly proves it is low-risk and worth adding
- default outcome is measure + remediate, not measure-only and not threshold-first

---

## Workstream Breakdown

### W1 — Command Surface and Lifecycle Semantics

Owns:
- explicit `upgrade`
- no default command behavior
- CLI help / examples / README command matrix updates
- lifecycle naming consistency (`install`, `upgrade`, `uninstall`, `init`, `doctor`)

Primary files:
- `src/cli/index.ts`
- `README.md`
- help-text tests

### W2 — Config Contract Split: Global vs Project Personality Ownership

Owns:
- formal split between global-safe config and project-local personality/soul config
- runtime fallback behavior for uninitialized projects
- migration/compatibility strategy for existing global personality fields
- update of config writer/reader/schema/template docs

Primary files:
- `src/cli/config-manager/index.ts`
- `src/cli/types.ts`
- `src/index.ts`
- config template tests/docs

### W3 — Upgrade Command and Safe Config Preservation

Owns:
- `upgrade` implementation
- reuse of installer internals without wiping customizations
- scope-aware upgrade behavior
- tests for preservation guarantees

Primary files:
- `src/cli/index.ts`
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- `src/cli/config-manager/index.ts`
- CLI tests

### W4 — Doctor v2 (Normal + Verbose)

Owns:
- concise doctor default mode
- `--verbose` richer output
- what AGENTS/docs/config summaries are included in verbose mode
- formatting, colorization, section model

Primary files:
- `src/cli/doctor.ts`
- `src/cli/index.ts`
- config-manager path helpers as needed
- doctor tests

### W5 — TUI UX Review and Refresh

Owns:
- palette/layout review of TUI install/init interactions
- summary card improvements
- optional gitignore prompt when install flows into init
- reusable display/prompt helpers if needed

Primary files:
- `src/cli/tui-installer.ts`
- maybe shared CLI UI helper module
- TUI tests/help/docs

### W6 — Uninstall v2

Owns:
- global config deletion on uninstall
- updated user messaging around what stays vs what goes
- no-op truthfulness
- scope handling / safeguards

Primary files:
- `src/cli/uninstall.ts`
- `src/cli/config-manager/index.ts`
- uninstall tests
- README/help text

### W7 — JSON Schema Publication and Config Authoring UX

Owns:
- Wunderkind config schema file(s)
- `$schema` support in generated config
- published GitHub URL strategy on `main`
- docs for schema consumption

Default publication strategy:
- ship schema in-repo
- publish a stable GitHub URL from `main`
- optionally follow with SchemaStore registration as a discoverability enhancement

Primary files:
- new schema asset(s) under repo-controlled path
- `src/cli/config-manager/index.ts`
- README/AGENTS docs
- manifest/publish inclusion if needed

### W8 — Centralized Documentation Orchestration

Owns:
- central docs generation plugin-command design and implementation
- plugin command packaging and invocation contract for `docs-index`
- per-agent parallel background delegation model
- canonical filename reconciliation / anti-drift behavior
- ingestion of existing differently named files before rewrite/normalization
- `/docs-index` interaction model review
- final `init-deep` refresh behavior after regeneration

Primary files:
- `commands/docs-index.md`
- package publish surface for plugin commands
- likely runtime/docs orchestration support module(s) if command prompt guidance alone is insufficient
- `src/agents/docs-config.ts`
- runtime/docs documentation
- tests

### W9 — Best-Practices / Reuse / Coverage Audit

Owns:
- baseline audit before feature changes close
- code reuse review across CLI/config helpers
- duplicated logic identification
- config/path helper centralization review
- coverage posture assessment and recommendation
- explicit answer on whether 100% coverage exists today (it does not yet appear instrumented)
- in-wave remediation for accepted findings
- final post-change audit closure
- explicit severity rubric and remediation budget before W9-B

Primary files:
- whole repo, but especially `src/cli/*`, tests, package scripts, README/AGENTS

Deliverables:
- audit report
- prioritized fix list
- follow-on implementation plan if audit items are out of immediate scope

---

## Dependency Order

```text
W2 → { W1, W3, W4, W6, W7 }
W1 → W3
W5 → supports W3/W4 UX but can run in parallel after W2 freeze
W8 depends on W2 + current docs-output contract review
W9-A can begin early for baseline discovery; W9-B/W9-C close after feature work lands
```

### Why this order

- **W2 first** because personality/global-vs-project ownership affects install, upgrade, doctor, schema, and runtime behavior.
- **W1 before W3** because command semantics should be frozen before building upgrade behavior.
- **W8 after W2** because docs orchestration may need to know which config lives globally vs locally.
- **W9 throughout** for discovery, then finalized after implementation to assess the resulting codebase honestly.

---

## Child Plan Candidates

- `cli-lifecycle-w1-command-surface.md`
- `cli-config-contract-w2-project-local-souls.md`
- `cli-upgrade-w3-safe-preservation.md`
- `cli-doctor-v2-w4-verbose-mode.md`
- `cli-tui-refresh-w5-look-and-feel.md`
- `cli-uninstall-v2-w6-global-cleanup.md`
- `cli-schema-w7-config-schema-publication.md`
- `cli-docs-orchestration-w8a-invocation-contract.md`
- `cli-docs-orchestration-w8b-normalization-engine.md`
- `cli-docs-orchestration-w8c-init-deep-handoff.md`
- `repo-audit-w9a-baseline-audit.md`
- `repo-audit-w9b-remediation.md`
- `repo-audit-w9c-final-audit-closure.md`

---

## Key Risks and Review Points

### Risk 1 — Config migration ambiguity

If we remove project-local personality fields from global config, we need a migration path or compatibility rule for already-installed users.

### Risk 2 — “Upgrade” becoming an alias without real product value

If implemented as just `install` renamed, it will confuse users again. The contract must focus on preservation and explicit lifecycle semantics.

### Risk 3 — Verbose doctor becoming noisy rather than useful

Verbose mode should summarize, not dump whole files. It should help a maintainer reason about effective runtime state.

### Risk 4 — Docs orchestration command scope creep

Centralized delegation + ingestion + normalization + index rebuild is substantial. It likely needs its own multi-step implementation plan and acceptance criteria.

### Risk 4a — Prompt-defined orchestration determinism

The plugin command surface is real, but the orchestration remains prompt-defined unless Wunderkind adds stronger supporting code/tooling. Partial failures, retries, and consolidation rules must be explicit.

### Risk 5 — Coverage goal confusion

The repo currently does not appear to have instrumentation for true 100% coverage reporting. The audit must distinguish:
- actual measured coverage
- test count / passing status
- perceived confidence

### Risk 6 — Slash-command/runtime ownership ambiguity

If W8 is implemented as if it were a normal CLI command, it will conflict with the product decision that this should be a prompt/slash-command orchestration flow.

### Risk 7 — Mutable schema drift

Using `main` only as the schema URL makes the latest schema easy to discover, but older configs may validate against changed rules unless an immutable tag-based contract also exists.

---

## Proposed Verification Strategy

> **Execution rule:** Every child plan/workstream must include at least one executable QA scenario with exact Setup / Run / Assert / Evidence steps. Repo-level checks are necessary but not sufficient.

### For feature workstreams

- `tsc --noEmit`
- targeted unit tests per command/workstream
- full `bun test`
- `bun run build`
- CLI smoke tests in temp dirs for:
  - install / upgrade / uninstall scope handling
  - doctor normal and verbose modes
  - non-default command behavior
  - init prompt ownership

### Per-workstream QA gates

#### W1 — Command Surface and Lifecycle Semantics
- **Setup:** temp project dir with no OpenCode config
- **Run:** `node bin/wunderkind.js`
- **Assert:** exits non-zero or shows top-level help; does not create config files or perform install side effects
- **Evidence:** captured stdout/stderr and filesystem diff

#### W2 — Config Contract Split
- **Setup:** one temp home/global config with legacy global personality fields, one temp project with no local init
- **Run:** runtime/config reader tests + targeted `bun test`
- **Assert:** project-local soul fields resolve from local config when initialized; otherwise runtime uses sane defaults, not global personality overrides beyond compatibility policy
- **Evidence:** fixture outputs and config snapshots

#### W3 — Upgrade Command
- **Setup:** installed temp global/project configs with user customizations
- **Run:** `node bin/wunderkind.js upgrade --scope=<scope>`
- **Assert:** allowed install-owned surfaces update; init-owned/project-local fields remain preserved according to the frozen matrix; no-op upgrades report no-op
- **Evidence:** before/after config diff and stdout capture

#### W4 — Doctor v2
- **Setup:** temp dirs covering uninitialized project, initialized project, mixed global/project installs
- **Run:** `node bin/wunderkind.js doctor` and `node bin/wunderkind.js doctor --verbose`
- **Assert:** default mode remains concise; verbose mode includes only frozen sections; no whole-file dumps; paths/sources are accurate
- **Evidence:** golden-output snapshots or structured assertions

#### W5 — TUI UX Review and Refresh
- **Setup:** scripted prompt fixture / mocked prompt outputs
- **Run:** TUI flow tests for install→init and summary rendering
- **Assert:** gitignore prompt appears only when init is selected; summary/layout strings match the revised UX contract; color/layout helpers remain stable
- **Evidence:** output snapshots and prompt-order assertions

#### W6 — Uninstall v2
- **Setup:** temp home with global config file + temp project with optional local artifacts
- **Run:** `node bin/wunderkind.js uninstall --scope=global|project`
- **Assert:** plugin registration removed correctly; global config file removed when applicable; project artifacts remain untouched; no-op states are truthful; empty global dir cleanup follows frozen rule
- **Evidence:** filesystem diff + stdout capture

#### W7 — JSON Schema Publication
- **Setup:** generated config fixture + schema asset
- **Run:** config generation tests and schema URL assertions
- **Assert:** config contains exact `$schema` URL for latest alias; immutable tagged URL strategy is documented/tested; schema file path is included in publishable assets
- **Evidence:** generated config snapshot + package files check

#### W8-A — Slash-command Invocation Contract
- **Setup:** runtime integration discovery notes + fixture proving invocation surface
- **Run:** executable discovery proof (code references/tests) for how slash commands are surfaced
- **Assert:** concrete extension point is identified before W8-B starts
- **Evidence:** code reference list and targeted tests

#### W8-B — Normalization Engine
- **Setup:** docs fixture with canonical files, non-canonical legacy files, and collisions
- **Run:** orchestration-module tests
- **Assert:** normalization follows collision/idempotency policy; canonical filenames become authoritative; no ambiguous overwrite behavior
- **Evidence:** before/after docs tree snapshots

#### W8-C — `init-deep` Handoff
- **Setup:** successful and partial-failure orchestration fixtures
- **Run:** orchestration completion tests
- **Assert:** `init-deep` runs only after successful completion; partial failure blocks handoff and surfaces actionable errors
- **Evidence:** command/event trace and output assertions

#### W9-A — Baseline Audit
- **Setup:** current repo state before remediation
- **Run:** audit scripts/review checklist
- **Assert:** explicit findings for reuse, config consistency, best practices, and measured coverage posture
- **Evidence:** audit report with severity tags

#### W9-B — Remediation
- **Setup:** accepted findings + remediation budget
- **Run:** focused fixes only for approved findings
- **Assert:** each remediation has targeted proof and does not broaden scope uncontrollably
- **Evidence:** targeted tests/diffs linked back to findings

#### W9-C — Final Audit Closure
- **Setup:** post-remediation repo state
- **Run:** repeat baseline audit subset
- **Assert:** findings are closed, downgraded, or explicitly deferred with rationale
- **Evidence:** final audit delta report

### For docs orchestration

- temp docs directory fixture with:
  - canonical files present
  - non-canonical legacy files present
  - mixed docs state
- verify normalization behavior and index regeneration outcome
- verify collision policy and idempotency
- verify `init-deep` fires only after successful orchestration completion
- verify partial failure does not leave the docs tree in an ambiguous state
- verify the `docs-index` plugin command is packaged and discoverable via the host command surface
- verify one background task is launched per docs-eligible agent

### For audit workstream

- produce explicit evidence for:
  - reuse hotspots / duplication
  - config contract consistency
  - measured coverage posture (if tooling added)
  - best-practice findings with severity/prioritization
- include remediation in the same wave, not only a report
- define an explicit severity rubric and remediation budget before W9-B starts

---

## Atomic Commit Strategy

- **W2-A**: freeze config contract and compatibility rules
- **W1-A**: remove implicit default command and update command help
- **W3-A**: add upgrade command plumbing and scope-safe preservation helpers
- **W4-A**: doctor normal/verbose output model + tests
- **W5-A**: TUI styling/helper refactor
- **W5-B**: install/init gitignore prompt behavior
- **W6-A**: uninstall global-config cleanup + messaging
- **W7-A**: schema/versioning contract freeze
- **W7-B**: schema asset + config writer `$schema` integration
- **W7-B**: docs/help/schema publication updates
- **W7-C**: docs/help/schema publication updates
- **W8-A**: plugin command `docs-index` invocation and packaging contract
- **W8-B**: normalization engine + collision policy
- **W8-C**: init-deep handoff + failure semantics
- **W9-A**: baseline audit report and evidence capture
- **W9-B**: audit remediation commits in the same wave
- **W9-C**: final post-change audit closure

---

## Open Questions to Resolve During Review

1. Should raw `/docs-index` be treated only as documentation shorthand while `/wunderkind:docs-index` remains the guaranteed plugin-command surface?

---

## Success Criteria

- Wunderkind never runs implicit install when invoked without a command.
- `upgrade` exists and demonstrably preserves user customizations.
- `doctor` has useful default and verbose modes with accurate path/scope reporting.
- TUI flow is visibly improved and project-aware gitignore behavior is explicit.
- Config files support a published `$schema` URL.
- Personality/soul definitions are unambiguously project-local in the product contract.
- Centralized docs orchestration slash command exists, reduces docs drift, and finishes with `init-deep`.
- Uninstall removes plugin registration and global config, while still avoiding project codebase deletion.
- A repo-wide audit explicitly documents reuse, best-practice posture, and coverage reality, and ships agreed remediation in the same wave.
