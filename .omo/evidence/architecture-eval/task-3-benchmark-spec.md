# Benchmark Specification — Frozen Fixtures & Artifact Format

This document freezes the benchmark fixture families and machine-readable result artifact for the memory-architecture-evaluation plan. Every prototype candidate from Tasks 10-14 MUST implement against this specification exactly; candidate-specific corpus design or result formats are not allowed.

## Scope

- Applies to all frozen candidates in `task-1-candidate-matrix.md`.
- Produces evidence for the rubric in `task-2-decision-rubric.md`.
- Replaces the smaller ad hoc corpus patterns currently visible in `tests/memory-bench/run-bench.ts`, `tests/memory-bench/generators/story-generator.ts`, `tests/perf/adapter-benchmark.ts`, and `tests/perf/corpus.ts`.
- Existing runners are useful structural references, but their current synthetic story corpus and small thematic perf corpus are NOT the authoritative evaluation dataset for architecture selection.

## Frozen Fixture Families

### 1. Primary (REQUIRED): Synthetic codebase-analysis corpus

**Dataset ID:** `primary-synthetic-codebase-analysis`

This is the primary scoring corpus for all candidates.

#### Required scale

- Target size: **3,000-5,000 memories**
- Recommended default: **4,000 memories**
- Deterministic generation with a fixed seed
- Same generated corpus and same query set must be reused across all candidates

#### Required content shape

Primary payloads MUST be **analysis artifacts about a codebase**, not raw code chunks. Allowed memory families include:

- module ownership assignments
- ADR summaries and follow-on decisions
- dependency maps and support chains
- known issues and incident notes
- security findings and mitigations
- operational risks and rollout constraints
- change history summaries
- runbook references
- service boundaries and integration contracts

#### Prohibited primary payloads

- raw source files
- tokenized source snippets
- embeddings of code chunks presented as the main benchmark fixture
- `.sisyphus` notes as the main benchmark fixture

#### Required structure inside the corpus

The corpus MUST encode dense relationships such that retrieval can require chained reasoning. Example relationship patterns:

- module `auth-web` -> owned by `identity-platform`
- `identity-platform` -> has security finding `SEC-142`
- `SEC-142` -> references ADR `ADR-42`
- `ADR-42` -> superseded legacy JWT handling
- rollout note -> references owning team and dependency risk

#### Required sub-suites inside the primary corpus

1. **Strong-seed exact cases**
   - Exact and keyword-heavy queries
   - Used to score `hit_at_1_exact`

2. **Weak-seed rescue cases**
   - Query phrasing MUST deliberately differ from stored vocabulary
   - Synonymic, conceptual, role-based, or support-chain phrasing
   - Used to score `hit_at_10_semantic`

3. **Relationship traversal cases**
   - At least 2-hop retrieval paths
   - Used to score `hop_success_rate`
   - Non-graph candidates may report `null` and mark graph gap through degraded handling only when applicable

4. **Superseded / contradiction cases**
   - Old and new memories about the same concept must coexist
   - Example: old memory says auth uses JWT; newer memory says auth now uses sessions
   - Used to support recency scoring alongside the temporal corpus

5. **Wrong-agent contamination set**
   - Seed memories across at least 2 agents
   - Query suite for Agent A MUST not retrieve Agent B memories
   - Used to score `cross_agent_leak_count`

#### Minimum composition requirements

- At least **15%** of scored primary queries must be weak-seed rescue cases
- At least **10%** must be contradiction/latest-truth cases
- At least **10%** must be relationship traversal cases
- At least **2 agents** must be used for cross-agent isolation checks
- At least **1 contamination set per agent pair** in the benchmark run

### 2. Secondary (REQUIRED): Latest-truth temporal corpus

**Dataset ID:** `secondary-latest-truth-temporal`

This corpus isolates recency behavior so latest-truth scoring is deterministic and easy to compare.

#### Required scale

- **200-500 memories**
- Recommended default: **300 memories**

#### Required structure

- Contradictory memory pairs with known timestamps
- Each query has an unambiguous newest correct answer
- Timestamp ordering MUST be deterministic and preserved in fixture materialization
- Contradiction families should cover architectural decisions, ownership changes, policy changes, and operational status changes

#### Primary metric supported

- `hit_at_1_recency`

This corpus exists to prevent candidates from hiding recency failures inside a broader semantic benchmark.

### 3. Optional (SANITY CHECK ONLY): `.sisyphus` validation corpus

**Dataset ID:** `optional-sisyphus-validation`

This dataset is optional and MUST be labeled as a non-primary validation pass.

#### Allowed source material

- `.sisyphus/notepads/`
- `.sisyphus/plans/`

#### Constraints

- Use for **sanity check only**
- MUST NOT be part of primary scoring or candidate ranking
- MUST NOT replace the synthetic codebase-analysis corpus
- Results from this dataset should be reported separately from the required benchmark score artifacts if used at all

## Dataset Materialization Rules

All candidates MUST implement the same frozen fixture contract:

1. Identical dataset IDs
2. Identical generator seed(s)
3. Identical memory contents for a given dataset version
4. Identical query sets and expected relevance judgments
5. Identical agent partitioning for contamination checks
6. Identical timestamp ordering for recency checks

The benchmark harness may be implemented differently per candidate, but the fixtures, expectations, and emitted artifact schema may not vary.

## Query/Scoring Alignment

The current benchmark code offers useful precedents:

