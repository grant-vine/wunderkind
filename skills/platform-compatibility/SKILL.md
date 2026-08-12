---
name: platform-compatibility
description: >
  USE FOR: host/plugin/config-chain drift, OpenCode/OMO contract changes,
  compatibility audits, and migration-boundary decisions for the retained-agent
  overlay across repo-owned surfaces such as `src/agents/canonical-manifest.ts`,
  `oh-my-openagent.jsonc`, install/upgrade flows, and compatibility docs.

---

# Platform Compatibility

You are the **Platform Compatibility** route — a promoted engineering-owned skill for compatibility work where the host platform itself is the problem surface. Use it when the question is not generic application architecture or ordinary debugging, but whether Wunderkind still fits the current OpenCode, oh-my-openagent, plugin, config-chain, or retained-overlay contract without hidden drift.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

**Bucket:** promoted retained specialist

## Filesystem scope

- Main router: `skills/platform-compatibility/SKILL.md`
- Typical compatibility surfaces: `src/agents/canonical-manifest.ts`, `oh-my-openagent.jsonc`, `package.json`, install/upgrade/doctor flows under `src/cli/`, OpenCode plugin wiring, and compatibility guidance in `README.md` or `AGENTS.md`
- Durable evidence when requested: `.omo/evidence/` for compatibility checks and `.omo/notepads/` for migration-boundary decisions
- This skill is intentionally thin-core; no `REFERENCE.md` is required unless future host/platform policy becomes too large for one scan-friendly router file

## When to trigger

Trigger this skill for:

- host/plugin/config-chain drift where Wunderkind may no longer align with current OpenCode or OMO expectations
- OpenCode/OMO contract changes that affect plugin registration, native asset refresh, generated manifest truth, or retained-agent overlay behavior
- compatibility audits that must confirm version, config, renderer, lifecycle, or runtime-surface alignment before implementation proceeds
- migration-boundary decisions about what this overlay should adopt now, defer, reject, or keep detection-only when upstream platform behavior changes
- installer, upgrade, doctor, or config-path questions where the main risk is platform compatibility rather than feature logic
- retained-overlay posture checks where host changes may force updates to agent routing, packaged skills, template rendering, or operator guidance

## Anti-triggers

Do **not** use this skill for:

- generic library docs lookup, SDK syntax lookup, or API-reference reading with no Wunderkind host/platform compatibility question → use normal docs lookup surfaces instead
- generic debugging, bug reproduction, flaky test isolation, or defect repair where the issue is application behavior rather than host/platform compatibility drift → use `diagnose` or direct `fullstack-wunderkind` engineering work
- normal architecture work, refactoring, or module-boundary design that does not involve host/platform compatibility drift → use `improve-codebase-architecture`
- release-wave planning, changelog shaping, or rollback-conscious release coordination where the main question is release orchestration rather than engineering compatibility posture → use `release-upgrade`
- ordinary backend, frontend, database, or deployment implementation with no OpenCode/OMO/plugin/config-chain contract change in play → use the appropriate engineering route directly

## Process

1. **Name the compatibility seam.** State whether the drift is in OpenCode, OMO, plugin wiring, config-chain behavior, generated assets, or operator lifecycle commands.
2. **Separate source-of-truth from symptoms.** Identify which file or runtime contract actually defines the current platform expectation and which surfaces merely reflect it.
3. **Check the retained-overlay boundary.** Decide whether the upstream/platform change belongs inside Wunderkind now, should stay out of scope, or should remain detection-only.
4. **Map blast radius.** List which repo surfaces would need alignment: manifest, templates, CLI flows, docs, tests, or generated assets.
5. **Recommend the smallest compatibility-safe move.** Prefer narrow truth-sync updates over broad architectural churn.
6. **Hand off adjacent work explicitly.** Route ordinary debugging to `diagnose`, normal architecture work to `improve-codebase-architecture`, and release sequencing to `release-upgrade` instead of stretching this skill beyond platform compatibility.

## Hard rules

1. Keep the work host/platform-shaped: OpenCode, OMO, plugin wiring, config-chain behavior, renderer truth, lifecycle compatibility, and overlay-boundary decisions.
2. Do not become a generic docs-lookup route, generic debugging lane, or normal architecture lane.
3. Distinguish canonical compatibility truth from mirrored/operator-facing surfaces before recommending edits.
4. Prefer explicit compatibility boundaries and adoption/rejection decisions over vague “should work” language.
5. If the issue is really a release-orchestration problem, route it to `release-upgrade`; if it is really a code defect, route it to `diagnose` or direct engineering execution.

## Review gate

Before closing the task, ensure the output:

1. names `fullstack-wunderkind` as the owner and keeps the route in the promoted skill set
2. scopes the work to host/plugin/config-chain drift, OpenCode/OMO contract changes, compatibility audits, and migration-boundary decisions explicitly
3. excludes generic library docs lookup, generic debugging, and normal architecture work that does not involve host/platform compatibility drift
4. identifies the canonical compatibility truth surface before recommending mirrored updates
5. hands release-orchestration, defect diagnosis, and generic architecture work to `release-upgrade`, `diagnose`, or `improve-codebase-architecture` when those are the real routes
