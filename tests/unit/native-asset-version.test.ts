import { describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

      const versions = [
        mod.detectNativeAssetVersion("agents"),
        mod.detectNativeAssetVersion("commands"),
        mod.detectNativeAssetVersion("skills"),
      ]

      for (const versionInfo of versions) {
        expect(versionInfo.markerPresent).toBe(true)
        expect(versionInfo.installedVersion).toBe(versionInfo.currentVersion)
        expect(versionInfo.needsUpgrade).toBe(false)
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
      expect(versionInfo.installedVersion).toBe("0.0.0")
      expect(versionInfo.needsUpgrade).toBe(true)
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
})
