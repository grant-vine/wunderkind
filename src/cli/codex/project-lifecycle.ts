import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, readdirSync, rmdirSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import {
  getDefaultInstallConfig,
  readWunderkindConfig,
  validateProjectWunderkindConfigWriteTarget,
  writeWunderkindConfig,
} from "../config-manager/index.js"
import type { CodexGlobalInstallReadiness } from "./install.js"
import {
  ensureCodexRuntimeDirectory,
  resolveCodexRuntimeDirectory,
  resolveCodexRuntimeFile,
} from "./runtime-ownership.js"
import {
  resolveCodexProjectMarker,
  writeCodexProjectMarker,
} from "./project-marker.js"
import type { CodexProjectMarker } from "./project-marker.js"
import { writeFileAtomically } from "./state.js"
import { bootstrapCodexSharedProjectArtifacts, validateCodexSharedProjectArtifacts } from "./shared-project-bootstrap.js"
import { validateDocHistoryMode, validateProjectLocalDocsPath } from "../docs-output-helper.js"
import type { DocHistoryMode, InstallConfig, PrdPipelineMode } from "../types.js"

export type { CodexGlobalInstallReadiness } from "./install.js"

export interface CodexProjectInitOptions {
  readonly cwd?: string
  readonly globalInstall: CodexGlobalInstallReadiness
  readonly packageVersion: string
  readonly docsEnabled?: boolean
  readonly docsPath?: string
  readonly docHistoryMode?: DocHistoryMode
  readonly prdPipelineMode?: PrdPipelineMode
}

export interface CodexProjectCleanupOptions {
  readonly cwd?: string
}

const MARKER_FILENAME = "codex-project.json"
const RUNTIME_FILENAME = "workflow-guidance.md"

const CODEX_WORKFLOW_GUIDANCE = `# Wunderkind Codex workflow

- Start with $wunderkind for retained-specialist routing.
- Lean response mode is the default: concise answers first, detailed expansion only when asked or risk requires it.
- Use $docs-index for Wunderkind-managed documentation lanes.
- Use OMO $init-deep to establish durable repository context, $ulw-plan to agree an implementation plan, and $start-work to execute it.
- Optional companion routes can add focused GitHub, Figma, Vercel, Sentry, Codex Security, analytics, Matt Pocock, or Supabase support when they are already installed.
`

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

function buildConfig(options: CodexProjectInitOptions): InstallConfig {
  const persisted = readWunderkindConfig()
  const defaults = getDefaultInstallConfig()
  return {
    ...defaults,
    ...persisted,
    ...(options.docsEnabled !== undefined ? { docsEnabled: options.docsEnabled } : {}),
    ...(options.docsPath !== undefined ? { docsPath: options.docsPath } : {}),
    ...(options.docHistoryMode !== undefined ? { docHistoryMode: options.docHistoryMode } : {}),
    ...(options.prdPipelineMode !== undefined ? { prdPipelineMode: options.prdPipelineMode } : {}),
  }
}

function isGuidanceOwned(marker: CodexProjectMarker | null, guidancePath: string): boolean {
  const recordedGuidance = marker?.runtimeFiles.find((file) => file.path === RUNTIME_FILENAME)
  if (recordedGuidance === undefined || !existsSync(guidancePath)) return false
  if (!lstatSync(guidancePath).isFile()) return false
  return sha256(readFileSync(guidancePath, "utf8")) === recordedGuidance.sha256
}

function restoreGuidanceAfterMarkerFailure(
  runtimeDirectory: string,
  guidancePath: string,
  previousGuidance: string | undefined,
): void {
  if (previousGuidance !== undefined) {
    writeFileAtomically(runtimeDirectory, guidancePath, previousGuidance)
    return
  }
  if (existsSync(guidancePath) && lstatSync(guidancePath).isFile() && readFileSync(guidancePath, "utf8") === CODEX_WORKFLOW_GUIDANCE) {
    unlinkSync(guidancePath)
  }
}

