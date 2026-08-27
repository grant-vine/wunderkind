import { describe, expect, it } from "bun:test"
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parse } from "toml"
import { parseDocument } from "yaml"
import { CODEX_CAPABILITY_MANIFEST } from "../../src/codex/capability-manifest.js"
import { buildCodexPayload, CodexPayloadBuildError } from "../../src/codex/build-payload.js"
import { renderCodexAgentToml } from "../../src/codex/render-agent-toml.js"

const PROJECT_ROOT = new URL("../../", import.meta.url)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function packageVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync(new URL("package.json", PROJECT_ROOT), "utf8"))
  if (!isRecord(parsed)) {
    throw new Error("Expected package metadata")
  }
  const version = parsed["version"]
  if (typeof version !== "string") throw new Error("Expected package version")
  return version
}

const PACKAGE_VERSION = packageVersion()

function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), "wunderkind-codex-payload-"))
}

function captureError(action: () => void): unknown {
  try {
    action()
    return undefined
  } catch (error) {
    return error
  }
}

function payloadOptions(outputRoot: string) {
  return {
    manifest: CODEX_CAPABILITY_MANIFEST,
    sourceRoot: new URL("../../", import.meta.url).pathname,
    outputRoot,
    packageVersion: PACKAGE_VERSION,
  }
}

function fixtureSourceRoot(): { readonly root: string; readonly sourceRoot: string; readonly externalFile: string } {
  const root = makeTempRoot()
  const sourceRoot = join(root, "source")
  const externalFile = join(root, "outside.txt")
  cpSync(new URL("../../codex-src", import.meta.url), join(sourceRoot, "codex-src"), { recursive: true })
  writeFileSync(externalFile, "external bytes must not be published", "utf8")
  return { root, sourceRoot, externalFile }
}

function skillFrontmatter(markdown: string): string {
  const frontmatterEnd = markdown.indexOf("\n---\n", 4)
  if (!markdown.startsWith("---\n") || frontmatterEnd === -1) {
    throw new Error("Expected skill frontmatter")
  }
  return markdown.slice(4, frontmatterEnd)
}

