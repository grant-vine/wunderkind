# Repo Audit W9B — Remediation

## Objective

Remediate the accepted findings from the baseline audit (W9A) within a defined budget and scope.

## Scope

- Apply focused fixes for architectural inconsistencies, logic duplication, and best-practice gaps identified in W9A.
- Refactor hotspots identified in the baseline audit.
- Improve test coverage in critical areas if gaps were found.

## Depends On

- W9A — Baseline Audit (for findings)
- All feature workstreams (W1–W8, for final context)

## Files in Scope

- Variable (based on W9A findings)
- Likely `src/cli/*`, `src/index.ts`, `src/agents/*.ts`

## Product Decisions / Frozen Contract

- **Budget**: Remediation must focus on high-priority items first.
- **Risk Rule**: Avoid broad architectural changes that could delay the entire wave unless they are critical to the W2/W3/W8 goals.
- **Verification**: Each fix must have targeted proof (tests/diffs) and be explicitly linked to its `AUD-XXX` finding ID from the W9A report.
- **Measurable Improvement**: Remediation work MUST be tied to the measured baseline from W9A. Do NOT claim vague "coverage improvements" without reference to the original baseline metric.

## Deliverables

- Set of remediation commits addressing the prioritized findings.
- Targeted unit/smoke tests for remediated logic.
- Updated audit report showing status changes.

## Task Breakdown

### Task W9B.1 — High-Priority Remediation

- **Action:** Fix any "High" severity findings from W9A.
- **Action:** Refactor critical logic duplication in the CLI or config manager.
- **Action:** Resolve any TypeScript convention violations.

### Task W9B.2 — Architectural Consistency Alignment

- **Action:** Ensure all new and existing commands follow the lifecycle naming and help-text standards from W1.
- **Action:** Standardize UI/TUI helpers across the CLI.

### Task W9B.3 — Focused Test Coverage Improvements

- **Action:** Add tests only for critical logic paths identified by accepted `AUD-XXX` findings in W9A.
- **Action:** Record any measured test delta against the W9A baseline instead of claiming broad or full coverage.

## QA Scenarios

```text
Scenario: Successful remediation of logic duplication
  Setup: choose one accepted `AUD-XXX` duplication finding from W9A.
  Run: refactor the duplicated helper and update the call sites named in that finding.
  Assert: `tsc --noEmit` and all relevant tests pass.
  Assert: remediation evidence cites the same `AUD-XXX` finding ID.
  Evidence: .sisyphus/evidence/w9b-remediation-refactor-proof.txt

Scenario: Targeted tests for remediated gaps
  Setup: choose one accepted `AUD-XXX` test-gap finding with a defined baseline.
  Run: add the targeted unit/smoke test covering that path.
  Assert: the new test passes.
  Assert: any measured delta is reported against the W9A baseline rather than as a vague improvement claim.
  Evidence: .sisyphus/evidence/w9b-test-coverage-delta.txt
```

## Commit Strategy

- **Commit W9B-A**: `refactor(cli): centralize common UI and error-handling helpers` (Example)
- **Commit W9B-B**: `fix(config): resolve inconsistent path fallbacks in agent factories` (Example)
- **Commit W9B-C**: `test(cli): improve coverage for uninstall and upgrade commands` (Example)

## Exit Conditions

- [x] All "High" severity findings are remediated.
- [x] Refactored logic is demonstrably stable and tested.
- [x] Audit report reflects the current state of each accepted `AUD-XXX` finding.
