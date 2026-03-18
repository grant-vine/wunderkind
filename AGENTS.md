# PROJECT KNOWLEDGE BASE — wunderkind

**Package:** `@grant-vine/wunderkind` v0.9.10  
**Stack:** TypeScript · Bun · ESM (`"type": "module"`) · `@opencode-ai/plugin`

oh-my-openagent addon that injects 12 specialist AI agents (marketing, design, product, engineering, brand, QA, ops, security, devrel, legal, support, data analysis) into any OpenCode project via a `bunx`/`npx` interactive installer.

---

## STRUCTURE

```
wunderkind/
├── src/
│   ├── index.ts               # Plugin entry — default-exports Plugin object
│   ├── build-agents.ts        # Build-time generator — writes agents/*.md
│   ├── agents/                # Agent factory functions + types (see src/agents/AGENTS.md)
│   ├── cli/                   # Installer CLI (see src/cli/AGENTS.md)
│   └── types/                 # Ambient type declarations (bun-sqlite.d.ts, opencode-plugin.d.ts)
├── agents/                    # GENERATED *.md — do not hand-edit; run `bun run build`
├── skills/                    # Static SKILL.md files for 8 sub-skills
├── tests/unit/                # Bun test suite (cli-installer.test.ts)
├── bin/wunderkind.js          # ESM shim with shebang — imports dist/cli/index.js
├── .claude-plugin/plugin.json # Claude/OpenCode plugin manifest (keep in sync with package.json)
├── .github/workflows/         # CI: publish on v* tag push
└── oh-my-opencode.jsonc       # Agent registration config (category, color, mode per agent)
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
└── wunderkind.config.jsonc      # Global config baseline (region, industry, regulations only)
```

---

## WHERE TO LOOK

| Task | Location |
|---|---|
| Add / edit an agent | `src/agents/<name>.ts` → rebuild |
| Change agent category defaults | `oh-my-opencode.jsonc` |
| Change installer TUI flow | `src/cli/tui-installer.ts` |
| Change non-interactive installer | `src/cli/cli-installer.ts` |
| Change what config is written to user projects | `src/cli/config-manager/index.ts` |
| Change CLI flags / help text | `src/cli/index.ts` |
| Add / edit a sub-skill | `skills/<name>/SKILL.md` |
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
- **`init`** (`src/cli/init.ts`) — Project-level bootstrap. Creates soul files (`.wunderkind/`, `AGENTS.md`, `.sisyphus/`) and initializes the Documentation Output folder if enabled.
- **`doctor`** (`src/cli/doctor.ts`) — Read-only diagnostics. Checks installation status, configuration paths, and project soul-file health.

---

## DOCUMENTATION OUTPUT

Documentation Output (`docs-output`) allows agents to write persistent files to a project documentation directory.

### Configuration (`src/agents/docs-config.ts`)

`AGENT_DOCS_CONFIG` maps all 12 agent keys to their `canonicalFilename` and `eligible` status. When adding a new agent, add an entry to this record first.

- **`canonicalFilename`**: The filename agents are instructed to write to (e.g. `marketing-strategy.md`).
- **`eligible`**: Boolean flag determining if an agent is authorized to write to disk.
- **`DOCS_INDEX_RUNTIME_STATUS`**: Freezes the current W8A truth that `/docs-index` is prompt convention only and not executable in the current plugin surface.

`buildDocsInstruction(agentKey, docsPath, docHistoryMode)` generates the formatted instruction string used in agent prompt templates.

### Runtime vs Static Headings

Maintaining the distinction between runtime and static headings is critical for the idempotency sentinel check:

- **Runtime heading**: `## Documentation Output` — Injected by `src/index.ts` during the plugin transform when `docsEnabled: true`.
- **Static heading**: `## Documentation Output (Static Reference)` — Embedded directly in agent prompt strings (e.g. `src/agents/marketing-wunderkind.ts`).
- **Sentinel**: `<!-- wunderkind:docs-output-start -->` — Injected by `src/index.ts` to mark the start of the documentation output section.

These strings MUST NOT be identical. If the sentinel or runtime heading matches the static heading, the idempotency check will fail.

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

---

## AGENTS

| Agent key | Role | Category |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre strategist | writing |
| `wunderkind:creative-director` | Brand & UI/UX lead | visual-engineering |
| `wunderkind:product-wunderkind` | VP Product | writing |
| `wunderkind:fullstack-wunderkind` | CTO-calibre engineer | unspecified-high |
| `wunderkind:brand-builder` | Community, PR, thought leadership | writing |
| `wunderkind:qa-specialist` | TDD, coverage, user story review | unspecified-high |
| `wunderkind:operations-lead` | SRE/SLO, runbooks, incident response | unspecified-high |
| `wunderkind:ciso` | Security architecture, OWASP, compliance | unspecified-high |
| `wunderkind:devrel-wunderkind` | Developer relations and advocacy | writing |
| `wunderkind:legal-counsel` | Legal and regulatory compliance | writing |
| `wunderkind:support-engineer` | Technical support and troubleshooting | writing |
| `wunderkind:data-analyst` | Data analysis and insights | writing |

Sub-skills: `social-media-maven` (marketing) · `visual-artist` (creative) · `agile-pm` (product) · `db-architect` + `vercel-architect` (fullstack) · `security-analyst` + `pen-tester` + `compliance-officer` (ciso).

---

## COMMANDS

```bash
bun install                          # install deps
bun run build                        # compile + generate agents/*.md
tsc --noEmit                         # type-check only
node bin/wunderkind.js --help        # test CLI locally
node bin/wunderkind.js install --help

# Non-interactive install — global scope (default)
node bin/wunderkind.js install --no-tui \
  --scope=global \
  --region="South Africa" \
  --industry=SaaS \
  --primary-regulation=POPIA

# Non-interactive install — project scope (writes opencode.json in cwd)
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
- **oh-my-openagent must be installed before wunderkind** — canonical npm package is `oh-my-openagent`, while upstream technical identifiers remain `oh-my-opencode` (CLI command) and `oh-my-opencode.jsonc` (config filename). The TUI auto-runs `bunx oh-my-opencode install` if OMO is absent; the non-interactive CLI exits 1 with instructions instead.
- **Wunderkind never writes agent model config** — `writeWunderkindAgentConfig()` was removed in v0.5.0. Agent categories are configured via `oh-my-opencode.jsonc` at build time; each agent inherits its model from the category definition in that file.
- **OMO detection uses `detectCurrentConfig()`** — checks the `plugin` array in `opencode.json` for a `"@grant-vine/wunderkind"` entry to determine if wunderkind is already installed. OMO itself is detected by the TUI by looking for `oh-my-opencode.{json,jsonc}` in the OpenCode config dir.
