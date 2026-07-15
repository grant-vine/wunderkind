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
- Mention concrete repo artifacts when relevant, such as `skills/*/SKILL.md`, `.omo/`, `README.md`, `tests/unit/`, or `src/`.
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
- Durable project artifacts: `.omo/notepads/`, `.omo/evidence/`, `.omo/triage/`, `.omo/rfcs/`
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
8. The bucketed skill inventory in this file remains accurate after the change.
9. `README.md` and `AGENTS.md` reflect ownership or inventory changes when the public surface changes.

## Authoring checklist

- Name the skill after the capability, not the persona.
- Write the description as a runtime trigger surface, not marketing copy.
- Declare the owner before describing the workflow.
- Name the durable outputs or confirm that the skill is read-only.
- Split rare detail into sibling files before `SKILL.md` becomes bloated.
- Keep repo-specific language stronger than generic methodology language.

### Task Delegation Contract

If a skill includes `task(...)` examples, they MUST include both required fields:

- `load_skills: []` (or the relevant skill list) — never omit
- `run_in_background: true | false` — never omit, must be explicit

Use `skill(name="<skill>")` syntax for skill invocations; never wrap skill calls in `task()`.

Historical `.sisyphus/**` archives are intentionally excluded from this compliance change.

## Skill inventory

The convergence release classifies every current skill into one bucket. These buckets replace the older loose `keep` and `revise` disposition model.

Bucket counts are frozen by `.omo/contracts/wunderkind-upstream-convergence.jsonc` for this release:

- Promoted retained specialist skills: 19
- Wunderkind-specific skills: 4
- Deprecated skills: 1
- Internal skills: 0
- Remove-now skills: 0

### Bucket definitions

| Bucket | Meaning | Public behavior |
|---|---|---|
| Promoted retained specialist | A current skill that remains user-facing because it strengthens one retained Wunderkind agent's specialist remit. | May appear in public skill listings, routing guidance, and install or upgrade inventory. |
| Wunderkind-specific | A current skill that exists because of Wunderkind's retained-agent overlay, `.omo` workflow, docs-output flow, or repo-local skill authoring model. | May appear in public listings, but its justification must be tied to Wunderkind-specific workflow. |
| Deprecated | A current file kept only for migration history, public replacement guidance, or detection-only diagnostics. | Must not be promoted as a first-class route. Must not power execution-time alias behavior. |
| Internal | A non-promoted skill reserved for implementation internals. | None in this release. Future internal skills must not appear as public routes. |
| Remove-now | A skill approved for deletion in the current release. | None in this release. No extra skill names may be removed without scope-change approval. |

### Deprecated alias handling

Deprecated aliases and routes are docs, routing-guidance, and detection-only surfaces only.

- Docs may name a deprecated skill to explain history and the replacement route.
- Routing guidance may say what to use instead.
- Diagnostics may detect deprecated state to print migration guidance.
- Runtime selection, command metadata, fallback routing, dual-read behavior, dual-write behavior, and automatic alias execution are forbidden.

`design-an-interface` is deprecated in this release. New interface-design work should route through `improve-codebase-architecture` when the concern is structural, through `fullstack-wunderkind` for narrow engineering judgement, or through product and frontend exploration when the interface is shaped by user workflow or prototype evidence.

### Promoted retained specialist skills

