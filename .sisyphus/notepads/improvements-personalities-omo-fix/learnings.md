
## personality-meta.ts Module

**Created**: personality-meta.ts as pure metadata file for all personality/config types and docs history modes.

**Structure**:
- `PersonalityMeta` interface: `{ label: string; hint: string }`
- `PERSONALITY_META`: Record with 14 top-level keys (teamCulture, orgStructure, ciso, cto, cmo, qa, product, ops, creative, brand, devrel, legal, support, dataAnalyst)
- `DOCS_HISTORY_META`: Record with 4 modes (overwrite, append-dated, new-dated-file, overwrite-archive)

**Key decisions**:
- Used `.js` extension in imports (ESM convention for compiled output)
- Only imported `DocHistoryMode` type; unused personality types removed to satisfy strict compiler
- Named exports only (no default export per AGENTS.md convention)
- Reused exact hint strings from src/cli/init.ts lines 68-76 for teamCulture and orgStructure
- Used explicit Record key unions instead of `as const` for runtime type safety

**Verification**:
- tsc --noEmit: ✓ clean
- Object.keys(PERSONALITY_META).length === 14: ✓
- Object.keys(DOCS_HISTORY_META).length === 4: ✓
- No default export: ✓

---

## writeOmoAgentConfig() Function

**Location**: `src/cli/config-manager/index.ts` lines 562-574

**Signature**: `export function writeOmoAgentConfig(targetDir: string): ConfigMergeResult`

**Purpose**: Reads the bundled `oh-my-opencode.jsonc` from package root and writes it to `<targetDir>/.opencode/oh-my-opencode.jsonc`.

**Implementation details**:
- Uses `fileURLToPath(new URL("../../../oh-my-opencode.jsonc", import.meta.url))` to resolve source file path from compiled `dist/cli/config-manager/index.js`
- Added new import: `import { fileURLToPath } from "node:url"` at line 4
- Reused existing imports: `readFileSync`, `mkdirSync`, `writeFileSync`, `join`
- Returns `ConfigMergeResult` type (already imported from `../types.js`)
- Success case: `{ success: true, configPath: omoConfigPath }`
- Error case: `{ success: false, configPath: omoConfigPath, error: String(err) }`

**Verification**:
- tsc --noEmit: ✓ clean (0 errors)
- npm run build: ✓ succeeds (agents generated)
- Compiled output verified in `dist/cli/config-manager/index.js`: ✓ correct export
- Pattern follows `writeGlobalWunderkindConfig` and `writeProjectWunderkindConfig`

---

## doctor.ts Update — Agent Personalities Display

**Location**: `src/cli/doctor.ts`

**Changes**:
1. Added import: `import { PERSONALITY_META } from "./personality-meta.js"` (line 12)
2. Added OMO config detection: `const omoConfigPath = join(cwd, ".opencode", "oh-my-opencode.jsonc")` and `const hasOmoConfig = existsSync(omoConfigPath)` (lines 103-104)
3. Added warning for missing OMO config when projectInstalled is true (lines 112-114): `if (!hasOmoConfig && detected.projectInstalled === true) { warnings.push(...) }`
4. Added OMO config status line to Project Health section (line 122): `line("OMO agent config present:", status(hasOmoConfig))`
5. Renamed "Documentation Context" → "Project Configuration" (line 125)
6. Added "Agent Personalities" section under verbose block (lines 132-156):
   - Displays all 12 agents + 1 data analyst personality
   - Each line: `agent: <token> (<hint>)` with color coding
   - Safe access: `projectConfig?.<field> ?? detected.<field>` fallback to defaults
   - Graceful degradation: `PERSONALITY_META.<agent>[token]?.hint ?? rawToken` for unknown tokens
   - No crashes on undefined hint values

