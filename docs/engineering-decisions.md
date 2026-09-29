# Engineering Decisions

Last refreshed: 2026-09-29T00-00-00Z

## Current technical baseline

- **Language/runtime**: TypeScript + Bun + ESM
- **Published baseline plugin package**: `@opencode-ai/plugin@1.18.32`
- **Published baseline SDK package**: `@opencode-ai/sdk@1.18.32`
- **Published baseline OMO dependency**: `oh-my-openagent@5.0.0-beta.86`
- **Current Wunderkind package version**: `0.28.2`
- **Generated agent frontmatter version field**: `wunderkind_version`
- **Current source candidate**: OpenCode/plugin/SDK `1.18.33` + OMO `5.1.1`; this is not a released `0.28.3` claim

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

### The current compatibility candidate uses GPT-6 Sol/Luna cost tiers
The published source uses OpenCode/plugin/SDK `1.18.32` and OMO `5.0.0-beta.86`; the 2026-09-29 source candidate targets `1.18.33` and OMO `5.1.1`. The candidate managed-template mapping is `quick` → `openai/gpt-6-luna`, `unspecified-low` → `openai/gpt-6-luna`, `writing` → `openai/gpt-6-luna`, `unspecified-high` → `openai/gpt-6-sol`, and `visual-engineering` → `openai/gpt-6-sol`. The product front door uses `unspecified-high`; routine marketing uses `writing`; legal judgment uses `unspecified-high`; creative judgment uses `visual-engineering`. No managed category selects Astra. A user's deliberate override remains user-owned and must be preserved.

For Codex, the candidate routes root/orchestration, planning, complex implementation and reviews through GPT-6 Sol; routine/default, exploration and background work use GPT-6 Luna. The role map belongs in the literal `"[codex]"` JSONC object in OMO global or active-profile config. Root model and selected profile remain in Codex `config.toml`. The default LazyCodex role follows the synchronized medium-worker Luna assignment. The explicit doctor policy action seeds absent durable role keys and preserves existing overrides; reset is only a separately explicit reclaim of removed keys previously recorded as Wunderkind-managed. Ordinary doctor remains read-only. See [the host upgrade runbook](upgrading.md) for ownership and restart checks. This is a source candidate, not a released installation guarantee.

### The current skill-governance wave adds a narrow supportability route and rejects the overlapping incident skill
The current repo-head skill target is `promoted=23`, `wunderkind-specific=4`, `deprecated=1`, and `public/deprecated total=28` by adding `release-upgrade`, `platform-compatibility`, and `supportability-review`. `supportability-incident` is explicitly rejected because supportability and incident execution already route through `/supportability-review`, `/runbook`, and `/incident-response`.

### CONTEXT.md is part of project bootstrap
`wunderkind init` now ensures `CONTEXT.md`, making the bootstrap artifacts: `.wunderkind/`, `AGENTS.md`, `CONTEXT.md`, `.omo/`, and optional docs scaffolding.

### Prompt optimization reporting is a separate operational seam
The live prompt-optimization reporting path lives in `src/cli/prompt-runtime-contract.ts`, `src/cli/prompt-optimization-runtime-reporting.ts`, and `src/runtime-prompt-sections.ts`. It is deliberately separate from `src/cli/token-audit.ts`, keeps `token-audit` audit-only, and persists latest-only local artifacts under `.wunderkind/runtime/prompt-optimization/`. The operator contract is one default-off multi-level prompt optimization engine with capability-based settings, cumulative levels, and a mandatory security-safe baseline when enabled.

### Project memory has a version-locked capture and lifecycle seam
The `@opencode-ai/plugin` 1.18.32 declaration exposes `chat.message`, so automatic capture may use only that event while an explicitly started local worker is running. The fallback is synchronous `memory capture`; no untracked background promise is allowed. `memory.enabled`, capture, injection, fixed Ollama extraction, loopback URL validation, and bounded queue/provider limits are locked in `src/cli/memory-contract.ts` and the config schema. Task implementation must retain the redaction-before-persistence boundary, a single serialized writer, temporal/tombstone deletion rules, migration backup/read-only failure behavior, and normal-chat fail-closed behavior.

#### Memory storage and process clarification — 2026-09-29
Released 0.28.2 source resolves the canonical ledger to `.wunderkind/memory.sqlite` and the worker PID/lock/readiness/socket directly to `.wunderkind/`. This supersedes earlier documentation sketches of `.wunderkind/memory/` or a separate runtime directory; it does not relocate existing databases or change their schema. Bun is required for memory operations through `bun:sqlite`. The compatibility update revalidates the same `chat.message` hook against installed plugin 1.18.33 and updates the exact hook-contract metadata; capture and lifecycle semantics remain unchanged.

Normal startup remains process-free while optional, explicitly started processes are permitted when their lifecycle is bounded and recoverable. The existing local worker requires explicit start/stop and preserves independent capture/injection opt-in. No Native memory, managed cloud provider, automatic reflection, or launch service is adopted by this clarification. Cleanup must stop the worker before deleting project state; uninstall preserves the ledger. A consistent SQLite backup must account for WAL state and tombstones; cleanup is not a rollback shortcut. Historical plans and their evidence remain historical records.

## Current operational notes

- Docs output is enabled for this repo at `./docs` with history mode `overwrite`.
- The repo’s current managed docs lanes come from `src/agents/docs-config.ts`.
- `/docs-index` is a shipped command asset in `commands/docs-index.md`.
- `init-deep` is documented as an upstream OMO workflow concept, not a Wunderkind CLI command.
- This repo currently keeps a project-local prompt optimization override enabled in `.wunderkind/wunderkind.config.jsonc`; keep that framed as local repo state, not product-wide default behavior.
- The repo-local override currently omits `promptOptimizationLevel`, so it remains on the frozen legacy compatibility profile until an operator explicitly selects a concrete level.

## Dependency posture

- Key direct dependencies in the source candidate are `oh-my-openagent@5.1.1`, `@opencode-ai/plugin@1.18.33`, and `@opencode-ai/sdk@1.18.33`; the published `0.28.2` baseline remains beta.86 / 1.18.32 until a reviewed release is published.
- Keep Wunderkind's Node floor at `22.12` unless supported-floor evidence proves the imported host dependencies fail there. OMO Native's Node `24+` requirement applies only to its separately gated optional experiment.
- Source candidate resolves the compatible Node type patch at `@types/node@26.6.3`; this is a candidate update, not a published release claim.
- Patched transitive overrides currently pin:
  - `fast-uri@4.1.5`
  - `ip-address@10.7.1`
  - `hono@4.13.8`
  - `uuid@14.0.2`

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
