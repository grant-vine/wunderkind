import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { validateCodexCapabilityManifest, type CodexCapabilityManifest } from "./capability-manifest.js"
import { renderCodexAgentToml } from "./render-agent-toml.js"

const BUILT_IN_AGENT_NAMES = new Set(["default", "worker", "explorer"])
const SUPPORTED_PLUGIN_MANIFEST_FIELDS = new Set([
  "name", "version", "description", "author", "license", "repository", "skills", "interface",
])

interface CodexPluginManifest {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly author: { readonly name: string; readonly url: string }
  readonly license: string
  readonly repository: string
  readonly skills: string
  readonly interface: {
    readonly displayName: string
    readonly shortDescription: string
    readonly longDescription: string
    readonly developerName: string
    readonly category: string
    readonly capabilities: readonly string[]
    readonly websiteURL: string
    readonly defaultPrompt: readonly string[]
  }
}

interface PayloadManifestEntry {
  readonly path: string
  readonly sha256: string
}

interface PayloadManifest {
  readonly version: 1
  readonly files: readonly PayloadManifestEntry[]
}

export interface CodexPayloadBuildOptions {
  readonly manifest: CodexCapabilityManifest
  readonly sourceRoot: string
  readonly outputRoot: string
  readonly packageVersion: string
  readonly pluginManifestOverrides?: Readonly<Record<string, unknown>>
}

export interface CodexPayloadBuildResult {
  readonly manifestPath: string
  readonly files: readonly PayloadManifestEntry[]
}

export class CodexPayloadBuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexPayloadBuildError"
  }
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function isSafeRelativePath(path: string): boolean {
  return path !== "" && !isAbsolute(path) && !path.split(/[\\/]/).includes("..")
}

function sourceFile(sourceRoot: string, relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) {
    throw new CodexPayloadBuildError(`Codex source path escapes the source root: ${relativePath}`)
  }

  let root: string
  let candidate: string
  try {
    root = realpathSync(resolve(sourceRoot))
    candidate = realpathSync(resolve(root, relativePath))
  } catch (error) {
    if (error instanceof Error) {
      throw new CodexPayloadBuildError(`Missing Codex source file: ${relativePath}`)
    }
    throw new CodexPayloadBuildError(`Missing Codex source file: ${relativePath}`)
  }
  const pathFromRoot = relative(root, candidate)
  if (pathFromRoot === "" || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new CodexPayloadBuildError(`Codex source path escapes the source root: ${relativePath}`)
  }
  if (!statSync(candidate).isFile()) {
    throw new CodexPayloadBuildError(`Codex source path is not a regular file: ${relativePath}`)
  }
  return candidate
}

function readSource(sourceRoot: string, relativePath: string): string {
  try {
    return readFileSync(sourceFile(sourceRoot, relativePath), "utf8").replace(/\r\n/g, "\n")
  } catch (error) {
    if (error instanceof CodexPayloadBuildError) throw error
    throw new CodexPayloadBuildError(`Unable to read Codex source file: ${relativePath}`)
  }
}

function parseAgentSource(agentId: string, source: string): { readonly name: string; readonly description: string; readonly developerInstructions: string } {
  const match = /^---\nname:\s*([^\n]+)\ndescription:\s*([^\n]+)\n---\n+([\s\S]+)$/u.exec(source)
  if (!match) throw new CodexPayloadBuildError(`Invalid frontmatter for Codex agent: ${agentId}`)

  const [, rawName, rawDescription, developerInstructions] = match
  if (rawName === undefined || rawDescription === undefined || developerInstructions === undefined) {
    throw new CodexPayloadBuildError(`Invalid frontmatter for Codex agent: ${agentId}`)
  }
  const name = rawName.trim()
  if (name !== agentId || BUILT_IN_AGENT_NAMES.has(name)) {
    throw new CodexPayloadBuildError(`Invalid or reserved Codex agent name: ${name}`)
  }

  return { name, description: rawDescription.trim(), developerInstructions: developerInstructions.trim() }
}

