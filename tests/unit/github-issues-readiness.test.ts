import { describe, expect, it } from "bun:test"
import { analyzeGitHubIssuesReadiness, type CommandResult } from "../../src/cli/github-issues-readiness.js"

type RecordedCommand = {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
}

function createRunner(resolver: (command: string, args: readonly string[]) => CommandResult) {
  const calls: RecordedCommand[] = []

  return {
    calls,
    run(command: string, args: readonly string[], cwd: string): CommandResult {
      calls.push({ command, args: [...args], cwd })
      return resolver(command, args)
    },
  }
}

describe("analyzeGitHubIssuesReadiness", () => {
  it("returns ready state when git, gh auth, and issues are available", () => {
    const runner = createRunner((command, args) => {
      if (command === "git" && args[0] === "-C" && args[2] === "rev-parse") {
        return { status: 0, stdout: "true\n", stderr: "" }
      }

      if (command === "git" && args[0] === "-C" && args[2] === "remote") {
        return {
          status: 0,
          stdout: "origin\tgit@github.com:grant-vine/wunderkind.git (fetch)\norigin\tgit@github.com:grant-vine/wunderkind.git (push)\n",
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

      return { status: 1, stdout: "", stderr: `${command} unsupported` }
    })

    const result = analyzeGitHubIssuesReadiness("/tmp/project", { runCommand: runner.run })

    expect(result.ready).toBe(true)
    expect(result.repoSlug).toBe("grant-vine/wunderkind")
    expect(result.repoRemoteUrl).toBe("https://github.com/grant-vine/wunderkind")
    expect(result.missing).toEqual([])
    expect(result.capabilities.isGitRepo).toBe(true)
    expect(result.capabilities.hasGitHubRemote).toBe(true)
    expect(result.capabilities.ghInstalled).toBe(true)
    expect(result.capabilities.ghAuthVerified).toBe(true)
    expect(result.capabilities.issuesEnabledChecked).toBe(true)
    expect(result.capabilities.issuesEnabled).toBe(true)
    expect(runner.calls.some((call) => call.command === "gh" && call.args[0] === "repo")).toBe(true)
  })

  it("fails closed when gh is not installed", () => {
    const runner = createRunner((command, args) => {
      if (command === "git" && args[2] === "rev-parse") {
        return { status: 0, stdout: "true\n", stderr: "" }
      }

      if (command === "git" && args[2] === "remote") {
        return {
          status: 0,
          stdout: "origin\thttps://github.com/grant-vine/wunderkind.git (fetch)\n",
          stderr: "",
        }
      }

      if (command === "gh" && args[0] === "--version") {
        return { status: 1, stdout: "", stderr: "not installed" }
      }

      return { status: 1, stdout: "", stderr: "unsupported" }
    })

    const result = analyzeGitHubIssuesReadiness("/tmp/project", { runCommand: runner.run })

    expect(result.ready).toBe(false)
    expect(result.repoSlug).toBe("grant-vine/wunderkind")
    expect(result.missing).toContain("GitHub CLI (`gh`) is not installed.")
    expect(result.capabilities.ghInstalled).toBe(false)
    expect(result.capabilities.issuesEnabledChecked).toBe(false)
    expect(result.capabilities.issuesEnabled).toBe(null)
  })

  it("fails when the repository has issues disabled", () => {
    const runner = createRunner((command, args) => {
      if (command === "git" && args[2] === "rev-parse") {
        return { status: 0, stdout: "true\n", stderr: "" }
      }

      if (command === "git" && args[2] === "remote") {
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
            hasIssuesEnabled: false,
            isArchived: false,
            url: "https://github.com/grant-vine/wunderkind",
          }),
          stderr: "",
        }
      }

      return { status: 1, stdout: "", stderr: "unsupported" }
    })

    const result = analyzeGitHubIssuesReadiness("/tmp/project", { runCommand: runner.run })

    expect(result.ready).toBe(false)
    expect(result.missing).toContain("GitHub Issues are disabled for the configured repository.")
    expect(result.capabilities.issuesEnabledChecked).toBe(true)
    expect(result.capabilities.issuesEnabled).toBe(false)
  })
})
