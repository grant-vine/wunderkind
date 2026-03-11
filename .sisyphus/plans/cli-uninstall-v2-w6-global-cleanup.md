# CLI Uninstall v2 — Global Cleanup

## Objective

Enhance the `uninstall` command to remove the global Wunderkind configuration file when applicable, while ensuring that project-local bootstrap artifacts remain untouched.

## Scope

- Update `uninstall` to handle global configuration file deletion.
- Clarify user messaging regarding what is removed versus what remains in the project.
- Implement scope-aware safeguards.

## Depends On

- W2 — Config Contract Split (for accurate scope and path resolution)

## Files in Scope

- `src/cli/uninstall.ts`
- `src/cli/config-manager/index.ts`
- `README.md`

## Product Decisions / Frozen Contract

- **Global Scope**:
  - Remove Wunderkind plugin registration from the global `opencode.json`.
  - Delete `~/.wunderkind/wunderkind.config.jsonc`.
  - Remove `~/.wunderkind/` directory only if it is empty after config deletion.
- **Project Scope**:
  - Remove Wunderkind plugin registration from the project-local `opencode.json`.
  - **Do NOT** remove `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, or docs folders automatically.
- **Empty Directory Cleanup**: Delete `~/.wunderkind/` or `.wunderkind/` only if they are entirely empty after config removal. Never use `rm -rf` on these directories.
- **Uninstall State**: Explicitly handle "both-installed" (Global + Project) by targeting the specified scope; if no scope provided, default to Project scope if present, then Global.

## Deliverables

- `uninstall` command with global config cleanup.
- Refined user messaging in the CLI and README.
- Unit tests for scope-aware cleanup behavior.

## Task Breakdown

### Task W6.1 — Global Config Deletion

- **Action:** In `src/cli/uninstall.ts`, implement the logic to delete `~/.wunderkind/wunderkind.config.jsonc`.
- **Action:** Implement the "empty-dir-cleanup" rule for `~/.wunderkind/`.

### Task W6.2 — Updated User Messaging

- **Action:** Update CLI output to explicitly list what was removed.
- **Action:** Add a post-uninstall note about manual project-local cleanup if applicable.
- **Action:** Update `README.md` uninstall section.

### Task W6.3 — Scope-Aware Guardrails

- **Action:** Ensure `--scope=project` does not delete the global config.
- **Action:** Handle cases where only one scope is installed.

## QA Scenarios

```text
Scenario: Global uninstall removes config file
  Setup: Global config exists.
  Run: node bin/wunderkind.js uninstall --scope=global
  Assert: `~/.wunderkind/wunderkind.config.jsonc` is gone.
  Assert: `~/.wunderkind/` is removed only if it is empty after config deletion.
  Evidence: .sisyphus/evidence/w6-global-cleanup.txt

Scenario: Project uninstall leaves soul files
  Setup: Project-local `.wunderkind/` and `AGENTS.md` exist.
  Run: node bin/wunderkind.js uninstall --scope=project
  Assert: `.wunderkind/` and `AGENTS.md` remain on disk.
  Assert: Prints a note about manual cleanup.
  Evidence: .sisyphus/evidence/w6-project-safety.txt

Scenario: No-op uninstall
  Setup: Wunderkind not installed.
  Run: node bin/wunderkind.js uninstall
  Assert: Prints "Wunderkind is not currently installed" or similar.
  Evidence: .sisyphus/evidence/w6-noop-uninstall.txt

Scenario: Bare uninstall with both scopes installed
  Setup: both global and project registrations exist.
  Run: node bin/wunderkind.js uninstall
  Assert: behavior follows the frozen default-scope rule from this plan.
  Assert: only the targeted scope is changed.
  Evidence: .sisyphus/evidence/w6-both-installed-default-scope.txt
```

## Commit Strategy

- **Commit W6-A**: `feat(cli): implement global config cleanup in uninstall command`
- **Commit W6-B**: `feat(cli): update uninstall messaging and scope-handling safety`
- **Commit W6-C**: `test(cli): add tests for uninstall cleanup and preservation rules`

## Exit Conditions

- [x] Global config file and empty parent directory are removed on global uninstall.
- [x] Project-local soul files are NEVER removed by the uninstall command.
- [x] User messaging is clear and accurate, including both-installed and no-op states.
