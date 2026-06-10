# Issues / Gotchas

## Known Pre-existing Issues
- `cli-installer.ts` L46, L64: `\x1b` in regex — pre-existing LSP error, NOT to be fixed in this overhaul
- `bun:test` module not found in LSP — false positive, ignore; `tsc --noEmit` is authoritative

## Risks to Watch
- `exactOptionalPropertyTypes`: when adding `scope` to `InstallArgs`/`DetectedConfig`, ensure it's required (not optional) to avoid type errors
- Wave 2 runs AFTER Wave 1 — tsc will be non-zero after Task 3 (interface change) until all adapters updated (Tasks 5-9)
- fflate must be installed (`bun add fflate`) before Task 10 implementation
- Task 10 and Task 11 are both in Wave 3 — run in parallel but independently
