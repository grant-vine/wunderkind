# Decisions — docs-output-system

## 2026-03-10 Session Start

### Architecture Decisions

- D1 fixes config path bug (`wunderkind.config.jsonc` → `.wunderkind/wunderkind.config.jsonc`) in src/index.ts and all 12 agent factories
- D2 owns docs-output validation, normalization, bootstrap helper — D5 MUST consume this, not reimplement
- D3 runtime injection uses sentinel: `## Documentation Output` heading (exact runtime injection)
- D4 static agent heading MUST be `## Documentation Output (Static Reference)` to avoid conflicting with D3 sentinel
- D5 owns project-context detection, `init` command, `doctor` command
- `init` MUST NOT mutate local `opencode.json` plugin entry
- `doctor` is read-only, always shows install info, adds project info/checks in project context

### Config Semantics
- `docsEnabled`, `docsPath`, `docHistoryMode` are project-init customizations only (NOT base-install)
- `docsPath` is stored as-is but normalized for filesystem operations
- Absolute paths and `../` traversal REJECTED during validation

### CLI Contract
- `install` = plugin registration
- `init` = project-local bootstrap (current folder only, no upward traversal)
- `doctor` = read-only diagnostics

## 2026-03-10 D1 Implementation Decisions

- Kept `LEGACY_WUNDERKIND_CONFIG = join(process.cwd(), "wunderkind.config.jsonc")` unchanged; only prose references were migrated to `.wunderkind/wunderkind.config.jsonc`.
- Added docs-output fields (`docsEnabled`, `docsPath`, `docHistoryMode`) as required in `InstallConfig` and `DetectedConfig`; CLI args remain optional and normalize to defaults during install config creation.
- `detectCurrentConfig()` now sources config through `readWunderkindConfig()` to enforce project-over-global precedence consistently in one place.
- Config precedence tests use real temporary writes to project/global config paths with restore-on-finally behavior, avoiding persistent node module mocks.
