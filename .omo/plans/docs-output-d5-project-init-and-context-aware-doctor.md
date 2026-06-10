# Docs Output D5 — Project Init and Context-Aware Doctor

## Objective

Make project bootstrap a first-class part of the docs-output solution: add `wunderkind init`, let interactive install optionally initialize the current project when run inside a project folder, move project-local personality and docs-output questions behind init, provision project-local soul files, and add `wunderkind doctor` that always shows install info and adds project checks when run inside a project.

## Scope

This child plan covers the active project-bootstrap and doctor work that was previously scattered across deferred installer UX / install-state / doctor ideas.

## Depends On

- D1 must be complete.
- D2 must be complete.
- D3 has no hard dependency on D5.

## Files Likely in Scope

- `src/cli/index.ts`
- likely new `src/cli/init.ts`
- likely new `src/cli/doctor.ts`
- `src/cli/tui-installer.ts`
- `src/cli/cli-installer.ts`
- `src/cli/config-manager/index.ts`
- `src/cli/types.ts` if command-specific types are needed
- related CLI/unit test files

## Product Decisions Locked In

- `init` is a project bootstrap command.
- During interactive install, if the current working directory is a project, ask once whether to initialize that project now.
- `init` is CLI-based for now; it is not a full-screen TUI-first command.
- `init` provisions project-local customizations and soul files.
- `init` does **not** add or update the local `opencode.json` plugin entry.
- Docs-output settings are project-init customizations and are asked only in init flows.
- Project-local personality choices are asked only in init flows.
- `doctor` always shows install info and adds project info/checks when run in a project folder.

## Frozen CLI Contract

### `install`

- `install` handles plugin registration only.
- When run interactively in project context, `install` asks once whether to initialize the current folder now.
- If the user declines init, `install` continues with install-only work and must skip init-only personality and docs-output questions.
- `install` does not provision project soul files unless the user explicitly enters an init path.

### `init`

- `init` is a CLI-based current-folder bootstrap command.
- `init` may bootstrap the current folder when that folder is either:
  - already recognized as project context by D5.1, or
  - an empty/new folder the user is explicitly targeting as the project root.
- `init` must never silently target a parent directory.
- `init` provisions project-local customizations and soul files only.
- `init` never mutates the local `opencode.json` plugin entry.
- Docs-output and personality choices are collected only in init flows.

### `doctor`

- `doctor` always prints an install information section.
- When run in project context, `doctor` also prints a project information section.
- `doctor` must separate healthy state from warnings clearly.
- `doctor` is read-only and never mutates files.
- Default `doctor` exit behavior is:
  - exit 0 when checks can run successfully, even if warnings are reported
  - exit 1 only for command/runtime failures that prevent doctor from completing its checks

## Deliverables

- project-context detection used by `install`, `init`, and `doctor`
- interactive install handoff into init when in a project folder
- CLI-based `wunderkind init` for current-folder bootstrap
- init-only project-local personality and docs-output customizations
- minimum project soul-file provisioning
- context-aware `wunderkind doctor` (default and optional detailed output if needed)

## Task D5.1 — TDD project-context detection and install-to-init routing

### What to do
- Define the project-context contract used by `install`, `init`, and `doctor`.
- Detect whether the current working directory should be treated as a project target.
- During interactive install, ask once whether to initialize the current project when in project context.
- If the user declines, continue base install without project-local personality or docs-output questions.
- Keep install scope selection and init routing as separate concepts:
  - install scope controls plugin registration target
  - init controls project-local bootstrap in the current folder
- Freeze the product-level rule as: current working directory only, no upward traversal, no silent parent-project targeting.

### Must NOT do
- Do not traverse upward and silently initialize a parent project.
- Do not ask the init question when the current working directory is not a project.
- Do not mix plugin-registration decisions with soul-file initialization decisions.

### Acceptance Criteria
- [ ] project-context detection is explicit and test-covered
- [ ] interactive install asks once about init only in project context
- [ ] declining init skips project-local personality and docs-output prompts

### QA Scenarios
```text
Scenario: Install inside project asks once about init
  Tool: Bash / interactive
  Setup:
    1. Create a fixture directory containing a minimal project marker set chosen by the implementation
  Steps:
    1. Run interactive install in that fixture
    2. Capture the transcript
    3. Assert the init question appears exactly once
  Evidence: .sisyphus/evidence/d5-install-asks-init-once.txt

Scenario: Install outside project does not ask about init
  Tool: Bash / interactive
  Setup:
    1. Create a fixture directory without project markers
  Steps:
    1. Run interactive install in that fixture
    2. Capture the transcript
    3. Assert the init question does not appear
  Evidence: .sisyphus/evidence/d5-install-no-init-outside-project.txt

Scenario: Declining init skips project-local prompts
  Tool: Bash / interactive
  Setup:
    1. Create a project-context fixture directory
  Steps:
    1. Run interactive install
    2. Decline the init prompt
    3. Capture the transcript
    4. Assert no docs-output or project-local personality questions appear after decline
  Evidence: .sisyphus/evidence/d5-install-decline-init.txt
```

