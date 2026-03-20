# Native OpenCode Agent Cutover

## Goal

Migrate Wunderkind from unsupported OMO-config-based agent registration to native OpenCode agent registration while preserving:

- the existing Wunderkind plugin registration in OpenCode `plugin[]`
- the existing `.wunderkind` global/project config merge model
- the existing runtime prompt transform/docs injection behavior
- the current Wunderkind agent identities where the native surface allows them

This is an alpha-stage clean cutover. No compatibility shim for `.opencode/oh-my-opencode.jsonc` is required unless implementation reveals a hard blocker.

## Key Decisions

1. **Agent registration moves to OpenCode-native agents**
   - Global scope writes Wunderkind agent markdown files to `~/.config/opencode/agents/`
   - Project scope and/or project init write Wunderkind agent markdown files to `.opencode/agents/`
2. **`.wunderkind` remains the customization layer**
   - Global baseline stays in `~/.wunderkind/wunderkind.config.jsonc`
   - Project override stays in `.wunderkind/wunderkind.config.jsonc`
   - We do not regenerate project-local agents purely to encode personalities unless required by the native contract
3. **OMO stops being Wunderkind’s registry**
   - Remove `writeOmoAgentConfig()` usage from install/init flows
   - Stop treating `.opencode/oh-my-opencode.jsonc` as required for Wunderkind agents to load
   - OMO may remain an installed companion dependency/service layer, but not the source of truth for Wunderkind agents
4. **OpenCode-native markdown agents become the canonical install artifact**
   - Existing generated `agents/*.md` pipeline is reused/adapted
   - Package publish surface must include whatever native registration artifacts are required

## Step 0 — Lock the native contract before test writing

Before changing implementation or writing failing tests, freeze these decisions:

1. **Agent directories**
   - Global native agents are written to `~/.config/opencode/agents/`
   - Project native agents are written to `.opencode/agents/`
2. **Agent identity mapping**
   - OpenCode-visible Wunderkind agent IDs will be the markdown filenames without `.md`
   - Because OpenCode markdown agent identity is filename-driven, Wunderkind will use filename-safe IDs with no `:`
   - The native IDs will therefore be the existing package-local names already used in generated markdown files:
     - `marketing-wunderkind`
     - `creative-director`
     - `product-wunderkind`
     - `fullstack-wunderkind`
     - `brand-builder`
     - `qa-specialist`
     - `operations-lead`
     - `ciso`
     - `devrel-wunderkind`
     - `legal-counsel`
     - `support-engineer`
     - `data-analyst`
3. **Agent file content**
   - Native agent files must contain valid OpenCode markdown frontmatter at minimum:
     - `description`
     - `mode`
     - any required prompt body
   - Frontmatter `name:` is not relied on as identity; filename is canonical
4. **Init behavior after global install**
   - `wunderkind init` will write/refresh project-local native agent files in `.opencode/agents/`
   - This gives project-local precedence automatically and makes project customization deterministic without requiring UI/runtime discovery assumptions
5. **Doctor semantics**
   - Doctor reports plugin registration separately from native agent presence
   - Doctor no longer treats `.opencode/oh-my-opencode.jsonc` as required for Wunderkind health

## Resolved Contract Decisions

The five Step 0 decisions above are treated as fixed for this cutover. If implementation proves any one of them false, stop and revise the plan before continuing.

## Workstreams

### Workstream 1 — Contract tests first

Add or update failing tests to lock the target behavior before changing implementation.

#### Acceptance cases

1. **Global install**
   - adds `@grant-vine/wunderkind` to global OpenCode config
   - writes native Wunderkind agents to global OpenCode agents directory
   - does not write `.opencode/oh-my-opencode.jsonc`
2. **Project install**
   - adds `@grant-vine/wunderkind` to project OpenCode config
   - writes native Wunderkind agents to project `.opencode/agents/`
   - does not write `.opencode/oh-my-opencode.jsonc`
3. **Project init after global install**
   - writes `.wunderkind/wunderkind.config.jsonc`
   - writes/refreshes project-native agent files in `.opencode/agents/`
   - does not write `.opencode/oh-my-opencode.jsonc`
4. **Doctor**
   - reports native agent presence/health instead of OMO config presence
   - shows `project registration: ✗ no` dimly when only global registration exists
5. **Uninstall**
   - removes native agent files for the selected scope
   - removes plugin registration for the selected scope
6. **Config merge/docs behavior**
   - existing `.wunderkind` config merge behavior stays intact
   - existing runtime docs injection behavior stays intact

#### QA scenario (executable)

