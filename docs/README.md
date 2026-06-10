# Documentation Index

Last refreshed: 2026-05-15T15-07-42Z
History mode: `overwrite`
Managed docs path: `docs/`

## Overview

This directory is the Wunderkind-managed documentation lane for this repository. It summarizes the current shipped product surface for **Wunderkind v0.17.0**, including the latest local features, project-local bootstrap state, and upstream sources that validate integration claims.

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
- **`docs-with-grill`** is the repo-aware docs grilling skill adapted into Wunderkind’s filesystem-first workflow.
- `wunderkind doctor` now reports **native asset freshness** and **native agent markdown version drift**.
- Generated native agents now embed **`wunderkind_version`** in frontmatter.
- Install and upgrade guidance now prefer **`oh-my-openagent`** naming while preserving transitional compatibility notes for `oh-my-opencode`.
- `/docs-index` is the managed docs refresh/bootstrap command and `init-deep` remains an upstream OMO workflow concept rather than a Wunderkind CLI subcommand.

## Current project-local bootstrap state

- Docs output is now enabled in `.wunderkind/wunderkind.config.jsonc`.
- `docsPath` is `./docs`.
- `docHistoryMode` remains `overwrite` for this repo.
- `CONTEXT.md` has been bootstrapped for this repository.
- `AGENTS.md` has been refreshed to reflect package version `0.17.0` and the current skill inventory.

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
- `src/agents/versioning.ts`
- `package.json`
- `.claude-plugin/plugin.json`

## Upstream references

- OpenCode docs: https://opencode.ai/docs/
- OpenCode plugins: https://opencode.ai/docs/plugins
- OpenCode agents: https://opencode.ai/docs/agents
- OpenCode commands: https://opencode.ai/docs/commands
- OpenCode changelog: https://opencode.ai/changelog
- OpenCode release v1.15.0: https://github.com/anomalyco/opencode/releases/tag/v1.15.0
- OpenCode package metadata: https://registry.npmjs.org/opencode-ai/latest
- oh-my-openagent README: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/README.md
- oh-my-openagent installation guide: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md
- oh-my-openagent Team Mode guide: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/team-mode.md
- oh-my-openagent package metadata: https://registry.npmjs.org/oh-my-openagent/latest
- `@opencode-ai/plugin` package metadata: https://registry.npmjs.org/@opencode-ai/plugin/latest
- Matt Pocock skills repo: https://github.com/mattpocock/skills

## Notes

- These docs reflect the current repository state after the `v0.17.0` release push.
- `legal-counsel` is not a docs-eligible lane in the current ownership map, so there is no managed `legal-notes.md` file in this directory.
