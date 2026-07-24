# Product Decisions

Last refreshed: 2026-07-15T11-11-35Z

## Product snapshot

- **Package**: `@grant-vine/wunderkind`
- **Current version**: `0.23.0`
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
The frozen convergence inventory exposes 19 promoted retained-specialist skills and 4 Wunderkind-specific workflow skills. `design-an-interface` remains only as deprecated replacement guidance and detection-only history.

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

### 10. Freeze the upstream-alignment targets for this wave
The current alignment target is `oh-my-openagent` `4.19.0` with `@opencode-ai/plugin` and `@opencode-ai/sdk` `1.18.4`. Docs/help/doctor surfaces should cite those targets when explaining this wave's compatibility contract.

### 11. Keep team-mode explicit and fallback-safe
Wunderkind team mode is a thin upstream-compatible layer: `wunderkind team-bootstrap` writes canonical `.omo/teams/<name>/config.json` specs, `/wunderkind-team` checks canonical `oh-my-openagent` config paths plus `team_mode.enabled`, and disabled or missing-spec states fall back to solo `product-wunderkind` orchestration.

### 12. Keep prompt-runtime v1 audit-only
Prompt-runtime work is `audit-only` in v1: no live prompt packing, no model-token truth claims, no OpenToken adoption, and no daemon or sidecar runtime. `token-audit` reports deterministic bytes, lines, files, and canonical fixture layers rather than model-specific token counts.

## Current feature set to highlight

- Six retained specialist agents.
- 19 promoted retained-specialist skills.
- 4 Wunderkind-specific workflow skills.
- 1 deprecated docs-history route with explicit replacement guidance: `design-an-interface` → `improve-codebase-architecture` for structural interface work, direct `fullstack-wunderkind` judgement for narrow engineering decisions, or product/frontend exploration when workflow or prototype evidence shapes the contract.
- `/docs-index` native command.
- `/dream` native command.
- `CONTEXT.md` bootstrap.
- `docs-with-grill` skill.
- Native asset freshness/version reporting.
- `/wunderkind-team` native command and `wunderkind team-bootstrap` CLI bootstrap.
- `wunderkind token-audit` prompt-runtime reporting with audit-only layered fixture metadata.
- Embedded `wunderkind_version` in generated native agent markdown.
- Filesystem/GitHub PRD pipeline support.
- Caveman mode and design tool integration.

## Immediate documentation priorities

- Keep public install/upgrade/doctor docs aligned with current OMO/OpenCode naming.
- Keep project-local bootstrap artifacts (`AGENTS.md`, `CONTEXT.md`, docs lane, `.omo`) fresh enough that an init-deep style workflow can start from repo truth.
- Keep Goal, Ultrawork, Senpi, and Ollama `stream: false` guidance aligned with the upstream evidence in `.omo/evidence/upstream-team-runtime/`.
- Keep team-mode fallback and audit-only token-audit wording aligned with `.omo/evidence/upstream-team-runtime/`: no live prompt packing, no model-token truth claims, and fallback rather than unsupported retained-agent team members.

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
