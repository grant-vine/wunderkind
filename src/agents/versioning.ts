import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const WUNDERKIND_AGENT_VERSION_FRONTMATTER_KEY = "wunderkind_version"

function readJsonVersion(filePath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const version = (parsed as Record<string, unknown>).version
    return typeof version === "string" ? version : null
  } catch {
    return null
  }
}

function readFrontmatterValue(markdown: string, key: string): string | null {
  const normalized = markdown.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return null

  const frontmatterEnd = normalized.indexOf("\n---\n", 4)
  if (frontmatterEnd === -1) return null

  const frontmatter = normalized.slice(4, frontmatterEnd)
  const match = frontmatter.match(new RegExp(String.raw`^${key}:\s*(?:"([^"]+)"|'([^']+)'|([^\n]+))\s*$`, "m"))

  return match?.[1] ?? match?.[2] ?? match?.[3]?.trim() ?? null
}

export function readOwnPackageVersion(): string | null {
  return readJsonVersion(fileURLToPath(new URL("../../package.json", import.meta.url)))
}

export function readWunderkindAgentMarkdownVersion(filePath: string): string | null {
  if (!existsSync(filePath)) return null

  try {
    const markdown = readFileSync(filePath, "utf-8")
    return readFrontmatterValue(markdown, WUNDERKIND_AGENT_VERSION_FRONTMATTER_KEY)
  } catch {
    return null
  }
}