## Task D5.2 — Add CLI-based `wunderkind init`

### What to do
- Add `init` to `src/cli/index.ts`.
- Make `init` target the current working directory only.
- Keep it CLI-based rather than full-screen TUI-first.
- Support explicit arguments for project-local bootstrap where appropriate.
- If required values are missing and the command has a TTY, it may prompt inline; in non-TTY mode, fail clearly with usage guidance.
- If Wunderkind is not installed yet, fail with a clear message telling the user to run install first, because plugin registration is owned by `install`, not `init`.

### Must NOT do
- Do not mutate the local `opencode.json` plugin entry.
- Do not reinterpret `init` as a second install command.
- Do not bootstrap an arbitrary path; current folder only.

### Acceptance Criteria
- [ ] `node bin/wunderkind.js init --help` clearly documents current-folder bootstrap
- [ ] `init` refuses to run unclearly when Wunderkind is not installed
- [ ] `init` is idempotent on re-run in the same folder

### QA Scenarios
```text
Scenario: Init help documents current-folder bootstrap
  Tool: Bash
  Steps:
    1. Run: node bin/wunderkind.js init --help
    2. Assert exit code 0
    3. Assert output states that init bootstraps the current folder
  Evidence: .sisyphus/evidence/d5-init-help.txt

Scenario: Init requires Wunderkind to be installed first
  Tool: Bash
  Setup:
    1. Use a fixture environment with no installed Wunderkind plugin registration
  Steps:
    1. Run: node bin/wunderkind.js init --no-tui
    2. Assert exit code 1
    3. Assert output instructs the user to run install first
  Evidence: .sisyphus/evidence/d5-init-requires-install.txt

Scenario: Re-running init is idempotent
  Tool: Bash
  Setup:
    1. Use a fixture project folder with Wunderkind already initialized once
  Steps:
    1. Run init a second time in the same folder
    2. Assert exit code 0
    3. Assert existing soul files are preserved or safely updated per the frozen rules
  Evidence: .sisyphus/evidence/d5-init-idempotent.txt
```

## Task D5.3 — Init-only project-local customizations and soul files

### What to do
- Move project-local personality collection behind init.
- Move docs-output settings behind init.
- Reuse existing/global values as defaults where practical instead of forcing full re-entry.
- Define and provision the minimum soul-file set for a project:
  - `.wunderkind/wunderkind.config.jsonc`
  - project `AGENTS.md`
  - `.sisyphus/plans/`
  - `.sisyphus/notepads/`
  - `.sisyphus/evidence/`
  - `<docsPath>/README.md` when docs output is enabled
- Preserve existing project files unless it is clearly safe to update them.

### Must NOT do
- Do not ask project-local personality or docs-output questions during base install without init.
- Do not overwrite user-authored project files blindly.
- Do not treat init as a plugin-registration step.

### Acceptance Criteria
- [ ] install without init does not ask project-local personality questions
- [ ] init writes project-local personality and docs-output customizations
- [ ] init provisions the agreed soul files in the current folder
- [ ] existing files are preserved or updated only by explicit safe rules

### QA Scenarios
```text
Scenario: Init writes project-local customizations
  Tool: Bash
  Setup:
    1. Use a fixture project folder with install already complete
  Steps:
    1. Run init with project-local personality and docs-output values
    2. Assert exit code 0
    3. Assert `.wunderkind/wunderkind.config.jsonc` contains the expected project-local values
  Evidence: .sisyphus/evidence/d5-init-project-config.txt

Scenario: Init provisions soul files
  Tool: Bash
  Setup:
    1. Use a fixture project folder with install already complete
  Steps:
    1. Run init with docs output enabled
    2. Assert exit code 0
    3. Assert `.wunderkind/wunderkind.config.jsonc`, `AGENTS.md`, `.sisyphus/plans/`, `.sisyphus/notepads/`, `.sisyphus/evidence/`, and `<docsPath>/README.md` exist
  Evidence: .sisyphus/evidence/d5-init-soul-files.txt

Scenario: Base install skips init-only questions when init is not entered
  Tool: Bash / interactive
  Setup:
    1. Use a project-context fixture folder
  Steps:
    1. Run interactive install
    2. Decline init
    3. Capture the transcript
    4. Assert docs-output and project-local personality questions never appear
  Evidence: .sisyphus/evidence/d5-install-skips-init-only-prompts.txt
```

