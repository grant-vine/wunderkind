# Issues — agent-harness-optimization-audit

## [2026-03-19] Session ses_2f9bebd26ffeIzcqS5CpYhKFP0 — Initial

No issues recorded yet.

## [2026-03-19] F2 code-quality review

- `src/index.ts` does not implement any Desloppify runtime gate despite `desloppifyEnabled` being wired through config-manager, init, doctor, schema, and docs; this is a config/runtime consistency gap.
- `skills/agile-pm/SKILL.md`, `skills/compliance-officer/SKILL.md`, `skills/experimentation-analyst/SKILL.md`, `skills/technical-writer/SKILL.md`, and `skills/oss-licensing-advisor/SKILL.md` still contain live delegation paths to removed agents, creating orphan-skill regression risk after the 12 -> 6 topology reduction.
