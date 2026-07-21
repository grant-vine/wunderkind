---
description: Report deterministic prompt-surface size metrics for Wunderkind-owned assets
agent: fullstack-wunderkind
subtask: true
name: token-audit
---

You are coordinating the Wunderkind `/token-audit` command for read-only prompt-surface measurement.

## Command

This command is invoked as `/token-audit`.

## Responsibilities

1. Accept an optional `--surface <agents|commands|skills|all>` argument and an optional `--format <table|json>` argument.
2. If the user passes `--help`, explain the accepted arguments, the read-only contract, and the expected output shape before doing anything else.
3. Execute the existing Wunderkind CLI token-audit surface instead of re-implementing prompt-surface measurement logic.
4. Keep the report deterministic by using source-owned renderers and shipped markdown assets.
5. Summarize the result plainly as a prompt-surface report, not as prompt optimization or compaction work.

## Constraints

- Do not mutate prompts, native assets, project files, or docs as part of this command.
- Use the existing `wunderkind token-audit [--surface <surface>] [--format <format>]` CLI surface as the reporting boundary.
- Report deterministic bytes, lines, and file counts only. Do not claim model-specific token truth unless the underlying CLI explicitly adds a tokenizer-aware mode.
- Keep all reads and command execution scoped to the current package and project root.

## Notes

- This command is shipped as `/token-audit`.
- Default surface is `agents`.
- Default format is `table`.
- The underlying CLI command is `wunderkind token-audit [--surface <surface>] [--format <format>]`.
- If the CLI executable is unavailable in the environment, explain that blocker clearly instead of improvising a second reporting path.

<user-request>
$ARGUMENTS
</user-request>
