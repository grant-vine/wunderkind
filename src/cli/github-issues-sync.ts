import { spawnSync } from "node:child_process"
import {
  analyzeGitHubIssuesReadiness,
  type CommandResult,
} from "./github-issues-readiness.js"
import {
  createWorkflowId,
} from "./github-issues-mapping.js"
import {
  buildRepoBinding,
  type OutputWriter,
  prepareWorkflowSyncPlan,
  resolveWorkflowSelection,
  runPreparedWorkflowSync,
  type WorkflowSyncOptions,
} from "./github-issues-sync-core.js"
import { preflightRemoteWorkflowDrift } from "./github-issues-sync-preflight.js"
import { writeWorkflowSyncResult } from "./github-issues-sync-render.js"

function writeLine(writer: OutputWriter | undefined, value: string): void {
  ;(writer ?? console.log)(value)
}

export async function runWorkflowSync(options: WorkflowSyncOptions): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const writeStdout = options.writeStdout
  const writeStderr = options.writeStderr
  const execute = options.runCommand ?? ((command, args, runCwd) => analyzeCommand(command, args, runCwd))
  const selection = resolveWorkflowSelection(cwd, options)
  if ("exitCode" in selection) {
    writeWorkflowSyncResult(selection, { writeStdout, writeStderr })
    return selection.exitCode
  }

  if (selection.planAbsolutePaths.length === 0) {
    writeLine(writeStderr, "No workflow plan files were found under .omo/plans/.")
    return 1
  }

  const readiness = analyzeGitHubIssuesReadiness(cwd, { runCommand: execute })

  if (!readiness.ready || readiness.repoSlug === null) {
    for (const message of readiness.missing) {
      writeLine(writeStderr, message)
    }
    for (const warning of readiness.warnings) {
      writeLine(writeStderr, warning)
    }
    return 1
  }

  const repo = buildRepoBinding(readiness.repoSlug, readiness.repoRemoteUrl)
  const createWorkflowIdValue = options.createWorkflowId ?? (() => createWorkflowId())
  const now = options.now ?? (() => new Date())
  const preparedResults = selection.planAbsolutePaths.map((planAbsolutePath) =>
    prepareWorkflowSyncPlan({
      cwd,
      planAbsolutePath,
      repo,
      createWorkflowId: createWorkflowIdValue,
    }),
  )

  const errors = preparedResults.filter((result) => result.kind === "error")
  if (errors.length > 0) {
    if (selection.mode === "all" && options.apply) {
      writeLine(writeStderr, `Cannot apply --all because preflight failed for ${errors.length} workflow plan${errors.length === 1 ? "" : "s"}.`)
      for (const error of errors) {
        writeLine(writeStderr, `[${error.planRelativePath.split("/").pop() ?? error.planRelativePath}] ${error.message}`)
      }
      return 1
    }

    const firstError = errors[0]
    if (firstError === undefined) {
      return 1
    }

    writeLine(writeStderr, firstError.message)
    return 1
  }

  const prepared = preparedResults.flatMap((result) => (result.kind === "ok" ? [result.prepared] : []))
  const remoteDriftPreflight = preflightRemoteWorkflowDrift({ cwd, prepared, execute })
  if (remoteDriftPreflight !== null) {
    writeWorkflowSyncResult(remoteDriftPreflight, { writeStdout, writeStderr })
    return remoteDriftPreflight.exitCode
  }

  if (selection.mode === "single") {
    const onlyPrepared = prepared[0]
    if (onlyPrepared === undefined) {
      writeLine(writeStderr, "No workflow plans were prepared for synchronization.")
      return 1
    }

    const result = runPreparedWorkflowSync({
      cwd,
      prepared: onlyPrepared,
      apply: options.apply,
      execute,
      now,
    })
    writeWorkflowSyncResult(result, { writeStdout, writeStderr })
    return result.exitCode
  }

  if (!options.apply) {
    writeLine(writeStdout, `Would synchronize ${prepared.length} workflow plans to GitHub Issues.`)
  }

  for (const [index, preparedPlan] of prepared.entries()) {
    const planFileName = preparedPlan.planRelativePath.split("/").pop() ?? preparedPlan.planRelativePath
    writeLine(writeStdout, `[${index + 1}/${prepared.length}] ${planFileName}`)
    const result = runPreparedWorkflowSync({
      cwd,
      prepared: preparedPlan,
      apply: options.apply,
      execute,
      now,
    })
    writeWorkflowSyncResult(result, { writeStdout, writeStderr })
    if (result.exitCode !== 0) {
      return result.exitCode
    }
  }

  return 0
}

function analyzeCommand(command: string, args: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, [...args], { cwd, encoding: "utf8" })

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}
