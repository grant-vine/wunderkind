# Learnings — docs-output-system

## 2026-03-10 Session Start: ses_3274d39a3ffeTP9xdgrD18mk06

### Codebase Conventions

- **TypeScript strict flags**: `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- **Named exports only** — except `src/index.ts` which default-exports the Plugin
- **Bun is the package manager** — never npm
- **No `as any`, `@ts-ignore`, `@ts-expect-error`**
- ESM modules only (`"type": "module"`)
- Path: `.wunderkind/wunderkind.config.jsonc` (project), `~/.wunderkind/wunderkind.config.jsonc` (global)

### Current State (before D1)

- `src/index.ts` references bare `wunderkind.config.jsonc` (BUG — should be `.wunderkind/wunderkind.config.jsonc`)
- 12 agent files in `src/agents/*.ts` also reference bare config path
- `src/cli/config-manager/index.ts` already uses correct `.wunderkind/wunderkind.config.jsonc` path via constants
- `InstallConfig` in `src/cli/types.ts` lacks `docsEnabled`, `docsPath`, `docHistoryMode`
- No `readWunderkindConfig()` exported function exists yet
- No `init` or `doctor` CLI commands exist yet
- No `docs-config.ts` in `src/agents/` yet

### Config Path Constants (existing, correct)
```
GLOBAL_WUNDERKIND_DIR = join(homedir(), ".wunderkind")
GLOBAL_WUNDERKIND_CONFIG = join(GLOBAL_WUNDERKIND_DIR, "wunderkind.config.jsonc")
WUNDERKIND_DIR = join(process.cwd(), ".wunderkind")
WUNDERKIND_CONFIG = join(WUNDERKIND_DIR, "wunderkind.config.jsonc")
LEGACY_WUNDERKIND_CONFIG = join(process.cwd(), "wunderkind.config.jsonc")  // for legacy detection only
```

### Test Infrastructure

- Tests use `bun:test` with `mock()` and `mock.module()`
- `tests/unit/cli-installer.test.ts` mocks config-manager and gitignore-manager
- `silenceConsole()` helper used to suppress console output during tests

### Agent Structure Pattern
- Each agent file exports `createXxx()` function and `XXX_METADATA` object
- Uses `createAgentToolRestrictions()` for tool restrictions
- Reads `wunderkind.config.jsonc` (bare) — this is the BUG to fix in D1.1

### Dependency Order
```
D1 → { D2, D3 } → D5 → D4
```

### Frozen Config Contract
- `docsEnabled: false` (default)
- `docsPath: "./docs"` (default)  
- `docHistoryMode: "overwrite"` (default)
- `DocHistoryMode = "overwrite" | "append-dated" | "new-dated-file" | "overwrite-archive"`
- Stored in project `.wunderkind/wunderkind.config.jsonc` only (init-only)

## 2026-03-10 D1 Implementation Learnings

- `readWunderkindConfig()` is safest when it parses both project and global JSONC defensively and returns `null` only if both files are missing.
- Field-by-field merge is achieved by object spread (`global` then `project`) plus explicit typed extraction to `Partial<InstallConfig>`.
- Adding required fields to `InstallConfig`/`DetectedConfig` required updating both CLI installer config assembly and TUI config assembly to keep strict TS clean.
- Test-level `mock.module("node:fs")` can leak into unrelated tests; filesystem-based setup/teardown for config precedence tests avoids cross-suite contamination.

## 2026-03-10 D2 Implementation Learnings

- `validateDocsPath` is safest when it first normalizes separators (`\\` to `/`) before checking traversal patterns, so Windows-style input is handled consistently.
- `validateDocHistoryMode` stays strict and forward-compatible by validating against a single `DocHistoryMode[]` allowlist that exactly matches the type contract.
- `bootstrapDocsReadme` should always `mkdirSync(..., { recursive: true })` before write checks; this supports nested docs paths with no extra branching.
- Idempotent bootstrap behavior is easiest to verify with real temp directories and explicit prewritten `README.md` content, avoiding `node:fs` module mocking leakage across test suites.

## 2026-03-10 D5 Implementation Learnings

- `isProjectContext(cwd)` works cleanly as a marker-file check in the current directory only (`package.json`, Bun lockfiles, `tsconfig.json`, `pyproject.toml`, `.git`) with no parent traversal.
- Keeping `wunderkind install` focused on plugin registration and context basics (region/industry/regulation) avoids mixing project bootstrap concerns; project soul-file provisioning now lives in `runInit`.
- Strict idempotency for init is simplest when only `.wunderkind/wunderkind.config.jsonc` is rewritten and all other soul artifacts are `existsSync`-guarded (`AGENTS.md`, `.sisyphus/*`, docs `README.md`).
- For `exactOptionalPropertyTypes`, constructing command option objects incrementally (only setting defined props) avoids `string | undefined` assignment errors when wiring commander flags into typed init options.

## 2026-03-10 D3 Implementation Learnings

- Runtime docs-output injection is safest as an additive block in `experimental.chat.system.transform` guarded by a strict sentinel (`<!-- wunderkind:docs-output-start -->`) checked against `output.system.join("")` for idempotency across repeated transforms.
- `readWunderkindConfig()` can be called synchronously inside the transform, and feature-gating should require `docsEnabled === true`; `null` config and `docsEnabled: false` both cleanly skip injection.
- Stable defaults (`docsPath: "./docs"`, `docHistoryMode: "overwrite"`) should be applied at injection time when partial config omits either field.

## 2026-03-10 D4.1 Implementation Learnings

- A dedicated `AGENT_DOCS_CONFIG` map centralizes canonical docs file naming and eligibility across all 12 agents, keeping docs-output policy explicit and testable.
- TDD red/green flow worked cleanly: red phase failed on missing module import, then green phase passed after implementing strict unknown-key error handling and parameterized docs-path/history output.
- Under strict TypeScript + Bun matchers, tests are most portable when they rely on baseline matcher primitives (`toBe`, `toContain`, explicit try/catch error assertions) instead of Jest-specific helpers.

## 2026-03-10 D4.2 Implementation Learnings

- Eligibility is best determined directly from each factory allow-list (`createAgentToolRestrictions([...])` with both `write` and `edit`), which matched the expected 9 eligible and 3 excluded agents.
- Inserting static docs guidance inside prompt template literals requires escaping all backticks (`\``) to avoid breaking TypeScript string boundaries; unescaped inserts surfaced immediately as LSP parse errors.
- Regeneration via `bun run build` rewrites all 12 `agents/*.md` files, and the new static heading appears only in the 9 eligible generated markdown files while excluded agents remain unchanged.

## 2026-03-10 D4.3 Implementation Learnings

- README.md and AGENTS.md now reflect the complete docs-output feature surface.
- The `install` vs `init` distinction is crucial for user clarity: `install` is global/project plugin registration, while `init` is per-project soul-file bootstrapping.
- Maintainer docs now explicitly highlight the `## Documentation Output` (runtime) vs `## Documentation Output (Static Reference)` (static) heading distinction to protect the idempotency sentinel check.
- Added `/docs-index` documentation as a prompt-text slash command, not a CLI tool.
