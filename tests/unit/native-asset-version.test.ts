import { afterEach, describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

type ConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CACHE_BUST = Date.now()
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?native-asset-version=${CACHE_BUST}`

async function importConfigManager(): Promise<ConfigManagerModule> {
  return import(CONFIG_MANAGER_MODULE_URL) as Promise<ConfigManagerModule>
}

describe("native asset version markers", () => {
  let sandbox: string | null = null

  afterEach(async () => {
    const mod = await importConfigManager()
    mod.__resetConfigManagerPathOverrideForTests()
    if (sandbox) {
      rmSync(sandbox, { recursive: true, force: true })
      sandbox = null
    }
  })

  it("writes and detects version markers for native assets", async () => {
    const mod = await importConfigManager()

    sandbox = mkdtempSync(join(tmpdir(), "wk-native-assets-"))
    mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox, home: sandbox })

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