## Task D5.4 — Add context-aware `wunderkind doctor`

### What to do
- Add `doctor` as a CLI command.
- Always report install information:
  - whether Wunderkind is installed
  - plugin registration / config availability relevant to install state
- When in a project folder, also report project information and checks:
  - current project path
  - local `.wunderkind/wunderkind.config.jsonc`
  - local project soul-file presence
  - docs-output project settings summary when present
  - local plugin/project config status as information, without mutating it
- Support a more detailed output mode if needed by the final implementation, but the default mode must already distinguish install-only vs project-aware behavior.

### Frozen default doctor output

- Section 1: `Install Information`
  - installed / not installed
  - plugin registration status relevant to install state
  - global config presence summary
- Section 2: `Project Information` (project context only)
  - current project path
  - local `.wunderkind/wunderkind.config.jsonc` status
  - local soul-file presence summary
  - docs-output summary when present
- Section 3: `Warnings` (only when needed)
  - missing local soul files
  - missing local project config
  - missing project markers expected by the chosen context rules

### Must NOT do
- Do not require project context for doctor to be useful.
- Do not hide install information when run inside a project.
- Do not mutate project files as part of doctor.

### Acceptance Criteria
- [ ] doctor always shows install info
- [ ] doctor adds project info/checks when in project context
- [ ] doctor output cleanly separates warnings from healthy state

### QA Scenarios
```text
Scenario: Doctor outside project reports install info only
  Tool: Bash
  Setup:
    1. Use a non-project fixture directory
  Steps:
    1. Run: node bin/wunderkind.js doctor
    2. Assert exit code 0
    3. Assert output contains `Install Information`
    4. Assert output does not contain `Project Information`
  Evidence: .sisyphus/evidence/d5-doctor-outside-project.txt

Scenario: Doctor inside project reports install plus project info
  Tool: Bash
  Setup:
    1. Use a project fixture directory with Wunderkind initialized
  Steps:
    1. Run: node bin/wunderkind.js doctor
    2. Assert exit code 0
    3. Assert output contains both `Install Information` and `Project Information`
    4. Assert docs-output summary is present when configured
  Evidence: .sisyphus/evidence/d5-doctor-inside-project.txt

Scenario: Doctor warns on missing local soul files
  Tool: Bash
  Setup:
    1. Use a project fixture directory with some soul files intentionally absent
  Steps:
    1. Run: node bin/wunderkind.js doctor
    2. Assert exit code 0
    3. Assert output contains a `Warnings` section listing the missing files
  Evidence: .sisyphus/evidence/d5-doctor-missing-soul-files.txt
```

## Task D5.5 — Integration QA and D4 handoff

### What to do
- Add integration scenarios for:
  - interactive install inside a project, accept init
  - interactive install inside a project, decline init
  - standalone `init`
  - `doctor` outside a project
  - `doctor` inside a project

### D4 Docs Handoff

D4 must document these exact surfaced rules:
- `install` registers plugin configuration; `init` bootstraps the current folder
- docs-output settings are init-only project settings
- `init` does not mutate local `opencode.json`
- `doctor` always shows install info and adds project info/checks in project context
- `docsPath` defines the project docs folder and `<docsPath>/README.md` bootstrap location

### Acceptance Criteria
- [ ] integration scenarios cover install/init/doctor boundaries
- [ ] D4 has a stable contract for final documentation wording

### QA Scenarios
```text
Scenario: Install/init/doctor integration coverage exists
  Tool: Bash
  Steps:
    1. Run the targeted integration test command covering install accept-init, install decline-init, standalone init, doctor outside project, and doctor inside project
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/d5-integration-coverage.txt

Scenario: D4 handoff contract is recorded
  Tool: Read
  Steps:
    1. Read this D5 handoff subsection
    2. Assert it lists the exact rules D4 must reflect
  Evidence: .sisyphus/evidence/d5-d4-handoff.txt
```

## Commit Strategy

- **Commit D5-A**: `feat(cli): add project-context detection and install-to-init routing`
- **Commit D5-B**: `feat(cli): add wunderkind init command for current-project bootstrap`
- **Commit D5-C**: `feat(cli): gate init-only customizations and provision soul files`
- **Commit D5-D**: `feat(cli): add context-aware doctor command`
- **Commit D5-E**: `test(cli): add install init and doctor integration coverage`

## Exit Conditions

- [ ] D5.1 complete
- [ ] D5.2 complete
- [ ] D5.3 complete
- [ ] D5.4 complete
- [ ] D5.5 complete
- [ ] D4 has the final surfaced behavior it needs to document
