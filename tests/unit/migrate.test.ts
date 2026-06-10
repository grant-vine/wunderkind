import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runProjectArtifactMigration } from "../../src/cli/migrate.js"

function createProjectRoot(): string {
  return mkdtempSync(join(tmpdir(), "wk-migrate-"))
}

describe("runProjectArtifactMigration", () => {
  it("renames .sisyphus to .omo when no primary directory exists", async () => {
    const originalCwd = process.cwd()
    const projectRoot = createProjectRoot()

    try {
      mkdirSync(join(projectRoot, ".sisyphus", "plans"), { recursive: true })
      writeFileSync(join(projectRoot, ".sisyphus", "plans", "plan.md"), "hello\n")
      process.chdir(projectRoot)

      const code = await runProjectArtifactMigration()

      expect(code).toBe(0)
      expect(existsSync(join(projectRoot, ".omo", "plans", "plan.md"))).toBe(true)
      expect(existsSync(join(projectRoot, ".sisyphus"))).toBe(false)
    } finally {
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("merges non-conflicting legacy files into an existing .omo directory", async () => {
    const originalCwd = process.cwd()
    const projectRoot = createProjectRoot()

    try {
      mkdirSync(join(projectRoot, ".omo", "plans"), { recursive: true })
      writeFileSync(join(projectRoot, ".omo", "plans", "existing.md"), "existing\n")
      mkdirSync(join(projectRoot, ".sisyphus", "notepads"), { recursive: true })
      writeFileSync(join(projectRoot, ".sisyphus", "notepads", "new.md"), "new\n")
      process.chdir(projectRoot)

      const code = await runProjectArtifactMigration()

      expect(code).toBe(0)
      expect(readFileSync(join(projectRoot, ".omo", "plans", "existing.md"), "utf-8")).toBe("existing\n")
      expect(readFileSync(join(projectRoot, ".omo", "notepads", "new.md"), "utf-8")).toBe("new\n")
      expect(existsSync(join(projectRoot, ".sisyphus"))).toBe(false)
    } finally {
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("fails when both roots contain conflicting file content", async () => {
    const originalCwd = process.cwd()
    const originalError = console.error
    const projectRoot = createProjectRoot()
    const errors: string[] = []

    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      mkdirSync(join(projectRoot, ".omo", "plans"), { recursive: true })
      writeFileSync(join(projectRoot, ".omo", "plans", "same-name.md"), "primary\n")
      mkdirSync(join(projectRoot, ".sisyphus", "plans"), { recursive: true })
      writeFileSync(join(projectRoot, ".sisyphus", "plans", "same-name.md"), "legacy\n")
      process.chdir(projectRoot)

      const code = await runProjectArtifactMigration()

      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("same-name.md"))).toBe(true)
      expect(existsSync(join(projectRoot, ".sisyphus", "plans", "same-name.md"))).toBe(true)
    } finally {
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })
})
