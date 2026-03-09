# Memory Architecture Evaluation Plan

## TL;DR

> **Quick Summary**: Run a research-first architecture evaluation to decide whether Wunderkind should stay with the current DIY baseline, supplement strong existing stores (`file`, `local-vec`) with a graph layer, or adopt an off-the-shelf graph/vector architecture.
>
> **Deliverables**:
> - Frozen candidate matrix and evaluation rubric
> - Deterministic benchmark suite for latest-truth, weak-seed, relationship traversal, and failure modes
> - Prototype comparison of shortlisted architectures
> - Decision memo recommending default, optional, and deferred paths
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Freeze rubric → build benchmark fixtures → prototype candidates → compare results → recommendation

---

## Context

### Clean-Base Start
The worktrees have been collapsed. All experimental work (graph/edge layer, local-vec, duckdb, composite adapter, memory-bench runners, consolidation pipeline) has been snapshotted as a WIP commit on the local `memory-redesign` branch (commit `2370981`) for historical reference and then the worktree was removed. The `wunderkind-overhaul` branch was also deleted.

**The evaluation now starts fresh from `main` in a single repo with no sibling-repo dependency.**

The "DIY baseline" candidate in this plan refers to the current `main` branch as-is (file, sqlite, local-vec, vector/Qdrant, mem0 adapters — all shipped production adapters). The in-progress graph prototype from the WIP snapshot is available for reference via `git show 2370981:<path>` but is NOT used as the baseline — the evaluation starts from the clean production baseline.

### Original Request
Evaluate alternatives to continuing the current in-repo graph prototype, including off-the-shelf graph/vector systems, Postgres-based approaches, and supplementing strong current stores like flat files or local-vec with a graph layer.

### Interview Summary
**Key Discussions**:
  - The `memory-redesign` branch (WIP snapshot, commit `2370981`) explored graph layers, duckdb, and composite adapters alongside further work on local-vec. Graph traversal worked structurally but did not improve weak-seed retrieval. The evaluation now starts from a clean `main` baseline which already includes all five adapters (file, sqlite, local-vec, vector, mem0).
  - Flat-file retrieval is exceptionally strong and may be worth keeping as a primary base store with a separate graph supplement.
  - `local-vec` is already shipped on `main` and is a strong semantic retrieval candidate; the evaluation asks whether adding a graph supplement layer on top improves it.
  - macOS sqlite hybrid/vector behavior must be treated as valid only when using Homebrew sqlite plus `sqliteLibPath`.
  - Research should come before more architectural commitment. The collapsed worktrees represent what was tried; this plan represents the structured evaluation of what to actually build.

**Research Findings**:
- Serious graph+vector candidates exist: Neo4j, Memgraph, FalkorDB, ArcadeDB, TigerGraph, Postgres + pgvector (+ optional AGE), and composite systems like Qdrant + graph DB.
- The current DIY graph layer is a lightweight SQLite adjacency store with JS BFS traversal and benchmark instrumentation, useful as a baseline but not yet differentiated.
- For this environment, the primary benchmark corpus should be a large synthetic **codebase-analysis knowledge corpus** (not raw code), with `.sisyphus` used as a secondary validation corpus when appropriate.

### Metis Review
**Identified Gaps** (addressed):
- Candidate set needed to be explicitly frozen — included below.
- Supplement-store architectures (`file + graph`, `local-vec + graph`) needed to be elevated to first-class candidates — included below.
- Phase-1 scope needed hard boundaries — defined under guardrails and must-NOT-have.
- Acceptance criteria needed to focus on reproducible artifacts, not subjective judgment — added in TODOs and verification strategy.

---

## Work Objectives

### Core Objective
Determine which memory architecture direction best serves Wunderkind’s real needs: latest-truth retrieval, weak-seed rescue, relationship traversal, explainability, and practical deployment — without prematurely committing to a production rewrite.

### Concrete Deliverables
- Frozen architecture candidate matrix
- Weighted decision rubric
- Shared benchmark harness and fixture set
- Consolidated performance/benchmark runner strategy
- Research log policy and `RESEARCH.md` update path
- Candidate prototype comparison results
- Recommendation memo with default / optional / deferred paths

### Definition of Done
- [ ] Candidate matrix is fixed and documented
- [ ] Benchmark suite covers strong seed, weak seed, latest truth, relationship traversal, and failure modes
- [ ] Each candidate has reproducible benchmark results and operational notes
- [ ] A decision memo names the recommended default architecture and the deferred alternatives
- [ ] Canonical benchmark runner strategy is documented and legacy runners are either consolidated or explicitly archived/retained
- [ ] `RESEARCH.md` is established as the canonical record of tried approaches, wins, failures, and reversions

