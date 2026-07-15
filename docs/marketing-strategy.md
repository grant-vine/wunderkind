# Marketing Strategy

Last refreshed: 2026-07-15T11-11-35Z

## Positioning

Wunderkind is the **specialist-agent addon for OpenCode**: it gives product teams six retained, domain-specific agents without forcing them into a new runtime, daemon, or proprietary orchestration layer. The product promise is not “more agents,” but **better default judgment** across product, engineering, marketing, security, design, and legal work.

## Core narrative pillars

1. **Retained specialist depth, not generic prompting**
   - Wunderkind ships six opinionated retained agents with explicit role boundaries, 19 promoted retained-specialist skills, and 4 Wunderkind-specific workflow skills.
2. **Overlay, not platform lock-in**
   - Wunderkind stays a synchronous plugin/overlay on top of OpenCode and OMO instead of re-implementing an agent platform.
3. **Bootstrap a high-context repo quickly**
- `wunderkind init`, `CONTEXT.md`, `.omo/`, and `/docs-index` give teams a repeatable init-deep-style baseline.
4. **Upgrade trust matters**
   - `wunderkind doctor` and `wunderkind upgrade` now surface stale native assets and native agent markdown version drift.
5. **Filesystem-first docs and planning**
   - `docs-with-grill`, `prd-pipeline`, `triage-issue`, and `/docs-index` all reinforce a repo-local, durable workflow. Deprecated skill routes, including `design-an-interface`, stay as replacement guidance only.

## Priority audiences

- Teams already using **OpenCode** who want more specialized retained agents.
- Teams already using or evaluating **oh-my-openagent** and wanting a product/team overlay rather than a raw harness.
- Technical founders, product-minded engineers, and AI-native delivery teams who want install + bootstrap + docs + workflow guidance in one package.

## Adoption hooks to emphasize

- “Install once, initialize per repo.”
- “Keep your OpenCode setup; add retained specialist depth.”
- “Use `CONTEXT.md` + `docs-with-grill` to make docs and planning more coherent over time.”
- “Doctor tells you when your installed native assets drift.”

## Messaging updates worth carrying forward

- Prefer **`oh-my-openagent`** naming in current documentation and examples.
- Keep any legacy `oh-my-opencode` note explicitly detection-only and migration-focused; do not imply a live compatibility transition.
- Position `/docs-index` as the managed docs refresh/bootstrap surface and `init-deep` as an upstream workflow concept that Wunderkind supports through local artifacts.

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
