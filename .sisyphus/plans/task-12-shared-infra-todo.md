# Task 13 Shared Infrastructure Cleanup

This file records the exact shared-file cleanup that must happen after Task 12's domain-scoped prompt changes land. Task 12 intentionally did not edit any of these shared infrastructure files.

## Remove retired base-agent registrations

- `src/agents/manifest.ts`
  - Remove the `createOperationsLeadAgent` import.
  - Remove the `createDataAnalystAgent` import.
  - Remove the `operations-lead` definition block from `WUNDERKIND_AGENT_DEFINITIONS`.
  - Remove the `data-analyst` definition block from `WUNDERKIND_AGENT_DEFINITIONS`.
- `oh-my-opencode.jsonc`
  - Remove the full `"wunderkind:operations-lead"` agent block.
  - Remove the full `"wunderkind:data-analyst"` agent block.
- `src/index.ts`
  - Remove `operations-lead` from the static native-agent catalog / capability summary text.
  - Remove `data-analyst` from the static native-agent catalog / capability summary text.
  - Replace routing guidance that currently says `Use operations-lead for reliability, incidents, and runbooks.` with retained-owner guidance pointing to `fullstack-wunderkind` for reliability/runbooks and `ciso` for security-incident posture.
  - Replace routing guidance that currently says `Use data-analyst for analytics, funnels, experiments, and metrics.` with retained-owner guidance pointing to `product-wunderkind` for product usage/experiments and `marketing-wunderkind` for campaign/funnel interpretation.

## Remove retired docs-output surfaces

- `src/agents/docs-config.ts`
  - Remove the `operations-lead` entry from `AGENT_DOCS_CONFIG`.
  - Remove the `data-analyst` entry from `AGENT_DOCS_CONFIG`.

## Retire shared personality keys

- `src/cli/personality-meta.ts`
  - Remove the `ops` key from the `PERSONALITY_META` record type union.
  - Remove the `dataAnalyst` key from the `PERSONALITY_META` record type union.
  - Remove the `ops` metadata block.
  - Remove the `dataAnalyst` metadata block.
  - Fold behavior guidance as follows:
    - `opsPersonality` reliability / runbook / on-call posture -> `ctoPersonality`
    - `opsPersonality` security-incident / compliance-impact posture -> `cisoPersonality`
    - `dataAnalystPersonality` product usage / adoption / experiment readout posture -> `productPersonality`
    - `dataAnalystPersonality` campaign / funnel / attribution posture -> `cmoPersonality`
- `schemas/wunderkind.config.schema.json`
  - Remove the `opsPersonality` property.
  - Remove the `dataAnalystPersonality` property.
  - Remove `opsPersonality` from the project-config `required` array.
  - Remove `dataAnalystPersonality` from the project-config `required` array.
- `src/cli/config-manager/index.ts`
  - Remove `opsPersonality` and `dataAnalystPersonality` from defaults, parsing, merge resolution, and JSON rendering.
  - Stop reading/writing those keys in `DEFAULT_INSTALL_CONFIG`, runtime detection, config serialization, and resolved-config fallbacks.
  - Preserve the folded behavior only through surviving retained personalities: `ctoPersonality`, `cisoPersonality`, `productPersonality`, and `cmoPersonality`.
- `src/cli/doctor.ts`
  - Remove verbose doctor output for ops and data-analyst personalities.
  - Ensure doctor surfaces only retained personalities after the fold-in.

## Update public ownership docs

- `README.md`
  - Remove the `operations-lead` row from the `## Agents` table.
  - Remove the `data-analyst` row from the `## Agents` table.
  - Remove `opsPersonality` and `dataAnalystPersonality` from the project-config JSON example.
  - Remove the `### Operations (\`opsPersonality\`)` personality section.
  - Remove the `### Data Analyst (\`dataAnalystPersonality\`)` personality section.
  - Refresh retained-owner wording so reliability/runbooks/admin tooling live under `fullstack-wunderkind`, security-incident posture under `ciso`, product analytics under `product-wunderkind`, and campaign analytics under `marketing-wunderkind`.

## Update shared verification surfaces

- `tests/unit/agent-factories.test.ts`
  - Remove expectations that treat `operations-lead` and `data-analyst` as active base agents.
- `tests/unit/plugin-transform.test.ts`
  - Remove assertions that the native-agent section still contains `operations-lead` or `data-analyst`.
- `tests/unit/docs-config.test.ts`
  - Remove docs-config expectations for `operations-lead` and `data-analyst`.

## Landing rules to preserve during cleanup

- `operations-lead` work lands in:
  - `fullstack-wunderkind` for reliability engineering, SLO/SLA ownership, runbooks, incident coordination, on-call discipline, supportability review, observability, and admin tooling
  - `ciso` for security-incident posture and compliance-impact assessment
- `data-analyst` work lands in:
  - `product-wunderkind` for product usage analytics interpretation, feature adoption analysis, experiment synthesis, and prioritization framing
  - `marketing-wunderkind` for campaign performance analysis, funnel analytics, attribution, and channel ROI interpretation
