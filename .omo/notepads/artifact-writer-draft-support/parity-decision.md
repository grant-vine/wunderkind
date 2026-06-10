# Draft lane parity decision

We intentionally kept `.sisyphus/drafts/` as a write-on-demand lane for this change.

Reasoning:
- the requested fix was explicit `draft` support in `wunderkind_write_artifact`
- the security boundary lives in `src/artifact-writer.ts`, not in init/bootstrap behavior
- bootstrapping `.sisyphus/drafts/` in `wunderkind init` would expand scope beyond the narrow lane fix
- current implementation already creates parent directories safely on demand

Result:
- no changes were made to `src/cli/init.ts`, `README.md`, or `AGENTS.md` for draft-lane parity
- core draft support does not depend on any bootstrap or docs changes
