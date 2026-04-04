# PROJECT KNOWLEDGE BASE — wunderkind

**Package:** `@grant-vine/wunderkind` v0.10.8  
**Stack:** TypeScript · Bun · ESM (`"type": "module"`) · `@opencode-ai/plugin`

oh-my-openagent addon that injects 6 retained specialist AI agents (marketing, design, product, engineering, security, legal) into any OpenCode project via a `bunx`/`npx` interactive installer. Uses an orchestrator-first topology with `product-wunderkind` as the default front door.

---

## STRUCTURE

```
wunderkind/
├── src/
│   ├── index.ts               # Plugin entry — default-exports Plugin object
│   ├── build-agents.ts        # Build-time generator — writes agents/*.md
│   ├── agents/                # Agent factory functions + docs-output metadata
│   ├── cli/                   # Install/upgrade/init/doctor/uninstall/gitignore commands
│   └── types/                 # Ambient type declarations (bun-sqlite.d.ts, opencode-plugin.d.ts)
├── agents/                    # GENERATED *.md — do not hand-edit; run `bun run build`
├── commands/                  # Shipped native command assets (currently docs-index)
├── skills/                    # Static SKILL.md files for 20 shipped skills + SKILL-STANDARD.md
├── tests/unit/                # Bun unit suite for CLI, docs, config, uninstall, and build flows
├── bin/wunderkind.js          # ESM shim with shebang — imports dist/cli/index.js
├── .claude-plugin/plugin.json # Claude/OpenCode plugin manifest (keep in sync with package.json)
├── .github/workflows/         # CI: publish on v* tag push
└── oh-my-openagent.jsonc      # Agent registration config (category, color, mode per agent; legacy oh-my-opencode.jsonc still supported)
```

**`agents/` is generated.** Do not edit files there directly — they are overwritten by `bun run build`.  
**`skills/` is static source.** These are hand-authored SKILL.md files published as-is.

### Per-project runtime directory (created by installer)

```
<project-root>/
└── .wunderkind/                 # Per-project config + state (gitignored)
    └── wunderkind.config.jsonc  # Per-project config override
```

### Global directory (created by installer at first run)

```
~/.wunderkind/                   # Global config baseline
└── wunderkind.config.jsonc      # Global config defaults (region, industry, regulations — optional if built-in defaults are acceptable)
```

---

## WHERE TO LOOK

| Task | Location |
|---|---|
| Add / edit an agent | `src/agents/<name>.ts` → rebuild |
| Change agent category defaults | `oh-my-openagent.jsonc` (legacy `oh-my-opencode.jsonc` still supported) |
| Change installer TUI flow | `src/cli/tui-installer.ts` |
| Change non-interactive installer | `src/cli/cli-installer.ts` |
| Change what config is written to user projects | `src/cli/config-manager/index.ts` |
| Change CLI flags / help text | `src/cli/index.ts` |
| Add / edit a sub-skill | `skills/SKILL-STANDARD.md` + `skills/<name>/SKILL.md` |
| Audit current skill ownership/disposition | `skills/SKILL-STANDARD.md` |
| Plugin entry point | `src/index.ts` |
| Build pipeline (two-step) | `src/build-agents.ts` + `package.json` scripts |
| Change install scope | `src/cli/index.ts` (`--scope` flag) + `src/cli/tui-installer.ts` + `src/cli/cli-installer.ts` |
| Change config paths / constants | `src/cli/config-manager/index.ts` |
| Check if oh-my-openagent is installed | `src/cli/config-manager/index.ts` → `detectCurrentConfig()` |
| Change wunderkind config written | `src/cli/config-manager/index.ts` → `writeWunderkindConfig()` |
| Add gitignore entries | `src/cli/gitignore-manager.ts` → `addAiTracesToGitignore()` |

---

## CLI COMMANDS (FOR MAINTAINERS)

Wunderkind provides a tiered CLI for installation, project setup, and health checks.

