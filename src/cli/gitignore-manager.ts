import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const GITIGNORE_PATH = join(process.cwd(), ".gitignore")

const AI_TRACE_ENTRIES = [
  ".wunderkind/",
  "AGENTS.md",
  ".sisyphus/",
  ".opencode/",
] as const

const SECTION_HEADER = "# AI tooling traces — managed by wunderkind"

export interface GitignoreResult {
  success: boolean
  added: string[]
  alreadyPresent: string[]
  error?: string
}

function parseGitignore(content: string): Set<string> {
  return new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  )
}

export function addAiTracesToGitignore(): GitignoreResult {
  const gitignorePath = GITIGNORE_PATH
  const added: string[] = []
  const alreadyPresent: string[] = []

  try {
    let content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : ""
    const existing = parseGitignore(content)

    const toAdd = AI_TRACE_ENTRIES.filter((entry) => {
      if (existing.has(entry)) {
        alreadyPresent.push(entry)
        return false
      }
      return true
    })

    if (toAdd.length === 0) {
      return { success: true, added, alreadyPresent }
    }

    const sectionAlreadyPresent = content.includes(SECTION_HEADER)
    const newLines = toAdd.map((e) => e)

    if (sectionAlreadyPresent) {
      const sectionIndex = content.indexOf(SECTION_HEADER)
      const insertAt = content.indexOf("\n", sectionIndex) + 1
      content = content.slice(0, insertAt) + newLines.join("\n") + "\n" + content.slice(insertAt)
    } else {
      const needsNewline = content.length > 0 && !content.endsWith("\n")
      if (needsNewline) content += "\n"
      if (content.length > 0) content += "\n"
      content += SECTION_HEADER + "\n" + newLines.join("\n") + "\n"
    }

    writeFileSync(gitignorePath, content, "utf-8")
    added.push(...toAdd)

    return { success: true, added, alreadyPresent }
  } catch (err) {
    return { success: false, added, alreadyPresent, error: String(err) }
  }
}
