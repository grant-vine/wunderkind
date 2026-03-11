# CLI Lifecycle W1 — Command Surface

## Objective

Evolve the CLI command surface to support explicit lifecycle semantics. This includes removing the implicit default `install` behavior and adding the `upgrade` command entry point (plumbing only, logic follows in W3).

## Scope

- Remove default command behavior from `src/cli/index.ts`.
- Add `upgrade` command definition to the CLI.
- Update top-level help text, examples, and README to reflect the new lifecycle-first model.

## Depends On

- W2 — Config Contract Split (Freeze dependency to ensure command surface alignment)

## Files in Scope

- `src/cli/index.ts`
- `README.md`
- `package.json` (bin/version check)

## Product Decisions / Frozen Contract

- `install` is no longer the default command. Invoking `wunderkind` without a command must show help or an error, not start an installation.
- `upgrade` is added as a first-class lifecycle command.
- Lifecycle naming is standardized: `install`, `upgrade`, `uninstall`, `init`, `doctor`, `gitignore`.

## Deliverables

- `src/cli/index.ts` updated to remove `isDefault: true` from `install`.
- `upgrade` command registered in `src/cli/index.ts`.
- Updated README.md command table.
- Updated help text for all lifecycle commands.

## Task Breakdown

### Task W1.1 — Remove default install behavior

- **Action:** In `src/cli/index.ts`, remove `{ isDefault: true }` from the `install` command definition.
- **Action:** Ensure the root `program` shows help when no arguments are provided.

### Task W1.2 — Register `upgrade` command

- **Action:** Add `program.command("upgrade")` to `src/cli/index.ts`.
- **Action:** Add initial flags to match `install` where applicable (e.g., `--scope`, `--no-tui`).
- **Action:** Point the action to a placeholder/stub for now (W3 will implement the logic).

### Task W1.3 — Update README and Help Text

- **Action:** Update `README.md` CLI table to include `upgrade`.
- **Action:** Ensure all commands have consistent, crisp descriptions.

## QA Scenarios

```text
Scenario: No implicit install on bare invocation
  Setup: Ensure no existing config in a temp directory.
  Run: node bin/wunderkind.js
  Assert: Shows help text; does NOT start an interactive install flow or create files.
  Evidence: .sisyphus/evidence/w1-no-implicit-install.txt

Scenario: Upgrade command is discoverable
  Run: node bin/wunderkind.js --help
  Assert: "upgrade" appears in the list of available commands.
  Evidence: .sisyphus/evidence/w1-upgrade-help.txt

Scenario: README is up to date
  Run: grep "upgrade" README.md
  Assert: At least one match in the CLI command table.
  Evidence: .sisyphus/evidence/w1-readme-check.txt
```

## Commit Strategy

- **Commit W1-A**: `feat(cli): remove implicit default install behavior`
- **Commit W1-B**: `feat(cli): add upgrade command surface and update documentation`

## Exit Conditions

- [x] `wunderkind` (bare) shows help.
- [x] `wunderkind upgrade --help` works.
- [x] README matches CLI reality.
