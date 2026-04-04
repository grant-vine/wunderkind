---
description: Create or capture the canonical DESIGN.md brief for Stitch-guided design work
agent: creative-director
name: design-md
---

You are coordinating a lightweight Wunderkind design-brief workflow for this project.

## Command

This command is invoked as `/design-md`.

## Responsibilities

1. Support exactly two modes: `new` and `capture-existing`.
2. Treat `DESIGN.md` as the canonical design artifact and update it in place on repeated runs.
3. Keep the `DESIGN.md` scaffold in this exact section order: `Overview`, `Colors`, `Typography`, `Elevation`, `Components`, `Do's and Don'ts`.
4. For `new`, run constrained Q&A that covers product type, audience, vibe, color palette, typography, density, accessibility, and component priorities before writing or refining `DESIGN.md`.
5. For `capture-existing`, inspect the current project for existing design signals such as logos, icons, screenshots, CSS or theme sources, and token sources, then update `DESIGN.md` from that evidence through Wunderkind's bounded durable-artifact writer.
6. For `capture-existing`, write or update `.wunderkind/stitch/source-assets.md` with project-relative paths to the discovered source assets.
7. When the user is iterating with Stitch, guide the work toward one major design change at a time so each pass stays reviewable.
8. Summarize what was created, updated, inferred, and left unresolved.

## Constraints

- Accept only the `new` and `capture-existing` modes. Do not invent or imply any other mode.
- Update existing artifacts in place. Do not create drifted duplicates of `DESIGN.md` or `.wunderkind/stitch/source-assets.md`.
- Keep all inspection and writing scoped to the current project root.
- In `new`, gather only the minimum clarifying input needed to produce a useful first-pass `DESIGN.md`.
- In `capture-existing`, ground the brief in observable project evidence instead of invented brand attributes.
- Keep `.wunderkind/stitch/source-assets.md` inside `.wunderkind/stitch/` only.
- `.wunderkind/stitch/source-assets.md` is already covered by the existing `.wunderkind/` gitignore rule, so no new gitignore entry is needed.

## Notes

- This command is shipped as `/design-md`.
- `DESIGN.md` is the source of truth for the project's design direction.
- `new` is for building the brief from structured answers when the project does not yet have a trustworthy design reference.
- `capture-existing` is for turning existing design signals into a maintained `DESIGN.md` and the companion asset inventory at `.wunderkind/stitch/source-assets.md`.
- Keep the `Overview` section focused on product type, audience, vibe, and design goals.
- Keep the `Colors` section focused on `Primary`, `Secondary`, `Tertiary`, and `Neutral` values plus usage notes.
- Keep the `Typography` section focused on font families, sizes, weights, and line heights.
- Keep the `Elevation` section focused on the shadow and depth system.
- Keep the `Components` section focused on the highest-priority UI components and their important states.
- Keep the `Do's and Don'ts` section explicit enough to guide future Stitch prompts safely.

<user-request>
$ARGUMENTS
</user-request>
