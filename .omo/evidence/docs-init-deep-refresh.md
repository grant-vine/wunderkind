
## 2026-05-15 evidence snapshot
- Created `CONTEXT.md` at project root.
- Created managed docs files:
  - `docs/README.md`
  - `docs/marketing-strategy.md`
  - `docs/design-decisions.md`
  - `docs/product-decisions.md`
  - `docs/engineering-decisions.md`
  - `docs/security-decisions.md`
- Refreshed `AGENTS.md` from stale `v0.16.0` package banner to `v0.17.0` and updated the skill count reference to 23.
- Verified docs output config remains enabled locally in `.wunderkind/wunderkind.config.jsonc` with `docsPath: ./docs` and `docHistoryMode: overwrite`.
- Verified current repo state after refresh:
  - `skills/*/SKILL.md` count = 23
  - docs directory contains all six expected markdown files
  - `CONTEXT.md` exists
  - `AGENTS.md` no longer contains `v0.16.0`
