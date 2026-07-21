import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runWorkflowSync } from "../../src/cli/github-issues-sync.js"
import type { CommandResult } from "../../src/cli/github-issues-readiness.js"

type RecordedCommand = {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
}

function writePlan(cwd: string, fileName: string, body: string): string {
  const planDir = join(cwd, ".omo", "plans")
  const planPath = join(planDir, fileName)
  mkdirSync(planDir, { recursive: true })
  writeFileSync(planPath, body)
  return planPath
}

function createCommandHarness() {
  const calls: RecordedCommand[] = []
  let createdIssueNumber = 100
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
        createdIssueNumber += 1
        return {
          status: 0,
          stdout: `https://github.com/grant-vine/wunderkind/issues/${createdIssueNumber}\n`,
          stderr: "",
        }
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
            title: override?.title ?? `Issue ${issueNumber}`,
            state: override?.state ?? "OPEN",
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

function createWorkflowIdHarness(): () => string {
  let nextId = 0

  return () => {
    nextId += 1
    return `wf-${String(nextId).padStart(3, "0")}`
  }
}

describe("runWorkflowSync --all", () => {
  it("reports aggregate dry-run work for direct-child plan files in lexicographic order", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-all-dry-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()
    const createWorkflowId = createWorkflowIdHarness()

    try {
      writePlan(cwd, "zeta-plan.md", "# Zeta plan\n- [ ] Zeta task\n")
      writePlan(cwd, "alpha-plan.md", "# Alpha plan\n- [ ] Alpha task\n- [x] Closed alpha\n")
      mkdirSync(join(cwd, ".omo", "plans", "nested"), { recursive: true })
      writeFileSync(join(cwd, ".omo", "plans", "nested", "ignored.md"), "# Ignored\n- [ ] Ignored\n")

      const exitCode = await runWorkflowSync({
        cwd,
        all: true,
        apply: false,
        runCommand: harness.run,
        createWorkflowId,
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(exitCode).toBe(0)
      expect(errors).toEqual([])
      expect(logs).toEqual([
        "Would synchronize 2 workflow plans to GitHub Issues.",
        "[1/2] alpha-plan.md",
        "Would create 2 GitHub issues for alpha-plan.",
        "Re-run with --apply to create issues and write .wunderkind/workflows/github-issues/alpha-plan--wf-001.json.",
        "[2/2] zeta-plan.md",
        "Would create 1 GitHub issues for zeta-plan.",
        "Re-run with --apply to create issues and write .wunderkind/workflows/github-issues/zeta-plan--wf-002.json.",
      ])
      expect(harness.calls.some((call) => call.command === "gh" && call.args[1] === "create")).toBe(false)
      expect(existsSync(join(cwd, ".wunderkind", "workflows", "github-issues"))).toBe(false)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("fails apply-mode preflight before creating any GitHub issues when one selected plan is invalid", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-all-apply-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()
    const createWorkflowId = createWorkflowIdHarness()

    try {
      writePlan(cwd, "alpha-plan.md", "# Alpha plan\n- [ ] Alpha task\n")
      writePlan(cwd, "broken-plan.md", "# Broken plan\nNo checkbox items here\n")

      const exitCode = await runWorkflowSync({
        cwd,
        all: true,
        apply: true,
        runCommand: harness.run,
        createWorkflowId,
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })

      expect(exitCode).toBe(1)
      expect(logs).toEqual([])
      expect(errors).toEqual([
        "Cannot apply --all because preflight failed for 1 workflow plan.",
        "[broken-plan.md] No checkbox items were found in the selected workflow plan.",
      ])
      expect(harness.calls.some((call) => call.command === "gh" && call.args[1] === "create")).toBe(false)
      expect(existsSync(join(cwd, ".wunderkind", "workflows", "github-issues"))).toBe(false)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it("aborts --all apply before any mutation when one selected plan has remote drift", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "wk-github-sync-all-drift-"))
    const logs: string[] = []
    const errors: string[] = []
    const harness = createCommandHarness()
    const createWorkflowId = createWorkflowIdHarness()

    try {
      const alphaPath = writePlan(cwd, "alpha-plan.md", "# Alpha plan\n- [ ] Issue 101\n")
      const zetaPath = writePlan(cwd, "zeta-plan.md", "# Zeta plan\n- [ ] Issue 102\n")

      const bootstrap = await runWorkflowSync({
        cwd,
        all: true,
        apply: true,
        runCommand: harness.run,
        createWorkflowId,
        now: () => new Date("2026-07-21T10:00:00.000Z"),
        writeStdout: (line) => logs.push(line),
        writeStderr: (line) => errors.push(line),
      })
      expect(bootstrap).toBe(0)

      writePlan(cwd, "alpha-plan.md", "# Alpha plan\n- [x] Issue 101\n")
      writePlan(cwd, "zeta-plan.md", "# Zeta plan\n- [ ] Issue 102\n")
      harness.remoteOverrides.set("102", { title: "Remote drifted title" })
      logs.length = 0
      errors.length = 0
      harness.calls.length = 0

      let secondRunExitCode: number | null = null
      let thrownMessage: string | null = null

      try {
        secondRunExitCode = await runWorkflowSync({
          cwd,
          all: true,
          apply: true,
          runCommand: harness.run,
          createWorkflowId,
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
      expect(harness.calls.some((call) => call.command === "gh" && call.args[1] === "view" && call.args[2] === "102")).toBe(true)
      expect(alphaPath).toContain("alpha-plan.md")
      expect(zetaPath).toContain("zeta-plan.md")
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