### Must Have
- First-class evaluation of these candidates:
  - **DIY baseline** — the current production `main` branch adapters (file, sqlite, local-vec, vector/Qdrant, mem0) with no graph layer, evaluated as the clean starting point. All five are shipped and wired up in `src/memory/index.ts`.
  - flat-file + graph supplement (keep file adapter as primary store; add a graph layer on top)
  - local-vec + graph supplement (keep the existing `local-vec` adapter as the semantic base; add a graph supplement layer)
  - PostgreSQL + pgvector + relational edges
  - Qdrant + Memgraph
  - Qdrant + Neo4j (control/comparison candidate)
- Explicit macOS sqlite hybrid handling rule: Homebrew sqlite + `sqliteLibPath` only
- Deterministic benchmark artifacts

### Must NOT Have (Guardrails)
- No production migration in this phase
- No adapter replacement as part of evaluation
- No UI/config redesign
- No uncontrolled vendor sprawl beyond the frozen candidate set
- No nondeterministic systems used as primary scoring baselines
- No long-term findings trapped only in the root `README.md`
- No unexplained duplicated benchmark runners left behind after the evaluation

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — benchmark, fixture generation, and comparison must all be agent-executable.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after for evaluation harness and prototype adapters
- **Framework**: bun test + benchmark scripts

### QA Policy
Every evaluation task must produce machine-readable benchmark artifacts plus human-readable summaries.

- **Benchmark execution**: Bash (`bun test`, `bun run ...`)
- **Candidate environment setup**: Bash + Docker where required
- **Artifact verification**: read generated result files / summaries
- **Evidence location**: `.sisyphus/evidence/architecture-eval/`

### Required benchmark classes
- Strong-seed retrieval
- Weak-seed rescue
- Latest-truth / supersede win-rate
- Relationship traversal / support-chain retrieval
- Wrong-agent leakage
- Candidate degraded/unsupported-state reporting
- Large corpus coverage over several thousand analysis memories

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — evaluation foundation)
├── Task 1: Freeze candidate matrix and exclusions [writing]
├── Task 2: Define weighted decision rubric [writing]
├── Task 3: Define benchmark artifact format and evidence paths [quick]
├── Task 4: Freeze deterministic fixture families (large codebase-analysis corpus + latest-truth + optional `.sisyphus`) [deep]
├── Task 5: Define strong/weak/latest-truth query classes [deep]
└── Task 6: Define benchmark-runner consolidation and research-log policy [writing]

Wave 2 (After Wave 1 — benchmark hygiene and knowledge capture)
├── Task 7: Consolidate performance/benchmark runners into one canonical entry point [deep]
├── Task 8: Review historical plans and remove completed/stale plan files after capture [writing]
└── Task 9: Create and wire `RESEARCH.md` from benchmark/research learnings [writing]

Wave 3 (After Wave 2 — candidate prototypes, MAX PARALLEL)
├── Task 10: Prototype flat-file + graph supplement [deep]
├── Task 11: Prototype local-vec + graph supplement [deep]
├── Task 12: Prototype PostgreSQL + pgvector + edge tables [unspecified-high]
├── Task 13: Prototype Qdrant + Memgraph [unspecified-high]
└── Task 14: Prototype Qdrant + Neo4j control [unspecified-high]

Wave 4 (After Wave 3 — evaluation and recommendation)
└── Task 15: Run full benchmark matrix and write decision memo [writing]

