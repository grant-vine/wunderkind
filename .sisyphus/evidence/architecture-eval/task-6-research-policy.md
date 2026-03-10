# RESEARCH.md Knowledge Capture Policy

This document establishes RESEARCH.md as the canonical, durable home for architecture and memory findings in the Wunderkind project.

## 1. Purpose
RESEARCH.md is the durable record for findings that are too volatile, experimental, or historical for the root README.md. While README.md focuses on installation, usage, and performance tables, RESEARCH.md captures the "why" behind architectural decisions, what was tried, why certain approaches were backed out, and the constraints discovered during development.

## 2. Required Sections
The following four sections must always exist in RESEARCH.md:

### Tried & Worked
Approaches that succeeded and are now shipped as part of the core product or recommended as best practices.

### Tried & Backed Out
Approaches that were explored but reverted or abandoned. Each entry must include a clear rationale for why it was not pursued.

### Environmental Constraints
Platform-specific or hardware-specific rules and limitations (e.g., macOS SQLite behavior, RAM limits, etc.).

### Candidates to Revisit
Ideas or prototypes that were deferred due to time, complexity, or external blockers, but might be worth trying later.

## 3. Entry Format
Every entry in RESEARCH.md must follow this format:

- **Date**: YYYY-MM
- **Title**: A short, descriptive title
- **Body**: What was tried, what happened, and why the decision was made.
- **Reference**: Commit hash or evidence file path (if applicable).

## 4. Required Initial Entries (Seed)
When RESEARCH.md is created, it must include these initial findings:

### Tried & Backed Out: Graph Layer Prototype (2025-03)
The graph layer prototype worked structurally (SQLite adjacency store with JS BFS traversal) but did not improve weak-seed retrieval in benchmarks. Other adapters like `local-vec`, `duckdb`, and `composite` were also explored.
- **Commit**: `2370981` (Available via `git show 2370981:<path>`)

### Environmental Constraints: mem0 Low-Memory Limitation (2025-03)
The `mem0` adapter struggles significantly on 8GB machines due to the overhead of calling an AI model for every write operation.
- **Status**: Revisit once the feature set is confirmed and hardware requirements are better understood.

### Environmental Constraints: macOS SQLite Hybrid Validity Rule (2025-03)
SQLite hybrid/vector search mode is only valid on macOS when using a Homebrew-installed SQLite with `sqliteLibPath` correctly configured. The default FTS-only fallback does not count as valid hybrid/vector behavior in benchmarks.

## 5. What does NOT go in RESEARCH.md
- **Performance Benchmark Tables**: These stay in README.md.
- **Installation Instructions**: These stay in README.md.
- **Active Adapter Documentation**: This stays in AGENTS.md.
- **Live Plan State**: This stays in `.sisyphus/plans/`.

## 6. Linkage Requirements
Both README.md and AGENTS.md must point to RESEARCH.md once it is created:
- **README.md**: Add a "## Research Log" section at the bottom linking to RESEARCH.md.
- **AGENTS.md**: Add RESEARCH.md to the "WHERE TO LOOK" table with the description: "Architecture experiments and historical findings | RESEARCH.md".

## 7. Maintenance Rule
No architecture experiment is considered complete until a corresponding entry has been added to RESEARCH.md.
