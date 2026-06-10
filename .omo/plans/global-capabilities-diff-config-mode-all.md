# Global capabilities + diff-only project config + mode-all specialists

## Assumption

Until the user narrows the scope, treat **all 12 shipped Wunderkind specialists** as the allowlist for `mode: all`.

Reasoning: they are already directly usable as primary agents today, so changing `primary -> all` preserves direct use while adding delegation/subagent eligibility.

## Explicit product decision

For **project-scope install/upgrade**, baseline fields (`region`, `industry`, `primaryRegulation`, `secondaryRegulation`) become **optional override-only values**.

Rules:

1. Global install/upgrade continues to own the baseline fields canonically.
2. Project install/init/upgrade may read effective baseline values for UX/prefill, but **must not serialize them into `.wunderkind/wunderkind.config.jsonc` unless they intentionally differ from the effective global/default baseline**.
3. Non-TUI project-scope install/upgrade should not require baseline flags.
4. Older project configs that already include baseline fields remain valid and must still read correctly.

## Goals

1. Make all shipped Wunderkind capabilities global assets:
   - agents
   - commands
   - skills
2. Redefine project scope to mean:
   - project registration in OpenCode config
   - local `.wunderkind/` customization/state only
   - no project-local native capability copies
3. Make project config sparse/differential:
   - omit baseline fields (`region`, `industry`, `primaryRegulation`, `secondaryRegulation`) unless intentionally overridden
   - keep team/personality/docs settings canonical in project config
   - preserve backward-compatible reads for older project configs that still contain baseline fields
4. Change all 12 Wunderkind specialist agents from `mode: primary` to `mode: all`
5. Keep work TDD-first and verifiable

## Non-goals

1. Do not promise exact OMO clickable tool-card parity from this change.
2. Do not invent new OpenCode/plugin APIs for session creation or tool metadata.
3. Do not redesign personality UX beyond what is required for sparse project config.

## Wave 1 — TDD for global asset semantics

Add failing tests covering:

1. `install --scope=project`
   - does not create `.opencode/agents`
   - does not create `.opencode/skills`
   - does refresh global agents/commands/skills
2. `init`
   - writes project config + soul files only
   - refreshes global agents/commands/skills
   - does not expect/write project-local native agents/skills
3. `upgrade --scope=project`
   - refreshes global agents/commands/skills
   - updates project config semantics only where appropriate
4. `doctor`
   - reports global native agents/commands/skills
   - no longer warns about missing project-native agents/skills
5. `uninstall --scope=project`
   - removes project registration only
   - does not remove shared global capabilities

Primary test files:

- `tests/unit/cli-installer.test.ts`
- `tests/unit/init-interactive.test.ts`
- `tests/unit/init-doctor.test.ts`
- `tests/unit/tui-installer-handoff.test.ts`
- `tests/unit/uninstall.test.ts`

### QA Scenario

Run targeted lifecycle tests covering project install/init/upgrade/doctor/uninstall.

Expected results:

1. no project lifecycle assertion expects `.opencode/agents` or `.opencode/skills`
2. global capability paths are asserted instead
3. project-scope uninstall preserves shared global capabilities

### Atomic Commit

Create one green commit only after Wave 1 + Wave 2 tests pass together:

- `refactor(cli): make shipped agents and skills global capabilities`

## Wave 2 — Implement global asset lifecycle

Update these surfaces:

- `src/cli/config-manager/index.ts`
  - make native agent helpers global-only
  - make native skill helpers global-only
- `src/cli/cli-installer.ts`
- `src/cli/tui-installer.ts`
- `src/cli/init.ts`
- `src/cli/doctor.ts`
- `src/cli/uninstall.ts`
- `src/cli/index.ts`

Behavior target:

- capabilities are always refreshed globally
- project scope only controls project registration + local config/customization
- project uninstall removes only project registration/local customization effects, not shared global assets

## Wave 3 — TDD for sparse project config

Add failing tests covering:

1. `renderProjectWunderkindConfig()` omits baseline fields by default
2. explicit project baseline overrides still serialize when present
3. `detectCurrentConfig()` still resolves the same effective runtime values from:
   - global baseline config
   - sparse project override config
4. `readWunderkindConfig()` remains backward-compatible with older dense project configs
5. `src/index.ts` runtime transform still emits the same effective resolved context
6. schema validation/tests still accept sparse project config

Primary test files:

- `tests/unit/config-template.test.ts`
- existing config-manager-related tests if present
- `tests/unit/docs-injection.test.ts`
- any doctor/config merge tests affected by dense vs sparse project config rendering

### QA Scenario

Run targeted config/rendering tests with both sparse new project configs and older dense project configs.

Expected results:

1. sparse project files omit baseline fields by default
2. intentional project overrides still serialize
3. effective runtime config remains equivalent after merge
4. backward-compatible reads still pass for dense legacy project files

### Atomic Commit

Create one green commit only after Wave 3 + Wave 4 tests pass together:

- `refactor(config): write project config as sparse differential overrides`

## Wave 4 — Implement sparse differential config

Update these surfaces:

- `src/cli/config-manager/index.ts`
  - project config renderer/writer becomes sparse for baseline fields
  - readers remain backward-compatible
- `schemas/wunderkind.config.schema.json`
  - ensure sparse project config remains valid
- any README/help text that describes project config semantics

Behavior target:

- global config remains the canonical baseline source
- project config remains canonical for personalities/team/docs settings
- project config baseline fields are written only when intentionally overridden

## Wave 5 — TDD for mode-all specialists

Add failing tests covering:

1. all 12 Wunderkind specialist factories expose `mode === "all"`
2. rendered native markdown frontmatter emits `mode: all`
3. generated artifacts stay deterministic after rebuild

Primary test files:

- `tests/unit/agent-factories.test.ts`
- `tests/unit/config-template.test.ts` if needed for generated asset expectations

### QA Scenario

Run targeted agent factory/build-output tests before changing source.

Expected results:

1. all 12 specialist factories assert `mode === "all"`
2. generated markdown frontmatter emits `mode: all`
3. generated artifacts remain deterministic after rebuild

### Atomic Commit

Create one green commit only after Wave 5 + Wave 6 tests pass together:

- `feat(agents): allow wunderkind specialists to run as direct agents and subagents`

## Wave 6 — Implement mode changes

Update all 12 specialist agent factories:

- `src/agents/marketing-wunderkind.ts`
- `src/agents/creative-director.ts`
- `src/agents/product-wunderkind.ts`
- `src/agents/fullstack-wunderkind.ts`
- `src/agents/brand-builder.ts`
- `src/agents/qa-specialist.ts`
- `src/agents/operations-lead.ts`
- `src/agents/ciso.ts`
- `src/agents/devrel-wunderkind.ts`
- `src/agents/legal-counsel.ts`
- `src/agents/support-engineer.ts`
- `src/agents/data-analyst.ts`

Then regenerate output with `bun run build`.

## Wave 7 — Verification

Run targeted tests first, then:

1. `bun test`
2. `tsc --noEmit`
3. `bun run build`
4. `npm pack --dry-run`

## Acceptance criteria

1. No project lifecycle path writes or expects `.opencode/agents` or `.opencode/skills`.
2. Global lifecycle paths own shipped agents, commands, and skills.
3. Project config omits baseline fields by default while preserving equivalent effective runtime config.
4. Older dense project configs still read correctly.
5. All 12 Wunderkind specialist markdown agents render with `mode: all`.
6. Full test/type/build/package verification passes.