- Tool: `bun test`
- Files: `tests/unit/cli-installer.test.ts`, `tests/unit/tui-installer-handoff.test.ts`, `tests/unit/init-doctor.test.ts`, `tests/unit/init-interactive.test.ts`
- Expected result:
  - failing first, then passing once cutover behavior is implemented
  - assertions prove exact target paths, exact file counts, and absence of `.opencode/oh-my-opencode.jsonc`

### Workstream 2 — Canonical native agent manifest/source of truth

Create a Wunderkind-owned representation for native agent metadata that can drive:

- OpenCode markdown frontmatter
- install-time writing of native agents
- doctor visibility checks
- future docs/help output

The canonical source must avoid splitting identity/metadata across `oh-my-opencode.jsonc` and generated markdown.

#### QA scenario (executable)

- Tool: `bun test`
- Files: `tests/unit/config-template.test.ts` (or renamed/reworked equivalent), plus any new manifest-specific test file
- Expected result:
  - manifest enumerates exactly 12 native agent IDs
  - generated filenames match the manifest IDs exactly
  - generated frontmatter includes the required OpenCode-native fields
  - no test references `wunderkind:*` IDs as the agent registration source of truth anymore

### Workstream 3 — Registration cutover

Update the core registration paths:

- `src/cli/config-manager/index.ts`
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- uninstall flow(s) if native-agent cleanup is required there

Required behavior:

- native agent files are written to the correct scope directory
- OMO config file writing is removed
- doctor checks native agent presence, not OMO config presence
- plugin registration remains in `opencode.json`/`~/.config/opencode/opencode.json`

#### QA scenario (executable)

- Tool: `bun test`
- Files: installer/init/doctor/uninstall unit tests
- Expected result:
  - global install writes 12 files under mocked global agents dir
  - project install writes 12 files under mocked project `.opencode/agents/`
  - init after global install writes project `.opencode/agents/`
  - doctor reports native-agent presence line(s) and no OMO-agent-config requirement
  - uninstall removes only scope-targeted native agent files

### Workstream 4 — Docs/help/package surface

Update:

- `README.md`
- help/doctor/install text
- package `files` surface
- tests that currently assert `oh-my-opencode.jsonc` content or OMO warnings

Remove or replace any published/tested surface that still claims OMO config is how Wunderkind agents load.

#### QA scenario (executable)

- Tools: `bun test`, `npm pack --dry-run`
- Files: README/help/package-surface tests
- Expected result:
  - docs no longer claim `.opencode/oh-my-opencode.jsonc` is required for Wunderkind agents
  - package no longer publishes obsolete OMO registration assets if they are unused
  - pack output still includes the generated agent assets and required schemas/commands

### Workstream 5 — Verification and release

Required verification commands:

```bash
bun test tests/unit/cli-installer.test.ts tests/unit/tui-installer-handoff.test.ts tests/unit/init-doctor.test.ts
bun test tests/unit/config-template.test.ts tests/unit/docs-injection.test.ts tests/unit/agent-factories.test.ts tests/unit/uninstall.test.ts tests/unit/cli-help-text.test.ts
bun test
tsc --noEmit
bun run build
npm pack --dry-run
```

Then:

- Oracle final review
- atomic commits
- version bump
- tag
- push
- npm publish

#### QA scenario (executable)

- Tools and expected results:
  - `bun test tests/unit/cli-installer.test.ts tests/unit/tui-installer-handoff.test.ts tests/unit/init-doctor.test.ts tests/unit/init-interactive.test.ts` → exit 0
  - `bun test tests/unit/config-template.test.ts tests/unit/docs-injection.test.ts tests/unit/agent-factories.test.ts tests/unit/uninstall.test.ts tests/unit/cli-help-text.test.ts` → exit 0
  - `bun test` → exit 0
  - `tsc --noEmit` → exit 0
  - `bun run build` → exit 0
  - `npm pack --dry-run` → exit 0
  - Oracle final review returns approve or only non-blocking comments

## File Areas Likely Affected

- `src/cli/config-manager/index.ts`
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- `src/build-agents.ts`
- `src/index.ts` (only if prompt/runtime assumptions need wording changes)
- `package.json`
- `README.md`
- unit tests covering install/init/doctor/config-template/help/uninstall

## QA Notes

- No manual OpenCode UI verification should be required for acceptance.
- Native agent install behavior must be testable by filesystem assertions alone.
- Preserve current `.wunderkind` config merge and docs-output semantics unless a native-agent limitation forces a change.
- File precedence must be asserted by path and scope, not assumed from documentation alone.

## Atomic Commit Strategy

1. `test: lock native opencode agent registration behavior`
2. `build: add native wunderkind agent manifest and writer`
3. `feat: migrate wunderkind registration off OMO config`
4. `docs: update native agent install and doctor guidance`
5. `chore: prepare native-agent alpha release`
