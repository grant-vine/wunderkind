# Issues — docs-output-system

## 2026-03-10 Session Start

### Known Bugs to Fix

1. **Config path bug** (D1.1): `src/index.ts` says `wunderkind.config.jsonc` — should be `.wunderkind/wunderkind.config.jsonc`
2. **12 agent files** also reference bare config path (same bug)

### Gotchas

- `exactOptionalPropertyTypes: true` — must use correct optional typing (omit, don't pass undefined)
- `noUncheckedIndexedAccess: true` — array index access returns `T | undefined`
- `DetectedConfig` currently missing docs-output fields — will need updating in D1.2
- `InstallConfig` also missing docs-output fields
- Test mocks in `cli-installer.test.ts` mock `detectCurrentConfig` return value — will need updating when `DetectedConfig` gains new required fields
- The `writeWunderkindConfig` function currently takes `InstallConfig` — when we add new required fields, all callers must provide them
