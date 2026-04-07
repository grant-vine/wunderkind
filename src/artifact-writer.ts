import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, normalize, relative } from "node:path"

export const DURABLE_ARTIFACT_TOOL_NAME = "wunderkind_write_artifact" as const

export interface DurableArtifactWriteRequest {
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

function isAppendOnlyPath(normalizedRelativePath: string): boolean {
  return normalizedRelativePath.startsWith(".sisyphus/notepads/") || normalizedRelativePath.startsWith(".sisyphus/evidence/")
}

function isAllowedArtifactPath(normalizedRelativePath: string): boolean {
  return isAppendOnlyPath(normalizedRelativePath)
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

function validateProtectedArtifactPath(normalizedRelativePath: string): void {
  if (normalizedRelativePath.startsWith(".sisyphus/notepads/")) {
    return
  }

  if (normalizedRelativePath.startsWith(".sisyphus/evidence/")) {
    return
  }

  throw new Error("durable artifacts must stay inside append-only Wunderkind memory lanes")
}

export function writeDurableArtifact(
  request: DurableArtifactWriteRequest,
  cwd: string,
  _options?: DurableArtifactWriteOptions,
): DurableArtifactWriteResult {
  const normalizedRelativePath = ensureSafeRelativePath(request.relativePath)

  if (!isAllowedArtifactPath(normalizedRelativePath)) {
    throw new Error("durable artifacts must stay inside append-only Wunderkind memory lanes")
  }

  validateProtectedArtifactPath(normalizedRelativePath)

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
  const nextContent = existsSync(finalAbsolutePath)
    ? `${readFileSync(finalAbsolutePath, "utf-8")}${request.content}`
    : request.content
  writeFileSync(finalAbsolutePath, nextContent, "utf-8")

  return {
    absolutePath: finalAbsolutePath,
    relativePath: normalizedRelativePath,
    created,
  }
}

export function readDurableArtifact(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
}