| Skill Name | Current Owner | Wunderkind-specific reason |
|---|---|---|
| `agile-pm` | `product-wunderkind` | Keeps sprint planning and task decomposition inside the retained product front door so work can become `.omo` plans, issues, and acceptance gates. |
| `code-health` | `fullstack-wunderkind` | Keeps engineering hygiene as a read-only specialist audit under the retained CTO persona, with severity-ranked markdown output rather than generic cleanup automation. |
| `compliance-officer` | `ciso` | Maps privacy, data classification, and regulatory control guidance to the retained security and compliance owner. |
| `db-architect` | `fullstack-wunderkind` | Keeps database schema, Drizzle, PostgreSQL, Neon, migration, and index decisions under the retained engineering owner. |
| `diagnose` | `fullstack-wunderkind` | Provides deterministic defect isolation before repair work, aligned with Wunderkind's verification and evidence lanes. |
| `experimentation-analyst` | `product-wunderkind` | Keeps product experiments, readouts, guardrails, and feature decisions with the retained product owner. |
| `grill-me` | `product-wunderkind` | Gives the retained product front door a focused way to collapse ambiguity before specs, plans, or issue shaping. |
| `improve-codebase-architecture` | `fullstack-wunderkind` | Handles structural design, module seams, RFCs, and architecture tradeoffs for the retained engineering owner. |
| `oss-licensing-advisor` | `legal-counsel` | Keeps open source license compatibility and notice obligations under the retained legal owner. |
| `pen-tester` | `ciso` | Keeps offensive security testing and exploitability framing under the retained security owner. |
| `prd-pipeline` | `product-wunderkind` | Connects PRDs, work plans, and issue flow to Wunderkind's filesystem-first `.omo` workflow. |
| `security-analyst` | `ciso` | Keeps defensive security review, OWASP analysis, and vulnerability assessment under the retained CISO owner. |
| `social-media-maven` | `marketing-wunderkind` | Keeps channel strategy, content planning, and community growth inside the retained marketing owner. |
| `tdd` | `fullstack-wunderkind` | Preserves the repo's Bun and strict TypeScript red-green-refactor execution loop under engineering stewardship. |
| `technical-writer` | `marketing-wunderkind` | Keeps developer docs, launch guides, tutorials, and reference quality under the retained marketing and docs owner. |
| `triage-issue` | `product-wunderkind` | Keeps support intake, reproduction clarity, acceptance criteria, and backlog handoff under product stewardship. |
| `ubiquitous-language` | `product-wunderkind` | Keeps glossary, naming, and domain language alignment close to product decisions and `.omo` knowledge lanes. |
| `vercel-architect` | `fullstack-wunderkind` | Keeps Vercel, Next.js, runtime, and deployment tradeoffs under the retained engineering owner. |
| `visual-artist` | `creative-director` | Keeps brand, visual language, accessibility, and token decisions under the retained creative owner. |

### Wunderkind-specific skills

| Skill Name | Current Owner | Why it is Wunderkind-specific |
|---|---|---|
| `docs-with-grill` | `product-wunderkind` | Exists for repo-aware docs grilling that maintains `CONTEXT.md` and coordinates with Wunderkind's docs-output workflow. |
| `setup-wunderkind-workflow` | `product-wunderkind` | Defines local `.omo`, triage, glossary, docs, and issue-flow conventions for Wunderkind-enabled projects. |
| `write-a-skill` | `product-wunderkind` | Authors and adapts skills inside Wunderkind's retained-agent and filesystem-first standard. |
| `caveman` | `product-wunderkind` | Provides Wunderkind's explicit terse-mode communication contract without changing technical substance. |

### Deprecated skills

| Skill Name | Previous Owner | Replacement route | Allowed remaining references |
|---|---|---|---|
| `design-an-interface` | `fullstack-wunderkind` | Use `improve-codebase-architecture` for structural interface and module-boundary work; use `fullstack-wunderkind` directly for narrow engineering judgement; use product or frontend exploration when user workflow shapes the contract. | Migration notes, historical docs, public replacement guidance, and detection-only diagnostics. Not execution-time routing. |

### Internal skills

None in this release.

### Remove-now skills

None in this release. No additional skill names may be removed without explicit scope-change approval.

## Change policy

- Do not hand-edit generated `agents/*.md` output to express skill standards.
- Update this file whenever a skill is added, reassigned, merged, retired, or materially repurposed.
- If a future audit decides a skill should merge, retire, or change bucket, record that bucket change here before changing the public docs.
