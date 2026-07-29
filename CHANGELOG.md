# Changelog

## 0.25.2

- make `wunderkind migrate` a real legacy OMO config migration command that merges `oh-my-opencode` leftovers into `~/.omo/omo.jsonc` without clobbering existing unified config values
- align doctor, installer, CLI help, tests, and docs around the upstream-style `Legacy OMO configuration remains` warning and migration guidance
- refresh package, manifest, managed docs, and generated native agent version surfaces for the 0.25.2 cut

## 0.25.1

- add a repo-local prompt answer-quality regression suite for the covered `latest-user`, `runtime-and-tools`, `contextual`, and `transcript` optimization seams
- document the latest verified internal evidence snapshot in `README.md`, including benchmark-pack, efficacy-harness, and answer-quality regression results for the next release handoff
- refresh package, manifest, managed docs, and generated native agent version surfaces for the 0.25.1 cut

## 0.25.0

- ship the completed prompt-optimization expansion as one cumulative multi-level system with verified `latest-user`, `runtime-and-tools`, `contextual`, and `transcript` level behavior
- keep the operator contract conservative: `token-audit` remains audit-only, runtime reporting stays separate and sanitized, and unsupported features remain unsupported
- refresh release metadata, managed docs, and generated native agent version surfaces for the 0.25.0 cut

## 0.24.0

- document prompt optimization as one default-off multi-level engine with capability-based `promptOptimizationLevel` settings and cumulative `latest-user`, `runtime-and-tools`, `contextual`, and `transcript` levels
- preserve audit-only `token-audit`, the separate runtime-report surface, and the explicit unsupported-feature contract: no persistent cross-session memory writes and no automatic context injection
- refresh README, docs, CLI help, doctor, and maintainer context around the final level-based operator story, the pre-v1 breaking-change note, and this repo's local compatibility-profile posture

## 0.23.8

- add PATH-supportability diagnostics so `doctor`, installer messaging, and CLI help report whether direct `wunderkind` invocation is currently available
- keep `bunx @grant-vine/wunderkind ...` as the safe fallback and explicitly preserve the no-auto-edit-shell-PATH contract

## 0.23.7

- clarify the operator story so `install` is consistently presented as OpenCode registration while `init` is consistently presented as repo-local readiness bootstrap
- make `doctor` report project readiness separately from install status and keep runtime prompt-optimization posture on `doctor --verbose` while preserving audit-only `token-audit`

## 0.23.6

- make `bunx @grant-vine/wunderkind ...` the canonical user-facing invocation across README guidance, runtime help text, doctor/init/install messaging, and shipped command assets
- keep `doctor`'s package-refresh guidance explicit with `bun install @grant-vine/wunderkind` while aligning lifecycle commands and tests around the bunx-first command story

## 0.23.5

- refresh README, AGENTS, CONTEXT, managed docs lanes, and active `.omo` guidance around the current retained-agent workflow and prompt-optimization reporting posture
- keep the product contract conservative while documenting this repo's project-local prompt-optimization override and current runtime-report artifact behavior

## 0.23.4

- align Wunderkind's inherited OpenCode SDK surface to `@opencode-ai/plugin@1.18.7` and `@opencode-ai/sdk@1.18.7`
- bump the direct `oh-my-openagent` dependency to `4.19.2` and refresh compatibility references for the current upstream wave

## 0.23.3

- freeze the V3 prompt-optimization runtime-report public contract around one shared sanitized payload for persisted latest artifacts and summary metadata
- redact secret-like emitted `modelId` values as `***`, preserve safe literal values where allowed, and keep `runtime-soul-overlay` excluded from reportable runtime surfaces
- align README, docs, CLI help, doctor output, rendered config comments, and schema descriptions around the separate sanitized/redacted runtime-report surface while preserving audit-only `token-audit`
- add deterministic seeded-secret regression coverage plus the final integrated proof sweep for persisted artifacts, summary metadata, helper surfaces, and final scope fidelity

## 0.23.2

- align Wunderkind's direct upstream dependency pin to `oh-my-openagent@4.19.1`
- keep the macOS `OMO_AST_GREP_SG_PATH` compatibility shim because the upstream `4.19.1` patch does not change the ast-grep warning behavior

