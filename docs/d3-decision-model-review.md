# D3 decision model review

## Availability refresh: 2026-11-14

Small native decision workers are more plausible candidates now, but none has been measured against Wunderkind routing. This review does not resume Kev or authorize downloads, service startup, inference, or production routing. The October proposal below is historical design context, not a current hardware admission result.

| Candidate | Verified distribution | Local evaluation disposition |
| --- | --- | --- |
| Tev1 0.8B | Ollama `tev1:0.8b`; catalog download variants834MB–1.5GB; typed `/v1/systemone` answers | First small native protocol-smoke candidate. Pin a quantized tag/digest and measure its loaded memory before a larger comparison. |
| Strands Decider 2B | Apple-Silicon MLX; default2GB MXFP8, optional1.3GB NVFP4;4K context | Second native candidate. Published timings are from an M5 Pro/64GiB, not this host; verify quantization support locally. |
| D3 2B/4B | Ollama;3.1–3.2GB/5.6–5.8GB downloads | Keep as quality/capacity controls after a smaller candidate passes smoke. Context limit is unresolved: the same official page advertises256K in its catalog and4K in its README. |
| D3 Edge | Publisher checkpoint594,321,600 parameters; Apache2.0; revision `bee5e872f75b9c5d1405767bf244a6948b95c0af` | Track as a smaller future candidate. Hugging Face availability does not prove an Ollama package or Apple Silicon runtime; custom-code/runtime review is still needed. |
| Nimble v3 9B | Ollama;9.3–9.5GB downloads | Defer from the first comparison because of its larger footprint; availability alone does not justify extra host disruption. |

