import { describe, expect, it } from "bun:test"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

type ConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CACHE_BUST = Date.now()
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?native-asset-version=${CACHE_BUST}`

async function importConfigManager(): Promise<ConfigManagerModule> {
  return import(CONFIG_MANAGER_MODULE_URL) as Promise<ConfigManagerModule>
}

async function withSandbox(
  prefix: string,
  callback: (sandbox: string, mod: ConfigManagerModule) => Promise<void> | void,
): Promise<void> {
  const sandbox = mkdtempSync(join(tmpdir(), prefix))
  const mod = await importConfigManager()

  mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox, home: sandbox })

  try {
    await callback(sandbox, mod)
  } finally {
    mod.__resetConfigManagerPathOverrideForTests()
    rmSync(sandbox, { recursive: true, force: true })
  }
}

describe("native asset version markers", () => {
  it("writes and detects version markers for native assets", async () => {
    await withSandbox("wk-native-assets-", async (_sandbox, mod) => {
      const agentWrite = mod.writeNativeAgentFiles("global")
      const commandWrite = mod.writeNativeCommandFiles()
      const skillWrite = mod.writeNativeSkillFiles("global")

      expect(agentWrite.success).toBe(true)
      expect(commandWrite.success).toBe(true)
      expect(skillWrite.success).toBe(true)

      const agentMarker = join(agentWrite.configPath, ".wunderkind-version.json")
      const commandMarker = join(commandWrite.configPath, ".wunderkind-version.json")
      const skillMarker = join(skillWrite.configPath, ".wunderkind-version.json")

      expect(existsSync(agentMarker)).toBe(true)
      expect(existsSync(commandMarker)).toBe(true)
      expect(existsSync(skillMarker)).toBe(true)

      const parsed = JSON.parse(readFileSync(agentMarker, "utf8")) as { version?: string; kind?: string }
      expect(typeof parsed.version).toBe("string")
      expect(parsed.kind).toBe("agents")
      expect(parsed).toHaveProperty("files")

      const versions = [
        mod.detectNativeAssetVersion("agents"),
        mod.detectNativeAssetVersion("commands"),
        mod.detectNativeAssetVersion("skills"),
      ]

      for (const versionInfo of versions) {
        expect(versionInfo.markerPresent).toBe(true)
        expect(versionInfo.installedVersion).toBe(versionInfo.currentVersion)
        expect(versionInfo.needsUpgrade).toBe(false)
        expect(versionInfo.ownership).toBe("wunderkind-owned")
      }

      const agentMarkdownVersions = mod.detectNativeAgentMarkdownVersions("global")
      expect(agentMarkdownVersions.allCurrent).toBe(true)
      expect(agentMarkdownVersions.staleAgentIds).toEqual([])
      expect(agentMarkdownVersions.agents.every((agent) => !agent.filePresent || agent.matchesCurrent)).toBe(true)
    })
  })

  it("flags stale native asset version markers as needing upgrade", async () => {
    await withSandbox("wk-native-assets-stale-marker-", async (_sandbox, mod) => {
      const agentWrite = mod.writeNativeAgentFiles("global")
      expect(agentWrite.success).toBe(true)

      const agentMarker = join(agentWrite.configPath, ".wunderkind-version.json")
      writeFileSync(
        agentMarker,
        `${JSON.stringify({
          package: "@grant-vine/wunderkind",
          kind: "agents",
          version: "0.0.0",
          writtenAt: "2026-07-15T00:00:00.000Z",
        }, null, 2)}\n`,
        "utf-8",
      )

      const versionInfo = mod.detectNativeAssetVersion("agents")
      expect(versionInfo.markerPresent).toBe(true)
      expect(versionInfo.installedVersion).toBe(null)
      expect(versionInfo.needsUpgrade).toBe(true)
      expect(versionInfo.ownership).toBe("unknown")
    })
  })

  it("flags stale and missing generated agent markdown versions", async () => {
    await withSandbox("wk-native-assets-stale-markdown-", async (_sandbox, mod) => {
      const agentWrite = mod.writeNativeAgentFiles("global")
      expect(agentWrite.success).toBe(true)

      const marketingPath = join(agentWrite.configPath, "marketing-wunderkind.md")
      const cisoPath = join(agentWrite.configPath, "ciso.md")
      const marketingMarkdown = readFileSync(marketingPath, "utf-8")
      const cisoMarkdown = readFileSync(cisoPath, "utf-8")

      writeFileSync(marketingPath, marketingMarkdown.replace(/wunderkind_version: ".*"/, 'wunderkind_version: "0.0.0"'), "utf-8")
      writeFileSync(cisoPath, cisoMarkdown.replace(/^wunderkind_version: ".*"\n/m, ""), "utf-8")

      const versionInfo = mod.detectNativeAgentMarkdownVersions("global")
      expect(versionInfo.allCurrent).toBe(false)
      expect(versionInfo.staleAgentIds.sort()).toEqual(["ciso", "marketing-wunderkind"])
      expect(versionInfo.missingVersionAgentIds).toEqual(["ciso"])
    })
  })

  it("preserves modified catalog files and unowned command files during refresh", async () => {
    await withSandbox("wk-native-assets-preserve-user", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      const commands = mod.writeNativeCommandFiles()
      expect(agents.success).toBe(true)
      expect(commands.success).toBe(true)

      const agentPath = join(agents.configPath, "product-wunderkind.md")
      const unownedCommandPath = join(commands.configPath, "user-command.md")
      writeFileSync(agentPath, "user-edited agent\n", "utf8")
      writeFileSync(unownedCommandPath, "user-owned command\n", "utf8")

      expect(mod.writeNativeAgentFiles("global").success).toBe(true)
      expect(mod.writeNativeCommandFiles().success).toBe(true)
      expect(readFileSync(agentPath, "utf8")).toBe("user-edited agent\n")
      expect(readFileSync(unownedCommandPath, "utf8")).toBe("user-owned command\n")
    })
  })

  it("rejects malformed, foreign, unsafe, and symlink receipts", async () => {
    await withSandbox("wk-native-assets-invalid-receipt-", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      expect(agents.success).toBe(true)
      const marker = join(agents.configPath, ".wunderkind-version.json")
      const valid = JSON.parse(readFileSync(marker, "utf8")) as Record<string, unknown>
      for (const receipt of [
        { ...valid, package: "foreign" },
        { ...valid, kind: "commands" },
        { ...valid, files: { "../outside.md": "a".repeat(64) } },
      ]) {
        writeFileSync(marker, JSON.stringify(receipt), "utf8")
        expect(mod.detectNativeAssetVersion("agents").ownership).toBe("unknown")
      }
      const foreignMarker = join(_sandbox, "foreign-marker.json")
      writeFileSync(foreignMarker, readFileSync(marker, "utf8"), "utf8")
      rmSync(marker)
      symlinkSync(foreignMarker, marker)
      expect(mod.detectNativeAssetVersion("agents").ownership).toBe("unknown")
    })
  })

  it("does not authorize a malformed partial receipt to replace an edited asset", async () => {
    await withSandbox("wk-native-assets-partial-receipt-", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      expect(agents.success).toBe(true)

      const marker = join(agents.configPath, ".wunderkind-version.json")
      const valid = JSON.parse(readFileSync(marker, "utf8")) as { files: Record<string, string> }
      const agentPath = join(agents.configPath, "product-wunderkind.md")
      writeFileSync(agentPath, "operator partial-receipt hold\n", "utf8")
      writeFileSync(
        marker,
        JSON.stringify({
          package: "@grant-vine/wunderkind",
          kind: "agents",
          version: "0.28.3",
          files: { ...valid.files, "../outside.md": "a".repeat(64) },
        }),
        "utf8",
      )

      expect(mod.writeNativeAgentFiles("global").success).toBe(true)
      expect(readFileSync(agentPath, "utf8")).toBe("operator partial-receipt hold\n")
      const versionInfo = mod.detectNativeAssetVersion("agents")
      expect(versionInfo.ownership).toBe("mixed")
      expect(versionInfo.needsUpgrade).toBe(true)
    })
  })

  it("does not report a current receipt as fully owned when a managed asset is missing", async () => {
    await withSandbox("wk-native-assets-missing-managed-", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      expect(agents.success).toBe(true)
      rmSync(join(agents.configPath, "product-wunderkind.md"))

      const missing = mod.detectNativeAssetVersion("agents")
      expect(missing.installedVersion).toBe(missing.currentVersion)
      expect(missing.ownership).toBe("mixed")
      expect(missing.needsUpgrade).toBe(true)

      expect(mod.writeNativeAgentFiles("global").success).toBe(true)
      const restored = mod.detectNativeAssetVersion("agents")
      expect(restored.ownership).toBe("wunderkind-owned")
      expect(restored.needsUpgrade).toBe(false)
    })
  })

  it("refuses symlinked receipt and asset paths without changing external targets", async () => {
    await withSandbox("wk-native-assets-symlink-hold-", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      expect(agents.success).toBe(true)

      const marker = join(agents.configPath, ".wunderkind-version.json")
      const markerTarget = join(_sandbox, "marker-target.txt")
      writeFileSync(markerTarget, "external marker sentinel\n", "utf8")
      rmSync(marker)
      symlinkSync(markerTarget, marker)

      const markerResult = mod.writeNativeAgentFiles("global")
      expect(markerResult.success).toBe(false)
      expect(markerResult.error).toContain("symbolic link")
      expect(readFileSync(markerTarget, "utf8")).toBe("external marker sentinel\n")
      expect(lstatSync(marker).isSymbolicLink()).toBe(true)
      expect(mod.detectNativeAssetVersion("agents").ownership).toBe("unknown")

      rmSync(marker)
      const restored = mod.writeNativeAgentFiles("global")
      expect(restored.success).toBe(true)
      const agentPath = join(agents.configPath, "product-wunderkind.md")
      const agentTarget = join(_sandbox, "agent-target.md")
      writeFileSync(agentTarget, "external agent sentinel\n", "utf8")
      rmSync(agentPath)
      symlinkSync(agentTarget, agentPath)

      const assetResult = mod.writeNativeAgentFiles("global")
      expect(assetResult.success).toBe(false)
      expect(assetResult.error).toContain("symbolic link")
      expect(readFileSync(agentTarget, "utf8")).toBe("external agent sentinel\n")
      expect(lstatSync(agentPath).isSymbolicLink()).toBe(true)
      expect(mod.detectNativeAssetVersion("agents").ownership).toBe("unknown")
    })
  })

  it("refuses symlinked asset roots and skill parents without changing external directories", async () => {
    await withSandbox("wk-native-assets-symlink-directory-", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      const skills = mod.writeNativeSkillFiles("global")
      expect(agents.success).toBe(true)
      expect(skills.success).toBe(true)

      const externalRoot = join(_sandbox, "external-agents")
      mkdirSync(externalRoot)
      const rootSentinel = join(externalRoot, "sentinel.txt")
      writeFileSync(rootSentinel, "external root sentinel\n", "utf8")
      rmSync(agents.configPath, { recursive: true })
      symlinkSync(externalRoot, agents.configPath, "dir")

      const rootResult = mod.writeNativeAgentFiles("global")
      expect(rootResult.success).toBe(false)
      expect(rootResult.error).toContain("symbolic link")
      expect(readFileSync(rootSentinel, "utf8")).toBe("external root sentinel\n")
      expect(lstatSync(agents.configPath).isSymbolicLink()).toBe(true)

      const skillParent = join(skills.configPath, "release-upgrade")
      const externalSkillParent = join(_sandbox, "external-skill-parent")
      mkdirSync(externalSkillParent)
      const parentSentinel = join(externalSkillParent, "SKILL.md")
      writeFileSync(parentSentinel, "external skill sentinel\n", "utf8")
      rmSync(skillParent, { recursive: true })
      symlinkSync(externalSkillParent, skillParent, "dir")

      const parentResult = mod.writeNativeSkillFiles("global")
      expect(parentResult.success).toBe(false)
      expect(parentResult.error).toContain("symbolic link")
      expect(readFileSync(parentSentinel, "utf8")).toBe("external skill sentinel\n")
      expect(lstatSync(skillParent).isSymbolicLink()).toBe(true)
      expect(mod.detectNativeAssetVersion("skills").ownership).toBe("unknown")
    })
  })

  it("reports mixed ownership when an edited managed asset is preserved", async () => {
    await withSandbox("wk-native-assets-mixed-", async (_sandbox, mod) => {
      const agents = mod.writeNativeAgentFiles("global")
      expect(agents.success).toBe(true)
      writeFileSync(join(agents.configPath, "product-wunderkind.md"), "user edit\n", "utf8")
      expect(mod.writeNativeAgentFiles("global").success).toBe(true)
      expect(mod.detectNativeAssetVersion("agents").ownership).toBe("mixed")
    })
  })
})
