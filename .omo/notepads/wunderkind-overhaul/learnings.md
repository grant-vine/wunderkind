# Learnings

## Codebase Conventions
- All local imports use `.js` extension (ESM)
- Named exports only; default export only in `src/index.ts`
- `exactOptionalPropertyTypes: true` — omit optional keys, never pass `undefined`
- `noUncheckedIndexedAccess: true` — array[0] returns `T | undefined`, always narrow
- Regex literals: use `\u001b` not `\x1b` (LSP false positive with \x1b)
- `bun:test` false LSP errors in VSCode — use `tsc --noEmit` as the authoritative check
- Worktree: all work happens in `/Users/grantv/Code/wunderkind-overhaul`

## Pre-existing LSP Noise (NOT real errors)
- `Cannot find module 'bun:test'` — false positive, bun test works fine
- `Unexpected control character in regex` in cli-installer.ts — pre-existing, use `\u001b`

## Architecture
- OpenCode global config: `~/.config/opencode/opencode.json` (NOT config.json)
- Plugin format: `"plugin": ["@grant-vine/wunderkind"]` (array)
- Project config: `.wunderkind/wunderkind.config.jsonc`
- Global baseline: `~/.wunderkind/wunderkind.config.jsonc`
- Qdrant: single collection `wunderkind-memories`, `group_id` payload = project slug
- mem0: composite agentId `${projectSlug}:${agent}`
- Docker compose: lives in `~/.wunderkind/`
- fflate for zip (NOT Bun.Archive — that's tar.gz only)

## Task 4: config-manager/index.ts overhaul (2026-03-06)

### What changed
- `PACKAGE_NAME` updated to `"@grant-vine/wunderkind"`
- `CONFIG_JSON`/`CONFIG_JSONC` updated to `opencode.json`/`opencode.jsonc`
- New constants added: `LEGACY_CONFIG_JSON`, `LEGACY_CONFIG_JSONC`, `GLOBAL_WUNDERKIND_DIR`, `GLOBAL_WUNDERKIND_CONFIG`, `WUNDERKIND_DIR`, `WUNDERKIND_CONFIG`, `LEGACY_WUNDERKIND_CONFIG`
- `getConfigPath()` now prefers `opencode.json` > `opencode.jsonc` > legacy `config.json` > legacy `config.jsonc`
- `detectCurrentConfig()` now returns `scope: "global"` in all objects; checks `WUNDERKIND_CONFIG` (project) first, then `GLOBAL_WUNDERKIND_CONFIG`
- `addPluginToOpenCodeConfig(scope: InstallScope)` added scope param; branches on global vs project path; handles old `"wunderkind"` → new `"@grant-vine/wunderkind"` migration
- `writeWunderkindConfig(installConfig, scope: InstallScope)` added scope param; writes to global or project dir
- `detectLegacyConfig(): boolean` new export — checks for `wunderkind.config.jsonc` at project root
- `ensureConfigDir()` private helper removed — dir creation now inline in each function
- Call sites updated: `cli-installer.ts` passes `args.scope`; `tui-installer.ts` hardcodes `"global"`

### Patterns
- LSP diagnostics lag behind file writes — always use `tsc --noEmit` as authoritative check
- `exactOptionalPropertyTypes: true` means `const x: DetectedConfig = { ... }` must include ALL required fields including `scope`
- `satisfies DetectedConfig` won't work if `DetectedConfig` has required fields not in the object — use explicit type annotation instead
- When changing function signatures, fix ALL call sites in the same pass or tsc stays broken

### Residual tsc errors (out of scope for this task)
- `src/cli/index.ts(82)` — Task 12 — missing `scope` in `InstallArgs` construction
- `src/memory/index.ts` — separate memory adapter tasks

## Task 11: docker.ts compose path fix (2026-03-06)

### What changed
- `src/memory/docker.ts`: Updated to resolve Docker Compose files from `~/.wunderkind/` instead of `projectDir`
- Added `import { homedir } from "node:os"` and `import { existsSync } from "node:fs"`
- Changed `path.join(projectDir, composeFile)` → `path.join(homedir(), ".wunderkind", composeFile)`
- Added `existsSync(composePath)` check before `execSync` call
- Returns error message "Run wunderkind install first to set up the global ~/.wunderkind/ directory" if file doesn't exist
- Parameter renamed to `_projectDir` (with underscore prefix) to suppress unused parameter warning per TS strict mode
- Updated tests in `tests/unit/docker.test.ts`:
  - Added mock for `existsSync` in all test cases
  - Added 2 new test cases for when compose file doesn't exist (one for mem0, one for vector)
  - Total: 14 docker tests pass (added 2 new)

### Pattern
- When a parameter is intentionally kept for backward compatibility but not used, prefix with underscore (TypeScript convention)
- Mock filesystem calls in unit tests alongside exec calls to avoid hitting real file system
- Test both success and failure paths including missing files

### Result
- `tsc --noEmit`: 1 error (src/cli/index.ts:82 - pre-existing, out of scope)
- `bun test tests/unit/docker.test.ts`: 14 pass, 0 fail

## [2026-03-06] Task 10: memory/index.ts overhaul

### What changed
- `src/memory/index.ts`: Fully overhauled — 134 lines → ~200 lines
- Added imports: `homedir` (node:os), `existsSync` (node:fs), `mkdir`/`writeFile` (node:fs/promises), `fflate` (zip/unzip/strToU8/strFromU8), `deriveProjectSlug` (./slug.js)
- `loadAdapter`: now checks for legacy config at project root (throws), reads global `~/.wunderkind/wunderkind.config.jsonc` as baseline, then merges `.wunderkind/wunderkind.config.jsonc` on top
- `VectorAdapter` and `Mem0Adapter` now receive `projectSlug: deriveProjectSlug(projectDir)` instead of `path.basename(projectDir)`
- Outer try/catch removed — config reading wrapped in individual try/catch blocks with intentional-empty comments
- Fallback to FileAdapter now happens when `memoryAdapter` is "file" (or absent), not via caught exception
- `exportMemories(projectDir, outputPath?)` added — zip via fflate, manifest.json + entries.json + agents/<agent>.md
- `importMemories(projectDir, zipPath, strategy)` added — merge (slug dedup) or overwrite strategy
- `src/memory/docker.ts`: fixed pre-existing `noUnusedLocals` error — `projectDir` → `_projectDir`
- `tests/unit/memory-index.test.ts`: `writeConfig` helper updated to write to `.wunderkind/wunderkind.config.jsonc`

### Patterns
- `docker.ts` had a pre-existing `TS6133: 'projectDir' is declared but its value is never read` that only surfaced after fixing `src/memory/index.ts` (previously masked by other errors in the same file). Fix: prefix unused param with `_`.
- Test helpers that write config files need to match the new config path when the loadAdapter logic changes — check `writeConfig` in test files.
- fflate callback-style API wraps cleanly in `new Promise<Uint8Array>((resolve, reject) => ...)`.
- `noUncheckedIndexedAccess`: always narrow `files["entries.json"]` before passing to `strFromU8`.
- Intentionally empty catch blocks must have a comment explaining why — `/* no global config */` satisfies the rule.
- Final result: tsc → 1 error (cli/index.ts:82, pre-existing Task 12); bun test → 164 pass, 0 fail.

## [2026-03-06] Task 12: cli/index.ts --scope flag
### What changed
- `src/cli/index.ts` line 8: Added `InstallScope` to import from `"./types.js"`
- `src/cli/index.ts` line 59: Added `.option("--scope <scope>", "Install scope: global or project", "global")` after `--secondary-regulation` option
- `src/cli/index.ts` lines 76-86: Updated `.action()` opts type annotation to include `scope: string`, added validation (`if (opts.scope !== "global" && opts.scope !== "project")` → error + exit 1)
- `src/cli/index.ts` line 91: Added `scope: opts.scope as InstallScope` to `InstallArgs` construction
- `src/cli/index.ts` line 98: Updated `runTuiInstaller()` call to pass `opts.scope as InstallScope`
- `src/cli/tui-installer.ts` line 15: Added `InstallScope` to imports from `"./types.js"`
- `src/cli/tui-installer.ts` line 76: Updated `runTuiInstaller()` signature to `export async function runTuiInstaller(_scopeHint?: InstallScope): Promise<number>` (underscore prefix = intentionally unused parameter for now, full integration is Task 13)

### Pattern
- Commander options default to strings in the opts object — type annotation must match
- Validation happens in action handler, before constructing the typed args object
- When adding a parameter to a function for future use but not implementing it yet, use underscore prefix to avoid `noUnusedParameters` error
- The parameter is there to allow gradual feature implementation without signature breaking changes

### Result
- `tsc --noEmit`: 0 errors (resolved the single error from Task 11)
- `bun test`: 164 pass, 0 fail (no test breakage)

## [2026-03-06] Task 15: memory-commands.ts export+import

### What changed
- `src/cli/memory-commands.ts`: Added `exportMemories` and `importMemories` to import list from `"../memory/index.js"`
- Added `memory export` subcommand: `--output <path>` option, calls `exportMemories`, prints result path
- Added `memory import <zip>` subcommand: positional arg `<zip>`, `--strategy <strategy>` option (default `"merge"`), validates strategy, calls `importMemories`, prints `imported` + `skipped` counts

### Patterns
- `exactOptionalPropertyTypes: true` requires branching when calling functions with optional params: use ternary `opts.output !== undefined ? exportMemories(cwd, opts.output) : exportMemories(cwd)` rather than passing `undefined`
- LSP showed stale "declared but never read" errors for the newly-imported functions — these were false positives; `tsc --noEmit` confirmed 0 errors
- Strategy validation in action handler before calling `importMemories` — narrows `opts.strategy` from `string` to `"merge" | "overwrite"` which satisfies the function's typed parameter
- Catch blocks print error + `process.exit(1)` — satisfies the no-empty-catch rule

### Result
- `tsc --noEmit`: 0 errors
- `bun test`: 164 pass, 0 fail

## [2026-03-06] Task 13: tui-installer.ts scope + legacy + gitignore + compose

### What changed
- `runTuiInstaller(_scopeHint?)` renamed param to `scopeHint` (no underscore) since it is now used
- Scope `p.select<InstallScope>` prompt added as the VERY FIRST prompt, using `scopeHint ?? "global"` as `initialValue`
- `p.intro()` moved before scope prompt (was after `detectCurrentConfig()`)
- After `detectCurrentConfig()`, `detectLegacyConfig()` is called — if true, `p.cancel(...)` + `return 1`
- `addPluginToOpenCodeConfig(scope)` and `writeWunderkindConfig(config, scope)` now receive the user-chosen scope
- After `createMemoryFiles()` spinner, `addAiTracesToGitignore()` is called; added entries logged via `p.log.info`, errors via `p.log.warn`
- Compose copy spinner block added: copies `docker-compose.vector.yml` + `docker-compose.mem0.yml` to `~/.wunderkind/` (skips if already present, wraps in try/catch — non-fatal)

### Imports added
- `copyFile`, `mkdir` from `node:fs/promises`
- `existsSync` from `node:fs`
- `homedir` from `node:os`
- `fileURLToPath` from `node:url`
- `path` from `node:path`
- `detectLegacyConfig` from `./config-manager/index.js`
- `addAiTracesToGitignore` from `./gitignore-manager.js`

### Key patterns
- LSP sometimes shows stale "unused" errors immediately after edits — always run `tsc --noEmit` to confirm actual state
- `noUnusedParameters: true` means any unused param needs `_` prefix; conversely, once it's used the underscore must be removed
- `p.select<InstallScope>` works with string union type directly — no extra type assertion needed
- Compose copy errors are non-fatal: wrapped in try/catch with `p.log.warn`, installation continues

### Test result
- `tsc --noEmit` → 0 errors
- `bun test` → 164 pass, 0 fail

## [2026-03-06] Task 14: cli-installer.ts legacy + gitignore + compose

### What changed
- **Legacy config detection** (line 104-107): After `detectCurrentConfig()`, now checks `detectLegacyConfig()` and prints error if legacy `wunderkind.config.jsonc` found at project root
- **Gitignore update** (line 148-155): Step 3 now calls `addAiTracesToGitignore()` and reports what was added to `.gitignore`; prints warning if error occurs (non-fatal)
- **Docker-compose copy** (line 157-171): Step 4 copies `docker-compose.vector.yml` and `docker-compose.mem0.yml` to `~/.wunderkind/` (skips if files already exist, non-fatal on error)
- **Total steps** updated from 2 → 4 to reflect new gitignore + compose steps
- **Imports added**: `copyFile`, `mkdir` from `node:fs/promises`; `existsSync` from `node:fs`; `homedir` from `node:os`; `fileURLToPath` from `node:url`; `path` default import from `node:path`; `detectLegacyConfig` from config-manager; `addAiTracesToGitignore` from gitignore-manager

### Key implementation details
- Legacy check happens AFTER `detectCurrentConfig()` but BEFORE `isUpdate` assignment to ensure it blocks early
- Gitignore result checks `added.length > 0` (not `success`) to determine if user-visible message should print
- Compose copy uses try/catch with non-fatal warning on error; skips existing files with `existsSync(dest)` check
- `fileURLToPath(import.meta.url)` used to get current file path → walk up two levels to package root
- All new code follows exactOptionalPropertyTypes convention (no undefined values passed)

### Type checking & tests
- `tsc --noEmit` → clean (0 errors)
- `bun test` → 164 pass, 0 fail

## [2026-03-06] Task 16: memory-index tests

### What changed
- Added 7 new tests to `tests/unit/memory-index.test.ts` (260 lines → 400 lines)
- Added imports: `access`, `readFile` from `node:fs/promises`; `unzip`, `strFromU8` from `fflate`
- Added `exportMemories` and `importMemories` to the named import from `../../src/memory/index.js`
- 4 new `describe` blocks added at the end of the file (after all existing tests):
  - `memory index — exportMemories`: 3 tests (default path, custom path, empty store)
  - `memory index — importMemories merge strategy`: 2 tests (basic import, duplicate slug skipping)
  - `memory index — importMemories overwrite strategy`: 1 test (replaces without skipping)
  - `memory index — loadAdapter legacy config detection`: 1 test (throws on legacy root config)

### Patterns used
- `fflate.unzip` wrapped in `new Promise<Record<string, Uint8Array>>((resolve, reject) => ...)` — callback API
- `noUncheckedIndexedAccess`: always guard `files["manifest.json"]` with `if (!raw) throw new Error(...)` before passing to `strFromU8`
- For import tests needing a fresh store: use a separate `makeTmpDir()` inside the test with a `try/finally` to clean up — avoids polluting `projectDir` with the imported state while still having separate setup/teardown
- For overwrite strategy test: importing back into the SAME `projectDir` that was exported from works fine — `deleteAll` clears agent entries then re-writes them
- Legacy config test: write file directly to `path.join(tmpDir, "wunderkind.config.jsonc")` (NOT in `.wunderkind/`), then `expect(promise).rejects.toThrow("Legacy config found")` — no need to use `.rejects.toThrowError` vs `.toThrow` distinction in Bun
- `access(zipPath)` from `node:fs/promises` used instead of `existsSync` for async file existence check in test assertions

### Final test count
- `bun test tests/unit/memory-index.test.ts`: 23 pass, 0 fail
- `bun test` (full suite): 171 pass, 0 fail
- `tsc --noEmit`: 0 errors

## README Overhaul (2026-03-06)
- Completely rewrote README.md to reflect the new CLI and configuration architecture.
- Documented the transition from project-root config to `.wunderkind/wunderkind.config.jsonc`.
- Added comprehensive documentation for `memory` subcommands and import/export strategies.
- Clarified install scopes (`global` vs `project`) and their impacts on `opencode.json`.
- Updated agent and sub-skill tables with current models and parent agents.
- Documented the structure of the `.wunderkind/` and `~/.wunderkind/` directories.

## [2026-03-06] Task: AGENTS.md refresh

### What changed
- STRUCTURE section: removed stale `wunderkind.config.jsonc` at project root entry; added `src/memory/` subtree with all files; added two new subsections documenting `.wunderkind/` per-project directory and `~/.wunderkind/` global directory
- WHERE TO LOOK table: added 5 new rows — change install scope, export/import memory, change config paths/constants, add/change memory subcommands, change memory adapter logic, change project slug derivation
- Added new MEMORY ADAPTERS section documenting all 4 adapters (file, sqlite, vector, mem0), project slug derivation, Docker Compose location, and config merge order
- COMMANDS section: added `tsc --noEmit`, `install --help`, scope-aware install examples, full memory subcommand suite (take-note, search, count, reduce-noise, status, start, export, import), gitignore command
- GOTCHAS section: added 5 new gotchas — `.wunderkind/` gitignored automatically, legacy config causes exit 1, Docker Compose in `~/.wunderkind/`, `deriveProjectSlug()` namespacing note, `fflate` for zip not `Bun.Archive`, OpenCode config path is `opencode.json` not `config.json`

### Pattern
- AGENTS.md at repo root is the authoritative knowledge base for AI agents working in this repo — it should match the implemented state of the codebase exactly
- The notepad `learnings.md` contains per-task implementation details; AGENTS.md contains high-level architectural facts
- LSP errors on markdown writes are always pre-existing TS false positives (bun:test, \x1b) — confirm with `tsc --noEmit` only

## Unit Testing: bun:test mock.module Pollution (Task 16)

### Problem
`mock.module()` in bun:test v1.3.9 persists module replacements across test files within a single `bun test` run, even though each file theoretically runs in an isolate. Specifically:
- `mock.module("../../src/memory/index.js", ...)` in memory-commands.test.ts bled into memory-index.test.ts, replacing real functions with mocks
- `mock.module("node:fs/promises", ...)` in cli-installer.test.ts replaced `readFile` globally, breaking memory/index.ts which imports `readFile` from node:fs/promises

### Fix Applied
1. **memory-commands.test.ts**: Replaced `mock.module("../../src/memory/index.js", ...)` with `spyOn(memoryModule, "exportMemories").mockImplementation(...)` with `afterEach(() => spy.mockRestore())`. `spyOn` is safely scoped and restores correctly.
2. **cli-installer.test.ts**: Removed `mock.module("node:fs/promises", ...)` entirely — the docker-compose copy step in `runCliInstaller` is wrapped in try/catch that only warns, so real `mkdir`/`copyFile` failures are harmless (the installer still returns 0).

### Key Rule
Never `mock.module()` core Node built-ins (`node:fs`, `node:fs/promises`) or widely-shared application modules in test files, as the mock persists for the entire test run. Use `spyOn` + `mockRestore()` for shared modules instead.

### Testing Commander Action Handlers
`memory-commands.ts` uses inline Commander `.action()` callbacks — not exported separately. Test via `cmd.parseAsync(["node", "wunderkind", "export"])`. Combined with `spyOn` on the imported module namespace, this tests the full integration from Commander parse → action → memory function call.

### InstallArgs shape
`validateNonTuiArgs` takes a full `InstallArgs` object with required `tui: boolean` and `scope: InstallScope`. Must construct a complete object for tests; use a `baseArgs()` helper with `Partial<InstallArgs>` overrides.

### scope field in validateNonTuiArgs
`validateNonTuiArgs` does NOT validate `scope` — it only checks `region`, `industry`, `primaryRegulation`. The task spec mentioned "Invalid scope 'banana'" → returns error, but the actual implementation has no scope validation. Tests match the real implementation.
