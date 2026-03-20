# Improvements: Personality UX, OMO Project Bug Fix, Doctor Verbose, Test Coverage, README

## TL;DR
> **Summary**: Six targeted improvements: add human-readable hint text to all personality select options, surface personality config in doctor verbose, fix the project-scope bug where `.opencode/oh-my-opencode.jsonc` is never written, convert docs history mode prompt from text to select, expand test coverage to catch the bug class, and update README with full personality reference.
> **Deliverables**:
> - Shared personality + docs-history metadata map (single source of truth for labels, hints, types)
> - `writeOmoAgentConfig()` helper + project-scope install/init wiring
> - Doctor verbose "Agent Personalities" section with token + hint
> - `p.select` for docs history mode in TUI init
> - New and updated tests covering all changes
> - README personality reference tables + OMO note + doctor verbose example
> **Effort**: Medium
> **Parallel**: YES — 3 waves
> **Critical Path**: Task 1 (metadata) → Task 2 (OMO writer) → Task 3 (init wiring) → Task 4 (doctor) → Task 5 (tests) → Task 6 (README)

## Context

### Original Request
Six improvements:
1. Doctor verbose: show configured personality values
2. Personality select options need human-readable hints (currently label-only)
3. Bug: project-scope install does not write `.opencode/oh-my-opencode.jsonc`
4. Docs history mode TUI prompt should be a select, not a text input
5. Improve tests to catch bugs like #3
6. Update README with personality descriptions

### Interview Summary
All requirements derived from code exploration — no ambiguous user preferences.

Key decisions made:
- **OMO config overwrite policy**: Always overwrite on install/init (idempotent, ensures version currency). Rationale: user-customized OMO config is unlikely; stale bundled config is more dangerous than overwriting a custom one. Metis flag resolved as "overwrite always" given this is a bug fix context.
- **`writeOmoAgentConfig` location**: `src/cli/config-manager/index.ts` — keeps scope narrow.
- **Path resolution**: `new URL("../../../oh-my-opencode.jsonc", import.meta.url)` from compiled `dist/cli/config-manager/index.js` → resolves to package root `oh-my-opencode.jsonc`. Fallback using `fileURLToPath` + `readFileSync`.
- **Global install**: Does NOT write OMO config (OMO agent definitions are project-scoped per the OMO spec; global install only registers the plugin in `~/.config/opencode/opencode.json`).
- **Doctor warning**: When `projectInstalled === true` AND `.opencode/oh-my-opencode.jsonc` absent, add warning.
- **Personality metadata**: Extract into a shared `PERSONALITY_META` map in a new `src/cli/personality-meta.ts` — imported by `init.ts` (for select hints) and `doctor.ts` (for hint lookup). Avoids duplication.
- **Docs history mode prompt**: Replace `p.text` with `p.select` in `init.ts`. Non-interactive `--docs-history-mode` flag unchanged.

### Metis Review (gaps addressed)
- **Runtime file resolution**: Use `new URL("../../../oh-my-opencode.jsonc", import.meta.url)` + `fileURLToPath` — NOT `process.cwd()` for source resolution.
- **Overwrite policy decided**: Always overwrite.
- **Real filesystem test**: `writeOmoAgentConfig` test uses `mkdtempSync`, not only mocks.
- **Doctor degrades gracefully**: If unknown personality token in config → display raw value, no crash.
- **Tests that chdir**: Must be aware of stale module-level `process.cwd()` constants in `config-manager/index.ts` — tests mock the module entirely.
- **`init-interactive.test.ts` select count**: Will change from 14 to 15 when `docsEnabled=true` path adds a `p.select` for history mode. Existing test has `docsEnabled=false` path — stays at 14 for that test; add separate test for `docsEnabled=true`.

## Work Objectives

### Core Objective
Fix the project-scope OMO config bug and deliver a cohesive set of UX improvements to personality selection, doctor output, and documentation.

### Deliverables
- `src/cli/personality-meta.ts` — shared metadata (label, hint, readable descriptions)
- `src/cli/config-manager/index.ts` — `writeOmoAgentConfig(targetDir)` helper + export
- `src/cli/init.ts` — personality hints wired, docs history mode → select
- `src/cli/doctor.ts` — "Agent Personalities" section under verbose
- `src/cli/tui-installer.ts` + `src/cli/cli-installer.ts` — project-scope calls `writeOmoAgentConfig`
- `tests/unit/init-interactive.test.ts` — updated select count + new docsEnabled=true path
- `tests/unit/init-doctor.test.ts` — OMO config writer call + doctor warning tests
- `tests/unit/cli-installer.test.ts` — project-scope install calls OMO writer
- `tests/unit/tui-installer-handoff.test.ts` — OMO writer called on project-scope init
- `README.md` — personality reference tables, OMO project-scope note, doctor verbose example

### Definition of Done (verifiable)
- `tsc --noEmit` exits 0
- `bun test` exits 0 with all tests passing
- `node bin/wunderkind.js init --help` lists `--docs-history-mode`
- `node bin/wunderkind.js doctor --verbose` (in a project dir) shows "Agent Personalities" section

### Must Have
- All personality `p.select` calls in `init.ts` have non-empty `hint` strings
- `writeOmoAgentConfig` reads from bundled file via `import.meta.url`, not `process.cwd()`
- `runInit` calls `writeOmoAgentConfig(cwd)` when in project context
- Project-scope CLI install calls `writeOmoAgentConfig(process.cwd())`
- Project-scope TUI install (when not running init handoff) calls `writeOmoAgentConfig(process.cwd())`; when running init handoff, `runInit` handles it
- Doctor warns `missing OMO agent config: <path>` when project-installed but `.opencode/oh-my-opencode.jsonc` absent
- `bun run build` succeeds (TSC + agent generation)

### Must NOT Have
- No writing OMO config during global-scope install
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- No `process.cwd()` used as source file path for `oh-my-opencode.jsonc`
- No splitting `writeOmoAgentConfig` into a separate new file — keep in `config-manager/index.ts`
- No changing the non-interactive `--docs-history-mode` CLI flag contract
- No breaking changes to `writeWunderkindConfig`, `detectCurrentConfig`, or any public config-manager exports that tests already mock
- No empty catch blocks
- No duplicate mock state between test files

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after (existing Bun test framework, `bun:test`)
- QA policy: Every task has agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundation — must complete before all others):
- Task 1: `personality-meta.ts` shared metadata module

Wave 2 (Core changes — can run in parallel after Wave 1):
- Task 2: `writeOmoAgentConfig` helper in config-manager
- Task 3: `init.ts` — personality hints + docs history mode select
- Task 4: `doctor.ts` — Agent Personalities verbose section

Wave 3 (Integration + tests + docs — after Wave 2):
- Task 5: Wire OMO writer into install paths (tui-installer + cli-installer)
- Task 6: Tests — all test files
- Task 7: README updates

