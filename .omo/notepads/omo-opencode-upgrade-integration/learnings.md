
## 2026-05-15 docs/init-deep refresh
- Added project-local `CONTEXT.md` as a durable shared-context lane for docs grilling, planning, and future compatibility work.
- Bootstrapped managed docs lanes under `docs/` using the canonical filenames from `src/agents/docs-config.ts`.
- Confirmed this repo now operates with docs output enabled locally (`docsEnabled: true`, `docsPath: ./docs`, `docHistoryMode: overwrite`).
- Refreshed `AGENTS.md` package metadata to `v0.17.0` and corrected the shipped skill inventory reference to 23 skills.
- Captured latest upstream/source references directly in `docs/README.md` so future refreshes have a stable starting point.
