# Changelog

## 0.11.3

- prefer `oh-my-openagent` plugin/config naming while keeping `oh-my-opencode` package/CLI compatibility
- improve `doctor` output with OMO freshness/status guidance and clearer naming-split messaging
- add bounded durable-artifact writes for retained agents via `wunderkind_write_artifact`
- keep non-fullstack retained agents read-only for general edits while blocking shell-based file mutation bypasses
- refresh docs and metadata for the 6 retained-agent model and current OMO compatibility guidance
