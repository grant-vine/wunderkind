# Project Context

Updated: 2026-05-15T15-07-42Z

This repository is the source for **Wunderkind**, an OpenCode/oh-my-openagent plugin that injects six retained specialist agents (marketing, design, product, engineering, security, legal) into a project while keeping Wunderkind itself as a synchronous overlay with no long-running runtime process.

## Product and domain summary
- **What it is**: A specialist-agent addon for OpenCode built around orchestrator-first routing, generated native markdown agents, static skills, and project-local bootstrap artifacts.
- **Primary users**: Developers and product teams already using OpenCode and often oh-my-openagent who want opinionated, domain-specialized retained agents instead of generic coding helpers.
- **Current success criteria**: Keep install/upgrade/doctor trustworthy, preserve compatibility with current OpenCode and oh-my-openagent surfaces, and make project-local workflow/context artifacts (`AGENTS.md`, `CONTEXT.md`, `.sisyphus/`, docs-output) easy to bootstrap and maintain.

## Core workflows
- Install Wunderkind into OpenCode globally or per-project.
- Initialize a project with `wunderkind init`, which now creates or maintains `CONTEXT.md` alongside `AGENTS.md` and `.sisyphus/`.
- Refresh native assets with `wunderkind upgrade` and verify health with `wunderkind doctor`.
- Use `/docs-index` to refresh managed docs lanes and `docs-with-grill` to harden context before major documentation or planning work.
- Use `.sisyphus/` for plans, notepads, and evidence in filesystem-first workflows.

## Shared language
- **Wunderkind**: the plugin/package in this repository.
- **OMO**: `oh-my-openagent`, the upstream harness/integration layer that Wunderkind extends.
- **OpenCode**: the host application/plugin platform.
- **Managed docs lane**: a canonical file in `docs/` owned by a specific docs-eligible retained agent.
- **Native assets**: generated or shipped agent, command, and skill files installed into OpenCode-recognized directories.
- **Docs-with-grill**: the Wunderkind-native repo-aware docs grilling skill adapted from Matt Pocock's `grill-with-docs` idea.

## Important constraints
- Wunderkind must remain a **zero-daemon synchronous overlay**; no scheduler, no queue, no MCP lifecycle ownership.
- Compatibility should prefer canonical `oh-my-openagent` naming while preserving explicit transitional support for legacy `oh-my-opencode` names where promised.
- Generated `agents/*.md` are build artifacts; `skills/` are source.
- Docs output must stay project-local and respect the configured docs path/history mode.
- Current resolved runtime context for this repo: region `Project Region`, industry `SaaS`, primary regulation `POPIA`, team culture `pragmatic-balanced`, org structure `flat`.

## Open questions
- Whether docs output should stay on `overwrite` for this repo long-term or move to `append-dated` for richer history.
- Whether remaining non-latest direct dependencies (`@clack/prompts`, `commander`, `typescript`, `@types/node`) should be modernized in a separate compatibility pass.
- Whether future docs should add a dedicated changelog/release-notes lane beyond README + AGENTS + managed docs outputs.
