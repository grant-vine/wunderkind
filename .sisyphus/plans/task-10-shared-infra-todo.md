# Task 10 -> Task 13 shared infrastructure cleanup

Do not apply these changes in Task 10. This file records the exact shared-file cleanup Task 13 must perform after the domain-scoped merges are already in place.

## Remove retired base-agent registrations

### `src/agents/manifest.ts`
- Remove `createBrandBuilderAgent` import.
- Remove `createDevrelWunderkindAgent` import.
- Remove the full `brand-builder` entry from `WUNDERKIND_AGENT_DEFINITIONS`.
- Remove the full `devrel-wunderkind` entry from `WUNDERKIND_AGENT_DEFINITIONS`.
- Expand the surviving `marketing-wunderkind` summary so it explicitly covers brand, community, developer advocacy, docs-led launches, and DX/adoption work.

### `src/agents/index.ts`
- Remove the `createBrandBuilderAgent` / `BRAND_BUILDER_METADATA` re-export block.
- Remove the `createDevrelWunderkindAgent` / `DEVREL_WUNDERKIND_METADATA` re-export block.

### `oh-my-opencode.jsonc`
- Remove the entire `wunderkind:brand-builder` agent block.
- Remove the entire `wunderkind:devrel-wunderkind` agent block.
- Remove the adjacent section comments for the retired Brand and DevRel blocks.
- Expand the `wunderkind:marketing-wunderkind` description so it explicitly covers brand, community, PR, developer advocacy, docs-led launches, tutorials, migration support, and DX adoption work.

### `src/index.ts`
- Remove the `brand-builder` line from the `## Wunderkind Native Agents` catalog.
- Remove the `devrel-wunderkind` line from the `## Wunderkind Native Agents` catalog.
- Replace `Use marketing-wunderkind and brand-builder for GTM, channels, and community strategy.` with a single marketing rule that includes GTM, brand, community, developer advocacy, docs-led launches, and adoption work.
- Replace `Use devrel-wunderkind for docs, tutorials, and developer education.` with the same surviving marketing rule, or a marketing-specific docs/developer-audience rule.

## Retire personality keys and fold behavior into CMO

### `src/cli/personality-meta.ts`
- Remove `brand` and `devrel` from the `PERSONALITY_META` record key union.
- Delete the full `brand` personality block.
- Delete the full `devrel` personality block.
- Keep the existing `cmo` values (`data-driven`, `brand-storyteller`, `growth-hacker`) but expand their hints so they absorb the retired brand/devrel behavior:
  - `data-driven`: mention community health, docs adoption, activation, and TTFV alongside attribution/unit-economics.
  - `brand-storyteller`: mention PR narrative, trust-building, thought leadership, and developer education.
  - `growth-hacker`: mention onboarding loops, docs-led adoption, community flywheels, and launch experiments.

### `schemas/wunderkind.config.schema.json`
- Remove the `brandPersonality` property.
- Remove the `devrelPersonality` property.
- Remove `brandPersonality` from the project-config `required` array.
- Remove `devrelPersonality` from the project-config `required` array.
- Leave `cmoPersonality` in place and keep its enum values unchanged.

### README and config-reference surfaces

#### `README.md`
- In the Agents table, remove the `brand-builder` row.
- In the Agents table, remove the `devrel-wunderkind` row.
- Expand the `marketing-wunderkind` role text so it clearly covers brand, community, developer advocacy, docs-led launches, and developer education.
- In the project config example, remove `brandPersonality` and `devrelPersonality`.
- In the `Personality Reference` section, remove the standalone `Brand Builder` subsection.
- In the `Personality Reference` section, remove the standalone `DevRel` subsection.
- In the `CMO / Marketing` subsection, expand the meaning text to describe the folded brand + devrel behaviors.
- Keep `technical-writer` listed under `marketing-wunderkind` in the Sub-skills table.

#### `wunderkind.config.jsonc`
- Remove or rewrite any comments that still say `brand-builder` owns forum/community prioritisation or spend-gate guidance.
- Replace those comments with `marketing-wunderkind` ownership where the sample config still explains regional/industry effects.

## Remove retired docs-output surfaces

### `src/agents/docs-config.ts`
- Remove the `brand-builder` entry from `AGENT_DOCS_CONFIG`.
- Remove the `devrel-wunderkind` entry from `AGENT_DOCS_CONFIG`.
- Do not create replacement standalone docs files for those retired agents.
- Keep `marketing-wunderkind` as the surviving owner of comms/adoption docs output.

## Update shared tests for the six-agent topology

### `tests/unit/agent-factories.test.ts`
- Remove `createBrandBuilderAgent` imports and any expectations that still treat `brand-builder` as a shipped specialist.
- Remove `createDevrelWunderkindAgent` / `DEVREL_WUNDERKIND_METADATA` imports and any expectations that still treat `devrel-wunderkind` as a shipped specialist.
- Remove both retired agents from `ALL_SPECIALISTS`.
- Remove both retired agents from `ELIGIBLE_AGENT_FACTORIES`.
- Update any assertions that still expect the retired agents to carry personality references or generated markdown.

### `tests/unit/docs-config.test.ts`
- Remove `brand-builder` and `devrel-wunderkind` from `EXPECTED_AGENT_KEYS`.
- Remove both retired agents from the expected `getDocsEligibleAgentKeys()` result.
- Update the test description that still says `contains all 12 expected agent keys` so it matches the post-cleanup agent count.

### `tests/unit/plugin-transform.test.ts`
- Remove expectations that the plugin catalog includes `brand-builder`.
- Remove expectations that the plugin catalog includes `devrel-wunderkind`.
- Update the delegation-rule assertions so they expect the consolidated `marketing-wunderkind` routing text instead.

## Generated artifacts after cleanup

### `agents/*.md`
- Regenerate the native markdown agents after Task 13 shared-file edits.
- Remove the generated `agents/brand-builder.md` and `agents/devrel-wunderkind.md` outputs as part of the regenerated artifact diff.

## Landing rule to preserve during cleanup

- `marketing-wunderkind` is the single surviving owner for brand strategy, PR, community, developer advocacy, docs-led launches, tutorials, migration guidance, and DX/adoption work.
- `technical-writer` remains the explicit deep-writing skill under `marketing-wunderkind`; do not re-home it.
- `brandPersonality` and `devrelPersonality` are retired keys; their behavior lands in `cmoPersonality`, not in a new alias key.
