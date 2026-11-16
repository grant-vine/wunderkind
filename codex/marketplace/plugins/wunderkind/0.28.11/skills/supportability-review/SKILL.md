---
name: supportability-review
description: "USE FOR: operability, rollback readiness, ownership, observability, and launch-readiness judgment."
---

# Supportability Review

Assess whether a service or change is supportable before launch.

## Primary owner

`wunderkind-architecture`

## Output target

A severity-ranked supportability assessment with owners and launch blockers.

## When to trigger

Use when a change needs an operability, rollback, or ownership review.

## Anti-triggers

Do not use as active incident command or generic debugging.

## Process

1. Review observability, rollback, and operational ownership.
2. Identify evidence gaps and launch blockers.
3. Route implementation work to native Codex or OMO.

## Hard rules

Keep readiness review separate from incident response.

## Review gate

Each blocker has an owner, severity, and observable closure condition.
