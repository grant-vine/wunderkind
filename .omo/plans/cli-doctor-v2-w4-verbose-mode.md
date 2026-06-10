# CLI Doctor v2 — Verbose Mode

## Objective

Evolve `doctor` to provide a concise default output while offering an expanded `--verbose` mode for maintainers and advanced users.

## Scope

- Add a `--verbose` flag to the `doctor` command.
- Update `src/cli/doctor.ts` to implement normal and verbose diagnostic modes.
- Define and implement the fixed section schema for verbose diagnostics.

## Depends On

- W2 — Config Contract Split (for accurate path and scope reporting)

## Files in Scope

- `src/cli/index.ts`
- `src/cli/doctor.ts`
- `src/cli/config-manager/index.ts`

## Product Decisions / Frozen Contract

- **Doctor Default**: Remains concise and operator-friendly.
- **Doctor Verbose**: Adds:
  - Resolved config paths and precedence details.
  - Project health summary (soul-file presence).
  - Selected config sections relevant to prompt injection.
  - Short summaries (bounded length) of relevant `AGENTS.md` / docs sections.
- **Rules**:
  - Use a fixed section schema.
  - Fixed section schema for this wave: `Install Summary`, `Resolved Paths`, `Active Configuration`, `Project Health`, `Documentation Context`, `Warnings`.
  - No whole-file dumps.
  - Any AGENTS/docs summary must be bounded to short extracted bullets/lines, never full sections.
  - No sensitive information (redact when needed).
  - Accurate path reporting (Global vs Project).

## Deliverables

- `doctor --verbose` implementation.
- Updated `src/cli/doctor.ts` with structured modes.
- Colorized, readable diagnostic sections.

## Task Breakdown

### Task W4.1 — Register `--verbose` Flag

- **Action:** Add `.option("-v, --verbose", "Enable verbose diagnostic output")` to the `doctor` command in `src/cli/index.ts`.

### Task W4.2 — Implement Normal Mode (Refactor)

- **Action:** Ensure current `doctor` output is the baseline for the default (concise) mode.
- **Action:** Clean up current status indicators (e.g., [OK], [MISSING]).

### Task W4.3 — Implement Verbose Mode Logic

- **Action:** Add logic to display resolved config locations and which one is active.
- **Action:** Add logic to check for and summarize project soul files (`AGENTS.md`, `.wunderkind/`, etc.).
- **Action:** Implement "Config Sections" summary (e.g., showing current personality choices).
- **Action:** Implement "Documentation Context" summary (e.g., docs-output state).

## QA Scenarios

```text
Scenario: Concise default output
  Setup: fixture environment with one installed scope and optional project context.
  Run: node bin/wunderkind.js doctor
  Assert: Output does not include the verbose-only section headers.
  Assert: Output includes install state and any project-health summary required by the default contract.
  Evidence: .sisyphus/evidence/w4-doctor-concise.txt

Scenario: Rich verbose output
  Setup: initialized project fixture with AGENTS.md and docs-output enabled.
  Run: node bin/wunderkind.js doctor --verbose
  Assert: Output includes mandatory sections: "Resolved Paths", "Active Configuration", "Soul-File Presence".
  Assert: "Resolved Paths" shows absolute paths.
  Assert: "Active Configuration" highlights the winning scope.
  Assert: "Soul-File Presence" lists .wunderkind/, AGENTS.md, .sisyphus/.
  Assert: No full file contents are printed.
  Assert: AGENTS/docs summaries are bounded excerpts only.
  Evidence: .sisyphus/evidence/w4-doctor-verbose.txt

Scenario: Accurate scope reporting
  Setup: Global install only.
  Run: node bin/wunderkind.js doctor
  Assert: Shows "Scope: Global" and points to the global config path.
  Evidence: .sisyphus/evidence/w4-doctor-scope-reporting.txt
```

## Commit Strategy

- **Commit W4-A**: `feat(cli): add verbose mode to doctor command`
- **Commit W4-B**: `feat(doctor): implement structured verbose diagnostic output`
- **Commit W4-C**: `test(doctor): add tests for normal and verbose modes`

## Exit Conditions

- [x] `doctor` remains concise.
- [x] `doctor --verbose` reveals internal path and config resolution logic.
- [x] No sensitive or excessive data is leaked in verbose mode, and verbose output follows the fixed section schema.
