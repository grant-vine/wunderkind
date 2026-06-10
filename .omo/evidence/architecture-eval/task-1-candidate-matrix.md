# Architecture Candidate Matrix — Memory Evaluation

This document defines the frozen architecture candidate matrix for the memory architecture evaluation. These 6 candidates represent the authoritative reference for all evaluation tasks.

## Evaluation Candidates

| ID | Name | Primary Storage | Graph Capability | External Service | Key Evaluation Question | Docker Compose | Snapshot Ref |
|---|---|---|---|---|---|---|---|
| 1 | **DIY Baseline** | File, SQLite, Local-Vec, Qdrant, mem0 | None | Qdrant (for vector), mem0 (for mem0) | How does the current production suite perform without a graph layer? | Y (for vector/mem0) | Clean `main` |
| 2 | **Flat-file + Graph Supplement** | File Adapter (Markdown) | Supplement (SQLite edge table) | None | Can we add relationship traversal to the simplest storage model? | N | `2370981:src/memory/edges.ts` |
| 3 | **Local-Vec + Graph Supplement** | Local-Vec (HuggingFace + Index) | Supplement (SQLite edge table) | None | Does combining semantic search with a graph layer improve retrieval relevance? | N | `2370981:src/memory/edges.ts` |
| 4 | **PostgreSQL + pgvector + Edge Tables** | PostgreSQL | Native (Relational edges) | PostgreSQL | Can a single-store relational/vector hybrid outperform composite adapters? | Y (Postgres) | N/A |
| 5 | **Qdrant + Memgraph** | Qdrant | Native (Memgraph neighborhood) | Qdrant & Memgraph | Does a purpose-built graph DB offer significant neighborhood traversal advantages? | Y (Both) | N/A |
| 6 | **Qdrant + Neo4j** | Qdrant | Native (Neo4j traversal) | Qdrant & Neo4j | How does a "standard" graph stack compare to leaner or custom alternatives? | Y (Both) | N/A |

## Exclusions & Deferrals

The following technologies and approaches were considered but explicitly excluded from this phase of evaluation:

| Candidate | Reason for Exclusion |
|---|---|
| **TigerGraph** | Enterprise-only licensing and complexity; not easily self-hostable for local agent development. |
| **FalkorDB** | Less mature community and documentation compared to Memgraph/Neo4j. |
| **Apache AGE** | Extension complexity (Postgres extension) adds deployment risk without clear payoff in Phase 1. |
| **DuckDB** | Explored in WIP snapshot (as `timestream` adapter) but determined not to be differentiated for memory use cases. |
| **Pure SQLite Hybrid** | macOS-only constraint (requires Homebrew sqlite + `sqliteLibPath` for specific extensions) makes it unsuitable as a universal candidate for the installer. |

## Reference Notes

- **DIY Baseline** starts from a clean `main` branch state. The WIP snapshot at `2370981` is available for historical reference but is NOT the baseline.
- **Local-Vec** is a shipped production adapter on `main`, using local embeddings via HuggingFace transformers. It is not an experimental candidate.
- **Graph Supplement** layers are modeled after the WIP `src/memory/edges.ts` from commit `2370981`, which utilizes a local SQLite database specifically for tracking relationship edges between memory entries.
