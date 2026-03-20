# Decisions

## 2026-03-19 Task 1 source purge

- Kept the change strictly to source, config, and schema surfaces named in the plan; did not rebuild generated dist/ or touch tests outside the required verification run.
- Verified unknown-flag behavior at the source CLI entrypoint with Bun in addition to the requested node bin/wunderkind.js check so the evidence reflects the unregistered Commander option even without a rebuild.

## 2026-03-19 F4 verdict basis

- Applied strict scope-fidelity interpretation for this review gate: any Desloppify/Python mention in `skills/code-health/SKILL.md` counts as out of scope with respect to the final "no references" requirement, even if phrased as a prohibition.
- Used the release-branch diff and per-commit file lists as audit context; observed broader historical branch churn, but issued the final rejection on concrete, in-file scope violation evidence (`skills/code-health/SKILL.md:137`).