## 0.23.1

- add a macOS-only startup shim that resolves `ast-grep`, probes it safely, and exports `OMO_AST_GREP_SG_PATH` only when the binary is actually usable
- preserve any existing upstream ast-grep override and add regression coverage around the new env-override seam in the plugin runtime tests

## 0.22.0

- align Wunderkind to `oh-my-openagent@4.19.0` plus OpenCode plugin/SDK `1.18.4`, including Goal terminology, preserved Ultrawork guidance, and the final operator-facing compatibility contract
- add upstream-compatible Wunderkind team mode via `wunderkind team-bootstrap` and `/wunderkind-team`, including canonical `team_mode.enabled` detection and explicit fallback to solo `product-wunderkind`
- add audit-only prompt-runtime reporting with deterministic layered `token-audit --surface all` output and no live prompt packing, no model-token truth claims, and no OpenToken adoption

## 0.23.0

- add a supplementary, config-driven prompt optimization engine that stays default-off, truth-bounded, and separate from `wunderkind token-audit`
- expose prompt-optimization mode and budget visibility through config, CLI help, and `wunderkind doctor` without adding a public optimize command
- freeze phase-1 truth to the supported OpenAI model map, preserve audit-only `token-audit`, and add regression coverage around counting, advisory mode, fallback behavior, and runtime trim guards

## 0.21.0

- add `wunderkind workflow-sync` for explicit GitHub Issues projection from local `.omo` plans, including `--all`, dry-run by default, and fail-closed local/remote drift handling
- add `wunderkind token-audit` as a read-only CLI surface for deterministic prompt-surface `bytes`, `lines`, and `files` reporting across Wunderkind-owned assets
- ship `/workflow-sync` and `/token-audit` as native command assets and wire them through CLI help, doctor/init guidance, install coverage, and manifest-driven asset exposure
- preserve synced workflow identity across heading slug changes and preflight remote drift before any apply mutations, including `--all --apply`

## 0.20.1

- complete the upstream-convergence release by centralizing native asset metadata behind a canonical manifest and regenerating the retained native agent surface from that contract
- enforce the hard-cut migration posture in runtime behavior: `.omo/` is the only active project artifact root, `wunderkind migrate` is fail-hard guidance only, and legacy `oh-my-opencode` paths remain detection-only warnings instead of active fallbacks
- shrink and rebucket the public skill surface to 19 promoted retained-specialist skills, 4 Wunderkind-specific workflow skills, and 1 deprecated docs-history route (`design-an-interface`)
- make `wunderkind upgrade` prune retired Wunderkind-owned packaged skill directories during refresh so deprecated skills do not survive on disk as active native routes
- make `wunderkind doctor` the clean operator handoff surface by surfacing stale native assets, stale generated agent versions, and the exact package-refresh plus lifecycle-upgrade commands to run
- add convergence-critical regression coverage and ship the release with final F1/F2/F3/F4 review gates approved

## 0.20.0

- raise the public Node.js runtime floor to `22.12+` (while continuing to support Bun 1+) so Wunderkind can adopt `commander@15`
- upgrade the CLI dependency surface to `commander@15.0.0`, add an explicit `engines.node >=22.12.0` contract, and align the npm publish workflow to Node 22

## 0.19.1

- upgrade the direct OpenCode / OMO dependency surface to `@opencode-ai/plugin@1.17.8`, `@opencode-ai/sdk@1.17.8`, `oh-my-openagent@4.11.1`, and `@clack/prompts@1.5.1`
- fix `wunderkind init` prompt validators for the stricter Clack 1.5 input contract so build/test runs stay green after the dependency refresh
- refresh `.omo`-first skill and README guidance, including stronger triage handling for external PR intake and AI-generated GitHub note disclaimers

## 0.19.0

- make `.omo/` the primary Wunderkind project artifact root for plans, notepads, evidence, and filesystem-mode workflow guidance
- add `wunderkind migrate` to move legacy `.sisyphus/` project artifacts into `.omo/` with dry-run and conflict detection support
- update retained prompts, generated native agents, docs, and skill contracts so `.sisyphus/` is treated as a legacy compatibility path instead of the default workflow root

## 0.18.2

