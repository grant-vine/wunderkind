import { existsSync, lstatSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export interface CodexPaths {
  readonly codexHome: string
  readonly agentsDir: string
  readonly wunderkindHome: string
  readonly ownershipRoot: string
  readonly marketplaceRoot: string
  readonly marketplaceDescriptor: string
  readonly installState: string
  readonly packagedPayloadRoot: string
}

export interface CodexPathOverride {
  readonly home?: string
  readonly codexHome?: string
  readonly wunderkindHome?: string
  readonly payloadRoot?: string
}

export class CodexPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexPathError"
  }
}

let pathOverride: CodexPathOverride | undefined

function packagePayloadRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../codex")
}

function currentHome(): string {
  return pathOverride?.home ?? homedir()
}

export function resolveCodexPaths(): CodexPaths {
  const home = currentHome()
  const codexHome = resolve(pathOverride?.codexHome ?? process.env["CODEX_HOME"] ?? join(home, ".codex"))
  const wunderkindHome = resolve(pathOverride?.wunderkindHome ?? join(home, ".wunderkind"))
  const ownershipRoot = join(wunderkindHome, "codex")
  const marketplaceRoot = join(ownershipRoot, "marketplace")
  return {
    codexHome,
    agentsDir: join(codexHome, "agents"),
    wunderkindHome,
    ownershipRoot,
    marketplaceRoot,
    marketplaceDescriptor: join(marketplaceRoot, ".agents", "plugins", "marketplace.json"),
    installState: join(ownershipRoot, "install-state.json"),
    packagedPayloadRoot: resolve(pathOverride?.payloadRoot ?? packagePayloadRoot()),
  }
}

function rejectUnsafeExistingPath(path: string): void {
  if (!existsSync(path)) return
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new CodexPathError(`Unsafe Codex ownership root: ${path}`)
  }
}

export function ensureSafeCodexInstallRoots(paths: CodexPaths): void {
  rejectUnsafeExistingPath(paths.wunderkindHome)
  mkdirSync(paths.wunderkindHome, { recursive: true })
  rejectUnsafeExistingPath(paths.ownershipRoot)
  mkdirSync(paths.ownershipRoot, { recursive: true })
  rejectUnsafeExistingPath(paths.marketplaceRoot)
  mkdirSync(paths.marketplaceRoot, { recursive: true })
  rejectUnsafeExistingPath(paths.codexHome)
  mkdirSync(paths.codexHome, { recursive: true })
  rejectUnsafeExistingPath(paths.agentsDir)
  mkdirSync(paths.agentsDir, { recursive: true })
}

export function ensureSafeOwnedFileParent(ownershipRoot: string, path: string): void {
  const root = resolve(ownershipRoot)
  const parent = resolve(dirname(path))
  const suffix = relative(root, parent)
  if (suffix === ".." || suffix.startsWith(`..${sep}`) || suffix.startsWith(sep)) {
    throw new CodexPathError(`Unsafe Codex ownership root: ${path}`)
  }
  rejectUnsafeExistingPath(root)
  mkdirSync(root, { recursive: true })
  rejectUnsafeExistingPath(root)
  let current = root
  for (const segment of suffix.split(sep).filter(Boolean)) {
    current = join(current, segment)
    rejectUnsafeExistingPath(current)
    if (!existsSync(current)) mkdirSync(current, { recursive: false })
    rejectUnsafeExistingPath(current)
  }
}

export function __setCodexPathOverrideForTests(override: CodexPathOverride): void {
  pathOverride = override
}

export function __resetCodexPathOverrideForTests(): void {
  pathOverride = undefined
}
