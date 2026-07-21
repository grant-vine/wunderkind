import { join } from "node:path"
import type { OutputWriter, PreparedWorkflowSync, WorkflowSyncResult } from "./github-issues-sync-core.js"

export function renderDryRunWorkflowSync(prepared: PreparedWorkflowSync): WorkflowSyncResult {
  if (prepared.kind === "new") {
    return {
      exitCode: 0,
      stdoutLines: [
        `Would create ${prepared.parsedPlan.items.length} GitHub issues for ${prepared.parsedPlan.slug}.`,
        `Re-run with --apply to create issues and write ${join(".wunderkind", "workflows", "github-issues", `${prepared.state.slug}--${prepared.state.workflowId}.json`)}.`,
      ],
      stderrLines: [],
    }
  }

  if (prepared.newItems.length === 0) {
    return {
      exitCode: 0,
      stdoutLines: ["Workflow is already synchronized. No GitHub issue changes are required."],
      stderrLines: [],
    }
  }

  return {
    exitCode: 0,
    stdoutLines: [`Would create ${prepared.newItems.length} new GitHub issues for newly added local tasks.`],
    stderrLines: [],
  }
}

export function writeWorkflowSyncResult(result: WorkflowSyncResult, writers: {
  readonly writeStdout: OutputWriter | undefined
  readonly writeStderr: OutputWriter | undefined
}): void {
  for (const line of result.stdoutLines) {
    ;(writers.writeStdout ?? console.log)(line)
  }

  for (const line of result.stderrLines) {
    ;(writers.writeStderr ?? console.error)(line)
  }
}
