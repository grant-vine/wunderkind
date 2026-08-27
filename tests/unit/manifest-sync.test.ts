import { describe, it, expect } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { WUNDERKIND_CANONICAL_MANIFEST } from "../../src/agents/canonical-manifest.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readVersion(fileUrl: URL): string {
  const parsed: unknown = JSON.parse(readFileSync(fileUrl, "utf8"))

  if (!isRecord(parsed) || typeof parsed.version !== "string") {
    throw new Error(`Expected a JSON object with a string version in ${fileUrl.pathname}`)
  }

  return parsed.version
}

function readText(fileUrl: URL): string {
  return readFileSync(fileUrl, "utf8")
}

function readPackageJson(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readText(new URL("../../package.json", import.meta.url)))

  if (!isRecord(parsed)) {
    throw new Error("Expected package.json to be a JSON object")
  }

  return parsed
}

function getPublicSkillInventoryCounts(): {
  readonly promoted: number
  readonly wunderkindSpecific: number
  readonly deprecated: number
  readonly publicDeprecatedTotal: number
} {
  let promoted = 0
  let wunderkindSpecific = 0
  let deprecated = 0

  for (const skill of WUNDERKIND_CANONICAL_MANIFEST.skills) {
    if (skill.bucket === "promoted") promoted += 1
    if (skill.bucket === "wunderkind-specific") wunderkindSpecific += 1
    if (skill.bucket === "deprecated") deprecated += 1
  }

  return {
    promoted,
    wunderkindSpecific,
    deprecated,
    publicDeprecatedTotal: promoted + wunderkindSpecific + deprecated,
  }
}

describe("manifest version sync", () => {
  it("keeps package and Claude plugin manifests in sync", () => {
    const packageVersion = readVersion(new URL("../../package.json", import.meta.url))
    const pluginVersion = readVersion(new URL("../../.claude-plugin/plugin.json", import.meta.url))

    expect(packageVersion.length).toBeGreaterThan(0)
    expect(pluginVersion.length).toBeGreaterThan(0)
    expect(pluginVersion).toBe(packageVersion)
  })

  it("keeps the plugin manifest in the minimal currently-supported shape", () => {
    const pluginManifest = JSON.parse(readText(new URL("../../.claude-plugin/plugin.json", import.meta.url))) as unknown

    expect(isRecord(pluginManifest)).toBe(true)
    if (!isRecord(pluginManifest)) {
      throw new Error("Expected plugin manifest to be a record")
    }

    expect(Object.keys(pluginManifest).sort()).toEqual(["description", "main", "name", "version"])
    expect(pluginManifest.name).toBe("wunderkind")
    expect(pluginManifest.main).toBe("dist/index.js")

    const version = pluginManifest.version
    const description = pluginManifest.description

    expect(typeof version).toBe("string")
    expect(typeof description).toBe("string")
    if (typeof version !== "string" || typeof description !== "string") {
      throw new Error("Expected plugin manifest version and description to be strings")
    }

    expect(version.length).toBeGreaterThan(0)
    expect(description.length).toBeGreaterThan(0)
  })

  it("keeps package metadata aligned with the six retained-agent product surface", () => {
    const packageBody = readText(new URL("../../package.json", import.meta.url))

    expect(packageBody).toContain("6 retained specialist agents")
    expect(packageBody).not.toContain("12 professional agents")
  })

  it("keeps the release dependency pins aligned with the canonical upstream baseline", () => {
    const packageJson = readPackageJson()
    const dependencies = packageJson.dependencies

    expect(isRecord(dependencies)).toBe(true)
    if (!isRecord(dependencies)) {
      throw new Error("Expected package.json dependencies to be a record")
    }

    expect(packageJson.version).toBe(WUNDERKIND_CANONICAL_MANIFEST.package.version)
    expect(dependencies["@opencode-ai/plugin"]).toBe("1.18.18")
    expect(dependencies["@opencode-ai/sdk"]).toBe("1.18.18")
    expect(dependencies["oh-my-openagent"]).toBe(WUNDERKIND_CANONICAL_MANIFEST.nativeAssets.upstream.omoTargetVersion)
  })

  it("keeps the canonical public inventory counts aligned with the 28-route repo surface", () => {
    expect(getPublicSkillInventoryCounts()).toEqual({
      promoted: 23,
      wunderkindSpecific: 4,
      deprecated: 1,
      publicDeprecatedTotal: 28,
    })
  })

  it("keeps README release notes aligned with the 0.27.1 stable baseline and current Codex edition", () => {
    const readmeBody = readText(new URL("../../README.md", import.meta.url))

    expect(readmeBody).not.toContain("## Unreleased")
    expect(readmeBody).toContain("## What's new in 0.27.1")
    expect(readmeBody).toContain("stale unreleased/local Codex edition wording")
    expect(readmeBody).toContain("@opencode-ai/plugin@1.18.18")
    expect(readmeBody).toContain("@opencode-ai/sdk@1.18.18")
    expect(readmeBody).toContain("oh-my-openagent@4.19.4")
    expect(readmeBody).toContain("release-upgrade")
    expect(readmeBody).toContain("platform-compatibility")
    expect(readmeBody).toContain("supportability-review")
    expect(readmeBody).toContain("public/deprecated total=28")
  })
})