- **`install`** (`src/cli/cli-installer.ts` + `src/cli/tui-installer.ts`) — Registers the plugin in OpenCode configuration (`opencode.json`). This is a one-time global setup.
- **`upgrade`** (`src/cli/cli-installer.ts`) — Refreshes Wunderkind-owned native agents and skills for the selected scope, plus global native commands.
- **`gitignore`** (`src/cli/gitignore-manager.ts`) — Adds `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, and `.opencode/` to `.gitignore` idempotently.
- **`init`** (`src/cli/init.ts`) — Project-level bootstrap. Creates or updates soul files (`.wunderkind/`, `AGENTS.md`, `.sisyphus/`), initializes the Documentation Output folder if enabled, defaults docs history mode to `append-dated`, and sets the PRD pipeline mode for the project. Re-running init hydrates current project-local SOUL answers.
- **`cleanup`** (`src/cli/cleanup.ts`) — Removes project-local OpenCode plugin wiring and `.wunderkind/` state while leaving `AGENTS.md`, `.sisyphus/`, docs output, and shared global native assets intact.
- **`doctor`** (`src/cli/doctor.ts`) — Read-only diagnostics. Checks installation status, configuration paths, and project soul-file health.
- **`uninstall`** (`src/cli/uninstall.ts`) — Removes Wunderkind plugin wiring and shared global native assets while leaving project-local bootstrap artifacts intact.

---

## DOCUMENTATION OUTPUT

Documentation Output (`docs-output`) allows agents to write persistent files to a project documentation directory.

### Configuration (`src/agents/docs-config.ts`)

`AGENT_DOCS_CONFIG` maps all 6 retained agent keys to their `canonicalFilename` and `eligible` status. When adding a new agent, add an entry to this record first.

- **`canonicalFilename`**: The filename agents are instructed to write to (e.g. `marketing-strategy.md`).
- **`eligible`**: Boolean flag determining if an agent is authorized to write to disk.
- **`DOCS_INDEX_RUNTIME_STATUS`**: Freezes the current contract that `/docs-index` is a shipped native command asset backed by `commands/docs-index.md`.

`buildDocsInstruction(agentKey, docsPath, docHistoryMode)` generates the formatted instruction string used in agent prompt templates.

### Runtime vs Static Headings

Maintaining the distinction between runtime and static headings is critical for the idempotency sentinel check:

- **Runtime heading**: `## Documentation Output` — Injected by `src/index.ts` during the plugin transform when `docsEnabled: true`.
- **Static heading**: `## Documentation Output (Static Reference)` — Embedded directly in agent prompt strings (e.g. `src/agents/marketing-wunderkind.ts`).
- **Sentinel**: `<!-- wunderkind:docs-output-start -->` — Injected by `src/index.ts` to mark the start of the documentation output section.

These strings MUST NOT be identical. If the sentinel or runtime heading matches the static heading, the idempotency check will fail.

### Init-Deep Workflow

`init-deep` is an oh-my-openagent workflow concept, not a Wunderkind CLI command.

Recommended bootstrap sequence:

