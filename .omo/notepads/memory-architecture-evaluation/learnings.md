# Learnings — memory-architecture-evaluation

## [2026-03-09] Session: ses_3362a9b76ffeuU4x04D1Y49VDH — Atlas Init

### Codebase State
- Repo: single worktree, single branch `main` at commit `a87c78f`
- 5 production memory adapters wired in `src/memory/index.ts`: file, sqlite, local-vec, vector, mem0
- Benchmark runners on main: `tests/memory-bench/run-bench.ts`, `tests/perf/adapter-benchmark.ts`
- WIP snapshot (commit `2370981`) contains: graph/edge layer, local-vec v2, duckdb, composite adapter, 5+ bench runners
- Evidence dir: `.sisyphus/evidence/architecture-eval/`

## [2026-03-09] Session: corpus-generator-task-4

### Corpus Generator Pattern
- Primary analysis corpus can hit target scale cleanly with `40 modules × (2 baseline snapshots × 2 artifacts + 15 release snapshots × 8 artifacts) = 4960 entries`.
- Deliberate weak-seed coverage works best when every module exports differently-phrased queries for module description, dependency map, ADR, issue, risk, change history, support chain, and relationship chain.
- Latest-truth pairs are easiest to score when newer entries explicitly supersede older IDs and queries ask for the present-state architecture rather than historical wording.

### Key Constraints
- exactOptionalPropertyTypes: true — split calls rather than passing undefined for optional params
- noUncheckedIndexedAccess: true — array/object index access is T | undefined
- noUnusedLocals + noUnusedParameters: true
- No `as any`, no `@ts-ignore`
- ESM only, Bun package manager
- macOS sqlite hybrid: ONLY valid with Homebrew sqlite + sqliteLibPath

### WIP Snapshot Reference
- Access via: `git show 2370981:<path>`
- graph layer: `git show 2370981:src/memory/edges.ts`
- local-vec v2: `git show 2370981:src/memory/adapters/local-vec.ts`
- bench harness: `git show 2370981:tests/memory-bench/run-sisyphus-bench.ts`

## [2026-03-09] Session: task-3-benchmark-spec

### Benchmark Freeze Learnings
- Existing `tests/memory-bench/run-bench.ts` and `story-generator.ts` are deterministic but too small and story-shaped for architecture selection.
- Existing `tests/perf/corpus.ts` and `adapter-benchmark.ts` show timing/semantic-query structure, but the corpus is too small and too generic; frozen evaluation needs 3,000-5,000 codebase-analysis memories.
- Weak-seed rescue must be first-class in the fixture design, with deliberately non-overlapping vocabulary rather than incidental paraphrase coverage.
- Latest-truth scoring needs its own deterministic contradiction corpus so recency failures cannot hide inside broader semantic scores.
- `.sisyphus` content is suitable only as an optional sanity-check validation pass, not as primary scoring material.

### Benchmark Runner Consolidation
- The existing codebase has overlapping benchmark runners (synthetic recall vs speed/accuracy).
- WIP runners from commit 2370981 introduce specialized metrics (graph retrieval, supersession) that should be integrated into a single harness rather than living as separate scripts.
- `tests/memory-bench/run-bench.ts` is the most extensible foundation for the canonical runner as it already handles synthetic story generation and scoring.

## [2026-03-09] Task: task-7-plan-cleanup
- Stale plans `memory-redesign.md` and `wunderkind-overhaul.md` were reviewed and removed.
- Unique findings from these plans (including UMS architecture, hybrid search params, project isolation logic, and benchmark results) were captured in `.sisyphus/evidence/architecture-eval/task-7-plan-cleanup.txt`.
- History and testing methodology evolutions are primarily captured in the narrative `HISTORY.md` file (as per the UMS plan deliverables).
- Cleaned up the plan directory to focus on the active `memory-architecture-evaluation.md`.

