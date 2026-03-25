import { describe, it } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname

function getAllMarkdownFiles(dir: string): string[] {
  const results: string[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const entryStat = statSync(fullPath)

    if (entryStat.isDirectory()) {
      results.push(...getAllMarkdownFiles(fullPath))
      continue
    }

    if (entry.endsWith(".md")) {
      results.push(fullPath)
    }
  }

  return results
}

function getScanTargets(): string[] {
  return [
    ...getAllMarkdownFiles(join(PROJECT_ROOT, "skills")),
    join(PROJECT_ROOT, "AGENTS.md"),
  ]
}

function formatPath(filePath: string): string {
  return relative(PROJECT_ROOT, filePath) || filePath
}

// Regression guard — NOT expected to fail red on day one.
// The scanned markdown files (skills/**/*.md and AGENTS.md) are already compliant at the time
// this suite was introduced. This test suite detects future regressions where a new or edited
// task() example omits the required run_in_background or load_skills fields.
describe("skill markdown task contract regression guard", () => {
  const scanTargets = getScanTargets()

  for (const filePath of scanTargets) {
    it(`${formatPath(filePath)}: task() examples include required fields`, () => {
      const content = readFileSync(filePath, "utf8")
      const lines = content.split("\n")

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex]

        if (!line?.includes("task(")) {
          continue
        }

        const start = Math.max(0, lineIndex - 15)
        const end = Math.min(lines.length - 1, lineIndex + 15)
        const window = lines.slice(start, end + 1).join("\n")
        const location = `${formatPath(filePath)}:${lineIndex + 1}`

        if (!window.includes("run_in_background")) {
          throw new Error(`Missing 'run_in_background' near task() at ${location}`)
        }

        if (!window.includes("load_skills")) {
          throw new Error(`Missing 'load_skills' near task() at ${location}`)
        }
      }
    })
  }
})
