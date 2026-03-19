import { describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("addAiTracesToGitignore", () => {
  it("creates a managed section with all AI trace entries when .gitignore is missing", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))
    const originalCwd = process.cwd()

    try {
      process.chdir(testRoot)
      const { addAiTracesToGitignore } = await import(`../../src/cli/gitignore-manager.ts?create=${Date.now()}`)
      const result = addAiTracesToGitignore()
      const gitignorePath = join(testRoot, ".gitignore")

      expect(result.success).toBe(true)
      expect(result.added).toEqual([".wunderkind/", "AGENTS.md", ".desloppify/", ".sisyphus/", ".opencode/"])
      expect(result.alreadyPresent).toEqual([])
      expect(existsSync(gitignorePath)).toBe(true)

      const written = readFileSync(gitignorePath, "utf-8")
      expect(written).toContain("# AI tooling traces — managed by wunderkind")
      expect(written).toContain(".wunderkind/")
      expect(written).toContain("AGENTS.md")
      expect(written).toContain(".desloppify/")
      expect(written).toContain(".sisyphus/")
      expect(written).toContain(".opencode/")
    } finally {
      process.chdir(originalCwd)
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("is idempotent on repeated runs", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))
    const originalCwd = process.cwd()

    try {
      process.chdir(testRoot)
      const { addAiTracesToGitignore } = await import(`../../src/cli/gitignore-manager.ts?idempotent=${Date.now()}`)

      const firstResult = addAiTracesToGitignore()
      const secondResult = addAiTracesToGitignore()
      const written = readFileSync(join(testRoot, ".gitignore"), "utf-8")

      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(true)
      expect(secondResult.added).toEqual([])
      expect(secondResult.alreadyPresent).toEqual([".wunderkind/", "AGENTS.md", ".desloppify/", ".sisyphus/", ".opencode/"])
      expect(written.match(/# AI tooling traces — managed by wunderkind/g)?.length).toBe(1)
      expect(written.match(/\.wunderkind\//g)?.length).toBe(1)
      expect(written.match(/AGENTS\.md/g)?.length).toBe(1)
      expect(written.match(/\.desloppify\//g)?.length).toBe(1)
      expect(written.match(/\.sisyphus\//g)?.length).toBe(1)
      expect(written.match(/\.opencode\//g)?.length).toBe(1)
    } finally {
      process.chdir(originalCwd)
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("inserts only missing entries into an existing managed section without disturbing other ignores", async () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))
    const originalCwd = process.cwd()
    const gitignorePath = join(testRoot, ".gitignore")

    try {
      process.chdir(testRoot)
      writeFileSync(
        gitignorePath,
        [
          "node_modules/",
          "dist/",
          "",
          "# AI tooling traces — managed by wunderkind",
          ".wunderkind/",
          "AGENTS.md",
          "",
          "coverage/",
          ".desloppify/",
        ].join("\n"),
        "utf-8",
      )

      const { addAiTracesToGitignore } = await import(`../../src/cli/gitignore-manager.ts?section=${Date.now()}`)
      const result = addAiTracesToGitignore()
      const written = readFileSync(gitignorePath, "utf-8")

      expect(result.success).toBe(true)
      expect(result.added).toEqual([".sisyphus/", ".opencode/"])
      expect(result.alreadyPresent).toEqual([".wunderkind/", "AGENTS.md", ".desloppify/"])
      expect(written).toContain("node_modules/")
      expect(written).toContain("dist/")
      expect(written).toContain("coverage/")
      expect(written.match(/# AI tooling traces — managed by wunderkind/g)?.length).toBe(1)
      expect(written).toContain("# AI tooling traces — managed by wunderkind\n.sisyphus/\n.opencode/\n.wunderkind/\nAGENTS.md")
      expect(written).toContain(".desloppify/")
    } finally {
      process.chdir(originalCwd)
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
