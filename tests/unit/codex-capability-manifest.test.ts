import { describe, expect, it } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { parseDocument } from "yaml"
import {
  CODEX_CAPABILITY_MANIFEST,
  CodexCapabilityValidationError,
  getCodexSourceViolations,
  renderCodexCapabilitySummary,
  validateCodexCapabilityManifest,
  type CodexCapabilityManifest,
} from "../../src/codex/capability-manifest.js"

const PROJECT_ROOT = new URL("../../", import.meta.url)

function sourceText(path: string): string {
  return readFileSync(new URL(path, PROJECT_ROOT), "utf8")
}

function skillFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n")
  const frontmatterEnd = normalized.indexOf("\n---\n", 4)
  if (!normalized.startsWith("---\n") || frontmatterEnd === -1) {
    throw new Error("Expected skill frontmatter")
  }
  return normalized.slice(4, frontmatterEnd)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function captureError(action: () => void): unknown {
  try {
    action()
    return undefined
  } catch (error) {
    return error
  }
}

describe("Codex capability manifest", () => {
  it("classifies the frozen Codex surface exactly once", () => {
    validateCodexCapabilityManifest(CODEX_CAPABILITY_MANIFEST)

    expect(CODEX_CAPABILITY_MANIFEST.agents).toHaveLength(6)
    expect(CODEX_CAPABILITY_MANIFEST.skills).toHaveLength(11)
    expect(CODEX_CAPABILITY_MANIFEST.legacySkills).toHaveLength(28)
    expect(CODEX_CAPABILITY_MANIFEST.staticCommands).toHaveLength(6)
    expect(CODEX_CAPABILITY_MANIFEST.generatedCommands).toHaveLength(39)
    expect(CODEX_CAPABILITY_MANIFEST.marketplace.id).toBe("grant-vine")
    expect(CODEX_CAPABILITY_MANIFEST.plugin.id).toBe("wunderkind")
    expect(CODEX_CAPABILITY_MANIFEST.lazyCodex.pluginId).toBe("omo@sisyphuslabs")
    expect(CODEX_CAPABILITY_MANIFEST.lazyCodex.versionRange).toBe(">=4.19.4 <5")
    expect(CODEX_CAPABILITY_MANIFEST.deferredCapabilities).toEqual([
      "codex-prompt-token-optimization-revisit",
      "no-token-audit-port",
    ])
    expect(renderCodexCapabilitySummary(CODEX_CAPABILITY_MANIFEST)).toBe("agents\t6\nskills\t11\nlegacy-skills\t28\nstatic-commands\t6\ngenerated-commands\t39")
  })

  it("keeps every retained source path present and free of prohibited route syntax", () => {
    const sourcePaths = [
      ...CODEX_CAPABILITY_MANIFEST.agents.map((agent) => agent.sourcePath),
      ...CODEX_CAPABILITY_MANIFEST.skills.map((skill) => skill.sourcePath),
    ]

    for (const sourcePath of sourcePaths) {
      expect(statSync(new URL(sourcePath, PROJECT_ROOT)).isFile()).toBe(true)
      expect(getCodexSourceViolations(sourcePath, sourceText(sourcePath))).toEqual([])
    }
  })

  it("keeps lean response mode on every retained Codex agent", () => {
    for (const agent of CODEX_CAPABILITY_MANIFEST.agents) {
      const source = sourceText(agent.sourcePath)
      expect(source).toContain("Lean response mode:")
      expect(source).toContain("expand only when the user asks or risk requires it")
    }
  })

  it("parses every retained skill frontmatter with the available YAML parser", () => {
    for (const skill of CODEX_CAPABILITY_MANIFEST.skills) {
      const document = parseDocument(skillFrontmatter(sourceText(skill.sourcePath)))
      const parsed: unknown = document.toJS()

      expect(document.errors).toEqual([])
      expect(isRecord(parsed)).toBe(true)
      if (!isRecord(parsed)) throw new Error(`Expected record frontmatter for ${skill.id}`)
      expect(parsed.name).toBe(skill.id)
      expect(typeof parsed.description).toBe("string")
    }
  })

  it("rejects duplicate or built-in agent names", () => {
    const firstAgent = CODEX_CAPABILITY_MANIFEST.agents.at(0)
    if (!firstAgent) throw new Error("Expected a retained Codex agent")

    const duplicate: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      agents: [...CODEX_CAPABILITY_MANIFEST.agents, firstAgent],
    }
    const builtIn: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      agents: [{ ...firstAgent, id: "default" }, ...CODEX_CAPABILITY_MANIFEST.agents.slice(1)],
    }

    expect(captureError(() => validateCodexCapabilityManifest(duplicate)) instanceof CodexCapabilityValidationError).toBe(true)
    expect(captureError(() => validateCodexCapabilityManifest(builtIn)) instanceof CodexCapabilityValidationError).toBe(true)
  })

  it("rejects changed legacy and command dispositions", () => {
    const legacy = CODEX_CAPABILITY_MANIFEST.legacySkills.at(0)
    const staticCommand = CODEX_CAPABILITY_MANIFEST.staticCommands.at(0)
    const generatedCommand = CODEX_CAPABILITY_MANIFEST.generatedCommands.at(0)
    if (!legacy || !staticCommand || !generatedCommand) throw new Error("Expected frozen disposition records")

    const changedLegacy: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      legacySkills: [{ ...legacy, target: "unexpected legacy route" }, ...CODEX_CAPABILITY_MANIFEST.legacySkills.slice(1)],
    }
    const changedStaticCommand: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      staticCommands: [{ ...staticCommand, disposition: "excluded", target: "unexpected static route" }, ...CODEX_CAPABILITY_MANIFEST.staticCommands.slice(1)],
    }
    const changedGeneratedCommand: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      generatedCommands: [{ ...generatedCommand, disposition: "deferred", target: "unexpected generated route" }, ...CODEX_CAPABILITY_MANIFEST.generatedCommands.slice(1)],
    }

    expect(captureError(() => validateCodexCapabilityManifest(changedLegacy)) instanceof CodexCapabilityValidationError).toBe(true)
    expect(captureError(() => validateCodexCapabilityManifest(changedStaticCommand)) instanceof CodexCapabilityValidationError).toBe(true)
    expect(captureError(() => validateCodexCapabilityManifest(changedGeneratedCommand)) instanceof CodexCapabilityValidationError).toBe(true)
  })

  it("rejects changed or missing Supabase companion skill identifiers", () => {
    const changed: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      optionalCompanions: {
        ...CODEX_CAPABILITY_MANIFEST.optionalCompanions,
        supabaseSkills: ["unexpected-supabase-skill", "supabase-postgres-best-practices"],
      },
    }
    const missing: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      optionalCompanions: {
        ...CODEX_CAPABILITY_MANIFEST.optionalCompanions,
        supabaseSkills: ["supabase"],
      },
    }

    expect(captureError(() => validateCodexCapabilityManifest(changed)) instanceof CodexCapabilityValidationError).toBe(true)
    expect(captureError(() => validateCodexCapabilityManifest(missing)) instanceof CodexCapabilityValidationError).toBe(true)
  })

  it("rejects an unclassified legacy skill and prohibited source content", () => {
    const incomplete: CodexCapabilityManifest = {
      ...CODEX_CAPABILITY_MANIFEST,
      legacySkills: CODEX_CAPABILITY_MANIFEST.legacySkills.slice(1),
    }

    expect(captureError(() => validateCodexCapabilityManifest(incomplete)) instanceof CodexCapabilityValidationError).toBe(true)
    expect(getCodexSourceViolations("fixture", "task(\"delegate\")")).not.toEqual([])
    expect(getCodexSourceViolations("fixture", "skill(name=\"legacy\")")).not.toEqual([])
    expect(getCodexSourceViolations("fixture", "Use agent-browser")).not.toEqual([])
    expect(getCodexSourceViolations("fixture", "Use /legacy-command")).not.toEqual([])
    expect(getCodexSourceViolations("fixture", "Matt Pocock owns this route")).not.toEqual([])
    expect(getCodexSourceViolations("fixture", "Provide prompt optimization guidance")).not.toEqual([])
  })
})
