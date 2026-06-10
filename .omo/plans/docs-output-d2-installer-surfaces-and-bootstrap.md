# Docs Output D2 — Init Prompts and Docs Bootstrap

## Objective

Own the docs-output customization surfaces used by project init paths, plus bootstrap behavior that creates `<docsPath>/README.md` only when docs output is enabled.

## Scope

This child plan covers the docs-output customization and bootstrap parts of original Tasks 5 and 9, and provides reusable docs-output input/validation behavior consumed by D5.

## Depends On

- D1 must be complete.

## Files in Scope

- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- likely shared init/bootstrap helper module consumed by D5
- `tests/unit/cli-installer.test.ts`

## Deliverables

- validation and mapping for project-local docs-output customizations
- interactive docs-output prompts used only when an init path is active
- init-side creation of `<docsPath>/README.md` when enabled

## Locked Contract with D1 and D5

- `docsEnabled`, `docsPath`, and `docHistoryMode` are project-local init customizations only.
- D1 owns stored field names, defaults, and precedence rules; D2 must not redefine them.
- `docsPath` is persisted as config data exactly as provided, but D2 owns validation and normalization for filesystem/bootstrap operations.
- Allowed v1 `docsPath` forms are project-relative paths rooted in the current folder; absolute paths and parent traversal (`..`) are rejected during validation.
- Bootstrap target is `<normalized docsPath>/README.md`, not a hardcoded `docs/README.md`.
- D2 owns one reusable helper contract for docs-output validation, normalization, config mapping, and docs bootstrap.
- D5 consumes D2's helper contract and must not duplicate those rules.
- D4's prompt-surface `docs-config.ts` helper is separate and does not satisfy D2/D5 CLI helper ownership.

## Task D2.1 — Define docs-output project customization validation and mapping

### What to do
- Define and test the validation rules for `docsEnabled`, `docsPath`, and `docHistoryMode` as project-local init customizations.
- Ensure the docs-output values map cleanly into project-local Wunderkind config writes.
- Provide reusable validation/mapping behavior that D5 can call from both `init` and the install-to-init branch.
- Freeze validation rules explicitly: accept project-relative paths rooted in the current folder; reject absolute paths and parent traversal.

### Must NOT do
- Do not add a `/docs-index` CLI subcommand.
- Do not couple these rules to base install prompts.

### Acceptance Criteria
- [ ] docs-output project customization validation is explicit and test-covered
- [ ] invalid `--doc-history-mode` exits with a clear error
- [ ] docs-output values map correctly into project-local config writes
- [ ] D5 reuses D2's docs-output helper contract rather than re-implementing validation/mapping rules

### QA Scenarios
```text
Scenario: Invalid --doc-history-mode exits 1
  Tool: Bash
  Setup:
    1. Add a targeted unit test covering invalid `docHistoryMode` input for the D2 helper contract
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted test proves invalid `docHistoryMode` is rejected with a clear error
  Evidence: .sisyphus/evidence/task-4-invalid-mode.txt

Scenario: Absolute paths and parent traversal are rejected
  Tool: Bash
  Setup:
    1. Add targeted unit tests for `docsPath` values such as `/tmp/docs` and `../docs`
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted tests prove those values are rejected
  Evidence: .sisyphus/evidence/d2-docs-path-validation.txt

Scenario: CLI/init tests pass including docs-output validation and mapping
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-4-cli-tests.txt
```

## Task D2.2 — Add docs-output prompts inside init paths

### What to do
- Add interactive docs-output prompts only when a project-init path is active.
- Prompt for:
  - `docsEnabled`
  - `docsPath` (conditional)
  - `docHistoryMode` (conditional)
- Ensure base install does not ask these questions unless the user has explicitly entered init, whether that init path started from standalone `wunderkind init` or from install-to-init handoff.

### Must NOT do
- Do not ask docs-output questions during base install when no init path is active.
- Do not show path/mode prompts when docs output is disabled.

### Acceptance Criteria
- [ ] init-path prompting compiles cleanly
- [ ] config assembly contains all docs-output fields
- [ ] docs-output prompts appear only inside active init flows

### QA Scenarios
```text
Scenario: TypeScript compiles clean after init-path prompt changes
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-5-tsc.txt

Scenario: docsEnabled/docsPath/docHistoryMode are present in init-path config assembly
  Tool: Bash
  Setup:
    1. Add a targeted test covering init-path config assembly
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted test proves all 3 fields are assembled in init flows
  Evidence: .sisyphus/evidence/task-5-grep-tui.txt

Scenario: Docs-output prompts appear only in init path
  Tool: Bash
  Setup:
    1. Add fixture-backed tests or transcript assertions for install-without-init and install-with-init flows
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted tests prove base install omits docs-output prompts while init flows include them
  Evidence: .sisyphus/evidence/d2-init-docs-prompts.txt
```

## Task D2.3 — Bootstrap `<docsPath>/README.md` during init

### What to do
- After project-local config has been written in an init flow, create the normalized docs directory and standard `README.md` at `<normalized docsPath>/README.md` when `docsEnabled === true`.
- Normalize `docsPath` before filesystem operations.
- Do not overwrite an existing `<docsPath>/README.md`.

### Must NOT do
- Do not create per-agent subfolders.
- Do not overwrite an existing docs index.
- Do not add `docs/` to `.gitignore`.

### Acceptance Criteria
- [ ] init with docs enabled creates `<docsPath>/README.md`
- [ ] init without docs enabled does not create docs dir
- [ ] re-running init does not overwrite an existing docs README

### QA Scenarios
```text
Scenario: Init with docs-enabled creates `<docsPath>/README.md`
  Tool: Bash
  Setup:
    1. Add a fixture-backed test that runs init with `docsEnabled=true` and `docsPath=./docs`
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted test proves `<docsPath>/README.md` is created at the normalized path
  Evidence: .sisyphus/evidence/task-9-install-with-docs.txt

Scenario: Init without docs-enabled does not create `<docsPath>/README.md`
  Tool: Bash
  Setup:
    1. Add a fixture-backed test that runs init with `docsEnabled=false`
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted test proves no docs bootstrap file is created
  Evidence: .sisyphus/evidence/task-9-install-without-docs.txt

Scenario: Re-running init does not overwrite existing README
  Tool: Bash
  Setup:
    1. Add a fixture-backed test that pre-creates `<docsPath>/README.md` before a second init run
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0 and the targeted test proves the existing file is preserved
  Evidence: .sisyphus/evidence/task-9-idempotent-readme.txt
```

## Commit Strategy

- **Commit D2-A**: `feat(init): add docs-output validation and config mapping`
- **Commit D2-B**: `feat(init): add docs prompts and bootstrap docs directory creation`

## Exit Conditions

- [x] D2.1 complete
- [x] D2.2 complete
- [x] D2.3 complete
- [x] D5 has the docs-output customization contract it needs
