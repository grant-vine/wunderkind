import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { __setCompanionDownloadForTests, repairCodexCompanions } from "../../src/cli/codex/companion-repair.js"
import { cleanup, configure, createFakeCodex, sandbox } from "./helpers/codex-lifecycle-fixtures.js"

function seedArchitecture(root: string, dependency = "codebase-design"): void {
  const directory = join(root, "skills", "improve-codebase-architecture")
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, "SKILL.md"), `Call the Skill tool with "${dependency}".`, "utf8")
}

async function repairError(): Promise<Error | undefined> {
  try { await repairCodexCompanions(); return undefined }
  catch (error) { if (error instanceof Error) return error; throw error }
}

describe("Codex companion repair", () => {
  it("installs missing supporting files and verifies a repeat repair needs no download", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome)
    const downloads: string[] = []
    __setCompanionDownloadForTests(async (url) => {
      downloads.push(url)
      return url.endsWith("SKILL.md") ? "---\nname: codebase-design\n---\nShared vocabulary." : "Supporting reference."
    })
    try {
      const result = await repairCodexCompanions()

      expect(result.status).toBe("repaired")
      expect(result.skills).toEqual(["codebase-design"])
      expect(result.remainingDependencies).toEqual([])
      expect(readFileSync(join(paths.codexHome, "skills", "codebase-design", "DEEPENING.md"), "utf8")).toBe("Supporting reference.")
      expect(readFileSync(join(paths.codexHome, "skills", "codebase-design", "LICENSE"), "utf8")).toBe("Supporting reference.")
      expect(readFileSync(join(paths.codexHome, "skills", "improve-codebase-architecture", "SKILL.md"), "utf8")).toContain('"codebase-design"')
      expect(downloads.every((url) => url.includes("49dd158d1076134a641b33efb035946536778336"))).toBe(true)
      const count = downloads.length
      expect((await repairCodexCompanions()).status).toBe("current")
      expect(downloads).toHaveLength(count)
    } finally { __setCompanionDownloadForTests(undefined); cleanup(paths) }
  })

  it("previews repairs without downloading or creating supporting directories", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome, "grilling")
    __setCompanionDownloadForTests(async () => { throw new Error("Dry run must not download") })
    try {
      const result = await repairCodexCompanions({ dryRun: true })

      expect(result.status).toBe("planned")
      expect(result.skills).toEqual(["grilling"])
      expect(existsSync(join(paths.codexHome, "skills", "grilling"))).toBe(false)
    } finally { __setCompanionDownloadForTests(undefined); cleanup(paths) }
  })

  it("preserves an incomplete existing supporting directory instead of replacing it", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome)
    const directory = join(paths.codexHome, "skills", "codebase-design")
    mkdirSync(directory)
    writeFileSync(join(directory, "notes.md"), "Operator edits.", "utf8")
    try {
      const error = await repairError()

      expect(error?.message).toContain("already exists")
      expect(readFileSync(join(directory, "notes.md"), "utf8")).toBe("Operator edits.")
      expect(existsSync(join(directory, "SKILL.md"))).toBe(false)
    } finally { cleanup(paths) }
  })

  it("holds unknown dependencies instead of downloading arbitrary skill names", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome, "unknown-support")
    try {
      const error = await repairError()

      expect(error?.message).toContain("Unsupported supporting skill: unknown-support")
      expect(existsSync(join(paths.codexHome, "skills", "unknown-support"))).toBe(false)
    } finally { cleanup(paths) }
  })

  it("leaves no partial skill when a supporting-file download fails", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome)
    __setCompanionDownloadForTests(async (url) => {
      if (url.endsWith("DEEPENING.md")) throw new Error("Download failed")
      return "---\nname: codebase-design\n---\n"
    })
    try {
      const error = await repairError()

      expect(error?.message).toContain("Download failed")
      expect(existsSync(join(paths.codexHome, "skills", "codebase-design"))).toBe(false)
    } finally { __setCompanionDownloadForTests(undefined); cleanup(paths) }
  })

  it("rejects a downloaded skill with an unexpected identity before installation", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome)
    __setCompanionDownloadForTests(async () => "---\nname: unrelated-skill\n---\n")
    try {
      const error = await repairError()

      expect(error?.message).toContain("unexpected identity")
      expect(existsSync(join(paths.codexHome, "skills", "codebase-design"))).toBe(false)
    } finally { __setCompanionDownloadForTests(undefined); cleanup(paths) }
  })

  it("preserves a destination created while downloads are in progress", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome)
    const directory = join(paths.codexHome, "skills", "codebase-design")
    __setCompanionDownloadForTests(async (url) => {
      if (url.endsWith("LICENSE")) {
        mkdirSync(directory)
        writeFileSync(join(directory, "notes.md"), "Concurrent operator edits.", "utf8")
      }
      return url.endsWith("SKILL.md") ? "---\nname: codebase-design\n---\n" : "Supporting reference."
    })
    try {
      const error = await repairError()

      expect(error?.message).toContain("already exists")
      expect(readFileSync(join(directory, "notes.md"), "utf8")).toBe("Concurrent operator edits.")
      expect(existsSync(join(directory, "SKILL.md"))).toBe(false)
    } finally { __setCompanionDownloadForTests(undefined); cleanup(paths) }
  })

  it("refuses a dangling supporting-directory link without writing through it", async () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    seedArchitecture(paths.codexHome)
    const external = join(paths.root, "external-skill")
    symlinkSync(external, join(paths.codexHome, "skills", "codebase-design"))
    try {
      const error = await repairError()

      expect(error?.message).toContain("already exists")
      expect(existsSync(external)).toBe(false)
    } finally { cleanup(paths) }
  })
})
