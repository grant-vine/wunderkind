import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { basename, join, relative } from "node:path"

export interface ParsedWorkflowPlanItem {
  readonly localKey: string
  readonly title: string
  readonly completed: boolean
}

export interface ParsedWorkflowPlan {
  readonly title: string
  readonly slug: string
  readonly items: readonly ParsedWorkflowPlanItem[]
}

export interface GitHubIssuesWorkflowRepoBinding {
  readonly owner: string
  readonly name: string
  readonly slug: string
  readonly remoteUrl: string | null
}

export interface GitHubIssuesWorkflowStateItem {
  readonly localKey: string
  readonly title: string
  readonly completed: boolean
  readonly issueNumber: number
  readonly issueId: string | null
  readonly issueUrl: string | null
  readonly lastSyncedTitle: string
  readonly lastSyncedCompleted: boolean
}

export interface GitHubIssuesWorkflowState {
  readonly schemaVersion: 1
  readonly workflowId: string
  readonly slug: string
  readonly backend: "github-issues"
  readonly planPath: string
  readonly repo: GitHubIssuesWorkflowRepoBinding
  readonly localDigest: string
  readonly items: readonly GitHubIssuesWorkflowStateItem[]
  readonly lastSyncedAt: string | null
}

interface GitHubIssuesWorkflowStateRecord {
  readonly schemaVersion: unknown
  readonly workflowId: unknown
  readonly slug: unknown
  readonly backend: unknown
  readonly planPath: unknown
  readonly repo: unknown
  readonly localDigest: unknown
  readonly items: unknown
  readonly lastSyncedAt: unknown
}

function normalizeRelativePath(pathValue: string): string {
  return pathValue.replaceAll("\\", "/")
}

export function slugify(value: string): string {
  const collapsed = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return collapsed === "" ? "workflow" : collapsed
}

