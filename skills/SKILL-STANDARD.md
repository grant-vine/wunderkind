# Skill Standard

`skills/SKILL-STANDARD.md` is the authoritative repo-level contract for authoring and auditing Wunderkind-native skills.

It is derived from `skills/write-a-skill/SKILL.md` and turns that workflow into a reusable standard for every `skills/<skill-name>/SKILL.md` file in this repository.

## Purpose

- Make skill selection reliable from the description alone.
- Keep the main skill file fast to scan during runtime.
- Push rarely needed detail into optional deep-reference files instead of bloating `SKILL.md`.
- Tie every skill to a surviving Wunderkind owner and a clear artifact surface.

## Required contract

Every skill must define all of the following:

1. Trigger section: the exact conditions that should activate the skill.
2. Anti-trigger section: when the skill must not be used.
3. Ownership metadata: the surviving Wunderkind agent responsible for stewarding the skill.
4. Filesystem or artifact scope: the files, folders, commands, or durable outputs the skill is expected to touch.
5. Progressive disclosure: a short overview first, then operational steps, then optional deep dives.
6. Review gate: what must be true before the skill can be considered complete and publishable.

## Description standard

The frontmatter `description` is the trigger surface for the runtime. Write it trigger-first.

- Start with `USE FOR:`.
- Put the highest-signal trigger phrases in the first sentence.
- Mention concrete repo artifacts when relevant, such as `skills/*/SKILL.md`, `.sisyphus/`, `README.md`, `tests/unit/`, or `src/`.
- Prefer explicit task phrases over vague coaching language.
- Keep it concise enough to scan quickly, but specific enough to disambiguate from adjacent skills.

Good pattern:

```md
description: >
  USE FOR: capability-first trigger phrases, concrete repo artifacts, and the exact
  situations where this skill should be selected instead of a neighboring one.
```

## Standard structure

Each `SKILL.md` should use this shape unless a tighter variant is clearly better:

1. Frontmatter: `name`, trigger-first `description`
2. H1 title
3. One-paragraph overview: what the skill does and why it exists
4. `## Primary owner`
5. `## Filesystem scope` or `## Output target`
6. `## When to trigger`
7. `## Anti-triggers`
8. `## Process` or equivalent ordered workflow
9. Optional decision lenses, slash commands, or delegation patterns
10. `## Hard rules`
11. `## Review gate`

## Ownership metadata

Every skill must name one surviving owner from the retained topology:

- `product-wunderkind`
- `fullstack-wunderkind`
- `marketing-wunderkind`
- `creative-director`
- `ciso`
- `legal-counsel`

If a removed legacy agent is still mentioned for context, the surviving steward must be explicit and the note must explain the handoff boundary.

## Filesystem and artifact scope

Every skill must declare what it can read, write, or produce.

Typical scope patterns:

- Main asset: `skills/<skill-name>/SKILL.md`
- Optional deep references: `skills/<skill-name>/REFERENCE.md`, `skills/<skill-name>/EXAMPLES.md`
- Optional helper scripts: `skills/<skill-name>/scripts/`
- Durable project artifacts: `.sisyphus/notepads/`, `.sisyphus/evidence/`, `.sisyphus/triage/`, `.sisyphus/rfcs/`
- Published docs surfaces: `README.md`, `AGENTS.md`, or repo docs folders when the skill is documentation-facing

If a skill is analysis-only, say so explicitly. If it writes durable output, name the path pattern.

## Progressive disclosure

Keep the primary `SKILL.md` short enough for fast runtime scanning.

- Put the minimum viable overview and decision rules in `SKILL.md`.
- Move deep background, long examples, edge-case matrices, or command catalogs into optional sibling files.
- Reference deeper files only when they add real value for rare or complex paths.
- Prefer one clear workflow over encyclopedic prose.

Use this depth ladder:

1. Overview: capability, owner, and trigger surface
2. Core workflow: ordered steps and hard rules
3. Optional deep dive: references, examples, scripts, or research appendices

## Anti-triggers

Every skill must say what it is not for.

Minimum expectations:

- call out neighboring skills when boundary confusion is likely
- exclude trivial tasks that do not justify skill activation
- exclude generated output or unrelated repo areas when applicable
- exclude removed-agent ownership assumptions

## Optional deep assets

Create optional sibling assets only when the main skill becomes hard to scan without them.

