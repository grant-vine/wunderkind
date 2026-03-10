# Decisions — openagent-migration-and-plan-restructure

## [2026-03-10] Session: Atlas orchestrator initialized

### Decision: Brand-First Split Approach
- Do NOT globally rename `oh-my-opencode` strings
- Keep npm dependency as `oh-my-opencode: "^3.11.0"` 
- User-facing docs/prose use `oh-my-openagent` brand name
- Technical CLI commands/filenames preserve `oh-my-opencode`

### Decision: Version Target
- Exactly `0.7.0` — no other version target acceptable
- Pre-1.0 breaking release — README must explicitly say so

### Decision: Agent Count
- Canonical count is 12 (not 8 as in old README)
- 4 new agents: devrel-wunderkind, legal-counsel, support-engineer, data-analyst

### Decision: Config Inheritance
- Remove ALL per-agent `model` keys from oh-my-opencode.jsonc
- Use `category` key per agent instead
- Add top-level `categories` section with 5 defined categories + models

### Decision: Docs Decomposition
- docs-output-system.md stays in place but is compacted
- Old 38-task mega plan → short superseded overview + crosswalk table
- 4 child workstreams: D1 (config-path), D2 (docs config/CLI), D3 (runtime injection), D4 (agent prompts/installer)
- Implementation NOT part of this migration plan
