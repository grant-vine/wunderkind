import { describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createGitHubIssuesWorkflowState,
  findGitHubIssuesWorkflowStateByPlan,
  parseWorkflowPlan,
  resolveGitHubIssuesWorkflowStatePath,
  saveGitHubIssuesWorkflowState,
} from "../../src/cli/github-issues-mapping.js"

describe("github issues workflow mapping", () => {
  it("parses checkbox items into stable local keys", () => {
    const parsed = parseWorkflowPlan(
      "/tmp/project/.omo/plans/sample-plan.md",
      "# Sample plan\n- [ ] First task\n- [x] Duplicate task\n- [ ] Duplicate task\n",
    )

    expect(parsed.title).toBe("Sample plan")
    expect(parsed.slug).toBe("sample-plan")
    expect(parsed.items.map((item) => item.localKey)).toEqual([
      "first-task--1",
      "duplicate-task--1",
      "duplicate-task--2",
    ])
    expect(parsed.items.map((item) => item.completed)).toEqual([false, true, false])
  })

  it("stores workflow state under .wunderkind using workflow identity, not slug identity", () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-mapping-"))

    try {
      const planPath = join(cwd, ".omo", "plans", "sample-plan.md")
      const parsed = parseWorkflowPlan(planPath, "# Sample plan\n- [ ] First task\n")
      const state = createGitHubIssuesWorkflowState({
        cwd,
        workflowId: "wf-123",
        planAbsolutePath: planPath,
        plan: parsed,
        repo: {
          owner: "grant-vine",
          name: "wunderkind",
          slug: "grant-vine/wunderkind",
          remoteUrl: "https://github.com/grant-vine/wunderkind",
        },
        localDigest: "digest-1",
      })

      const statePath = resolveGitHubIssuesWorkflowStatePath(cwd, state)
      expect(statePath).toContain(join(".wunderkind", "workflows", "github-issues"))
      expect(statePath.endsWith("sample-plan--wf-123.json")).toBe(true)

      saveGitHubIssuesWorkflowState(cwd, state)
      expect(existsSync(statePath)).toBe(true)

      const loaded = findGitHubIssuesWorkflowStateByPlan(cwd, planPath)
      expect(loaded?.workflowId).toBe("wf-123")
      expect(loaded?.planPath).toBe(".omo/plans/sample-plan.md")
      expect(loaded?.repo.slug).toBe("grant-vine/wunderkind")
      expect(loaded?.items.length).toBe(0)

      const savedJson = readFileSync(statePath, "utf-8")
      expect(savedJson).toContain('"workflowId": "wf-123"')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("fails when multiple workflow files point at the same local plan", () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-mapping-dupe-"))

    try {
      const planPath = join(cwd, ".omo", "plans", "sample-plan.md")
      const parsed = parseWorkflowPlan(planPath, "# Sample plan\n- [ ] First task\n")
      const firstState = createGitHubIssuesWorkflowState({
        cwd,
        workflowId: "wf-123",
        planAbsolutePath: planPath,
        plan: parsed,
        repo: {
          owner: "grant-vine",
          name: "wunderkind",
          slug: "grant-vine/wunderkind",
          remoteUrl: "https://github.com/grant-vine/wunderkind",
        },
        localDigest: "digest-1",
      })

      const secondState = createGitHubIssuesWorkflowState({
        cwd,
        workflowId: "wf-456",
        planAbsolutePath: planPath,
        plan: parsed,
        repo: {
          owner: "grant-vine",
          name: "wunderkind",
          slug: "grant-vine/wunderkind",
          remoteUrl: "https://github.com/grant-vine/wunderkind",
        },
        localDigest: "digest-2",
      })

      saveGitHubIssuesWorkflowState(cwd, firstState)
      saveGitHubIssuesWorkflowState(cwd, secondState)

      let thrownMessage: string | null = null

      try {
        findGitHubIssuesWorkflowStateByPlan(cwd, planPath)
      } catch (error) {
        thrownMessage = error instanceof Error ? error.message : String(error)
      }

      expect(thrownMessage).toBe("Multiple GitHub Issues workflow state files match the same local plan.")
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
