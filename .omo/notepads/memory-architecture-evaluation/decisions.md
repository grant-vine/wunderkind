# Decisions — memory-architecture-evaluation

## [2026-03-09] Session: ses_3362a9b76ffeuU4x04D1Y49VDH — Atlas Init

### Architecture Evaluation Candidates (Frozen)
1. DIY baseline — 5 production adapters, no graph layer
2. flat-file + graph supplement
3. local-vec + graph supplement (builds ON existing shipped local-vec)
4. PostgreSQL + pgvector + edge tables
5. Qdrant + Memgraph
6. Qdrant + Neo4j (control candidate)

### Scope Guardrails
- NO production migration in this phase
- NO adapter replacement
- NO UI/config redesign
- NO vendor sprawl beyond 6 frozen candidates
- Deferred: TigerGraph, FalkorDB, AGE-only path, DuckDB

### Wave Execution Order
- Wave 1 (parallel): Tasks 1-6 — freeze scope documents
- Wave 2 (parallel): Tasks 7-9 — hygiene + RESEARCH.md
- Wave 3 (max parallel): Tasks 10-14 — candidate prototypes
- Wave 4 (sequential): Task 15 — benchmark + decision memo
- Final (parallel): F1-F4 — review wave

## [2026-03-09] Session: corpus-generator-task-4

### Synthetic Corpus Design
- Use codebase-analysis memories only; no raw source snippets in the benchmark corpus.
- Spread artifacts across `fullstack-wunderkind`, `qa-specialist`, and `ciso` so wrong-agent isolation can be measured directly.
- Encode contradiction handling through timestamped artifact histories plus `supersedes` links on replacement memories.

## [2026-03-09] Session: task-3-benchmark-spec

### Benchmark Fixture Freeze
- Primary benchmark corpus is frozen as synthetic codebase-analysis knowledge, not raw code, with a target size of 3,000-5,000 memories.
- Secondary benchmark corpus is frozen as a deterministic latest-truth temporal contradiction set of 200-500 memories.
- Optional `.sisyphus` corpus is allowed only for sanity-check validation and must not affect primary scoring or ranking.
- All candidates must emit the same machine-readable JSON artifact schema with rubric-aligned metrics, degraded/skipped flags, and environment metadata.
- Non-graph candidates may emit `hop_success_rate: null`, but must mark degraded when required traversal coverage cannot be fully supported.

### Canonical Benchmark Runner
- **Decision**: Designate `tests/memory-bench/run-bench.ts` as the canonical entry point for all architecture evaluation benchmarks.
- **Rationale**: It provides a structured recall/accuracy framework and is easier to extend with new fixture types compared to the more monolithic `tests/perf/adapter-benchmark.ts`.
- **Strategy**: Archive overlapping runners and port their specialized logic (speed, stress, supersession) into the canonical harness.

## [2026-03-09] Session: task-15-decision-memo

### Memory Architecture Selection
- **Recommended Default**: SQLite-Hybrid. SQLite (100% EM) as the primary retrieval path with optional graph expansion.
- **Rationale**: Zero operational overhead (10/10) with perfect strong-seed preservation. File-graph results (55.6% traversal) validate graph value but warn against interference with exact matching.
- **Advanced Option**: Local-Vec-Graph. Retains current local-vec's semantic capability while adding the hybrid-graph traversal layer.
- **Deferred**: Postgres-pgvector and external Docker-backed stores (Qdrant/Neo4j/Memgraph) are deferred due to high operational complexity and no-Docker environment requirements for the baseline.

## [2026-03-09] Session: f1-plan-compliance-audit

### F1 Audit Outcome
- Verdict: APPROVE
- Candidate coverage passed: matrix includes file, sqlite, plain local-vec, file-graph, local-vec-graph, postgres-pgvector, qdrant-memgraph, and qdrant-neo4j.
- Rubric compliance passed: matrix uses latest-truth, weak-seed, traversal, strong-seed, isolation, ops-complexity, docker-practicality, and determinism.
- Memo compliance passed: recommendation memo includes default, optional advanced path, deferred/avoid sections, explicitly labels SQLite+graph as proposed/not benchmarked, and reconciles file-graph (57.27) vs sqlite (45.00).
- Minor note: memo has a small candidate-count wording inconsistency in the executive summary, but not enough to fail compliance.
