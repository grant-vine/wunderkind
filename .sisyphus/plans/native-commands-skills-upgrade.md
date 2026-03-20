# Native Commands, Skills, and Real Upgrade

## Goal

Expand Wunderkind's native OpenCode registration from agents-only to agents + commands + skills, and replace the current upgrade no-op with a real, safe, scope-aware asset refresh flow.

This is an alpha-stage feature. OMO must remain untouched in v1 of this change.

## Product Decisions

1. **Wunderkind-owned native assets** now means three asset kinds:
   - agents → markdown files in `agents/`
   - commands → markdown files in `commands/`
   - skills → directory trees in `skills/<name>/`
2. **Install behavior**
   - global install writes to:
     - `~/.config/opencode/agents/`
     - `~/.config/opencode/commands/`
     - `~/.config/opencode/skills/`
   - project install/init writes to:
     - `.opencode/agents/`
     - `.opencode/commands/`
     - `.opencode/skills/`
3. **Upgrade behavior**
   - default upgrade refreshes Wunderkind-owned native assets in the selected scope
   - default upgrade does **not** mutate OMO
   - `--dry-run` shows planned writes/removals only
   - `--refresh-config` rewrites Wunderkind config in canonical current format without changing values
   - explicit baseline overrides (`--region`, `--industry`, `--primary-regulation`, `--secondary-regulation`) remain supported
4. **Doctor behavior**
   - doctor reports presence of native agents, commands, and skills
   - doctor warns when expected Wunderkind-owned native assets are missing in a scope that should contain them
5. **Uninstall behavior**
   - uninstall removes only Wunderkind-owned agents, commands, and skills for the selected scope
   - shared OpenCode directories must be left intact unless empty after Wunderkind-owned content is removed

## Step 0 — Lock the native asset contract

Before implementation, treat the following as fixed:

1. **Agents** are written from the canonical manifest and generated markdown pipeline.
2. **Commands** are copied from packaged `commands/*.md` files exactly as shipped.
3. **Skills** are copied recursively from packaged `skills/<name>/` directories, preserving nested files.
4. **Detection/removal** must be Wunderkind-owned only; never wipe shared directories broadly.
5. **OMO mutation is out of scope** for this plan.

If implementation reveals any of these are false, stop and revise the plan before proceeding.

## Workstreams

### Workstream 1 — TDD for commands/skills asset lifecycle

Add failing tests first to lock the expected behavior.

#### Acceptance cases

1. Global install writes commands and skills into global OpenCode-native dirs.
2. Project install writes commands and skills into project `.opencode/` dirs.
3. Project init writes commands and skills into project `.opencode/` dirs.
4. Uninstall removes only Wunderkind-owned commands and skills from the selected scope.
5. Doctor reports command and skill presence/warnings alongside agents.

#### QA scenario (executable)

- Tool: `bun test`
- Files:
  - `tests/unit/cli-installer.test.ts`
  - `tests/unit/tui-installer-handoff.test.ts`
  - `tests/unit/init-doctor.test.ts`
  - `tests/unit/init-interactive.test.ts`
  - `tests/unit/uninstall.test.ts`
- Expected result:
  - failing first, then passing once asset lifecycle is implemented
  - assertions prove exact target paths and absence of unrelated deletions

### Workstream 2 — Shared asset registry/helpers in config-manager

Implement small internal helpers to manage all three Wunderkind-owned native asset kinds.

#### Required behavior

1. Provide target-dir helpers for agents, commands, and skills.
2. Provide write/detect/remove helpers for each asset kind.
3. Skills must copy recursively by skill directory, not only `SKILL.md`.
4. Asset inventory should be source-driven from packaged directories where possible.

#### QA scenario (executable)

- Tool: `bun test`
- Files:
  - `tests/unit/config-template.test.ts`
  - any new config-manager-focused tests if needed
- Expected result:
  - exact packaged asset inventory is detected
  - skill copy preserves nested files
  - remove helpers only delete Wunderkind-owned files/dirs

### Workstream 3 — Install/init/uninstall/doctor integration

Wire the new asset lifecycle into the CLI.

#### Required behavior

1. `install` writes agents + commands + skills.
2. `init` writes project-local agents + commands + skills.
3. `uninstall` removes agents + commands + skills for the selected scope.
4. `doctor` reports and warns on all three asset kinds.

#### QA scenario (executable)

- Tool: `bun test`
- Files:
  - installer/init/doctor/uninstall unit tests
- Expected result:
  - exact asset counts and target dirs are asserted
  - project-vs-global precedence remains path-driven and deterministic

### Workstream 4 — Real upgrade command

Replace the current effective no-op with a real asset refresh flow.

#### Required behavior

1. Default `upgrade` refreshes Wunderkind-owned native assets in the selected scope.
2. `--dry-run` reports what would happen without writing.
3. `--refresh-config` rewrites Wunderkind config in canonical form while preserving values.
4. Explicit baseline overrides continue to work.
5. No OMO mutation in v1.

#### QA scenario (executable)

- Tool: `bun test`
- Files:
  - `tests/unit/cli-installer.test.ts`
  - `tests/unit/cli-help-text.test.ts`
- Expected result:
  - default upgrade performs real writes/refresh
  - dry-run performs no writes
  - help text documents the new semantics and flags

### Workstream 5 — Docs/help/package alignment

Update public surfaces to match the new reality.

#### Required behavior

1. README explains native agents + commands + skills installation.
2. Upgrade docs/help describe real behavior instead of “safe no-op”.
3. `docs-index` remains correctly described as a namespaced command asset.

#### QA scenario (executable)

- Tools: `bun test`, `npm pack --dry-run`
- Expected result:
  - help text and README assertions pass
  - packed tarball still includes required commands/skills assets

## File Areas Likely Affected

- `src/cli/config-manager/index.ts`
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- `src/cli/uninstall.ts`
- `src/cli/index.ts`
- `README.md`
- unit tests covering install/init/doctor/uninstall/help/config template

## Verification Commands

```bash
bun test tests/unit/cli-installer.test.ts tests/unit/tui-installer-handoff.test.ts tests/unit/init-doctor.test.ts tests/unit/init-interactive.test.ts tests/unit/uninstall.test.ts
bun test tests/unit/cli-help-text.test.ts tests/unit/config-template.test.ts tests/unit/docs-config.test.ts tests/unit/docs-index-plan.test.ts
bun test
tsc --noEmit
bun run build
npm pack --dry-run
```

All must exit `0`.

## Atomic Commit Strategy

1. `test: cover native commands and skills asset lifecycle`
2. `feat: register native commands and skills in OpenCode dirs`
3. `test: cover real upgrade flow and flags`
4. `feat: make upgrade refresh Wunderkind-owned native assets`
5. `docs: update native asset and upgrade guidance`
