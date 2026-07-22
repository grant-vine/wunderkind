import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const CLI_ENTRY = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url))
const TEAM_NAME = "wunderkind-daily-brief"

interface CliSandbox {
  readonly rootDir: string
  readonly homeDir: string
  readonly projectDir: string
}

interface BunSpawnResult {
  readonly exitCode: number
  readonly stdout: Uint8Array
  readonly stderr: Uint8Array
}

interface BunRuntime {
  spawnSync(
    command: readonly string[],
    options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv },
  ): BunSpawnResult
}

function isBunRuntime(value: unknown): value is BunRuntime {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "spawnSync") === "function"
}

function createSandbox(): CliSandbox {
  const rootDir = mkdtempSync(join(tmpdir(), "wk-team-bootstrap-"))
  const homeDir = join(rootDir, "home")
  const projectDir = join(rootDir, "project")

  mkdirSync(homeDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "package.json"), "{}\n")

  return {
    rootDir,
    homeDir,
    projectDir,
  }
}

function cleanupSandbox(sandbox: CliSandbox): void {
  rmSync(sandbox.rootDir, { recursive: true, force: true })
}

function runCliInSandbox(sandbox: CliSandbox, ...args: readonly string[]): { readonly status: number | null; readonly output: string } {
  const bunRuntime = Reflect.get(globalThis, "Bun")
  if (!isBunRuntime(bunRuntime)) {
    throw new Error("Bun runtime is required for team-bootstrap CLI tests")
  }

  const result = bunRuntime.spawnSync(["bun", CLI_ENTRY, ...args], {
    cwd: sandbox.projectDir,
    env: {
      ...process.env,
      HOME: sandbox.homeDir,
      USERPROFILE: sandbox.homeDir,
      XDG_CONFIG_HOME: join(sandbox.homeDir, ".config"),
    },
  })

  return {
    status: result.exitCode,
    output: `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`,
  }
}

describe("team-bootstrap CLI", () => {
  it("writes the canonical project-scoped team spec via the explicit bootstrap command", () => {
    const sandbox = createSandbox()

    try {
      const result = runCliInSandbox(sandbox, "team-bootstrap", "--scope", "project", "--name", TEAM_NAME)
      expect(result.status).toBe(0)

      const configPath = join(sandbox.projectDir, ".omo", "teams", TEAM_NAME, "config.json")
      expect(existsSync(configPath)).toBe(true)

      const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>
      expect(parsed.name).toBe(TEAM_NAME)
      expect(Array.isArray(parsed.members)).toBe(true)
      expect((parsed.members as unknown[]).length).toBeGreaterThan(0)
      expect(result.output).toContain("Lifecycle guardrail")
    } finally {
      cleanupSandbox(sandbox)
    }
  })

  it("writes the canonical user-scoped team spec via the explicit bootstrap command", () => {
    const sandbox = createSandbox()

    try {
      const result = runCliInSandbox(sandbox, "team-bootstrap", "--scope", "user", "--name", TEAM_NAME)
      expect(result.status).toBe(0)

      const configPath = join(sandbox.homeDir, ".omo", "teams", TEAM_NAME, "config.json")
      expect(existsSync(configPath)).toBe(true)

      const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as {
        readonly lead?: { readonly prompt?: string }
        readonly members?: readonly unknown[]
      }
      expect(parsed.members?.length ?? 0).toBeGreaterThan(0)
      expect(parsed.lead?.prompt).toContain("What do you want to do today?")
    } finally {
      cleanupSandbox(sandbox)
    }
  })

  it("supports dry-run without writing any team files", () => {
    const sandbox = createSandbox()

    try {
      const result = runCliInSandbox(sandbox, "team-bootstrap", "--scope", "project", "--name", TEAM_NAME, "--dry-run")
      expect(result.status).toBe(0)
      expect(result.output).toContain("Dry run: would write canonical Wunderkind team spec")
      expect(existsSync(join(sandbox.projectDir, ".omo", "teams", TEAM_NAME, "config.json"))).toBe(false)
    } finally {
      cleanupSandbox(sandbox)
    }
  })
})