Wave FINAL (After ALL tasks — independent review)
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Benchmark artifact integrity review (unspecified-high)
├── Task F3: Scope fidelity + no-creep review (deep)
└── Task F4: Recommendation quality review (oracle)
```

### Dependency Matrix

- **1-6**: foundation for all later work
- **7-9**: depend on 1-6; benchmark hygiene and knowledge-capture setup
- **10-14**: depend on 1-9; each candidate prototype can be evaluated independently once the shared harness, runner, and research-log policy are ready
- **15**: depends on 1-14; benchmark synthesis and recommendation
- **F1-F4**: depend on 15

### Agent Dispatch Summary

- **Wave 1**: writing/deep/quick mix — freeze scope and evaluation framework
- **Wave 2**: deep/writing — benchmark hygiene and knowledge capture
- **Wave 3**: deep/unspecified-high — isolated candidate prototypes
- **Wave 4**: writing — comparison and recommendation synthesis
- **FINAL**: oracle/deep — independent review

---

## TODOs

- [x] 1. Freeze architecture candidate matrix

  **What to do**:
  - Document the exact candidate set:
    - **DIY baseline** — current `main` branch production adapters: file (`src/memory/adapters/file.ts`), sqlite (`src/memory/adapters/sqlite.ts`), local-vec (`src/memory/adapters/local-vec.ts`), vector/Qdrant (`src/memory/adapters/vector.ts`), mem0 (`src/memory/adapters/mem0.ts`). No graph layer. This is the clean-slate starting point.
    - flat-file + graph supplement (keep file adapter as primary store; add a graph layer)
    - local-vec + graph supplement (keep the existing `local-vec` adapter as semantic base; add a graph supplement layer — distinct from the DIY baseline which has no graph layer)
    - PostgreSQL + pgvector + relational edges
    - Qdrant + Memgraph
    - Qdrant + Neo4j
  - Record exclusions/deferred systems (e.g. TigerGraph, FalkorDB, AGE-only path, DuckDB) to avoid scope creep.
  - Note that the WIP snapshot (commit `2370981`) is available for historical reference via `git show 2370981:<path>` but is NOT being used as the DIY baseline — the evaluation starts from clean `main`.

  **Must NOT do**:
  - Do not add more vendor candidates after this task without explicit change approval.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: scope freezing and architecture framing are documentation-heavy and require precision.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6-11
  - **Blocked By**: None

  **References**:
  - `src/memory/adapters/file.ts` — production file adapter (DIY baseline component)
  - `src/memory/adapters/sqlite.ts` — production sqlite adapter (DIY baseline component)
  - `src/memory/adapters/local-vec.ts` — production local-vec adapter (DIY baseline component; also the base for the local-vec + graph supplement candidate)
  - `src/memory/adapters/vector.ts` — production Qdrant adapter (DIY baseline component)
  - `src/memory/adapters/mem0.ts` — production mem0 adapter (DIY baseline component)
  - `src/memory/index.ts` — public memory API surface; shows how all 5 adapters are loaded
  - `git show 2370981:src/memory/edges.ts` — historical WIP graph layer for reference only (do NOT port directly; evaluate and rebuild properly)
  - `git show 2370981:tests/memory-bench/run-sisyphus-bench.ts` — historical WIP benchmark harness for reference only

  **Acceptance Criteria**:
  - [ ] Candidate matrix file/section created with exactly 6 candidates
  - [ ] Deferred/excluded candidate list documented

  **QA Scenarios**:
  ```
  Scenario: Candidate matrix completeness
    Tool: Bash
    Preconditions: evaluation doc exists
    Steps:
      1. Read the candidate matrix section
      2. Count listed candidates
      3. Assert all 6 required candidates appear by exact name
    Expected Result: All required candidates present, no extra uncontrolled candidates
    Evidence: .sisyphus/evidence/architecture-eval/task-1-candidate-matrix.txt

  Scenario: Scope exclusion clarity
    Tool: Bash
    Preconditions: evaluation doc exists
    Steps:
      1. Read deferred/excluded section
      2. Assert at least one explicit exclusion and one explicit deferment are documented
    Expected Result: Scope guardrails are explicit and binary
    Evidence: .sisyphus/evidence/architecture-eval/task-1-scope-exclusions.txt
  ```

- [x] 2. Define weighted decision rubric

  **What to do**:
  - Create weighted evaluation criteria including:
    - latest-truth win-rate
    - weak-seed rescue
    - relationship traversal quality
    - strong-seed preservation
    - wrong-agent isolation
    - operational complexity
    - Docker/self-host practicality
    - determinism/reproducibility
  - Define scoring weights and tie-break rules.

  **Must NOT do**:
  - Do not use vague criteria like “feels better”.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: rubric design is evaluative/spec-writing work.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 11
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Rubric lists all required criteria with explicit weights
  - [ ] Tie-break policy documented

  **QA Scenarios**:
  ```
  Scenario: Rubric weight sanity
    Tool: Bash
    Preconditions: rubric exists
    Steps:
      1. Read all weighted criteria
      2. Sum weights
      3. Assert total equals 100
    Expected Result: Weight total is exactly 100
    Evidence: .sisyphus/evidence/architecture-eval/task-2-rubric-weights.txt

  Scenario: Weak-seed priority present
    Tool: Bash
    Preconditions: rubric exists
    Steps:
      1. Read criteria names
      2. Assert weak-seed rescue is present as its own criterion
    Expected Result: Weak-seed rescue explicitly represented
    Evidence: .sisyphus/evidence/architecture-eval/task-2-weak-seed-criterion.txt
  ```

- [x] 3. Freeze deterministic fixture families and artifact format

  **What to do**:
  - Freeze the benchmark fixture families:
    - synthetic multi-thousand-memory **codebase-analysis corpus** (primary)
    - latest-truth temporal corpus
    - optional `.sisyphus` validation corpus
  - Define machine-readable output artifact format for all candidates.

  **Must NOT do**:
  - Do not let each candidate invent its own benchmark format.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: benchmark design drives validity of all later comparisons.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6-11
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Fixture families documented and frozen
  - [ ] Artifact schema documented and example provided

  **QA Scenarios**:
  ```
  Scenario: Fixture family freeze
    Tool: Bash
    Preconditions: benchmark spec exists
    Steps:
      1. Read fixture section
      2. Assert the primary corpus is a synthetic codebase-analysis corpus
      3. Assert latest-truth is present
      4. Assert `.sisyphus` is labeled optional validation only
    Expected Result: Primary vs optional datasets are unambiguous
    Evidence: .sisyphus/evidence/architecture-eval/task-3-fixture-freeze.txt

  Scenario: Artifact schema completeness
    Tool: Bash
    Preconditions: artifact schema documented
    Steps:
      1. Read artifact field list
      2. Assert it includes candidate, dataset, metrics, environment, degraded/skipped status
    Expected Result: Artifact format supports fair comparisons
    Evidence: .sisyphus/evidence/architecture-eval/task-3-artifact-schema.txt
  ```

- [x] 4. Create primary synthetic codebase-analysis corpus design

  **What to do**:
  - Define a synthetic corpus representing analysis of a codebase and its structure/knowledge rather than raw code.
  - Require several thousand memories spanning:
    - modules/services/components
    - ownership
    - dependencies
    - ADR-style decisions
    - known issues
    - risks
    - historical changes
    - evidence/support records
    - contradictions and superseded analysis
    - support chains and cross-module relationships
  - Ensure the corpus has dense inter-relationships and meaningful weak-seed cases.

  **Must NOT do**:
  - Do not use raw code chunks as the primary benchmark payload.
  - Do not create a toy corpus with only dozens or low hundreds of memories.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6-11
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Corpus spec requires several thousand memories
  - [ ] Corpus includes explicit relationship classes and superseded analysis
  - [ ] Corpus models codebase analysis, not raw code storage

  **QA Scenarios**:
  ```
  Scenario: Corpus scale requirement
    Tool: Bash
    Preconditions: corpus spec exists
    Steps:
      1. Read corpus generation section
      2. Assert target scale is several thousand memories or greater
    Expected Result: Benchmark corpus is large enough to be meaningful
    Evidence: .sisyphus/evidence/architecture-eval/task-4-corpus-scale.txt

  Scenario: Analysis-not-code requirement
    Tool: Bash
    Preconditions: corpus spec exists
    Steps:
      1. Read corpus content model
      2. Assert primary payloads are analysis artifacts (decisions, dependencies, risks, module knowledge)
      3. Assert raw code is not the primary benchmark unit
    Expected Result: Corpus matches intended knowledge model
    Evidence: .sisyphus/evidence/architecture-eval/task-4-analysis-corpus.txt
  ```

- [x] 5. Define benchmark-runner consolidation strategy

  **What to do**:
  - Inventory the overlapping benchmark/perf runners within this repo.
  - The WIP snapshot (commit `2370981`) contained many runners (`run-bench.ts`, `run-sisyphus-bench.ts`, `run-conversational-bench.ts`, `run-latest-truth-bench.ts`, `stress-all-adapters.ts`). Since we start clean from `main`, choose which of these to carry forward and implement from scratch or port from the WIP snapshot via `git show 2370981:<path>`.
  - Current `main` has only `tests/memory-bench/run-bench.ts` and `tests/perf/adapter-benchmark.ts` — determine if these are the canonical entry points or if they need to be replaced/extended.
  - Choose one canonical performance/benchmark entry point for ongoing use.
  - Document each runner's disposition: implement fresh, port from WIP branch, replace, or archive.
  - Define how shared fixtures/corpus files will be centralized.

  **Must NOT do**:
  - Do not leave multiple overlapping runners without an explicit long-term purpose.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6-15
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Canonical runner strategy documented
  - [ ] Every overlapping runner has an explicit disposition

  **QA Scenarios**:
  ```
  Scenario: Runner inventory completeness
    Tool: Bash
    Preconditions: runner consolidation section exists
    Steps:
      1. Read the runner inventory
      2. Assert it covers all benchmark runners in this repo (tests/memory-bench/ and tests/perf/)
      3. Assert each runner has a disposition (implement, port, replace, or archive)
    Expected Result: No runner is left in an ambiguous state
    Evidence: .sisyphus/evidence/architecture-eval/task-5-runner-inventory.txt

  Scenario: Single entry-point rule
    Tool: Bash
    Preconditions: runner consolidation section exists
    Steps:
      1. Read the strategy
      2. Assert one canonical benchmark entry point is named
    Expected Result: Ongoing performance testing has one obvious launch path
    Evidence: .sisyphus/evidence/architecture-eval/task-5-canonical-entrypoint.txt
  ```

- [x] 6. Define `RESEARCH.md` knowledge-capture policy

  **What to do**:
  - Define `RESEARCH.md` as the durable home for findings too volatile or historical for the root README.
  - Require it to capture things tried, things working, things not working, things backed out and why, environment limits, and candidates to revisit.
  - Require `README.md` and `AGENTS.md` to point to `RESEARCH.md`.
  - The first entries in `RESEARCH.md` must include:
    - mem0 low-memory struggles (8GB machines; may revisit once feature set is confirmed)
    - The WIP snapshot findings (commit `2370981`): graph layer prototype worked structurally but did NOT improve weak-seed retrieval; local-vec, duckdb, composite adapters were explored but not shipped; inspect via `git show 2370981:<path>` for reference
    - macOS sqlite hybrid validity rule (Homebrew sqlite + `sqliteLibPath` only)

  **Must NOT do**:
  - Do not keep experimental findings only in README benchmark prose.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7-15
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `RESEARCH.md` policy documented
  - [ ] README/AGENTS linkage rule documented
  - [ ] mem0 low-memory limitations are cited as an example of required logging

  **QA Scenarios**:
  ```
  Scenario: Research-log policy completeness
    Tool: Bash
    Preconditions: RESEARCH policy section exists
    Steps:
      1. Read the policy
      2. Assert it includes tried/worked/failed/backed-out categories
      3. Assert mem0 low-memory limitations are named as an example
    Expected Result: Historical findings have a clear durable home
    Evidence: .sisyphus/evidence/architecture-eval/task-6-research-policy.txt

  Scenario: README and AGENTS linkage rule
    Tool: Bash
    Preconditions: RESEARCH policy section exists
    Steps:
      1. Read the policy
      2. Assert it requires references from README.md and AGENTS.md to RESEARCH.md
    Expected Result: Research-log discoverability is enforced
    Evidence: .sisyphus/evidence/architecture-eval/task-6-linkage-rule.txt
  ```

- [x] 7. Review historical plans and remove completed/stale plan files after capture

  **What to do**:
  - Review all `.sisyphus/plans/` files that exist by the end of this evaluation work.
  - Confirm that completed plans have their useful conclusions captured in `RESEARCH.md`, the recommendation memo, or benchmark evidence before deletion.
  - Remove completed/stale plans only after capture.

  **Must NOT do**:
  - Do not delete any plan that still contains unique uncaptured reasoning or unfinished scope.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 15
  - **Blocked By**: 1-6

  **Acceptance Criteria**:
  - [ ] Plan inventory reviewed
  - [ ] Each removed plan has an explicit capture destination recorded

  **QA Scenarios**:
  ```
  Scenario: Plan cleanup safety
    Tool: Bash
    Preconditions: plan inventory exists
    Steps:
      1. List `.sisyphus/plans/` contents
      2. For each removed/completed plan, verify a capture destination is documented
      3. Assert no active plan was deleted without replacement evidence
    Expected Result: Plan cleanup is lossless and intentional
    Evidence: .sisyphus/evidence/architecture-eval/task-7-plan-cleanup.txt
  ```

- [x] 8. Add benchmark metrics that isolate graph value

  **What to do**:
  - Add/confirm metrics for:
    - weak-seed hit@1
    - graph weak-seed hit@1
    - gold-in-expanded-neighborhood coverage
    - chain hit@3
    - supersede win-rate
    - wrong-agent leakage
  - Ensure each metric is emitted per candidate.

  **Must NOT do**:
  - Do not mix graph coverage and final ranking into one opaque metric.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 10-15
  - **Blocked By**: 1-7

  **Acceptance Criteria**:
  - [ ] Graph coverage metric exists separately from hit@1
  - [ ] All required metrics appear in benchmark summary output

  **QA Scenarios**:
  ```
  Scenario: Graph coverage metric present
    Tool: Bash
    Preconditions: benchmark runner implemented
    Steps:
      1. Run benchmark in dry/default mode
      2. Inspect output fields
      3. Assert coverage and ranking metrics are separate columns
    Expected Result: Graph effect is measurable without ambiguity
    Evidence: .sisyphus/evidence/architecture-eval/task-8-graph-metrics.txt

  Scenario: Weak-seed slice reported
    Tool: Bash
    Preconditions: benchmark runner implemented
    Steps:
      1. Run benchmark
      2. Assert weak-seed baseline and graph-assisted metrics both appear
    Expected Result: Weak-seed behavior is isolated
    Evidence: .sisyphus/evidence/architecture-eval/task-8-weak-seed-slice.txt
  ```

- [x] 9. Create and wire `RESEARCH.md`

  **What to do**:
  - Create `RESEARCH.md` in the repo root as the canonical durable record for architecture and memory findings.
  - Populate the initial entries with:
    - The WIP snapshot findings (commit `2370981`): graph layer prototype built but did not improve weak-seed retrieval; local-vec, duckdb, and composite adapters explored but not shipped
    - mem0 low-memory limitations: struggles on 8GB machines; may revisit once feature set is better understood
    - macOS sqlite hybrid validity rule: only valid with Homebrew sqlite + `sqliteLibPath`; FTS-only fallback does not count as hybrid/vector result
  - Add a brief reference to `RESEARCH.md` in the root `README.md` and in `AGENTS.md` so it is discoverable.
  - Define clear sections in `RESEARCH.md`: **Tried & Worked**, **Tried & Backed Out** (with rationale), **Environmental Constraints**, **Candidates to Revisit**.

  **Must NOT do**:
  - Do not move existing benchmark performance tables out of `README.md` — only the historical/experimental findings log lives in `RESEARCH.md`.
  - Do not delete any existing `README.md` or `AGENTS.md` content.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: this is documentation creation and cross-linking work.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 7, Task 8)
  - **Blocks**: 10-15
  - **Blocked By**: 1-6

  **References**:
  - `README.md` — root readme; add a short `## Research Log` section pointing to `RESEARCH.md`
  - `AGENTS.md` — project knowledge base; add a `RESEARCH.md` entry under the `WHERE TO LOOK` table
  - `git show 2370981:src/memory/edges.ts` — reference for WIP graph findings to document
  - `git show 2370981:README.md` — historical benchmark notes from WIP phase for context

  **Acceptance Criteria**:
  - [ ] `RESEARCH.md` exists at repo root
  - [ ] `RESEARCH.md` contains the four required sections: Tried & Worked, Tried & Backed Out, Environmental Constraints, Candidates to Revisit
  - [ ] The three required initial entries (WIP snapshot findings, mem0 low-memory, macOS sqlite rule) are present
  - [ ] `README.md` references `RESEARCH.md`
  - [ ] `AGENTS.md` `WHERE TO LOOK` table references `RESEARCH.md`

  **QA Scenarios**:
  ```
  Scenario: RESEARCH.md structure and content
    Tool: Bash
    Preconditions: RESEARCH.md created at repo root
    Steps:
      1. Run: ls RESEARCH.md (assert exit 0)
      2. Assert file contains "Tried & Worked" section heading
      3. Assert file contains "Tried & Backed Out" section heading
      4. Assert file contains "mem0" and "8GB" as part of the backed-out entry
      5. Assert file contains the commit hash "2370981" in the WIP snapshot entry
    Expected Result: All required sections and seed entries are present
    Evidence: .sisyphus/evidence/architecture-eval/task-9-research-md.txt

  Scenario: Cross-linking completeness
    Tool: Bash
    Preconditions: README.md and AGENTS.md updated
    Steps:
      1. grep -i "RESEARCH.md" README.md — assert match found
      2. grep -i "RESEARCH.md" AGENTS.md — assert match found
    Expected Result: RESEARCH.md is discoverable from both root docs
    Evidence: .sisyphus/evidence/architecture-eval/task-9-cross-links.txt
  ```

  **Commit**: YES (groups with Task 7)
  - Message: `docs: add RESEARCH.md with initial findings and cross-link from README and AGENTS`
  - Files: `RESEARCH.md`, `README.md`, `AGENTS.md`