function pluginManifest(version: string, overrides: Readonly<Record<string, unknown>> | undefined): CodexPluginManifest {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new CodexPayloadBuildError(`Package version is not valid semver: ${version}`)
  }
  if (overrides !== undefined && Object.keys(overrides).some((field) => !SUPPORTED_PLUGIN_MANIFEST_FIELDS.has(field))) {
    throw new CodexPayloadBuildError("Plugin manifest contains an unsupported field")
  }

  return {
    name: "wunderkind",
    version,
    description: "Retained specialist skills and custom agents for software product teams.",
    author: { name: "Grant Vine", url: "https://github.com/grant-vine" },
    license: "MIT",
    repository: "https://github.com/grant-vine/wunderkind",
    skills: "./skills/",
    interface: {
      displayName: "Wunderkind",
      shortDescription: "Retained specialists for product teams.",
      longDescription: "Skills and custom agents for product, marketing, creative, architecture, security, and legal judgment.",
      developerName: "Grant Vine",
      category: "Productivity",
      capabilities: ["Skills", "Custom Agents"],
      websiteURL: "https://github.com/grant-vine/wunderkind",
      defaultPrompt: ["Route this product-team decision to the right Wunderkind specialist."],
    },
  }
}

function marketplace(version: string): string {
  return json({
    name: "grant-vine",
    interface: { displayName: "Wunderkind" },
    plugins: [{
      name: "wunderkind",
      source: { source: "local", path: `./plugins/wunderkind/${version}` },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Productivity",
    }],
  })
}

function writeGeneratedFile(root: string, relativePath: string, content: string, entries: PayloadManifestEntry[]): void {
  const absolutePath = join(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content, "utf8")
  entries.push({ path: relativePath.replaceAll("\\", "/"), sha256: sha256(content) })
}

function writeMutableMarketplaceDescriptor(root: string, content: string): void {
  const descriptor = join(root, "marketplace", ".agents", "plugins", "marketplace.json")
  mkdirSync(dirname(descriptor), { recursive: true })
  writeFileSync(descriptor, content, "utf8")
}

export function buildCodexPayload(options: CodexPayloadBuildOptions): CodexPayloadBuildResult {
  try {
    validateCodexCapabilityManifest(options.manifest)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Codex capability manifest"
    throw new CodexPayloadBuildError(message)
  }

  const plugin = pluginManifest(options.packageVersion, options.pluginManifestOverrides)
  const agentSources = options.manifest.agents.map((agent) => ({
    id: agent.id,
    parsed: parseAgentSource(agent.id, readSource(options.sourceRoot, agent.sourcePath)),
  }))
  const skillSources = options.manifest.skills.map((skill) => ({
    id: skill.id,
    content: readSource(options.sourceRoot, skill.sourcePath),
  }))
  const outputRoot = resolve(options.outputRoot)
  const stagingRoot = `${outputRoot}.staging`
  const entries: PayloadManifestEntry[] = []

  rmSync(stagingRoot, { recursive: true, force: true })
  try {
    for (const agent of agentSources) {
      writeGeneratedFile(stagingRoot, `agents/${agent.id}.toml`, renderCodexAgentToml(agent.parsed), entries)
    }
    writeMutableMarketplaceDescriptor(stagingRoot, marketplace(options.packageVersion))
    const pluginRoot = `marketplace/plugins/wunderkind/${options.packageVersion}`
    writeGeneratedFile(stagingRoot, `${pluginRoot}/.codex-plugin/plugin.json`, json(plugin), entries)
    for (const skill of skillSources) {
      writeGeneratedFile(stagingRoot, `${pluginRoot}/skills/${skill.id}/SKILL.md`, skill.content, entries)
    }

    const sortedEntries = [...entries].sort((left, right) => left.path.localeCompare(right.path))
    const payloadManifest: PayloadManifest = { version: 1, files: sortedEntries }
    writeFileSync(join(stagingRoot, `${pluginRoot}/payload-manifest.json`), json(payloadManifest), "utf8")

    rmSync(outputRoot, { recursive: true, force: true })
    mkdirSync(dirname(outputRoot), { recursive: true })
    renameSync(stagingRoot, outputRoot)
    return { manifestPath: join(outputRoot, pluginRoot, "payload-manifest.json"), files: sortedEntries }
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true })
    if (error instanceof CodexPayloadBuildError) throw error
    const message = error instanceof Error ? error.message : "Unable to build Codex payload"
    throw new CodexPayloadBuildError(message)
  }
}
