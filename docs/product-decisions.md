# Product Decisions

Last refreshed: 2026-08-18T00-00-00Z

## Product snapshot

- **Package**: `@grant-vine/wunderkind`
- **Current version**: `0.27.2`
- **Host ecosystem**: OpenCode + oh-my-openagent
- **Operating posture**: orchestrator-first, retained-specialist model, filesystem-first workflow support

## Current product decisions

### 1. Keep Wunderkind as a synchronous overlay
Wunderkind should extend OpenCode/OMO instead of becoming its own runtime system. That means no daemon, queue, scheduler, or MCP lifecycle ownership.

### 2. Prefer canonical OMO naming
Docs and current flows should use `oh-my-openagent` as the canonical name. Any legacy `oh-my-opencode` mention is warning-only migration guidance and must not imply active support or fallback execution.

### 3. Make project context explicit
`CONTEXT.md` is now a first-class artifact created by `wunderkind init` and consumed by docs + planning flows.

### 4. Keep the public skill surface bucketed
The current repo-head convergence inventory exposes 23 promoted retained-specialist skills and 4 Wunderkind-specific workflow skills (`promoted=23`, `wunderkind-specific=4`, `deprecated=1`, `public/deprecated total=28`). `release-upgrade` is the promoted release-management route under `product-wunderkind`, `platform-compatibility` is the promoted host/platform drift route under `fullstack-wunderkind`, `supportability-review` is the promoted operability/readiness route under `fullstack-wunderkind`, `supabase-architect` remains the promoted Supabase route, and `design-an-interface` remains only as deprecated replacement guidance and detection-only history.

### 5. Adapt Matt Pocock-style docs grilling into Wunderkind-native lanes
`docs-with-grill` is the retained-product adaptation of `grill-with-docs`, using `CONTEXT.md`, `AGENTS.md`, and `.omo/` instead of Matt’s repo layout.

### 6. Treat docs refresh as a managed workflow
`/docs-index` owns docs refresh/bootstrap. Canonical docs filenames come from `AGENT_DOCS_CONFIG`, and history behavior comes from the configured docs mode.

### 7. Make upgrade drift visible
`wunderkind doctor` and `wunderkind upgrade` now expose stale native assets and native agent markdown version drift rather than silently trusting what is installed.

### 8. Align upstream workflow terminology precisely
Active upstream continuation/goal behavior should use Goal terminology. Ralph Loop is historical migration context only, while Ultrawork remains an active upstream `ulw` / complex-task workflow concept and must stay distinct from Goal.

### 9. Keep Senpi and OpenCode/OMO team semantics distinct
Senpi task/orchestration docs are valid upstream context, but Wunderkind’s OpenCode-facing team-mode work should follow the OpenCode/OMO team model. Operator-facing local-model guidance that mentions Ollama tool-using agents must include the upstream `stream: false` workaround instead of promising streaming tool-call support.

### 10. Keep the stable upstream-alignment targets explicit
The current stable baseline is `oh-my-openagent` `4.19.4` with `@opencode-ai/plugin` and `@opencode-ai/sdk` `1.18.18`. Docs/help/doctor surfaces should cite those targets when explaining the current compatibility contract.

### 11. Keep `wunderkind migrate` scoped to legacy OMO config
`wunderkind migrate` now owns no-clobber legacy OMO config migration into `~/.omo/omo.jsonc`. It must not be described as a `.sisyphus/` project-artifact migration surface, and it must not restore active legacy fallback execution.

### 12. Keep team-mode explicit and fallback-safe
Wunderkind team mode is a thin upstream-compatible layer: `wunderkind team-bootstrap` writes canonical `.omo/teams/<name>/config.json` specs, `/wunderkind-team` checks canonical `oh-my-openagent` config paths plus `team_mode.enabled`, and disabled or missing-spec states fall back to solo `product-wunderkind` orchestration.

### 13. Keep `token-audit` audit-only while allowing one separate supplementary multi-level engine
`token-audit` stays `audit-only`: no live prompt packing, no model-token truth claims, no OpenToken adoption, and no daemon or sidecar runtime. Separately, the supplementary prompt optimization engine may be enabled per project through config; it remains distinct from `token-audit`, does not introduce a public optimize command, and stays product-default-off. Its public setting model is capability-based: existing keys stay frozen, `promptOptimizationLevel` selects `latest-user`, `runtime-and-tools`, `contextual`, or `transcript`, and version-labelled config keys are out of contract. The levels are cumulative, the security-safe baseline applies whenever optimization is enabled, and unsupported features stay out of contract: no persistent cross-session memory writes and no automatic context injection. The `latest-user` seam remains latest-user-message-only, preserves immutable content byte-exact, and fail-closes with whole-message passthrough. Passthrough reason codes belong to runtime reports only, not summary metadata guidance.