- [x] 10. Prototype flat-file + graph supplement

  **What to do**:
  - Define and implement the evaluation prototype where flat files remain the primary memory store and a graph layer supplements relationship traversal.
  - Measure whether this combination preserves flat-file speed/precision while improving connected-memory answers.

  **Must NOT do**:
  - Do not replace flat files as the base store in this candidate.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15
  - **Blocked By**: 1-9

  **Acceptance Criteria**:
  - [ ] Candidate runs through the shared benchmark harness
  - [ ] Output includes supported/degraded state and all benchmark metrics

  **QA Scenarios**:
  ```
  Scenario: Flat-file supplement candidate runs
    Tool: Bash
    Preconditions: candidate prototype available
    Steps:
      1. Run shared benchmark with candidate selected
      2. Assert summary output is produced
    Expected Result: Candidate benchmark completes successfully
    Evidence: .sisyphus/evidence/architecture-eval/task-10-flatfile-graph-run.txt

  Scenario: Strong-query preservation
    Tool: Bash
    Preconditions: candidate benchmark completed
    Steps:
      1. Compare strong-query baseline vs candidate strong-query hit@1
      2. Assert candidate does not materially degrade strong-query results per rubric threshold
    Expected Result: Graph supplement does not destroy the file store’s core strength
    Evidence: .sisyphus/evidence/architecture-eval/task-10-strong-query-preservation.txt
  ```

