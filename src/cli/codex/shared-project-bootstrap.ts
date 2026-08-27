import { existsSync, lstatSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { PRIMARY_PROJECT_ARTIFACT_DIR } from "../../project-artifacts.js"
import { bootstrapDocsReadme, validateDocsBootstrapLane } from "../docs-output-helper.js"

const AGENTS_MD_PLACEHOLDER = `# Project Agents

This file documents the AI agents configured for this project via Wunderkind.
Use $wunderkind to route a product-team decision, then use $docs-index to refresh managed documentation lanes.
`

const CONTEXT_MD_PLACEHOLDER = `# Project Context

This file captures the compact shared context for this project. Keep it current when the core product/domain framing changes.

## Product and domain summary
- What problem is this project solving?
- Who is it for?
- What counts as success?

## Core workflows
- What user or operator workflows matter most right now?
- Where does the product currently feel brittle or unclear?

## Shared language
- Canonical terms the team should use
- Ambiguous terms to avoid

## Important constraints
- Compliance, security, or business constraints that keep showing up
- Technical seams or architectural boundaries other agents should respect

## Open questions
- Questions that still need decisions before docs, PRDs, or implementation can settle
`

function ensureFile(path: string, content: string): void {
  if (!existsSync(path)) writeFileSync(path, content, "utf8")
}

function lstatOrMissing(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
}

function validateBootstrapFile(path: string): string | null {
  const stat = lstatOrMissing(path)
  if (stat !== undefined && (stat.isSymbolicLink() || !stat.isFile())) return `Codex shared project file is unsafe: ${path}`
  return null
}

function validateBootstrapDirectory(path: string): string | null {
  const stat = lstatOrMissing(path)
  if (stat !== undefined && (stat.isSymbolicLink() || !stat.isDirectory())) return `Codex shared project directory is unsafe: ${path}`
  return null
}

export function validateCodexSharedProjectArtifacts(cwd: string, docsEnabled: boolean, docsPath: string): string | null {
  try {
    for (const path of [join(cwd, "AGENTS.md"), join(cwd, "CONTEXT.md")]) {
      const error = validateBootstrapFile(path)
      if (error !== null) return error
    }
    const artifactDirectory = join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR)
    for (const path of [artifactDirectory, join(artifactDirectory, "plans"), join(artifactDirectory, "notepads"), join(artifactDirectory, "evidence")]) {
      const error = validateBootstrapDirectory(path)
      if (error !== null) return error
    }
    if (docsEnabled) validateDocsBootstrapLane(docsPath, cwd)
    return null
  } catch (error) {
    return `Unable to validate Codex shared project artifacts: ${String(error)}`
  }
}

export function bootstrapCodexSharedProjectArtifacts(cwd: string, docsEnabled: boolean, docsPath: string): void {
  ensureFile(join(cwd, "AGENTS.md"), AGENTS_MD_PLACEHOLDER)
  ensureFile(join(cwd, "CONTEXT.md"), CONTEXT_MD_PLACEHOLDER)
  mkdirSync(join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR, "plans"), { recursive: true })
  mkdirSync(join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR, "notepads"), { recursive: true })
  mkdirSync(join(cwd, PRIMARY_PROJECT_ARTIFACT_DIR, "evidence"), { recursive: true })
  if (docsEnabled) bootstrapDocsReadme(docsPath, cwd)
}