Sources checked November14: [Tev1](https://ollama.com/library/tev1), [Strands Decider](https://ollama.com/library/strands-decider), [D3](https://registry.ollama.com/library/d3), [D3 Edge publisher](https://huggingface.co/vllm-sr/d3-edge), [Nimble v3](https://ollama.com/library/nimble-v3). Download sizes are not loaded allocations. Score/probability semantics and calibration must be verified per model, despite the shared endpoint vocabulary.

Ollama0.40.16 is the current stable host target. Its Responses endpoint now respects explicit truncation settings, and its empty model list uses an array. Neither change establishes the System One token-admission contract. The SDK0.7/Bun response-buffering hold is separate: an eventual native Ollama experiment should use a small, fixture-tested HTTP adapter rather than making an unrelated SDK migration a prerequisite. [Ollama release](https://github.com/ollama/ollama/releases/tag/v0.40.16)

### Smallest useful next experiment

Start with a frozen text-only route/defer schema and a deterministic rules baseline, then at most ten Tev1 development cases through one isolated model at a bounded4K request budget. That budget is a test setting, not proof of any model's supported maximum. Resolve exact token counting, truncation and overflow behavior before requests; missing admission proof is a hold. Follow with Strands and D3 only if protocol, memory pressure and latency meet predeclared limits. Keep held-out examples separate from prompts, report safety misses and invalid outputs, and compare case-level results with a reproducible rules baseline. Do not make hosted baseline availability a prerequisite for learning whether the local protocol works; a hosted quality comparison can remain explicitly unavailable.

Readiness first uses static package information and read-only host pressure probes; do not load a model merely to discover whether it fits. After an authorized admitted smoke starts, capture actual loaded allocation. Distinguish reclaimable Docker/cache memory from non-reclaimable workload use, do not treat Docker's configured reservation as resident consumption, and stop on sustained pressure or interference with unrelated services. Leave the host's current services running. No claimed accuracy or latency improvement follows from this availability review.

## October 2026 review and original proposal

**Disposition:** D3 is worth a bounded, local decision-worker evaluation. It is not ready to replace the experimental Kev adapter or to become a memory provider. Keep the current Jev/Kev interfaces disabled and the broader Kev comparison paused. If a later, separately authorized evaluation passes, D3 could replace the *decision-model candidate* in a future comparison; it cannot replace Wunderkind's six generative specialists.

## What D3 is

The publisher describes D3 as a typed decision model: given state and one or more `choice`, `noul` (yes/no), or `score` questions, it returns scored options/probabilities without generating prose. The published `vllm-sr/d3` checkpoint is 26.09B parameters (including its vision encoder), and `d3-mini` is 4.54B; both model cards list Apache-2.0. The Ollama catalog exposes `d3:2b`, `d3`/`d3:4b`, `d3:9b`, and `d3:27b`; it shows 3.1–3.2 GB and 5.6–5.8 GB download sizes for the first two and states that Ollama 0.40.9 or later is required. Its Apple Silicon default packages are MXFP8, with measured loaded allocations at 4,096-token context of 3.62 GB (2B) and 5.63 GB (4B). These are catalog measurements, not measurements of this host or a proposed run. The catalog says the models named `d3` use a 4,096-token context and that video and Box/Track are unavailable through Ollama. [D3 model card](https://huggingface.co/vllm-sr/d3) · [D3-mini model card](https://huggingface.co/vllm-sr/d3-mini) · [Ollama D3 catalog](https://registry.ollama.com/library/d3)

The current host report supplied by the task owner is Apple Silicon, 32 GiB RAM, with about 101 GiB disk available. That makes 2B and 4B reasonable *static capacity candidates*, subject to live memory pressure and allocation admission immediately before a run. It does not prove either model is currently cached, that enough RAM is free, or that an Ollama inference is safe. Do not attempt 9B or 27B in this evaluation: the catalog associates 9B with 32 GB systems and 10.09 GB loaded allocation, while 27B is listed for 64 GB systems and 28.61 GB loaded allocation, leaving inadequate host/workload margin here. Never infer admission from total installed RAM or Docker capacity.

Publisher evaluation scores are checkpoint results, not local Ollama-package truth. The Ollama catalog explicitly says its Jev Decision Index numbers are for original checkpoints rather than its quantized packages; it also cautions that returned probabilities are not guaranteed real-world frequencies. Treat all published quality and latency numbers as motivation only, not evidence for this repository's workload. [Ollama catalog: quality and limits](https://registry.ollama.com/library/d3)

## Fit and incompatibility with the existing adapter

D3 appears conceptually close to the existing System One shape: both take structured `state` plus typed questions and return typed answers. The official vLLM recipe documents `/v1/systemone`, and Ollama demonstrates the same endpoint and question vocabulary. This resemblance does not establish drop-in compatibility. [vLLM D3 serving recipe](https://recipes.vllm.ai/vllm-sr/d3) · [Ollama D3 API example](https://registry.ollama.com/library/d3)

The current `src/experimental/system-one/adapter.ts` binds requests to `kev-latest`, the Kev 4B model revision, a particular tokenizer hash, a Kev API source hash, and the `wunderkind-kev-4b-token-count-preflight-v1` contract. It validates Kev-specific response and usage semantics. The existing runner also requires the exact frozen Kev fixture and preflight. Reusing that runner or preflight for D3 would either reject D3 correctly or falsely treat Kev token counts/identity as D3 proof. A future D3 adapter needs its own model/digest/quantization identity, exact tokenizer or runtime-specific input admission, response parser, probability validation, timeout/error mapping, and fixture-backed protocol tests. Do not change the existing Kev adapter as part of this review.

D3 is a decision worker, not a general conversation, extraction, or agent model. In particular, its structured scores do not create the auditable free-text facts currently required by `MemoryExtractor`; D3 must not be wired into capture/injection or promoted as a general-purpose provider on the strength of this evaluation.

## Bounded evaluation proposal (design only)

This proposal is not authorization to resume the paused Kev campaign, download a model, start Ollama, call a model, or spend hosted allowance. Begin only after a separate explicit execution authorization. Reuse an existing runner only if it can accept a portable System One adapter without using Kev's pinned fixture, tokenizer preflight, or protocol assumptions. Otherwise add only the smallest D3-specific adapter contract and runner needed for this one comparison; do not build a generic evaluation engine.

### Phase gates

1. **Offline contract and evidence review.** Freeze the intended route/defer/security decision schema and exact input/answer contract before model calls. Capture official source URLs, Ollama version, model manifest digest, package quantization, context setting, prompt/request hashes, and an explicit compatibility matrix. Verify that Ollama is at least 0.40.9 (the task owner is upgrading it to at least 0.40.10; record the actual binary version rather than assuming completion). Check that current provider code is not silently routing to D3. A missing digest, unsupported answer semantics, or incomplete run contract is `HOLD`; no download or request follows.
2. **Readiness and admission.** Record hardware model/physical RAM, free disk, current memory pressure and non-reclaimable process footprint using supported read-only probes; do not capture full process command lines or secrets. Verify the exact Ollama package digest and quantify actual loaded memory with one isolated model at a time. Admit 2B first; admit 4B only if measured headroom satisfies the frozen cap. Use the existing conservative rule from the paused evaluation plan: stop before the workload reaches 85% of physical RAM and stop on sustained memory-pressure violation (10 seconds), process failure, or any unrelated host/service interference. No model is loaded to probe readiness. The already-reported 32 GiB/101 GiB is static context, not this live gate.
3. **Small smoke.** After authorization and successful gates 1–2, run at most 10 predeclared development examples per size, serially, with no other model resident. Include ordinary route selection, defer/abstain, ambiguous/underspecified input, malformed or adversarial instruction-like text, security-sensitive classification, and one multi-question request. Verify every answer has the expected question ID/type, finite normalized probabilities where promised, no undeclared choice, and bounded latency. Any schema mismatch, invalid probability, security miss, timeout, 2 consecutive transport/parse errors, or 5% invalid outputs stops that size immediately. Do not silently switch model size or protocol.
4. **Bounded held-out comparison.** Only if both smokes pass, evaluate a family-disjoint, pre-frozen sample of at most 120 held-out cases per admitted size, with a 60-minute wall-clock cap for the complete local attempt. Keep the existing 2B/4B runs serial and use identical requests and hardware state. Include a clearly separated safety slice (security-sensitive, abstain/defer, and ambiguity cases) with sufficient counts to report each stratum; if the available corpus cannot support that slice without overlap or leakage, stop at smoke and report `HOLD:corpus`. Never tune prompts, labels, thresholds, or examples on held-out responses. Do not resume or reuse old Kev benchmark runs.
5. **Controls and report.** Compare D3 2B and 4B with any available, hash-identified archived outputs for the current structured-routing and Sol/Luna baselines. No hosted call is part of this proposal. If comparable archived baseline outputs do not exist, report that comparison as unavailable and do not claim replacement readiness. A future separate authorization may permit a bounded hosted baseline only after current account allowance and model/route policy are independently verified; it must not be inferred from an old allowance or bundled into this local run.

### Measures and decision rule

Report per-size and per-stratum coverage, exact match/route accuracy, macro-F1, abstain/defer precision and recall, critical security miss rate, malformed-output rate, timeout/fallback rate, p50/p95 latency, peak loaded allocation and peak system memory pressure. For probability output, report multiclass Brier score, log loss, and reliability bins/ECE only where the gold labels and returned option distributions make these mathematically defined; do not call raw scores calibrated probabilities without that analysis. Include paired case-level differences against archived baselines, not just aggregate scores.

The test should answer whether a local D3 size is competitive enough to merit another review. Adoption remains `NO` unless a later decision explicitly approves it after: (a) zero critical security misses and no increase in unsafe routing versus the matched baseline; (b) no malformed/unsupported outputs; (c) a predeclared non-inferiority margin on route quality with family-clustered uncertainty; (d) acceptable abstain behavior; (e) local latency and physical-memory limits; and (f) confirmed artifact identity and reproducible rerun. Freeze the margin and the minimum safety-slice sample size before the first D3 inference. If sample size is too small to support the bound, result is `INCONCLUSIVE`, not a pass.

### Stop, cleanup, and evidence conditions

Hard stop at the first failed gate, memory pressure threshold, safety miss, model/process identity drift, 2 consecutive transport/parse failures, 5% invalid outputs, or 60-minute cap. Stop only the process started by the authorized attempt. Preserve append-only request hashes, redacted outputs, model/package digests, invocation and exit status, resource samples, stop cause, and unload/cleanup confirmation. Never store secrets, raw private process inventories, or unredacted sensitive user material in evidence. A completed command or zero exit alone is not a passing decision result.

### Outcome labels

- `HOLD`: identity, system readiness, corpus, protocol, or baseline prerequisite is missing.
- `SMOKE_ONLY`: protocol and small run worked, but held-out comparison did not run or was stopped.
- `INCONCLUSIVE`: held-out comparison ran but a stop gate fired, the safety slice/sample is insufficient, or the statistical bound is unresolved.
- `REVIEW_CANDIDATE`: all predeclared local criteria pass and a reviewer can decide whether to replace the experimental decision-worker candidate. This is not automatic adoption or production enablement.

## Current-task boundary

This turn performed documentation/source review only. No model was downloaded or loaded; no service was started; no benchmark or provider call was made; no existing Kev run was resumed; no adapter code or production configuration changed. The existing Jev/Kev interfaces remain experimental and disabled.