- [x] 11. Prototype local-vec + graph supplement

  **What to do**:
  - Keep the existing `local-vec` adapter (`src/memory/adapters/local-vec.ts`) as the base semantic retrieval layer and add graph supplementation on top.
  - Evaluate whether this combination rescues weak seeds better than local-vec alone (the no-graph DIY baseline).
  - The WIP snapshot (commit `2370981`) explored an earlier version of local-vec with additional graph/edge work; use as reference via `git show 2370981:src/memory/adapters/local-vec.ts` but build the candidate cleanly on top of the current shipped `main` version.

  **Must NOT do**:
  - Do not replace `local-vec` with another local vector engine in phase 1.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15
  - **Blocked By**: 1-9

  **Acceptance Criteria**:
  - [ ] Candidate runs through shared benchmark harness
  - [ ] Weak-seed metrics are reported side-by-side with baseline

  **QA Scenarios**:
  ```
  Scenario: Local-vec supplement candidate runs
    Tool: Bash
    Preconditions: candidate prototype available
    Steps:
      1. Run shared benchmark with candidate selected
      2. Assert summary output includes local-vec + graph metrics
    Expected Result: Candidate benchmark completes successfully
    Evidence: .sisyphus/evidence/architecture-eval/task-11-localvec-graph-run.txt

  Scenario: Weak-seed comparison available
    Tool: Bash
    Preconditions: candidate benchmark completed
    Steps:
      1. Inspect benchmark output
      2. Assert weak-seed baseline and supplemented metrics are both present
    Expected Result: Candidate can be compared fairly against local-vec baseline
    Evidence: .sisyphus/evidence/architecture-eval/task-11-weak-seed-compare.txt
  ```

