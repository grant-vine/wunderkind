# Docs Output D4 — Agent Prompts and Docs Surfaces

## Objective

Define the docs-output conventions agents should follow, propagate them into eligible agent prompts, regenerate generated prompts, and document the feature coherently in README and the root AGENTS knowledge base.

## Scope

This child plan covers original Tasks 6 and 8, plus the docs-surface subset of Task 10.

## Depends On

- D1 must be complete.
- D3 must be complete.
- D2 should be complete before final docs-surface wording is finalized.
- D5 must be complete before final docs-surface wording is finalized.

## Files in Scope

- `src/agents/docs-config.ts`
- eligible `src/agents/*.ts`
- `tests/unit/docs-config.test.ts`
- `tests/unit/agent-factories.test.ts`
- `README.md`
- `AGENTS.md`

## Explicitly Out of Scope

- package version bumps
- `.claude-plugin/plugin.json` version changes
- nonexistent `src/agents/AGENTS.md`
- nonexistent `src/cli/AGENTS.md`
- stale “8 agents” cleanup outside README/root AGENTS if not present there

## Deliverables

- `docs-config.ts` canonical filename map + helper
- eligible agent static docs-output sections
- regenerated `agents/*.md` reflecting docs-output guidance
- docs-output documentation in `README.md` and root `AGENTS.md`, including the final install/init/doctor model

## Task D4.1 — TDD `docs-config.ts`

### What to do
- Write tests first for:
  - exported config map
  - all 12 agents represented
  - helper output includes canonical filenames, docs path, and history mode rules
  - unknown agent key throws
- Implement `AGENT_DOCS_CONFIG` and `buildDocsInstruction()`.

### Must NOT do
- Do not hardcode `./docs` inside the helper.
- Do not hide the config map from tests.
- Do not use `as any`.

### Acceptance Criteria
- [ ] red/green TDD evidence exists
- [ ] all 12 agents present in config map
- [ ] TypeScript compiles cleanly

### QA Scenarios
```text
Scenario: TDD red phase — tests fail before implementation
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-config.test.ts
    2. Assert exit code is non-zero before implementation because the new docs-config cases fail first
  Evidence: .sisyphus/evidence/task-6-tdd-red.txt

Scenario: TDD green phase — all tests pass after implementation
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-config.test.ts
    2. Assert exit code 0 after implementation
  Evidence: .sisyphus/evidence/task-6-tdd-green.txt

Scenario: All 12 agents present in AGENT_DOCS_CONFIG
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-config.test.ts
    2. Assert exit code 0 and the targeted test proves all 12 agents are represented in the exported config map
  Evidence: .sisyphus/evidence/task-6-agent-count.txt

Scenario: TypeScript compiles clean
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-6-tsc.txt
```

## Task D4.2 — Agent tool-restriction audit and static docs-output sections

### What to do
- Audit all 12 agent factories for write/edit restrictions.
- For eligible agents, add `## Documentation Output (Static Reference)` sections.
- Use actual canonical filenames from `AGENT_DOCS_CONFIG`.
- Update factory tests.
- Rebuild generated prompts with `bun run build`.

### Must NOT do
- Do not use plain `## Documentation Output` in static sections.
- Do not grant broad write access where audit says otherwise.
- Do not edit `agents/*.md` directly.

### Acceptance Criteria
- [ ] all eligible agents have static docs-output guidance
- [ ] excluded agents remain excluded if tool restrictions require it
- [ ] factory tests pass
- [ ] build regenerates agent markdown successfully

### QA Scenarios
```text
Scenario: All eligible agents have Documentation Output section
  Tool: Bash
  Setup:
    1. Add targeted assertions covering all eligible agent factories after the D4.2 audit is complete
  Steps:
    1. Run: bun test tests/unit/agent-factories.test.ts
    2. Assert exit code 0 and the targeted assertions prove every eligible agent includes `## Documentation Output (Static Reference)`
  Evidence: .sisyphus/evidence/task-8-eligible-agents.txt

Scenario: Excluded agents do not have Documentation Output section
  Tool: Bash
  Setup:
    1. Add targeted assertions covering every intentionally excluded agent after the D4.2 audit is complete
  Steps:
    1. Run: bun test tests/unit/agent-factories.test.ts
    2. Assert exit code 0 and the targeted assertions prove excluded agents do not include the static docs-output section
  Evidence: .sisyphus/evidence/task-8-excluded-agents.txt

Scenario: Agent factory tests pass with new assertion
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/agent-factories.test.ts
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-8-factory-tests.txt

Scenario: Build succeeds and all agents/*.md regenerated
  Tool: Bash
  Steps:
    1. Run: bun run build
    2. Assert exit code 0
    3. Assert generated `agents/*.md` files contain the expected static docs-output guidance for eligible agents
  Evidence: .sisyphus/evidence/task-8-build.txt

Scenario: Full test suite passes
  Tool: Bash
  Steps:
    1. Run: bun test
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-8-full-tests.txt
```

## Task D4.3 — Docs-output docs surfaces in README and root AGENTS

### What to do
- In `README.md`, document:
  - the difference between `install` and `init`
  - `docsEnabled`, `docsPath`, and `docHistoryMode` as init-only project customizations
  - `docsPath` as the project docs folder setting
  - `<docsPath>/README.md`
  - `/docs-index`
  - `doctor` outside-project vs inside-project behavior
- Document the minimum project soul-file model established by D5.
- In root `AGENTS.md`, document docs-output conventions relevant to maintainers.
- Keep wording aligned with the actual implemented feature set.

### Must NOT do
- Do not include version-bump work.
- Do not point to nonexistent `src/agents/AGENTS.md` or `src/cli/AGENTS.md`.
- Do not document deferred doctor/configVersion/personality-gate work as if it ships with core docs-output.
- Do not imply base install asks docs-output or project-local personality questions outside init.

### Acceptance Criteria
- [ ] README documents the active docs-output feature surface
- [ ] root AGENTS.md documents the docs-output feature for maintainers
- [ ] docs wording matches D1 config semantics and the D5 CLI contract exactly

### QA Scenarios
```text
Scenario: README documents docs output feature
  Tool: Bash
  Steps:
    1. Run: grep -c "docsEnabled\|docsPath\|docHistoryMode\|docs-index\|init\|doctor" README.md
    2. Assert count >= 6
  Evidence: .sisyphus/evidence/task-10-readme.txt

Scenario: Root AGENTS documents maintainer-facing docs-output and init model
  Tool: Bash
  Steps:
    1. Read AGENTS.md
    2. Assert it reflects the final install/init/doctor split relevant to maintainers
  Evidence: .sisyphus/evidence/d4-agents-docs-surface.txt

Scenario: Build still succeeds after docs-surface updates
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit && bun run build
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-10-build.txt
```

## Commit Strategy

- **Commit D4-A**: `feat(agents): add docs-config.ts canonical filename map + buildDocsInstruction()`
- **Commit D4-B**: `feat(agents): add Documentation Output section to all eligible agent factories`
- **Commit D4-C**: `docs: document docs-output install init and doctor behavior in README and AGENTS`

## Exit Conditions

- [x] D4.1 complete
- [x] D4.2 complete
- [x] D4.3 complete
- [x] Hub final integration checks are unblocked
