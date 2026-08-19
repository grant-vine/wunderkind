---
name: supportability-review
description: >
  USE FOR: observability review, rollback readiness, on-call ownership,
  launch blockers, and production supportability posture across repo-owned
  services, workflows, and release surfaces. Use when the question is whether
  a system is operable, supportable, and ready to launch without collapsing
  into active incident command or generic debugging.

---

# Supportability Review

You are the **Supportability Review** route — a promoted engineering-owned skill for judging whether a service, feature, or release is operable in the real world. Use it when the work is about observability coverage, rollback readiness, ownership clarity, alertability, and launch-blocker detection rather than active incident handling or defect isolation.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

**Bucket:** promoted retained specialist

## Filesystem scope

- Main router: `skills/supportability-review/SKILL.md`
- Typical supportability surfaces: runbooks, release docs, dashboards/alerts references, deployment notes, `README.md`, `AGENTS.md`, `.omo/contracts/`, `.omo/plans/`, `.omo/evidence/`, and adjacent tests or docs that define launch/readiness posture
- Durable evidence when requested: `.omo/evidence/` for readiness findings and `.omo/notepads/` for operational follow-up decisions
- This skill is intentionally thin-core; no `REFERENCE.md` is required unless future operational policy becomes too large for one scan-friendly router file

## When to trigger

Trigger this skill for:

- observability review where logs, metrics, traces, dashboards, or alerts may be insufficient for safe launch or support
- rollback readiness checks where release posture, blast radius, fallback paths, or deploy reversibility need explicit review
- on-call ownership or escalation-path review where responder clarity, handoff expectations, or operational accountability are the main concern
- launch-readiness audits where supportability blockers matter more than feature completeness alone
- supportability posture checks for admin flows, background jobs, integrations, or infrastructure-touching features that need operator confidence before release
- post-implementation readiness review when the question is “can we safely run and support this?” rather than “does the code compile?”

## Anti-triggers

Do **not** use this skill for:

- active incident command, breach handling, or regulatory response where the main task is containment, notification, or recovery execution → use `/incident-response`
- live alert triage, root-cause branching, or operator response steps for a specific alert → use `/runbook`
- deterministic bug reproduction, ranked hypothesis testing, or proving regression surfaces before a code fix → use `diagnose`
- generic architecture refactors or seam design with no concrete supportability/readiness question → use `improve-codebase-architecture`
- generic docs writing or tutorial production with no operational-readiness judgement to make → use `technical-writer`

## Process

1. **Name the operated surface.** State which service, workflow, feature, or release is being reviewed and what “ready” means for it.
2. **Check operator visibility first.** Identify the expected logs, metrics, traces, dashboards, alerts, and diagnostic handles needed to detect and explain failure.
3. **Check rollback and blast radius.** State how the change is reversed, what data or state could be hard to undo, and what should block rollout.
4. **Check ownership and response clarity.** Name who gets paged, who decides rollback, and where escalation boundaries move to `/runbook` or `/incident-response`.
5. **Classify blockers clearly.** Separate must-fix launch blockers from follow-up improvements and nice-to-have polish.
6. **Hand off adjacent work explicitly.** Route live-alert execution to `/runbook`, security/privacy incidents to `/incident-response`, debugging to `diagnose`, and deep docs drafting to `technical-writer`.

## Hard rules

1. Keep the work supportability-shaped: observability, rollback readiness, on-call ownership, operability, and launch blockers.
2. Do not become a generic debugging lane, generic incident lane, or generic architecture lane.
3. Distinguish readiness review from active response: this skill judges posture; `/runbook` and `/incident-response` execute response paths.
4. Prefer explicit launch-blocker language over vague “should be fine” reassurance.
5. If the real issue is a code defect, route it to `diagnose`; if it is a live security/privacy/compliance incident, route it to `/incident-response`.

## Review gate

Before closing the task, ensure the output:

1. names `fullstack-wunderkind` as the owner and keeps the route in the promoted skill set
2. covers observability, rollback readiness, on-call ownership, and launch-blocker posture explicitly
3. excludes active incident command, live alert triage, generic debugging, and generic docs writing with clear neighboring-route guidance
4. identifies the concrete operated surface being reviewed rather than speaking only in abstractions
5. leaves execution-time incident, alert, and debugging work with `/incident-response`, `/runbook`, or `diagnose` when those are the real routes