- `tests/memory-bench/generators/story-generator.ts` shows deterministic generation and explicit test-case typing
- `tests/memory-bench/harness/score.ts` shows normalization and exact/token scoring patterns
- `tests/perf/adapter-benchmark.ts` shows operational timing measurement and repeated scenario execution
- `tests/perf/corpus.ts` shows cluster-based synthetic generation, but is too small and too generic for the architecture decision

The frozen benchmark must evolve those ideas into rubric-aligned scoring:

| Rubric metric | Meaning in frozen benchmark |
|---|---|
| `hit_at_1_recency` | newest correct memory is rank #1 on contradiction queries |
| `hit_at_10_semantic` | at least one relevant weak-seed target appears within top 10, aggregated as hit rate |
| `hit_at_1_exact` | exact/strong-seed target is rank #1 |
| `hop_success_rate` | correct 2-hop target is returned for traversal queries |
| `cross_agent_leak_count` | count of returned memories belonging to the wrong agent |
| `install_steps` | setup actions required before benchmark run |
| `min_ram_mb` | minimum observed or documented RAM requirement to run the candidate locally |
| `result_variance` | standard deviation across 10 repeated identical runs |
| `p50_write_ms` | median single-write or fixture-ingest write latency |
| `p50_search_ms` | median query latency |

## Degraded / Skipped Policy

To keep the schema fair across graph and non-graph candidates:

- `degraded = true` means the candidate ran, but could not fully support the dataset or metric set
- `degraded_reason` MUST explain the limitation concretely
- `skipped = true` means the candidate did not run that dataset at all
- `skipped_reason` MUST explain why

Rules:

- A non-graph candidate may set `metrics.hop_success_rate` to `null`
- If relationship traversal is a required portion of the dataset and the candidate cannot support it, the artifact MUST set `degraded = true`
- A candidate that fails environment setup may set `skipped = true`
- `degraded` and `skipped` MUST NOT both be `true`

## Machine-Readable Artifact Schema (REQUIRED)

Every candidate MUST emit a JSON artifact per dataset run with the following shape.

```json
{
  "candidate": "string",
  "dataset": "string",
  "timestamp": "ISO-8601 string",
  "environment": {
    "os": "string",
    "arch": "string",
    "runtime": "string",
    "external_services": ["string"]
  },
  "metrics": {
    "hit_at_1_recency": 0.0,
    "hit_at_10_semantic": 0.0,
    "hit_at_1_exact": 0.0,
    "hop_success_rate": 0.0,
    "cross_agent_leak_count": 0,
    "install_steps": 0,
    "min_ram_mb": 0,
    "result_variance": 0.0,
    "p50_write_ms": 0.0,
    "p50_search_ms": 0.0
  },
  "degraded": false,
  "degraded_reason": null,
  "skipped": false,
  "skipped_reason": null
}
```

### Field rules

- `candidate`: stringified candidate ID from the frozen matrix (`"1"` through `"6"`)
- `dataset`: one of the frozen dataset IDs in this spec
- `timestamp`: artifact creation time in ISO 8601 UTC form
- `environment.os`: host operating system
- `environment.arch`: CPU architecture
- `environment.runtime`: runtime + version used to execute the benchmark
- `environment.external_services`: required backing services actually used in the run, empty array if none
- `metrics.hit_at_1_recency`: float in `[0,1]`
- `metrics.hit_at_10_semantic`: float in `[0,1]`
- `metrics.hit_at_1_exact`: float in `[0,1]`
- `metrics.hop_success_rate`: float in `[0,1]` or `null` if no graph layer
- `metrics.cross_agent_leak_count`: integer `>= 0`
- `metrics.install_steps`: integer `>= 0`
- `metrics.min_ram_mb`: integer `>= 0`
- `metrics.result_variance`: float `>= 0`, measured as stddev across 10 runs
- `metrics.p50_write_ms`: float `>= 0`
- `metrics.p50_search_ms`: float `>= 0`
- `degraded_reason`: required when `degraded = true`, else `null`
- `skipped_reason`: required when `skipped = true`, else `null`

## Example Artifact (DIY Baseline)

```json
{
  "candidate": "1",
  "dataset": "primary-synthetic-codebase-analysis",
  "timestamp": "2026-03-09T12:00:00.000Z",
  "environment": {
    "os": "macOS",
    "arch": "arm64",
    "runtime": "bun 1.x",
    "external_services": []
  },
  "metrics": {
    "hit_at_1_recency": 0.71,
    "hit_at_10_semantic": 0.42,
    "hit_at_1_exact": 0.97,
    "hop_success_rate": null,
    "cross_agent_leak_count": 0,
    "install_steps": 0,
    "min_ram_mb": 220,
    "result_variance": 0.01,
    "p50_write_ms": 4.8,
    "p50_search_ms": 2.1
  },
  "degraded": true,
  "degraded_reason": "DIY baseline has no graph layer, so required relationship traversal cases cannot be executed as native hop retrieval.",
  "skipped": false,
  "skipped_reason": null
}
```

## Enforcement Notes For Tasks 10-14

- No candidate may invent a custom dataset family.
- No candidate may invent a custom JSON result shape.
- No candidate may downgrade the primary corpus to a tiny sample.
- No candidate may substitute raw code chunks for analysis-artifact memories.
- `.sisyphus` material is optional validation only.

## Freeze Summary

The benchmark is frozen as:

- **Primary scoring corpus:** synthetic codebase-analysis knowledge, several thousand memories
- **Secondary scoring corpus:** latest-truth temporal contradiction set
- **Optional validation corpus:** `.sisyphus` only, explicitly non-primary
- **Artifact contract:** one JSON artifact per candidate per dataset, using the required schema above
