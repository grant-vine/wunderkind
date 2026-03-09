# Research Log

This document serves as the canonical record for architectural findings, experimental results, and environmental constraints discovered during the development of Wunderkind's memory systems.

## Tried & Worked

### Semantic Search Supremacy (2025-03)
Benchmarks across multiple corpora confirmed that dense vector search consistently outperforms keyword-based retrieval (BM25/FTS) for conversational agent memory. Models like `all-MiniLM-L6-v2` provide the best balance of speed and recall for short text.
- **Reference**: Performance Benchmarks in README.md

## Tried & Backed Out

### Graph Layer Prototype (2025-03)
A graph-based retrieval layer was prototyped using a SQLite adjacency store and JavaScript-based BFS traversal. While structurally sound, it failed to significantly improve weak-seed rescue or hit@k metrics compared to pure semantic search. The extra complexity of managing edges did not justify the marginal gains.
- **Commit**: `2370981` (Ref: `src/memory/edges.ts`)

### DuckDB & Composite Adapter Prototypes (2025-03)
Explored DuckDB as an analytical store for time-series memory and a multi-tier composite adapter. These were deferred in favor of the more focused `local-vec` and `vector` (Qdrant) implementations which satisfied immediate requirements with less overhead.
- **Commit**: `2370981`

## Environmental Constraints

### mem0 Low-Memory Limitation (2025-03)
The `mem0` adapter performs poorly on machines with limited RAM (8GB). This is primarily due to the overhead of calling local LLMs (typically Ollama) for memory consolidation on every write operation, leading to significant latency (up to 37s for 100 memories).
- **Status**: Revisit if more efficient consolidation strategies emerge.

### macOS SQLite Hybrid Validity Rule (2025-03)
On macOS, hybrid vector search via SQLite is only valid when using Homebrew-installed SQLite combined with an explicit `sqliteLibPath`. The default system SQLite lacks the necessary extension support, and falling back to FTS-only mode results in 0% recall on conversational benchmarks.

## Candidates to Revisit

### Advanced Reranking Pipelines
Initial tests with BGE-base models showed potential but were slower than MiniLM. Re-evaluating rerankers (like Cross-Encoders) as a second-pass filter could improve precision for very large memory stores.

### Distributed Memory Sync
Project-scoped memory currently lacks a native sync mechanism for teams. Exploring a lightweight protocol for sharing verified memories between project members.
