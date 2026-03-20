---
name: code-health
description: >
  USE FOR: code health audits, engineering hygiene assessments, coupling analysis,
  testability reviews, dependency classification, severity-ranked findings reports,
  and identifying systemic code quality patterns across a codebase.

---

# Code Health

Produce a structured, evidence-based code health audit report with severity-ranked findings. This skill is an analysis and reporting tool — it does not mutate code, create GitHub issues or RFCs, or run automated cleanup tools.

## Primary owner

**Owned by:** wunderkind:fullstack-wunderkind

This skill is owned by `fullstack-wunderkind` as the surviving steward for code quality, TDD, architecture, and engineering methods.

## Output target

Produce a structured markdown audit report as the response output. Do not write the report automatically to a fixed file path. If the user wants the report persisted, they can ask you to write it to a file of their choosing.

## Filesystem scope

- Read access: all source files, test files, config files, and dependency manifests in the project
- Write access: none (read-only analysis; output is in-response markdown)
- Supporting repo surfaces may include: `src/`, `tests/`, `package.json`, lock files, `tsconfig.json`, build configs

## When to trigger

Use this skill when:

- the user explicitly requests a code health audit, engineering hygiene review, or quality assessment
- the goal is to understand coupling, testability, or architectural debt before making changes
- the user wants a prioritised finding list with severity levels before deciding what to fix
- a project needs a baseline quality snapshot before a refactor or new feature sprint

## Anti-triggers

Do not trigger this skill for:

- every normal coding task by default
- product feature delivery (use `fullstack-wunderkind` directly)
- architecture RFC creation or interface design (use `improve-codebase-architecture`)
- TDD workflow support (use `tdd`)
- docs-only or generated-file changes

## Severity taxonomy

Every finding must be assigned one of five severity levels:

| Level | Meaning |
|---|---|
| `critical` | Causes data loss, security exposure, or blocking build failures; must be fixed before shipping |
| `high` | Causes reliability failures, significant coupling, or test blindness; should be fixed promptly |
| `medium` | Causes friction, testability problems, or hidden coupling; fix when adjacent work touches the area |
| `low` | Minor hygiene, naming inconsistency, or low-impact debt; fix opportunistically |
| `informational` | Observations worth noting but requiring no immediate action |

**Target state:** zero `critical` and `high` findings in a healthy codebase. Medium-or-lower findings are acceptable when the agent explains the tradeoff or records a deferral rationale.

## Process

1. **Discover entry points.** Identify the module structure: entry files, public APIs, CLI surfaces, exported types, and build output shape. Map what callers depend on.

2. **Map coupling and seam boundaries.** Trace which modules import which. Identify tight coupling (direct instantiation, shared mutable state, circular dependencies). Note where seams exist for testing and where they are absent.

3. **Assess testability.** For each significant module, ask: Can this be tested in isolation? Are side effects injectable or faked? Are there untested branches with production risk? Identify coverage gaps tied to real failure modes rather than line metrics alone.

4. **Classify dependencies.** Separate:
   - Core domain logic (should be dependency-free or near-free)
   - Infrastructure adapters (file I/O, network, database, CLI frameworks)
   - Dev tooling (test runners, type checkers, bundlers)
   - Transitive risk (pinned vs unpinned, maintained vs abandoned)

5. **Rank findings by severity.** Assign each finding a severity level from the taxonomy above. Group by severity tier. Do not inflate severity — be honest about what is `medium` vs `high`.

6. **Produce the audit report.** Write the report in the response using the report shape below.

## Report shape

```markdown
# Code Health Audit — <Project or Scope>

## Executive Summary
One paragraph: overall health signal, dominant pattern, highest-priority concern.

## Findings by Severity

### Critical
- **[File:Line or Module]** — Description of the finding and why it is critical.

### High
- **[File:Line or Module]** — Description.

### Medium
- **[File:Line or Module]** — Description.

### Low
- **[File:Line or Module]** — Description.

### Informational
- **[File:Line or Module]** — Observations worth noting.

## Priority Action List
Ordered list of the 3–7 highest-leverage actions to improve health.
Each action should name the file/module and describe the change at a concrete level.

## Systemic Patterns
Recurring patterns (good or bad) that appear across multiple files/modules.
Name the pattern, cite 2–3 examples, and note whether it is an asset or a liability.

## Appendix
Optional: dependency graph fragments, coupling diagrams, notes on external references.
```

## Hard rules

1. This skill is read-only and analysis-only. Do not modify code, run cleanup tools, or generate automated fixes.
2. Do not create GitHub issues, PRs, or RFCs as part of this workflow.
3. Do not present the audit as a set of "pick one" options — produce findings and a priority list, then let the engineer decide what to act on.
4. Do not inflate severity. Reserve `critical` for genuine blocking risks.
5. Medium-or-lower findings may be explained or deferred; document the rationale when deferring.
6. The report is produced in the response. Do not write it automatically to a fixed file path.
7. Do not require network access to run the audit. All analysis is based on local filesystem inspection.

## Review gate

This skill is complete only when:

1. `fullstack-wunderkind` is named as the primary owner.
2. The severity taxonomy (`critical`, `high`, `medium`, `low`, `informational`) is defined.
3. The six audit workflow steps are explicit.
4. The report shape includes: Executive Summary, Findings by Severity, Priority Action List, Systemic Patterns, Appendix.
5. The skill explicitly states it is read-only and does not mutate code or create external artifacts.
6. No references to automated code-cleanup tools, package-manager install workflows, or any language suggesting the skill mutates code appear anywhere in the file.
