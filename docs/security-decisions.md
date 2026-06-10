# Security Decisions

Last refreshed: 2026-05-15T15-07-42Z

## Runtime and compliance context

- Project primary regulation context: **POPIA**
- Team posture: pragmatic-balanced
- Security persona baseline: pragmatic-risk-manager

## Security-relevant product decisions

### Trust boundary for docs and bootstrap work
Managed docs, `AGENTS.md`, `CONTEXT.md`, and `.omo/` work should remain inside the current project root. Docs-path validation explicitly rejects parent traversal and unsafe path resolution.

### Durable memory lanes stay append-only
`.omo/notepads/` and `.omo/evidence/` are append-only durable lanes; ordinary docs output belongs in `docs/` and should not be written through the bounded durable artifact writer.

### Compatibility guidance should be explicit, not silent
Canonical `oh-my-openagent` naming is preferred, but transitional compatibility for `oh-my-opencode` remains documented where the repo contract promises it. Security-wise, this reduces hidden state and operator confusion during upgrades.

### Dependency-risk posture
Recent audit work for this repo found that the installed resolved versions are already on patched transitive versions for the reported packages, even though `bun audit` still reports advisories in its output. Treat this as an audit-tool mismatch to keep watching, not as permission to stop reviewing dependency drift.

Resolved patched versions currently present in the dependency graph:
- `fast-uri@3.1.2`
- `ip-address@10.2.0`
- `hono@4.12.18`
- `uuid@13.0.2`

## Operational safeguards worth documenting

- `wunderkind doctor` is the primary read-only verification surface.
- Native asset freshness and native agent markdown version drift are now observable.
- Project docs output is enabled locally, but still scoped to `./docs` and governed by the configured history mode.

## Source map

### Local sources
- `.wunderkind/wunderkind.config.jsonc`
- `src/cli/docs-output-helper.ts`
- `src/cli/config-manager/index.ts`
- `src/cli/doctor.ts`
- `src/index.ts`
- `package.json`
- `bun.lock`

### Upstream references
- https://opencode.ai/docs/plugins
- https://opencode.ai/docs/agents
- https://registry.npmjs.org/opencode-ai/latest
- https://registry.npmjs.org/oh-my-openagent/latest
- https://registry.npmjs.org/@opencode-ai/plugin/latest
- https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md