1. Run `wunderkind init` to create `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, and optional docs scaffolding.
2. Have an agent populate `AGENTS.md` with project knowledge, conventions, and architecture context.
3. Systematically explore the repo and append durable findings to `.sisyphus/notepads/` and `.sisyphus/evidence/`.
4. Use `/docs-index` to refresh or bootstrap the managed docs set when docs output is enabled.

Treat this as the recommended audit/bootstrap workflow when bringing a project up to a high-context Wunderkind baseline.

---

## BUILD

Two-step build — **order matters:**

```bash
bun install
bun run build          # = tsc && bun run dist/build-agents.js
```

Step 1 (`tsc`): compiles `src/` → `dist/`.  
Step 2 (`bun run dist/build-agents.js`): reads compiled agent factories from `dist/agents/`, writes `agents/*.md` prompt files.

`dev` mode only runs step 1: `tsc --watch`. Run `bun run build` after editing agent factories to regenerate markdown.

**Publish:** push a `v*` tag → GitHub Actions builds and runs `npm publish --provenance --access public`. No manual publish step.

---

## TYPESCRIPT CONVENTIONS

All flags are explicit — deviations from stock `strict: true`:

| Flag | Value | Note |
|---|---|---|
| `exactOptionalPropertyTypes` | `true` | Optional props are exact — `a?: T` ≠ `a?: T \| undefined`. Pass `undefined` by omitting, not by value. |
| `noUncheckedIndexedAccess` | `true` | Array/object index access is `T \| undefined`. |
| `noUnusedLocals` | `true` | Unused vars = compile error. |
| `noUnusedParameters` | `true` | Unused params = compile error. |
| `module` | `ESNext` | ESM output only. |
| `moduleResolution` | `bundler` | Bun/bundler-style resolution. |
| `target` | `ES2022` | |
| `types` | `["node"]` | Node types included globally. |

No path aliases. No ESLint/Biome config — TypeScript strict mode is the sole linter.

---

## AGENT CONVENTIONS

- **Named exports only.** No default exports anywhere in `src/`.  
  Exception: `src/index.ts` default-exports the Plugin object (required by `@opencode-ai/plugin` API).
- **Bun is the package manager.** Never `npm install` or `yarn add` in this repo.
- **No `as any`, `@ts-ignore`, `@ts-expect-error`.** Fix types; never suppress.
- **No empty `catch` blocks.**
- **No auto-commits.** Agents must never commit without explicit user instruction.
- **Delegation Contract (Maintainers):** When writing task examples in docs, agents, or skills, always include both required fields:
  - `load_skills`: required in every `task()` call. Use `[]` when no skills apply; never omit.
  - `run_in_background`: required in every `task()` call. Must be explicitly `true` or `false`; never omit.
  - Use `skill(name="...")` to invoke shipped Wunderkind skills and sub-skills directly — never wrap them in `task()`.
  Historical `.sisyphus/**` archives are intentionally excluded from this compliance change.
- **Skill authoring standard lives in `skills/SKILL-STANDARD.md`.** Update it when skill ownership or inventory changes.

---

## AGENTS

| Agent key | Role | Category |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre strategist (brand, community, devrel, GTM) | writing |
| `wunderkind:creative-director` | Brand & UI/UX lead | visual-engineering |
| `wunderkind:product-wunderkind` | VP Product — default orchestrator/front door | writing |
| `wunderkind:fullstack-wunderkind` | CTO-calibre engineer | unspecified-high |
| `wunderkind:ciso` | Security architecture, OWASP, compliance | unspecified-high |
| `wunderkind:legal-counsel` | Legal and regulatory compliance | writing |

Sub-skills: `social-media-maven` + `technical-writer` (marketing-wunderkind) · `visual-artist` (creative-director) · `agile-pm` + `grill-me` + `ubiquitous-language` + `prd-pipeline` + `triage-issue` + `experimentation-analyst` + `write-a-skill` (product-wunderkind) · `db-architect` + `code-health` + `vercel-architect` + `improve-codebase-architecture` + `design-an-interface` + `tdd` (fullstack-wunderkind) · `security-analyst` + `pen-tester` + `compliance-officer` (ciso) · `oss-licensing-advisor` (legal-counsel).

---

## COMMANDS

```bash
bun install                          # install deps
bun run build                        # compile + generate agents/*.md
tsc --noEmit                         # type-check only
node bin/wunderkind.js --help        # test CLI locally
node bin/wunderkind.js install --help
node bin/wunderkind.js upgrade --help
node bin/wunderkind.js uninstall --help
node bin/wunderkind.js doctor --verbose

# Non-interactive install — global scope (default)
node bin/wunderkind.js install --no-tui --scope=global

# Non-interactive install — global scope with explicit shared defaults
node bin/wunderkind.js install --no-tui \
  --scope=global \
  --region="South Africa" \
  --industry=SaaS \
  --primary-regulation=POPIA

# Non-interactive install — project scope using inherited defaults
node bin/wunderkind.js install --no-tui --scope=project

# Non-interactive install — project scope with explicit local overrides
node bin/wunderkind.js install --no-tui \
  --scope=project \
  --region=EU \
  --industry=SaaS \
  --primary-regulation=GDPR

# Gitignore helper
node bin/wunderkind.js gitignore     # add .wunderkind/, AGENTS.md, .sisyphus/, .opencode/ to .gitignore
```

---

## GOTCHAS

- **`exactOptionalPropertyTypes`** — the most common source of type errors when adding new CLI functions. Split calls rather than passing `undefined` for optional params.
- **`agents/` is gitignored** but included in the npm publish via `"files"` in `package.json`. CI generates them during `prepublishOnly`.
- **`.claude-plugin/plugin.json` version** must be manually kept in sync with `package.json` version — no automation exists for this.
- **JSONC comments lost on opencode config write** — `addPluginToOpenCodeConfig()` uses `JSON.stringify` when writing. If the original was a `.jsonc` file with comments those are lost. The file is always written as `.json`.
- **Regex in source**: use `\u001b` not `\x1b` in regex literals (both work in tsc, but LSP reports false positives with `\x1b`).
- **`createRequire`** in `src/cli/index.ts` is the only CommonJS interop usage — used to read `package.json` at runtime. Everything else is pure ESM.
- **`.wunderkind/` dir is gitignored automatically** by both installers (via `addAiTracesToGitignore()`). Per-project config and state are never committed.
- **Legacy `wunderkind.config.jsonc` at project root** causes an error + `exit 1`. Move it to `.wunderkind/wunderkind.config.jsonc`. There is no auto-migration.
- **OpenCode config path** is `~/.config/opencode/opencode.json` (not the legacy `config.json`). The config-manager detects both but always writes to `opencode.json`.
- **oh-my-openagent must be installed before wunderkind** — upstream now prefers `oh-my-openagent` for plugin entries and OMO config basenames, while the npm package and CLI command still remain `oh-my-opencode`. The TUI auto-runs `bunx oh-my-opencode install` if OMO is absent; the non-interactive CLI exits 1 with instructions instead.
- **Wunderkind never writes agent model config** — `writeWunderkindAgentConfig()` was removed in an earlier pre-1.0 release. Agent categories are configured via the shipped OMO config template at build time; each agent inherits its model from the category definition in that file.
- **OMO detection uses `detectCurrentConfig()`** — checks the `plugin` array in `opencode.json` for a `"@grant-vine/wunderkind"` entry to determine if wunderkind is already installed. OMO compatibility now prefers `oh-my-openagent.{json,jsonc}` and falls back to legacy `oh-my-opencode.{json,jsonc}` when inspecting dedicated OMO config files.
- **Project config is intentionally sparse** — `.wunderkind/wunderkind.config.jsonc` should only contain values that differ from inherited defaults. Missing baseline fields are expected and should render as inherited in `wunderkind doctor --verbose`.
- **PRD pipeline mode lives in project config** — `prdPipelineMode` is set during `wunderkind init`; use `filesystem` by default, and only use `github` when `gh` is installed and the repo is GitHub-ready. Legacy configs without this field should continue to resolve to `filesystem`.
- **code-health is a read-only audit skill** — the `code-health` skill (owned by `fullstack-wunderkind`) produces severity-ranked audit reports as structured markdown in the response. It does not invoke any automated cleanup tool, Python scripts, or external package manager workflows. There is no config key for enabling automated cleanup; any stale config keys from older versions are silently ignored on read.
- **`/docs-index` is shipped as a native command asset** — its source lives in `commands/docs-index.md`, and it may suggest `init-deep` as an upstream OMO follow-up workflow rather than a Wunderkind CLI subcommand.
- **Platform strategy: overlay now, migrate only when triggers fire** — Wunderkind is and should remain a synchronous OMO/OpenCode plugin (zero runtime process). The explicit migration gates are documented in `.sisyphus/plans/overlay-decision.md`; do not treat platform migration as a default next step. Trigger threshold requires at least two of five concrete capability gaps to fire simultaneously.
- **Audit-style reviewer freshness rule** — when using Metis, Momus, oracle, or any equivalent critic agent for a review pass, always spawn a **fresh agent/session** for each new round after fixes are made. Never reuse the previous reviewer session — reused sessions narrow their attention to previously reported findings instead of performing a fresh audit.

---

## TESTING

### Test suite

```bash
bun test tests/unit/                          # full suite (282 tests, 0 fail)
bun run test:coverage:config-manager          # accurate config-manager coverage (isolated)
bun test --coverage tests/unit/               # full combined report (config-manager shows low — see Bun bug below)
```

### Bun coverage merge bug — `config-manager/index.ts` shows ~16% in combined run

Any test file that calls `mock.module("../cli/config-manager/index.ts", ...)` at the top level causes its worker to emit zero coverage for that module. When Bun merges workers, the zero data overwrites the real data. The actual isolated coverage is **96.15%** — run `bun run test:coverage:config-manager` to verify. This is a Bun bug; do not attempt to restructure mocks to work around it.

### Dynamic import query-string busting

When a test needs a fresh module instance per test via dynamic import, use a **single file-level** `Date.now()` value, not a new one inside each test. Bun attributes coverage by URL — per-test URLs cause only the first import to count toward coverage. Pattern: `const CACHE_BUST = Date.now();` at file scope, then reuse it in each `import(...)`.

### `process.chdir()` cleanup order

Always restore `process.cwd()` **before** deleting the temp directory in the `finally` block. Deleting the directory while still chdir'd into it leaves the process in a non-existent path, corrupting all subsequent tests that use relative paths.

```ts
} finally {
  process.chdir(ORIGINAL_CWD);               // FIRST — restore
  if (tempDir) rmSync(tempDir, { recursive: true, force: true }); // THEN — delete
}
```

### Portable path pattern

All test files must use `new URL("../../", import.meta.url).pathname` to derive `PROJECT_ROOT`. Never hardcode a machine path.

### Accepted coverage ceilings (do not try to cover these)

| File | Lines | Reason |
|---|---|---|
| `src/cli/init.ts` | 456-457 | Dead branch — `normalizeDocHistoryMode()` at line 264 guarantees a valid value before the guard fires |
| `src/cli/cli-installer.ts` | 102-112 | Dead code — `validateNonTuiArgs()` always returns `{valid: true}`; branch exists for future logic |
| `src/agents/docs-index-plan.ts` | 33 | Invariant guard — keys are sourced from `AGENT_DOCS_CONFIG` so they can never be absent from it |
| `src/cli/index.ts` | (absent) | Pure Commander.js wiring with `process.exit()` — subprocess-tested via `cli-help-text.test.ts` |

Full details and coverage snapshot: `.sisyphus/notepads/unit-testing/learnings.md`.
