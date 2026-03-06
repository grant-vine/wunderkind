# PROJECT KNOWLEDGE BASE — wunderkind

**Package:** `@grant-vine/wunderkind` v0.3.1  
**Stack:** TypeScript · Bun · ESM (`"type": "module"`) · `@opencode-ai/plugin`

oh-my-opencode addon that injects 8 specialist AI agents (marketing, design, product, engineering, brand, QA, ops, security) into any OpenCode project via a `bunx`/`npx` interactive installer.

---

## STRUCTURE

```
wunderkind/
├── src/
│   ├── index.ts               # Plugin entry — default-exports Plugin object
│   ├── build-agents.ts        # Build-time generator — writes agents/*.md
│   ├── agents/                # Agent factory functions + types (see src/agents/AGENTS.md)
│   ├── memory/                # Memory adapter system (file, sqlite, vector, mem0)
│   │   ├── index.ts           # Public API: takeNote, searchMemories, exportMemories, importMemories, etc.
│   │   ├── slug.ts            # deriveProjectSlug() — project namespacing for Qdrant + mem0
│   │   ├── docker.ts          # startMemoryServices() — runs docker-compose from ~/.wunderkind/
│   │   ├── format.ts          # generateSlug() for memory entry slugs
│   │   └── adapters/          # file, sqlite, vector, mem0, stub adapter implementations
│   └── cli/                   # Installer CLI (see src/cli/AGENTS.md)
├── agents/                    # GENERATED *.md — do not hand-edit; run `bun run build`
├── skills/                    # Static SKILL.md files for 8 sub-skills
├── bin/wunderkind.js          # ESM shim with shebang — imports dist/cli/index.js
├── .claude-plugin/plugin.json # Claude/OpenCode plugin manifest (keep in sync with package.json)
└── oh-my-opencode.jsonc       # Agent registration config (model, color, mode per agent)
```

**`agents/` is generated.** Do not edit files there directly — they are overwritten by `bun run build`.  
**`skills/` is static source.** These are hand-authored SKILL.md files published as-is.

### Per-project runtime directory (created by installer)

```
<project-root>/
└── .wunderkind/                 # Per-project config + memory (gitignored)
    ├── wunderkind.config.jsonc  # Per-project config override
    ├── memory/                  # File adapter memory storage (one .md per agent)
    ├── memory.db                # SQLite adapter storage
    └── exports/                 # memory export zips (fflate zip format)
```

### Global directory (created by installer at first run)

```
~/.wunderkind/                   # Global config baseline + Docker Compose files
├── wunderkind.config.jsonc      # Global config baseline (per-project overrides take precedence)
├── docker-compose.vector.yml    # Qdrant vector memory adapter
└── docker-compose.mem0.yml      # mem0 memory adapter
```

---

## WHERE TO LOOK

| Task | Location |
|---|---|
| Add / edit an agent | `src/agents/<name>.ts` → rebuild |
| Change agent model defaults | `oh-my-opencode.jsonc` |
| Change installer TUI flow | `src/cli/tui-installer.ts` |
| Change non-interactive installer | `src/cli/cli-installer.ts` |
| Change what config is written to user projects | `src/cli/config-manager/index.ts` |
| Change CLI flags / help text | `src/cli/index.ts` |
| Add / edit a sub-skill | `skills/<name>/SKILL.md` |
| Plugin entry point | `src/index.ts` |
| Build pipeline (two-step) | `src/build-agents.ts` + `package.json` scripts |
| Change install scope | `src/cli/index.ts` (`--scope` flag) + `src/cli/tui-installer.ts` + `src/cli/cli-installer.ts` |
| Export / import memory | `src/memory/index.ts` (`exportMemories`, `importMemories`) |
| Change config paths / constants | `src/cli/config-manager/index.ts` |
| Add / change memory subcommands | `src/cli/memory-commands.ts` |
| Change memory adapter logic | `src/memory/index.ts` (`loadAdapter`) + `src/memory/adapters/` |
| Change project slug derivation | `src/memory/slug.ts` (`deriveProjectSlug`) |

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

| Agent key | Role | Model |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre strategist | claude-sonnet-4-5 |
| `wunderkind:creative-director` | Brand & UI/UX lead | gemini-2.0-flash |
| `wunderkind:product-wunderkind` | VP Product | claude-sonnet-4-5 |
| `wunderkind:fullstack-wunderkind` | CTO-calibre engineer | claude-sonnet-4-5 |
| `wunderkind:brand-builder` | Community, PR, thought leadership | claude-sonnet-4-5 |
| `wunderkind:qa-specialist` | TDD, coverage, user story review | claude-sonnet-4-5 |
| `wunderkind:operations-lead` | SRE/SLO, runbooks, incident | claude-sonnet-4-5 |
| `wunderkind:ciso` | Security, OWASP, compliance | claude-sonnet-4-5 |

