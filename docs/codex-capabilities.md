# Codex edition capabilities

The Codex edition ships in `@grant-vine/wunderkind` `0.27.0` and later. It complements Codex and LazyCodex; it does not replace the existing OpenCode edition.

## Prerequisites and lifecycle

LazyCodex (`omo@sisyphuslabs` version `>=4.19.4 <5`) is the sole hard dependency. Codex must be on `PATH`. Wunderkind never installs, enables, updates, or removes LazyCodex or any companion.

Use `npx @grant-vine/wunderkind codex <verb>` (for example, `npx @grant-vine/wunderkind codex install`). Maintainer packed QA can still use the extracted-package equivalent `node package/bin/wunderkind.js codex <verb>`.

| Command | Behavior |
| --- | --- |
| `wunderkind codex install` | Validates Codex and LazyCodex, adds only the Wunderkind marketplace/plugin through the Codex CLI, and installs six hash-recorded custom agents. |
| `wunderkind codex upgrade` | Refreshes only hash-owned Wunderkind agents and payloads; modified or unowned files are preserved and reported. |
| `wunderkind codex doctor` | Is read-only; reports core readiness, six agents, eleven skills, project readiness, and advisory companions. Use `--json` for the versioned report or `--verbose` for additional sanitized detail. |
| `wunderkind codex uninstall` | Removes only hash-matching Wunderkind agents, payload/state, plugin, and marketplace registration when it is exclusively owned. It never removes LazyCodex or companions. |
| `wunderkind codex init` | Requires a healthy global Codex installation, reuses the host-neutral project artifacts, and creates only `.wunderkind/codex-project.json` plus Codex runtime guidance. |
| `wunderkind codex cleanup` | Removes only hash-owned Codex project marker/runtime files. It preserves shared Wunderkind config, `AGENTS.md`, `CONTEXT.md`, `.omo/`, docs output, OpenCode state, and companion assets. |

Start a new Codex task after `install` or `upgrade`: Codex loads custom agents and plugin skills at task start.

## Lean response mode

Wunderkind Codex agents default to concise answers: lead with the decision, summarize evidence compactly, and expand only when the user asks or risk requires it. This is an instruction-level convention, not automatic prompt rewriting, transcript rewriting, or tool-output compaction.

## Retained surface

The package provides exactly six global custom agents and exactly eleven plugin skills.

| Six custom agents | Role boundary |
| --- | --- |
| `wunderkind-marketing` | Marketing, community, developer-relations, and go-to-market judgment. |
| `wunderkind-creative-director` | Brand and design-direction judgment; routes generic UI implementation to Codex/OMO tooling. |
| `wunderkind-product` | The front door for retained-specialist routing and product judgment. |
| `wunderkind-architecture` | Architecture and supportability judgment; routes generic implementation and debugging to Codex/OMO. |
| `wunderkind-ciso` | Security architecture and compliance judgment; does not duplicate scanners. |
| `wunderkind-legal` | Legal, licensing, and regulatory judgment. |

| Eleven shipped skills | Owner |
| --- | --- |
| `wunderkind` | `wunderkind-product` |
| `setup-wunderkind-workflow` | `wunderkind-product` |
| `docs-index` | `wunderkind-product` |
| `prd-pipeline` | `wunderkind-product` |
| `release-upgrade` | `wunderkind-product` |
| `experimentation-analyst` | `wunderkind-product` |
| `supportability-review` | `wunderkind-architecture` |
| `social-media-maven` | `wunderkind-marketing` |
| `technical-writer` | `wunderkind-marketing` |
| `compliance-officer` | `wunderkind-ciso` |
| `oss-licensing-advisor` | `wunderkind-legal` |

## Delegated and excluded routes

| Existing route | Codex edition disposition |
| --- | --- |
| `agile-pm` | OMO `$ulw-plan` and `$start-work`; optional Matt `to-tickets`. |
| `code-health` | OMO `$review-work` and Codex review agents. |
| `diagnose` | OMO `$debugging`. |
| `grill-me`, `docs-with-grill` | Optional Matt `grill-me` and `grill-with-docs`. |
| `improve-codebase-architecture` | Optional Matt route plus OMO `$refactor`; Wunderkind architecture supplies judgment only. |
| `tdd` | OMO `$programming`; optional Matt `tdd`. |
| `triage-issue` | Optional Matt `triage` and optional GitHub plugin. |
| `ubiquitous-language` | Optional Matt `domain-modeling` or `grill-with-docs`. |
| `write-a-skill` | Codex system `skill-creator`. |
| `caveman` | Normal response preference or optional Matt `caveman`. |
| `visual-artist` | OMO `$frontend`/`$visual-qa`, native image generation, optional Figma or Canva. |
| `security-analyst`, `pen-tester` | Wunderkind CISO judgment plus optional Codex Security; no duplicate scanner. |
| `db-architect`, `supabase-architect` | Codex engineering plus optional official Supabase skills. |
| `vercel-architect` | Optional official Vercel skills or plugin. |
| `platform-compatibility` | Repository-maintainer/OpenCode source only. |
| deprecated `design-an-interface` | Excluded entirely. |

Only static `docs-index` is adapted as a skill. `workflow-sync` remains CLI behavior; `dream` and `design-md` route to specialist agents; `wunderkind-team` delegates to OMO `$teammode`; and all 39 generated OpenCode command aliases are excluded rather than promoted. `token-audit` and all Codex prompt/token optimization are explicitly deferred to a future Codex-native design revisit.

## Optional companions

These are advisory integrations, not requirements. Every command below is optional, user-run, and non-owned: Wunderkind does not execute, authenticate, update, remove, or vendor any of them.

| Optional companion | User-run, non-owned command | Intended coverage |
| --- | --- | --- |
| Matt Pocock skills | **Optional, user-run, non-owned:** `npx skills@latest add mattpocock/skills` | Selectively add `grill-me`, `grill-with-docs`, `improve-codebase-architecture`, `tdd`, `triage`, `to-spec`, `to-tickets`, or `domain-modeling` as needed. |
| Supabase skill pack | **Optional, user-run, non-owned:** `npx skills@latest add supabase/agent-skills` | `supabase` and `supabase-postgres-best-practices`. |
| Vercel skill pack | **Optional, user-run, non-owned:** `npx skills@latest add vercel-labs/agent-skills` | Vercel deployment and platform workflows. |
| OpenAI-curated plugin | **Optional, user-run, non-owned:** `codex plugin add <plugin>@openai-curated` | Replace `<plugin>` with an available companion such as `github`, `figma`, `vercel`, `sentry`, `codex-security`, `posthog`, or `mixpanel`. |

`wunderkind codex doctor` may report whether these companions are installed, enabled, available, or absent. Its report is advisory and never changes their state.

## Ownership and safety

Wunderkind stores its Codex payload and installation state under `~/.wunderkind/codex/` (respecting configured test/home overrides) and uses only the official Codex CLI for marketplace/plugin changes. It does not parse or edit Codex configuration directly. Agent files are recorded with their post-write SHA-256 hash. An upgrade or uninstall leaves an agent intact when its live hash no longer matches the recorded hash, returns a recovery-oriented non-zero result, and preserves state rather than risking user work.