### 14. Treat this repo's active prompt optimization posture as local repo state, not product default
This repository currently keeps a project-local prompt optimization override enabled (`active`, `summary`, `120000` token budget, `1200` byte budget). That posture should be documented as local operating state for this explicitly enabled repo context, not as a claim that Wunderkind defaults to active optimization for all users. The final contract also freezes that omitting `promptOptimizationLevel` in legacy enabled repos preserves the current shipped behavior until an operator explicitly chooses one of the supported capability-based levels.

### 15. Freeze the current patch wave to OpenCode 1.18.18 and OMO 4.19.4
The current upstream-alignment patch wave is frozen against the latest stable host surfaces only: OpenCode `1.18.18` and `oh-my-openagent` `4.19.4`. OMO `v5.0.0-beta.6` is explicitly out of scope for this wave and must be handled, if at all, in a separate compatibility wave.

### 16. Add the narrow supportability route without adding an overlapping incident skill
The current repo-head skill-governance wave adds `release-upgrade` under `product-wunderkind`, plus `platform-compatibility` and `supportability-review` under `fullstack-wunderkind`. It explicitly rejects `supportability-incident` as a standalone skill because that operator work already has sufficient coverage through `/supportability-review`, `/runbook`, and `/incident-response`.

### 17. Keep provider/model routing unchanged in the current wave
The current patch wave is not a provider/model-routing wave. `oh-my-openagent.jsonc` category models and canonical manifest routing remain unchanged while this upgrade and skill-governance contract is implemented.

## Current feature set to highlight

- Six retained specialist agents.
- 23 promoted retained-specialist skills.
- 4 Wunderkind-specific workflow skills.
- 1 deprecated docs-history route with explicit replacement guidance: `design-an-interface` → `improve-codebase-architecture` for structural interface work, direct `fullstack-wunderkind` judgement for narrow engineering decisions, or product/frontend exploration when workflow or prototype evidence shapes the contract.
- `release-upgrade` for release-note synthesis, version bump planning, compatibility checks, upgrade sequencing, and rollback-conscious release prep.
- `platform-compatibility` for host/plugin/config-chain drift, OpenCode/OMO contract changes, compatibility audits, and migration-boundary decisions.
- `supportability-review` for observability review, rollback readiness, on-call ownership, and launch blockers.
- `supabase-architect` for Supabase-specific auth, RLS, Realtime, Storage, Edge Functions, branching, local dev, observability, and app-data composition.
- `/docs-index` native command.
- `/dream` native command.
- `CONTEXT.md` bootstrap.
- `docs-with-grill` skill.
- Native asset freshness/version reporting.
- `/wunderkind-team` native command and `wunderkind team-bootstrap` CLI bootstrap.
- `wunderkind token-audit` prompt-runtime reporting with audit-only layered fixture metadata.
- Separate prompt-optimization runtime-report artifacts discoverable through `doctor --verbose`, including latest-user-level passthrough reason visibility when enabled.
- Embedded `wunderkind_version` in generated native agent markdown.
- Filesystem/GitHub PRD pipeline support.
- Caveman mode and design tool integration.

## Immediate documentation priorities

- Keep public install/upgrade/doctor docs aligned with current OMO/OpenCode naming.
- Keep project-local bootstrap artifacts (`AGENTS.md`, `CONTEXT.md`, docs lane, `.omo`) fresh enough that an init-deep style workflow can start from repo truth.
- Keep Goal, Ultrawork, Senpi, and Ollama `stream: false` guidance aligned with the upstream evidence in `.omo/evidence/upstream-team-runtime/`.
- Keep team-mode fallback and audit-only token-audit wording aligned with `.omo/evidence/upstream-team-runtime/`: no live prompt packing, no model-token truth claims, no persistent cross-session memory writes, no automatic context injection, and fallback rather than unsupported retained-agent team members.

## Source map

### Local sources
- `README.md`
- `AGENTS.md`
- `CONTEXT.md`
- `commands/docs-index.md`
- `skills/docs-with-grill/SKILL.md`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- `src/cli/team-bootstrap.ts`
- `src/cli/team-mode-entry.ts`
- `src/cli/token-audit.ts`
- `src/cli/prompt-surface-audit.ts`
- `src/agents/manifest.ts`
- `package.json`

### Upstream references
- https://opencode.ai/docs/
- https://opencode.ai/changelog
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/README.md
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/team-mode.md
- https://github.com/mattpocock/skills
