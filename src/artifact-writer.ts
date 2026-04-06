import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, normalize, relative } from "node:path"
import { getDocsEligibleAgentKeys } from "./agents/docs-config.js"
import { resolveProjectLocalDocsPath } from "./cli/docs-output-helper.js"

export const DURABLE_ARTIFACT_TOOL_NAME = "wunderkind_write_artifact" as const

export type DurableArtifactAgentKey =
  | "marketing-wunderkind"
  | "creative-director"
  | "product-wunderkind"
  | "fullstack-wunderkind"
  | "ciso"
  | "legal-counsel"

export type DurableArtifactKind = "prd" | "plan" | "issue" | "draft" | "docs-output" | "design-md" | "notepad"

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

export interface DurableArtifactWriteOptions {
  docsPath?: string
}

const DOCS_OUTPUT_ELIGIBLE_AGENT_KEYS = new Set<DurableArtifactAgentKey>(getDocsEligibleAgentKeys() as DurableArtifactAgentKey[])

interface DurableArtifactLane {
  path: string
  exactFile: boolean
}

function normalizeRelativePath(input: string): string {
  const trimmed = input.trim()
  const normalized = normalize(trimmed).replaceAll("\\", "/")
  return normalized.startsWith("./") ? normalized.slice(2) : normalized
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const rel = relative(parentPath, candidatePath)

  if (rel === "") {
    return true
  }

  if (isAbsolute(rel)) {
    return false
  }

  const normalizedSegments = rel.replaceAll("\\", "/").split("/").filter((segment) => segment.length > 0)
  return !normalizedSegments.includes("..")
}

