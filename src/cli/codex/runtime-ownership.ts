import { lstatSync, mkdirSync, realpathSync } from "node:fs"
import { isAbsolute, join, relative, resolve, sep } from "node:path"

export type CodexRuntimeDirectoryResolution =
  | { readonly kind: "ready"; readonly runtimeDirectory: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unsafe" }

export type CodexRuntimeFileResolution =
  | { readonly kind: "ready"; readonly filePath: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unsafe" }

function isPhysicalChild(parent: string, child: string): boolean {
  const pathFromParent = relative(realpathSync(parent), realpathSync(child))
  return pathFromParent !== "" && pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent)
}

function isDirectoryWithoutSymlink(path: string): boolean {
  const stat = lstatOrMissing(path)
  return stat !== undefined && stat.isDirectory() && !stat.isSymbolicLink()
}

function lstatOrMissing(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
}

function safeRuntimePath(path: string): boolean {
  return !isAbsolute(path) && path !== "" && path.split(/[\\/]/u).every((segment) => segment !== "" && segment !== "." && segment !== "..")
}

function runtimePathParts(wunderkindDirectory: string): readonly string[] {
  return [wunderkindDirectory, join(wunderkindDirectory, "runtime"), join(wunderkindDirectory, "runtime", "codex")]
}

export function ensureCodexRuntimeDirectory(wunderkindDirectory: string): CodexRuntimeDirectoryResolution {
  const paths = runtimePathParts(wunderkindDirectory)
  for (const path of paths) {
    if (lstatOrMissing(path) !== undefined) {
      if (!isDirectoryWithoutSymlink(path)) return { kind: "unsafe" }
      continue
    }
    mkdirSync(path)
    if (!isDirectoryWithoutSymlink(path)) return { kind: "unsafe" }
  }

  const runtimeDirectory = paths[2]
  if (runtimeDirectory === undefined || !isPhysicalChild(wunderkindDirectory, runtimeDirectory)) return { kind: "unsafe" }
  return { kind: "ready", runtimeDirectory: realpathSync(runtimeDirectory) }
}

export function resolveCodexRuntimeDirectory(wunderkindDirectory: string): CodexRuntimeDirectoryResolution {
  const paths = runtimePathParts(wunderkindDirectory)
  for (const path of paths) {
    if (lstatOrMissing(path) === undefined) return { kind: "missing" }
    if (!isDirectoryWithoutSymlink(path)) return { kind: "unsafe" }
  }

  const runtimeDirectory = paths[2]
  if (runtimeDirectory === undefined || !isPhysicalChild(wunderkindDirectory, runtimeDirectory)) return { kind: "unsafe" }
  return { kind: "ready", runtimeDirectory: realpathSync(runtimeDirectory) }
}

export function resolveCodexRuntimeFile(
  runtimeDirectory: string,
  runtimePath: string,
): CodexRuntimeFileResolution {
  if (!safeRuntimePath(runtimePath)) return { kind: "unsafe" }

  const segments = runtimePath.split(/[\\/]/u)
  let currentPath = runtimeDirectory
  for (const [index, segment] of segments.entries()) {
    currentPath = join(currentPath, segment)
    const stat = lstatOrMissing(currentPath)
    if (stat === undefined) return { kind: "missing" }
    const isLeaf = index === segments.length - 1
    if (stat.isSymbolicLink() || (isLeaf ? !stat.isFile() : !stat.isDirectory())) return { kind: "unsafe" }
  }

  if (!isPhysicalChild(runtimeDirectory, currentPath)) return { kind: "unsafe" }
  return { kind: "ready", filePath: resolve(currentPath) }
}
