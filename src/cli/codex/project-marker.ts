import { lstatSync, readFileSync } from "node:fs"
import { dirname, isAbsolute } from "node:path"
import { writeFileAtomically } from "./state.js"

export interface CodexRuntimeFile {
  readonly path: string
  readonly sha256: string
}

export interface CodexProjectMarker {
  readonly schemaVersion: 1
  readonly packageVersion: string
  readonly runtimeFiles: readonly CodexRuntimeFile[]
}

export type CodexProjectMarkerResolution =
  | { readonly kind: "missing" }
  | { readonly kind: "unsafe" }
  | { readonly kind: "invalid" }
  | { readonly kind: "ready"; readonly marker: CodexProjectMarker }

export type CodexProjectMarkerWriter = (markerPath: string, marker: CodexProjectMarker) => void

let projectMarkerWriterForTests: CodexProjectMarkerWriter | undefined

function isSafeRuntimePath(path: string): boolean {
  return path !== "" && !isAbsolute(path) && !path.split(/[\\/]/u).includes("..")
}

function isStablePackageVersion(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseCodexProjectMarker(value: unknown): CodexProjectMarker | null {
  if (!isRecord(value) || value["schemaVersion"] !== 1 || typeof value["packageVersion"] !== "string" || !isStablePackageVersion(value["packageVersion"]) || !Array.isArray(value["runtimeFiles"])) {
    return null
  }

  const runtimeFiles: CodexRuntimeFile[] = []
  const paths = new Set<string>()
  for (const entry of value["runtimeFiles"]) {
    if (!isRecord(entry) || typeof entry["path"] !== "string" || typeof entry["sha256"] !== "string" || !isSha256(entry["sha256"]) || !isSafeRuntimePath(entry["path"]) || paths.has(entry["path"])) {
      return null
    }
    paths.add(entry["path"])
    runtimeFiles.push({ path: entry["path"], sha256: entry["sha256"] })
  }

  return { schemaVersion: 1, packageVersion: value["packageVersion"], runtimeFiles }
}

function lstatOrMissing(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
}

export function resolveCodexProjectMarker(markerPath: string): CodexProjectMarkerResolution {
  const markerEntry = lstatOrMissing(markerPath)
  if (markerEntry === undefined) return { kind: "missing" }
  if (markerEntry.isSymbolicLink() || !markerEntry.isFile()) return { kind: "unsafe" }

  try {
    const marker = parseCodexProjectMarker(JSON.parse(readFileSync(markerPath, "utf8")))
    return marker === null ? { kind: "invalid" } : { kind: "ready", marker }
  } catch (error) {
    if (error instanceof SyntaxError) return { kind: "invalid" }
    if (error instanceof Error && "code" in error) return { kind: "invalid" }
    throw error
  }
}

export function writeCodexProjectMarker(markerPath: string, marker: CodexProjectMarker): void {
  if (projectMarkerWriterForTests !== undefined) {
    projectMarkerWriterForTests(markerPath, marker)
    return
  }
  writeFileAtomically(dirname(markerPath), markerPath, `${JSON.stringify(marker, null, 2)}\n`)
}

export function __setCodexProjectMarkerWriterForTests(writer: CodexProjectMarkerWriter): void {
  projectMarkerWriterForTests = writer
}

export function __resetCodexProjectMarkerWriterForTests(): void {
  projectMarkerWriterForTests = undefined
}
