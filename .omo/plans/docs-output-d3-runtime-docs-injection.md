# Docs Output D3 — Runtime Docs Injection

## Objective

Inject a runtime docs-output guidance block into the Wunderkind plugin system prompt when docs output is enabled, while keeping the behavior idempotent and compatible with static agent prompt guidance.

## Scope

This child plan covers original Task 7 only.

## Depends On

- D1 must be complete.

## Files in Scope

- `src/index.ts`
- `tests/unit/docs-injection.test.ts`

## Deliverables

- runtime `## Documentation Output` section injection in `src/index.ts`
- idempotency guard using an exact Wunderkind-owned sentinel contract
- tests covering enabled, disabled, null-config, and duplicate-call cases

## Frozen Runtime Injection Contract

- D3 consumes the merged config contract established by D1.
- Runtime injection must use the effective config after project-over-global precedence has been applied.
- Idempotency must not rely on a loose heading substring alone.
- D3 must define one exact Wunderkind-owned sentinel string or marker block for the injected section and only suppress re-injection when that exact sentinel is already present.
- D4 static guidance must continue to avoid the exact runtime-injection heading/sentinel contract.

## Task D3.1 — TDD runtime docs injection

### Step 1 — Write tests first
- Add tests for:
  - `docsEnabled: false` → no injection
  - `docsEnabled: true` → exactly one injected section with concrete values
  - idempotency across repeated transform calls
  - null config → no injection

### Step 2 — Implement runtime injection
- Use `readWunderkindConfig()` from config-manager.
- If docs output is enabled:
  - normalize `docsPath`
  - default `docHistoryMode`
  - inject `## Documentation Output`
- Skip injection only if the exact Wunderkind-owned runtime sentinel already exists.

### Must NOT do
- Do not attempt per-agent routing in runtime transform.
- Do not import `buildDocsInstruction()` here.
- Do not make the config reader async.

### Acceptance Criteria
- [ ] tests fail before implementation and pass after implementation
- [ ] runtime injection is disabled when docs output is disabled or config is missing
- [ ] duplicate transform calls do not create duplicate sections
- [ ] idempotency uses an exact Wunderkind-owned sentinel contract, not a loose heading substring
- [ ] `tsc --noEmit` exits 0

### QA Scenarios
```text
Scenario: TDD red phase
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-injection.test.ts
    2. Assert exit code is non-zero before implementation because the new docs-injection cases fail first
  Evidence: .sisyphus/evidence/task-7-tdd-red.txt

Scenario: TDD green phase
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-injection.test.ts
    2. Assert exit code 0 after implementation
  Evidence: .sisyphus/evidence/task-7-tdd-green.txt

Scenario: docsEnabled=false produces no injection
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-injection.test.ts
    2. Assert exit code 0 and the targeted test proves disabled config adds no runtime section
  Evidence: .sisyphus/evidence/task-7-disabled.txt

Scenario: Idempotency — double transform call does not duplicate the Wunderkind-owned runtime section
  Tool: Bash
  Steps:
    1. Run: bun test tests/unit/docs-injection.test.ts
    2. Assert exit code 0 and the targeted test proves repeated transforms yield exactly one injected section using the exact sentinel contract
  Evidence: .sisyphus/evidence/task-7-idempotent.txt

Scenario: TypeScript compiles clean after Task 7
  Tool: Bash
  Steps:
    1. Run: tsc --noEmit
    2. Assert exit code 0
  Evidence: .sisyphus/evidence/task-7-tsc.txt
```

## Shared Contract for D4

This child plan establishes the runtime sentinel contract:
- runtime-injected heading: `## Documentation Output`
- runtime idempotency uses an exact Wunderkind-owned sentinel or marker block associated with that heading
- static agent heading must not use that exact heading

D4 must therefore use `## Documentation Output (Static Reference)` to avoid blocking runtime injection.

## Commit Strategy

- **Commit D3-A**: `feat(index): inject global Documentation Output config section from runtime wunderkind config`

## Exit Conditions

- [ ] D3.1 complete
- [ ] runtime/static heading contract documented and ready for D4
