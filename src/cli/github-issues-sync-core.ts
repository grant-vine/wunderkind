import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import type { CommandRunner } from "./github-issues-readiness.js"
import { renderDryRunWorkflowSync } from "./github-issues-sync-render.js"
import {
  createGitHubIssuesWorkflowState,
  type GitHubIssuesWorkflowRepoBinding,
  type GitHubIssuesWorkflowState,
  type GitHubIssuesWorkflowStateItem,
  type ParsedWorkflowPlan,
  type ParsedWorkflowPlanItem,
  computeWorkflowDigest,
  findGitHubIssuesWorkflowStateByPlan,
  parseWorkflowPlan,
  replaceGitHubIssuesWorkflowState,
  saveGitHubIssuesWorkflowState,
} from "./github-issues-mapping.js"
import { buildIssueBody, createRemoteIssue, synchronizeRemoteIssue } from "./github-issues-remote.js"

export interface OutputWriter {
  (line: string): void
}

export interface WorkflowSyncOptions {
  readonly cwd?: string
  readonly plan?: string
  readonly all?: boolean
  readonly apply: boolean
  readonly runCommand?: CommandRunner
  readonly writeStdout?: OutputWriter
  readonly writeStderr?: OutputWriter
  readonly createWorkflowId?: () => string
  readonly now?: () => Date
}

interface PreparedWorkflowSyncBase {
  readonly planAbsolutePath: string
  readonly planRelativePath: string
  readonly parsedPlan: ParsedWorkflowPlan
  readonly localDigest: string
}

interface PreparedNewWorkflowSync extends PreparedWorkflowSyncBase {
  readonly kind: "new"
  readonly state: GitHubIssuesWorkflowState
}

interface PreparedExistingWorkflowSync extends PreparedWorkflowSyncBase {
  readonly kind: "existing"
  readonly existingState: GitHubIssuesWorkflowState
  readonly existingItemsByKey: ReadonlyMap<string, GitHubIssuesWorkflowStateItem>
  readonly newItems: readonly ParsedWorkflowPlanItem[]
}

export type PreparedWorkflowSync = PreparedNewWorkflowSync | PreparedExistingWorkflowSync

export interface WorkflowSyncResult {
  readonly exitCode: number
  readonly stdoutLines: readonly string[]
  readonly stderrLines: readonly string[]
}

export interface WorkflowSyncSelection {
  readonly mode: "single" | "all"
  readonly planAbsolutePaths: readonly string[]
}

export type PreparedWorkflowSyncResult =
  | { readonly kind: "ok"; readonly prepared: PreparedWorkflowSync }
  | { readonly kind: "error"; readonly planRelativePath: string; readonly message: string }

export function buildRepoBinding(repoSlug: string, repoRemoteUrl: string | null): GitHubIssuesWorkflowRepoBinding {
  const [owner = "", name = ""] = repoSlug.split("/")

  return { owner, name, slug: repoSlug, remoteUrl: repoRemoteUrl }
}

export function resolveWorkflowSelection(cwd: string, options: WorkflowSyncOptions): WorkflowSyncResult | WorkflowSyncSelection {
  const wantsAll = options.all === true
  const hasPlan = typeof options.plan === "string" && options.plan.trim() !== ""

  if (wantsAll === hasPlan) {
    return {
      exitCode: 1,
      stdoutLines: [],
      stderrLines: ["Provide exactly one of --plan <path> or --all."],
    }
  }

  if (hasPlan) {
    return {
      mode: "single",
      planAbsolutePaths: [resolve(cwd, options.plan ?? "")],
    }
  }

  return {
    mode: "all",
    planAbsolutePaths: discoverWorkflowPlanAbsolutePaths(cwd),
  }
}

function discoverWorkflowPlanAbsolutePaths(cwd: string): readonly string[] {
  const planDir = join(cwd, ".omo", "plans")
  if (!existsSync(planDir)) {
    return []
  }

  return readdirSync(planDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(planDir, entry.name))
    .sort((left, right) => relative(cwd, left).localeCompare(relative(cwd, right)))
}