- `REFERENCE.md`: long-form theory, policies, matrices, or terminology
- `EXAMPLES.md`: worked examples, sample prompts, or before/after outputs
- `scripts/`: repeatable helper automation that the skill relies on

If you add a deep asset, `SKILL.md` must still stand on its own for common cases.

## Review gate

A skill is complete only when all of the following are true:

1. The frontmatter description is trigger-first and distinguishable from neighboring skills.
2. The surviving owner is explicit and matches the retained topology.
3. Filesystem or artifact scope is named precisely.
4. Anti-triggers prevent accidental overuse.
5. The workflow follows progressive disclosure instead of dumping every detail into one file.
6. Optional deep assets, if present, are referenced deliberately and not required for basic use.
7. Hard rules define scope boundaries and failure conditions.
8. The skill inventory in this file remains accurate after the change.
9. `README.md` and `AGENTS.md` reflect ownership or inventory changes when the public surface changes.

## Authoring checklist

- Name the skill after the capability, not the persona.
- Write the description as a runtime trigger surface, not marketing copy.
- Declare the owner before describing the workflow.
- Name the durable outputs or confirm that the skill is read-only.
- Split rare detail into sibling files before `SKILL.md` becomes bloated.
- Keep repo-specific language stronger than generic methodology language.

## Skill inventory

| Skill Name | Current Owner | Disposition | Notes |
|---|---|---|---|
| `agile-pm` | `product-wunderkind` | revise | Keep as a product planning skill, but update removed-agent references and align the file to the full trigger/anti-trigger standard. |
| `compliance-officer` | `ciso` | keep | Still maps directly to security, privacy controls, and regulatory guidance under the retained topology. |
| `code-health` | `fullstack-wunderkind` | keep | Owns explicit, opt-in Desloppify cleanup workflows instead of auto-triggering on every coding task. |
| `db-architect` | `fullstack-wunderkind` | keep | Remains a distinct engineering specialty with clear database and migration scope. |
| `design-an-interface` | `fullstack-wunderkind` | keep | Newly imported and already follows the intended trigger and anti-trigger shape. |
| `experimentation-analyst` | `product-wunderkind` | revise | Reassign from removed `data-analyst`; center this skill on product experiments and feature readouts, with marketing consulted for campaign analytics. |
| `grill-me` | `product-wunderkind` | keep | Continues to serve as the ambiguity-collapsing intake skill for product framing. |
| `improve-codebase-architecture` | `fullstack-wunderkind` | keep | Still the right long-form RFC and architecture-boundary skill. |
| `oss-licensing-advisor` | `legal-counsel` | keep | Clear legal specialization with no ownership ambiguity. |
| `pen-tester` | `ciso` | keep | Remains the offensive-security counterpart to broader security analysis. |
| `prd-pipeline` | `product-wunderkind` | keep | Core orchestrator skill for PRD, plan, and delivery flow. |
| `security-analyst` | `ciso` | keep | Still the general defensive-security analysis skill under `ciso`. |
| `social-media-maven` | `marketing-wunderkind` | keep | Fits the consolidated marketing remit after brand and devrel absorption. |
| `tdd` | `fullstack-wunderkind` | revise | Reassign from removed `qa-specialist`; keep as the engineering execution skill for red-green-refactor work. |
| `technical-writer` | `marketing-wunderkind` | revise | Reassign from removed `devrel-wunderkind`; documentation and developer-facing content now live under marketing stewardship. |
| `triage-issue` | `product-wunderkind` | revise | Reassign from removed `support-engineer` and `qa-specialist`; product now owns front-door triage while engineering supports implementation. |
| `ubiquitous-language` | `product-wunderkind` | keep | Continues to support product-led terminology and shared domain language. |
| `vercel-architect` | `fullstack-wunderkind` | keep | Remains a focused platform-engineering skill with clear deployment scope. |
| `visual-artist` | `creative-director` | keep | Still belongs under the retained design and visual-language owner. |
| `write-a-skill` | `product-wunderkind` | revise | Keep as the practical authoring workflow, but make `skills/SKILL-STANDARD.md` the source of truth it references. |

## Change policy

- Do not hand-edit generated `agents/*.md` output to express skill standards.
- Update this file whenever a skill is added, reassigned, merged, retired, or materially repurposed.
- If a future audit decides a skill should merge or retire, record that disposition here before changing the public docs.
