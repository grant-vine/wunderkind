# Engineering Decisions

Last refreshed: 2026-08-18T00-00-00Z

## Current technical baseline

- **Language/runtime**: TypeScript + Bun + ESM
- **Plugin package**: `@opencode-ai/plugin@1.18.18`
- **SDK package**: `@opencode-ai/sdk@1.18.18`
- **OMO dependency**: `oh-my-openagent@4.19.4`
- **Current Wunderkind package version**: `0.27.1`
- **Generated agent frontmatter version field**: `wunderkind_version`
- **Frozen current patch-wave target**: OpenCode `1.18.18` + `oh-my-openagent` `4.19.4`, with OMO `v5.0.0-beta.6` explicitly out of scope

## Architecture decisions

### Generated agents are build artifacts
`agents/*.md` are generated from `src/agents/*` factories via the two-step build (`tsc` then `dist/build-agents.js`). Source-of-truth changes belong in `src/` and `skills/`, not in generated markdown.

### Docs output remains project-local
Docs output is validated as a relative, project-local path with no parent traversal and no symlinked segments in the lane.

### Upgrade drift is explicitly observable
`wunderkind doctor` now compares:
- native asset version markers (`.wunderkind-version.json`) for agents/commands/skills
- per-agent markdown frontmatter `wunderkind_version`

This gives both bundle-level and per-agent installed-state visibility.

### Compatibility logic lives in config-manager/doctor/install surfaces
Canonical/legacy OMO naming behavior should concentrate in operational seams (`config-manager`, `doctor`, installer/upgrade), with legacy names limited to `wunderkind migrate` guidance and detection warnings instead of fallback execution. `wunderkind migrate` migrates legacy OMO config into `~/.omo/omo.jsonc` with no-clobber semantics and does not migrate `.sisyphus/` project artifacts.

### Platform routing remains specialized instead of generic
`platform-compatibility` is the promoted `fullstack-wunderkind` route for host/plugin/config-chain drift, OpenCode/OMO contract changes, compatibility audits, and migration-boundary decisions. `supportability-review` is the promoted fullstack-owned route for observability, rollback-readiness, on-call ownership, and launch blockers. `supabase-architect` remains the promoted fullstack-owned route for Supabase-specific auth, RLS, Realtime, Storage, Edge Functions, branching, local dev, observability, and app-data composition when Supabase materially changes the design. The current repo-head skill inventory is `promoted=23`, `wunderkind-specific=4`, `deprecated=1`, and `public/deprecated total=28`.

### The current patch wave is not a provider/model-routing wave
The frozen patch-wave contract targets OpenCode `1.18.18` and OMO `4.19.4`, but it does not change provider/model routing. `oh-my-openagent.jsonc` category models and canonical manifest routing must stay unchanged in this wave.

### The current skill-governance wave adds a narrow supportability route and rejects the overlapping incident skill
The current repo-head skill target is `promoted=23`, `wunderkind-specific=4`, `deprecated=1`, and `public/deprecated total=28` by adding `release-upgrade`, `platform-compatibility`, and `supportability-review`. `supportability-incident` is explicitly rejected because supportability and incident execution already route through `/supportability-review`, `/runbook`, and `/incident-response`.

### CONTEXT.md is part of project bootstrap
`wunderkind init` now ensures `CONTEXT.md`, making the bootstrap artifacts: `.wunderkind/`, `AGENTS.md`, `CONTEXT.md`, `.omo/`, and optional docs scaffolding.

### Prompt optimization reporting is a separate operational seam
The live prompt-optimization reporting path lives in `src/cli/prompt-runtime-contract.ts`, `src/cli/prompt-optimization-runtime-reporting.ts`, and `src/runtime-prompt-sections.ts`. It is deliberately separate from `src/cli/token-audit.ts`, keeps `token-audit` audit-only, and persists latest-only local artifacts under `.wunderkind/runtime/prompt-optimization/`. The operator contract is now one default-off multi-level prompt optimization engine with capability-based settings, cumulative levels, a mandatory security-safe baseline when enabled, and explicit exclusions for persistent cross-session memory writes and automatic context injection.

## Current operational notes

- Docs output is enabled for this repo at `./docs` with history mode `overwrite`.
- The repo’s current managed docs lanes come from `src/agents/docs-config.ts`.
- `/docs-index` is a shipped command asset in `commands/docs-index.md`.
- `init-deep` is documented as an upstream OMO workflow concept, not a Wunderkind CLI command.
- This repo currently keeps a project-local prompt optimization override enabled in `.wunderkind/wunderkind.config.jsonc`; keep that framed as local repo state, not product-wide default behavior.
- The repo-local override currently omits `promptOptimizationLevel`, so it remains on the frozen legacy compatibility profile until an operator explicitly selects a concrete level.

## Dependency posture

- Key direct dependencies are current for this upgrade cycle:
  - published baseline: `oh-my-openagent@4.19.4`, `@opencode-ai/plugin@1.18.18`, `@opencode-ai/sdk@1.18.18`
  - OMO `v5.0.0-beta.6` remains explicitly out of scope for this stable baseline wave
- Remaining direct dependencies are not fully latest (`@clack/prompts`, `commander`, `typescript`, `@types/node`) and should be treated as a separate modernization pass if desired.
- Patched transitive overrides currently pin:
  - `fast-uri@3.1.2`
  - `ip-address@10.2.0`
  - `hono@4.12.18`
  - `uuid@13.0.2`

## Source map

### Local sources
- `package.json`
- `.claude-plugin/plugin.json`
- `src/build-agents.ts`
- `src/agents/render-markdown.ts`
- `src/agents/versioning.ts`
- `src/cli/config-manager/index.ts`
- `src/cli/doctor.ts`
- `src/cli/init.ts`
- `src/cli/docs-output-helper.ts`

### Upstream references
- https://opencode.ai/docs/plugins
- https://opencode.ai/docs/agents
- https://opencode.ai/docs/commands
- https://opencode.ai/changelog
- https://registry.npmjs.org/opencode-ai/latest
- https://registry.npmjs.org/@opencode-ai/plugin/latest
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/README.md
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md