**Structure of Agent Personalities block**:
```
section("Agent Personalities")
for each agent (ciso, cto, cmo, qa, product, ops, creative, brand, devrel, legal, support, dataAnalyst):
  const val = projectConfig?.<field> ?? detected.<field>
  line("<agent>:", `${color.cyan(val)}  ${color.dim(`(${PERSONALITY_META.<agent>[val]?.hint ?? val})`)`)
```

**Verification**:
- Imports: PERSONALITY_META used (no unused import warnings) ✓
- Verbose-only: section only rendered when `options.verbose === true` ✓
- Graceful degradation: `?.hint ?? fallback` pattern handles unknown tokens without crashes ✓
- Project-scoped: entire block inside `if (inProject)` guard ✓
- No `as any`, `@ts-ignore`, `@ts-expect-error`: all typing correct ✓
- Non-verbose path preserved: line 158 still shows docs-output status ✓
- Legacy warnings preserved: lines 165-172 unchanged ✓

---

## init.ts Update — Personality Hints + Docs History Mode Select

**Location**: `src/cli/init.ts`

**Changes**:
1. Added import at line 6: `import { DOCS_HISTORY_META, PERSONALITY_META } from "./personality-meta.js"`
2. Updated all 12 personality `p.select` calls (lines 144-272) to include `hint` on each option
3. Replaced `p.text` docs history mode prompt (old lines 303-314) with `p.select` (new lines 304-315)
4. Removed now-unreachable validation check that was inside the old `p.text` block

**Personality hints implementation**:
- All 12 personality blocks follow pattern: `{ value: "<token>", label: "<token>", hint: PERSONALITY_META.<agent>["<token>"]!.hint }`
- Used non-null assertions `!` on all hint accesses (safe because personality-meta guarantees all keys exist)
- Maps correctly:
  - CISO block → PERSONALITY_META.ciso
  - CTO block → PERSONALITY_META.cto
  - CMO block → PERSONALITY_META.cmo
  - QA block → PERSONALITY_META.qa
  - Product block → PERSONALITY_META.product
  - Ops block → PERSONALITY_META.ops
  - Creative block → PERSONALITY_META.creative
  - Brand block → PERSONALITY_META.brand
  - DevRel block → PERSONALITY_META.devrel
  - Legal block → PERSONALITY_META.legal
  - Support block → PERSONALITY_META.support
  - Data Analyst block → PERSONALITY_META.dataAnalyst

**Docs history mode select replacement**:
- Old: `p.text` with placeholder "overwrite" and validation function
- New: `promptSelect<DocHistoryMode>(...)` with 4 options + hints from DOCS_HISTORY_META
- Reuses existing `promptSelect<T>` helper (lines 79-87)
- Options: overwrite, append-dated, new-dated-file, overwrite-archive
- Each option includes hint from DOCS_HISTORY_META (e.g., "Replaces the file each time (default)")
- Return type narrowed: `promptSelect` returns `T | null` instead of raw string validation

**Validation removed**:
- Old explicit validation block (lines 310-313) no longer needed
- `p.select` constrains to valid enum values at type level
- Validation check at line 345 (`validateDocHistoryMode(config.docHistoryMode)`) still present for non-interactive path safety

**Verification**:
- tsc --noEmit: ✓ clean (0 errors)
- No unused imports: ✓ (both PERSONALITY_META and DOCS_HISTORY_META used)
- All 12 personality blocks have hint: ✓
- Docs history mode is select, not text: ✓
- Non-interactive path unchanged: lines 125-126 still read from options.docHistoryMode
- No `as any`, `@ts-ignore`: ✓ only non-null assertions used (justified)


---

## Task 5: Wire writeOmoAgentConfig into Three Call Sites

**Location**: `src/cli/init.ts`, `src/cli/cli-installer.ts`, `src/cli/tui-installer.ts`

**Changes**:

### 1. `src/cli/init.ts` (lines 4, 356-360)
- Added `writeOmoAgentConfig` to import at line 4 (already imported `writeWunderkindConfig`)
- Inserted `writeOmoAgentConfig(process.cwd())` call after `writeWunderkindConfig` success check (lines 356-360)
- Always runs on project-scope (runInit is always project-scoped per AGENTS.md)
- Returns 1 on failure, blocking AGENTS.md creation (line 362)

### 2. `src/cli/cli-installer.ts` (lines 3-11, 167-173)
- Added `writeOmoAgentConfig` to import list (lines 3-11)
- Inserted conditional block `if (args.scope === "project")` after config write (lines 167-173)
- Guard prevents global-scope runs
- Returns 1 on failure
- Prints success message with configPath

### 3. `src/cli/tui-installer.ts` (lines 3-11, 230-238)
- Added `writeOmoAgentConfig` to import list (lines 3-11)
- Inserted conditional block `if (scope === "project" && !shouldInitProjectNow)` after spinner.stop (lines 230-238)
- Guard prevents both global-scope AND double-writes (when runInit called at line 261, it will write OMO config via init.ts)
- Failure: `spinner.stop(red(...))`, `p.outro(red(...))`, return 1
- Success: `p.log.success(...)` with configPath

**Verification**:
- tsc --noEmit: ✓ exit 0 (0 errors)
- bun run build: ✓ all 12 agents generated
- Guard logic: project-scope only ✓
- Double-write protection: `!shouldInitProjectNow` check prevents OMO rewrite when runInit hands off ✓
- Error handling: all failure paths return 1 ✓
- No unused imports: all writeOmoAgentConfig calls used ✓
- No `as any`, `@ts-ignore`: ✓ clean types

**Pattern adherence**:
- Follows existing pattern: check result.success, error on failure, success message on success
- Uses same return/error reporting style as writeWunderkindConfig calls
- Integrates seamlessly into existing control flow

## Task 6: Test Updates

Updated `tests/unit/init-interactive.test.ts` to mock and clear `writeOmoAgentConfig`, assert the existing interactive init path writes OMO config once, and add a docs-enabled interactive test that exercises the new docs history mode select path. Updated `tests/unit/init-doctor.test.ts` to include the new mock, cover `runInit` writing OMO config in project context, and add doctor coverage for missing project OMO config warnings plus verbose Agent Personalities output when inside a project. Updated `tests/unit/cli-installer.test.ts` to assert project/global install behavior for `writeOmoAgentConfig` and add real-filesystem tests proving the helper writes `.opencode/oh-my-opencode.jsonc` and remains idempotent. Updated `tests/unit/tui-installer-handoff.test.ts` to assert the TUI skips direct OMO writes when handing off to `runInit`, does write OMO config on install-only project flow, and covers an explicit project-scope no-init path. Gotcha: Bun mock typings in this repo expose `mockImplementation` but not `mockImplementationOnce`, so per-test overrides had to rely on `beforeEach` resets plus test-local `mockImplementation` instead of one-shot mocks.

---

## F3 Manual QA Findings (2026-03-11)

- `bun run build` succeeded and regenerated 12 files under `agents/`.
- `node bin/wunderkind.js --help`, `init --help`, and `doctor --help` all ran without crashing, but init help exposes `--doc-history-mode` instead of the documented `--docs-history-mode` name.
- Non-interactive global install from repo root exited 1 with `Legacy config found at project root wunderkind.config.jsonc`, so the happy-path expectation for Scenario 3 was not met in this environment.
- Project-scope install in a temp dir successfully wrote `.opencode/oh-my-opencode.jsonc`; file contents include `wunderkind:ciso`.
- `doctor --verbose` in that temp dir exited 0 but did not render an `Agent Personalities` section because it reported `project context detected: ✗ no`.
- `doctor` in a temp dir with `opencode.json` but without `.opencode/oh-my-opencode.jsonc` exited 0 but did not emit a missing-OMO-config warning.
- Runtime export count check passed: `PERSONALITY_META` has 14 keys and `DOCS_HISTORY_META` has 4 modes.
- `src/cli/init.ts` currently contains 47 `hint:` entries, below the expected 52+ threshold from the QA script.
