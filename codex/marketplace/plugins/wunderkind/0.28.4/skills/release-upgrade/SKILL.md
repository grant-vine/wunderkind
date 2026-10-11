---
name: release-upgrade
description: "USE FOR: release planning, compatibility decisions, upgrade sequencing, and rollback-aware preparation."
---

# Release Upgrade

Provide product-level release and compatibility judgment before changes are published.

## Primary owner

`wunderkind-product`

## Filesystem scope

Release notes, versioned project metadata, compatibility notes, and rollout plans.

## When to trigger

Use when a release or dependency upgrade changes user-facing behavior or compatibility.

## Anti-triggers

Do not use for an isolated refactor with no release implication.

## Process

1. Identify compatibility surface and affected users.
2. Define sequencing, validation, and rollback conditions.
3. Route engineering, security, and legal concerns to the relevant specialists.

## Hard rules

Do not publish, tag, or change release metadata without explicit authorization.

## Review gate

The release path names compatibility checks and a viable rollback posture.