- [x] 12. Prototype PostgreSQL + pgvector + edge tables

  **What to do**:
  - Build a minimal evaluation prototype using Postgres for both vector and relational edge storage.
  - Keep graph capability limited to recursive edge-table traversal for phase 1.

  **Must NOT do**:
  - Do not pull in Apache AGE unless the phase-1 Postgres edge-table path proves insufficient and is explicitly promoted.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15
  - **Blocked By**: 1-9

  **Acceptance Criteria**:
  - [ ] Dockerized Postgres candidate runs through shared benchmark harness
  - [ ] Vector + edge traversal behavior is measurable in the shared output schema

  **QA Scenarios**:
  ```
  Scenario: Postgres candidate boots and benchmarks
    Tool: Bash
    Preconditions: Docker available
    Steps:
      1. Start candidate stack
      2. Run shared benchmark
      3. Assert benchmark artifacts are emitted
    Expected Result: Candidate produces comparable results
    Evidence: .sisyphus/evidence/architecture-eval/task-12-postgres-run.txt

  Scenario: Single-store consistency check
    Tool: Bash
    Preconditions: candidate benchmark completed
    Steps:
      1. Inspect latest-truth and relationship metrics
      2. Confirm candidate supports both without cross-store sync drift artifacts
    Expected Result: Single-store architecture can be judged fairly
    Evidence: .sisyphus/evidence/architecture-eval/task-12-consistency-check.txt
  ```

