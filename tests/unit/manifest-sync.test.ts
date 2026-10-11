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

function readUpgradeContract(markdown: string): Record<string, unknown> {
  const match = markdown.match(/<!-- wunderkind:upgrade-contract\n([\s\S]*?)\n-->/)

  if (match?.[1] === undefined) {
    throw new Error("Expected a structured upgrade contract in docs/upgrading.md")
  }

  const parsed: unknown = JSON.parse(match[1])
  if (!isRecord(parsed)) {
    throw new Error("Expected the structured upgrade contract to be an object")
  }

  return parsed
}

function hasStringField(record: Record<string, unknown>, key: string, expected: string): boolean {
  return record[key] === expected
}

function isCurrentUpgradeContract(contract: Record<string, unknown>): boolean {
  const openCode = contract.openCode
  const runtime = contract.runtime
  const models = contract.models
  const comparison = contract.comparison
  const rejectedRoutes = contract.rejectedRoutes

  return hasStringField(contract, "candidate", WUNDERKIND_CANONICAL_MANIFEST.package.version)
    && hasStringField(contract, "sourceCommit", "df863041f10028132b1e424e47a1a65783553865")
    && isRecord(comparison)
    && hasStringField(comparison, "version", "0.27.9")
    && hasStringField(comparison, "commit", "d2d8aa581f0a30edf5f8733f7a422efc7c8c41ec")
    && isRecord(openCode)
    && hasStringField(openCode, "plugin", "1.18.35")
    && hasStringField(openCode, "sdk", "1.18.35")
    && hasStringField(contract, "omo", "5.1.29")
    && isRecord(runtime)
    && hasStringField(runtime, "node", ">=22.12.0")
    && hasStringField(runtime, "bun", "1+")
    && isRecord(models)
    && hasStringField(models, "standard", "openai/gpt-6-sol")
    && hasStringField(models, "routine", "openai/gpt-6-luna")
    && hasStringField(contract, "astra", "opt-in")
    && contract.publicDeprecatedTotal === 28
    && Array.isArray(rejectedRoutes)
    && rejectedRoutes.length === 1
    && rejectedRoutes[0] === "supportability-incident"
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
    const pluginManifest: unknown = JSON.parse(readText(new URL("../../.claude-plugin/plugin.json", import.meta.url)))

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
    expect(dependencies["@opencode-ai/plugin"]).toBe("1.18.35")
    expect(dependencies["@opencode-ai/sdk"]).toBe("1.18.35")
    expect(dependencies["oh-my-openagent"]).toBe("5.1.29")
  })

  it("keeps the canonical public inventory counts aligned with the 28-route repo surface", () => {
    expect(getPublicSkillInventoryCounts()).toEqual({
      promoted: 23,
      wunderkindSpecific: 4,
      deprecated: 1,
      publicDeprecatedTotal: 28,
    })
  })

  it("keeps README release history and current compatibility candidate distinct", () => {
    const readmeBody = readText(new URL("../../README.md", import.meta.url))

    expect(readmeBody).not.toContain("## Unreleased")
    expect(readmeBody).toContain("## What's new in 0.28.2")
    expect(readmeBody).toContain("## Current compatibility baseline")
    expect(readmeBody).toContain("openai/gpt-6-sol")
    expect(readmeBody).toContain("openai/gpt-6-luna")
    expect(readmeBody).toContain("release-upgrade")
    expect(readmeBody).toContain("platform-compatibility")
    expect(readmeBody).toContain("supportability-review")
    expect(readmeBody).toContain("public/deprecated total=28")
  })

  it("rejects stale upgrade-contract fixtures while accepting the current structured contract", () => {
    const upgradeBody = readText(new URL("../../docs/upgrading.md", import.meta.url))
    const contract = readUpgradeContract(upgradeBody)
    expect(isCurrentUpgradeContract(contract)).toBe(true)

    const stalePluginFixture = upgradeBody.replace('"plugin":"1.18.35"', '"plugin":"1.18.33"')
    const staleOmoFixture = upgradeBody.replace('"omo":"5.1.29"', '"omo":"5.0.0-beta.86"')
    const unsupportedRouteFixture = upgradeBody
      .replace('"astra":"opt-in"', '"astra":"default"')
      .replace('"supportability-incident"', '"supportability-review"')

    expect(isCurrentUpgradeContract(readUpgradeContract(stalePluginFixture))).toBe(false)
    expect(isCurrentUpgradeContract(readUpgradeContract(staleOmoFixture))).toBe(false)
    expect(isCurrentUpgradeContract(readUpgradeContract(unsupportedRouteFixture))).toBe(false)
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
    expect(tokenAuditBody).toContain("Project memory is separately opt-in")
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
    expect(readmeBody).toContain("opt-in project memory remains separate")
    expect(readmeBody).not.toContain("configured `500000`-byte budget")

    expect(docsReadmeBody).toContain("default-off multi-level prompt optimization engine")
    expect(docsReadmeBody).toContain("token-audit")
    expect(docsReadmeBody).toContain("audit-only")
    expect(docsReadmeBody).toContain("security-safe baseline")
    expect(docsReadmeBody).toContain("sanitized/redacted latest-report artifacts or summaries")
    expect(docsReadmeBody).toContain("separate runtime-report surface")
    expect(docsReadmeBody).toContain("Project memory is a separate, default-off local capability")
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

  it("keeps the hybrid memory contract synchronized across public docs and generated agent source", () => {
    const readmeBody = readText(new URL("../../README.md", import.meta.url))
    const docsReadmeBody = readText(docsReadmeFile)
    const sharedPromptBody = readText(new URL("../../src/agents/shared-prompt-sections.ts", import.meta.url))

    expect(readmeBody).toMatch(/### Opt-in hybrid project memory[\s\S]+SQLite\/WAL ledger at `\.wunderkind\/memory\.sqlite`/u)
    expect(readmeBody).toMatch(/`memory\.enabled`, `memory\.captureEnabled`, and `memory\.injectionEnabled` all default to `false`/u)
    expect(readmeBody).toMatch(/`memory start` and `memory stop` are the explicit local worker lifecycle/u)
    expect(readmeBody).toMatch(/Query-aware context injection is separately enabled[\s\S]+fail-closed/u)
    expect(readmeBody).toMatch(/redaction precedes every downstream interface[\s\S]+non-rebuild tombstones[\s\S]+never raw excerpts/u)
    expect(readmeBody).toMatch(/Jev\/Kev are eval-only interfaces, not installed providers/u)
    expect(readmeBody).toMatch(/`wunderkind migrate` migrates legacy OMO configuration[\s\S]+does not import memory ledgers/u)
    expect(docsReadmeBody).toMatch(/project-scoped SQLite\/WAL ledger[\s\S]+explicit `memory start` \/ `memory stop` lifecycle/u)
    expect(sharedPromptBody).toMatch(/project-scoped SQLite\/WAL ledger[\s\S]+Jev\/Kev are eval-only interfaces/u)
  })

  it("keeps the docs index aligned with the final OpenCode release reference", () => {
    const docsReadmeBody = readText(docsReadmeFile)

    expect(docsReadmeBody).toContain("https://github.com/anomalyco/opencode/releases/tag/v1.18.32")
    expect(docsReadmeBody).not.toContain("https://github.com/anomalyco/opencode/releases/tag/v1.18.7")
    expect(docsReadmeBody).not.toContain("https://github.com/sst/opencode/releases/tag/v1.18.32")
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
