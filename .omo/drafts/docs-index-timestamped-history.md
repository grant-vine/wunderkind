# Draft: docs-index timestamped history

## Requirements (confirmed)
- docs-index history semantics should support multiple documentation refreshes within the same day
- date-only naming/sectioning is insufficient for append-dated and new-dated-file modes
- research and plan a solution rather than implementing it

## Technical Decisions
- docs-index behavior is currently driven by prompt/contracts and tests more than concrete timestamp formatting code
- solution should cover both append-dated sections and new-dated-file naming so history modes stay internally consistent
- canonical timestamp format will use a human-readable, filename-safe sortable UTC token rather than date-only or epoch-only values

## Research Findings
- `src/agents/docs-config.ts`: `buildDocsInstruction()` defines docs history mode wording but only says "dated section" / "date suffix"
- `commands/docs-index.md`: refresh/bootstrap contract exists, but no timestamp granularity is specified
- `src/index.ts`: runtime docs injection exposes `docHistoryMode` and refresh/bootstrap wording, but no timestamp format guidance
- `src/cli/docs-output-helper.ts`: validates docs history modes but has no timestamp formatter yet
- `tests/unit/docs-config.test.ts`, `tests/unit/docs-injection.test.ts`, and `tests/unit/config-template.test.ts` assert current wording; timestamp-specific tests do not yet exist
- `src/agents/docs-index-plan.ts` currently models one fixed target path per agent, which is a likely mismatch for `new-dated-file`
- missed but relevant touchpoints include `src/cli/types.ts`, `src/cli/personality-meta.ts`, `src/cli/config-manager/index.ts`, `src/cli/init.ts`, `tests/unit/init-interactive.test.ts`, and `tests/unit/cli-installer.test.ts`
- Oracle recommended a single filename-safe sortable UTC token and explicit run-level/collision semantics; Metis flagged `new-dated-file` vs canonical managed home-file semantics as the main planning trap

## Open Questions
- backward-compatibility expectations for existing date-only docs sections/files
- preferred implementation test flow: TDD vs tests-after
- exact timestamp precision/collision policy for repeated runs in the same window

## Scope Boundaries
- INCLUDE: docs-index contract, docs-output wording, helper/test coverage, explicit timestamp standard for append/new-dated modes
- EXCLUDE: implementing unrelated docs-index orchestration changes
