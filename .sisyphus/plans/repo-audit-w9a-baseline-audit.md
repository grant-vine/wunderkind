# Repo Audit W9A — Baseline Audit

## Objective

Conduct a comprehensive repository-wide audit to identify code reuse opportunities, architectural inconsistencies, best-practice gaps, and current test coverage posture.

## Scope

- Perform a full code review of the `src/` directory, focusing on CLI, config, and agent logic.
- Assess current test coverage across the repository.
- Identify duplicated logic and hotspots for refactoring.
- Create a baseline audit report with prioritized findings.

## Depends On

- None (Discovery-first workstream)

## Files in Scope

- Entire repository (`src/*`, `tests/*`, `package.json`, `README.md`, `AGENTS.md`)

## Product Decisions / Frozen Contract

- **Wave Contract**: Audit and remediation run in the same wave (W9A + W9B).
- **Severity Rubric**:
  - High: Critical security, data loss, or core lifecycle breakage.
  - Medium: Technical debt, duplication, or non-critical bugs.
  - Low: Stylistic or cosmetic issues.
- **Reporting**: Each finding must be assigned a unique ID (e.g. `AUD-001`) and include a remediation recommendation and estimated remediation budget (hours/complexity).
- **Remediation Budget**: W9A must define a total remediation budget for W9B (e.g. "Remediate up to 10 identified findings, prioritized by severity").

## Deliverables

- Detailed audit report.
- Measured test coverage posture (if tooling allows).
- List of prioritized refactor targets.

## Task Breakdown

### Task W9A.1 — Best-Practices and Code Reuse Review

- **Action:** Review `src/cli/*` for duplicated logic in flag handling, error reporting, and UI helpers.
- **Action:** Check `src/agents/*.ts` for consistency in factory functions and prompt construction.
- **Action:** Verify adherence to the project's TypeScript conventions (no `any`, no `@ts-ignore`).

### Task W9A.2 — Config Contract Consistency Audit

- **Action:** Verify that all config-reading locations use the shared `config-manager`.
- **Action:** Check for hardcoded paths or inconsistent fallback behavior.
- **Action:** Audit existing global config files for legacy personality fields.

### Task W9A.3 — Test Coverage Posture Assessment

- **Action:** Evaluate the current test suite's breadth.
- **Action:** Identify critical paths lacking unit or smoke tests (e.g., TUI flows, uninstall side effects).
- **Action:** Document the measured or explicitly unmeasured confidence level for the existing code, without inventing a coverage percentage that the repo cannot currently produce.

## QA Scenarios

```text
Scenario: Baseline audit produces actionable findings
  Setup: define the audit checklist, severity rubric, and finding ID format before execution.
  Run: Execute the audit checklist against the repository.
  Assert: Audit report includes unique Finding IDs (AUD-XXX).
  Assert: Each finding has an assigned Severity and Remediation Recommendation.
  Assert: A total Remediation Budget is defined for W9B.
  Evidence: .sisyphus/evidence/w9a-audit-report-baseline.txt

Scenario: Identification of duplicated logic
  Run: Use `grep` or AST-based tools to find duplicated helpers.
  Assert: Findings are documented with file/line references.
  Evidence: .sisyphus/evidence/w9a-logic-duplication-map.txt
```

## Commit Strategy

- **Commit W9A-A**: `docs(audit): publish repository-wide baseline audit report`
- **Commit W9A-B**: `docs(audit): document test coverage posture and remediation priorities`

## Exit Conditions

- [x] Audit report is complete and reviewed.
- [x] Severity rubric is established.
- [x] Remediation list for W9B is finalized.
