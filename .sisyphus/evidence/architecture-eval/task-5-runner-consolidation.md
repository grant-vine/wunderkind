# Task 5: Benchmark Runner Consolidation Strategy

This document defines the consolidation strategy for benchmark and performance runners in the Wunderkind repository. It inventories existing tools, assigns dispositions, and names the canonical entry point for the ongoing architecture evaluation.

## 1. Runner Inventory & Dispositions

### Active Runners (on `main`)

| File Path | Purpose | Current State | Disposition |
|-----------|---------|---------------|-------------|
| `tests/memory-bench/run-bench.ts` | Accuracy/recall benchmark using synthetic stories and optional fixtures. | Functional, testing recall on 3 adapters. | **Canonical** — To be extended as the single entry point. |
| `tests/perf/adapter-benchmark.ts` | Speed and keyword/semantic accuracy benchmark across all 5 adapters. | Functional, emits tables for latency and precision. | **Archive** — Functionality to be merged into canonical runner. |
| `tests/memory-bench/download-fixtures.ts` | Helper to download external datasets (LongMemEval, etc). | Functional utility. | **Keep as Utility** |

### WIP Reference Runners (commit `2370981`)

| File Path | Purpose | State in Snapshot | Disposition |
|-----------|---------|-------------------|-------------|
| `run-sisyphus-bench.ts` | Specialized runner for `.sisyphus` data imports and graph-based retrieval. | WIP / Experimental | **Port and Replace** — Port graph/sisyphus logic to canonical. |
| `run-conversational-bench.ts` | Benchmarking against conversational session fixtures with Ollama review. | WIP / Experimental | **Port and Replace** — Port conversational logic to canonical. |
| `run-latest-truth-bench.ts` | Scaled stress test (12k+ memories) focused on supersession and agent leaking. | WIP / Experimental | **Port and Replace** — Port stress/supersession logic to canonical. |
| `stress-all-adapters.ts` | Large scale ramp test and quality metrics for all adapters. | WIP / Experimental | **Port and Replace** — Port ramp/RSS monitoring to canonical. |
| `ollama-review.ts` | LLM-based evaluation of benchmark results. | WIP / Experimental | **Keep as Utility** — Supporting module for canonical runner. |

---

## 2. Canonical Entry Point

The single canonical entry point for all ongoing benchmarks is:
**`tests/memory-bench/run-bench.ts`**

### Execution Strategy
- **Command**: `bun run bench:recall` (mapped in `package.json`).
- **Selector**: Supports a `--candidate` or `--adapter` flag to select the architecture under test.
- **Output**: Emits the standardized JSON artifact format defined in Task 3.
- **Fixture Support**:
  - `synthetic` (default): Fast synthetic story generator.
  - `codebase`: Analysis of the local repository (primary eval corpus).
  - `sisyphus`: Import and retrieval of `.sisyphus/` traces.

---

## 3. Shared Fixtures & Corpus Strategy

To ensure fair comparison between candidates, the corpus generation and fixture storage are centralized.

### Corpus Management
- **Primary Generator**: `tests/memory-bench/generators/codebase-corpus.ts` (generates the main evaluation set).
- **Fixture Cache**: `tests/memory-bench/fixtures/` (standardized JSON files used as input).

### Retrieval Flow
1. **Generate/Load**: The canonical runner loads the selected fixture into memory.
2. **Ingest**: The candidate adapter under test ingests the entire corpus.
3. **Query**: The runner executes the query set against the candidate.
4. **Evaluate**: Results are scored (EM, F1, MRR, Latency) and written to the JSON artifact.

---

## 4. Evidence
- Inventory File: `task-5-runner-inventory.txt`
- Canonical Pointer: `task-5-canonical-entrypoint.txt`
