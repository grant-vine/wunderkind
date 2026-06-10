# Docs Output D1 — Foundation and Config

## Objective

Establish the foundational config contract for docs output: correct the config-path bug everywhere it matters, add the docs-output config fields to the install/config types, and expose a shared reader that runtime code can consume safely.

## Scope

This child plan covers original Tasks 1, 2, and 3 from the former mega-plan.

## Files in Scope

- `src/index.ts`
- all 12 `src/agents/*.ts` files with config-path references
- `src/cli/types.ts`
- `src/cli/config-manager/index.ts`
- `tests/unit/cli-installer.test.ts` (only where needed for config-manager mocks)

## Deliverables

- all `wunderkind.config.jsonc` path references corrected to `.wunderkind/wunderkind.config.jsonc`
- `docsEnabled`, `docsPath`, `docHistoryMode` added to install/config types
- config-manager reads and writes docs-output fields with defaults
- exported `readWunderkindConfig(): Partial<InstallConfig> | null`

## Frozen Config Contract

- Stored field names are `docsEnabled`, `docsPath`, and `docHistoryMode`.
- Defaults are:
  - `docsEnabled: false`
  - `docsPath: "./docs"`
  - `docHistoryMode: "overwrite"`
- Project config precedence is field-by-field over global config when both exist.
- If no project config exists, readers fall back to global config.
- If neither project nor global config exists, readers fall back to the defaults above.
- D1 owns config shape and precedence only; D2 owns init-side path validation/normalization and bootstrap behavior.

## Task D1.1 — Fix config-path bug in `src/index.ts` and all 12 agent factories

### What to do
- In `src/index.ts`, replace bare `wunderkind.config.jsonc` references with `.wunderkind/wunderkind.config.jsonc`.
- Update the global fallback path to `~/.wunderkind/wunderkind.config.jsonc` where applicable.
- Apply the same correction in each of the 12 `src/agents/*.ts` files.

### Must NOT do
- Do not change logic.
- Do not edit `agents/*.md` directly.

### Acceptance Criteria
- [ ] No bare config-path references remain in `src/`
- [ ] `tsc --noEmit` exits 0
- [ ] existing tests still pass

### QA Scenarios
```text
Scenario: No bare config path references remain in src/
  Tool: Bash
  Steps:
    1. Run: grep -rn "\"wunderkind.config.jsonc\"" src/ | grep -v "\.wunderkind/"
    2. Assert output is empty
  Evidence: .sisyphus/evidence/task-1-path-grep.txt

Scenario: TypeScript still compiles cleanly
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-1-tsc.txt

Scenario: Existing tests still pass
  Tool: Bash
  Steps:
    1. Run: bun test
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-1-bun-test.txt
```

## Task D1.2 — Add docs-output fields to config type interfaces

### What to do
- In `src/cli/types.ts`, add:
  - `docsEnabled: boolean`
  - `docsPath: string`
  - `docHistoryMode: DocHistoryMode`
- Export `DocHistoryMode = "overwrite" | "append-dated" | "new-dated-file" | "overwrite-archive"`.
- Apply the same required fields to `DetectedConfig`.
- Add optional CLI arg fields to `InstallArgs`.

### Must NOT do
- Do not make these new fields optional in `InstallConfig` or `DetectedConfig`.
- Do not set defaults here.

### Acceptance Criteria
- [ ] `DocHistoryMode` exported correctly
- [ ] `InstallConfig` contains all 3 required docs-output fields

### QA Scenarios
```text
Scenario: DocHistoryMode union exported correctly
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit 2>&1 | grep "types.ts" | wc -l
    2. Assert output is "0"
  Evidence: .sisyphus/evidence/task-2-tsc-types.txt

Scenario: InstallConfig has all 3 new required fields
  Tool: Bash
  Steps:
    1. Run: grep -n "docsEnabled\|docsPath\|docHistoryMode\|DocHistoryMode" src/cli/types.ts
    2. Assert all 4 identifiers appear
  Evidence: .sisyphus/evidence/task-2-grep-types.txt
```

## Task D1.3 — Extend config-manager and export `readWunderkindConfig()`

### What to do
- Add docs-output defaults to `detectCurrentConfig()`:
  - `docsEnabled: false`
  - `docsPath: "./docs"`
  - `docHistoryMode: "overwrite"`
- Update `writeWunderkindConfig()` to emit the 3 docs-output fields with JSONC comments.
- Export `readWunderkindConfig(): Partial<InstallConfig> | null` using the existing JSONC parser and current config locations.
- Freeze and document the precedence rule used by config readers: project-local values override global values field-by-field; otherwise fall back to global values; otherwise use defaults.
- Update relevant test mocks in `tests/unit/cli-installer.test.ts`.

### Must NOT do
- Do not add a new JSONC dependency.
- Do not change the JSONC write strategy.
- Do not make `readWunderkindConfig()` throw on missing config.

### Acceptance Criteria
- [ ] config-manager emits and reads the docs-output fields correctly
- [ ] `readWunderkindConfig()` returns `null` gracefully when no config exists
- [ ] config precedence between project and global config is frozen and test-covered
- [ ] config-manager compiles cleanly

### QA Scenarios
```text
Scenario: writeWunderkindConfig emits new fields
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-3-cli-installer-tests.txt

Scenario: readWunderkindConfig returns null when no config exists
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/cli-installer.test.ts
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-3-read-null.txt

Scenario: Project config overrides global config field-by-field
  Tool: Bash
  Steps:
    1. Setup: add a targeted unit test covering project-local and global config fixtures with conflicting docs-output values
    2. Run: bun test tests/unit/cli-installer.test.ts
    3. Assert exit code 0 and the test proves project-local values win while unspecified fields still fall back correctly
  Evidence: .sisyphus/evidence/task-3-config-precedence.txt

Scenario: tsc compiles config-manager with no errors
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit 2>&1 | grep "config-manager"
    2. Assert output is empty
  Evidence: .sisyphus/evidence/task-3-tsc-config-manager.txt
```

## Commit Strategy

- **Commit D1-A**: `fix(agents): correct wunderkind config path to .wunderkind/ in all 13 locations`
- **Commit D1-B**: `feat(types,config-manager): add docs config fields and readWunderkindConfig()`

## Exit Conditions

- [ ] D1.1 complete
- [ ] D1.2 complete
- [ ] D1.3 complete
- [ ] D2 and D3 are unblocked
