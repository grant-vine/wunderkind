## 2026-03-25

- `src/agents/slash-commands.ts` must use exact `Invoke via \`skill(name="...")\`` wording for all skill-owned references, including command details and summaries.
- Retained-agent delegation phrases like `Delegate via \`task(...)\`` in the Delegation Patterns sections should remain unchanged.
- `agent-browser` remains a subagent-style reference in this file and should not be rewritten to a skill invocation.

- F1 Round 2 audit found that `ciso` command summaries in `src/agents/slash-commands.ts` still fail the exact `Invoke via `skill(name="...")`` prefix contract even though other agents were normalized.
- Broad prompt-level assertions in `tests/unit/agent-factories.test.ts` are not enough to prove every updated skill reference kept the exact prefix wording.
