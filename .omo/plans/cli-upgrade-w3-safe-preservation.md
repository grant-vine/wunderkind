# CLI Upgrade W3 — Safe Preservation

## Objective

Implement the `upgrade` command to update the Wunderkind plugin registration and global configuration safely while preserving all existing user customizations.

## Scope

- Implement `upgrade` command logic in `src/cli/index.ts`.
- Reuse and adapt non-interactive installer/config-manager internals for the "preservation-first" flow.
- Ensure that upgrading never wipes `init`-owned project-local personality or documentation settings.

## Depends On

- W1 — Command Surface (for command definition)
- W2 — Config Contract Split (for scope and ownership rules)

## Files in Scope

- `src/cli/index.ts`
- `src/cli/cli-installer.ts`
- `src/cli/config-manager/index.ts`
- targeted CLI/unit tests for upgrade behavior

## Product Decisions / Frozen Contract

- **Preservation Matrix**:
  - `GlobalConfig` (region, industry, regs): **Preserve existing values** unless the user provides new flags.
  - `ProjectConfig` (personality, docs): **Never overwrite** during an `upgrade`. These are owned by `init`.
- If Wunderkind is not already installed in the requested scope, `upgrade` must fail with an error.
- No-op upgrades must be reported as such.
- The first wave is **non-TUI-first**.
- `upgrade` must not mutate `opencode.json` (plugin registration) if the version and scope already match (no-op safety).

## Deliverables

- `upgrade` command implementation that satisfies the preservation matrix.
- Safeguards to prevent `upgrade` from acting as an `install`.
- Unit tests for the preservation of custom fields during an upgrade.

## Task Breakdown

### Task W3.1 — Implementation of the `upgrade` Action

- **Action:** In `src/cli/index.ts`, implement the logic for `upgrade`.
- **Action:** Add a check to verify that the plugin is already registered (`detectCurrentConfig()`).
- **Action:** If not registered, exit with a helpful error suggesting `install`.

### Task W3.2 — Safe Preservation Logic in `config-manager`

- **Action:** Update `writeWunderkindConfig()` or create a new `mergeWunderkindConfig()` helper.
- **Action:** Ensure that only fields in the "global-safe" bucket are updated if they differ.
- **Action:** Explicitly skip writing any personality/soul fields during an `upgrade` in the project scope.

### Task W3.3 — Non-TUI Upgrade Flow

- **Action:** Implement the non-interactive upgrade path in `cli-installer.ts`.
- **Action:** Use current configuration as the baseline for all values not explicitly overridden by CLI flags.
- **Action:** Defer any TUI-specific upgrade UX to a later wave unless explicitly pulled into scope after W3 is complete.

## QA Scenarios

```text
Scenario: Upgrade preserves user customization
  Setup: Global config has `region: "Australia"` and existing project-local soul/docs fields.
  Run: node bin/wunderkind.js upgrade --scope=global
  Assert: Region remains "Australia" when no override flags are supplied.
  Assert: Project-local personality/docs fields are unchanged before vs after the run.
  Evidence: .sisyphus/evidence/w3-upgrade-preservation.txt

Scenario: Upgrade fails if not installed
  Setup: A project with no `opencode.json`.
  Run: node bin/wunderkind.js upgrade --scope=project
  Assert: Fails with "Wunderkind is not installed in the project scope. Did you mean 'wunderkind install'?"
  Evidence: .sisyphus/evidence/w3-upgrade-guard.txt

Scenario: No-op upgrade
  Setup: Config values match provided flags (or no flags provided).
  Run: node bin/wunderkind.js upgrade
  Assert: Prints a no-op message such as "Wunderkind is already up to date" or "No changes required".
  Assert: `opencode.json` and Wunderkind config files are byte-for-byte unchanged.
  Evidence: .sisyphus/evidence/w3-upgrade-noop.txt
```

## Commit Strategy

- **Commit W3-A**: `feat(cli): implement upgrade command with preservation-safe logic`
- **Commit W3-B**: `feat(config-manager): add config-merging helper for safe upgrades`
- **Commit W3-C**: `test(cli): add tests for upgrade preservation matrix`

## Exit Conditions

- [x] `upgrade` behaves truthfully on mutation vs no-op paths.
- [x] `upgrade` does NOT overwrite existing region/industry/regs without explicit flags.
- [x] `upgrade` NEVER overwrites personality or docs-output fields.
- [x] `upgrade` fails when no previous installation is found.
