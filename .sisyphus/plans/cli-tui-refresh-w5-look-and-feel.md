# CLI TUI Refresh W5 — Look and Feel

## Objective

Review and refine the TUI layout, palette, and overall operator experience for install and init flows. Improve the summary cards and add the context-aware gitignore prompt.

## Scope

- Review TUI interactions in `src/cli/tui-installer.ts` and `src/cli/init.ts`.
- Refine summary card layout and color scheme.
- Implement the gitignore prompt only when initialization is selected during the installation flow.

## Depends On

- W2 — Config Contract Split (to ensure accurate scope/personality reporting)

## Files in Scope

- `src/cli/tui-installer.ts`
- `src/cli/init.ts`
- `src/cli/config-manager/index.ts`
- `src/cli/gitignore-manager.ts` (Usage)

## Product Decisions / Frozen Contract

- **Gitignore Prompt**: Only ask about `.gitignore` updates if the user chooses to initialize the current project during the install flow.
- **TUI Style**: Use consistent palette and section spacing. Summary cards should use box characters or consistent indentation.
- **Coloration**: Limit use of high-contrast colors to actionable or critical items only.

## Deliverables

- Refined TUI install/init flow.
- Improved summary cards in TUI.
- Context-aware gitignore prompt.

## Task Breakdown

### Task W5.1 — TUI Palette and Layout Review

- **Action:** Review current `@clack/prompts` usage.
- **Action:** Refine the summary card logic (e.g., using `picocolors` for a more professional palette).
- **Action:** Add consistent section dividers.

### Task W5.2 — Context-Aware Gitignore Prompt

- **Action:** In `src/cli/tui-installer.ts`, add a prompt about `.gitignore` updates if `init` is selected.
- **Action:** Ensure this prompt does not appear in the "install-only" flow.

### Task W5.3 — Refine Initialization Prompts

- **Action:** In `src/cli/init.ts`, group related prompts to reduce operator fatigue without changing init-owned product scope.
- **Action:** Normalize prompt copy/spacing so the install→init path uses a consistent layout model.

## QA Scenarios

```text
Scenario: Improved summary card rendering
  Setup: mocked `@clack/prompts` responses for a fixed install→init transcript.
  Run: the targeted TUI unit/snapshot test selected by implementation.
  Assert: Final summary contains the agreed box-border/section markers.
  Assert: All reported config values match the mocked operator input.
  Assert: Scope is correctly identified as Global or Project.
  Evidence: .sisyphus/evidence/w5-summary-card.txt

Scenario: Context-aware gitignore prompt
  Setup: mocked prompt flow for project-context install where the user selects init.
  Run: targeted TUI flow test.
  Assert: the `.gitignore` prompt appears exactly once after init is selected.
  Evidence: .sisyphus/evidence/w5-gitignore-prompt-on-init.txt

Scenario: No gitignore prompt on global install only
  Setup: mocked prompt flow for install-only path with no init selection.
  Run: targeted TUI flow test.
  Assert: the `.gitignore` prompt never appears.
  Evidence: .sisyphus/evidence/w5-no-gitignore-prompt-on-global.txt
```

## Commit Strategy

- **Commit W5-A**: `style(tui): refine layout and palette for install and init flows`
- **Commit W5-B**: `feat(tui): add context-aware gitignore prompt to install-init flow`
- **Commit W5-C**: `feat(tui): improve summary card formatting and spacing`

## Exit Conditions

- [x] TUI summary cards follow the frozen layout markers and value-order contract.
- [x] Gitignore prompt only appears when appropriate.
- [x] All TUI flows use a consistent color and layout model.
