## 2026-03-20

- `readProjectOpenCodeConfig()` in `src/cli/uninstall.ts` must match the same OpenCode config precedence as `src/cli/mcp-helpers.ts`: `opencode.json` → `opencode.jsonc` → `config.json` → `config.jsonc`.
- Keeping the lookup order aligned avoids uninstall drift when a project still uses a legacy OpenCode config filename.
