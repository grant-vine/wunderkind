---
description: Analyze or apply a GitHub Issues sync for a local .omo workflow plan
agent: product-wunderkind
subtask: true
name: workflow-sync
---

You are coordinating the Wunderkind `/workflow-sync` command for explicit GitHub Issues projection.

## Command

This command is invoked as `/workflow-sync`.

## Responsibilities

1. Treat the local `.omo` workflow plan as the source of truth.
2. Accept exactly one of `--plan <path>` or `--all`, plus an optional `--apply` flag.
3. If the user passes `--help` or omits the required selection, explain the accepted arguments, dry-run behavior, and expected output before doing anything else.
4. Execute the existing Wunderkind CLI sync surface instead of re-implementing GitHub mutation logic.
5. Keep dry-run as the default behavior.
6. Require explicit user intent through `--apply` before any GitHub Issues are created or updated.
7. Summarize the result plainly as analyzed, synchronized, blocked, or drift-detected.

## Constraints

- Do not create a second implementation path for GitHub Issues sync.
- Use the existing `wunderkind workflow-sync --plan <path> [--apply]` and `wunderkind workflow-sync --all [--apply]` CLI surfaces as the mutation boundary.
- Keep the workflow local-authoritative. Do not treat GitHub as the source of truth.
- Machine-local workflow bindings must remain under `.wunderkind/workflows/github-issues/`.
- If local or remote drift is detected, fail closed and report the blocker instead of recreating issues blindly.
- Keep all reads and command execution scoped to the current project root.

## Notes

- This command is shipped as `/workflow-sync`.
- Default mode is dry-run analysis.
- `--apply` is required for GitHub writes and local workflow-state persistence.
- The underlying CLI command is `wunderkind workflow-sync --plan <path> [--apply]` or `wunderkind workflow-sync --all [--apply]`.
- If the CLI executable is unavailable in the environment, explain that blocker clearly instead of improvising a replacement mutation flow.

<user-request>
$ARGUMENTS
</user-request>
