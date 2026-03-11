# CLI Config Contract W2 — Project-Local Souls

## Objective

Formalize the split between global and project-local configuration. Establish that all personality and "soul" definitions belong exclusively to the project scope, while global config remains a baseline for defaults only.

## Scope

- Split `InstallConfig` / `DetectedConfig` into scope-appropriate interfaces.
- Update `config-manager` to enforce the split during read/write operations.
- Implement a migration/compatibility path for legacy global personality fields.
- Update `init` and `install` flows to reflect the new ownership model.

## Depends On

- None (Independent foundational work)

## Files in Scope

- `src/cli/types.ts`
- `src/cli/config-manager/index.ts`
- `src/index.ts` (Runtime merging logic)
- `src/cli/init.ts`
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`

## Product Decisions / Frozen Contract

- **Project-local config owns**: `teamCulture`, `orgStructure`, all personality fields (e.g. `cisoPersonality`), and `docsEnabled` / `docsPath` / `docHistoryMode`.
- **Global config owns**: `region`, `industry`, `primaryRegulation`, `secondaryRegulation`.
- **Precedence**: Project-local values always win for personality/soul fields. If a project is not initialized, runtime uses hardcoded sane defaults (not global personality fields).
- **Deprecation**: Existing global personality fields are read as a deprecated fallback but emit a warning during `doctor` or `install`. They will be ignored in a future major version.

## Deliverables

- `src/cli/types.ts` updated with `GlobalConfig` and `ProjectConfig` interfaces.
- `readWunderkindConfig()` updated to follow the new merging and fallback rules.
- `writeWunderkindConfig()` updated to only write scope-appropriate fields.
- Compatibility layer in `config-manager` to handle legacy global fields.

## Task Breakdown

### Task W2.1 — Refactor Config Types

- **Action:** Split the flat `InstallConfig` into `GlobalConfig` (region, industry, regs) and `ProjectConfig` (culture, org, personalities, docs).
- **Action:** Update `DetectedConfig` to reflect the union of both, but with clear ownership markers.

### Task W2.2 — Update Config Manager Read/Write Logic

- **Action:** Update `writeWunderkindConfig()` to filter fields based on the `scope` parameter.
- **Action:** Update `readWunderkindConfig()` to implement the new precedence: `ProjectConfig` (if exists) -> Defaults.
- **Action:** Ensure global personality fields are only used as a deprecated fallback if no project config exists.

### Task W2.3 — Implement Runtime Merging in Plugin Entry

- **Action:** Update `src/index.ts` to use the refined reader.
- **Action:** Ensure uninitialized projects receive the correct default-object shape for personalities.

## QA Scenarios

```text
Scenario: Project personality overrides global defaults
  Setup: Global config has `cmoPersonality: "data-driven"`. Project config has `cmoPersonality: "brand-storyteller"`.
  Run: execute a targeted Bun/unit test that exercises `readWunderkindConfig()` against the fixture configs.
  Assert: Resolved config shows "brand-storyteller".
  Evidence: .sisyphus/evidence/w2-project-precedence.txt

Scenario: Global config does not store project fields
  Setup: Run project install or init.
  Run: cat ~/.wunderkind/wunderkind.config.jsonc
  Assert: Personality fields (e.g. "ctoPersonality") are NOT present in the global file.
  Evidence: .sisyphus/evidence/w2-global-cleanup.txt

Scenario: Sane defaults for uninitialized projects
  Setup: No project config exists.
  Run: execute a targeted Bun/unit test that calls `readWunderkindConfig()` in a project dir with no local config.
  Assert: Personality fields return their packaged defaults, not null or undefined.
  Evidence: .sisyphus/evidence/w2-uninitialized-defaults.txt
```

## Commit Strategy

- **Commit W2-A**: `feat(types): split config into global and project-local interfaces`
- **Commit W2-B**: `feat(config-manager): enforce scope-specific config ownership and precedence`
- **Commit W2-C**: `feat(index): update runtime config merging and fallback strategy`

## Exit Conditions

- [x] Personality fields are absent from newly generated global configs.
- [x] `readWunderkindConfig()` correctly prioritizes project-local soul fields.
- [x] Uninitialized projects use sane defaults for all personality fields.
