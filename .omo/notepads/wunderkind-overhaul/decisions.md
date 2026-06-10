# Decisions

## Finalised Architectural Decisions
- Old `wunderkind.config.jsonc` at project root → print error + exit 1 (no migration)
- Qdrant: single shared collection `wunderkind-memories` with `group_id` payload field per project
- mem0: composite `agentId = ${projectSlug}:${agent}`
- Docker compose: `~/.wunderkind/`, started once globally
- Project slug: from `package.json` name, sanitised; fallback to `path.basename(cwd())`; final fallback: `"wunderkind-project"`
- fflate for zip (bun add fflate required before Task 10)
- Import strategies: `merge` (skip duplicate slugs) and `overwrite` (deleteAll then reimport)
- Gitignore: `addAiTracesToGitignore()` must be called in BOTH installers
- Single commit at end: `feat(cli+memory): install scope, project namespacing, word_vomit export/import`
