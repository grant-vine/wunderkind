import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createLegalCounselAgent } from "../../src/agents/legal-counsel.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname

const THIN_CORE_SKILLS = [
  "compliance-officer",
  "db-architect",
  "pen-tester",
  "security-analyst",
  "social-media-maven",
  "vercel-architect",
] as const

describe("thin-core skill surfaces", () => {
  for (const skillName of THIN_CORE_SKILLS) {
    it(`${skillName} keeps a sibling REFERENCE.md and points to it from SKILL.md`, () => {
      const skillPath = join(PROJECT_ROOT, "skills", skillName, "SKILL.md")
      const referencePath = join(PROJECT_ROOT, "skills", skillName, "REFERENCE.md")
      const skillContent = readFileSync(skillPath, "utf8")

      expect(existsSync(referencePath)).toBe(true)
      expect(skillContent).toContain(`skills/${skillName}/REFERENCE.md`)
    })

    it(`${skillName} keeps the eager router core thin`, () => {
      const skillPath = join(PROJECT_ROOT, "skills", skillName, "SKILL.md")
      const lineCount = readFileSync(skillPath, "utf8").split("\n").length

      expect(lineCount < 120).toBe(true)
    })
  }

  it("compliance-officer pins runtime-context-first in the eager router core", () => {
    const skillPath = join(PROJECT_ROOT, "skills", "compliance-officer", "SKILL.md")
    const skillContent = readFileSync(skillPath, "utf8")

    expect(skillContent).toContain("resolved Wunderkind runtime context first")
    expect(skillContent).toContain("**Runtime-context first**")
  })

  it("db-architect pins the destructive action protocol in the eager router core", () => {
    const skillPath = join(PROJECT_ROOT, "skills", "db-architect", "SKILL.md")
    const skillContent = readFileSync(skillPath, "utf8")

    expect(skillContent).toContain("## Destructive Action Protocol")
    expect(skillContent).toContain("Never bypass this protocol.")
    expect(skillContent).toContain("skills/db-architect/references/CONFIRMATIONS.md")
  })

  it("thin-core skills retain routing sections in the eager router core", () => {
    for (const skillName of THIN_CORE_SKILLS) {
      const skillPath = join(PROJECT_ROOT, "skills", skillName, "SKILL.md")
      const skillContent = readFileSync(skillPath, "utf8")

      expect(skillContent).toContain("## When to trigger")
      expect(skillContent).toContain("## Anti-triggers")
      expect(skillContent).toContain("## Process")
      expect(skillContent).toContain("## Hard rules")
      expect(skillContent).toContain("## Review gate")
    }
  })
})

describe("runtime-context precedence regressions", () => {
  it("legal-counsel prompt uses resolved runtime context before project-local config", () => {
    const prompt = createLegalCounselAgent("test-model").prompt

    expect(prompt).toContain("resolved runtime context for `region` and `primaryRegulation`")
    expect(prompt).toContain("only fall back to project-local config when runtime context is unavailable")
    expect(prompt).not.toContain("first reading `region` and `primaryRegulation` from `.wunderkind/wunderkind.config.jsonc`")
  })
})
