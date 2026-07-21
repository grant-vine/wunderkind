import { spawnSync } from "node:child_process"

export interface CommandResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  cwd: string,
) => CommandResult

export interface GitHubIssuesReadiness {
  readonly ready: boolean
  readonly repoSlug: string | null
  readonly repoRemoteUrl: string | null
  readonly missing: readonly string[]
  readonly warnings: readonly string[]
  readonly capabilities: {
    readonly isGitRepo: boolean
    readonly hasGitHubRemote: boolean
    readonly ghInstalled: boolean
    readonly ghAuthVerified: boolean
    readonly issuesEnabledChecked: boolean
    readonly issuesEnabled: boolean | null
  }
}

interface GitHubRepoMetadata {
  readonly slug: string | null
  readonly remoteUrl: string | null
  readonly issuesEnabled: boolean | null
  readonly issuesEnabledChecked: boolean
  readonly archived: boolean
}

function runCommand(command: string, args: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, [...args], { cwd, encoding: "utf8" })

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function commandSucceeded(result: CommandResult): boolean {
  return result.status === 0
}

function parseGitHubRemote(remoteList: string): { readonly slug: string | null; readonly remoteUrl: string | null } {
  const lines = remoteList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")

  for (const line of lines) {
    const sshMatch = /github\.com:([^/\s]+)\/([^\s.]+)(?:\.git)?/i.exec(line)
    if (sshMatch?.[1] && sshMatch[2]) {
      return {
        slug: `${sshMatch[1]}/${sshMatch[2]}`,
        remoteUrl: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`,
      }
    }

    const httpsMatch = /https:\/\/github\.com\/([^/\s]+)\/([^\s.]+)(?:\.git)?/i.exec(line)
    if (httpsMatch?.[1] && httpsMatch[2]) {
      return {
        slug: `${httpsMatch[1]}/${httpsMatch[2]}`,
        remoteUrl: `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`,
      }
    }
  }

  return { slug: null, remoteUrl: null }
}

function parseRepoMetadata(value: string): GitHubRepoMetadata | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null

    const record = parsed as Record<string, unknown>
    const slug = typeof record.nameWithOwner === "string" ? record.nameWithOwner : null
    const remoteUrl = typeof record.url === "string" ? record.url : null
    const issuesEnabled = typeof record.hasIssuesEnabled === "boolean" ? record.hasIssuesEnabled : null
    const archived = record.isArchived === true

    if (slug === null) return null

    return {
      slug,
      remoteUrl,
      issuesEnabled,
      issuesEnabledChecked: issuesEnabled !== null,
      archived,
    }
  } catch {
    return null
  }
}

export function analyzeGitHubIssuesReadiness(
  cwd: string,
  options?: { readonly runCommand?: CommandRunner },
): GitHubIssuesReadiness {
  const execute = options?.runCommand ?? runCommand

  const gitRepoResult = execute("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], cwd)
  const isGitRepo = commandSucceeded(gitRepoResult)

  if (!isGitRepo) {
    return {
      ready: false,
      repoSlug: null,
      repoRemoteUrl: null,
      missing: ["The current directory is not a git repository."],
      warnings: [],
      capabilities: {
        isGitRepo: false,
        hasGitHubRemote: false,
        ghInstalled: false,
        ghAuthVerified: false,
        issuesEnabledChecked: false,
        issuesEnabled: null,
      },
    }
  }

  const remoteResult = execute("git", ["-C", cwd, "remote", "-v"], cwd)
  const remote = parseGitHubRemote(remoteResult.stdout)
  const hasGitHubRemote = remote.slug !== null
  const ghVersionResult = execute("gh", ["--version"], cwd)
  const ghInstalled = commandSucceeded(ghVersionResult)
  const authResult = ghInstalled ? execute("gh", ["auth", "status", "-h", "github.com"], cwd) : null
  const ghAuthVerified = authResult !== null && commandSucceeded(authResult)
  const missing: string[] = []
  const warnings: string[] = []

  if (!hasGitHubRemote) {
    missing.push("No GitHub remote was detected for the current repository.")
  }

  if (!ghInstalled) {
    missing.push("GitHub CLI (`gh`) is not installed.")
  }

  if (ghInstalled && !ghAuthVerified) {
    missing.push("GitHub CLI authentication is not verified for github.com.")
  }

  let repoMetadata: GitHubRepoMetadata = {
    slug: remote.slug,
    remoteUrl: remote.remoteUrl,
    issuesEnabled: null,
    issuesEnabledChecked: false,
    archived: false,
  }

  if (remote.slug !== null && ghAuthVerified) {
    const repoViewResult = execute(
      "gh",
      ["repo", "view", remote.slug, "--json", "nameWithOwner,hasIssuesEnabled,isArchived,url"],
      cwd,
    )

    if (commandSucceeded(repoViewResult)) {
      const parsed = parseRepoMetadata(repoViewResult.stdout)
      if (parsed !== null) {
        repoMetadata = parsed
      } else {
        warnings.push("GitHub repository metadata could not be parsed from `gh repo view`.")
      }
    } else {
      warnings.push("GitHub repository metadata could not be loaded from `gh repo view`.")
    }
  }

  if (repoMetadata.archived) {
    missing.push("The configured GitHub repository is archived.")
  }

  if (repoMetadata.issuesEnabledChecked && repoMetadata.issuesEnabled === false) {
    missing.push("GitHub Issues are disabled for the configured repository.")
  }

  return {
    ready: missing.length === 0,
    repoSlug: repoMetadata.slug,
    repoRemoteUrl: repoMetadata.remoteUrl,
    missing,
    warnings,
    capabilities: {
      isGitRepo,
      hasGitHubRemote,
      ghInstalled,
      ghAuthVerified,
      issuesEnabledChecked: repoMetadata.issuesEnabledChecked,
      issuesEnabled: repoMetadata.issuesEnabled,
    },
  }
}
