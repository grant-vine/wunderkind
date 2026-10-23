---
name: prd-pipeline
description: "USE FOR: product requirements, implementation-ready planning, and filesystem-first product handoff."
---

# PRD Pipeline

Turn validated product intent into a bounded, execution-ready handoff.

## Primary owner

`wunderkind-product`

## Filesystem scope

`.omo/plans/`, project documentation, and an optional tracker handoff.

## When to trigger

Use when requirements need decisions, acceptance criteria, and a delivery path.

## Anti-triggers

Do not use for a small implementation with already-complete acceptance criteria.

## Process

1. Define outcome, constraints, and non-goals.
2. Shape acceptance criteria and risks with the relevant specialists.
3. Hand off execution through OMO planning and work lanes.

Only enter this planning workflow when the user asks for product requirements, a PRD, or an implementation plan. For an ordinary authorized implementation request with clear acceptance criteria, proceed to the requested work without requiring a plan or approval gate. When handing work to Codex agents, use native delegation with an exact installed role and a self-contained task message; see the `wunderkind` workflow skill for the current tool fields.

## Hard rules

Filesystem workflow state stays authoritative unless the project explicitly selects a tracker projection.

## Review gate

The handoff has observable acceptance criteria and a clear owner.
