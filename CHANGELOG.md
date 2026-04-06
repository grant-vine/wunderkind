# Changelog

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
