import { describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  buildAppendDatedHeading,
  buildNewDatedFilename,
  bootstrapDocsReadme,
  formatDocsHistoryTimestamp,
  getDocHistoryModePromptMessage,
  getDocsEnabledPromptMessage,
  getDocsPathPromptMessage,
  isManagedDocsFamilyFilename,
  resolveProjectLocalDocsPath,
  validateDocHistoryMode,
  validateDocsPath,
} from "../../src/cli/docs-output-helper.js"

describe("docs-output-helper", () => {
  it("formats docs history timestamps as sortable UTC tokens", () => {
    expect(formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:52.000Z"))).toBe("2026-03-12T18-37-52Z")
  })

  it("sorts timestamp tokens lexicographically in chronological order", () => {
    const earlier = formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:51.000Z"))
    const later = formatDocsHistoryTimestamp(new Date("2026-03-12T18:37:52.000Z"))
    expect(earlier < later).toBe(true)
  })

  it("builds append-dated headings with collision suffixes", () => {
    expect(buildAppendDatedHeading("2026-03-12T18-37-52Z", 1)).toBe("## Update 2026-03-12T18-37-52Z")
    expect(buildAppendDatedHeading("2026-03-12T18-37-52Z", 2)).toBe("## Update 2026-03-12T18-37-52Z (2)")
  })

  it("builds managed-family filenames and recognizes them", () => {
    expect(buildNewDatedFilename("marketing-strategy.md", "2026-03-12T18-37-52Z", 1)).toBe(
      "marketing-strategy--2026-03-12T18-37-52Z.md",
    )
    expect(buildNewDatedFilename("marketing-strategy.md", "2026-03-12T18-37-52Z", 2)).toBe(
      "marketing-strategy--2026-03-12T18-37-52Z--2.md",
    )
    expect(isManagedDocsFamilyFilename("marketing-strategy.md", "marketing-strategy--2026-03-12T18-37-52Z.md")).toBe(true)
    expect(isManagedDocsFamilyFilename("marketing-strategy.md", "marketing-strategy--2026-03-12T18-37-52Z--2.md")).toBe(true)
    expect(isManagedDocsFamilyFilename("marketing-strategy.md", "design-decisions--2026-03-12T18-37-52Z.md")).toBe(false)
  })

  it("validates docs paths and rejects absolute or parent-traversing paths", () => {
    expect(validateDocsPath("./docs")).toEqual({ valid: true })
    expect(validateDocsPath("../docs")).toEqual({ valid: false, error: "docsPath must not traverse parent directories" })
    expect(validateDocsPath("../../docs")).toEqual({ valid: false, error: "docsPath must not traverse parent directories" })
    expect(validateDocsPath("/tmp/docs")).toEqual({ valid: false, error: "docsPath must be a relative path" })
  })

  it("resolves project-local docs paths and rejects project-root escapes", () => {
    const tempProject = mkdtempSync(join(tmpdir(), "wk-docs-helper-"))
    const realProject = realpathSync(tempProject)

    try {
      expect(resolveProjectLocalDocsPath("", tempProject)).toEqual({
        docsPath: "docs",
        absolutePath: join(realProject, "docs"),
      })

      expect(resolveProjectLocalDocsPath("./nested/docs/", tempProject)).toEqual({
        docsPath: "nested/docs",
        absolutePath: join(realProject, "nested", "docs"),
      })

      try {
        resolveProjectLocalDocsPath(".", tempProject)
        throw new Error("Expected resolveProjectLocalDocsPath to reject project root")
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toBe("docsPath must resolve inside the current project root")
      }
    } finally {
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("validates supported doc history modes", () => {
    expect(validateDocHistoryMode("overwrite")).toBe(true)
    expect(validateDocHistoryMode("append-dated")).toBe(true)
    expect(validateDocHistoryMode("new-dated-file")).toBe(true)
    expect(validateDocHistoryMode("overwrite-archive")).toBe(true)
    expect(validateDocHistoryMode("rolling")).toBe(false)
  })

  it("bootstraps docs README only when missing", () => {
    const tempProject = mkdtempSync(join(tmpdir(), "wk-docs-helper-"))
    const readmePath = join(tempProject, "notes", "README.md")

    try {
      bootstrapDocsReadme("./notes", tempProject)
      expect(existsSync(readmePath)).toBe(true)
      const first = readFileSync(readmePath, "utf-8")
      expect(first).toContain("# Documentation")

      const custom = "# Custom\n"
      writeFileSync(readmePath, custom)
      bootstrapDocsReadme("./notes", tempProject)
      expect(readFileSync(readmePath, "utf-8")).toBe(custom)
    } finally {
      rmSync(tempProject, { recursive: true, force: true })
    }
  })

  it("exports stable prompt messages", () => {
    expect(getDocsEnabledPromptMessage()).toBe("Enable docs output to disk?")
    expect(getDocsPathPromptMessage()).toBe("Docs output directory path (relative to project root):")
    expect(getDocHistoryModePromptMessage()).toBe("Docs history mode")
  })
})
