# Memory Architecture Decision Rubric

This rubric defines the scoring criteria for evaluating the 6 memory architecture candidates for Wunderkind. It prioritizes retrieval quality for developers while maintaining operational simplicity for local-first tooling.

## Scoring Overview

| Criterion | Weight | Category |
|-----------|--------|----------|
| Latest-truth win-rate | 15 | Retrieval Quality |
| Weak-seed rescue | 25 | Retrieval Quality |
| Relationship traversal quality | 15 | Retrieval Quality |
| Strong-seed preservation | 15 | Retrieval Quality |
| Wrong-agent isolation | 10 | Safety/Security |
| Operational complexity | 10 | DX/Operations |
| Docker/self-host practicality | 5 | DX/Operations |
| Determinism/reproducibility | 5 | Benchmark Integrity |
| **Total** | **100** | |

---

## Detailed Criteria

### 1. Latest-truth win-rate (15)
When two memories contradict (e.g., an old architectural choice vs. a new one), does the system surface the newer one as the primary context?

- **Good (15):** Top result is always the newest entry in cases of semantic overlap.
- **Bad (0):** System returns a "messy middle" or favors older entries due to frequency/centrality without temporal decay.
- **Measurement:** `hit@1_recency` — percentage of queries where the most recent relevant entry is the #1 result.

### 2. Weak-seed rescue (25)
Can the system find relevant memories when the query is vague, uses wrong terminology, or is significantly different from the stored phrasing?

- **Good (25):** Hit rate > 0.8 on synonym/conceptual queries where keywords do not match.
- **Bad (0):** Zero results found unless exact keywords match (standard flat-file behavior).
- **Measurement:** `hit@10_semantic` — percentage of on-topic results found using non-overlapping vocabulary.

### 3. Relationship traversal quality (15)
Can the system walk support chains, module dependencies, or ownership graphs (e.g., "Find the auth logic" leading to "Who owns the auth module?")?

- **Good (15):** Multi-hop retrieval successfully connects related entities without noise.
- **Bad (0):** Retrieval is strictly linear; no ability to jump between related concepts.
- **Measurement:** `hop_success_rate` — percentage of 2-hop relationship queries that return the correct target node.

### 4. Strong-seed preservation (15)
Does a precise, keyword-heavy query still return the exact right memory without regression?

- **Good (15):** Hit rate = 1.0 for exact keyword matches.
- **Bad (0):** Semantic "fuzziness" causes exact matches to be buried under conceptually similar but less precise results.
- **Measurement:** `hit@1_exact` — percentage of queries where exact keyword matches are the #1 result.

### 5. Wrong-agent isolation (10)
Does it prevent leaking memories from one agent to another? (e.g., CISO memories appearing in Marketing-Wunderkind context).

- **Good (10):** Zero cross-agent leaks.
- **Bad (DISQUALIFIED):** Any leakage of sensitive agent context to the wrong agent.
- **Measurement:** `cross_agent_leak_count` — total number of results belonging to Agent B when querying for Agent A.
- **Disqualification Threshold:** Any candidate with a score of 0 (leak count > 0) is excluded.

### 6. Operational complexity (10)
How hard is it for a developer to install, maintain, and upgrade this system locally?

- **Good (10):** Zero configuration, binary-only, or simple NPM install.
- **Bad (0):** Requires multiple external services, manual DB migrations, or heavy resource overhead.
- **Measurement:** `install_steps` + `runtime_overhead_mb`.

### 7. Docker/self-host practicality (5)
Can a developer run this locally without cloud services or specialized hardware?

- **Good (5):** Runs entirely in-process or via a single lightweight Docker container.
- **Bad (0):** Requires cloud-only APIs (OpenAI/Pinecone) or > 8GB RAM just for the DB.
- **Measurement:** `binary_vs_docker` + `min_ram_requirement`.

### 8. Determinism/reproducibility (5)
Are benchmark results stable across runs, or does the system exhibit stochastic behavior?

- **Good (5):** Identical queries produce identical rankings 100% of the time.
- **Bad (0):** Ranking changes between runs for the same data (e.g., due to approximate indices with high noise).
- **Measurement:** `result_variance` across 10 identical runs.

---

## Tie-Break Policy

If two candidates score identically within a 2-point margin:
1. **Prefer lower Operational Complexity.**
2. **Prefer no external Docker dependency.**
3. **Prefer Strong-seed preservation score.**

## Disqualification Threshold

**Wrong-agent isolation:** Any candidate that allows a memory from one agent to be retrieved by another agent (Score = 0) is automatically disqualified from selection, regardless of other scores.
