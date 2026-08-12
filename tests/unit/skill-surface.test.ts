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

describe("supabase-architect boundaries", () => {
  it("pins the retained owner and explicit neighboring-route boundaries in the eager router core", () => {
    const skillPath = join(PROJECT_ROOT, "skills", "supabase-architect", "SKILL.md")
    const skillContent = readFileSync(skillPath, "utf8")

    expect(skillContent).toContain("**Owned by:** wunderkind:fullstack-wunderkind")
    expect(skillContent).toContain("**Bucket:** promoted retained specialist")
    expect(skillContent).toContain("broader app-data composition")
    expect(skillContent).toContain("db-architect")
    expect(skillContent).toContain("vercel-architect")
    expect(skillContent).toContain("security-analyst")
    expect(skillContent).toContain("compliance-officer")
    expect(skillContent).toContain("improve-codebase-architecture")
    expect(skillContent).toContain("Do not become a generic backend route")
  })

  it("keeps the companion reference aligned with the official-source and escalation boundary contract", () => {
    const referencePath = join(PROJECT_ROOT, "skills", "supabase-architect", "REFERENCE.md")
    const referenceContent = readFileSync(referencePath, "utf8")

    expect(referenceContent).toContain("owner=fullstack-wunderkind")
    expect(referenceContent).toContain("route: `supabase-architect`")
    expect(referenceContent).toContain("https://supabase.com/docs/guides/auth/row-level-security")
    expect(referenceContent).toContain("https://github.com/supabase/agent-skills")
    expect(referenceContent).toContain("https://github.com/supabase/mcp")
    expect(referenceContent).toContain("db-architect")
    expect(referenceContent).toContain("vercel-architect")
    expect(referenceContent).toContain("security-analyst")
    expect(referenceContent).toContain("compliance-officer")
    expect(referenceContent).toContain("improve-codebase-architecture")
  })
})

describe("release-upgrade public route surface", () => {
  it("pins the retained owner and explicit anti-trigger boundaries in the eager router core", () => {
    const skillPath = join(PROJECT_ROOT, "skills", "release-upgrade", "SKILL.md")
    const skillContent = readFileSync(skillPath, "utf8")

    expect(skillContent).toContain("**Owned by:** wunderkind:product-wunderkind")
    expect(skillContent).toContain("release-note synthesis")
    expect(skillContent).toContain("version bump planning")
    expect(skillContent).toContain("compatibility checks")
    expect(skillContent).toContain("upgrade sequencing")
    expect(skillContent).toContain("rollback-conscious release prep")
    expect(skillContent).toContain("generic docs writing")
    expect(skillContent).toContain("generic engineering implementation")
    expect(skillContent).toContain("generic git/tag/publish execution")
    expect(skillContent).toContain("technical-writer")
    expect(skillContent).toContain("fullstack-wunderkind")
    expect(skillContent).toContain("git-master")
  })
})

describe("platform-compatibility public route surface", () => {
  it("pins the retained owner and explicit host-drift boundaries in the eager router core", () => {
    const skillPath = join(PROJECT_ROOT, "skills", "platform-compatibility", "SKILL.md")
    const skillContent = readFileSync(skillPath, "utf8")

    expect(skillContent).toContain("**Owned by:** wunderkind:fullstack-wunderkind")
    expect(skillContent).toContain("host/plugin/config-chain drift")
    expect(skillContent).toContain("OpenCode/OMO contract changes")
    expect(skillContent).toContain("compatibility audits")
    expect(skillContent).toContain("migration-boundary decisions")
    expect(skillContent).toContain("generic library docs lookup")
    expect(skillContent).toContain("generic debugging")
    expect(skillContent).toContain("normal architecture work")
    expect(skillContent).toContain("diagnose")
    expect(skillContent).toContain("improve-codebase-architecture")
    expect(skillContent).toContain("release-upgrade")
  })
})

describe("supportability-incident rejection surface", () => {
  it("keeps supportability-incident absent and routes operators to the existing command surfaces", () => {
    const supportabilitySkillDir = join(PROJECT_ROOT, "skills", "supportability-incident")
    const readmeContent = readFileSync(join(PROJECT_ROOT, "README.md"), "utf8")
    const agentsContent = readFileSync(join(PROJECT_ROOT, "AGENTS.md"), "utf8")
    const skillStandardContent = readFileSync(join(PROJECT_ROOT, "skills", "SKILL-STANDARD.md"), "utf8")

    expect(existsSync(supportabilitySkillDir)).toBe(false)

    for (const content of [readmeContent, agentsContent, skillStandardContent]) {
      expect(content).toContain("supportability-incident")
      expect(content).toContain("/supportability-review")
      expect(content).toContain("/runbook")
      expect(content).toContain("/incident-response")
      expect(content).toContain("overlap avoidance")
    }
  })
})

describe("public inventory truth surfaces", () => {
  it("keeps the 27-route public inventory and new route names mirrored across active docs surfaces", () => {
    const mirroredTruthFiles = [
      "README.md",
      "AGENTS.md",
      "CONTEXT.md",
      "skills/SKILL-STANDARD.md",
      "docs/README.md",
      "docs/product-decisions.md",
      "docs/engineering-decisions.md",
      "docs/marketing-strategy.md",
    ] as const

    for (const relativePath of mirroredTruthFiles) {
      const content = readFileSync(join(PROJECT_ROOT, relativePath), "utf8")

      expect(content).toContain("promoted=22")
      expect(content).toContain("wunderkind-specific=4")
      expect(content).toContain("deprecated=1")
      expect(content).toContain("public/deprecated total=27")
      expect(content).toContain("release-upgrade")
      expect(content).toContain("platform-compatibility")
    }
  })
})
