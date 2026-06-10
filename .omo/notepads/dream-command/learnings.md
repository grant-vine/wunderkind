## [2026-04-05] Orchestrator Init: dream-command plan

### Command asset structure
- Static command assets live in `commands/*.md`
- Auto-discovered by `getPackagedCommandFilePaths()` at `src/cli/config-manager/index.ts:1080-1090`
- Copied globally by `writeNativeCommandFiles()` at `src/cli/config-manager/index.ts:1181-1207`
- Existing examples: `commands/docs-index.md` (no `name:` frontmatter), `commands/design-md.md` (has `name:`)
- `docs-index.md` frontmatter: `description:` + `agent:` only
- `design-md.md` frontmatter: `description:` + `agent:` + `name:`
- Both end with `<user-request>\n$ARGUMENTS\n</user-request>`

### Native command plumbing
- `getNativeCommandFilePaths()` at line 1142-1148: combines packaged + generated retained paths
- `detectNativeCommandFiles()` at line 1242-1248: returns `{ dir, presentCount, totalCount, allPresent }` — aggregate only, no per-filename
- `removeNativeCommandFiles()` at line 1283-1305: removes all command files by iterating `getNativeCommandFilePaths()`
- `getPackagedCommandNames()` at line 1088-1090: PRIVATE function, returns basenames without `.md` extension
- `assertNoNativeCommandNameCollisions()` at line 1096-1104: checks packaged vs generated retained names

### Doctor structure
- Project health section: `src/cli/doctor.ts:347-421` (standard)
- Verbose section: `src/cli/doctor.ts:423-488`
- `globalNativeCommands = detectNativeCommandFiles()` at line 375
- Standard output shows: `global native commands present:` (aggregate boolean) at line 420
- Verbose warning when `!globalNativeCommands.allPresent` fires at line 387-389 — only shows dir, not missing filenames
- To add `/dream` availability line: add after line 420 in project health section
- Verbose filename-diff: must be computed locally inside doctor.ts (no exported helper for this)
  - Pattern: read `getPackagedCommandNames()` equivalent by scanning installed commands dir
  - Compare against `getNativeCommandFilePaths()` which lists expected paths

### Test infrastructure
- `captureDoctorOutput()` helper at `tests/unit/init-doctor.test.ts:201-219`
- `mockProjectDoctorContext()` at `tests/unit/init-doctor.test.ts:231-265`
- Verbose doctor test at lines 880-926 asserts `global native commands dir:` in messages
- `writeNativeCommandFiles` test at `tests/unit/cli-installer.test.ts:1310-1354` — checks docs-index.md, design-md.md, threat-model.md, prd.md exist
- Config-manager coverage test at `tests/unit/config-manager-coverage.test.ts:543-575` — checks `getNativeCommandFilePaths()` includes specific files
- Uninstall test at `tests/unit/uninstall.test.ts:146-167` — global uninstall calls `removeNativeCommandFiles` once with no args
- Uninstall test at lines 169-197 — project uninstall does NOT call `removeNativeCommandFiles`

### Key constraint
- Do NOT change the exported signature of `detectNativeCommandFiles()`
- Do NOT add a generated retained `/dream` command (no `src/agents/slash-commands.ts` changes)
- `getPackagedCommandNames()` is PRIVATE — doctor.ts must compute its own filename list for verbose diff
  - Viable approach: compare `getNativeCommandFilePaths()` expected paths against `existsSync()` per-file

### SOUL file conventions
- SOUL files live at `.wunderkind/souls/<agent-key>.md`
- Runtime-injected by `src/index.ts` — command asset should reference these as context sources, not mutate them

## Learnings: dream-command

