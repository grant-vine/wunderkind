# Engineering Decisions

Last refreshed: 2026-05-15T15-07-42Z

## Current technical baseline

- **Language/runtime**: TypeScript + Bun + ESM
- **Plugin package**: `@opencode-ai/plugin@1.15.0`
- **OMO dependency**: `oh-my-openagent@4.1.2`
- **Current Wunderkind package version**: `0.17.0`
- **Generated agent frontmatter version field**: `wunderkind_version`

## Architecture decisions

### Generated agents are build artifacts
`agents/*.md` are generated from `src/agents/*` factories via the two-step build (`tsc` then `dist/build-agents.js`). Source-of-truth changes belong in `src/` and `skills/`, not in generated markdown.

### Docs output remains project-local
Docs output is validated as a relative, project-local path with no parent traversal and no symlinked segments in the lane.

### Upgrade drift is explicitly observable
`wunderkind doctor` now compares:
- native asset version markers (`.wunderkind-version.json`) for agents/commands/skills
- per-agent markdown frontmatter `wunderkind_version`

This gives both bundle-level and per-agent installed-state visibility.

### Compatibility logic lives in config-manager/doctor/install surfaces
Canonical/legacy OMO naming behavior should concentrate in operational seams (`config-manager`, `doctor`, installer/upgrade) instead of being scattered across prompts.

### CONTEXT.md is part of project bootstrap
`wunderkind init` now ensures `CONTEXT.md`, making the bootstrap artifacts: `.wunderkind/`, `AGENTS.md`, `CONTEXT.md`, `.sisyphus/`, and optional docs scaffolding.

## Current operational notes

- Docs output is enabled for this repo at `./docs` with history mode `overwrite`.
- The repo’s current managed docs lanes come from `src/agents/docs-config.ts`.
- `/docs-index` is a shipped command asset in `commands/docs-index.md`.
- `init-deep` is documented as an upstream OMO workflow concept, not a Wunderkind CLI command.

## Dependency posture

- Key direct dependencies are current for this upgrade cycle:
  - `oh-my-openagent@4.1.2`
  - `@opencode-ai/plugin@1.15.0`
- Remaining direct dependencies are not fully latest (`@clack/prompts`, `commander`, `typescript`, `@types/node`) and should be treated as a separate modernization pass if desired.
- Patched transitive overrides currently pin:
  - `fast-uri@3.1.2`
  - `ip-address@10.2.0`
  - `hono@4.12.18`
  - `uuid@13.0.2`

## Source map

### Local sources
- `package.json`
- `.claude-plugin/plugin.json`
- `src/build-agents.ts`
- `src/agents/render-markdown.ts`
- `src/agents/versioning.ts`
- `src/cli/config-manager/index.ts`
- `src/cli/doctor.ts`
- `src/cli/init.ts`
- `src/cli/docs-output-helper.ts`

### Upstream references
- https://opencode.ai/docs/plugins
- https://opencode.ai/docs/agents
- https://opencode.ai/docs/commands
- https://opencode.ai/changelog
- https://registry.npmjs.org/opencode-ai/latest
- https://registry.npmjs.org/@opencode-ai/plugin/latest
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/README.md
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md
