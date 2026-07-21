import type { CommandRunner } from "./github-issues-readiness.js"
import type { PreparedWorkflowSync, WorkflowSyncResult } from "./github-issues-sync-core.js"
import { assertRemoteIssuesMatchState } from "./github-issues-remote.js"

export function preflightRemoteWorkflowDrift(input: {
  readonly cwd: string
  readonly prepared: readonly PreparedWorkflowSync[]
  readonly execute: CommandRunner
}): WorkflowSyncResult | null {
  for (const preparedPlan of input.prepared) {
    if (preparedPlan.kind !== "existing") {
      continue
    }

    try {
      assertRemoteIssuesMatchState(
        input.execute,
        input.cwd,
        preparedPlan.existingState.repo.slug,
        preparedPlan.existingState.items,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      return {
        exitCode: 1,
        stdoutLines: [],
        stderrLines: [message],
      }
    }
  }

  return null
}