export function computeWorkflowDigest(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

export function createWorkflowId(): string {
  return randomUUID()
}

export function parseWorkflowPlan(planPath: string, content: string): ParsedWorkflowPlan {
  const lines = content.split(/\r?\n/)
  const heading = lines.find((line) => /^#\s+/.test(line))
  const title = heading !== undefined ? heading.replace(/^#\s+/, "").trim() : basename(planPath, ".md")
  const occurrences = new Map<string, number>()
  const items: ParsedWorkflowPlanItem[] = []

  for (const line of lines) {
    const match = /^\s*-\s+\[([ xX])]\s+(.+?)\s*$/.exec(line)
    if (!match?.[1] || !match[2]) continue

    const taskTitle = match[2].trim()
    const keyBase = slugify(taskTitle)
    const occurrence = (occurrences.get(keyBase) ?? 0) + 1
    occurrences.set(keyBase, occurrence)

    items.push({
      localKey: `${keyBase}--${occurrence}`,
      title: taskTitle,
      completed: match[1].toLowerCase() === "x",
    })
  }

  return {
    title,
    slug: slugify(title),
    items,
  }
}

function isRepoBinding(value: unknown): value is GitHubIssuesWorkflowRepoBinding {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>

  return typeof record.owner === "string"
    && typeof record.name === "string"
    && typeof record.slug === "string"
    && (typeof record.remoteUrl === "string" || record.remoteUrl === null)
}

function isStateItem(value: unknown): value is GitHubIssuesWorkflowStateItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>

  return typeof record.localKey === "string"
    && typeof record.title === "string"
    && typeof record.completed === "boolean"
    && typeof record.issueNumber === "number"
    && (typeof record.issueId === "string" || record.issueId === null)
    && (typeof record.issueUrl === "string" || record.issueUrl === null)
    && typeof record.lastSyncedTitle === "string"
    && typeof record.lastSyncedCompleted === "boolean"
}

function parseWorkflowState(content: string): GitHubIssuesWorkflowState {
  const parsed = JSON.parse(content) as GitHubIssuesWorkflowStateRecord
  if (parsed.schemaVersion !== 1) {
    throw new Error("Unsupported GitHub Issues workflow state schema version.")
  }

  if (
    typeof parsed.workflowId !== "string"
    || typeof parsed.slug !== "string"
    || parsed.backend !== "github-issues"
    || typeof parsed.planPath !== "string"
    || !isRepoBinding(parsed.repo)
    || typeof parsed.localDigest !== "string"
    || !Array.isArray(parsed.items)
    || (typeof parsed.lastSyncedAt !== "string" && parsed.lastSyncedAt !== null)
  ) {
    throw new Error("Malformed GitHub Issues workflow state file.")
  }

  if (!parsed.items.every((item) => isStateItem(item))) {
    throw new Error("Malformed GitHub Issues workflow state items.")
  }

  return {
    schemaVersion: 1,
    workflowId: parsed.workflowId,
    slug: parsed.slug,
    backend: "github-issues",
    planPath: normalizeRelativePath(parsed.planPath),
    repo: parsed.repo,
    localDigest: parsed.localDigest,
    items: parsed.items,
    lastSyncedAt: parsed.lastSyncedAt,
  }
}

export function getGitHubIssuesWorkflowStateDir(cwd: string): string {
  return join(cwd, ".wunderkind", "workflows", "github-issues")
}

export function createGitHubIssuesWorkflowState(input: {
  readonly cwd: string
  readonly workflowId?: string
  readonly planAbsolutePath: string
  readonly plan: ParsedWorkflowPlan
  readonly repo: GitHubIssuesWorkflowRepoBinding
  readonly localDigest: string
}): GitHubIssuesWorkflowState {
  return {
    schemaVersion: 1,
    workflowId: input.workflowId ?? createWorkflowId(),
    slug: input.plan.slug,
    backend: "github-issues",
    planPath: normalizeRelativePath(relative(input.cwd, input.planAbsolutePath)),
    repo: input.repo,
    localDigest: input.localDigest,
    items: [],
    lastSyncedAt: null,
  }
}

export function resolveGitHubIssuesWorkflowStatePath(
  cwd: string,
  state: Pick<GitHubIssuesWorkflowState, "slug" | "workflowId">,
): string {
  return join(getGitHubIssuesWorkflowStateDir(cwd), `${state.slug}--${state.workflowId}.json`)
}

export function saveGitHubIssuesWorkflowState(cwd: string, state: GitHubIssuesWorkflowState): string {
  const dir = getGitHubIssuesWorkflowStateDir(cwd)
  mkdirSync(dir, { recursive: true })

  const filePath = resolveGitHubIssuesWorkflowStatePath(cwd, state)
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`)

  return filePath
}

export function replaceGitHubIssuesWorkflowState(
  cwd: string,
  previousState: Pick<GitHubIssuesWorkflowState, "slug" | "workflowId">,
  nextState: GitHubIssuesWorkflowState,
): string {
  const nextPath = saveGitHubIssuesWorkflowState(cwd, nextState)
  const previousPath = resolveGitHubIssuesWorkflowStatePath(cwd, previousState)

  if (previousPath !== nextPath && existsSync(previousPath)) {
    unlinkSync(previousPath)
  }

  return nextPath
}

export function loadGitHubIssuesWorkflowState(filePath: string): GitHubIssuesWorkflowState {
  return parseWorkflowState(readFileSync(filePath, "utf-8"))
}

export function findGitHubIssuesWorkflowStateByPlan(
  cwd: string,
  planAbsolutePath: string,
): GitHubIssuesWorkflowState | null {
  const dir = getGitHubIssuesWorkflowStateDir(cwd)
  if (!existsSync(dir)) return null

  const normalizedPlanPath = normalizeRelativePath(relative(cwd, planAbsolutePath))
  const matches = readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => loadGitHubIssuesWorkflowState(join(dir, entry)))
    .filter((state) => state.planPath === normalizedPlanPath)

  if (matches.length === 0) return null
  if (matches.length > 1) {
    throw new Error("Multiple GitHub Issues workflow state files match the same local plan.")
  }

  return matches[0] ?? null
}
