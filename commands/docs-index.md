---
description: Regenerate Wunderkind-managed project documentation and refresh the docs index
agent: product-wunderkind
---

You are coordinating a lightweight Wunderkind documentation refresh/bootstrap workflow for this project.

## Command

This command is invoked as `/docs-index`.

## Responsibilities

1. Inspect only the configured docs directory inside the current project root and only the files relevant to this workflow.
2. Use the built-in Wunderkind docs ownership rules and canonical filenames as managed home files for eligible docs agents.
3. Decide which managed docs should be refreshed and which should be bootstrapped from scratch when missing.
4. Have docs-eligible Wunderkind subagents perform their documentation work in their own managed lanes.
5. Refresh the docs index so it reflects the current managed documents, even when the run is only partially successful.
6. Summarize the outcome plainly as created, refreshed, skipped, and failed.
7. After the refresh, ask the user whether they want to run `init-deep` as a follow-up.

## Constraints

- Only docs-eligible Wunderkind agents should participate.
- Use canonical filenames from Wunderkind's built-in ownership map. Treat timestamped files derived from those canonical basenames as managed family files, not legacy files to normalize away.
- Do not let individual agents invent output paths. For `append-dated`, keep each eligible agent in its canonical managed home file. For `new-dated-file`, write timestamped family files beside that canonical home file.
- Treat the current working directory as the trust boundary. Never inspect parent directories, sibling repos, home directories, or arbitrary filesystem locations.
- Never glob or search outside the configured docs directory, `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, and this shipped `/docs-index` command asset.
- Surface partial failures clearly, but still keep the docs index aligned with the successfully refreshed or created outputs.

## Notes

- This command is shipped as `/docs-index`.
- Use the configured docs path and history mode from project-local Wunderkind config. The docs path must remain relative to the current project root.
- The coordinator owns the docs index and overall summary; individual agents own their own canonical managed home files and any timestamped managed family files derived from them.
- Use one shared UTC token per `/docs-index` run. Timestamp format: `YYYY-MM-DDTHH-mm-ssZ`, for example `2026-03-12T18-37-52Z`.
- `append-dated` appends canonical headings like `## Update 2026-03-12T18-37-52Z`; collisions use `## Update 2026-03-12T18-37-52Z (2)`.
- `new-dated-file` writes family files like `marketing-strategy--2026-03-12T18-37-52Z.md`; collisions use `marketing-strategy--2026-03-12T18-37-52Z--2.md`.
- Existing date-only sections and files remain valid history and must not be rewritten or normalized away.
- Partial success is acceptable for docs refresh.
- After the run, ask the user whether to run `init-deep` as an optional follow-up.

<user-request>
$ARGUMENTS
</user-request>