### Dependency Matrix
- Task 1 → blocks Tasks 2, 3, 4
- Task 2 → blocks Tasks 5, 6
- Task 3 → blocks Task 6 (init-interactive select count changes)
- Task 4 → blocks Task 6 (doctor test assertions)
- Task 5 → blocks Task 6 (cli-installer + tui-installer test assertions)
- Tasks 6, 7 → final wave, parallelisable

### Agent Dispatch Summary
- Wave 1: 1 task (quick)
- Wave 2: 3 tasks (quick, quick, quick) — parallel
- Wave 3: 3 tasks (quick, unspecified-high, writing) — parallel

## TODOs

- [x] 1. Create `src/cli/personality-meta.ts` — shared metadata for all personality types and docs history modes

  **What to do**:
  - Create a new file `src/cli/personality-meta.ts` (named export only, no default export — per AGENTS.md conventions).
  - Define a `PersonalityMeta` interface: `{ label: string; hint: string }`.
  - Export a constant `PERSONALITY_META` typed as a `Record` covering all 12 personality type fields plus `teamCulture` and `orgStructure`. Structure:
    ```ts
    export const PERSONALITY_META: {
      teamCulture: Record<TeamCulture, PersonalityMeta>
      orgStructure: Record<OrgStructure, PersonalityMeta>
      ciso: Record<CisoPersonality, PersonalityMeta>
      cto: Record<CtoPersonality, PersonalityMeta>
      cmo: Record<CmoPersonality, PersonalityMeta>
      qa: Record<QaPersonality, PersonalityMeta>
      product: Record<ProductPersonality, PersonalityMeta>
      ops: Record<OpsPersonality, PersonalityMeta>
      creative: Record<CreativePersonality, PersonalityMeta>
      brand: Record<BrandPersonality, PersonalityMeta>
      devrel: Record<DevrelPersonality, PersonalityMeta>
      legal: Record<LegalPersonality, PersonalityMeta>
      support: Record<SupportPersonality, PersonalityMeta>
      dataAnalyst: Record<DataAnalystPersonality, PersonalityMeta>
    }
    ```
  - Also export `DOCS_HISTORY_META: Record<DocHistoryMode, PersonalityMeta>`.
  - Use existing hint strings from `TEAM_CULTURE_OPTIONS` (init.ts:68-72) and `ORG_STRUCTURE_OPTIONS` (init.ts:74-76) as the canonical values for those two entries.
  - Write all hint strings for the 12 personality types. Use these exact values:

    **CISO** (`cisoPersonality`):
    - `paranoid-enforcer`: `"Maximum threat paranoia; blocks anything unproven"`
    - `pragmatic-risk-manager`: `"Balances risk vs. velocity; default posture"` (default)
    - `educator-collaborator`: `"Guides teams through security thinking collaboratively"`

    **CTO/Fullstack** (`ctoPersonality`):
    - `grizzled-sysadmin`: `"Battle-hardened ops mindset; stability over novelty"`
    - `startup-bro`: `"Move fast; bias toward shipping"`
    - `code-archaeologist`: `"Deep digs into legacy systems; explains history"` (default)

    **CMO/Marketing** (`cmoPersonality`):
    - `data-driven`: `"Metrics and attribution first; no vanity metrics"` (default)
    - `brand-storyteller`: `"Narrative and emotional resonance over raw data"`
    - `growth-hacker`: `"Experiments, loops, and funnel obsession"`

    **QA** (`qaPersonality`):
    - `rule-enforcer`: `"Strict standards; gates every release"`
    - `risk-based-pragmatist`: `"Tests what matters most; ships with confidence"` (default)
    - `rubber-duck`: `"Walks devs through their own bugs; collaborative"`

    **Product** (`productPersonality`):
    - `user-advocate`: `"User pain and delight over internal efficiency"`
    - `velocity-optimizer`: `"Throughput and cycle time over perfect specs"`
    - `outcome-obsessed`: `"Business outcomes and measurable impact first"` (default)

    **Ops** (`opsPersonality`):
    - `on-call-veteran`: `"Incident-hardened; runbook-first"` (default)
    - `efficiency-maximiser`: `"Automates everything; cost and throughput focused"`
    - `process-purist`: `"Change management and process integrity"`

    **Creative Director** (`creativePersonality`):
    - `perfectionist-craftsperson`: `"Pixel-perfect; never ships unpolished"`
    - `bold-provocateur`: `"Intentionally disruptive visual choices"`
    - `pragmatic-problem-solver`: `"Design that ships; form follows function"` (default)

    **Brand Builder** (`brandPersonality`):
    - `community-evangelist`: `"Builds through authentic community engagement"`
    - `pr-spinner`: `"Narrative control and media-savvy messaging"`
    - `authentic-builder`: `"No spin; build trust through radical transparency"` (default)

    **DevRel** (`devrelPersonality`):
    - `community-champion`: `"Forum presence, events, OSS contribution"`
    - `docs-perfectionist`: `"Every API documented; no gaps tolerated"`
    - `dx-engineer`: `"Developer experience as a product; DX metrics"` (default)

    **Legal Counsel** (`legalPersonality`):
    - `cautious-gatekeeper`: `"Blocks anything legally ambiguous"`
    - `pragmatic-advisor`: `"Risk-calibrated; enables the business to move"` (default)
    - `plain-english-counselor`: `"Translates legalese into plain language"`

    **Support Engineer** (`supportPersonality`):
    - `empathetic-resolver`: `"Treats every ticket as a relationship"`
    - `systematic-triage`: `"Classification, routing, and severity-driven"` (default)
    - `knowledge-builder`: `"Every fix becomes a doc; knowledge loop focus"`

    **Data Analyst** (`dataAnalystPersonality`):
    - `rigorous-statistician`: `"Significance, confidence intervals, no p-hacking"`
    - `insight-storyteller`: `"Translates data into narratives for decisions"` (default)
    - `pragmatic-quant`: `"Good-enough analysis fast; directional signals"`

    **Docs History Mode** (`docHistoryMode`):
    - `overwrite`: `"Replaces the file each time (default)"` (default)
    - `append-dated`: `"Appends a new dated section"`
    - `new-dated-file`: `"Creates a new file with a date suffix"`
    - `overwrite-archive`: `"Overwrites and archives the previous version"`

  - Import all personality/doc types from `./types.js`.
  - No unused imports (strict TS flags enforce this).

  **Must NOT do**:
  - Do not default-export anything.
  - Do not duplicate the type union definitions — import from `./types.js`.
  - Do not put business logic here — metadata only.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Single new file, pure data/type declaration, no side effects.
  - Skills: [] — No special skills needed.
  - Omitted: All skills — trivial data file.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: Tasks 2, 3, 4 | Blocked By: nothing

  **References**:
  - Types: `src/cli/types.ts:1-19` — All personality union types and DocHistoryMode to import
  - Pattern: `src/cli/init.ts:68-77` — `TEAM_CULTURE_OPTIONS` and `ORG_STRUCTURE_OPTIONS` as canonical hint source (copy their hint strings)
  - Convention: `AGENTS.md` — Named exports only; no default exports in `src/`

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` exits 0 after file creation
  - [ ] `PERSONALITY_META.ciso["paranoid-enforcer"].hint === "Maximum threat paranoia; blocks anything unproven"`
  - [ ] `DOCS_HISTORY_META["overwrite"].hint === "Replaces the file each time (default)"`
  - [ ] All 12 personality keys are present in `PERSONALITY_META`
  - [ ] File has zero default exports

  **QA Scenarios**:
  ```
  Scenario: Type check passes
    Tool: Bash
    Steps: cd /Users/grantv/Code/wunderkind && tsc --noEmit
    Expected: exits 0, no errors
    Evidence: .sisyphus/evidence/task-1-personality-meta-tsc.txt

  Scenario: Metadata keys cover all types
    Tool: Bash
    Steps: cd /Users/grantv/Code/wunderkind && bun -e "import { PERSONALITY_META, DOCS_HISTORY_META } from './src/cli/personality-meta.ts'; console.log(Object.keys(PERSONALITY_META).length, Object.keys(DOCS_HISTORY_META).length)"
    Expected: "14 4" (14 agent keys, 4 mode keys)
    Evidence: .sisyphus/evidence/task-1-personality-meta-runtime.txt
  ```

  **Commit**: YES | Message: `feat(meta): add shared personality and docs-history metadata map` | Files: `src/cli/personality-meta.ts`

---

- [x] 2. Add `writeOmoAgentConfig` helper to `src/cli/config-manager/index.ts`

  **What to do**:
  - Add a new exported function `writeOmoAgentConfig(targetDir: string): ConfigMergeResult` to `src/cli/config-manager/index.ts` (append near the bottom, before `removeGlobalWunderkindConfig`).
  - The function must:
    1. Resolve the source file using `new URL("../../../oh-my-opencode.jsonc", import.meta.url)` — from compiled `dist/cli/config-manager/index.js` this walks up to package root.
    2. Use `fileURLToPath` (from `node:url`) to get a filesystem path.
    3. Read the file contents with `readFileSync(sourceFilePath, "utf-8")`.
    4. Ensure `.opencode/` directory exists at `join(targetDir, ".opencode")` using `mkdirSync(..., { recursive: true })`.
    5. Write the contents to `join(targetDir, ".opencode", "oh-my-opencode.jsonc")` using `writeFileSync`.
    6. Always overwrite if the file exists.
    7. Return `{ success: true, configPath: <written path> }` on success.
    8. Return `{ success: false, configPath: <target path>, error: String(err) }` on any error.
  - Add `fileURLToPath` to the imports from `node:url` at the top of the file (new import line).
  - Export the function — it will be used by `cli-installer.ts`, `tui-installer.ts`, and `init.ts`.

  **Must NOT do**:
  - Do not use `process.cwd()` to find the source `oh-my-opencode.jsonc`.
  - Do not use `import.meta.dirname` (Node 18 compat).
  - Do not place this in a new file.
  - Do not add a `__dirname` polyfill — `import.meta.url` approach is sufficient.
  - Do not fail silently — always return a `ConfigMergeResult`.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Single function addition to existing file with clear pattern.
  - Skills: [] — No special skills needed.
  - Omitted: All skills.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Tasks 5, 6 | Blocked By: Task 1

  **References**:
  - File: `src/cli/config-manager/index.ts:1` — Add `import { fileURLToPath } from "node:url"` here
  - Pattern: `src/cli/config-manager/index.ts:375-397` — `writeGlobalWunderkindConfig` / `writeProjectWunderkindConfig` pattern for `ConfigMergeResult` shape
  - Pattern: `src/cli/config-manager/index.ts:297-305` — `ensureConfigDir` pattern for `mkdirSync` with error handling
  - Type: `src/cli/types.ts:76-81` — `ConfigMergeResult` interface
  - Source file: `oh-my-opencode.jsonc` at package root (resolves to `new URL("../../../oh-my-opencode.jsonc", import.meta.url)` from compiled location)

  **Acceptance Criteria**:
  - [ ] `writeOmoAgentConfig(tmpDir)` writes `<tmpDir>/.opencode/oh-my-opencode.jsonc`
  - [ ] Written contents exactly match `oh-my-opencode.jsonc` at package root
  - [ ] Second call to `writeOmoAgentConfig(tmpDir)` overwrites — returns `{ success: true }`
  - [ ] `tsc --noEmit` exits 0

  **QA Scenarios**:
  ```
  Scenario: Helper writes correct file
    Tool: Bash
    Steps: Run filesystem test via bun test (see Task 6 for the test itself)
    Expected: File created at correct path with correct contents
    Evidence: .sisyphus/evidence/task-2-omo-writer-test.txt

  Scenario: Error handling
    Tool: Bash
    Steps: Pass a targetDir that cannot be written to (e.g., a file path, not a directory) — verify return shape has success: false
    Expected: Returns ConfigMergeResult with success: false, error string present
    Evidence: .sisyphus/evidence/task-2-omo-writer-error.txt
  ```

  **Commit**: YES | Message: `feat(config-manager): add writeOmoAgentConfig helper` | Files: `src/cli/config-manager/index.ts`

---

- [x] 3. Update `src/cli/init.ts` — personality hints + docs history mode → select

  **What to do**:
  A. **Personality hints**: Update all 12 `p.select` calls (lines 143-273) to include `hint` on each option. Import `PERSONALITY_META` from `./personality-meta.js`. Convert each hard-coded options array to use `PERSONALITY_META[key][value].hint`. The simplest approach: replace each inline options array with a helper that maps over the type's values using the metadata. Pattern already exists: `TEAM_CULTURE_OPTIONS` at line 68 already has `hint` — personality blocks must match.

  Concrete change for each personality block:
  ```ts
  // BEFORE (example: CISO)
  [
    { value: "paranoid-enforcer", label: "paranoid-enforcer" },
    { value: "pragmatic-risk-manager", label: "pragmatic-risk-manager" },
    { value: "educator-collaborator", label: "educator-collaborator" },
  ]

  // AFTER
  [
    { value: "paranoid-enforcer", label: "paranoid-enforcer", hint: PERSONALITY_META.ciso["paranoid-enforcer"].hint },
    { value: "pragmatic-risk-manager", label: "pragmatic-risk-manager", hint: PERSONALITY_META.ciso["pragmatic-risk-manager"].hint },
    { value: "educator-collaborator", label: "educator-collaborator", hint: PERSONALITY_META.ciso["educator-collaborator"].hint },
  ]
  ```
  Do this for all 12 personality select blocks. Refer to `personality-meta.ts` Task 1 for the key-to-agent mapping (ciso, cto, cmo, qa, product, ops, creative, brand, devrel, legal, support, dataAnalyst).

  B. **Docs history mode → select**: Replace lines 303-314:
  ```ts
  // BEFORE
  const docHistoryModeRaw = await p.text({
    message: "Docs history mode:",
    placeholder: "overwrite",
    initialValue: config.docHistoryMode,
    validate: (v) => (validateDocHistoryMode(v) ? undefined : "Invalid mode"),
  })
  if (p.isCancel(docHistoryModeRaw)) return 1
  if (!validateDocHistoryMode(docHistoryModeRaw)) {
    console.error("Error: Invalid docHistoryMode")
    return 1
  }
  docHistoryMode = docHistoryModeRaw
  ```
  Replace with:
  ```ts
  // AFTER
  const docHistoryModeRaw = await promptSelect<DocHistoryMode>(
    "Docs history mode:",
    [
      { value: "overwrite", label: "overwrite", hint: DOCS_HISTORY_META["overwrite"].hint },
      { value: "append-dated", label: "append-dated", hint: DOCS_HISTORY_META["append-dated"].hint },
      { value: "new-dated-file", label: "new-dated-file", hint: DOCS_HISTORY_META["new-dated-file"].hint },
      { value: "overwrite-archive", label: "overwrite-archive", hint: DOCS_HISTORY_META["overwrite-archive"].hint },
    ],
    config.docHistoryMode,
  )
  if (docHistoryModeRaw === null) return 1
  docHistoryMode = docHistoryModeRaw
  ```
  Import `DOCS_HISTORY_META` from `./personality-meta.js` alongside `PERSONALITY_META`.

  C. **Remove now-unreachable error check**: After the replacement in B, the explicit `validateDocHistoryMode(docHistoryModeRaw)` check at the bottom of that block (lines 310-313) is no longer needed — `p.select` constrains to valid values. Remove it cleanly.

  **Must NOT do**:
  - Do not alter the `docsEnabledRaw` prompt (lines 275-286) — it stays as `p.text`.
  - Do not add hints to `TEAM_CULTURE_OPTIONS` or `ORG_STRUCTURE_OPTIONS` — they already have them.
  - Do not change the non-interactive (noTui) path — it still reads from `options.docHistoryMode` via `normalizeDocHistoryMode`.
  - Do not introduce unused imports.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Mechanical substitution of option arrays using imported metadata.
  - Skills: [] — No special skills.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 6 | Blocked By: Task 1

  **References**:
  - File: `src/cli/init.ts:68-77` — Existing `TEAM_CULTURE_OPTIONS` and `ORG_STRUCTURE_OPTIONS` with `hint` as the canonical pattern
  - File: `src/cli/init.ts:143-273` — All 12 personality select blocks to update
  - File: `src/cli/init.ts:303-314` — `p.text` docHistoryMode block to replace with `p.select`
  - File: `src/cli/init.ts:1-23` — Imports section (add `PERSONALITY_META`, `DOCS_HISTORY_META`)
  - New: `src/cli/personality-meta.ts` — PERSONALITY_META and DOCS_HISTORY_META (Task 1)
  - Pattern: `src/cli/init.ts:79-87` — `promptSelect<T>` helper signature for reuse

  **Acceptance Criteria**:
  - [ ] Every `p.select` personality call includes `hint` on all options
  - [ ] `docHistoryMode` prompt is `p.select`, not `p.text`
  - [ ] `tsc --noEmit` exits 0
  - [ ] Interactive init test: `mockSelect` called 14 times for `docsEnabled=false` path, 15 times for `docsEnabled=true` path

  **QA Scenarios**:
  ```
  Scenario: Personality select has hints
    Tool: Bash
    Steps: bun test tests/unit/init-interactive.test.ts
    Expected: 0 failures; existing test still passes with 14 select calls
    Evidence: .sisyphus/evidence/task-3-init-interactive-test.txt

  Scenario: Type check
    Tool: Bash
    Steps: tsc --noEmit
    Expected: exits 0
    Evidence: .sisyphus/evidence/task-3-init-tsc.txt
  ```

  **Commit**: YES | Message: `feat(init): add personality hint text and convert docs history mode to select` | Files: `src/cli/init.ts`

---

- [x] 4. Update `src/cli/doctor.ts` — add "Agent Personalities" verbose section

  **What to do**:
  A. Import `PERSONALITY_META` and `DOCS_HISTORY_META` from `./personality-meta.js`.
  B. In the verbose block starting at line 117, after the existing "Documentation Context" section (lines 118-126), add a new section call:

  ```ts
  section("Agent Personalities")
  ```

  Then output each personality field in this order (matching `renderProjectWunderkindConfig` order in `config-manager/index.ts:338-361`):

  ```
  ciso:           pragmatic-risk-manager  (Balances risk vs. velocity; default posture)
  fullstack:      code-archaeologist  (Deep digs into legacy systems; explains history)
  marketing:      data-driven  (Metrics and attribution first; no vanity metrics)
  qa:             risk-based-pragmatist  (Tests what matters most; ships with confidence)
  product:        outcome-obsessed  (Business outcomes and measurable impact first)
  ops:            on-call-veteran  (Incident-hardened; runbook-first)
  creative:       pragmatic-problem-solver  (Design that ships; form follows function)
  brand:          authentic-builder  (No spin; build trust through radical transparency)
  devrel:         dx-engineer  (Developer experience as a product; DX metrics)
  legal:          pragmatic-advisor  (Risk-calibrated; enables the business to move)
  support:        systematic-triage  (Classification, routing, and severity-driven)
  data analyst:   insight-storyteller  (Translates data into narratives for decisions)
  ```

  Implementation pattern for each line (use `projectConfig ?? detected` for value):
  ```ts
  const cisoVal = projectConfig?.cisoPersonality ?? detected.cisoPersonality
  line("ciso:", `${color.cyan(cisoVal)}  ${color.dim(`(${PERSONALITY_META.ciso[cisoVal]?.hint ?? cisoVal})`)}`)
  ```
  Use `?.hint ?? cisoVal` to degrade gracefully if an unknown token is stored.

  The personality section is placed inside the `if (options.verbose)` guard (line 117) and inside the `if (inProject)` guard (line 89), since personalities are project-level config. If not in project context, no personality section.

  C. Also update the `section("Documentation Context")` label (line 118) to `section("Project Configuration")` to better reflect that it now covers both team/org/personality and docs settings. (Optional — use judgment.)

  **Must NOT do**:
  - Do not show personality section when `!options.verbose`.
  - Do not crash on unknown personality token — use `?.hint ?? rawValue`.
  - Do not add personality section outside the `inProject` block.
  - Do not alter the non-verbose path.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Simple additions to existing verbose output section.
  - Skills: [] — No special skills.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 6 | Blocked By: Task 1

  **References**:
  - File: `src/cli/doctor.ts:89-131` — Full `inProject` block; verbose section at lines 117-126
  - File: `src/cli/doctor.ts:17-27` — `status()`, `section()`, `line()` helper functions to reuse
  - File: `src/cli/config-manager/index.ts:338-361` — Agent personality field order to follow
  - New: `src/cli/personality-meta.ts` — `PERSONALITY_META` (Task 1)

  **Acceptance Criteria**:
  - [ ] `doctor --verbose` in project context prints "Agent Personalities" section
  - [ ] Each personality line shows token value + dim hint text
  - [ ] Unknown token degrades gracefully (displays raw value, no crash)
  - [ ] Non-verbose path unchanged
  - [ ] `tsc --noEmit` exits 0

  **QA Scenarios**:
  ```
  Scenario: Agent Personalities in verbose output
    Tool: Bash
    Steps: bun test tests/unit/init-doctor.test.ts (after Task 6 adds the test)
    Expected: Doctor verbose test asserts "Agent Personalities" section present
    Evidence: .sisyphus/evidence/task-4-doctor-verbose-test.txt

  Scenario: Type check
    Tool: Bash
    Steps: tsc --noEmit
    Expected: exits 0
    Evidence: .sisyphus/evidence/task-4-doctor-tsc.txt
  ```

  **Commit**: YES | Message: `feat(doctor): show agent personalities under verbose mode` | Files: `src/cli/doctor.ts`

---

- [x] 5. Wire `writeOmoAgentConfig` into install paths and `runInit`

  **What to do**:
  Three files need to call `writeOmoAgentConfig`:

  **A. `src/cli/init.ts`**:
  - Import `writeOmoAgentConfig` from `./config-manager/index.js`.
  - After `writeWunderkindConfig(config, "project")` succeeds (line 349), call `writeOmoAgentConfig(cwd)`.
  - If it fails, log a warning `console.error(\`Warning: Failed to write OMO agent config: \${omoResult.error}\`)` but do NOT return 1 (non-fatal for init, which is about soul files primarily). Actually: treat it as fatal — return 1 with the error. Rationale: if OMO config can't be written, agents won't load. Metis says runInit should return 1 if it fails.
  - Exact placement: after line 353 (after wunderkind config write success check), before `ensureFile(join(cwd, "AGENTS.md"), ...)`.

  **B. `src/cli/cli-installer.ts`**:
  - Import `writeOmoAgentConfig` from `./config-manager/index.js`.
  - In `runCliInstaller`, after `writeWunderkindConfig(config, args.scope)` succeeds (line 164), add:
    ```ts
    if (args.scope === "project") {
      const omoResult = writeOmoAgentConfig(process.cwd())
      if (!omoResult.success) {
        printError(`Failed to write OMO agent config: ${omoResult.error}`)
        return 1
      }
      printSuccess(`OMO agent config written ${SYMBOLS.arrow} ${color.dim(omoResult.configPath)}`)
    }
    ```
  - This must come before the gitignore step (line 166).
  - Do NOT call it when `args.scope === "global"`.

  **C. `src/cli/tui-installer.ts`**:
  - Import `writeOmoAgentConfig` from `./config-manager/index.js`.
  - After `writeWunderkindConfig(config, scope)` succeeds (line 227), add:
    ```ts
    if (scope === "project") {
      const omoResult = writeOmoAgentConfig(process.cwd())
      if (!omoResult.success) {
        spinner.stop(color.red(`Failed to write OMO agent config: ${omoResult.error}`))
        p.outro(color.red("Installation failed."))
        return 1
      }
      p.log.success(`OMO agent config written to ${color.cyan(omoResult.configPath)}`)
    }
    ```
  - When `shouldInitProjectNow === true`, `runInit` will call `writeOmoAgentConfig` — so the TUI install block should NOT double-write in that case. Guard with `if (scope === "project" && !shouldInitProjectNow)`.
  - Insert after line 227 (after `spinner.stop("Configuration applied successfully")`).

  **D. `src/cli/doctor.ts`** — add OMO config warning:
  - In the `inProject` block, add a new check. After the `localConfigExists` check (line 103):
    ```ts
    const omoConfigPath = join(cwd, ".opencode", "oh-my-opencode.jsonc")
    const hasOmoConfig = existsSync(omoConfigPath)
    if (!hasOmoConfig && detected.projectInstalled === true) {
      warnings.push(`missing OMO agent config: ${omoConfigPath}`)
    }
    ```
  - Also add to Project Health section (line 110-115):
    ```ts
    line("OMO agent config present:", status(hasOmoConfig))
    ```

  **Must NOT do**:
  - Do not call `writeOmoAgentConfig` on global-scope install paths.
  - Do not call it twice in TUI when init handoff is happening.
  - Do not swallow errors — always propagate failure.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Mechanical wiring of existing helper into 3 call sites + 1 doctor check.
  - Skills: [] — No special skills.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Task 6 | Blocked By: Tasks 2, 3, 4

  **References**:
  - File: `src/cli/init.ts:349-358` — Placement: after config write success, before AGENTS.md ensureFile
  - File: `src/cli/cli-installer.ts:158-174` — Placement: after writeWunderkindConfig success block
  - File: `src/cli/tui-installer.ts:209-243` — Placement: after spinner.stop, before gitignore
  - File: `src/cli/doctor.ts:89-145` — inProject block: add omoConfig check + line
  - New: `src/cli/config-manager/index.ts` — `writeOmoAgentConfig` export (Task 2)

  **Acceptance Criteria**:
  - [ ] Project-scope CLI install calls `writeOmoAgentConfig` once
  - [ ] Global-scope CLI install does NOT call `writeOmoAgentConfig`
  - [ ] `runInit` calls `writeOmoAgentConfig` once and returns 1 if it fails
  - [ ] TUI project-scope install (without init handoff) calls `writeOmoAgentConfig` once
  - [ ] TUI project-scope install (with init handoff) calls `writeOmoAgentConfig` zero times via tui-installer (runInit handles it)
  - [ ] Doctor warns when project-installed but OMO config absent
  - [ ] `tsc --noEmit` exits 0

  **QA Scenarios**:
  ```
  Scenario: CLI project install writes OMO config
    Tool: Bash
    Steps: bun test tests/unit/cli-installer.test.ts
    Expected: 0 test failures; new test asserting mockWriteOmoAgentConfig called for project scope
    Evidence: .sisyphus/evidence/task-5-cli-installer-test.txt

  Scenario: Init writes OMO config
    Tool: Bash
    Steps: bun test tests/unit/init-doctor.test.ts
    Expected: 0 test failures; new test asserting OMO writer called during runInit
    Evidence: .sisyphus/evidence/task-5-init-doctor-test.txt
  ```

  **Commit**: YES | Message: `fix(install/init): write project-local OMO agent config on project-scope install and init` | Files: `src/cli/init.ts`, `src/cli/cli-installer.ts`, `src/cli/tui-installer.ts`, `src/cli/doctor.ts`

---

- [x] 6. Update all test files to cover new behaviour

  **What to do**:
  This is the largest task. Update 4 test files and add assertions to each. All follow the existing `bun:test` + `mock.module` pattern.

  **A. `tests/unit/init-interactive.test.ts`**:

  1. Update existing test (`"collects team/org/personality fields interactively and persists them"`):
     - The mock module setup at line 49-52 currently only mocks `detectCurrentConfig` and `writeWunderkindConfig`. Add `writeOmoAgentConfig` to the mock:
       ```ts
       const mockWriteOmoAgentConfig = mock(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))
       mock.module("../../src/cli/config-manager/index.js", () => ({
         detectCurrentConfig: mockDetectCurrentConfig,
         writeWunderkindConfig: mockWriteWunderkindConfig,
         writeOmoAgentConfig: mockWriteOmoAgentConfig,
       }))
       ```
     - The existing test has `docsEnabled=false` path → `mockSelect` called 14 times. This remains correct. Add assertion: `expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(1)`.
     - Add `mockWriteOmoAgentConfig.mockClear()` to `beforeEach`.

  2. Add new test `"selects docs history mode via select when docs enabled"`:
     - Set `selectAnswers` to include 14 personality answers + `"append-dated"` for docs history mode (15 total).
     - Set `textAnswers` to `["yes", "./my-docs"]` (docs enabled yes, then docs path).
     - Assert `mockSelect` called 15 times.
     - Assert `installConfig.docHistoryMode === "append-dated"`.
     - Assert `installConfig.docsEnabled === true`.

  **B. `tests/unit/init-doctor.test.ts`**:

  1. Add `writeOmoAgentConfig` to the mock module setup (line 41-47):
     ```ts
     const mockWriteOmoAgentConfig = mock(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))
     mock.module("../../src/cli/config-manager/index.js", () => ({
       detectCurrentConfig: mockDetectCurrentConfig,
       readGlobalWunderkindConfig: mockReadGlobalWunderkindConfig,
       readProjectWunderkindConfig: mockReadProjectWunderkindConfig,
       writeWunderkindConfig: mockWriteWunderkindConfig,
       resolveOpenCodeConfigPath: mockResolveOpenCodeConfigPath,
       writeOmoAgentConfig: mockWriteOmoAgentConfig,
     }))
     ```
     Add `mockWriteOmoAgentConfig.mockClear()` to `beforeEach` blocks.

  2. Add new test in `describe("runInit")`: `"calls writeOmoAgentConfig when in project context"`:
     ```ts
     it("calls writeOmoAgentConfig when in project context", async () => {
       mockDetectCurrentConfig.mockImplementation(() => ({ ...defaults, isInstalled: true }))
       const tempProject = mkdtempSync(join(tmpdir(), "wk-omo-"))
       writeFileSync(join(tempProject, "package.json"), "{}")
       const originalCwd = process.cwd()
       process.chdir(tempProject)
       const restore = silenceConsole()
       try {
         const code = await runInit({ noTui: true })
         expect(code).toBe(0)
         expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(1)
       } finally {
         restore()
         process.chdir(originalCwd)
         rmSync(tempProject, { recursive: true, force: true })
       }
     })
     ```

  3. Add new test in `describe("runDoctor")`: `"warns when project-installed but OMO config absent"`:
     - Mock `detected.projectInstalled = true`.
     - Use a tempDir with `package.json` but no `.opencode/oh-my-opencode.jsonc`.
     - Chdir to tempDir.
     - Run `runDoctorWithOptions({})`.
     - Assert output includes `"missing OMO agent config"`.

  4. Add new test in `describe("runDoctor")`: `"shows Agent Personalities section in verbose mode"`:
     - Mock `detected.projectInstalled = true`, in project context.
     - Chdir to tempDir with `package.json`.
     - Run `runDoctorWithOptions({ verbose: true })`.
     - Assert output includes `"Agent Personalities"`.
     - Assert output includes `"pragmatic-risk-manager"` (default CISO value).

  **C. `tests/unit/cli-installer.test.ts`**:

  1. Add `writeOmoAgentConfig` to mock module (line 55-62):
     ```ts
     const mockWriteOmoAgentConfig = mock(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))
     mock.module("../../src/cli/config-manager/index.js", () => ({
       // ... existing mocks ...
       writeOmoAgentConfig: mockWriteOmoAgentConfig,
     }))
     ```
     Add `mockWriteOmoAgentConfig.mockClear()` to `beforeEach`.

  2. Add new test: `"calls writeOmoAgentConfig once for project scope install"`:
     ```ts
     it("calls writeOmoAgentConfig once for project scope install", async () => {
       const restore = silenceConsole()
       try {
         await runCliInstaller(baseArgs({ scope: "project" }))
         expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(1)
       } finally { restore() }
     })
     ```

  3. Add new test: `"does NOT call writeOmoAgentConfig for global scope install"`:
     ```ts
     it("does NOT call writeOmoAgentConfig for global scope install", async () => {
       const restore = silenceConsole()
       try {
         await runCliInstaller(baseArgs({ scope: "global" }))
         expect(mockWriteOmoAgentConfig).toHaveBeenCalledTimes(0)
       } finally { restore() }
     })
     ```

  4. Add real filesystem test for `writeOmoAgentConfig` in a new `describe("writeOmoAgentConfig")` block at the bottom of the file:
     ```ts
     describe("writeOmoAgentConfig", () => {
       it("writes oh-my-opencode.jsonc to .opencode/ in target dir", async () => {
         const { writeOmoAgentConfig } = await import(`../../src/cli/config-manager/index.ts?omo-test=${Date.now()}`)
         const { readFileSync, existsSync } = await import("node:fs")
         const testRoot = mkdtempSync(join(tmpdir(), "wk-omo-writer-"))
         try {
           const result = writeOmoAgentConfig(testRoot)
           expect(result.success).toBe(true)
           const omoPath = join(testRoot, ".opencode", "oh-my-opencode.jsonc")
           expect(existsSync(omoPath)).toBe(true)
           const written = readFileSync(omoPath, "utf-8")
           expect(written).toContain("wunderkind:ciso")
           expect(written).toContain("wunderkind:marketing-wunderkind")
         } finally {
           rmSync(testRoot, { recursive: true, force: true })
         }
       })

       it("is idempotent — second call overwrites without error", async () => {
         const { writeOmoAgentConfig } = await import(`../../src/cli/config-manager/index.ts?omo-idempotent=${Date.now()}`)
         const testRoot = mkdtempSync(join(tmpdir(), "wk-omo-idempotent-"))
         try {
           const r1 = writeOmoAgentConfig(testRoot)
           const r2 = writeOmoAgentConfig(testRoot)
           expect(r1.success).toBe(true)
           expect(r2.success).toBe(true)
         } finally {
           rmSync(testRoot, { recursive: true, force: true })
         }
       })
     })
     ```

  **D. `tests/unit/tui-installer-handoff.test.ts`**:

  1. Add `writeOmoAgentConfig` to mock module (line 11-52):
     ```ts
     const mockWriteOmoAgentConfig = mock(() => ({ success: true, configPath: "/tmp/.opencode/oh-my-opencode.jsonc" }))
     // add to mock.module("../../src/cli/config-manager/index.js", ...):
     writeOmoAgentConfig: mockWriteOmoAgentConfig,
     ```
     Add `mockWriteOmoAgentConfig.mockClear()` to `beforeEach`.

  2. Add assertion to `"calls runInit and prompts for gitignore when user opts into init"` test:
     - Since `runInit` is mocked (returns 0), and TUI should NOT double-write when `shouldInitProjectNow=true`, assert `mockWriteOmoAgentConfig` called 0 times (because the TUI skips it when init handoff is running).

  3. Add new test: `"writes OMO config on project-scope install without init"`:
     - `confirmAnswers = [false]` (no init).
     - `scope = "project"`.
     - Assert `mockWriteOmoAgentConfig` called 1 time.

  **Must NOT do**:
  - Do not use real filesystem operations in tests that use `mock.module` for config-manager (they'd race with `process.cwd()` module-level constants).
  - Do not modify the test module mock structure for tests that are already passing without adding the new mock exports — breaking mocks will cause import errors.
  - Do not omit `mockClear()` in `beforeEach` for every new mock added.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Multiple test files, understanding mock interaction patterns, careful counting of select calls, filesystem test correctness.
  - Skills: [] — No special skills needed.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: nothing | Blocked By: Tasks 2, 3, 4, 5

  **References**:
  - File: `tests/unit/init-interactive.test.ts` — full file (118 lines) — existing mock pattern
  - File: `tests/unit/init-doctor.test.ts` — full file (203 lines) — existing doctor test pattern
  - File: `tests/unit/cli-installer.test.ts` — full file (494 lines) — existing real filesystem test pattern (lines 303-424)
  - File: `tests/unit/tui-installer-handoff.test.ts` — full file (160 lines)
  - Pattern: `tests/unit/cli-installer.test.ts:303-330` — Dynamic import with cache-busting `?key=${Date.now()}` for filesystem tests
  - Note: `init-interactive.test.ts` `mockText` currently returns `["no"]` (1 item for docsEnabled). New `docsEnabled=true` test needs `["yes", "./my-docs"]`.

  **Acceptance Criteria**:
  - [ ] `bun test` exits 0 (all tests pass)
  - [ ] `mockSelect` called 14 times for `docsEnabled=false` init path
  - [ ] `mockSelect` called 15 times for `docsEnabled=true` init path
  - [ ] `writeOmoAgentConfig` filesystem test: file exists and contains `"wunderkind:ciso"`
  - [ ] CLI project-scope install test: `mockWriteOmoAgentConfig` called once
  - [ ] CLI global-scope install test: `mockWriteOmoAgentConfig` not called
  - [ ] Doctor test: verbose output contains "Agent Personalities"
  - [ ] Doctor test: warning present when project-installed + OMO config absent

  **QA Scenarios**:
  ```
  Scenario: Full test suite passes
    Tool: Bash
    Steps: cd /Users/grantv/Code/wunderkind && bun test
    Expected: All tests pass, exit 0
    Evidence: .sisyphus/evidence/task-6-bun-test-full.txt

  Scenario: Type check
    Tool: Bash
    Steps: tsc --noEmit
    Expected: exits 0
    Evidence: .sisyphus/evidence/task-6-tsc.txt
  ```

  **Commit**: YES | Message: `test: cover personality hints, OMO config writer, and doctor verbose` | Files: `tests/unit/init-interactive.test.ts`, `tests/unit/init-doctor.test.ts`, `tests/unit/cli-installer.test.ts`, `tests/unit/tui-installer-handoff.test.ts`

---

- [x] 7. Update `README.md` — personality reference, OMO project-scope note, doctor verbose example

  **What to do**:

  **A. Add "Personality Reference" section** — Insert after the existing "Configuration" section (after the config JSONC code blocks, before "Directory Structure"):

  ```markdown
  ## Personality Reference

  Each agent's behaviour is controlled by a `*Personality` key in your project config. Choose the archetype that matches your team's operating style.

  ### CISO (`cisoPersonality`)
  | Value | What it means |
  |---|---|
  | `paranoid-enforcer` | Maximum threat paranoia; blocks anything unproven |
  | `pragmatic-risk-manager` | Balances risk vs. velocity; default posture (default) |
  | `educator-collaborator` | Guides teams through security thinking collaboratively |

  ### CTO / Fullstack (`ctoPersonality`)
  | Value | What it means |
  |---|---|
  | `grizzled-sysadmin` | Battle-hardened ops mindset; stability over novelty |
  | `startup-bro` | Move fast; bias toward shipping |
  | `code-archaeologist` | Deep digs into legacy systems; explains history (default) |

  ### CMO / Marketing (`cmoPersonality`)
  | Value | What it means |
  |---|---|
  | `data-driven` | Metrics and attribution first; no vanity metrics (default) |
  | `brand-storyteller` | Narrative and emotional resonance over raw data |
  | `growth-hacker` | Experiments, loops, and funnel obsession |

  ### QA (`qaPersonality`)
  | Value | What it means |
  |---|---|
  | `rule-enforcer` | Strict standards; gates every release |
  | `risk-based-pragmatist` | Tests what matters most; ships with confidence (default) |
  | `rubber-duck` | Walks devs through their own bugs; collaborative |

  ### Product (`productPersonality`)
  | Value | What it means |
  |---|---|
  | `user-advocate` | User pain and delight over internal efficiency |
  | `velocity-optimizer` | Throughput and cycle time over perfect specs |
  | `outcome-obsessed` | Business outcomes and measurable impact first (default) |

  ### Operations (`opsPersonality`)
  | Value | What it means |
  |---|---|
  | `on-call-veteran` | Incident-hardened; runbook-first (default) |
  | `efficiency-maximiser` | Automates everything; cost and throughput focused |
  | `process-purist` | Change management and process integrity |

  ### Creative Director (`creativePersonality`)
  | Value | What it means |
  |---|---|
  | `perfectionist-craftsperson` | Pixel-perfect; never ships unpolished |
  | `bold-provocateur` | Intentionally disruptive visual choices |
  | `pragmatic-problem-solver` | Design that ships; form follows function (default) |

  ### Brand Builder (`brandPersonality`)
  | Value | What it means |
  |---|---|
  | `community-evangelist` | Builds through authentic community engagement |
  | `pr-spinner` | Narrative control and media-savvy messaging |
  | `authentic-builder` | No spin; build trust through radical transparency (default) |

  ### DevRel (`devrelPersonality`)
  | Value | What it means |
  |---|---|
  | `community-champion` | Forum presence, events, OSS contribution |
  | `docs-perfectionist` | Every API documented; no gaps tolerated |
  | `dx-engineer` | Developer experience as a product; DX metrics (default) |

  ### Legal Counsel (`legalPersonality`)
  | Value | What it means |
  |---|---|
  | `cautious-gatekeeper` | Blocks anything legally ambiguous |
  | `pragmatic-advisor` | Risk-calibrated; enables the business to move (default) |
  | `plain-english-counselor` | Translates legalese into plain language |

  ### Support Engineer (`supportPersonality`)
  | Value | What it means |
  |---|---|
  | `empathetic-resolver` | Treats every ticket as a relationship |
  | `systematic-triage` | Classification, routing, and severity-driven (default) |
  | `knowledge-builder` | Every fix becomes a doc; knowledge loop focus |

  ### Data Analyst (`dataAnalystPersonality`)
  | Value | What it means |
  |---|---|
  | `rigorous-statistician` | Significance, confidence intervals, no p-hacking |
  | `insight-storyteller` | Translates data into narratives for decisions (default) |
  | `pragmatic-quant` | Good-enough analysis fast; directional signals |
  ```

  **B. Update "Init" section** — In the Options table, update the `--docs-history-mode` description:
  - Change: `"Update style for documentation"` → `"Update style: overwrite (default), append-dated, new-dated-file, overwrite-archive"`
  - The interactive TUI now presents these as a select with descriptions; this row clarifies the non-interactive values.

  **C. Update "Doctor" section** — After the existing bullet list, add a subsection:

  ```markdown
  ### Doctor Verbose (`--verbose`)

  `wunderkind doctor --verbose` additionally shows:
  - Full path resolution for global and project OpenCode configs
  - Active region, industry, and regulation baseline
  - All agent personality settings with human-readable descriptions
  - Docs output configuration (path, history mode, enabled status)

  Example output (project context with defaults):

  \`\`\`
  Agent Personalities
  - ciso:         pragmatic-risk-manager  (Balances risk vs. velocity; default posture)
  - fullstack:    code-archaeologist  (Deep digs into legacy systems; explains history)
  - marketing:    data-driven  (Metrics and attribution first; no vanity metrics)
  - qa:           risk-based-pragmatist  (Tests what matters most; ships with confidence)
  - product:      outcome-obsessed  (Business outcomes and measurable impact first)
  - ops:          on-call-veteran  (Incident-hardened; runbook-first)
  - creative:     pragmatic-problem-solver  (Design that ships; form follows function)
  - brand:        authentic-builder  (No spin; build trust through radical transparency)
  - devrel:       dx-engineer  (Developer experience as a product; DX metrics)
  - legal:        pragmatic-advisor  (Risk-calibrated; enables the business to move)
  - support:      systematic-triage  (Classification, routing, and severity-driven)
  - data analyst: insight-storyteller  (Translates data into narratives for decisions)
  \`\`\`
  ```

  **D. Update "Install Scope" section** — Add a note:
  ```markdown
  > **Project-scope install note**: When installing with `--scope=project`, Wunderkind automatically writes `.opencode/oh-my-opencode.jsonc` to the current directory. This file configures the OMO agent suite for this project and is required for agents to load. Running `wunderkind init` also writes this file. If this file is missing, `wunderkind doctor` will report a warning.
  ```

  **Must NOT do**:
  - Do not remove any existing sections.
  - Do not change existing CLI command examples.
  - Do not use emoji (per conventions).

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: Pure documentation update.
  - Skills: [] — No special skills.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: nothing | Blocked By: Tasks 1–5 (content depends on final decisions)

  **References**:
  - File: `README.md` — Full contents (read before editing)
  - Personality hints source: `src/cli/personality-meta.ts` (Task 1) — copy exact strings
  - Existing README sections: "Configuration", "Directory Structure", "Install Scope", "Doctor", "Init"

  **Acceptance Criteria**:
  - [ ] "Personality Reference" section present with all 12 agent tables
  - [ ] Each table has exactly 3 rows + header
  - [ ] `--docs-history-mode` Init options table row updated
  - [ ] "Doctor Verbose" subsection added with example output
  - [ ] "Install Scope" note about project-scope OMO config added
  - [ ] No existing content removed or broken

  **QA Scenarios**:
  ```
  Scenario: README completeness check
    Tool: Bash
    Steps: grep -c "wunderkind:ciso\|pragmatic-risk-manager\|Personality Reference" README.md
    Expected: At least 3 matches
    Evidence: .sisyphus/evidence/task-7-readme-check.txt

  Scenario: No broken markdown tables
    Tool: Bash
    Steps: grep -c "^|" README.md | head -1
    Expected: Number of pipe-table rows is significantly higher than before (all personality rows present)
    Evidence: .sisyphus/evidence/task-7-readme-tables.txt
  ```

  **Commit**: YES | Message: `docs(readme): add personality reference, OMO project-scope note, doctor verbose example` | Files: `README.md`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
Ordered commits (TDD approach — tests can be co-committed with features given tight coupling):
1. `feat(meta): add shared personality and docs-history metadata map` — `src/cli/personality-meta.ts`
2. `feat(config-manager): add writeOmoAgentConfig helper` — `src/cli/config-manager/index.ts`
3. `feat(init): add personality hint text and convert docs history mode to select` — `src/cli/init.ts`
4. `feat(doctor): show agent personalities under verbose mode` — `src/cli/doctor.ts`
5. `fix(install/init): write project-local OMO agent config on project-scope install and init` — `src/cli/init.ts`, `src/cli/cli-installer.ts`, `src/cli/tui-installer.ts`, `src/cli/doctor.ts`
6. `test: cover personality hints, OMO config writer, and doctor verbose` — all test files
7. `docs(readme): add personality reference, OMO project-scope note, doctor verbose example` — `README.md`

## Success Criteria
- `tsc --noEmit` exits 0
- `bun test` exits 0 with all tests passing
- `bun run build` succeeds
- Project-scope install writes `.opencode/oh-my-opencode.jsonc`
- `wunderkind doctor --verbose` shows "Agent Personalities" in project context
- All personality `p.select` calls in TUI have hint strings
- Docs history mode prompt is a `p.select` with 4 options
- README includes full personality reference tables
