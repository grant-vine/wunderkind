# Project Context

Updated: 2026-07-28T00-00-00Z

This repository is the source for **Wunderkind** `0.25.3`, an OpenCode/oh-my-openagent plugin that injects six retained specialist agents (marketing, design, product, engineering, security, legal) into a project while keeping Wunderkind itself as a synchronous overlay with no long-running runtime process. The current upstream baseline is `@opencode-ai/plugin`/`@opencode-ai/sdk` `1.18.10` and `oh-my-openagent` `4.19.3`.

## Product and domain summary
- **What it is**: A retained-agent overlay for OpenCode built around orchestrator-first routing, generated native markdown agents, static skills, and project-local bootstrap artifacts.
- **Primary users**: Developers and product teams already using OpenCode and often oh-my-openagent who want opinionated, domain-specialized retained agents instead of generic coding helpers.
- **Current success criteria**: Keep install/upgrade/doctor trustworthy, preserve compatibility with current OpenCode and oh-my-openagent surfaces, and make project-local workflow/context artifacts (`AGENTS.md`, `CONTEXT.md`, `.omo/`, docs-output, and runtime prompt reports) easy to bootstrap and maintain.

## Core workflows
- Install Wunderkind into OpenCode globally or per-project.
- Initialize a project with `wunderkind init`, which now creates or maintains `CONTEXT.md` alongside `AGENTS.md` and `.omo/`.
- Refresh native assets with `wunderkind upgrade` and verify health with `wunderkind doctor`.
- Use `/docs-index` to refresh managed docs lanes, and use `docs-with-grill` to harden context before major documentation or planning work.
- Use `wunderkind workflow-sync` only when `prdPipelineMode` is `github`; local `.omo` workflow state stays authoritative.
- Use `/wunderkind-team` and `wunderkind team-bootstrap` for explicit team-mode setup with fallback to solo `product-wunderkind` orchestration.
- Use `wunderkind migrate` only for no-clobber legacy OMO config migration into `~/.omo/omo.jsonc`; `.sisyphus/` project artifacts remain manual migration history.
- Use `.omo/` for plans, contracts, notepads, evidence, teams, and continuation state in filesystem-first workflows.

## Shared language
- **Wunderkind**: the plugin/package in this repository.
- **OMO**: `oh-my-openagent`, the upstream harness/integration layer that Wunderkind extends.
- **OpenCode**: the host application/plugin platform.
- **Managed docs lane**: a canonical file in `docs/` owned by a specific docs-eligible retained agent.
- **Native assets**: generated or shipped agent, command, and skill files installed into OpenCode-recognized directories.
- **Docs-with-grill**: the Wunderkind-native repo-aware docs grilling skill adapted from Matt Pocock's `grill-with-docs` idea.
- **Prompt optimization runtime report**: the separate, supplementary reporting surface for live prompt optimization behavior; distinct from the audit-only `token-audit` command.
- **Multi-level prompt optimization engine**: the default-off, capability-based optimization system selected by `promptOptimizationLevel` (`latest-user`, `runtime-and-tools`, `contextual`, `transcript`).
- **Latest-user level**: the lowest supported optimization level; it may touch only the latest user-authored message, preserves immutable content byte-exact, and fail-closes with whole-message passthrough.
- **supabase-architect**: the promoted `fullstack-wunderkind` route for Supabase-specific auth, RLS, Realtime, Storage, Edge Functions, branching, local dev, observability, and broader app-data composition when Supabase materially changes the design.

## Important constraints
- Wunderkind must remain a **zero-daemon synchronous overlay**; no scheduler, no queue, no MCP lifecycle ownership.
- Compatibility should use canonical `oh-my-openagent` naming only; any legacy `oh-my-opencode` mention is migration guidance for `wunderkind migrate` into `~/.omo/omo.jsonc` and must not imply active fallback execution.
- Generated `agents/*.md` are build artifacts; `skills/` are source.
- Docs output must stay project-local and respect the configured docs path/history mode.
- The public product contract keeps prompt optimization **supplementary and default-off**; this repo's active/summary optimization settings are a local project override, not a product default.
- `token-audit` remains audit-only with no live prompt packing, no model-token truth claims, no OpenToken dependency, and no public optimize command.
- The security-safe baseline applies whenever optimization is enabled: redacted reporting, preserve/fallback enforcement, and no protected-content persistence drift.
- The latest-user level excludes retained history, earlier user messages, SOUL overlays, and transcript-wide compaction content. Its passthrough reasons are runtime-report-only and not summary metadata guidance.
- Persistent cross-session memory writes and automatic context injection remain unsupported.
- Current resolved runtime context for this repo: region `Project Region`, industry `SaaS`, primary regulation `POPIA`, team culture `pragmatic-balanced`, org structure `flat`.

## Current repo-local operational posture
- Docs output is enabled at `./docs` with `docHistoryMode: overwrite`.
- The project-local prompt optimization override is enabled with `promptOptimizationMode: active`, `promptOptimizationReportingMode: summary`, `promptOptimizationTokenBudget: 120000`, and `promptOptimizationByteBudget: 1200`.
- `promptOptimizationLevel` is intentionally omitted in this repo-local override, so the current local posture resolves through the frozen legacy compatibility profile until an operator explicitly selects a concrete level.
- Current latest-only runtime-report artifacts live at `.wunderkind/runtime/prompt-optimization/system-transform.latest.json` and `.wunderkind/runtime/prompt-optimization/session-compacting.latest.json`.
- Current skill inventory truth is `promoted=20`, `wunderkind-specific=4`, `deprecated=1`, and `public/deprecated total=25`; `supabase-architect` is the new promoted Supabase platform route.

## Open questions
- Whether docs output should stay on `overwrite` for this repo long-term or move to `append-dated` for richer history.
- Whether remaining non-latest direct dependencies (`@clack/prompts`, `commander`, `typescript`, `@types/node`) should be modernized in a separate compatibility pass.
- Whether future docs should add a dedicated changelog/release-notes lane beyond README + AGENTS + managed docs outputs.
- Whether the repo should eventually add a recommendation layer on top of `token-audit` / runtime-report evidence for choosing project-local prompt-optimization budgets.