## [2026-03-09] Task: task-9-research-md
<findings>
- RESEARCH.md established as the canonical home for architecture experiments and historical findings.
- Initial seed entries populated: Graph Layer prototype (backed out), DuckDB/Composite prototypes (backed out), mem0 low-memory limits (constraint), and macOS SQLite hybrid requirements (constraint).
- Cross-links added to README.md (Research Log section) and AGENTS.md (WHERE TO LOOK table).
- Historical context gathered from commit 2370981 (WIP snapshot) confirming graph layer and duckdb explorations.
</findings>

## [2026-03-09] Task: task-8-graph-metrics
- Extended `tests/memory-bench/harness/score.ts` instead of creating parallel benchmark types so the shared report now carries the six architecture-eval metrics directly.
- Kept graph coverage isolated from ranking: `graph_weak_seed_hit_at_1` and `gold_in_expanded_neighborhood` are both `number | null`, allowing non-graph candidates to emit nulls without being marked degraded by default.
- Updated the canonical runner to emit the new metric block and JSON artifacts from the shared harness while preserving the existing synthetic story scoring path.

## [2026-03-09] Task: task-13-qdrant-memgraph
<findings>
- Qdrant + Memgraph candidate was prototyped entirely under `tests/memory-bench/candidates/qdrant-memgraph/` without touching production adapters or shared harness code.
- The prototype uses Qdrant for semantic seeding and Memgraph for `(:Memory)-[:RELATED_TO]->(:Memory)` traversal, with edges derived from overlapping corpus tags.
- A deterministic hash-based 384-dim pseudo-embedding was used for the prototype so the candidate can run without adding model dependencies; this should be documented as prototype-only behavior.
- Memgraph connectivity via `neo4j-driver` required `encrypted: "ENCRYPTION_OFF"` for local Bolt access.
- In this environment the benchmark correctly skipped because host port `6334` was already occupied by another Qdrant container, so explicit skip artifacts are essential for Docker-backed candidate evaluation.
</findings>

## [2026-03-09] Task: task-14-qdrant-neo4j
<findings>
- Prototype lives entirely under `tests/memory-bench/candidates/qdrant-neo4j/` and avoids production adapter changes.
- Neo4j CE Docker config uses `NEO4J_AUTH=none` for lowest-friction local evaluation; this is documented in both evidence files.
- The candidate uses Qdrant collection `wunderkind-neo4j-eval` with 384-dim deterministic hash embeddings so the benchmark can run without model downloads.
- Graph edges are materialized from overlapping `CorpusEntry.tags` into `(:Memory)-[:RELATED_TO {weight}]->(:Memory)` links in both directions, then expanded with the required 1..2-hop Cypher path query.
- On this machine the benchmark skipped cleanly because `qdrant or neo4j unavailable`; evidence was still emitted to `.sisyphus/evidence/architecture-eval/task-14-qdrant-neo4j-run.txt` and `task-14-path-query-validation.txt`.
</findings>

## [2026-03-09] Task: task-11-localvec-graph
<findings>
- A thin graph supplement can stay fully out of production code by wrapping `LocalVecAdapter` in a candidate-only adapter and mirroring corpus entries into a separate SQLite adjacency store.
- Shared `CorpusEntry.tags` are sufficient to synthesize lightweight graph edges for evaluation; overlap count works as a simple directional weight for 2-hop expansion.
- The cleanest weak-seed comparison is to expose both `semanticSearch()` (baseline local-vec only) and `searchWithGraph()` (seed + expanded neighborhood), then score them separately against the same weak-seed query set.
- Skip handling should still emit a complete artifact for graph candidates, with graph-specific fields populated and `skipped_reason` set to `embedding model not cached` when `Xenova/e5-small-v2` is absent.
</findings>

## [2026-03-09] Task: local-vec-graph seedCorpus
- Candidate-only bulk seeding for `LocalVecGraphAdapter` is safest when embeddings/base writes stay delegated to `LocalVecAdapter.write()` and graph materialization happens afterward in one SQLite transaction.
- Preparing the graph node upsert statement once on adapter construction avoids re-preparing SQL in the bulk transaction loop.
- Progress logging belongs in the slow embedding write path; logging every 500 writes in `seedCorpus()` gives visibility without touching shared harness code.
