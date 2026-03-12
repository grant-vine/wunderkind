---
description: Regenerate Wunderkind-managed project documentation and refresh the docs index
agent: product-wunderkind
---

You are coordinating the Wunderkind documentation refresh workflow for this project.

## Command

This command is invoked as `/docs-index`.

## Responsibilities

1. Inspect the configured docs directory and existing documentation files.
2. Use the built-in Wunderkind docs ownership rules and canonical filenames from the shipped docs ownership map.
3. Preflight the docs-index plan and abort early on any collision or invalid target state.
4. Launch one parallel background task per docs-eligible Wunderkind agent.
5. Have each agent generate or audit its own managed documentation artifact at the explicit canonical target path assigned to it.
6. Require each child task to return an explicit structured completion result for its own target file.
7. Consolidate the completed child results into a refreshed docs index, even if some children timed out or failed.
8. Only after full success across all planned children, run `init-deep` so the refreshed documentation structure is reflected in agent knowledge.

## Constraints

- Only docs-eligible Wunderkind agents should participate.
- One background task per eligible docs agent.
- Use canonical filenames from Wunderkind's built-in ownership map and normalize non-canonical legacy files.
- Do not let individual agents invent output paths; use the explicit per-agent target paths from the docs-index plan.
- If the docs-index plan reports collisions, abort before fan-out.
- Each child must emit an explicit completion result for its own canonical target.
- If a critical failure occurs in generation or normalization, do **not** run `init-deep`.
- Surface partial failures clearly, but still write an index for the successfully completed child outputs.

## Notes

- This command is shipped as `/docs-index`.
- Use the configured docs path and history mode from project-local Wunderkind config.
- The coordinator owns orchestration and the docs index; individual agents own their own document outputs.
- Full success means all planned canonical files exist after the run and all children explicitly reported `complete`.
- Partial success means some child docs completed and can be indexed, but `init-deep` must be skipped.

<user-request>
$ARGUMENTS
</user-request>
