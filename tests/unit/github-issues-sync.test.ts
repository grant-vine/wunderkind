import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runWorkflowSync } from "../../src/cli/github-issues-sync.js"
import type { CommandResult } from "../../src/cli/github-issues-readiness.js"

type RecordedCommand = {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
}

function writePlan(cwd: string, body: string): string {
  const planPath = join(cwd, ".omo", "plans", "sample-plan.md")
  mkdirSync(join(cwd, ".omo", "plans"), { recursive: true })
  writeFileSync(planPath, body)
  return planPath
}

function createCommandHarness() {
  const calls: RecordedCommand[] = []
  const createdIssueUrls = [
    "https://github.com/grant-vine/wunderkind/issues/101\n",
    "https://github.com/grant-vine/wunderkind/issues/102\n",
  ]
  const remoteOverrides = new Map<string, { readonly title?: string; readonly state?: "OPEN" | "CLOSED" }>()

  return {
    calls,
    remoteOverrides,
    run(command: string, args: readonly string[], cwd: string): CommandResult {
      calls.push({ command, args: [...args], cwd })

      if (command === "git" && args[0] === "-C" && args[2] === "rev-parse") {
        return { status: 0, stdout: "true\n", stderr: "" }
      }

      if (command === "git" && args[0] === "-C" && args[2] === "remote") {
        return {
          status: 0,
          stdout: "origin\thttps://github.com/grant-vine/wunderkind.git (fetch)\n",
          stderr: "",
        }
      }

      if (command === "gh" && args[0] === "--version") {
        return { status: 0, stdout: "gh version 2.0.0", stderr: "" }
      }

      if (command === "gh" && args[0] === "auth") {
        return { status: 0, stdout: "Logged in", stderr: "" }
      }

      if (command === "gh" && args[0] === "repo") {
        return {
          status: 0,
          stdout: JSON.stringify({
            nameWithOwner: "grant-vine/wunderkind",
            hasIssuesEnabled: true,
            isArchived: false,
            url: "https://github.com/grant-vine/wunderkind",
          }),
          stderr: "",
        }
      }

      if (command === "gh" && args[0] === "issue" && args[1] === "create") {
        const nextUrl = createdIssueUrls.shift()
        return { status: 0, stdout: nextUrl ?? "https://github.com/grant-vine/wunderkind/issues/999\n", stderr: "" }
      }

      if (command === "gh" && args[0] === "issue" && args[1] === "close") {
        return { status: 0, stdout: "closed\n", stderr: "" }
      }

      if (command === "gh" && args[0] === "issue" && args[1] === "view") {
        const issueNumber = args[2]
        const override = issueNumber !== undefined ? remoteOverrides.get(issueNumber) : undefined
        return {
          status: 0,
          stdout: JSON.stringify({
            number: Number(issueNumber),
            title: override?.title ?? (issueNumber === "101" ? "First task" : "Done task"),
            state: override?.state ?? (issueNumber === "101" ? "OPEN" : "CLOSED"),
            url: `https://github.com/grant-vine/wunderkind/issues/${issueNumber}`,
          }),
          stderr: "",
        }
      }

      if (command === "gh" && args[0] === "issue" && args[1] === "edit") {
        return { status: 0, stdout: "edited\n", stderr: "" }
      }

      if (command === "gh" && args[0] === "issue" && args[1] === "reopen") {
        return { status: 0, stdout: "reopened\n", stderr: "" }
      }

      return { status: 1, stdout: "", stderr: `${command} unsupported` }
    },
  }
}

