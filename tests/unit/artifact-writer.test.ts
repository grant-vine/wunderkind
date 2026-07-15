import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeDurableArtifact } from "../../src/artifact-writer.js"

function createSandbox(name: string): string {
  const path = join(tmpdir(), `wk-artifact-writer-${name}-${Date.now()}`)
  mkdirSync(path, { recursive: true })
  return path
}

describe("artifact-writer", () => {
  it("appends to notepad lanes by default", () => {
    const sandbox = createSandbox("notepad")

    try {
      const relativePath = ".omo/notepads/permissions/learnings.md"
      writeDurableArtifact({ relativePath, content: "First line\n" }, sandbox)
      writeDurableArtifact({ relativePath, content: "Second line\n" }, sandbox)

      expect(readFileSync(join(sandbox, relativePath), "utf-8")).toBe("First line\nSecond line\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("appends to evidence lanes by default", () => {
    const sandbox = createSandbox("evidence")

    try {
      const relativePath = ".omo/evidence/permissions/findings.md"
      writeDurableArtifact({ relativePath, content: "Observation A\n" }, sandbox)
      writeDurableArtifact({ relativePath, content: "Observation B\n" }, sandbox)

      expect(readFileSync(join(sandbox, relativePath), "utf-8")).toBe("Observation A\nObservation B\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("rejects path traversal outside the project root", () => {
    const sandbox = createSandbox("traversal")

    try {
      try {
        writeDurableArtifact({
          relativePath: "../escape.md",
          content: "oops",
        }, sandbox)
        throw new Error("Expected traversal write to fail")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("relativePath must stay within the current project root")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("rejects writes outside protected Wunderkind lanes", () => {
    const sandbox = createSandbox("lane-reject")

    try {
      try {
        writeDurableArtifact({
          relativePath: "src/app.ts",
          content: "bad",
        }, sandbox)
        throw new Error("Expected lane rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("durable artifacts must stay inside append-only Wunderkind memory lanes")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("rejects writes through a symlinked protected lane segment", () => {
    const sandbox = createSandbox("lane-symlink")
    const outside = createSandbox("lane-symlink-outside")

    try {
      mkdirSync(join(sandbox, ".omo/notepads"), { recursive: true })
      symlinkSync(outside, join(sandbox, ".omo/notepads/link"), "dir")

      try {
        writeDurableArtifact({
          relativePath: ".omo/notepads/link/escape.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected symlink rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("resolved durable artifact path escaped the current project root")
      }

      expect(existsSync(join(outside, "escape.md"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it("rejects legacy .sisyphus durable artifact paths", () => {
    const sandbox = createSandbox("legacy-reject")

    try {
      try {
        writeDurableArtifact({ relativePath: ".sisyphus/notepads/runtime/learnings.md", content: "Entry\n" }, sandbox)
        throw new Error("Expected legacy artifact path rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toBe(
          ".sisyphus/ is no longer an active Wunderkind artifact root. Move durable project artifacts into .omo/ and use .omo/notepads/ or .omo/evidence/.",
        )
      }
      expect(existsSync(join(sandbox, ".omo/notepads/runtime/learnings.md"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

})