- [x] 13. Prototype Qdrant + Memgraph

  **What to do**:
  - Implement a Dockerized Qdrant + Memgraph candidate.
  - Use Qdrant for semantic seed retrieval and Memgraph for neighborhood traversal and support-chain queries.

  **Must NOT do**:
  - Do not add unrelated graph algorithms outside the benchmark query set.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15
  - **Blocked By**: 1-9

  **Acceptance Criteria**:
  - [ ] Candidate stack runs under Docker
  - [ ] Shared benchmark emits comparable metrics and operational notes

  **QA Scenarios**:
  ```
  Scenario: Qdrant + Memgraph candidate runs
    Tool: Bash
    Preconditions: Docker available
    Steps:
      1. Start Qdrant + Memgraph stack
      2. Run shared benchmark
      3. Assert results are produced with all required metrics
    Expected Result: Candidate is benchmarkable and reproducible
    Evidence: .sisyphus/evidence/architecture-eval/task-13-qdrant-memgraph-run.txt

  Scenario: Relationship traversal validation
    Tool: Bash
    Preconditions: candidate benchmark completed
    Steps:
      1. Inspect chain/relationship metrics
      2. Assert support-chain queries return measurable results
    Expected Result: Graph side is functionally exercised
    Evidence: .sisyphus/evidence/architecture-eval/task-13-relationship-validation.txt
  ```

- [x] 14. Prototype Qdrant + Neo4j control

  **What to do**:
  - Implement a comparison candidate using Qdrant for vector retrieval and Neo4j for graph traversal.
  - Use as a mature graph/vector control candidate.

  **Must NOT do**:
  - Do not expand scope into enterprise-only clustering or cloud deployment.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15
  - **Blocked By**: 1-9

  **Acceptance Criteria**:
  - [ ] Candidate stack runs and emits benchmark metrics
  - [ ] Neo4j traversal path is exercised in relationship benchmarks

  **QA Scenarios**:
  ```
  Scenario: Qdrant + Neo4j control runs
    Tool: Bash
    Preconditions: Docker available
    Steps:
      1. Start Qdrant + Neo4j stack
      2. Run shared benchmark
      3. Assert summary output and evidence artifacts exist
    Expected Result: Control candidate is comparable with other candidates
    Evidence: .sisyphus/evidence/architecture-eval/task-14-qdrant-neo4j-run.txt

  Scenario: Path-oriented graph query exercised
    Tool: Bash
    Preconditions: candidate benchmark completed
    Steps:
      1. Inspect relationship/path case outputs
      2. Assert the graph side contributes measurable traversal output
    Expected Result: Graph traversal is actually tested, not just provisioned
    Evidence: .sisyphus/evidence/architecture-eval/task-14-path-query-validation.txt
  ```

