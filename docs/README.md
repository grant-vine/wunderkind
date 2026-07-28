# Documentation Index

Last refreshed: 2026-07-28T00-00-00Z
History mode: `overwrite`
Managed docs path: `docs/`

## Overview

This directory is the Wunderkind-managed documentation lane for this repository. It summarizes the current shipped product surface for **Wunderkind v0.25.0**, including the current local workflow posture, project-local bootstrap state, and upstream sources that validate integration claims.

## Managed documents

| File | Owner lane | Current purpose |
|---|---|---|
| `marketing-strategy.md` | marketing-wunderkind | Positioning, audiences, adoption narrative, and docs-led GTM framing |
| `design-decisions.md` | creative-director | Documentation IA, design workflow cues, and UX/clarity decisions |
| `product-decisions.md` | product-wunderkind | Product scope, workflow decisions, commands, skills, and roadmap surfaces |
| `engineering-decisions.md` | fullstack-wunderkind | Architecture, build/install/upgrade/doctor behavior, and native asset mechanics |
| `security-decisions.md` | ciso | Compliance context, supply-chain posture, docs-boundary rules, and dependency-risk notes |

## Latest documented feature highlights

- `wunderkind init` now maintains **`CONTEXT.md`** alongside `AGENTS.md` and `.omo/`.
- The public skill surface is bucketed into **19 promoted retained-specialist skills**, **4 Wunderkind-specific workflow skills**, and **1 deprecated docs-history route**.
- **`docs-with-grill`** is the repo-aware docs grilling skill adapted into Wunderkind’s filesystem-first workflow.
- `wunderkind doctor` now reports **native asset freshness** and **native agent markdown version drift**.
- Generated native agents now embed **`wunderkind_version`** in frontmatter.
- Install and upgrade guidance now use canonical **`oh-my-openagent`** naming only; legacy `oh-my-opencode` references remain detection-only warning/migration notes.
- The upstream alignment target is `oh-my-openagent` `4.19.2` with OpenCode plugin/SDK `1.18.7`; Goal terminology replaces active wording where Ralph Loop is historical only, while Ultrawork remains an active upstream workflow concept.
- `/wunderkind-team` and `wunderkind team-bootstrap` document the team-mode setup path, canonical `team_mode.enabled` detection, and fallback to solo `product-wunderkind` orchestration when team mode is disabled, the spec is missing, or team tools are unavailable.
- `wunderkind token-audit` documents the prompt-runtime v1 contract as `audit-only`: no live prompt packing, no model-token truth claims, and no OpenToken dependency.
- The supplementary engine is now documented as one default-off multi-level prompt optimization engine, separate from `wunderkind token-audit` and still without a public optimize command.
- `promptOptimizationLevel` remains capability-based and cumulative: `latest-user`, `runtime-and-tools`, `contextual`, and `transcript`.
- The security-safe baseline remains part of any enabled optimization posture: redacted reporting, preserve/fallback enforcement, and no protected-content persistence drift.
- The `latest-user` level preserves immutable content byte-exact, including code blocks, URLs, file paths, commands, explicit requirements, compliance/legal/security wording, and quoted user text or examples.
- The `latest-user` level still fail-closes with whole-message passthrough for low-confidence or safety-risk cases, with passthrough reason visibility limited to runtime reports and not summary metadata guidance.
- Unsupported features remain explicitly excluded from the final system: no persistent cross-session memory writes and no automatic context injection.
- `promptOptimizationReportingMode` now documents the opt-in separate runtime-report surface (`off`, `persist`, `summary`), where sanitized/redacted latest-report artifacts or summaries back `system-transform.latest.json` and `session-compacting.latest.json`, and `doctor --verbose` exposes existence/status rather than claiming runtime savings.
- This repo currently keeps a **project-local** prompt optimization override enabled: `active` mode, `summary` reporting, `120000` token budget, and `1200` byte budget. That is local repo state for this explicitly enabled repo context, not the published product default.
- `doctor --verbose` is the operator surface for current runtime-report posture and latest-artifact presence in this repo; that repo-local override must not be read as proof of a global always-on product posture.
- The hard-cut migration release keeps `.omo/` as the only active artifact root, leaves `.sisyphus/` as manual migration history only, and keeps `wunderkind migrate` as a fail-hard guidance surface.
- `/docs-index` is the managed docs refresh/bootstrap command and `init-deep` remains an upstream OMO workflow concept rather than a Wunderkind CLI subcommand.

## Current project-local bootstrap state

- Docs output is now enabled in `.wunderkind/wunderkind.config.jsonc`.
- `docsPath` is `./docs`.
- `docHistoryMode` remains `overwrite` for this repo.
- Project-local prompt optimization remains enabled for this repo and should be treated as a maintained local override on the legacy compatibility profile until an explicit `promptOptimizationLevel` is chosen.
- `CONTEXT.md` has been bootstrapped for this repository.
- `AGENTS.md` has been refreshed to reflect package version `0.25.0` and the frozen bucketed skill inventory.

## Primary local sources

- `README.md`
- `AGENTS.md`
- `CONTEXT.md`
- `commands/docs-index.md`
- `src/agents/docs-config.ts`
- `src/agents/docs-index-plan.ts`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- `src/cli/config-manager/index.ts`
- `src/cli/prompt-runtime-contract.ts`
- `src/cli/prompt-optimization-runtime-reporting.ts`
- `src/runtime-prompt-sections.ts`
- `src/agents/versioning.ts`
- `package.json`
- `.claude-plugin/plugin.json`

## Upstream references

- OpenCode docs: https://opencode.ai/docs/
- OpenCode plugins: https://opencode.ai/docs/plugins
- OpenCode agents: https://opencode.ai/docs/agents
- OpenCode commands: https://opencode.ai/docs/commands
- OpenCode changelog: https://opencode.ai/changelog
- OpenCode release v1.18.7: https://github.com/anomalyco/opencode/releases/tag/v1.18.7
- OpenCode package metadata: https://registry.npmjs.org/opencode-ai/latest
- oh-my-openagent README: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/README.md
- oh-my-openagent installation guide: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md
- oh-my-openagent Team Mode guide: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/team-mode.md
- oh-my-openagent package metadata: https://registry.npmjs.org/oh-my-openagent/latest
- `@opencode-ai/plugin` package metadata: https://registry.npmjs.org/@opencode-ai/plugin/latest
- Matt Pocock skills repo: https://github.com/mattpocock/skills

## Notes

- These docs reflect the current repository state after the hard-cut convergence update.
- `legal-counsel` is not a docs-eligible lane in the current ownership map, so there is no managed `legal-notes.md` file in this directory.
