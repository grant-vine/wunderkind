# OMO/OpenCode upstream fact lock

## Verified upstream OMO facts

- The published package and CLI remain `oh-my-opencode`, even while canonical plugin/config naming prefers `oh-my-openagent`.
- Canonical plugin entry is `oh-my-openagent`.
- Recognized OMO config basenames are:
  - `oh-my-openagent.jsonc`
  - `oh-my-openagent.json`
  - `oh-my-opencode.jsonc`
  - `oh-my-opencode.json`
- Upstream docs currently state that legacy OMO config basenames still load and win if both canonical and legacy config files exist.
- The documented schema URL still uses `oh-my-opencode.schema.json`:
  - `https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json`
- Migration guidance explicitly replaces plugin entry `oh-my-opencode` with `oh-my-openagent` in `opencode.json`.

Sources:
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/reference/cli.md
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/reference/configuration.md
- https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v3.15.3

## Verified upstream OpenCode plugin facts

- OpenCode plugin loading uses `opencode.json` plugin entries and plugin directories under `.opencode/plugins/` or `~/.config/opencode/plugins/`.
- Current hook names relevant to Wunderkind are:
  - `permission.ask`
  - `experimental.chat.system.transform`
  - `tool.execute.before`
  - `tool.execute.after`
  - `experimental.session.compacting`
  - `shell.env`
  - `command.execute.before`
  - `chat.headers`
- `permission.ask` still uses output statuses `"allow" | "ask" | "deny"`.
- `experimental.chat.system.transform` still exists with a system-string-array output surface.
- The plugin docs still treat `permission` as the current permission configuration surface; old `tools` boolean config is deprecated.

Sources:
- https://opencode.ai/docs/plugins
- https://opencode.ai/docs/permissions
- https://github.com/anomalyco/opencode/blob/517e6c9aa4c61dbc125e7654fc596f1d529f20d9/packages/plugin/src/index.ts

## Current repo assumptions checked against upstream

- `src/index.ts` currently uses `permission.ask` and `experimental.chat.system.transform`; these remain valid upstream hook names.
- `.claude-plugin/plugin.json` currently contains only `name`, `version`, `description`, and `main`; no verified upstream requirement for additional manifest fields was found in the fact-lock pass.
- `src/cli/config-manager/index.ts` currently prefers canonical OMO config basenames before legacy ones.
- `tests/unit/config-manager-coverage.test.ts` currently locks the same canonical-first basename precedence.
- `src/cli/config-manager/index.ts` and related tests currently call `bunx oh-my-opencode get-local-version`; this remains consistent with upstream CLI/package naming.
- `oh-my-opencode.jsonc` already uses the verified upstream schema URL ending in `oh-my-opencode.schema.json`.

## Material mismatches requiring implementation follow-up

1. **OMO config basename precedence mismatch**
   - Upstream docs: legacy basenames still win if both canonical and legacy files exist.
   - Current repo behavior: canonical basenames win first.
   - Action: add/update failing coverage before implementation, then decide whether to align runtime behavior, docs, or both.

## Non-mismatches confirmed safe

- Keeping `bunx oh-my-opencode` for CLI freshness/install guidance remains correct.
- Keeping `oh-my-openagent` as the canonical plugin/config naming target remains correct.
- Keeping `experimental.chat.system.transform` and `permission.ask` in the plugin is still compatible with current upstream facts.
