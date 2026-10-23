import { describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  MEMORY_AUTOMATIC_CAPTURE_CONTRACT,
  MEMORY_CLI_GRAMMAR,
} from "../../src/cli/memory-contract.js"

type ConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")
const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CACHE_BUST = Date.now()
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?memory-contract=${CACHE_BUST}`

let configManagerPromise: Promise<ConfigManagerModule> | null = null

async function importConfigManager(): Promise<ConfigManagerModule> {
  configManagerPromise ??= import(CONFIG_MANAGER_MODULE_URL) as Promise<ConfigManagerModule>
  return configManagerPromise
}

async function withSandbox(
  assertion: (input: {
    home: string
    project: string
    writeProjectConfig: (memory: unknown) => void
    configManager: ConfigManagerModule
  }) => Promise<void> | void,
): Promise<void> {
  const sandbox = mkdtempSync(join(tmpdir(), "wk-memory-contract-"))
  const home = join(sandbox, "home")
  const project = join(sandbox, "project")
  const writeProjectConfig = (memory: unknown): void => {
    mkdirSync(join(project, ".wunderkind"), { recursive: true })
    mkdirSync(project, { recursive: true })
    writeFileSync(join(project, "opencode.json"), JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
    writeFileSync(join(project, ".wunderkind", "wunderkind.config.jsonc"), JSON.stringify({ memory }))
  }

  try {
    const configManager = await importConfigManager()
    await assertion({ home, project, writeProjectConfig, configManager })
  } finally {
    const configManager = await importConfigManager()
    configManager.__resetConfigManagerPathOverrideForTests()
    rmSync(sandbox, { recursive: true, force: true })
  }
}

describe("memory contract", () => {
  it("defaults every enabled surface off and exposes the fixed bounded Ollama policy", async () => {
    await withSandbox(({ home, project, configManager }) => {
      mkdirSync(project, { recursive: true })
      configManager.__setConfigManagerPathOverrideForTests({ cwd: project, home })
      const detected = configManager.detectCurrentConfig()
      expect(detected.memory.enabled).toBe(false)
      expect(detected.memory.captureEnabled).toBe(false)
      expect(detected.memory.injectionEnabled).toBe(false)
      expect(detected.memory.extraction.provider).toBe("ollama")
      expect(detected.memory.extraction.ollama).toEqual({
        baseUrl: "http://127.0.0.1:11434",
        timeoutMs: 5000,
        enqueueTimeoutMs: 75,
        maxQueue: 64,
        maxResponseBytes: 32768,
      })
    })
  })

  it("rejects capture or injection without enabled, non-loopback providers, and automatic capture without a model", async () => {
    await withSandbox(({ home, project, writeProjectConfig, configManager }) => {
      writeProjectConfig({ enabled: false, captureEnabled: true })
      configManager.__setConfigManagerPathOverrideForTests({ cwd: project, home })
      expect(configManager.detectCurrentConfig().memoryConfigError).toContain("enabled")
      writeProjectConfig({ enabled: true, injectionEnabled: true, extraction: { ollama: { baseUrl: "http://example.test:11434" } } })
      expect(configManager.detectCurrentConfig().memoryConfigError).toContain("loopback")
      writeProjectConfig({ enabled: true, injectionEnabled: true, extraction: { ollama: { baseUrl: "http://127.999.999.999:11434" } } })
      expect(configManager.detectCurrentConfig().memoryConfigError).toContain("loopback")
      writeProjectConfig({ enabled: true, captureEnabled: true })
      expect(configManager.detectCurrentConfig().memoryConfigError).toContain("model")
    })
  })

  it("requires a configured model for explicit capture even when automatic capture is disabled", async () => {
    await withSandbox(({ home, project, writeProjectConfig, configManager }) => {
      writeProjectConfig({ enabled: true, captureEnabled: false })
      configManager.__setConfigManagerPathOverrideForTests({ cwd: project, home })
      expect(configManager.getMemoryExplicitCaptureError(configManager.detectCurrentConfig().memory)).toContain("model")
    })
  })

  it("locks the version-proven host hook, manual CLI grammar, and cost-tier category mapping", () => {
    const installedPluginPackage = JSON.parse(
      readFileSync(new URL("../../node_modules/@opencode-ai/plugin/package.json", import.meta.url), "utf8"),
    ) as { version?: unknown }
    const installedPluginDeclaration = readFileSync(
      new URL("../../node_modules/@opencode-ai/plugin/dist/index.d.ts", import.meta.url),
      "utf8",
    )
    expect(installedPluginPackage.version).toBe("1.19.4")
    expect(installedPluginDeclaration).toContain('"chat.message"?: (input:')
    expect(MEMORY_AUTOMATIC_CAPTURE_CONTRACT).toEqual({
      mode: "chat.message",
      pluginVersion: "1.18.33",
      fallback: "memory capture",
    })
    expect(MEMORY_CLI_GRAMMAR).toEqual([
      "memory status --format json",
      "memory start",
      "memory stop",
      "memory capture --file <path> [--source-id <id>]",
      "memory recall --query <text> --format json",
      "memory rebuild views",
      "memory forget fact --id <fact-id>",
      "memory forget source --id <source-id>",
      "memory export --output <path> [--force]",
    ])

  })
})
