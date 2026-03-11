# CLI Docs Orchestration W8C — `init-deep` Handoff

## Objective

Ensure that `/wunderkind:docs-index` completes with a final `init-deep` call to refresh all agent knowledge of the updated documentation structure.

## Scope

- Implement the handoff logic after a successful `/wunderkind:docs-index` orchestration run.
- Add error handling and verification to ensure `init-deep` only fires on success.

## Depends On

- W8B — Normalization Engine (to provide successful results)
- W8A — Invocation Contract (to know where to trigger the handoff)

## Files in Scope

- orchestration implementation module/path frozen by W8A and created by W8B
- runtime integration files identified by W8A
- handoff/invocation integration surface proven during W8A

## Product Decisions / Frozen Contract

- **Success Rule**: `init-deep` is only triggered after a complete and successful `/wunderkind:docs-index` run.
- **Failure Rule**: Partial failure or normalization errors block the `init-deep` call and surface actionable errors to the user.
- **Integration**: The handoff is part of the orchestration flow and should not require separate user action.

## Deliverables

- Completed orchestration-to-handoff pipeline.
- Tests for successful handoff and failure-blocked states.
- Documentation for the "full refresh" documentation workflow.

## Task Breakdown

### Task W8C.1 — Trigger `init-deep` after Orchestration

- **Action:** In the orchestration implementation module frozen by W8A/W8B, call the `init-deep` handoff only upon successful completion.
- **Action:** Ensure the handoff logic is accurately integrated into the slash-command response.

### Task W8C.2 — Error Handling and Verification

- **Action:** Implement a verification step after documentation generation but before `init-deep`.
- **Action:** Block the handoff if any eligible background docs agent failed to generate/audit docs or if normalization encountered a critical error.
- **Action:** Surface clear errors explaining why the refresh was skipped.

### Task W8C.3 — Final Workflow Verification

- **Action:** Perform an end-to-end test of the slash-command documentation generation flow.
- **Action:** Verify, via the frozen trace/event contract, that the `init-deep` handoff is invoked after successful orchestration completion.

## QA Scenarios

```text
Scenario: Successful orchestration triggers init-deep
  Run: Execute `/wunderkind:docs-index`.
  Assert: Documentation is normalized.
  Assert: Trace events occur in exact order: [DOCS_GEN] -> [NORMALIZATION] -> [INIT_DEEP].
  Assert: `init-deep` trace appears at the end of the run.
  Assert: Absence of error traces or collision warnings in success evidence.
  Evidence: .sisyphus/evidence/w8c-handoff-success.txt

Scenario: Failed orchestration blocks init-deep
  Setup: Simulate a failure in one of the docs-eligible background agents.
  Run: Execute `/wunderkind:docs-index`.
  Assert: Error message is displayed.
  Assert: `init-deep` is NOT triggered.
  Evidence: .sisyphus/evidence/w8c-handoff-blocked.txt

Scenario: Partial success surfaces accurate errors
  Setup: Simulate a normalization or agent-delegation failure that falls under the frozen failure policy.
  Run: Execute `/wunderkind:docs-index`.
  Assert: Warns the user and skips the final `init-deep` refresh.
  Assert: Trace ordering never includes `[INIT_DEEP]` after the failure event.
  Evidence: .sisyphus/evidence/w8c-partial-success-handling.txt
```

## Commit Strategy

- **Commit W8C-A**: `feat(orchestration): integrate init-deep handoff into documentation flow`
- **Commit W8C-B**: `feat(orchestration): add error handling and verification for orchestration handoff`
- **Commit W8C-C**: `test(orchestration): add end-to-end tests for documentation-to-init-deep pipeline`

## Exit Conditions

- [x] Documentation orchestration always concludes with `init-deep` on success.
- [x] Failures are correctly identified and block the final refresh.
- [x] Trace/event evidence proves the frozen orchestration-to-`init-deep` handoff contract.
