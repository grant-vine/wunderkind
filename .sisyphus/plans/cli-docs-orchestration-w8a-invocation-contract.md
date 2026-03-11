# CLI Docs Orchestration W8A — Invocation Contract

## Objective

Identify and formalize the invocation surface for the centralized documentation orchestration plugin slash command `/wunderkind:docs-index`. This workstream now focuses on packaging, command naming, coordinator routing, and the background-agent invocation contract rather than a speculative local CLI/runtime interceptor.

## Scope

- Freeze the real plugin command surface for `/wunderkind:docs-index`.
- Define the contract for a coordinator-driven docs-generation/indexing workflow.
- Verify that the command surface can delegate work to all eligible docs-writing agents via parallel background tasks.

## Depends On

- W2 — Config Contract Split (for final docs-settings/config assumptions used by the invocation contract)

## Files in Scope

- `commands/docs-index.md`
- `package.json` / publish surface as needed
- `src/agents/docs-config.ts` (For `AGENT_DOCS_CONFIG` reference)
- OpenCode plugin documentation / runtime code (External reference)

## Product Decisions / Frozen Contract

- **Discovery Rule**: Do NOT assume `src/cli/index.ts` is the implementation surface. This is a plugin command workflow, not a CLI command.
- **Command Freeze**: The command name is `/wunderkind:docs-index`.
- **Surface Freeze**: W8A MUST freeze the plugin command packaging surface (`commands/docs-index.md`), the coordinator strategy, and the exact list of eligible agents from `AGENT_DOCS_CONFIG` before W8B implementation starts.
- **Contract**: The command must trigger each eligible agent in `AGENT_DOCS_CONFIG` using parallel background tasks.
- **Coordinator Rule**: One coordinator agent owns orchestration and final index synthesis; writer/auditor agents own their own document outputs.

## Deliverables

- Frozen contract for `/wunderkind:docs-index` packaging and invocation.
- Proof that the command can be surfaced through the plugin command mechanism.
- Frozen contract for eligible agent fan-out and coordinator ownership.

## Task Breakdown

### Task W8A.1 — Runtime Surface Discovery

- **Action:** Confirm plugin commands are the real supported surface for slash-command-style invocation.
- **Action:** Freeze `commands/docs-index.md` as the implementation entrypoint for `/wunderkind:docs-index`.
- **Action:** Confirm packaging requirements so the command ships with the plugin.

### Task W8A.2 — Invocation Proof of Concept

- **Action:** Create a targeted proof (test or package inspection) demonstrating that `commands/docs-index.md` is shipped and discoverable as a plugin command.
- **Action:** Verify that the command contract can reference `AGENT_DOCS_CONFIG` and the exact eligible-agent set.

### Task W8A.3 — Formalize Orchestration Contract

- **Action:** Freeze the command name as `/wunderkind:docs-index`.
- **Action:** Freeze the expected behavior: one coordinator launches one parallel background task per docs-eligible agent, then consolidates results into the docs index.

## QA Scenarios

```text
Scenario: Invocation surface identified
  Setup: inspect plugin command packaging and host command-loading requirements.
  Run: execute the discovery proof selected by implementation.
  Assert: `/wunderkind:docs-index` is tied to the plugin command surface, not the CLI or system-transform surface.
  Evidence: .sisyphus/evidence/w8a-invocation-discovery.txt

Scenario: Interception PoC
  Setup: create the command asset at `commands/docs-index.md` and package/discovery proof.
  Run: execute the proof selected by implementation (package inspection, command discovery test, or equivalent).
  Assert: the command is discoverable as `/wunderkind:docs-index` and can reference the exact eligible-agent list.
  Evidence: .sisyphus/evidence/w8a-poc-interception.txt

Scenario: Eligible agent set frozen
  Setup: inspect `AGENT_DOCS_CONFIG` and the W8A contract output.
  Run: compare the frozen orchestration list to the current `eligible: true` agent keys.
  Assert: the plan output names the exact eligible agent set, not an approximate subset.
  Evidence: .sisyphus/evidence/w8a-eligible-agent-freeze.txt
```

## Commit Strategy

- **Commit W8A-A**: `docs(discovery): identify runtime surface for documentation orchestration slash command`
- **Commit W8A-B**: `feat(discovery): formalize invocation contract and interception logic for docs orchestration`

## Exit Conditions

- [x] `/wunderkind:docs-index` packaging surface is unambiguously identified.
- [x] Command name and coordinator/fan-out contract are frozen.
- [x] W8B and W8C are unblocked with a clear plugin-command implementation target.