- Mirrored the structure of `commands/docs-index.md` and `commands/design-md.md` for `commands/dream.md`.
- Explicitly defined the three-phase workflow: **Ideation**, **Soul Synthesis**, and **Exploration**.
- Strictly restricted durable output to `.sisyphus/notepads/` and `.sisyphus/evidence/`.
- Explicitly excluded `.sisyphus/plans/` as a save target and forbade mutation of SOUL files (`.wunderkind/souls/`).
- Enforced a chat-first, save-on-explicit-request-only policy.
- Coordinator (`product-wunderkind`) handles selective, evidence-driven delegation among the 6 retained agents.
## Task 4 — uninstall coverage

- `tests/unit/uninstall.test.ts` already covers shared native command removal indirectly: global uninstall expects exactly one `removeNativeCommandFiles()` call with no args, while project uninstall expects zero calls.
- `tests/unit/config-manager-coverage.test.ts` already exercises the real `removeNativeCommandFiles()` path, which removes all paths from `getNativeCommandFilePaths()` and therefore includes `dream.md` automatically.
- Targeted verification passed without source changes: `bun test tests/unit/uninstall.test.ts tests/unit/config-manager-coverage.test.ts`.

## Task 5 — doctor RED tests for /dream availability

- Added a new end-of-file `describe("runDoctor /dream availability", ...)` block in `tests/unit/init-doctor.test.ts` with 3 contract tests: standard `/dream` availability, verbose stale `dream.md` reporting, and verbose healthy non-reporting.
- The existing `detectNativeCommandFiles()` mock is aggregate-only, so filename-specific stale expectations needed a new mocked `getNativeCommandFilePaths()` export in the test module wiring.
- Confirmed current RED gap: doctor still reports only aggregate `global native commands present:` in standard mode and only the commands directory in stale warnings, so the new `/dream` line and `dream.md` stale-name assertions fail as intended.
- Current targeted result for `bun test tests/unit/init-doctor.test.ts`: `35 pass`, `2 fail`. The healthy verbose non-reporting test already passes because current doctor output does not mention `dream.md` when installs are complete.
- Follow-up implementation target for Task 6: add explicit `/dream` availability output in project health and compute missing command filenames in verbose stale warnings without changing the `detectNativeCommandFiles()` signature.
## [2026-04-05] Task 8 — README update
Updated README.md to document the /dream native command. Added a dedicated /dream section and integrated upgrade instructions into the Upgrade lifecycle section. Verified that older installs are correctly prompted to upgrade and that the doctor command surfaces stale assets.

## [2026-04-05] Task 7 — dream.md hardening
- Hardened `commands/dream.md` with explicit sequencing of the three phases: **Ideation**, **Soul Synthesis**, and **Exploration**.
- Selective specialist delegation is now clearly selective and evidence-driven, with `product-wunderkind` as the coordinator.
- Save constraints are explicitly restricted to `.sisyphus/notepads/` and `.sisyphus/evidence/` only on explicit user request.
- Removed forbidden references to configuration files and planning directories to prevent scope drift and ambiguity.
- Verified changes using automated Python QA script for both positive and negative assertions.

## [2026-04-05] F3 manual QA pattern
- Safe manual `doctor` QA can be done with a temp HOME (`$TMP/home`) plus a temp project `cwd`; this avoids mutating the real `~/.config/opencode/opencode.json` while still exercising the real CLI.
- The most reliable sandbox setup is to write a minimal temp `opencode.json` plugin registration, then call compiled `dist/cli/config-manager/index.js` exports (`writeNativeAgentFiles`, `writeNativeCommandFiles`, `writeNativeSkillFiles`) to populate the temp OpenCode native asset dirs exactly like a real install.
- Running `node /absolute/path/to/bin/wunderkind.js doctor` from the sandbox project is important; invoking `node bin/wunderkind.js` from inside the temp project fails because the sandbox has no local `bin/` directory.
- For stale-command verification, deleting only temp `HOME/.config/opencode/commands/dream.md` is sufficient to make verbose `doctor` emit `missing native command files: dream.md` while keeping the rest of the install healthy.