- republish the 0.18.x release line under another fresh patch tag after the previous retry still used the wrong npm publishing key

## 0.18.1

- republish the 0.18.x release line under a fresh patch tag after the previous GitHub publish failed because the npm publishing key had expired

## 0.18.0

- upgrade the core OpenCode / OMO dependency surface to `@opencode-ai/plugin@1.17.0`, direct `@opencode-ai/sdk@1.17.0`, and `oh-my-openagent@4.8.1`
- preserve background delegation continuity across compaction, teach retained prompts to keep `bg_...` task ids separate from `ses_...` session ids, and mark shipped native commands as `subtask: true`
- add the `diagnose` engineering skill plus `/diagnose <issue>` guidance for deterministic defect isolation before speculative rewrites
- treat upstream `.omo/` project state as a first-class AI trace in Wunderkind's gitignore/documentation surfaces while keeping `.opencode/` support for OpenCode project config and plugin assets
- migrate this repository's historical `.sisyphus/` project-working artifacts into `.omo/` so the repo now follows upstream OMO project-state conventions locally
- refresh release-facing docs and inventory metadata for the new 24-skill surface and latest OMO/OpenCode compatibility guidance

## 0.16.0

- add project-configurable caveman mode with init/upgrade/doctor support while keeping caveman available per chat globally
- upgrade OpenCode and oh-my-openagent integration surfaces with compaction continuity, stronger delegation guidance, and refreshed retained-agent prompts
- add setup-wunderkind-workflow, refresh improve-codebase-architecture, and narrow ubiquitous-language to glossary maintenance

## 0.15.1

- surface OMO drift warnings in the interactive installer so TUI and non-interactive install paths stay aligned
- tighten doctor freshness accuracy so Wunderkind only reports an upstream current version when oh-my-openagent actually returns one

## 0.15.0

- modernize OMO compatibility around canonical `oh-my-openagent` config basenames while preserving legacy `oh-my-opencode` fallback support
- centralize OMO readiness and freshness checks so `doctor`, `install`, `upgrade`, and the TUI installer share the same upstream guidance
- add a canonical `oh-my-openagent.jsonc` template asset, keep the legacy template for transition, and align packaging plus documentation with the new install behavior

## 0.14.2

- simplify `wunderkind_write_artifact` to an append-only memory-lane helper for `.sisyphus/notepads/` and `.sisyphus/evidence/` only
- route docs, design, stitch, and planning writes back to normal OpenCode `Write`/`Edit` flows while preserving the existing docsPath and `DESIGN.md` safety checks

## 0.14.1

- unblock retained agents from using `wunderkind_write_artifact` by removing the generic write/edit permission ask from the bounded durable writer path
- add first-class `.sisyphus/evidence/` support, keep notepad/evidence writes append-only, and align shared prompts plus `/dream` with the bounded writer contract

## 0.14.0

- add draft-lane support and harden durable artifact writes around docsPath validation, symlink containment, and reserved `DESIGN.md` conflicts
- upgrade `oh-my-openagent` / `@opencode-ai/plugin` compatibility and stabilize the CLI/config-manager test harnesses so full Bun suite runs stay green

## 0.13.0

- add the shipped `/dream` native command as a mixed ideation, SOUL-synthesis, and exploration workflow owned by `product-wunderkind`
- extend `wunderkind doctor` to report `/dream` availability and identify stale installs that are missing `dream.md`
- refresh packaging, lifecycle, and doctor test coverage for the shared native command asset

## 0.12.1

- make `wunderkind doctor` show both the preferred scope-aware `wunderkind upgrade --scope=...` command and the direct package refresh command for the detected install location

## 0.12.0

- reclassify the previous 0.11.3 patch as a minor release because it introduces a new bounded writer tool and a new retained-agent security architecture

- prefer `oh-my-openagent` plugin/config naming while keeping `oh-my-opencode` package/CLI compatibility
- improve `doctor` output with OMO freshness/status guidance and clearer naming-split messaging
- add bounded durable-artifact writes for retained agents via `wunderkind_write_artifact`
- keep non-fullstack retained agents read-only for general edits while blocking shell-based file mutation bypasses
- refresh docs and metadata for the 6 retained-agent model and current OMO compatibility guidance