export function prepareWorkflowSyncPlan(input: {
  readonly cwd: string
  readonly planAbsolutePath: string
  readonly repo: GitHubIssuesWorkflowRepoBinding
  readonly createWorkflowId: () => string
}): PreparedWorkflowSyncResult {
  const planContent = readFileSync(input.planAbsolutePath, "utf-8")
  const parsedPlan = parseWorkflowPlan(input.planAbsolutePath, planContent)
  const localDigest = computeWorkflowDigest(planContent)
  const existingState = findGitHubIssuesWorkflowStateByPlan(input.cwd, input.planAbsolutePath)
  const planRelativePath = relative(input.cwd, input.planAbsolutePath).replaceAll("\\", "/")

  if (parsedPlan.items.length === 0) {
    return {
      kind: "error",
      planRelativePath,
      message: "No checkbox items were found in the selected workflow plan.",
    }
  }

  if (existingState === null) {
    return {
      kind: "ok",
      prepared: {
        kind: "new",
        planAbsolutePath: input.planAbsolutePath,
        planRelativePath,
        parsedPlan,
        localDigest,
        state: createGitHubIssuesWorkflowState({
          cwd: input.cwd,
          workflowId: input.createWorkflowId(),
          planAbsolutePath: input.planAbsolutePath,
          plan: parsedPlan,
          repo: input.repo,
          localDigest,
        }),
      },
    }
  }

  if (existingState.repo.slug !== input.repo.slug) {
    return {
      kind: "error",
      planRelativePath,
      message: "Local workflow state is bound to a different GitHub repository.",
    }
  }

  const localItemsByKey = new Map(parsedPlan.items.map((item) => [item.localKey, item]))
  const missingLocalKeys = existingState.items
    .filter((item) => !localItemsByKey.has(item.localKey))
    .map((item) => item.localKey)

  if (missingLocalKeys.length > 0) {
    return {
      kind: "error",
      planRelativePath,
      message: `Local workflow drift detected: ${missingLocalKeys.join(", ")}`,
    }
  }

  const existingItemsByKey = new Map(existingState.items.map((item) => [item.localKey, item]))
  const newItems = parsedPlan.items.filter((item) => !existingItemsByKey.has(item.localKey))

  return {
    kind: "ok",
    prepared: {
      kind: "existing",
      planAbsolutePath: input.planAbsolutePath,
      planRelativePath,
      parsedPlan,
      localDigest,
      existingState,
      existingItemsByKey,
      newItems,
    },
  }
}

export function runPreparedWorkflowSync(input: {
  readonly cwd: string
  readonly prepared: PreparedWorkflowSync
  readonly apply: boolean
  readonly execute: CommandRunner
  readonly now: () => Date
}): WorkflowSyncResult {
  const prepared = input.prepared

  if (!input.apply) {
    return renderDryRunWorkflowSync(prepared)
  }

  if (prepared.kind === "new") {
    const createdItems = prepared.parsedPlan.items.map((item) => {
      const created = createRemoteIssue(input.execute, input.cwd, prepared.state.repo.slug, {
        title: item.title,
        body: buildIssueBody({
          workflowId: prepared.state.workflowId,
          planPath: prepared.state.planPath,
          localKey: item.localKey,
          title: item.title,
        }),
        completed: item.completed,
      })

      return {
        ...created,
        localKey: item.localKey,
      }
    })

    saveGitHubIssuesWorkflowState(input.cwd, {
      ...prepared.state,
      localDigest: prepared.localDigest,
      items: createdItems,
      lastSyncedAt: input.now().toISOString(),
    })

    return {
      exitCode: 0,
      stdoutLines: [`Synchronized ${createdItems.length} local workflow items to GitHub Issues.`],
      stderrLines: [],
    }
  }

  const synchronizedItems = prepared.parsedPlan.items.map((localItem) => {
    const existingItem = prepared.existingItemsByKey.get(localItem.localKey)
    if (existingItem === undefined) {
      const created = createRemoteIssue(input.execute, input.cwd, prepared.existingState.repo.slug, {
        title: localItem.title,
        body: buildIssueBody({
          workflowId: prepared.existingState.workflowId,
          planPath: prepared.existingState.planPath,
          localKey: localItem.localKey,
          title: localItem.title,
        }),
        completed: localItem.completed,
      })

      return {
        ...created,
        localKey: localItem.localKey,
      }
    }

    return synchronizeRemoteIssue(input.execute, input.cwd, prepared.existingState.repo.slug, localItem, existingItem)
  })

  replaceGitHubIssuesWorkflowState(
    input.cwd,
    prepared.existingState,
    {
      ...prepared.existingState,
      slug: prepared.parsedPlan.slug,
      localDigest: prepared.localDigest,
      items: synchronizedItems,
      lastSyncedAt: input.now().toISOString(),
    },
  )

  return {
    exitCode: 0,
    stdoutLines: [`Synchronized ${synchronizedItems.length} local workflow items to GitHub Issues.`],
    stderrLines: [],
  }
}
