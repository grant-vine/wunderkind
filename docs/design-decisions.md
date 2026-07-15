# Design Decisions

Last refreshed: 2026-07-15T11-11-35Z

## Current design focus

Wunderkind’s most important “design” work in this repo is not a polished frontend UI. It is **workflow clarity**, **prompt legibility**, and **documentation information architecture**.

## Documentation UX decisions

- Keep one canonical managed docs lane per eligible agent.
- Use `/docs-index` as the coordinator surface rather than letting each agent invent its own path.
- Treat `CONTEXT.md` as the compact shared-context lane for docs and planning.
- Keep docs path project-local and explicit (`./docs`).
- Preserve timestamp-aware history rules in the product contract even when this repo currently uses `overwrite` mode.

## Information architecture choices

- `README.md` remains the public/external onboarding surface.
- `AGENTS.md` remains the repo-maintainer knowledge base.
- `CONTEXT.md` is the compact domain/context artifact for future sessions and docs grilling.
- `docs/` is the managed, perspective-specific documentation lane.
- `.omo/` remains the durable planning/evidence lane.

## Tone and clarity rules reflected in the product

- Prefer canonical naming first (`oh-my-openagent`). If legacy naming is mentioned at all, label it as detection-only migration history rather than live compatibility.
- Use role-based docs ownership so readers know which doc is authoritative for which concern.
- Avoid “AI slop” phrasing in comments and docs; keep language direct and maintainable.

## Open design opportunities

- If docs volume grows, add a lightweight docs taxonomy page that groups install/operations/workflow/reference docs more explicitly.
- If design-system work grows later, create a dedicated `DESIGN.md` companion section in docs that cross-links with Stitch workflow guidance.

## Source map

### Local sources
- `src/agents/docs-config.ts`
- `src/agents/docs-index-plan.ts`
- `commands/docs-index.md`
- `README.md`
- `AGENTS.md`
- `CONTEXT.md`

### Upstream references
- https://opencode.ai/docs/agents
- https://opencode.ai/docs/commands
- https://opencode.ai/docs/plugins
