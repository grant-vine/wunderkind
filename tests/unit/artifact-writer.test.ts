import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
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
})