describe("design-md command asset", () => {
  const commandFile = new URL("../../commands/design-md.md", import.meta.url)
  const docsIndexFile = new URL("../../commands/docs-index.md", import.meta.url)
  const docsReadmeFile = new URL("../../docs/README.md", import.meta.url)
  const workflowSyncFile = new URL("../../commands/workflow-sync.md", import.meta.url)
  const tokenAuditFile = new URL("../../commands/token-audit.md", import.meta.url)
  const wunderkindTeamFile = new URL("../../commands/wunderkind-team.md", import.meta.url)

  it("exists as a file", () => {
    expect(statSync(commandFile).isFile()).toBe(true)
  })

  it("keeps both shipped command assets covered by package publishing", () => {
    const packageJson = JSON.parse(readText(new URL("../../package.json", import.meta.url))) as {
      files?: unknown
    }

    expect(Array.isArray(packageJson.files)).toBe(true)
      expect(packageJson.files).toContain("commands/")
      expect(statSync(commandFile).isFile()).toBe(true)
      expect(statSync(docsIndexFile).isFile()).toBe(true)
      expect(statSync(workflowSyncFile).isFile()).toBe(true)
      expect(statSync(tokenAuditFile).isFile()).toBe(true)
      expect(statSync(wunderkindTeamFile).isFile()).toBe(true)
  })

  it("declares the creative-director owner in frontmatter", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).toContain("agent: creative-director")
    expect(commandBody).toContain("name: design-md")
  })

  it("references only the supported modes", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).toContain("`new`")
    expect(commandBody).toContain("`capture-existing`")
    expect(commandBody).not.toContain("`refresh`")
    expect(commandBody).not.toContain("`update`")
  })

  it("avoids slash-sync language and two-way round-trip promises", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).not.toContain("/sync")
    expect(commandBody).not.toContain("bi-directional")
    expect(commandBody).not.toContain("two-way")
    expect(commandBody).not.toContain("round-trip")
  })

  it("writes the capture-existing companion inside .wunderkind/stitch", () => {
    const commandBody = readText(commandFile)

    expect(commandBody).toContain(".wunderkind/stitch/source-assets.md")
  })

  it("preserves the shipped docs-index command asset assertions", () => {
    const docsIndexBody = readText(docsIndexFile)

    expect(docsIndexBody).toContain("/docs-index")
    expect(docsIndexBody).toContain("agent: product-wunderkind")
  })

  it("ships workflow-sync as a product-owned static command asset", () => {
    const workflowSyncBody = readText(workflowSyncFile)

    expect(workflowSyncBody).toContain("agent: product-wunderkind")
    expect(workflowSyncBody).toContain("name: workflow-sync")
    expect(workflowSyncBody).toContain("`bunx @grant-vine/wunderkind workflow-sync --plan <path> [--apply]`")
    expect(workflowSyncBody).toContain("`bunx @grant-vine/wunderkind workflow-sync --all [--apply]`")
    expect(workflowSyncBody).toContain(".wunderkind/workflows/github-issues/")
  })

  it("ships token-audit as a fullstack-owned static command asset", () => {
    const tokenAuditBody = readText(tokenAuditFile)

    expect(tokenAuditBody).toContain("agent: fullstack-wunderkind")
    expect(tokenAuditBody).toContain("name: token-audit")
    expect(tokenAuditBody).toContain("audit-only, read-only prompt-surface measurement")
    expect(tokenAuditBody).toContain("`bunx @grant-vine/wunderkind token-audit [--surface <surface>] [--format <format>]`")
    expect(tokenAuditBody).toContain("bytes, lines, and file counts")
    expect(tokenAuditBody).toContain("audit-only prompt-surface report")
    expect(tokenAuditBody).toContain("no live prompt packing")
    expect(tokenAuditBody).toContain("no model-token truth claims")
    expect(tokenAuditBody).toContain("supplementary prompt optimization engine")
    expect(tokenAuditBody).toContain("config-driven")
    expect(tokenAuditBody).toContain("multi-level")
    expect(tokenAuditBody).toContain("`latest-user`, `runtime-and-tools`, `contextual`, and `transcript`")
    expect(tokenAuditBody).toContain("runtime reports only")
    expect(tokenAuditBody).toContain("No persistent cross-session memory writes or automatic context injection")
  })

  it("keeps README and docs wording aligned around audit-only token-audit versus the supplementary engine", () => {
    const readmeBody = readText(new URL("../../README.md", import.meta.url))
    const docsReadmeBody = readText(docsReadmeFile)

    expect(readmeBody).toContain("default-off multi-level prompt optimization engine")
    expect(readmeBody).toContain("no public optimize command")
    expect(readmeBody).toContain("separate from `wunderkind token-audit`")
    expect(readmeBody).toContain("security-safe baseline")
    expect(readmeBody).toContain("sanitized/redacted latest-report artifacts or summaries")
    expect(readmeBody).toContain("separate runtime-report surface")
    expect(readmeBody).toContain("Breaking change (pre-v1)")
    expect(readmeBody).toContain("no persistent cross-session memory writes")
    expect(readmeBody).toContain("no automatic context injection")
    expect(readmeBody).not.toContain("configured `500000`-byte budget")

    expect(docsReadmeBody).toContain("default-off multi-level prompt optimization engine")
    expect(docsReadmeBody).toContain("token-audit")
    expect(docsReadmeBody).toContain("audit-only")
    expect(docsReadmeBody).toContain("security-safe baseline")
    expect(docsReadmeBody).toContain("sanitized/redacted latest-report artifacts or summaries")
    expect(docsReadmeBody).toContain("separate runtime-report surface")
    expect(docsReadmeBody).toContain("no persistent cross-session memory writes")
    expect(docsReadmeBody).toContain("no automatic context injection")
  })

  it("documents sparse default-off guidance, promptOptimizationReportingMode, and the latest runtime-report artifact paths", () => {
    const readmeBody = readText(new URL("../../README.md", import.meta.url))
    const docsReadmeBody = readText(docsReadmeFile)
    const schemaBody = readText(new URL("../../schemas/wunderkind.config.schema.json", import.meta.url))

    expect(readmeBody).toContain("Omit all promptOptimization* keys unless you are intentionally opting in.")
    expect(readmeBody).toContain('"promptOptimizationReportingMode": "summary"')
    expect(readmeBody).toContain("`off`, `persist`, and `summary`")
    expect(readmeBody).toContain(".wunderkind/runtime/prompt-optimization/system-transform.latest.json")
    expect(readmeBody).toContain(".wunderkind/runtime/prompt-optimization/session-compacting.latest.json")

    expect(docsReadmeBody).toContain("promptOptimizationReportingMode")
    expect(docsReadmeBody).toContain("system-transform.latest.json")
    expect(docsReadmeBody).toContain("session-compacting.latest.json")
    expect(docsReadmeBody).toContain("redacted")

    expect(schemaBody).toContain('"promptOptimizationReportingMode"')
    expect(schemaBody).toContain('"enum": ["off", "persist", "summary"]')
    expect(schemaBody).toContain("sanitized/redacted latest-report artifacts or summaries")
    expect(schemaBody).toContain("audit-only token-audit surface")
  })

  it("keeps the docs index aligned with the final OpenCode release reference", () => {
    const docsReadmeBody = readText(docsReadmeFile)

    expect(docsReadmeBody).toContain("https://github.com/anomalyco/opencode/releases/tag/v1.18.18")
    expect(docsReadmeBody).not.toContain("https://github.com/anomalyco/opencode/releases/tag/v1.18.7")
    expect(docsReadmeBody).not.toContain("https://github.com/sst/opencode/releases/tag/v1.18.18")
  })

  it("ships wunderkind-team as a product-owned static command asset with canonical fallback guidance", () => {
    const wunderkindTeamBody = readText(wunderkindTeamFile)

    expect(wunderkindTeamBody).toContain("agent: product-wunderkind")
    expect(wunderkindTeamBody).toContain("name: wunderkind-team")
    expect(wunderkindTeamBody).toContain("What do you want to do today?")
    expect(wunderkindTeamBody).toContain("team_mode.enabled")
    expect(wunderkindTeamBody).toContain("oh-my-openagent.jsonc")
    expect(wunderkindTeamBody).toContain("oh-my-openagent.json")
    expect(wunderkindTeamBody).toContain("missing team spec")
    expect(wunderkindTeamBody).toContain("solo `product-wunderkind` orchestration")
  })
})
