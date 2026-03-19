# Orchestrator-First Topology Decision

This document defines the fixed target topology for the Wunderkind agent harness. It is the implementation contract for prompt rewrites, routing behavior, personality-key cleanup, and later manifest/docs pruning work.

## Decision

Wunderkind moves to a six-agent retained topology with `product-wunderkind` as the default orchestrator and front door for all incoming Wunderkind requests.

The orchestrator owns the intake layer and answer quality, but it does not absorb every specialist domain into one giant prompt. Instead, it clarifies the request, routes specialist work to the correct retained owner, synthesizes the returned work, and ensures the final answer matches the user's real decision or execution need.

## Retained Agent Set

Retain these six existing canonical agent IDs. Reuse the current IDs exactly; do not introduce new namespaces, aliases, or replacement IDs.

1. `product-wunderkind` — orchestrator and default front door
2. `fullstack-wunderkind` — engineering execution and technical reliability owner
3. `marketing-wunderkind` — marketing, launch, brand, community, and developer-audience owner
4. `creative-director` — UX, design-system, and visual-language owner
5. `ciso` — security, privacy, compliance-controls, and technical incident posture owner
6. `legal-counsel` — licensing, contracts, legal interpretation, and formal policy sign-off owner

Native references must keep using the same existing key shape when a fully qualified agent name is needed: `wunderkind:<existing-id>`. Example: `wunderkind:product-wunderkind`.

## Orchestrator Contract

`product-wunderkind` is the only retained base agent that acts as the default front door for every Wunderkind request.

It owns:

- intake and initial problem framing
- clarification when the request is underspecified or mixes multiple concerns
- routing to the right retained specialist when domain authority leaves product territory
- synthesis of delegated specialist output back into one coherent answer
- final-answer quality, including whether the answer is decision-ready, build-ready, or escalation-ready

The orchestrator flow is fixed:

1. intake — understand the request, user goal, and expected outcome
2. clarification — resolve ambiguity, missing constraints, and success criteria
3. routing — send domain-specific work to the correct retained specialist
4. synthesis — combine specialist findings into one coherent recommendation or plan
5. final answer — return the highest-quality answer that preserves specialist authority and user intent

## Fixed Landing Rules

Route capability categories to the following retained owners:

- Product analytics, usage interpretation, prioritization, issue intake, repro shaping, acceptance review, and roadmap decisions -> `product-wunderkind`
- TDD execution, regression defense, coverage analysis, root-cause debugging, technical triage, reliability work, runbooks, and engineering implementation -> `fullstack-wunderkind`
- Campaign and funnel analysis, brand/community strategy, developer advocacy, launch messaging, and docs-driven launches -> `marketing-wunderkind`
- UX flows, design systems, visual language, accessibility, typography, and design tokens -> `creative-director`
- Security controls, privacy controls, compliance-control posture, threat modeling, vulnerability work, and technical incident posture -> `ciso`
- Licensing, contracts, legal interpretation, regulatory obligations, and formal policy sign-off -> `legal-counsel`

These landing rules are fixed topology rules, not optional suggestions.

## Self-Delegation Prohibition

`product-wunderkind` MUST route to retained specialists rather than attempting to cover their domains directly.

The orchestrator must never:

- self-delegate back into another copy of `product-wunderkind`
- create unlimited specialist duplication or fan-out loops
- absorb engineering, design, security, marketing, or legal authority into the product prompt just because it is the front door
- keep rerouting the same request between orchestrator layers without producing a bounded next action

If a request lands outside product's owned domain, `product-wunderkind` clarifies the need and hands off to the correct specialist owner. Product remains responsible for synthesis and final-answer quality, not for impersonating the downstream specialist.

## Product Depth Preservation

Orchestration must not cannibalize product depth.

`product-wunderkind` keeps explicit ownership of the product-specialist skills that already hold deep product practice:

- `grill-me`
- `prd-pipeline`
- `ubiquitous-language`
- `triage-issue`

These skills remain product-owned so the orchestrator can still perform deep product work when the request is truly product-shaped. The front-door role expands routing and synthesis responsibility; it does not remove product craft.

## Canonical ID Rules

- Reuse the existing retained IDs exactly as they already appear in source and native references.
- Do not mint new namespaces, prefixes, or replacement slugs.
- Do not create an additional orchestrator namespace; `product-wunderkind` is the orchestrator.
- Future consolidation work should remove retired agents from manifests and docs, but retained agents keep their current canonical IDs.

## Personality-Key Retirement Plan

Retire the removed-agent personality keys and fold them into the surviving retained personalities as follows:

- `brandPersonality` -> `cmoPersonality`
- `devrelPersonality` -> `cmoPersonality`
- `qaPersonality` -> `ctoPersonality` + `productPersonality`
- `supportPersonality` -> `productPersonality` + `ctoPersonality`
- `opsPersonality` -> `ctoPersonality` + `cisoPersonality`
- `dataAnalystPersonality` -> `productPersonality` + `cmoPersonality`

Interpretation rules for the split folds:

- product-side intake, prioritization, analytics interpretation, and acceptance review behaviors fold into `productPersonality`
- engineering execution, debugging, regression, and reliability behaviors fold into `ctoPersonality`
- campaign, community, devrel, and outward-facing measurement behaviors fold into `cmoPersonality`
- security-incident posture and compliance-control behaviors fold into `cisoPersonality`

## Retirement Plan For Removed Base Agents

The six removed base-agent keys retire by capability fold-in, not by replacement namespace creation:

- `brand-builder` -> merge into `marketing-wunderkind`
- `devrel-wunderkind` -> merge into `marketing-wunderkind`
- `qa-specialist` -> split between `product-wunderkind` and `fullstack-wunderkind`
- `support-engineer` -> split between `product-wunderkind` and `fullstack-wunderkind`
- `operations-lead` -> split between `fullstack-wunderkind` and `ciso`
- `data-analyst` -> split between `product-wunderkind` and `marketing-wunderkind`

Later cleanup tasks may remove those retired base-agent surfaces from manifests, docs, and generated assets. This decision document only establishes the target topology and routing contract.
