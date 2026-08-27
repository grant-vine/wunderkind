import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildCodexPayload } from "./codex/build-payload.js"
import { CODEX_CAPABILITY_MANIFEST } from "./codex/capability-manifest.js"

interface PackageMetadata {
  readonly version: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function packageMetadataFromJson(value: unknown): PackageMetadata {
  if (!isRecord(value)) {
    throw new Error("package.json must be an object")
  }
  const version = value["version"]
  if (typeof version !== "string") throw new Error("package.json must contain a version")
  return { version }
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const packageMetadata = packageMetadataFromJson(JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")))
const result = buildCodexPayload({
  manifest: CODEX_CAPABILITY_MANIFEST,
  sourceRoot: projectRoot,
  outputRoot: join(projectRoot, "codex"),
  packageVersion: packageMetadata.version,
})

console.log(`Generated ${result.files.length} Codex payload files at ${result.manifestPath}`)