export async function runCodexProjectInit(options: CodexProjectInitOptions): Promise<number> {
  try {
    if (!options.globalInstall.healthy) {
      console.error(`Error: Codex Wunderkind global install is not healthy. ${options.globalInstall.guidance}`)
      return 1
    }

    const cwd = options.cwd ?? process.cwd()
    if (existsSync(join(cwd, "wunderkind.config.jsonc"))) {
      console.error("Error: legacy root wunderkind.config.jsonc is unsupported; move it to .wunderkind/wunderkind.config.jsonc.")
      return 1
    }

    const configTargetError = validateProjectWunderkindConfigWriteTarget()
    if (configTargetError) {
      console.error(`Error: Failed to write project config: ${configTargetError.error ?? "unsafe project config target"}`)
      return 1
    }

    const config = buildConfig(options)
    if (!validateDocHistoryMode(config.docHistoryMode)) {
      console.error("Error: invalid docHistoryMode")
      return 1
    }
    if (config.docsEnabled) {
      const docsPathValidation = validateProjectLocalDocsPath(config.docsPath, cwd)
      if (!docsPathValidation.valid) {
        console.error(`Error: ${docsPathValidation.error ?? "Invalid docsPath"}`)
        return 1
      }
    }

    const sharedArtifactsError = validateCodexSharedProjectArtifacts(cwd, config.docsEnabled, config.docsPath)
    if (sharedArtifactsError !== null) {
      console.error(`Error: ${sharedArtifactsError}`)
      return 1
    }

    const wunderkindDirectory = join(cwd, ".wunderkind")
    const markerPath = join(wunderkindDirectory, MARKER_FILENAME)
    const markerResolution = resolveCodexProjectMarker(markerPath)
    if (markerResolution.kind === "unsafe") {
      console.error(`Error: existing Codex project marker is unsafe: ${markerPath}`)
      return 1
    }
    if (markerResolution.kind === "invalid") {
      console.error(`Error: existing Codex project marker is invalid: ${markerPath}`)
      return 1
    }
    const runtimeResolution = ensureCodexRuntimeDirectory(wunderkindDirectory)
    if (runtimeResolution.kind !== "ready") {
      console.error(`Error: Codex runtime directory is unsafe: ${join(wunderkindDirectory, "runtime", "codex")}`)
      return 1
    }
    const runtimeDirectory = runtimeResolution.runtimeDirectory
    const guidanceResolution = resolveCodexRuntimeFile(runtimeDirectory, RUNTIME_FILENAME)
    if (guidanceResolution.kind === "unsafe") {
      console.error(`Error: existing Codex runtime guidance is unsafe: ${join(runtimeDirectory, RUNTIME_FILENAME)}`)
      return 1
    }
    const guidancePath = guidanceResolution.kind === "ready" ? guidanceResolution.filePath : join(runtimeDirectory, RUNTIME_FILENAME)
    const existingMarker = markerResolution.kind === "ready" ? markerResolution.marker : null
    if (existsSync(guidancePath) && readFileSync(guidancePath, "utf8") !== CODEX_WORKFLOW_GUIDANCE && !isGuidanceOwned(existingMarker, guidancePath)) {
      console.error(`Error: existing Codex runtime guidance is not owned by Wunderkind: ${guidancePath}`)
      return 1
    }

    const writeResult = writeWunderkindConfig(config, "project")
    if (!writeResult.success) {
      console.error(`Error: Failed to write project config: ${writeResult.error ?? "unknown error"}`)
      return 1
    }

    bootstrapCodexSharedProjectArtifacts(cwd, config.docsEnabled, config.docsPath)

    const writableRuntimeResolution = ensureCodexRuntimeDirectory(wunderkindDirectory)
    if (writableRuntimeResolution.kind !== "ready") {
      console.error(`Error: Codex runtime directory became unsafe: ${join(wunderkindDirectory, "runtime", "codex")}`)
      return 1
    }
    if (writableRuntimeResolution.runtimeDirectory !== runtimeDirectory) {
      console.error(`Error: Codex runtime directory changed during init: ${join(wunderkindDirectory, "runtime", "codex")}`)
      return 1
    }
    const previousGuidance = existsSync(guidancePath) ? readFileSync(guidancePath, "utf8") : undefined
    writeFileAtomically(runtimeDirectory, guidancePath, CODEX_WORKFLOW_GUIDANCE)
    try {
      writeCodexProjectMarker(markerPath, {
        schemaVersion: 1,
        packageVersion: options.packageVersion,
        runtimeFiles: [{ path: RUNTIME_FILENAME, sha256: sha256(CODEX_WORKFLOW_GUIDANCE) }],
      })
    } catch (error) {
      restoreGuidanceAfterMarkerFailure(runtimeDirectory, guidancePath, previousGuidance)
      throw error
    }

    console.log(`Bootstrapped Codex project attachment in ${cwd}`)
    console.log(`Project config: ${writeResult.configPath}`)
    console.log("Codex guidance: use $wunderkind, $docs-index, $init-deep, $ulw-plan, and $start-work in a new task.")
    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}

export function runCodexProjectCleanup(options: CodexProjectCleanupOptions = {}): number {
  try {
    const cwd = options.cwd ?? process.cwd()
    const wunderkindDirectory = join(cwd, ".wunderkind")
    const markerPath = join(wunderkindDirectory, MARKER_FILENAME)
    const markerResolution = resolveCodexProjectMarker(markerPath)

    if (markerResolution.kind === "missing") {
      console.log("Codex project attachment already absent.")
      return 0
    }
    if (markerResolution.kind === "unsafe") {
      console.error(`Error: Codex project marker is unsafe; preserving it for recovery: ${markerPath}`)
      return 1
    }
    if (markerResolution.kind === "invalid") {
      console.error(`Error: Codex project marker is invalid; preserving it for recovery: ${markerPath}`)
      return 1
    }
    const marker = markerResolution.marker

    const runtimeResolution = resolveCodexRuntimeDirectory(wunderkindDirectory)
    if (runtimeResolution.kind === "unsafe") {
      console.error(`Error: Codex runtime directory is unsafe; preserving marker: ${join(wunderkindDirectory, "runtime", "codex")}`)
      return 1
    }
    if (runtimeResolution.kind === "missing") {
      unlinkSync(markerPath)
      console.log(`Removed Codex project attachment marker: ${markerPath}`)
      return 0
    }

    const runtimeDirectory = runtimeResolution.runtimeDirectory
    const resolvedFiles = marker.runtimeFiles.map((ownedFile) => ({
      ownedFile,
      resolution: resolveCodexRuntimeFile(runtimeDirectory, ownedFile.path),
    }))
    if (resolvedFiles.some(({ resolution }) => resolution.kind === "unsafe")) {
      console.error("Error: Codex runtime marker has an unsafe path; preserving marker.")
      return 1
    }

    let conflicts = false
    for (const { ownedFile, resolution } of resolvedFiles) {
      if (resolution.kind !== "ready") continue
      const filePath = resolution.filePath
      if (!lstatSync(filePath).isFile() || sha256(readFileSync(filePath, "utf8")) !== ownedFile.sha256) {
        console.error(`Preserved modified Codex runtime file: ${filePath}`)
        conflicts = true
        continue
      }
      unlinkSync(filePath)
      console.log(`Removed Codex runtime file: ${filePath}`)
    }

    if (conflicts) return 1

    unlinkSync(markerPath)
    if (existsSync(runtimeDirectory) && readdirSync(runtimeDirectory).length === 0) rmdirSync(runtimeDirectory)
    console.log(`Removed Codex project attachment marker: ${markerPath}`)
    return 0
  } catch (error) {
    console.error(`Error: ${String(error)}`)
    return 1
  }
}