- [x] 15. Run benchmark matrix and write decision memo

  **What to do**:
  - Run all candidates against the same frozen benchmark suite.
  - Produce machine-readable result artifacts and a comparison memo naming:
    - recommended default
    - optional advanced path
    - deferred/avoid paths

  **Must NOT do**:
  - Do not change fixtures or scoring while candidate results are being compared.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential synthesis
  - **Blocks**: Final verification wave
  - **Blocked By**: 1-14

  **Acceptance Criteria**:
  - [ ] One comparison table covers all candidates and all rubric criteria
  - [ ] Recommendation memo identifies default / optional / deferred directions

  **QA Scenarios**:
  ```
  Scenario: Benchmark matrix completeness
    Tool: Bash
    Preconditions: all candidates benchmarked
    Steps:
      1. Read final comparison artifact
      2. Assert each frozen candidate appears with metric values or explicit degraded/unsupported status
    Expected Result: No candidate is silently omitted
    Evidence: .sisyphus/evidence/architecture-eval/task-15-matrix-completeness.txt

  Scenario: Recommendation memo structure
    Tool: Bash
    Preconditions: recommendation memo exists
    Steps:
      1. Read memo
      2. Assert it contains default, optional, and deferred sections
      3. Assert rationale references benchmark evidence
    Expected Result: Recommendation is evidence-backed and actionable
    Evidence: .sisyphus/evidence/architecture-eval/task-15-recommendation-memo.txt
  ```

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Verify candidate set, rubric, fixture families, and recommendation outputs all match this plan.

  **QA Scenarios**:
  ```
  Scenario: Candidate and rubric compliance
    Tool: Bash
    Preconditions: final benchmark matrix and recommendation memo exist
    Steps:
      1. Read the final matrix and memo
      2. Assert all 6 frozen candidates appear
      3. Assert the rubric criteria named in the plan are the ones used in the comparison
    Expected Result: Output matches the frozen scope and rubric
    Evidence: .sisyphus/evidence/architecture-eval/f1-plan-compliance.txt
  ```

- [x] F2. **Benchmark Artifact Integrity Review** — `unspecified-high`
  Confirm all result artifacts are present, machine-readable, and comparable across candidates.

  **QA Scenarios**:
  ```
  Scenario: Artifact completeness and parseability
    Tool: Bash
    Preconditions: benchmark artifacts exist
    Steps:
      1. Enumerate result artifacts for each candidate and dataset
      2. Assert each artifact file exists
      3. Validate each artifact can be parsed as the documented schema
    Expected Result: No missing or malformed benchmark artifacts
    Evidence: .sisyphus/evidence/architecture-eval/f2-artifact-integrity.txt
  ```

- [x] F3. **Scope Fidelity Check** — `deep`
  Ensure the work stayed in evaluation/prototyping scope and did not drift into production migration.

  **QA Scenarios**:
  ```
  Scenario: No production-migration creep
    Tool: Bash
    Preconditions: candidate prototype branches/files exist
    Steps:
      1. Inspect changed files / produced artifacts
      2. Assert outputs are limited to fixtures, harnesses, prototypes, and decision docs
      3. Assert no production default architecture was switched in this phase
    Expected Result: Work stayed within evaluation scope
    Evidence: .sisyphus/evidence/architecture-eval/f3-scope-fidelity.txt
  ```

- [x] F4. **Recommendation Quality Review** — `oracle`
  Check that the final memo names a clear default path and explicit deferrals grounded in evidence.

  **QA Scenarios**:
  ```
  Scenario: Recommendation memo decision quality
    Tool: Bash
    Preconditions: final recommendation memo exists
    Steps:
      1. Read the memo
      2. Assert it contains default, optional, and deferred sections
      3. Assert each recommendation cites benchmark evidence and operational reasoning
    Expected Result: Recommendation is explicit, evidence-backed, and actionable
    Evidence: .sisyphus/evidence/architecture-eval/f4-recommendation-quality.txt
  ```

---

## Commit Strategy

- **1**: `docs(eval): freeze architecture candidate matrix`
- **2**: `test(bench): add deterministic fixtures and graph metrics`
- **3**: `feat(spike): prototype flat-file graph supplement`
- **4**: `feat(spike): prototype local-vec graph supplement`
- **5**: `feat(spike): prototype postgres pgvector edge candidate`
- **6**: `feat(spike): prototype qdrant memgraph candidate`
- **7**: `feat(spike): prototype qdrant neo4j control`
- **8**: `docs(decision): add architecture comparison memo`

---

## Success Criteria

### Verification Commands
```bash
tsc --noEmit
bun test
bun run build
# candidate-specific benchmark commands to be frozen in the harness spec
```

### Final Checklist
- [ ] Candidate matrix frozen
- [ ] Benchmark fixtures frozen
- [ ] Shared result schema used by all candidates
- [ ] All candidates evaluated or explicitly marked degraded/unsupported
- [ ] Recommendation memo names default / optional / deferred paths
