import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { runProjectArtifactMigration } from "../../src/cli/migrate.js"

const CLI_ENTRY = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url))

function createProjectRoot(): string {
  return mkdtempSync(join(tmpdir(), "wk-migrate-"))
}

describe("runProjectArtifactMigration", () => {
  it("reports nothing to migrate when no legacy OMO config exists", async () => {
    const originalCwd = process.cwd()
    const projectRoot = createProjectRoot()
    const messages: string[] = []

    try {
      process.chdir(projectRoot)
      const originalLog = console.log
      console.log = (...args: unknown[]) => {
        messages.push(args.map((arg) => String(arg)).join(" "))
      }

      const code = await runProjectArtifactMigration()

      expect(code).toBe(0)
      expect(messages.some((message) => message.includes("Nothing to migrate."))).toBe(true)
      console.log = originalLog
    } finally {
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("merges legacy OMO config into ~/.omo/omo.jsonc without clobbering existing target values", async () => {
    const originalCwd = process.cwd()
    const projectRoot = createProjectRoot()
    const homeDir = join(projectRoot, "home")
    const legacyConfigDir = join(homeDir, ".config", "opencode")
    const targetDir = join(homeDir, ".omo")

    try {
      mkdirSync(legacyConfigDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(
        join(legacyConfigDir, "oh-my-opencode.json"),
        JSON.stringify({ model: "openai/gpt-5", legacyOnly: "preserve-me" }),
      )
      writeFileSync(
        join(targetDir, "omo.jsonc"),
        JSON.stringify({ model: "openai/gpt-4.1", existingOnly: "keep-me" }),
      )
      process.chdir(projectRoot)

      const result = spawnSync(process.execPath, [CLI_ENTRY, "migrate"], {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, HOME: homeDir },
      })

      expect(result.status).toBe(0)
      expect(result.stdout).not.toContain(".sisyphus")
      expect(existsSync(join(legacyConfigDir, "oh-my-opencode.json"))).toBe(false)
      expect(JSON.parse(readFileSync(join(targetDir, "omo.jsonc"), "utf-8"))).toEqual({
        model: "openai/gpt-4.1",
        existingOnly: "keep-me",
        legacyOnly: "preserve-me",
      })
    } finally {
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("supports --dry-run and leaves files unchanged while previewing the unified target", () => {
    const projectRoot = createProjectRoot()
    const homeDir = join(projectRoot, "home")
    const legacyConfigDir = join(homeDir, ".config", "opencode")
    const targetDir = join(homeDir, ".omo")

    try {
      mkdirSync(legacyConfigDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(join(legacyConfigDir, "oh-my-opencode.json"), JSON.stringify({ model: "openai/gpt-5" }))
      writeFileSync(join(targetDir, "omo.jsonc"), JSON.stringify({ model: "openai/gpt-4.1" }))

      const result = spawnSync(process.execPath, [CLI_ENTRY, "migrate", "--dry-run"], {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, HOME: homeDir },
      })

      expect(result.status).toBe(0)
      expect(result.stdout + result.stderr).toContain("~/.omo/omo.jsonc")
      expect(existsSync(join(legacyConfigDir, "oh-my-opencode.json"))).toBe(true)
      expect(JSON.parse(readFileSync(join(targetDir, "omo.jsonc"), "utf-8"))).toEqual({ model: "openai/gpt-4.1" })
    } finally {
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("supports --json for machine-readable dry-run output", () => {
    const projectRoot = createProjectRoot()
    const homeDir = join(projectRoot, "home")
    const legacyConfigDir = join(homeDir, ".config", "opencode")

    try {
      mkdirSync(legacyConfigDir, { recursive: true })
      writeFileSync(join(legacyConfigDir, "oh-my-opencode.json"), JSON.stringify({ model: "openai/gpt-5" }))

      const result = spawnSync(process.execPath, [CLI_ENTRY, "migrate", "--dry-run", "--json"], {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, HOME: homeDir },
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({
        status: "dry-run",
        legacyConfigPath: join(legacyConfigDir, "oh-my-opencode.json"),
        targetConfigPath: join(homeDir, ".omo", "omo.jsonc"),
        preview: {
          copiedPaths: ["model"],
          keptPaths: [],
          conflicts: [],
        },
        message: `Dry run: would migrate ${join(legacyConfigDir, "oh-my-opencode.json")} into ~/.omo/omo.jsonc.`,
      })
    } finally {
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("migrates legacy oh-my-openagent config files into ~/.omo/omo.jsonc too", () => {
    const projectRoot = createProjectRoot()
    const homeDir = join(projectRoot, "home")
    const legacyConfigDir = join(homeDir, ".config", "opencode")
    const targetDir = join(homeDir, ".omo")

    try {
      mkdirSync(legacyConfigDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(join(legacyConfigDir, "oh-my-openagent.jsonc"), JSON.stringify({ agents: { legacy: true } }))
      writeFileSync(join(targetDir, "omo.jsonc"), JSON.stringify({ existingOnly: "keep-me" }))

      const result = spawnSync(process.execPath, [CLI_ENTRY, "migrate", "--json"], {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, HOME: homeDir },
      })

      expect(result.status).toBe(0)
      expect(existsSync(join(legacyConfigDir, "oh-my-openagent.jsonc"))).toBe(false)
      expect(JSON.parse(readFileSync(join(targetDir, "omo.jsonc"), "utf-8"))).toEqual({
        existingOnly: "keep-me",
        agents: { legacy: true },
      })
      expect(JSON.parse(result.stdout)).toEqual({
        status: "migrated",
        legacyConfigPath: join(legacyConfigDir, "oh-my-openagent.jsonc"),
        targetConfigPath: join(homeDir, ".omo", "omo.jsonc"),
        preview: {
          copiedPaths: ["agents"],
          keptPaths: [],
          conflicts: [],
        },
        message: `Migrated ${join(legacyConfigDir, "oh-my-openagent.jsonc")} into ~/.omo/omo.jsonc.`,
      })
    } finally {
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("fails closed when the legacy config is malformed", () => {
    const projectRoot = createProjectRoot()
    const homeDir = join(projectRoot, "home")
    const legacyConfigDir = join(homeDir, ".config", "opencode")

    try {
      mkdirSync(legacyConfigDir, { recursive: true })
      writeFileSync(join(legacyConfigDir, "oh-my-opencode.json"), "[]")

      const result = spawnSync(process.execPath, [CLI_ENTRY, "migrate", "--json"], {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, HOME: homeDir },
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        status: "error",
        legacyConfigPath: join(legacyConfigDir, "oh-my-opencode.json"),
        targetConfigPath: join(homeDir, ".omo", "omo.jsonc"),
        preview: {
          copiedPaths: [],
          keptPaths: [],
          conflicts: [],
        },
        message: `Failed to migrate ${join(legacyConfigDir, "oh-my-opencode.json")}.`,
        error: `Invalid config format: ${join(legacyConfigDir, "oh-my-opencode.json")}`,
      })
    } finally {
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })
})
