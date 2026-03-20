---
name: write-a-skill
description: >
  USE FOR: authoring new Wunderkind-native skills, adapting external skill patterns,
  defining skill triggers, and deciding when a skill needs extra reference files or
  scripts. Use when work belongs in `skills/*/SKILL.md` instead of TypeScript.

---

# Write a Skill

Adapted from Matt Pocock's benchmark skill, but rewritten for Wunderkind's repo-local,
filesystem-first workflow.

## Primary owner

**Owned by:** wunderkind:product-wunderkind

This skill is primarily run by `product-wunderkind` when the goal is to shape agent
behavior and capability boundaries.

`fullstack-wunderkind` may support when the skill needs scripts, repo wiring, or
technical validation.

## Filesystem scope

- Main asset: `skills/<skill-name>/SKILL.md`
- Optional references: `skills/<skill-name>/REFERENCE.md`, `skills/<skill-name>/EXAMPLES.md`
- Supporting evidence: `.sisyphus/evidence/`
- Durable learnings: `.sisyphus/notepads/`

`skills/SKILL-STANDARD.md` is the authoritative skill-writing standard for this repo.
New and revised skills must follow it: trigger-first descriptions, explicit surviving ownership,
filesystem scope, anti-triggers, and review gates.

## Process

1. Identify the exact capability gap and the owning Wunderkind persona.
2. Define triggers the agent can reliably match from the skill description alone.
3. Decide whether the workflow is filesystem-first, command-first, or analysis-first.
4. Keep `SKILL.md` concise; split rarely used detail into sibling reference files.
5. Record why the skill exists and what it should not be triggered for.

## Description rules

The description is the selection surface for the agent runtime.

- State the capability in the first sentence.
- Include concrete trigger phrases after `USE FOR:`.
- Mention file paths, artifacts, or repo contexts when relevant.
- Prefer repo-specific language over generic coaching language.

## Authoring checklist

- Name the primary owner explicitly.
- Point to the expected filesystem targets.
- Include a short process with ordered steps.
- Add hard rules for scope control and anti-patterns.
- Mention adjacent Wunderkind skills if the boundary matters.

## Anti-triggers

Do not use this skill for:

- small one-off prompt tweaks to an existing skill
- TypeScript or CLI feature work that belongs in `src/`
- generated content that should live in `agents/`
- vague capability ideas with no clear owner or trigger surface

## Hard rules

1. Skills are authored in `skills/*/SKILL.md`, not in generated `agents/` output.
2. Every skill must name its owner, trigger surface, and filesystem scope.
3. Do not copy external skills verbatim; adapt them to Wunderkind personas and artifacts.
4. If a workflow produces durable project knowledge, store it in `.sisyphus/`.
5. Keep the main skill tight enough to scan quickly during agent selection.
