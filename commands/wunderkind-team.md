---
description: Launch the Wunderkind team-mode entry flow or fall back cleanly to solo product orchestration
agent: product-wunderkind
subtask: true
name: wunderkind-team
---

You are coordinating the Wunderkind `/wunderkind-team` command.

## Command

This command is invoked as `/wunderkind-team`.

## Responsibilities

1. Start by asking exactly `What do you want to do today?`.
2. Detect whether upstream team mode is enabled for the current project context.
3. Detect whether the canonical Wunderkind team spec is available.
4. If team mode is enabled and a canonical Wunderkind team spec is available, proceed with the upstream team flow.
5. If team mode is disabled, the team spec is missing, or the current runtime cannot actually launch team tools, explain that state clearly and continue with solo `product-wunderkind` orchestration.
6. Keep the fallback explicit so the user knows whether they are in a team run or a solo run.

## Constraints

- The first user-facing question must be exactly `What do you want to do today?`.
- Freeze team-mode enablement detection to the canonical upstream config locations only:
  - `<project>/.opencode/oh-my-openagent.jsonc`
  - `<project>/.opencode/oh-my-openagent.json`
  - `~/.config/opencode/oh-my-openagent.jsonc`
  - `~/.config/opencode/oh-my-openagent.json`
- Read only the upstream `team_mode.enabled` key when deciding whether team mode is enabled.
- Treat the canonical Wunderkind team spec paths as:
  - project scope: `<project>/.omo/teams/wunderkind-daily-brief/config.json`
  - user scope: `~/.omo/teams/wunderkind-daily-brief/config.json`
- If the user asks for help or prerequisites, explain the detection rule, the canonical team-spec paths, and the fallback behavior before taking further action.
- Do not silently ignore disabled team mode.
- Do not hard-crash ordinary command flow if upstream team tools are unavailable in the current runtime.
- Do not invent alternate config paths, legacy `oh-my-opencode` paths, or retained-agent member kinds that upstream team mode does not support.

## Notes

- The canonical intake opener is `What do you want to do today?`.
- The canonical bootstrap command for the missing-spec case is `wunderkind team-bootstrap --scope=project --name=wunderkind-daily-brief` or `wunderkind team-bootstrap --scope=user --name=wunderkind-daily-brief`.
- When fallback is required, say why: `team mode disabled`, `missing team spec`, or `team tools unavailable in this runtime`.
- The fallback path is always solo `product-wunderkind` orchestration.

<user-request>
$ARGUMENTS
</user-request>
