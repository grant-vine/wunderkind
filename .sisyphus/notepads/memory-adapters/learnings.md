
## Task 6: mem0 projectSlug + listAgents (2026-03-06)

- Added `projectSlug: string` (required, not optional) to `Mem0AdapterConfig`
- Added `#projectSlug: string`, `#knownAgents: Set<string>` private fields to `Mem0Adapter`
- Added `#scopedAgent(agent)` private method returning `"${projectSlug}:${agent}"`
- `write()` and `read()` both call `this.#knownAgents.add(agent)` before scoping
- `search()` and `deleteAll()` use `this.#scopedAgent(agent)` but do NOT add to knownAgents (not required — read/write track them)
- `#mapItem()` unchanged — callers always pass clean (unscoped) agent name directly
- `listAgents()` placed between `count()` and `status()` — returns `Array.from(#knownAgents).sort()`
- `src/memory/index.ts` required `mem0ProjectSlug?: string` added to `WunderkindConfig`; falls back to `path.basename(projectDir)`
- Remaining tsc errors (cli/index.ts, vector.ts) are pre-existing from other tasks, not introduced here

## Task 5 — VectorAdapter group_id isolation (2026-03-06)

- Added `projectSlug: string` to `VectorAdapterConfig` (required field)
- Added `group_id: string` to `MemoryPayload` internal interface
- `asPayload()` guard now validates `group_id` is a string before casting
- All Qdrant filter `must` arrays now include `{ key: "group_id", match: { value: this.#config.projectSlug } }` alongside `agent_id`
  - `#scrollAll()`: both agent_id + group_id
  - `write()` dedup search: both
  - `write()` dedup scroll: both
  - `write()` upsert payload: `group_id: this.#config.projectSlug`
  - `update()` upsert payload: `group_id: existing?.group_id ?? this.#config.projectSlug` (preserves if exists)
  - `search()`: both
  - `deleteAll()`: both
- `listAgents()` scrolls all points filtered by `group_id` only, collects unique `agent_id` values, returns sorted array
- `src/memory/index.ts` VectorAdapter construction needed `projectSlug: path.basename(projectDir)` added
- LSP diagnostics lag behind edits — `tsc --noEmit` is authoritative
- Pre-existing error in `src/cli/index.ts` (scope missing) is NOT from this task
