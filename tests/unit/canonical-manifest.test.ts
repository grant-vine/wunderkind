import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { parse as parseJsonc } from "jsonc-parser"
import { WUNDERKIND_AGENT_DEFINITIONS } from "../../src/agents/manifest.js"
import {
  WUNDERKIND_CANONICAL_MANIFEST,
  getCanonicalClaudePluginManifest,
  isShippedCanonicalSkill,
  renderCanonicalOhMyOpenagentTemplate,
} from "../../src/agents/canonical-manifest.js"
import { renderNativeAgentMarkdown } from "../../src/agents/render-markdown.js"

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function readJsonFile(fileUrl: URL): unknown {
  return JSON.parse(readFileSync(fileUrl, "utf8")) as unknown
}

function readTextFile(fileUrl: URL): string {
  return readFileSync(fileUrl, "utf8")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseMarkdownFrontmatter(markdown: string): Record<string, string> {
  const normalized = markdown.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) {
    throw new Error("Expected markdown frontmatter start")
  }

  const frontmatterEnd = normalized.indexOf("\n---\n", 4)
  if (frontmatterEnd === -1) {
    throw new Error("Expected markdown frontmatter end")
  }

  const rawFrontmatter = normalized.slice(4, frontmatterEnd)
  const lines = rawFrontmatter.split("\n")
  const result: Record<string, string> = {}
  let activeBlockKey: string | null = null
  const activeBlockLines: string[] = []

  function flushActiveBlock(): void {
    if (activeBlockKey === null) return
    result[activeBlockKey] = normalizeWhitespace(activeBlockLines.join(" "))
    activeBlockKey = null
    activeBlockLines.length = 0
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined || line.trim() === "") continue

    const blockMatch = line.match(/^([A-Za-z0-9_-]+):\s*>\s*$/)
    if (blockMatch?.[1] !== undefined) {
      flushActiveBlock()
      activeBlockKey = blockMatch[1]
      continue
    }

    const scalarMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (scalarMatch?.[1] !== undefined && scalarMatch[2] !== undefined) {
      flushActiveBlock()
      const [, key, rawValue] = scalarMatch
      const trimmed = rawValue.trim()
      result[key] = trimmed.replace(/^"|"$/g, "")
      continue
    }

    if (activeBlockKey === null) {
      throw new Error(`Unsupported frontmatter line: ${line}`)
    }
    activeBlockLines.push(line.trim())
  }

  flushActiveBlock()

  return result
}

function readOwnerLine(markdown: string): string {
  const match = markdown.match(/\*\*Owned by:\*\*\s+([^\n]+)/)
  if (match?.[1] === undefined) {
    throw new Error("Expected skill owner line")
  }
  return match[1].trim()
}

