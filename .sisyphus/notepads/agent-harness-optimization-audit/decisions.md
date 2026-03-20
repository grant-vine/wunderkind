# Decisions — agent-harness-optimization-audit

## [2026-03-19] Session ses_2f9bebd26ffeIzcqS5CpYhKFP0 — Initial

### Fixed Target Topology
Retained base agents (6):
1. product-wunderkind — orchestrator/front door
2. fullstack-wunderkind
3. marketing-wunderkind (absorbs brand-builder + devrel-wunderkind)
4. creative-director
5. ciso
6. legal-counsel

Removed:
- brand-builder → marketing-wunderkind
- devrel-wunderkind → marketing-wunderkind
- qa-specialist → product-wunderkind + fullstack-wunderkind
- support-engineer → product-wunderkind + fullstack-wunderkind
- operations-lead → fullstack-wunderkind + ciso
- data-analyst → product-wunderkind + marketing-wunderkind

### Personality Key Removals
- brandPersonality → fold into cmoPersonality
- devrelPersonality → fold into cmoPersonality
- qaPersonality → fold into ctoPersonality + productPersonality
- supportPersonality → fold intake into productPersonality, triage into ctoPersonality
- opsPersonality → fold reliability into ctoPersonality, security-incident into cisoPersonality
- dataAnalystPersonality → fold product analysis into productPersonality, campaign into cmoPersonality

### AGENT_DOCS_CONFIG Cleanup (Task 13)
Remove entries for: brand-builder, qa-specialist, operations-lead, devrel-wunderkind, data-analyst, support-engineer

### Wave Execution Order
Wave 1: Tasks 1 + 2 (parallel)
Wave 2: Task 3 (blocked by 1)
Wave 3: Task 4 (blocked by 1,3)
Wave 4: Tasks 5 + 6 + 7 (parallel, blocked by various)
Wave 5: Task 8 (blocked by 7)
Wave 6: Tasks 9 + 10 + 11 + 12 (parallel, blocked by various)
Wave 7: Task 13 (blocked by 8,9,10,11,12)
Wave 8: Task 14 (blocked by 8,13)
Wave 9: Task 15 (blocked by 1,9,13,14)
