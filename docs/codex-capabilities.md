# Codex edition capabilities

The Codex edition ships in `@grant-vine/wunderkind` `0.27.0` and later. It complements Codex and LazyCodex; it does not replace the existing OpenCode edition. The reviewed current package candidate is `0.28.3` with OpenCode plugin/SDK `1.18.35` and OMO/LazyCodex `5.1.29`; this does not claim publication or a host upgrade.

## Prerequisites and lifecycle

LazyCodex (`omo@sisyphuslabs` version `>=5.0.0-beta.62 <6`) is the sole hard dependency; the reviewed current target is OMO/LazyCodex `5.1.29`, while `5.0.0-beta.*` is rollback history only. Codex must be on `PATH`. See [the upgrade runbook](upgrading.md) for separate desktop, standalone CLI, marketplace, and payload-cache resolution. Wunderkind does not update the desktop application.

The public Wunderkind CLI floor remains Node `>=22.12.0` or Bun `1+`; this does not imply that a separate native `omo-ai` binary is supported on Node 22.

Managed model defaults remain Sol for orchestration and high-capability work and Luna for routine/background work (`gpt-6-sol` and `gpt-6-luna`). Astra is explicit operator opt-in only and is never selected by routine lifecycle commands.

Use `npx @grant-vine/wunderkind codex <verb>` (for example, `npx @grant-vine/wunderkind codex install`). Maintainer packed QA can still use the extracted-package equivalent `node package/bin/wunderkind.js codex <verb>`.

| Command | Behavior |
| --- | --- |
| `wunderkind codex install` | Validates Codex and LazyCodex, adds only the Wunderkind marketplace/plugin through the Codex CLI, and installs six hash-recorded custom agents. |
| `wunderkind codex upgrade` | Refreshes only hash-owned Wunderkind agents and payloads; modified or unowned files are preserved and reported. |
| `wunderkind codex doctor` | Is read-only by default; reports core readiness, six agents, eleven skills, project readiness, advisory companions, receipt-backed ownership, and model-policy drift. Use `--json` for the versioned report or `--verbose` for additional sanitized detail. `--apply-model-policy` is the explicit repair path for reviewed managed role values and preserves existing user overrides. |
| `wunderkind codex repair` | Installs known missing supporting skills for detected Matt Pocock companion workflows into the active Codex skills directory. Uses a pinned upstream source and preserves existing files. `--dry-run` previews without network or writes; `--json` reports the result. |
| `wunderkind codex uninstall` | Removes only hash-matching Wunderkind agents, payload/state, plugin, and marketplace registration when it is exclusively owned. It never removes LazyCodex or companions. |
| `wunderkind codex init` | Requires a healthy global Codex installation, reuses the host-neutral project artifacts, and creates only `.wunderkind/codex-project.json` plus Codex runtime guidance. |
| `wunderkind codex cleanup` | Removes only hash-owned Codex project marker/runtime files. It preserves shared Wunderkind config, `AGENTS.md`, `CONTEXT.md`, `.omo/`, docs output, OpenCode state, and companion assets. |

Start a new Codex task after `install`, `upgrade`, or `repair`: Codex loads custom agents and skills at task start.

## Lean response mode

Wunderkind Codex agents default to concise answers: lead with the decision, use encoded local constraints first, and expand only when the user asks, risk requires it, or the relevant facts are current-version-sensitive or potentially stale. This is an instruction-level convention, not automatic prompt rewriting, transcript rewriting, or tool-output compaction.

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

These are advisory integrations, not requirements. The companion commands below remain optional and user-run. Ordinary Wunderkind lifecycle commands do not install, authenticate, update, remove, or vendor these companions. The explicit `wunderkind codex repair` command is a narrow installation path for known missing Matt supporting skills; it does not take ownership of existing companion files.

| Optional companion | User-run, non-owned command | Intended coverage |
| --- | --- | --- |
| Matt Pocock skills | **Optional, user-run, non-owned:** `npx skills@latest add mattpocock/skills` | Selectively add `grill-me`, `grill-with-docs`, `improve-codebase-architecture`, `tdd`, `triage`, `to-spec`, `to-tickets`, or `domain-modeling` as needed, including their supporting skills: `codebase-design` and `grilling`. |
| Supabase skill pack | **Optional, user-run, non-owned:** `npx skills@latest add supabase/agent-skills` | `supabase` and `supabase-postgres-best-practices`. |
| Vercel skill pack | **Optional, user-run, non-owned:** `npx skills@latest add vercel-labs/agent-skills` | Vercel deployment and platform workflows. |
| OpenAI-curated plugin | **Optional, user-run, non-owned:** `codex plugin add <plugin>@openai-curated` | Replace `<plugin>` with an available companion such as `github`, `figma`, `vercel`, `sentry`, `codex-security`, `posthog`, or `mixpanel`. |

`wunderkind codex doctor` may report whether these companions are installed, enabled, available, or absent. Its report is advisory and never changes their state.

Install companion workflows with their supporting skills in the same Codex scope. The upstream `improve-codebase-architecture` workflow calls `codebase-design` for architecture vocabulary, `grilling` after a candidate is selected, and `domain-modeling` for domain updates. `grill-me` also calls `grilling`; installing the entry point alone leaves that workflow incomplete. These are separate from Wunderkind's OpenCode adaptations, which supply their own vocabulary and process.

Doctor checks explicit `Call the Skill tool with "<name>"` references in detected Matt companion files and reports unresolved targets in text and JSON (`optional.missingSkillDependencies`). It holds the Matt pack status at `installed` while these dependencies are missing. This is a file-level advisory check, not proof that Codex has loaded the skills, and does not change core health or the exit code.

Repair a reported gap through Wunderkind:

```bash
wunderkind codex repair --dry-run
wunderkind codex repair
wunderkind codex doctor
```

Repair installs only missing `codebase-design`, `grilling`, and `domain-modeling` dependencies referenced by already-detected Matt companion skills. It downloads complete supporting Markdown and agent metadata, the upstream MIT license, and a source record from `mattpocock/skills` at pinned commit `49dd158d1076134a641b33efb035946536778336`. Downloads finish before installation begins; repair verifies the downloaded skill identity and checks for remaining dependency gaps before reporting success. An existing destination, including an incomplete directory or link, is held for operator resolution; unknown dependencies are reported rather than fetched arbitrarily. Normal install, upgrade, cleanup, and uninstall do not modify these third-party files. The skills remain editable and outside Wunderkind's eleven-skill payload; start a new Codex task after repair.

## Ownership and safety

Wunderkind stores its Codex payload and installation state under `~/.wunderkind/codex/` (respecting configured test/home overrides) and uses only the official Codex CLI for marketplace/plugin changes. Ordinary diagnostics do not edit Codex configuration. The explicit policy action writes versioned per-key ownership receipts at `~/.wunderkind/codex/model-policy.json`; receipt presence distinguishes managed values from later operator edits. Role overrides use the literal JSONC key `"[codex]"` in OMO global or active-profile config. Codex root/profile selections stay in `config.toml`. Current source repairs only trusted upstream role contents; if synchronization would require unapproved dependency provisioning, it holds. Read [the upgrade runbook](upgrading.md) for private backup, receipt-based freshness, and rollback boundaries. Agent files are recorded with their post-write SHA-256 hash. An upgrade or uninstall leaves an agent intact when its live hash no longer matches the recorded hash, returns a recovery-oriented non-zero result, and preserves state rather than risking user work. Catalog freshness is reported as unknown when the owner does not provide a supported remote proof; a package listing alone is not proof of active payload freshness.
