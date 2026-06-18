# Changelog

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