Sub-skills: `social-media-maven` (marketing) · `visual-artist` (creative) · `agile-pm` (product) · `db-architect` + `vercel-architect` (fullstack) · `security-analyst` + `pen-tester` + `compliance-officer` (ciso).

---

## MEMORY ADAPTERS

Four adapters selectable via `memoryAdapter` in `wunderkind.config.jsonc`. Default is `file`.

| Adapter | Storage | Namespace |
|---|---|---|
| `file` (default) | `.wunderkind/memory/<agent>.md` per project | One file per agent |
| `sqlite` | `.wunderkind/memory.db` per project | Agent name column |
| `vector` | Qdrant (external) — single collection `wunderkind-memories` | `group_id` payload = project slug |
| `mem0` | mem0 API (external) | composite `agentId = ${projectSlug}:${agent}` |

**Project slug** is derived by `deriveProjectSlug()` in `src/memory/slug.ts`. Reads `package.json` `name` field, sanitises to lowercase alphanumeric + hyphens. Fallback: `path.basename(cwd())`.

**Docker Compose** for `vector` and `mem0` adapters lives in `~/.wunderkind/` (global), not in the project directory. Run `wunderkind memory start` to bring up the relevant service.

Config for adapters goes into `wunderkind.config.jsonc`. The project config (`.wunderkind/wunderkind.config.jsonc`) is merged on top of the global baseline (`~/.wunderkind/wunderkind.config.jsonc`) at runtime.

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

# Memory commands
node bin/wunderkind.js memory take-note --agent ciso --note "Always require MFA for admin routes"
node bin/wunderkind.js memory take-note --agent ciso --note "Critical finding" --pin
node bin/wunderkind.js memory search --agent fullstack-wunderkind --query "database"
node bin/wunderkind.js memory count                    # all agents
node bin/wunderkind.js memory count --agent ciso
node bin/wunderkind.js memory reduce-noise --agent ciso           # preview
node bin/wunderkind.js memory reduce-noise --agent ciso --confirm # prune
node bin/wunderkind.js memory status
node bin/wunderkind.js memory start                    # start Docker Compose for vector/mem0
node bin/wunderkind.js memory export
node bin/wunderkind.js memory export --output backup.zip
node bin/wunderkind.js memory import backup.zip
node bin/wunderkind.js memory import backup.zip --strategy=overwrite

# Gitignore helper
node bin/wunderkind.js gitignore     # add .wunderkind/, AGENTS.md, .sisyphus/, .opencode/ to .gitignore
```

---

## GOTCHAS

- **`exactOptionalPropertyTypes`** — the most common source of type errors when adding new CLI functions. Split calls rather than passing `undefined` for optional params.
- **`agents/` is gitignored** but included in the npm publish via `"files"` in `package.json`. CI generates them during `prepublishOnly`.
- **`.claude-plugin/plugin.json` version** must be manually kept in sync with `package.json` version — no automation exists for this.
- **JSONC config editing in config-manager** uses regex replacement (not AST) to preserve comments when adding the plugin entry. Fragile — be careful when modifying that logic.
- **Regex in source**: use `\u001b` not `\x1b` in regex literals (both work in tsc, but LSP reports false positives with `\x1b`).
- **`createRequire`** in `src/cli/index.ts` is the only CommonJS interop usage — used to read `package.json` at runtime. Everything else is pure ESM.
- **`.wunderkind/` dir is gitignored automatically** by both installers (via `addAiTracesToGitignore()`). Per-project config and memory are never committed.
- **Legacy `wunderkind.config.jsonc` at project root** causes an error + `exit 1`. Move it to `.wunderkind/wunderkind.config.jsonc`. There is no auto-migration.
- **Docker Compose files** for `vector`/`mem0` memory adapters live in `~/.wunderkind/` (global), NOT in the project directory. The installer copies them there on first run.
- **`deriveProjectSlug()`** in `src/memory/slug.ts` is used for Qdrant `group_id` payload and mem0 composite `agentId` namespacing. Changing slug derivation will orphan existing memories in vector/mem0 adapters.
- **`exportMemories` / `importMemories`** use `fflate` for zip — NOT `Bun.Archive` (that API produces tar.gz only).
- **OpenCode config path** is `~/.config/opencode/opencode.json` (not the legacy `config.json`). The config-manager detects both but always writes to `opencode.json`.
