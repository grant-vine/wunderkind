import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, normalize, relative } from "node:path"

export const DURABLE_ARTIFACT_TOOL_NAME = "wunderkind_write_artifact" as const

export type DurableArtifactAgentKey =
  | "marketing-wunderkind"
  | "creative-director"
  | "product-wunderkind"
  | "fullstack-wunderkind"
  | "ciso"
  | "legal-counsel"

export type DurableArtifactKind = "prd" | "plan" | "issue" | "docs-output" | "design-md" | "notepad"

export interface DurableArtifactWriteRequest {
  agentKey: DurableArtifactAgentKey
  kind: DurableArtifactKind
  relativePath: string
  content: string
}

export interface DurableArtifactWriteResult {
  absolutePath: string
  relativePath: string
  created: boolean
}

function normalizeRelativePath(input: string): string {
  const trimmed = input.trim()
  const normalized = normalize(trimmed).replaceAll("\\", "/")
  return normalized.startsWith("./") ? normalized.slice(2) : normalized
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const rel = relative(parentPath, candidatePath)
  return rel === "" || (!rel.startsWith("../") && rel !== ".." && !rel.includes("/../"))
}

function ensureSafeRelativePath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath)

  if (normalized === "" || normalized === ".") {
    throw new Error("relativePath must not be empty")
  }

  if (normalized.startsWith("/") || normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new Error("relativePath must stay within the current project root")
  }

  return normalized
}

function getAllowedArtifactRoots(agentKey: DurableArtifactAgentKey): readonly string[] {
  switch (agentKey) {
    case "product-wunderkind":
      return [".sisyphus/prds", ".sisyphus/plans", ".sisyphus/issues", ".sisyphus/notepads"]
    case "creative-director":
      return ["DESIGN.md", ".wunderkind/stitch", ".sisyphus/notepads"]
    case "marketing-wunderkind":
      return ["docs", ".sisyphus/notepads"]
    case "ciso":
      return ["docs", ".sisyphus/notepads"]
    case "fullstack-wunderkind":
      return ["docs", ".sisyphus/notepads", ".sisyphus/prds", ".sisyphus/plans", ".sisyphus/issues", "DESIGN.md", ".wunderkind/stitch"]
    case "legal-counsel":
      return [".sisyphus/notepads"]
  }
}

function isAllowedArtifactPath(agentKey: DurableArtifactAgentKey, normalizedRelativePath: string): boolean {
  return getAllowedArtifactRoots(agentKey).some((allowedRoot) => {
    if (allowedRoot.endsWith(".md")) {
      return normalizedRelativePath === allowedRoot || normalizedRelativePath.startsWith(`${allowedRoot}/`)
    }

    return normalizedRelativePath === allowedRoot || normalizedRelativePath.startsWith(`${allowedRoot}/`)
  })
}

function validateArtifactKind(agentKey: DurableArtifactAgentKey, kind: DurableArtifactKind, normalizedRelativePath: string): void {
  if (kind === "prd" && (agentKey !== "product-wunderkind" && agentKey !== "fullstack-wunderkind")) {
    throw new Error(`${agentKey} may not write PRD artifacts`)
  }

  if (kind === "plan" && (agentKey !== "product-wunderkind" && agentKey !== "fullstack-wunderkind")) {
    throw new Error(`${agentKey} may not write plan artifacts`)
  }

  if (kind === "issue" && (agentKey !== "product-wunderkind" && agentKey !== "fullstack-wunderkind")) {
    throw new Error(`${agentKey} may not write issue artifacts`)
  }

  if (kind === "design-md" && agentKey !== "creative-director" && agentKey !== "fullstack-wunderkind") {
    throw new Error(`${agentKey} may not write design artifacts`)
  }

  if (kind === "docs-output" && !["marketing-wunderkind", "creative-director", "product-wunderkind", "fullstack-wunderkind", "ciso"].includes(agentKey)) {
    throw new Error(`${agentKey} may not write docs-output artifacts`)
  }

  if (kind === "notepad" && !normalizedRelativePath.startsWith(".sisyphus/notepads/")) {
    throw new Error("notepad artifacts must stay under .sisyphus/notepads/")
  }
}

export function writeDurableArtifact(request: DurableArtifactWriteRequest, cwd: string): DurableArtifactWriteResult {
  const normalizedRelativePath = ensureSafeRelativePath(request.relativePath)

  if (!isAllowedArtifactPath(request.agentKey, normalizedRelativePath)) {
    throw new Error(`${request.agentKey} may not write outside its bounded durable-artifact lanes`)
  }

  validateArtifactKind(request.agentKey, request.kind, normalizedRelativePath)

  const absolutePath = join(cwd, normalizedRelativePath)
  if (!isPathWithin(cwd, absolutePath)) {
    throw new Error("resolved durable artifact path escaped the current project root")
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
    throw new Error("durable artifact path must point to a file, not a directory")
  }

  mkdirSync(dirname(absolutePath), { recursive: true })
  const created = !existsSync(absolutePath)
  writeFileSync(absolutePath, request.content, "utf-8")

  return {
    absolutePath,
    relativePath: normalizedRelativePath,
    created,
  }
}

export function readDurableArtifact(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
}
