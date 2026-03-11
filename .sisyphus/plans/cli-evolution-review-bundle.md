# CLI Evolution Review Bundle

## Review Target

This file is an aggregate review target for the CLI evolution planning set.

Primary hub roadmap:
- `cli-evolution-and-audit-roadmap.md`

Child plans in scope for review:
- `cli-lifecycle-w1-command-surface.md`
- `cli-config-contract-w2-project-local-souls.md`
- `cli-upgrade-w3-safe-preservation.md`
- `cli-doctor-v2-w4-verbose-mode.md`
- `cli-tui-refresh-w5-look-and-feel.md`
- `cli-uninstall-v2-w6-global-cleanup.md`
- `cli-schema-w7-config-schema-publication.md`
- `cli-docs-orchestration-w8a-invocation-contract.md`
- `cli-docs-orchestration-w8b-normalization-engine.md`
- `cli-docs-orchestration-w8c-init-deep-handoff.md`
- `repo-audit-w9a-baseline-audit.md`
- `repo-audit-w9b-remediation.md`
- `repo-audit-w9c-final-audit-closure.md`

## Review Goal

Assess whether the plan set is now:
- clear
- verifiable
- executable
- aligned with the hub roadmap

## Specific Review Focus

1. Remaining ambiguity or contract drift
2. Missing executable QA details
3. Contradictions between child plans and hub roadmap
4. Any placeholders or invented implementation surfaces that would block execution

## Known Context

- W8-A is intentionally discovery-first and remains the only planned execution blocker before the rest of W8 can proceed.
- The docs orchestration feature is a slash-command workflow ending with `init-deep`, not a first-class CLI command.
- Personalities/soul definitions are project-local by product contract.
- Uninstall removes global config but not project bootstrap artifacts.
- Audit includes remediation in the same wave.