describe("runWorkflowSync", () => {
  it("reports bootstrap actions in dry-run mode without creating issues", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-dry-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()

    try {
      const planPath = writePlan(cwd, "# Sample plan\n- [ ] First task\n- [x] Done task\n")
      const exitCode = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: false,
        runCommand: harness.run,
        createWorkflowId: () => "wf-123",
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(exitCode).toBe(0)
      expect(errors).toEqual([])
      expect(logs.some((line) => line.includes("Would create 2 GitHub issues"))).toBe(true)
      expect(logs.some((line) => line.includes("Re-run with --apply"))).toBe(true)
      expect(harness.calls.some((call) => call.command === "gh" && call.args[1] === "create")).toBe(false)
      expect(existsSync(join(cwd, ".wunderkind", "workflows", "github-issues"))).toBe(false)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("creates issues and writes workflow state during apply", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-apply-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()

    try {
      const planPath = writePlan(cwd, "# Sample plan\n- [ ] First task\n- [x] Done task\n")
      const exitCode = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: true,
        runCommand: harness.run,
        createWorkflowId: () => "wf-123",
        now: () => new Date("2026-07-21T10:00:00.000Z"),
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(exitCode).toBe(0)
      expect(errors).toEqual([])
      expect(harness.calls.filter((call) => call.command === "gh" && call.args[1] === "create")).toHaveLength(2)
      expect(harness.calls.some((call) => call.command === "gh" && call.args[1] === "close" && call.args[2] === "102")).toBe(true)

      const workflowPath = join(cwd, ".wunderkind", "workflows", "github-issues", "sample-plan--wf-123.json")
      expect(existsSync(workflowPath)).toBe(true)

      const saved = JSON.parse(readFileSync(workflowPath, "utf-8")) as {
        readonly workflowId: string
        readonly items: readonly { readonly issueNumber: number }[]
        readonly lastSyncedAt: string | null
      }
      expect(saved.workflowId).toBe("wf-123")
      expect(saved.items.map((item) => item.issueNumber)).toEqual([101, 102])
      expect(saved.lastSyncedAt).toBe("2026-07-21T10:00:00.000Z")
      expect(logs.some((line) => line.includes("Synchronized 2 local workflow items"))).toBe(true)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("fails closed when a mapped local item disappears from the plan", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-drift-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()

    try {
      const planPath = writePlan(cwd, "# Sample plan\n- [ ] First task\n- [x] Done task\n")
      const firstRun = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: true,
        runCommand: harness.run,
        createWorkflowId: () => "wf-123",
        now: () => new Date("2026-07-21T10:00:00.000Z"),
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })
      expect(firstRun).toBe(0)

      writePlan(cwd, "# Sample plan\n- [ ] First task\n")
      logs.length = 0
      errors.length = 0

      const secondRun = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: false,
        runCommand: harness.run,
        createWorkflowId: () => "wf-999",
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(secondRun).toBe(1)
      expect(errors.some((line) => line.includes("Local workflow drift detected"))).toBe(true)
      expect(errors.some((line) => line.includes("done-task--1"))).toBe(true)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("preserves workflow identity when the plan heading changes", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-rename-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()

    try {
      const planPath = writePlan(cwd, "# Sample plan\n- [ ] First task\n- [x] Done task\n")
      const firstRun = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: true,
        runCommand: harness.run,
        createWorkflowId: () => "wf-123",
        now: () => new Date("2026-07-21T10:00:00.000Z"),
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })
      expect(firstRun).toBe(0)

      writePlan(cwd, "# Renamed plan\n- [ ] First task\n- [x] Done task\n")
      logs.length = 0
      errors.length = 0

      const secondRun = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: true,
        runCommand: harness.run,
        createWorkflowId: () => "wf-unused",
        now: () => new Date("2026-07-21T11:00:00.000Z"),
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(secondRun).toBe(0)
      expect(errors).toEqual([])

      const stateDir = join(cwd, ".wunderkind", "workflows", "github-issues")
      const stateFiles = readdirSync(stateDir).sort()
      expect(stateFiles).toEqual(["renamed-plan--wf-123.json"])

      const thirdRun = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: false,
        runCommand: harness.run,
        createWorkflowId: () => "wf-unused-2",
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(thirdRun).toBe(0)
      expect(errors).toEqual([])
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("aborts single-plan apply before any mutation when remote drift is detected", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-remote-drift-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()

    try {
      const planPath = writePlan(cwd, "# Sample plan\n- [ ] First task\n- [x] Done task\n")
      const firstRun = await runWorkflowSync({
        cwd,
        plan: planPath,
        apply: true,
        runCommand: harness.run,
        createWorkflowId: () => "wf-123",
        now: () => new Date("2026-07-21T10:00:00.000Z"),
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })
      expect(firstRun).toBe(0)

      writePlan(cwd, "# Sample plan\n- [x] First task\n- [x] Done task\n")
      harness.remoteOverrides.set("101", { title: "Remote-only title" })
      logs.length = 0
      errors.length = 0
      harness.calls.length = 0

      let secondRunExitCode: number | null = null
      let thrownMessage: string | null = null

      try {
        secondRunExitCode = await runWorkflowSync({
          cwd,
          plan: planPath,
          apply: true,
          runCommand: harness.run,
          createWorkflowId: () => "wf-unused",
          now: () => new Date("2026-07-21T11:00:00.000Z"),
          writeStdout: (line) => logs.push(line),
          writeStderr: (line) => errors.push(line),
        })
      } catch (error) {
        thrownMessage = error instanceof Error ? error.message : String(error)
      }

      expect(secondRunExitCode === 1 || (thrownMessage?.includes("Remote drift detected") ?? false)).toBe(true)

      expect(
        harness.calls.some(
          (call) => call.command === "gh" && ["create", "edit", "close", "reopen"].includes(call.args[1] ?? ""),
        ),
      ).toBe(false)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
