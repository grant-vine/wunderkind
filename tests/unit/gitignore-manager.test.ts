import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname

// Query-string bust ensures Bun's coverage maps this import back to the source file
// while preventing mock contamination from other test workers that mock gitignore-manager.js
const { addAiTracesToGitignore } = await import(
  `${PROJECT_ROOT}src/cli/gitignore-manager.ts?gitignore-coverage=1`
)

describe("addAiTracesToGitignore", () => {
  it("creates a managed section with all AI trace entries when .gitignore is missing", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))

    try {
      const result = addAiTracesToGitignore(testRoot)
      const gitignorePath = join(testRoot, ".gitignore")

      expect(result.success).toBe(true)
      expect(result.added).toEqual([".wunderkind/", "AGENTS.md", ".sisyphus/", ".opencode/"])
      expect(result.alreadyPresent).toEqual([])
      expect(existsSync(gitignorePath)).toBe(true)

      const written = readFileSync(gitignorePath, "utf-8")
      expect(written).toContain("# AI tooling traces — managed by wunderkind")
      expect(written).toContain(".wunderkind/")
      expect(written).toContain("AGENTS.md")
      expect(written).toContain(".sisyphus/")
      expect(written).toContain(".opencode/")
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("is idempotent on repeated runs", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))

    try {
      const firstResult = addAiTracesToGitignore(testRoot)
      const secondResult = addAiTracesToGitignore(testRoot)
      const written = readFileSync(join(testRoot, ".gitignore"), "utf-8")

      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(true)
      expect(secondResult.added).toEqual([])
      expect(secondResult.alreadyPresent).toEqual([".wunderkind/", "AGENTS.md", ".sisyphus/", ".opencode/"])
      expect(written.match(/# AI tooling traces — managed by wunderkind/g)?.length).toBe(1)
      expect(written.match(/\.wunderkind\//g)?.length).toBe(1)
      expect(written.match(/AGENTS\.md/g)?.length).toBe(1)
      expect(written.match(/\.sisyphus\//g)?.length).toBe(1)
      expect(written.match(/\.opencode\//g)?.length).toBe(1)
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("inserts only missing entries into an existing managed section without disturbing other ignores", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))
    const gitignorePath = join(testRoot, ".gitignore")

    try {
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
        ].join("\n"),
        "utf-8",
      )

      const result = addAiTracesToGitignore(testRoot)
      const written = readFileSync(gitignorePath, "utf-8")

      expect(result.success).toBe(true)
      expect(result.added).toEqual([".sisyphus/", ".opencode/"])
      expect(result.alreadyPresent).toEqual([".wunderkind/", "AGENTS.md"])
      expect(written).toContain("node_modules/")
      expect(written).toContain("dist/")
      expect(written).toContain("coverage/")
      expect(written.match(/# AI tooling traces — managed by wunderkind/g)?.length).toBe(1)
      expect(written).toContain("# AI tooling traces — managed by wunderkind\n.sisyphus/\n.opencode/\n.wunderkind/\nAGENTS.md")
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("appends a new managed section cleanly when existing content has no trailing newline", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))
    const gitignorePath = join(testRoot, ".gitignore")

    try {
      writeFileSync(gitignorePath, "node_modules/", "utf-8")

      const result = addAiTracesToGitignore(testRoot)
      const written = readFileSync(gitignorePath, "utf-8")

      expect(result.success).toBe(true)
      expect(result.added).toEqual([".wunderkind/", "AGENTS.md", ".sisyphus/", ".opencode/"])
      expect(written).toContain("node_modules/\n\n# AI tooling traces — managed by wunderkind")
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it("returns an error when .gitignore is a directory", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "wk-gitignore-manager-"))

    try {
      mkdirSync(join(testRoot, ".gitignore"), { recursive: true })

      const result = addAiTracesToGitignore(testRoot)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.added).toEqual([])
    } finally {
      rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
