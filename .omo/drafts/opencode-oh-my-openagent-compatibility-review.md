# Draft: OpenCode and oh-my-openagent Compatibility Review

## Requirements (confirmed)
- review the latest changes to opencode and oh-my-openagent
- identify what changes we need to make to wunderkind to comply
- investigate strange errors like "Invalid arguments: 'run_in_background' parameter is REQUIRED. Specify run_in_background=false for task delegation, or run_in_background=true for parallel exploration."

## Technical Decisions
- review scope will cover both upstream contract changes and Wunderkind surfaces that may emit outdated tool usage guidance
- initial working hypothesis: primary breakage is retained-agent prompt/guidance compatibility rather than skill examples or package wiring
- distinguish skill usage from task delegation explicitly in prompts: skill-owned capabilities should use the `skill(...)` tool; agent/category handoffs should use canonical `task(...)` examples with all required fields
- fix authored prompt sources first, then regenerate `agents/*.md`; build/render pipeline itself does not appear to require logic changes

## Research Findings
- repo inventory: skill files already use `task(..., run_in_background=false)` in examples
- repo inventory: `src/agents/*.ts`, generated `agents/*.md`, and `src/agents/slash-commands.ts` still describe delegation in natural language without explicit current task contract examples
- repo inventory: likely affected retained prompts include `product-wunderkind`, `fullstack-wunderkind`, `marketing-wunderkind`, `creative-director`, and `ciso`
- repo inventory: `src/agents/shared-prompt-sections.ts` is the best shared insertion point for a single canonical delegation/skill contract section
- repo inventory: `src/build-agents.ts` and `src/agents/render-markdown.ts` simply republish prompt text; no schema bug found there
- tests: Bun unit coverage exists for agent factory content, generated markdown, and plugin transform injection
- tests gap: no end-to-end compatibility test validates generated prompt content against current OpenCode/OMO task-schema requirements
- upstream: OpenCode appears effectively frozen/archived; current compatibility churn is on `oh-my-openagent`
- upstream: `run_in_background` is explicitly required again after a reverted auto-default experiment
- upstream: `load_skills` should also be treated as required in task examples/prompts
- upstream: task-routing contracts are still evolving (`category` / `subagent_type` normalization), so prompts should use canonical current syntax and avoid vague delegation wording
- upstream: planner/tool metadata handling is becoming stricter, increasing the cost of stale prompt examples

## Open Questions
- whether upstream changes also require package-version floor or plugin transform wording changes beyond prompt/generation updates
- whether compatibility work should be limited to user-facing/runtime-shipped assets or also normalize internal historical docs/examples
- whether plugin-injected native-agent routing text in `src/index.ts` should also be tightened to reference explicit task-vs-skill behavior when the task tool is available

## Scope Boundaries
- INCLUDE: compatibility analysis, affected file surfaces, likely migration tasks, regression protection needs
- EXCLUDE: implementation of fixes in source files during this planning session
