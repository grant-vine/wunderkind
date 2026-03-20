# Learnings — google-stitch-mcp-design-md

## Project Conventions
- TypeScript strict mode: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- Named exports only (except `src/index.ts`)
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- Bun is the package manager (never npm/yarn)
- ESM only — all imports use `.js` extension
- `agents/` is generated — do not hand-edit

## Config Architecture
- `src/cli/types.ts` — all config interfaces (`ProjectConfig`, `DetectedConfig`, `InstallConfig`, etc.)
- `src/cli/config-manager/index.ts` — defaults, merges, reads, writes
- `schemas/wunderkind.config.schema.json` — JSON schema for validation (oneOf: global | project)
- `DEFAULT_INSTALL_CONFIG` at line 148 — add new field defaults here
- `DEFAULT_PROJECT_CONFIG` at line 174 — mirrors project fields from DEFAULT_INSTALL_CONFIG
- `PROJECT_CONFIG_KEYS` at line 131 — must add new project keys here for serialization

## Test Patterns
- Mock with `mock.module(...)` at file level in test files
- Use `__setConfigManagerPathOverrideForTests()` for path override in tests
- Always restore `process.cwd()` BEFORE deleting temp dirs
- Use `const CACHE_BUST = Date.now()` at file scope for dynamic import cache busting
- Bun coverage merge bug: config-manager shows ~16% in combined run; run isolated to see 96.15%

## Key Source Patterns
- `resolveOpenCodeConfigPath()` — resolves global vs project OpenCode config path
- `parseConfig()` — JSONC-aware parser
- `addPluginToOpenCodeConfig()` around line 706 — idempotent plugin merge to mirror for MCP
- `detectCurrentConfig()` around line 647 — effective config merge for doctor/init
- `writeWunderkindConfig()` — writes project config
- `renderProjectConfig()` around line 531 — must be extended for new keys

## Field Placement Rules (from plan spec)
- `designTool`, `designPath`, `designMcpOwnership` → persisted `ProjectConfig`/`DetectedConfig` fields
- `stitchSetup`, `stitchApiKeyFile` → `InitOptions`/CLI-only ephemeral inputs, NEVER written to Wunderkind config

## [2026-03-20] Task: task-1
- Keep design workflow settings project-local: add them to `ProjectConfig`, `DetectedConfig`, `PROJECT_CONFIG_KEYS`, project defaults, project rendering, and project-schema properties only
- `InstallConfig` can carry the new design fields as optional during this phase so existing install/init flows typecheck without widening edits outside the scoped files; `writeWunderkindConfig()` backfills project defaults before persisting
- `coerceProjectConfig()` should validate new enum-backed fields with type guards so invalid `designTool` or `designMcpOwnership` values are ignored while free-form `designPath` still round-trips
- `renderProjectWunderkindConfig()` writes the design block after `prdPipelineMode`, which keeps the template comments readable and makes the new settings easy to discover in `.wunderkind/wunderkind.config.jsonc`
- The Stitch adapter contract is stable as a constant registry entry: static metadata, canonical design sections, and an OpenCode remote MCP payload that swaps between file and env header templates

## [2026-03-20] Task: task-2
- Mirror `resolveOpenCodeConfigPath()` precedence locally for project-scoped MCP helpers so callers can target an explicit project root without mutating global config-manager runtime state
- Treat Stitch presence as either the canonical `mcp.google-stitch` key or any remote MCP entry whose URL matches the adapter URL after trimming one trailing slash; this lets detection recognize reused shared configs
- Keep merge drift rules intentionally narrow: overwrite only when the Stitch entry is missing, its URL differs after slash trimming, or `oauth` is explicitly `true`; missing `oauth` stays non-drifted and preserves existing headers
- Separate secret persistence from config merge: `writeStitchSecretFile()` writes the trimmed key to `.wunderkind/stitch/google-stitch-api-key`, while `mergeStitchMcpConfig()` always writes the `{file:...}` authorization placeholder and never raw secret material

## [2026-03-20] Task: task-3
- `init` flag coverage in `tests/unit/cli-help-text.test.ts` can validate both surfacing and guardrail behavior quickly by pairing `runCliHelp("init", "--help")` assertions with `runCliRaw(...)` status/error checks for invalid enum values.
- Because `bin/wunderkind.js` executes compiled `dist/cli/index.js`, evidence commands that invoke the bin entry must run after `bun run build` so the command output reflects newly added flags and validation.
- For this phase, `src/cli/index.ts` can pass the new init-only design/stitch fields through `initOptions` without changing `src/cli/init.ts`; TypeScript remains clean due structural assignability and strict optional handling.
