# Marketing Strategy

Last refreshed: 2026-08-12T00-00-00Z

## Positioning

Wunderkind is the **specialist-agent addon for OpenCode**: it gives product teams six retained, domain-specific agents without forcing them into a new runtime, daemon, or proprietary orchestration layer. The product promise is not “more agents,” but **better default judgment** across product, engineering, marketing, security, design, and legal work.

## Core narrative pillars

1. **Retained specialist depth, not generic prompting**
   - Wunderkind ships six opinionated retained agents with explicit role boundaries, 22 promoted retained-specialist skills, and 4 Wunderkind-specific workflow skills (`promoted=22`, `wunderkind-specific=4`, `deprecated=1`, `public/deprecated total=27`).
2. **Overlay, not platform lock-in**
   - Wunderkind stays a synchronous plugin/overlay on top of OpenCode and OMO instead of re-implementing an agent platform.
3. **Bootstrap a high-context repo quickly**
- `wunderkind init`, `CONTEXT.md`, `.omo/`, and `/docs-index` give teams a repeatable init-deep-style baseline.
4. **Upgrade trust matters**
   - `wunderkind doctor` and `wunderkind upgrade` now surface stale native assets and native agent markdown version drift.
5. **Filesystem-first docs and planning**
    - `docs-with-grill`, `prd-pipeline`, `release-upgrade`, `platform-compatibility`, `triage-issue`, `supabase-architect`, and `/docs-index` all reinforce a repo-local, durable workflow. Deprecated skill routes, including `design-an-interface`, stay as replacement guidance only.
6. **Optional runtime observability without product-default lock-in**
   - `token-audit` stays audit-only, while the separate prompt-optimization runtime-report surface gives teams an opt-in way to observe local trimming/reporting behavior without turning that into a public optimize workflow.

## Priority audiences

- Teams already using **OpenCode** who want more specialized retained agents.
- Teams already using or evaluating **oh-my-openagent** and wanting a product/team overlay rather than a raw harness.
- Technical founders, product-minded engineers, and AI-native delivery teams who want install + bootstrap + docs + workflow guidance in one package.

## Adoption hooks to emphasize

- “Install once, initialize per repo.”
- “Keep your OpenCode setup; add retained specialist depth.”
- “Use `CONTEXT.md` + `docs-with-grill` to make docs and planning more coherent over time.”
- “Doctor tells you when your installed native assets drift.”
- “Keep product defaults conservative, but allow project-local prompt optimization when the repo needs it.”
- “Use `release-upgrade` when the real work is release-wave alignment, not generic docs writing.”
- “Use `platform-compatibility` when the real work is host or OMO/OpenCode drift, not generic architecture cleanup.”
- “Route Supabase-heavy app-data architecture to `supabase-architect` instead of treating it as generic backend work.”

## Messaging updates worth carrying forward

- Prefer **`oh-my-openagent`** naming in current documentation and examples.
- Keep any legacy `oh-my-opencode` note explicitly detection-only and migration-focused; do not imply a live compatibility transition.
- Position `/docs-index` as the managed docs refresh/bootstrap surface and `init-deep` as an upstream workflow concept that Wunderkind supports through local artifacts.
- Position `release-upgrade` as the promoted product-owned route for release-note synthesis, version bump planning, compatibility checks, and rollback-conscious release prep.
- Position `platform-compatibility` as the promoted fullstack-owned route for host/plugin/config-chain drift and OpenCode/OMO contract changes.
- Position `supabase-architect` as a promoted fullstack-owned skill for Supabase auth, RLS, Realtime, Storage, Edge Functions, branching, local dev, observability, and app-data composition.
- Keep `supportability-incident` explicitly rejected as a standalone skill; overlap avoidance routes that work through `/supportability-review`, `/runbook`, and `/incident-response`.

## Source map

### Local product truth
- `README.md`
- `AGENTS.md`
- `package.json`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- `skills/docs-with-grill/SKILL.md`

### Upstream references
- https://opencode.ai/docs/
- https://opencode.ai/changelog
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/README.md
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md
- https://github.com/mattpocock/skills
