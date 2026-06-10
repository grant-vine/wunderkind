# Docs Index Simplification and Prompt Deduplication

## Goal

Ship a safe focused wave that:

1. fixes the `/docs-index` command so it uses Wunderkind's built-in documentation ownership instead of asking the runtime to discover local planning support, and
2. reduces prompt token waste by deduplicating the largest repeated static prompt blocks across agent factories.

This wave intentionally does **not** change the project/global baseline-question UX yet. That larger product-flow change is deferred to a follow-up wave.

## Product Decisions

1. The command name will be **`/docs-index`**.
2. Docs ownership remains the current **9 eligible agents** and current canonical filenames in the current order.
3. `src/agents/docs-config.ts` and `src/agents/docs-index-plan.ts` become the explicit source of truth for command orchestration assumptions.
4. Prompt deduplication is **source-level only** in this wave.
5. No OMO mutation, no config-key renames, no baseline-question UX change in this wave.

## Step 0 — Freeze the contract

Before implementation, treat the following as fixed:

1. Eligible docs agents remain:
   - marketing-wunderkind
   - creative-director
   - product-wunderkind
   - fullstack-wunderkind
   - brand-builder
   - qa-specialist
   - operations-lead
   - ciso
   - devrel-wunderkind
2. Canonical filenames remain exactly as currently defined in `AGENT_DOCS_CONFIG`.
3. `/docs-index` is a shipped OpenCode command asset, not a runtime-discovered convention.
4. The duplicated static prompt blocks to dedup are:
   - `## Persistent Context (.sisyphus/)`
   - `## Documentation Output (Static Reference)`

If any of these must change, stop and revise the plan before implementation.

## Workstreams

### Workstream 1 — Characterization tests first

Lock the current docs ownership and command/plan behavior before editing command assets or prompt helpers.

#### Acceptance cases

1. `docs-config` still exposes the same 9 docs-eligible agents and canonical filenames.
2. `docs-index-plan` still builds the same ordered 9-entry plan and collision/completion semantics.
3. The command asset is expected to be `/docs-index`, not `/wunderkind:docs-index`, after this wave.
4. The command text must no longer mention “local docs-index planning support”.

#### QA scenario (executable)

- Tool: `bun test`
- Files:
  - `tests/unit/docs-config.test.ts`
  - `tests/unit/docs-index-plan.test.ts`
  - `tests/unit/config-template.test.ts`
- Expected result:
  - failing first where the command name/wording is intentionally changed
  - passing once command/docs/test surfaces align

### Workstream 2 — Docs-index command simplification

Update the shipped command asset and any directly related descriptive surfaces.

#### Required behavior

1. `commands/docs-index.md` invokes as `/docs-index`.
2. Command wording references built-in docs ownership and canonical filenames from Wunderkind’s shipped planning logic.
3. It no longer implies missing “local planning support” files are required.
4. It still preserves the plan/collision/result/init-deep semantics already tested in `docs-index-plan`.

#### QA scenario (executable)

- Tool: `bun test`
- Files:
  - `tests/unit/config-template.test.ts`
  - `tests/unit/docs-config.test.ts`
  - `tests/unit/docs-index-plan.test.ts`
- Expected result:
  - command asset and runtime status text align with `/docs-index`
  - no tests reference local planning support as required runtime input

### Workstream 3 — Safe static prompt deduplication

Extract repeated static blocks into shared helpers and reuse them across agent factories.

#### Required behavior

1. Create a shared helper for the identical Persistent Context block used by all 12 agents.
2. Create a shared helper for the static Documentation Output block used by the 9 eligible docs agents.
3. Do not repurpose runtime-only helpers in a way that couples build-time markdown to runtime config.
4. Preserve agent behavior and canonical docs filenames.

#### QA scenario (executable)

- Tools: `bun test`, `bun run build`
- Files:
  - `tests/unit/agent-factories.test.ts`
  - `tests/unit/docs-config.test.ts`
  - `tests/unit/config-template.test.ts`
- Expected result:
  - agent factories still include required docs-output references where eligible
  - ineligible agents still do not gain docs-output sections
  - generated markdown rebuild succeeds for all 12 agents

### Workstream 4 — Docs/help alignment

Align README/help/copy with the executable `/docs-index` surface and the current product reality.

#### Required behavior

1. README no longer describes docs-index as only a prompt convention.
2. README/help no longer requires namespaced `/wunderkind:docs-index`.
3. Copy remains accurate about docs ownership and generated index semantics.

#### QA scenario (executable)

- Tools: `bun test`, `npm pack --dry-run`, `grep`
- Files:
  - `tests/unit/cli-help-text.test.ts`
  - `README.md`
  - `commands/docs-index.md`
- Expected result:
  - `bun test tests/unit/cli-help-text.test.ts` exits `0`
  - `grep -n "/docs-index\|prompt convention only\|/wunderkind:docs-index" README.md commands/docs-index.md` shows:
    - `/docs-index` present where intended
    - no stale “prompt convention only” wording remains
    - no stale `/wunderkind:docs-index` command reference remains
  - `npm pack --dry-run` exits `0`
  - packaged command asset and docs match the implemented behavior

## Deferred Follow-up (Not in this wave)

Project-first baseline question flow:
- move region/industry/primary-regulation/secondary-regulation prompts out of install and into init/project-first UX
- retain compatibility flags for non-TUI usage
- update schema/help/tests accordingly

This is intentionally deferred because it crosses installer UX, init UX, config typing, merge semantics, and docs in a riskier way than the docs-index/prompt-size fix.

## File Areas Likely Affected

- `commands/docs-index.md`
- `src/agents/docs-config.ts`
- `src/agents/docs-index-plan.ts` (if wording/helper exposure needs adjustment)
- `src/agents/*.ts` for the 12 agent factories
- new shared prompt helper file under `src/agents/`
- `README.md`
- docs/config/agent-factory related tests

## Verification Commands

```bash
bun test tests/unit/docs-config.test.ts tests/unit/docs-index-plan.test.ts tests/unit/config-template.test.ts tests/unit/agent-factories.test.ts
bun test
tsc --noEmit
bun run build
npm pack --dry-run
```

All must exit `0`.

## Atomic Commit Strategy

1. `test: characterize docs-index command and docs ownership contract`
2. `feat: simplify docs-index to use built-in ownership`
3. `refactor: deduplicate static wunderkind prompt blocks`
4. `docs: align docs-index command and runtime guidance`
