---
name: wunderkind
description: "USE FOR: Wunderkind front-door routing across product, marketing, creative, architecture, security, and legal judgment."
---

# Wunderkind

Choose the smallest retained Wunderkind capability for a product-team decision.

## Primary owner

`wunderkind-product`

## Output target

The user's requested decision or durable project artifact.

## When to trigger

Use when a request spans specialist judgment or needs a clear routing decision.

## Anti-triggers

Do not use for generic implementation, debugging, code review, or visual execution.

## Process

1. Identify the outcome and decision owner.
2. Route to the relevant Wunderkind agent or retained skill.
3. Delegate generic mechanics to native Codex or OMO.

## Workflow boundaries

- Make a plan when the user asks for one. An ordinary authorized implementation request proceeds directly without a planning approval gate. Use `$ulw-execute` when the user asks to execute a written `.omo/plans/` plan.
- On Codex, delegate with native `spawn_agent` fields: a lowercase underscore `task_name`, an exact installed `agent_type`, `fork_turns: "none"` unless full history is necessary, and a self-contained `message` with `TASK`, `DELIVERABLE`, `SCOPE`, and `VERIFY`. Choose an installed role that fits the work and never invent role names. Include all context, files, constraints, and requested skills in the message. For example:

  ```js
  spawn_agent({
    task_name: "implement_parser_fix",
    agent_type: "lazycodex-worker-medium",
    fork_turns: "none",
    message: "TASK: Fix the malformed-input handling in src/parser.ts.\nDELIVERABLE: A minimal parser fix with its existing regression test passing.\nSCOPE: src/parser.ts and the focused parser test only.\nVERIFY: Run the focused test and report its exact result.\nCONTEXT: The parser must reject empty tokens and preserve valid input behavior."
  })
  ```
- Bound execution retries: stop immediately when the same failure signature repeats consecutively, after three failed attempts, or after four hours on one task, whichever comes first. Report the latest evidence and classify the stop as a product failure or a harness/environment failure; a blocked task is incomplete and must not be automatically requeued.
- For a requested review or PR handoff, run the relevant behavior through its real surface and capture evidence before launching exactly one fresh reviewer. Do not use a reviewer panel or reuse a reviewer after fixes. Other completed work can use a self-review unless the user asks for a separate review.

## Hard rules

Keep the capability boundary narrow and do not create command aliases.

## Review gate

The selected route matches the requested decision and avoids duplicating a generic capability.
