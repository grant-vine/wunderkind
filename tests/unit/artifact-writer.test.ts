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
  const cleanupPaths: string[] = []

  it("allows product-wunderkind to write a PRD under .sisyphus/prds", () => {
    const sandbox = createSandbox("product-prd")
    cleanupPaths.push(sandbox)
    try {
      const result = writeDurableArtifact({
        agentKey: "product-wunderkind",
        kind: "prd",
        relativePath: ".sisyphus/prds/new-checkout.md",
        content: "# Checkout PRD\n",
      }, sandbox)

      expect(result.relativePath).toBe(".sisyphus/prds/new-checkout.md")
      expect(existsSync(join(sandbox, ".sisyphus/prds/new-checkout.md"))).toBe(true)
      expect(readFileSync(join(sandbox, ".sisyphus/prds/new-checkout.md"), "utf-8")).toBe("# Checkout PRD\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("allows creative-director to write DESIGN.md", () => {
    const sandbox = createSandbox("creative-design")
    cleanupPaths.push(sandbox)
    try {
      const result = writeDurableArtifact({
        agentKey: "creative-director",
        kind: "design-md",
        relativePath: "DESIGN.md",
        content: "## Overview\n",
      }, sandbox)

      expect(result.relativePath).toBe("DESIGN.md")
      expect(readFileSync(join(sandbox, "DESIGN.md"), "utf-8")).toBe("## Overview\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects path traversal outside the project root", () => {
    const sandbox = createSandbox("traversal")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "prd",
          relativePath: "../escape.md",
          content: "oops",
        }, sandbox)
        throw new Error("Expected traversal write to fail")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("relativePath must stay within the current project root")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects writes outside an agent's bounded lanes", () => {
    const sandbox = createSandbox("lane-reject")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "prd",
          relativePath: "src/app.ts",
          content: "bad",
        }, sandbox)
        throw new Error("Expected lane rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("product-wunderkind may not write outside its bounded durable-artifact lanes")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("allows product-wunderkind to write a draft under .sisyphus/drafts", () => {
    const sandbox = createSandbox("product-draft")
    cleanupPaths.push(sandbox)
    try {
      const result = writeDurableArtifact({
        agentKey: "product-wunderkind",
        kind: "draft",
        relativePath: ".sisyphus/drafts/release-0-13-0.md",
        content: "# Release draft\n",
      }, sandbox)

      expect(result.relativePath).toBe(".sisyphus/drafts/release-0-13-0.md")
      expect(readFileSync(join(sandbox, ".sisyphus/drafts/release-0-13-0.md"), "utf-8")).toBe("# Release draft\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects draft artifacts for agents outside the draft lane allowlist", () => {
    const sandbox = createSandbox("marketing-draft")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "marketing-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/drafts/campaign.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected draft rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("marketing-wunderkind may not write outside its bounded durable-artifact lanes")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects draft artifacts outside .sisyphus/drafts", () => {
    const sandbox = createSandbox("draft-wrong-path")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/plans/not-a-draft.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected wrong-path rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("draft artifacts must stay under .sisyphus/drafts/")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects traversal attempts for draft artifacts", () => {
    const sandbox = createSandbox("draft-traversal")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/drafts/../../../escape.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected traversal rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("relativePath must stay within the current project root")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects draft writes that escape through a symlinked lane segment", () => {
    const sandbox = createSandbox("draft-symlink-escape")
    cleanupPaths.push(sandbox)
    const outside = createSandbox("draft-symlink-outside")
    cleanupPaths.push(outside)
    try {
      mkdirSync(join(sandbox, ".sisyphus/drafts"), { recursive: true })
      symlinkSync(outside, join(sandbox, ".sisyphus/drafts/link"), "dir")

      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/drafts/link/escape.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected symlink escape rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("resolved durable artifact path escaped the current project root")
      }

      expect(existsSync(join(outside, "escape.md"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
      rmSync(outside, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(outside), 1)
    }
  })

  it("rejects draft writes before creating directories through a symlinked lane segment", () => {
    const sandbox = createSandbox("draft-symlink-mkdir-escape")
    cleanupPaths.push(sandbox)
    const outside = createSandbox("draft-symlink-mkdir-outside")
    cleanupPaths.push(outside)
    try {
      mkdirSync(join(sandbox, ".sisyphus/drafts"), { recursive: true })
      symlinkSync(outside, join(sandbox, ".sisyphus/drafts/link"), "dir")

      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/drafts/link/nested/escape.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected symlink mkdir rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("resolved durable artifact path escaped the current project root")
      }

      expect(existsSync(join(outside, "nested"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
      rmSync(outside, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(outside), 1)
    }
  })

  it("rejects draft writes through a symlinked final file", () => {
    const sandbox = createSandbox("draft-leaf-symlink-escape")
    cleanupPaths.push(sandbox)
    const outside = createSandbox("draft-leaf-symlink-outside")
    cleanupPaths.push(outside)
    try {
      mkdirSync(join(sandbox, ".sisyphus/drafts"), { recursive: true })
      symlinkSync(join(outside, "escape.md"), join(sandbox, ".sisyphus/drafts/escape.md"))

      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/drafts/escape.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected leaf symlink rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("resolved durable artifact path escaped the current project root")
      }

      expect(existsSync(join(outside, "escape.md"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
      rmSync(outside, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(outside), 1)
    }
  })

  it("rejects draft writes through a symlinked lane segment into a sibling path", () => {
    const sandbox = createSandbox("draft-sibling-escape")
    cleanupPaths.push(sandbox)
    const siblingOutside = `${sandbox}-outside`
    mkdirSync(siblingOutside, { recursive: true })
    cleanupPaths.push(siblingOutside)
    try {
      mkdirSync(join(sandbox, ".sisyphus/drafts"), { recursive: true })
      symlinkSync(siblingOutside, join(sandbox, ".sisyphus/drafts/link"), "dir")

      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "draft",
          relativePath: ".sisyphus/drafts/link/escape.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected sibling escape rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("resolved durable artifact path escaped the current project root")
      }

      expect(existsSync(join(siblingOutside, "escape.md"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
      rmSync(siblingOutside, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(siblingOutside), 1)
    }
  })

  it("rejects docs-output writes for legal-counsel", () => {
    const sandbox = createSandbox("legal-docs")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "legal-counsel",
          kind: "docs-output",
          relativePath: "docs/legal-notes.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected docs-output rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("legal-counsel may not write outside its bounded durable-artifact lanes")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("allows product-wunderkind docs-output writes under a configured non-default docs path", () => {
    const sandbox = createSandbox("product-docs-output")
    cleanupPaths.push(sandbox)
    try {
      const result = writeDurableArtifact({
        agentKey: "product-wunderkind",
        kind: "docs-output",
        relativePath: "project-docs/product-decisions.md",
        content: "# Product decisions\n",
      }, sandbox, { docsPath: "./project-docs" })

      expect(result.relativePath).toBe("project-docs/product-decisions.md")
      expect(readFileSync(join(sandbox, "project-docs/product-decisions.md"), "utf-8")).toBe("# Product decisions\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects docs-output writes outside the configured docs path", () => {
    const sandbox = createSandbox("product-docs-output-wrong-path")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "docs-output",
          relativePath: ".sisyphus/notepads/product-decisions.md",
          content: "bad",
        }, sandbox, { docsPath: "./project-docs" })
        throw new Error("Expected docs-output wrong-path rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("docs-output artifacts must stay under project-docs/")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects docs-output writes when the configured docs path is a symlinked lane", () => {
    const sandbox = createSandbox("product-docs-output-symlinked-lane")
    cleanupPaths.push(sandbox)
    try {
      mkdirSync(join(sandbox, ".sisyphus/notepads"), { recursive: true })
      symlinkSync(join(sandbox, ".sisyphus/notepads"), join(sandbox, "project-docs"), "dir")

      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "docs-output",
          relativePath: "project-docs/product-decisions.md",
          content: "bad",
        }, sandbox, { docsPath: "./project-docs" })
        throw new Error("Expected symlinked docs lane rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("docs-output lane must not include symlinked segments")
      }

      expect(existsSync(join(sandbox, ".sisyphus/notepads/product-decisions.md"))).toBe(false)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("allows docs-output writes when the configured docs directory name ends with .md", () => {
    const sandbox = createSandbox("product-docs-output-md-dir")
    cleanupPaths.push(sandbox)
    try {
      const result = writeDurableArtifact({
        agentKey: "product-wunderkind",
        kind: "docs-output",
        relativePath: "docs.md/product-decisions.md",
        content: "# Product decisions\n",
      }, sandbox, { docsPath: "./docs.md" })

      expect(result.relativePath).toBe("docs.md/product-decisions.md")
      expect(readFileSync(join(sandbox, "docs.md/product-decisions.md"), "utf-8")).toBe("# Product decisions\n")
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects docs-output writes when the configured docs path is ./DESIGN.md", () => {
    const sandbox = createSandbox("product-docs-output-design-md-dir")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "docs-output",
          relativePath: "DESIGN.md/product-decisions.md",
          content: "# Product decisions\n",
        }, sandbox, { docsPath: "./DESIGN.md" })
        throw new Error("Expected reserved DESIGN.md docsPath rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain(
          "docs-output artifacts may not use DESIGN.md as docsPath because that path is reserved for design-md",
        )
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects docs-output writes when the configured docs path is nested under ./DESIGN.md", () => {
    const sandbox = createSandbox("product-docs-output-design-md-subdir")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "docs-output",
          relativePath: "DESIGN.md/subdir/product-decisions.md",
          content: "# Product decisions\n",
        }, sandbox, { docsPath: "./DESIGN.md/subdir" })
        throw new Error("Expected nested reserved DESIGN.md docsPath rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain(
          "docs-output artifacts may not use DESIGN.md as docsPath because that path is reserved for design-md",
        )
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects design artifacts for product-wunderkind", () => {
    const sandbox = createSandbox("product-design")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "product-wunderkind",
          kind: "design-md",
          relativePath: "DESIGN.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected design rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("product-wunderkind may not write outside its bounded durable-artifact lanes")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })

  it("rejects attempts to treat DESIGN.md as a directory prefix", () => {
    const sandbox = createSandbox("design-prefix")
    cleanupPaths.push(sandbox)
    try {
      try {
        writeDurableArtifact({
          agentKey: "creative-director",
          kind: "design-md",
          relativePath: "DESIGN.md/extra.md",
          content: "bad",
        }, sandbox)
        throw new Error("Expected DESIGN.md prefix rejection")
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain("creative-director may not write outside its bounded durable-artifact lanes")
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
      cleanupPaths.splice(cleanupPaths.indexOf(sandbox), 1)
    }
  })
})