describe("canonical manifest drift guards", () => {
  it("keeps manifest-owned package fields aligned with package.json", () => {
    const parsed = readJsonFile(new URL("../../package.json", import.meta.url))
    expect(isRecord(parsed)).toBe(true)
    if (!isRecord(parsed)) {
      throw new Error("Expected package.json to be a JSON object")
    }

    expect(parsed.name).toBe(WUNDERKIND_CANONICAL_MANIFEST.package.name)
    expect(parsed.version).toBe(WUNDERKIND_CANONICAL_MANIFEST.package.version)
    expect(parsed.description).toBe(WUNDERKIND_CANONICAL_MANIFEST.package.description)
    expect(parsed.keywords).toEqual([...WUNDERKIND_CANONICAL_MANIFEST.package.keywords])
    expect(parsed.files).toEqual([...WUNDERKIND_CANONICAL_MANIFEST.package.files])
  })

  it("keeps the Claude plugin manifest aligned with the canonical manifest projection", () => {
    const parsed = readJsonFile(new URL("../../.claude-plugin/plugin.json", import.meta.url))
    expect(parsed).toEqual(getCanonicalClaudePluginManifest())
  })

  it("keeps retained agent metadata aligned between the canonical manifest and build definitions", () => {
    expect(
      WUNDERKIND_AGENT_DEFINITIONS.map((definition) => ({
        id: definition.id,
        roleLabel: definition.roleLabel,
        summary: definition.summary,
      })),
    ).toEqual(
      WUNDERKIND_CANONICAL_MANIFEST.agents.map((agent) => ({
        id: agent.id,
        roleLabel: agent.roleLabel,
        summary: agent.summary,
      })),
    )
  })

  it("keeps generated agent markdown frontmatter aligned with canonical manifest metadata", () => {
    for (const agent of WUNDERKIND_CANONICAL_MANIFEST.agents) {
      const definition = WUNDERKIND_AGENT_DEFINITIONS.find((candidate) => candidate.id === agent.id)

      expect(definition).toBeDefined()
      if (definition === undefined) {
        throw new Error(`Expected generated definition for ${agent.id}`)
      }

      const markdown = renderNativeAgentMarkdown(definition)

      expect(markdown).toContain(`description: >\n  ${agent.roleLabel} — ${agent.summary}`)
      expect(markdown).toContain(
        `${WUNDERKIND_CANONICAL_MANIFEST.package.agentVersionFrontmatterKey}: "${WUNDERKIND_CANONICAL_MANIFEST.package.version}"`,
      )
    }
  })

  it("keeps shipped static command frontmatter aligned with the canonical manifest", () => {
    for (const command of WUNDERKIND_CANONICAL_MANIFEST.commands.static) {
      const markdown = readTextFile(new URL(`../../${command.sourcePath}`, import.meta.url))
      const frontmatter = parseMarkdownFrontmatter(markdown)

      expect(frontmatter.description).toBe(command.summary)
      expect(frontmatter.agent).toBe(command.ownerAgentId)
      expect(frontmatter.subtask).toBe(String(command.subtask))
      if (frontmatter.name !== undefined) {
        expect(frontmatter.name).toBe(command.name)
      } else {
        expect(command.name).toBe(command.command.slice(1))
      }
    }
  })

  it("keeps skill frontmatter, owner lines, and bucket coverage aligned with the canonical manifest", () => {
    const expectedBuckets = {
      promoted: 23,
      "wunderkind-specific": 4,
      deprecated: 1,
      internal: 0,
      "remove-now": 0,
    } as const
    const bucketCounts = new Map<string, number>(Object.keys(expectedBuckets).map((bucket) => [bucket, 0]))

    for (const skill of WUNDERKIND_CANONICAL_MANIFEST.skills) {
      if (isShippedCanonicalSkill(skill)) {
        const markdown = readTextFile(new URL(`../../${skill.sourcePath}`, import.meta.url))
        const frontmatter = parseMarkdownFrontmatter(markdown)

        expect(frontmatter.name).toBe(skill.id)
        expect(frontmatter.description).toBe(normalizeWhitespace(skill.description))
        expect(readOwnerLine(markdown)).toBe(`wunderkind:${skill.ownerAgentId}`)
      }

      bucketCounts.set(skill.bucket, (bucketCounts.get(skill.bucket) ?? 0) + 1)
    }

    expect(WUNDERKIND_CANONICAL_MANIFEST.skills).toHaveLength(28)
    expect(Object.fromEntries(bucketCounts)).toEqual(expectedBuckets)
  })

  it("ships supabase-architect as a promoted fullstack-owned public skill", () => {
    const supabaseSkill = WUNDERKIND_CANONICAL_MANIFEST.skills.find((skill) => skill.id === "supabase-architect")

    expect(supabaseSkill).toBeDefined()
    if (supabaseSkill === undefined) {
      throw new Error("Expected canonical manifest to include supabase-architect")
    }

    expect(supabaseSkill.bucket).toBe("promoted")
    expect(supabaseSkill.sourceStatus).toBe("shipped")
    expect(supabaseSkill.ownerAgentId).toBe("fullstack-wunderkind")
    expect(supabaseSkill.description).toContain("Supabase auth architecture")
    expect(supabaseSkill.description).toContain("broader app-data composition")
    expect(supabaseSkill.description).toContain("Do not use for generic backend work")
  })

  it("ships supportability-review as a promoted fullstack-owned public skill", () => {
    const supportabilityReviewSkill = WUNDERKIND_CANONICAL_MANIFEST.skills.find(
      (skill) => skill.id === "supportability-review",
    )

    expect(supportabilityReviewSkill).toBeDefined()
    if (supportabilityReviewSkill === undefined) {
      throw new Error("Expected canonical manifest to include supportability-review")
    }

    expect(supportabilityReviewSkill.bucket).toBe("promoted")
    expect(supportabilityReviewSkill.sourceStatus).toBe("shipped")
    expect(supportabilityReviewSkill.ownerAgentId).toBe("fullstack-wunderkind")
    expect(supportabilityReviewSkill.description).toContain("observability review")
    expect(supportabilityReviewSkill.description).toContain("rollback readiness")
    expect(supportabilityReviewSkill.description).toContain("on-call ownership")
  })

  it("ships release-upgrade as a promoted product-owned public skill", () => {
    const releaseUpgradeSkill = WUNDERKIND_CANONICAL_MANIFEST.skills.find((skill) => skill.id === "release-upgrade")

    expect(releaseUpgradeSkill).toBeDefined()
    if (releaseUpgradeSkill === undefined) {
      throw new Error("Expected canonical manifest to include release-upgrade")
    }

    expect(releaseUpgradeSkill.bucket).toBe("promoted")
    expect(releaseUpgradeSkill.sourceStatus).toBe("shipped")
    expect(releaseUpgradeSkill.ownerAgentId).toBe("product-wunderkind")
    expect(releaseUpgradeSkill.description).toContain("release-note synthesis")
    expect(releaseUpgradeSkill.description).toContain("version bump planning")
    expect(releaseUpgradeSkill.description).toContain("rollback-conscious release prep")
  })

  it("ships platform-compatibility as a promoted fullstack-owned public skill", () => {
    const platformCompatibilitySkill = WUNDERKIND_CANONICAL_MANIFEST.skills.find(
      (skill) => skill.id === "platform-compatibility",
    )

    expect(platformCompatibilitySkill).toBeDefined()
    if (platformCompatibilitySkill === undefined) {
      throw new Error("Expected canonical manifest to include platform-compatibility")
    }

    expect(platformCompatibilitySkill.bucket).toBe("promoted")
    expect(platformCompatibilitySkill.sourceStatus).toBe("shipped")
    expect(platformCompatibilitySkill.ownerAgentId).toBe("fullstack-wunderkind")
    expect(platformCompatibilitySkill.description).toContain("host/plugin/config-chain drift")
    expect(platformCompatibilitySkill.description).toContain("OpenCode/OMO contract changes")
    expect(platformCompatibilitySkill.description).toContain("migration-boundary decisions")
  })

  it("intentionally rejects supportability-incident as a shipped skill because existing routes already cover it", () => {
    const skillIds: readonly string[] = WUNDERKIND_CANONICAL_MANIFEST.skills.map((skill) => skill.id)
    const supportabilityReviewCommand = WUNDERKIND_CANONICAL_MANIFEST.commands.generated.find(
      (command) => command.command === "/supportability-review <service>",
    )
    const runbookCommand = WUNDERKIND_CANONICAL_MANIFEST.commands.generated.find(
      (command) => command.command === "/runbook <service> <alert>",
    )
    const incidentResponseCommand = WUNDERKIND_CANONICAL_MANIFEST.commands.generated.find(
      (command) => command.command === "/incident-response <incident type>",
    )

    expect(skillIds.includes("supportability-incident")).toBe(false)
    expect(supportabilityReviewCommand).toBeDefined()
    expect(runbookCommand).toBeDefined()
    expect(incidentResponseCommand).toBeDefined()
  })

  it("keeps docs-output metadata aligned with the canonical manifest", () => {
    expect(WUNDERKIND_CANONICAL_MANIFEST.docsOutput.docsIndex.invocation).toBe("/docs-index")
    expect(WUNDERKIND_CANONICAL_MANIFEST.docsOutput.entries).toEqual([
      {
        agentId: "marketing-wunderkind",
        canonicalFilename: "marketing-strategy.md",
        eligible: true,
      },
      {
        agentId: "creative-director",
        canonicalFilename: "design-decisions.md",
        eligible: true,
      },
      {
        agentId: "product-wunderkind",
        canonicalFilename: "product-decisions.md",
        eligible: true,
      },
      {
        agentId: "fullstack-wunderkind",
        canonicalFilename: "engineering-decisions.md",
        eligible: true,
      },
      {
        agentId: "ciso",
        canonicalFilename: "security-decisions.md",
        eligible: true,
      },
      {
        agentId: "legal-counsel",
        canonicalFilename: "legal-notes.md",
        eligible: false,
      },
    ])
  })

  it("keeps the published OMO template aligned with the canonical manifest renderer", () => {
    const rendered = renderCanonicalOhMyOpenagentTemplate()
    const published = readTextFile(new URL("../../oh-my-openagent.jsonc", import.meta.url))

    expect(parseJsonc(published)).toEqual(parseJsonc(rendered))
  })
})