describe("Codex payload build", () => {
  it("builds a deterministic skills-only marketplace payload", () => {
    const firstRoot = makeTempRoot()
    const secondRoot = makeTempRoot()

    try {
      const first = buildCodexPayload(payloadOptions(firstRoot))
      const second = buildCodexPayload(payloadOptions(secondRoot))
      const firstPluginRoot = join(firstRoot, "marketplace", "plugins", "wunderkind", PACKAGE_VERSION)

      expect(readFileSync(first.manifestPath, "utf8")).toBe(readFileSync(second.manifestPath, "utf8"))
      expect(first.files).toHaveLength(18)
      expect(first.files.filter((entry) => entry.path.startsWith("agents/")).map((entry) => entry.path)).toEqual(
        CODEX_CAPABILITY_MANIFEST.agents.map((agent) => `agents/${agent.id}.toml`).sort(),
      )
      expect(first.files.map((entry) => entry.path)).toEqual([
        ...CODEX_CAPABILITY_MANIFEST.agents.map((agent) => `agents/${agent.id}.toml`),
        `marketplace/plugins/wunderkind/${PACKAGE_VERSION}/.codex-plugin/plugin.json`,
        ...CODEX_CAPABILITY_MANIFEST.skills.map((skill) => `marketplace/plugins/wunderkind/${PACKAGE_VERSION}/skills/${skill.id}/SKILL.md`),
      ].sort())
      expect(existsSync(join(firstPluginRoot, ".codex-plugin", "plugin.json"))).toBe(true)
      expect(existsSync(join(firstRoot, "marketplace", ".agents", "plugins", "marketplace.json"))).toBe(true)
      expect(first.files.some((entry) => entry.path.includes("marketplace.json"))).toBe(false)

      const pluginManifest: unknown = JSON.parse(readFileSync(join(firstPluginRoot, ".codex-plugin", "plugin.json"), "utf8"))
      if (!isRecord(pluginManifest)) throw new Error("Expected plugin manifest")
      expect(Object.keys(pluginManifest).sort()).toEqual([
        "author", "description", "interface", "license", "name", "repository", "skills", "version",
      ])

      for (const agent of CODEX_CAPABILITY_MANIFEST.agents) {
        const toml = readFileSync(join(firstRoot, "agents", `${agent.id}.toml`), "utf8")
        const parsedToml: unknown = parse(toml)
        if (!isRecord(parsedToml)) throw new Error(`Expected TOML document for ${agent.id}`)
        expect(toml).toContain(`name = \"${agent.id}\"`)
        expect(toml).toContain("description = ")
        expect(toml).toContain("developer_instructions = ")
        expect(toml).not.toContain("model =")
        expect(toml).not.toContain("reasoning_effort =")
      }

      for (const skill of CODEX_CAPABILITY_MANIFEST.skills) {
        const skillPath = join(firstPluginRoot, "skills", skill.id, "SKILL.md")
        expect(existsSync(skillPath)).toBe(true)
        const document = parseDocument(skillFrontmatter(readFileSync(skillPath, "utf8")))
        expect(document.errors).toEqual([])
      }
    } finally {
      rmSync(firstRoot, { recursive: true, force: true })
      rmSync(secondRoot, { recursive: true, force: true })
    }
  })

  it("renders TOML with only the custom-agent contract fields", () => {
    const rendered = renderCodexAgentToml({
      name: "wunderkind-product",
      description: "Routes product-team decisions.",
      developerInstructions: "Keep the route narrow.",
    })

    expect(rendered).toBe([
      'name = "wunderkind-product"',
      'description = "Routes product-team decisions."',
      'developer_instructions = "Keep the route narrow."',
      "",
    ].join("\n"))
  })

  it("escapes multiline backslashes and quotes while rejecting delimiter injection", () => {
    const rendered = renderCodexAgentToml({
      name: "wunderkind-product",
      description: "Routes product-team decisions.",
      developerInstructions: "Use C:\\workspace\\project.\nMatch \\bword\\b and say \"quoted\".",
    })
    const parsed: unknown = parse(rendered)
    if (!isRecord(parsed)) throw new Error("Expected parsed TOML")

    expect(parsed["developer_instructions"]).toBe("Use C:\\workspace\\project.\nMatch \\bword\\b and say \"quoted\".\n")
    expect(captureError(() => renderCodexAgentToml({
      name: "wunderkind-product",
      description: "Routes product-team decisions.",
      developerInstructions: "Do not close this TOML string: \"\"\"",
    })) instanceof Error).toBe(true)
  })

  it("rejects invalid inputs before publishing output", () => {
    const outputRoot = makeTempRoot()
    const sentinel = join(outputRoot, "sentinel.txt")
    writeFileSync(sentinel, "unchanged", "utf8")
    const firstSkill = CODEX_CAPABILITY_MANIFEST.skills.at(0)
    const firstAgent = CODEX_CAPABILITY_MANIFEST.agents.at(0)
    if (!firstSkill || !firstAgent) throw new Error("Expected Codex sources")

    try {
      const missingSkill = {
        ...CODEX_CAPABILITY_MANIFEST,
        skills: [{ ...firstSkill, sourcePath: "codex-src/skills/missing/SKILL.md" }, ...CODEX_CAPABILITY_MANIFEST.skills.slice(1)],
      }
      const escapedSkill = {
        ...CODEX_CAPABILITY_MANIFEST,
        skills: [{ ...firstSkill, sourcePath: "../outside/SKILL.md" }, ...CODEX_CAPABILITY_MANIFEST.skills.slice(1)],
      }
      const builtInAgent = {
        ...CODEX_CAPABILITY_MANIFEST,
        agents: [{ ...firstAgent, id: "worker" }, ...CODEX_CAPABILITY_MANIFEST.agents.slice(1)],
      }

      expect(captureError(() => buildCodexPayload({ ...payloadOptions(outputRoot), manifest: missingSkill })) instanceof CodexPayloadBuildError).toBe(true)
      expect(captureError(() => buildCodexPayload({ ...payloadOptions(outputRoot), manifest: escapedSkill })) instanceof CodexPayloadBuildError).toBe(true)
      expect(captureError(() => buildCodexPayload({ ...payloadOptions(outputRoot), manifest: builtInAgent })) instanceof CodexPayloadBuildError).toBe(true)
      expect(readFileSync(sentinel, "utf8")).toBe("unchanged")
    } finally {
      rmSync(outputRoot, { recursive: true, force: true })
    }
  })

  it("rejects unsupported plugin manifest fields before publication", () => {
    const outputRoot = makeTempRoot()

    try {
      const error = captureError(() => buildCodexPayload({
        ...payloadOptions(outputRoot),
        pluginManifestOverrides: { hooks: "./hooks.json" },
      }))

      expect(error instanceof CodexPayloadBuildError).toBe(true)
      expect(existsSync(join(outputRoot, "marketplace"))).toBe(false)
    } finally {
      rmSync(outputRoot, { recursive: true, force: true })
    }
  })

  it("rejects a source symlink that escapes sourceRoot before publishing output", () => {
    const fixture = fixtureSourceRoot()
    const outputRoot = makeTempRoot()
    const sentinel = join(outputRoot, "sentinel.txt")
    const firstSkill = CODEX_CAPABILITY_MANIFEST.skills.at(0)
    if (!firstSkill) throw new Error("Expected a Codex skill")

    try {
      writeFileSync(sentinel, "unchanged", "utf8")
      const target = join(fixture.sourceRoot, firstSkill.sourcePath)
      unlinkSync(target)
      symlinkSync(fixture.externalFile, target)

      const error = captureError(() => buildCodexPayload({
        ...payloadOptions(outputRoot),
        sourceRoot: fixture.sourceRoot,
      }))

      expect(error instanceof CodexPayloadBuildError).toBe(true)
      expect(readFileSync(sentinel, "utf8")).toBe("unchanged")
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
      rmSync(outputRoot, { recursive: true, force: true })
    }
  })
})