function ensurePathHasNoSymlinkSegments(cwd: string, normalizedRelativePath: string, errorMessage: string): void {
  const segments = normalizedRelativePath.split("/").filter((segment) => segment.length > 0)
  let lexicalCurrentPath = cwd

  for (const segment of segments) {
    lexicalCurrentPath = join(lexicalCurrentPath, segment)

    if (!existsSync(lexicalCurrentPath)) {
      return
    }

    if (lstatSync(lexicalCurrentPath).isSymbolicLink()) {
      throw new Error(errorMessage)
    }
  }
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

function getDocsOutputRoot(cwd: string, options?: DurableArtifactWriteOptions): string {
  return resolveProjectLocalDocsPath(options?.docsPath ?? "./docs", cwd).docsPath.replaceAll("\\", "/")
}

function isReservedDesignMdPath(path: string): boolean {
  return path === "DESIGN.md" || path.startsWith("DESIGN.md/")
}

function directoryLane(path: string): DurableArtifactLane {
  return { path, exactFile: false }
}

function exactFileLane(path: string): DurableArtifactLane {
  return { path, exactFile: true }
}

function getAllowedArtifactRoots(agentKey: DurableArtifactAgentKey, docsOutputRoot: string): readonly DurableArtifactLane[] {
  switch (agentKey) {
    case "product-wunderkind":
      return [
        directoryLane(".sisyphus/prds"),
        directoryLane(".sisyphus/plans"),
        directoryLane(".sisyphus/issues"),
        directoryLane(".sisyphus/drafts"),
        directoryLane(".sisyphus/notepads"),
        directoryLane(docsOutputRoot),
      ]
    case "creative-director":
      return [exactFileLane("DESIGN.md"), directoryLane(".wunderkind/stitch"), directoryLane(".sisyphus/notepads"), directoryLane(docsOutputRoot)]
    case "marketing-wunderkind":
      return [directoryLane(docsOutputRoot), directoryLane(".sisyphus/notepads")]
    case "ciso":
      return [directoryLane(docsOutputRoot), directoryLane(".sisyphus/notepads")]
    case "fullstack-wunderkind":
      return [
        directoryLane(docsOutputRoot),
        directoryLane(".sisyphus/notepads"),
        directoryLane(".sisyphus/prds"),
        directoryLane(".sisyphus/plans"),
        directoryLane(".sisyphus/issues"),
        exactFileLane("DESIGN.md"),
        directoryLane(".wunderkind/stitch"),
      ]
    case "legal-counsel":
      return [directoryLane(".sisyphus/notepads")]
  }
}

function isAllowedArtifactPath(agentKey: DurableArtifactAgentKey, normalizedRelativePath: string, docsOutputRoot: string): boolean {
  return getAllowedArtifactRoots(agentKey, docsOutputRoot).some((allowedLane) => {
    if (allowedLane.exactFile) {
      return normalizedRelativePath === allowedLane.path
    }

    return normalizedRelativePath === allowedLane.path || normalizedRelativePath.startsWith(`${allowedLane.path}/`)
  })
}

function resolveWritableParentPath(rootRealPath: string, cwd: string, normalizedRelativePath: string): string {
  const parentRelativePath = normalizeRelativePath(dirname(normalizedRelativePath))
  if (parentRelativePath === ".") {
    return rootRealPath
  }

  const segments = parentRelativePath.split("/").filter((segment) => segment.length > 0)
  let lexicalCurrentPath = cwd
  let resolvedCurrentPath = rootRealPath

  for (const segment of segments) {
    lexicalCurrentPath = join(lexicalCurrentPath, segment)

    if (existsSync(lexicalCurrentPath)) {
      const lexicalStat = lstatSync(lexicalCurrentPath)
      const nextResolvedPath = realpathSync(lexicalCurrentPath)

      if (!isPathWithin(rootRealPath, nextResolvedPath)) {
        throw new Error("resolved durable artifact path escaped the current project root")
      }

      if (!lexicalStat.isDirectory()) {
        throw new Error("durable artifact path must point to a file, not a directory")
      }

      resolvedCurrentPath = nextResolvedPath
      continue
    }

    const nextResolvedPath = join(resolvedCurrentPath, segment)
    if (!isPathWithin(rootRealPath, nextResolvedPath)) {
      throw new Error("resolved durable artifact path escaped the current project root")
    }

    mkdirSync(nextResolvedPath)
    resolvedCurrentPath = nextResolvedPath
  }

  return resolvedCurrentPath
}

function validateArtifactKind(
  agentKey: DurableArtifactAgentKey,
  kind: DurableArtifactKind,
  normalizedRelativePath: string,
  docsOutputRoot: string,
): void {
  if (kind === "prd" && (agentKey !== "product-wunderkind" && agentKey !== "fullstack-wunderkind")) {
    throw new Error(`${agentKey} may not write PRD artifacts`)
  }

  if (kind === "prd" && !normalizedRelativePath.startsWith(".sisyphus/prds/")) {
    throw new Error("prd artifacts must stay under .sisyphus/prds/")
  }

  if (kind === "plan" && (agentKey !== "product-wunderkind" && agentKey !== "fullstack-wunderkind")) {
    throw new Error(`${agentKey} may not write plan artifacts`)
  }

  if (kind === "plan" && !normalizedRelativePath.startsWith(".sisyphus/plans/")) {
    throw new Error("plan artifacts must stay under .sisyphus/plans/")
  }

  if (kind === "issue" && (agentKey !== "product-wunderkind" && agentKey !== "fullstack-wunderkind")) {
    throw new Error(`${agentKey} may not write issue artifacts`)
  }

  if (kind === "issue" && !normalizedRelativePath.startsWith(".sisyphus/issues/")) {
    throw new Error("issue artifacts must stay under .sisyphus/issues/")
  }

  if (kind === "design-md" && agentKey !== "creative-director" && agentKey !== "fullstack-wunderkind") {
    throw new Error(`${agentKey} may not write design artifacts`)
  }

  if (kind === "design-md" && normalizedRelativePath !== "DESIGN.md") {
    throw new Error("design-md artifacts must write exactly to DESIGN.md")
  }

  if (kind === "draft" && !normalizedRelativePath.startsWith(".sisyphus/drafts/")) {
    throw new Error("draft artifacts must stay under .sisyphus/drafts/")
  }

  if (kind === "docs-output" && !DOCS_OUTPUT_ELIGIBLE_AGENT_KEYS.has(agentKey)) {
    throw new Error(`${agentKey} may not write docs-output artifacts`)
  }

  if (kind === "docs-output" && !normalizedRelativePath.startsWith(`${docsOutputRoot}/`)) {
    throw new Error(`docs-output artifacts must stay under ${docsOutputRoot}/`)
  }

  if (kind === "notepad" && !normalizedRelativePath.startsWith(".sisyphus/notepads/")) {
    throw new Error("notepad artifacts must stay under .sisyphus/notepads/")
  }
}

export function writeDurableArtifact(
  request: DurableArtifactWriteRequest,
  cwd: string,
  options?: DurableArtifactWriteOptions,
): DurableArtifactWriteResult {
  const normalizedRelativePath = ensureSafeRelativePath(request.relativePath)
  const docsOutputRoot = request.kind === "docs-output" ? getDocsOutputRoot(cwd, options) : null

  if (request.kind === "docs-output") {
    if (docsOutputRoot === null) {
      throw new Error("docs-output artifacts require a resolved docsPath")
    }

    if (isReservedDesignMdPath(docsOutputRoot)) {
      throw new Error("docs-output artifacts may not use DESIGN.md as docsPath because that path is reserved for design-md")
    }

    ensurePathHasNoSymlinkSegments(cwd, docsOutputRoot, "docs-output lane must not include symlinked segments")
  }

  if (!isAllowedArtifactPath(request.agentKey, normalizedRelativePath, docsOutputRoot ?? "__docs-output-disabled__")) {
    throw new Error(`${request.agentKey} may not write outside its bounded durable-artifact lanes`)
  }

  validateArtifactKind(request.agentKey, request.kind, normalizedRelativePath, docsOutputRoot ?? "__docs-output-disabled__")

  const rootRealPath = realpathSync(cwd)
  const resolvedAbsolutePath = resolveWritableParentPath(rootRealPath, cwd, normalizedRelativePath)

  if (!isPathWithin(rootRealPath, resolvedAbsolutePath)) {
    throw new Error("resolved durable artifact path escaped the current project root")
  }

  const finalAbsolutePath = join(resolvedAbsolutePath, normalizedRelativePath.split("/").at(-1) ?? "")

  if (!isPathWithin(rootRealPath, finalAbsolutePath)) {
    throw new Error("resolved durable artifact path escaped the current project root")
  }

  try {
    const finalTargetStat = lstatSync(finalAbsolutePath)
    if (finalTargetStat.isSymbolicLink()) {
      throw new Error("resolved durable artifact path escaped the current project root")
    }
    const finalTargetRealPath = realpathSync(finalAbsolutePath)
    if (!isPathWithin(rootRealPath, finalTargetRealPath)) {
      throw new Error("resolved durable artifact path escaped the current project root")
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
      throw error
    }
  }

  if (existsSync(finalAbsolutePath) && statSync(finalAbsolutePath).isDirectory()) {
    throw new Error("durable artifact path must point to a file, not a directory")
  }

  const created = !existsSync(finalAbsolutePath)
  writeFileSync(finalAbsolutePath, request.content, "utf-8")

  return {
    absolutePath: finalAbsolutePath,
    relativePath: normalizedRelativePath,
    created,
  }
}

export function readDurableArtifact(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
}
