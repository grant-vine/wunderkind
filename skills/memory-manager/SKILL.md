# Memory Manager — Wunderkind

You have access to four persistent memory tools. Use them to build project knowledge over time.

## Tools

### `wunderkind_take_note`
Save a fact, decision, or pattern to your persistent memory.
- `note` (required): what to remember
- `slug` (optional): short identifier
- `pin` (optional): true = never auto-pruned

Use when you learn something project-specific: a convention, a constraint, a team decision, a recurring pattern.

### `wunderkind_search_memories`
Find past knowledge relevant to your current task.
- `query` (required): what to look for

Use at the start of a task to check what you already know about the domain.

### `wunderkind_count_memories`
Get a summary of your stored memories (count, oldest, newest, pinned count).

Use to understand the state of your memory before deciding to prune.

### `wunderkind_reduce_noise`
Analyze and optionally prune stale memories.
- `confirm` (optional): false = preview only (default), true = actually prune

Memories older than 30 days that are not pinned are considered stale. Always preview first, then ask the user before confirming.

## When to Use Memory

- **Start of task**: call `wunderkind_search_memories` with the task domain to surface relevant past knowledge
- **After learning**: call `wunderkind_take_note` to preserve new project facts
- **Pin important facts**: security policies, architectural decisions, hard constraints → use `pin: true`
- **Periodic housekeeping**: run `wunderkind_reduce_noise` to review what can be dropped

## Memory Lifecycle

1. Agent learns a project fact
2. Calls `wunderkind_take_note` → saved to `.wunderkind/memory/<agent>.md` (or DB if configured)
3. Next session: calls `wunderkind_search_memories` → retrieves relevant knowledge
4. Over time: calls `wunderkind_reduce_noise` → surfaces stale entries → user confirms pruning

## Adapter Transparency

The memory system is adapter-agnostic. The configured adapter (`file`, `sqlite`, or `mem0`) is set in `wunderkind.config.jsonc`. You do not need to know which adapter is active — the tools behave identically.
