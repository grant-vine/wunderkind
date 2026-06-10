# Dependency version selection

Selected upgrade targets for the OMO/OpenCode integration wave:

- `oh-my-openagent`: `3.15.3`
- `@opencode-ai/plugin`: `1.3.17`

Supporting references:
- https://www.npmjs.com/package/oh-my-openagent
- https://www.npmjs.com/package/@opencode-ai/plugin
- https://www.npmjs.com/package/opencode-ai

Compatibility note:
- no immediate compatibility caution was identified
- `@opencode-ai/plugin@1.3.17` matches the current `opencode-ai` release line `1.3.17`

Current repo baseline before the bump:
- `oh-my-openagent`: `3.12.3`
- `@opencode-ai/plugin`: `^1.2.18`

Next implementation step once the artifact review gate is closed:
- update `package.json`
- refresh `bun.lock`
- run build, targeted upgrade/install tests, full unit tests, typecheck, and command-level manual QA
