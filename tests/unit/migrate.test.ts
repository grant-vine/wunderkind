import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runProjectArtifactMigration } from "../../src/cli/migrate.js"

function createProjectRoot(): string {
  return mkdtempSync(join(tmpdir(), "wk-migrate-"))
}

describe("runProjectArtifactMigration", () => {
  it("fails hard with corrective guidance even when no artifact roots exist", async () => {
    const originalCwd = process.cwd()
    const originalError = console.error
    const projectRoot = createProjectRoot()
    const errors: string[] = []

    try {
      process.chdir(projectRoot)
      console.error = (...args: unknown[]) => {
        errors.push(args.map((arg) => String(arg)).join(" "))
      }

      const code = await runProjectArtifactMigration()

      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("wunderkind migrate was removed in this hard-cut release"))).toBe(true)
      expect(errors.some((message) => message.includes(".sisyphus/ is no longer an active Wunderkind artifact root"))).toBe(true)
    } finally {
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("fails hard with manual migration guidance when legacy artifacts exist", async () => {
    const originalCwd = process.cwd()
    const originalError = console.error
    const projectRoot = createProjectRoot()
    const errors: string[] = []

    try {
      mkdirSync(join(projectRoot, ".sisyphus", "plans"), { recursive: true })
      writeFileSync(join(projectRoot, ".sisyphus", "plans", "plan.md"), "hello\n")
      process.chdir(projectRoot)
      console.error = (...args: unknown[]) => {
        errors.push(args.map((arg) => String(arg)).join(" "))
      }

      const code = await runProjectArtifactMigration()

      expect(code).toBe(1)
      expect(existsSync(join(projectRoot, ".omo", "plans", "plan.md"))).toBe(false)
      expect(existsSync(join(projectRoot, ".sisyphus", "plans", "plan.md"))).toBe(true)
      expect(errors.some((message) => message.includes("wunderkind migrate was removed in this hard-cut release"))).toBe(true)
      expect(errors.some((message) => message.includes("Move legacy") && message.includes(".omo/ manually, then rerun doctor"))).toBe(true)
    } finally {
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("fails hard even when both legacy and primary artifact roots are present", async () => {
    const originalCwd = process.cwd()
    const originalError = console.error
    const projectRoot = createProjectRoot()
    const errors: string[] = []

    try {
      mkdirSync(join(projectRoot, ".omo", "plans"), { recursive: true })
      writeFileSync(join(projectRoot, ".omo", "plans", "existing.md"), "existing\n")
      mkdirSync(join(projectRoot, ".sisyphus", "notepads"), { recursive: true })
      writeFileSync(join(projectRoot, ".sisyphus", "notepads", "new.md"), "new\n")
      process.chdir(projectRoot)
      console.error = (...args: unknown[]) => {
        errors.push(args.map((arg) => String(arg)).join(" "))
      }

      const code = await runProjectArtifactMigration()

      expect(code).toBe(1)
      expect(readFileSync(join(projectRoot, ".omo", "plans", "existing.md"), "utf-8")).toBe("existing\n")
      expect(existsSync(join(projectRoot, ".omo", "notepads", "new.md"))).toBe(false)
      expect(existsSync(join(projectRoot, ".sisyphus", "notepads", "new.md"))).toBe(true)
      expect(errors.some((message) => message.includes("wunderkind migrate was removed in this hard-cut release"))).toBe(true)
    } finally {
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it("fails hard on --dry-run with the same corrective guidance", async () => {
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

      const code = await runProjectArtifactMigration({ dryRun: true })

      expect(code).toBe(1)
      expect(errors.some((message) => message.includes("wunderkind migrate was removed in this hard-cut release"))).toBe(true)
      expect(errors.some((message) => message.includes("--dry-run no longer previews any moves"))).toBe(true)
      expect(existsSync(join(projectRoot, ".sisyphus", "plans", "same-name.md"))).toBe(true)
    } finally {
      console.error = originalError
      process.chdir(originalCwd)
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })
})
