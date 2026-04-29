import { describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { collectGeneratedRetainedNativeCommands } from "../../src/agents/slash-commands.js"

type ConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")
const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
// Use a cache-busting query string so this file always gets the real module,
// even when other test files have registered a top-level mock for config-manager.
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?config-manager-coverage=${Date.now()}`

interface TestSandbox {
  rootDir: string
  homeDir: string
  projectDir: string
  globalConfigDir: string
  globalOpenCodePath: string
  globalWunderkindPath: string
  projectOpenCodePath: string
  projectConfigPath: string
}

function createSandbox(prefix: string): TestSandbox {
  const rootDir = mkdtempSync(join(tmpdir(), prefix))
  const homeDir = join(rootDir, "home")
  const projectDir = join(rootDir, "project")
  const globalConfigDir = join(homeDir, ".config", "opencode")

  mkdirSync(homeDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })

  return {
    rootDir,
    homeDir,
    projectDir,
    globalConfigDir,
    globalOpenCodePath: join(globalConfigDir, "opencode.json"),
    globalWunderkindPath: join(homeDir, ".wunderkind", "wunderkind.config.jsonc"),
    projectOpenCodePath: join(projectDir, "opencode.json"),
    projectConfigPath: join(projectDir, ".wunderkind", "wunderkind.config.jsonc"),
  }
}

function cleanupSandbox(sandbox: TestSandbox): void {
  rmSync(sandbox.rootDir, { recursive: true, force: true })
}

let configManagerPromise: Promise<ConfigManagerModule> | null = null

async function importConfigManager(): Promise<ConfigManagerModule> {
  configManagerPromise ??= import(CONFIG_MANAGER_MODULE_URL) as Promise<ConfigManagerModule>
  return configManagerPromise
}

function applySandboxPathOverride(mod: ConfigManagerModule, sandbox: TestSandbox): void {
  mod.__setConfigManagerPathOverrideForTests({
    cwd: sandbox.projectDir,
    home: sandbox.homeDir,
  })
}

async function withSandbox(
  label: string,
  callback: (sandbox: TestSandbox, mod: ConfigManagerModule) => Promise<void> | void,
): Promise<void> {
  const sandbox = createSandbox(`wk-config-manager-${label}-`)
  try {
    const mod = await importConfigManager()
    applySandboxPathOverride(mod, sandbox)
    await callback(sandbox, mod)
  } finally {
    const mod = await importConfigManager()
    mod.__resetConfigManagerPathOverrideForTests()
    cleanupSandbox(sandbox)
  }
}

describe("config-manager coverage", () => {
  it("returns cloned default configs", async () => {
    await withSandbox("defaults", async (_sandbox, mod) => {
      const install = mod.getDefaultInstallConfig()
      const globalConfig = mod.getDefaultGlobalConfig()
      const project = mod.getDefaultProjectConfig()

      expect(install.region).toBe("Global")
      expect(globalConfig.region).toBe("Global")
      expect(project.teamCulture).toBe("pragmatic-balanced")

      install.region = "Changed"
      expect(mod.getDefaultInstallConfig().region).toBe("Global")
    })
  })

  it("resolves cwd and home derived paths at call time", async () => {
    const firstSandbox = createSandbox("wk-config-manager-dynamic-first-")
    const secondSandbox = createSandbox("wk-config-manager-dynamic-second-")

    try {
      const mod = await importConfigManager()
      applySandboxPathOverride(mod, firstSandbox)

      expect(mod.resolveOpenCodeConfigPath("project")).toEqual({
        path: join(firstSandbox.projectDir, "opencode.json"),
        format: "none",
        source: "default",
      })
      expect(mod.resolveOpenCodeConfigPath("global")).toEqual({
        path: join(firstSandbox.homeDir, ".config", "opencode", "opencode.json"),
        format: "none",
        source: "default",
      })
      expect(mod.getNativeAgentDir()).toBe(join(firstSandbox.homeDir, ".config", "opencode", "agents"))
      expect(mod.getNativeCommandsDir()).toBe(join(firstSandbox.homeDir, ".config", "opencode", "commands"))
      expect(mod.getNativeSkillsDir()).toBe(join(firstSandbox.homeDir, ".config", "opencode", "skills"))
      expect(mod.detectLegacyConfig()).toBe(false)

      applySandboxPathOverride(mod, secondSandbox)
      writeFileSync(join(secondSandbox.projectDir, "wunderkind.config.jsonc"), "{}")

      expect(mod.resolveOpenCodeConfigPath("project")).toEqual({
        path: join(secondSandbox.projectDir, "opencode.json"),
        format: "none",
        source: "default",
      })
      expect(mod.resolveOpenCodeConfigPath("global")).toEqual({
        path: join(secondSandbox.homeDir, ".config", "opencode", "opencode.json"),
        format: "none",
        source: "default",
      })
      expect(mod.getNativeAgentDir()).toBe(join(secondSandbox.homeDir, ".config", "opencode", "agents"))
      expect(mod.getNativeCommandsDir()).toBe(join(secondSandbox.homeDir, ".config", "opencode", "commands"))
      expect(mod.getNativeSkillsDir()).toBe(join(secondSandbox.homeDir, ".config", "opencode", "skills"))
      expect(mod.detectLegacyConfig()).toBe(true)
    } finally {
      const mod = await importConfigManager()
      mod.__resetConfigManagerPathOverrideForTests()
      cleanupSandbox(firstSandbox)
      cleanupSandbox(secondSandbox)
    }
  })

  it("resolves project config paths by precedence", async () => {
    await withSandbox("project-precedence", async (sandbox, mod) => {
      const paths = [
        join(sandbox.projectDir, "opencode.json"),
        join(sandbox.projectDir, "opencode.jsonc"),
        join(sandbox.projectDir, "config.json"),
        join(sandbox.projectDir, "config.jsonc"),
      ]

      expect(mod.resolveOpenCodeConfigPath("project").source).toBe("default")

      writeFileSync(paths[3]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("project").source).toBe("config.jsonc")

      writeFileSync(paths[2]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("project").source).toBe("config.json")

      writeFileSync(paths[1]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("project").source).toBe("opencode.jsonc")

      writeFileSync(paths[0]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("project").source).toBe("opencode.json")
    })
  })

  it("resolves global config paths by precedence", async () => {
    await withSandbox("global-precedence", async (sandbox, mod) => {
      const paths = [
        join(sandbox.globalConfigDir, "opencode.json"),
        join(sandbox.globalConfigDir, "opencode.jsonc"),
        join(sandbox.globalConfigDir, "config.json"),
        join(sandbox.globalConfigDir, "config.jsonc"),
      ]

      mkdirSync(sandbox.globalConfigDir, { recursive: true })

      expect(mod.resolveOpenCodeConfigPath("global").source).toBe("default")

      writeFileSync(paths[3]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("global").source).toBe("config.jsonc")

      writeFileSync(paths[2]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("global").source).toBe("config.json")

      writeFileSync(paths[1]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("global").source).toBe("opencode.jsonc")

      writeFileSync(paths[0]!, "{}")
      expect(mod.resolveOpenCodeConfigPath("global").source).toBe("opencode.json")
    })
  })

  it("prefers canonical OMO config basenames with legacy fallback", async () => {
    await withSandbox("omo-config-precedence", async (sandbox, mod) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-openagent@3.12.2"] }))

      const canonicalJson = join(sandbox.globalConfigDir, "oh-my-openagent.json")
      const canonicalJsonc = join(sandbox.globalConfigDir, "oh-my-openagent.jsonc")
      const legacyJson = join(sandbox.globalConfigDir, "oh-my-opencode.json")
      const legacyJsonc = join(sandbox.globalConfigDir, "oh-my-opencode.jsonc")

      writeFileSync(legacyJsonc, JSON.stringify({ agents: {} }))
      expect(mod.detectOmoVersionInfo().configPath).toBe(legacyJsonc)
      expect(mod.detectOmoVersionInfo().registeredEntry).toBe("oh-my-openagent@3.12.2")

      writeFileSync(legacyJson, JSON.stringify({ agents: {} }))
      expect(mod.detectOmoVersionInfo().configPath).toBe(legacyJson)

      writeFileSync(canonicalJsonc, JSON.stringify({ agents: {} }))
      expect(mod.detectOmoVersionInfo().configPath).toBe(canonicalJsonc)

      writeFileSync(canonicalJson, JSON.stringify({ agents: {} }))
      expect(mod.detectOmoVersionInfo().configPath).toBe(canonicalJson)
    })
  })


  it("flags dual OMO config files when canonical and legacy basenames coexist", async () => {
    await withSandbox("omo-dual-config", async (sandbox, mod) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-openagent@latest"] }))

      const canonicalJsonc = join(sandbox.globalConfigDir, "oh-my-openagent.jsonc")
      const legacyJson = join(sandbox.globalConfigDir, "oh-my-opencode.json")
      writeFileSync(canonicalJsonc, JSON.stringify({ agents: {} }))
      writeFileSync(legacyJson, JSON.stringify({ agents: {} }))

      const info = mod.detectOmoVersionInfo()
      expect(info.configPath).toBe(canonicalJsonc)
      expect(info.configSource).toBe("oh-my-openagent.jsonc")
      expect(info.legacyConfigPath).toBe(legacyJson)
      expect(info.dualConfigWarning).toContain("canonical oh-my-openagent.jsonc is being used")
      expect(info.dualConfigWarning).toContain(legacyJson)
    })
  })

  it("adds and removes project plugin registrations across key cases", async () => {
    await withSandbox("project-plugin", async (sandbox, mod) => {
      expect(mod.addPluginToOpenCodeConfig("project").success).toBe(true)
      expect(existsSync(sandbox.projectOpenCodePath)).toBe(true)
      expect(readFileSync(sandbox.projectOpenCodePath, "utf-8")).toContain("@grant-vine/wunderkind")

      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["wunderkind@0.1.0"] }))
      expect(mod.addPluginToOpenCodeConfig("project").success).toBe(true)
      expect(readFileSync(sandbox.projectOpenCodePath, "utf-8")).toContain("@grant-vine/wunderkind")

      writeFileSync(sandbox.projectOpenCodePath, "[")
      expect(mod.removePluginFromOpenCodeConfig("project").success).toBe(false)

      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: [] }))
      expect(mod.removePluginFromOpenCodeConfig("project").changed).toBe(false)

      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["other-plugin", "wunderkind"] }))
      const removed = mod.removePluginFromOpenCodeConfig("project")
      expect(removed.success).toBe(true)
      expect(removed.changed).toBe(true)
      expect(readFileSync(sandbox.projectOpenCodePath, "utf-8")).toContain("other-plugin")
      expect(readFileSync(sandbox.projectOpenCodePath, "utf-8")).not.toContain("wunderkind")
    })
  })

  it("writes and reads layered Wunderkind config", async () => {
    await withSandbox("layered-config", async (sandbox, mod) => {
      expect(
        mod.writeGlobalWunderkindConfig({
          region: "Global Region",
          industry: "SaaS",
          primaryRegulation: "GDPR",
          secondaryRegulation: "",
        }).success,
      ).toBe(true)

      expect(
        mod.writeProjectWunderkindConfig({
          ...mod.getDefaultProjectConfig(),
          region: "Project Region",
          primaryRegulation: "POPIA",
        }).success,
      ).toBe(true)

      expect(existsSync(sandbox.globalWunderkindPath)).toBe(true)
      expect(existsSync(sandbox.projectConfigPath)).toBe(true)

      const merged = mod.readWunderkindConfig()
      expect(merged?.region).toBe("Project Region")
      expect(merged?.industry).toBe("SaaS")
      expect(merged?.primaryRegulation).toBe("POPIA")
      expect(merged?.docsEnabled).toBe(false)

      const projectOnly = mod.readProjectWunderkindConfig()
      expect(projectOnly?.teamCulture).toBe("pragmatic-balanced")
      expect(projectOnly).not.toHaveProperty("region")

      const scoped = mod.readWunderkindConfigForScope("project")
      expect(scoped?.region).toBe("Project Region")
      expect(scoped?.primaryRegulation).toBe("POPIA")
      expect(scoped?.teamCulture).toBe("pragmatic-balanced")
    })
  })

  it("returns null when neither global nor project config exists", async () => {
    await withSandbox("read-null-no-config", async (_sandbox, mod) => {
      expect(mod.readWunderkindConfig()).toBe(null)
    })
  })

  it("uses only project docs-output fields for effective merged docs settings", async () => {
    await withSandbox("read-project-docs-only", async (sandbox, mod) => {
      mkdirSync(join(sandbox.projectDir, ".wunderkind"), { recursive: true })
      mkdirSync(join(sandbox.homeDir, ".wunderkind"), { recursive: true })

      writeFileSync(
        sandbox.projectConfigPath,
        `{
  "docsEnabled": true,
  "docsPath": "./project-docs"
}`,
      )
      writeFileSync(
        sandbox.globalWunderkindPath,
        `{
  "docsEnabled": false,
  "docsPath": "./global-docs",
  "docHistoryMode": "append-dated"
}`,
      )

      expect(mod.readWunderkindConfig()).toEqual({
        docsEnabled: true,
        docsPath: "./project-docs",
      })
    })
  })

  it("detects current config from registration and layered files", async () => {
    await withSandbox("detect-current", async (sandbox, mod) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["wunderkind"] }))
      mkdirSync(join(sandbox.homeDir, ".wunderkind"), { recursive: true })
      writeFileSync(
        sandbox.globalWunderkindPath,
        `{
  "region": "Global Region",
  "industry": "Global Industry",
  "primaryRegulation": "GDPR",
  "teamCulture": "formal-strict"
}`,
      )
      mkdirSync(join(sandbox.projectDir, ".wunderkind"), { recursive: true })
      writeFileSync(
        sandbox.projectConfigPath,
        `{
  "region": "Project Region",
  "secondaryRegulation": "POPIA",
  "docsEnabled": true,
  "docsPath": "./project-docs"
}`,
      )

      const detected = mod.detectCurrentConfig()

      expect(detected.isInstalled).toBe(true)
      expect(detected.registrationScope).toBe("both")
      expect(detected.scope).toBe("project")
      expect(detected.region).toBe("Project Region")
      expect(detected.industry).toBe("Global Industry")
      expect(detected.primaryRegulation).toBe("GDPR")
      expect(detected.secondaryRegulation).toBe("POPIA")
      expect(detected.teamCulture).toBe("formal-strict")
      expect(detected.docsEnabled).toBe(true)
      expect(detected.docsPath).toBe("./project-docs")
    })
  })

  it("returns install defaults when no OpenCode registration or Wunderkind config exists", async () => {
    await withSandbox("detect-none", async (_sandbox, mod) => {
      const detected = mod.detectCurrentConfig()

      expect(detected.isInstalled).toBe(false)
      expect(detected.projectInstalled).toBe(false)
      expect(detected.globalInstalled).toBe(false)
      expect(detected.registrationScope).toBe("none")
      expect(detected.scope).toBe("global")
      expect(detected.projectOpenCodeConfigPath).toBe(mod.resolveOpenCodeConfigPath("project").path)
      expect(detected.globalOpenCodeConfigPath).toBe(mod.resolveOpenCodeConfigPath("global").path)
      expect(detected.region).toBe("Global")
      expect(detected.teamCulture).toBe("pragmatic-balanced")
      expect(detected.docsEnabled).toBe(false)
      expect(detected.prdPipelineMode).toBe("filesystem")
    })
  })

  it("detects plugin versions from registered entries and loaded package sources", async () => {
    await withSandbox("version-detection", async (sandbox, mod) => {
      const customPackagePath = join(sandbox.globalConfigDir, "node_modules", "custom-plugin", "package.json")
      const omoGlobalPackagePath = join(sandbox.globalConfigDir, "node_modules", "oh-my-openagent", "package.json")
      const omoCachePackagePath = join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-openagent", "package.json")

      mkdirSync(join(sandbox.globalConfigDir, "node_modules", "custom-plugin"), { recursive: true })
      mkdirSync(join(sandbox.globalConfigDir, "node_modules", "oh-my-openagent"), { recursive: true })
      mkdirSync(join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-openagent"), { recursive: true })

      writeFileSync(
        sandbox.globalOpenCodePath,
        JSON.stringify({ plugin: ["custom-plugin@1.2.3-beta.4", "oh-my-openagent@3.12.2"] }),
      )
      writeFileSync(customPackagePath, JSON.stringify({ version: "1.2.0" }))
      writeFileSync(omoGlobalPackagePath, JSON.stringify({ version: "3.12.2" }))
      writeFileSync(omoCachePackagePath, JSON.stringify({ version: "3.12.3" }))

      const pluginVersionInfo = mod.detectPluginVersionInfo("custom-plugin")
      expect(pluginVersionInfo.registered).toBe(true)
      expect(pluginVersionInfo.registeredEntry).toBe("custom-plugin@1.2.3-beta.4")
      expect(pluginVersionInfo.registeredVersion).toBe("1.2.3-beta.4")
      expect(pluginVersionInfo.loadedVersion).toBe("1.2.0")
      expect(pluginVersionInfo.loadedPackagePath).toBe(customPackagePath)
      expect(pluginVersionInfo.configPath).toBe(sandbox.globalOpenCodePath)

      const wunderkindVersionInfo = mod.detectWunderkindVersionInfo()
      expect(wunderkindVersionInfo.packageName).toBe("@grant-vine/wunderkind")
      expect(wunderkindVersionInfo.currentVersion).toMatch(/^\d+\.\d+\.\d+/)
      expect(wunderkindVersionInfo.registered).toBe(false)

      const omoVersionInfo = mod.detectOmoVersionInfo()
      expect(omoVersionInfo.packageName).toBe("oh-my-openagent")
      expect(omoVersionInfo.registered).toBe(true)
      expect(omoVersionInfo.registeredEntry).toBe("oh-my-openagent@3.12.2")
      expect(omoVersionInfo.registeredVersion).toBe("3.12.2")
      expect(omoVersionInfo.loadedVersion).toBe("3.12.2")
      expect(omoVersionInfo.loadedPackagePath).toBe(omoGlobalPackagePath)
      expect(omoVersionInfo.loadedSources?.global.version).toBe("3.12.2")
      expect(omoVersionInfo.loadedSources?.cache.version).toBe("3.12.3")
      expect(omoVersionInfo.staleOverrideWarning).toBe(
        "global oh-my-openagent 3.12.2 likely overrides newer cache 3.12.3",
      )
      expect(omoVersionInfo.freshness?.status === "up-to-date" || omoVersionInfo.freshness?.status === "pinned").toBe(true)
    })
  })

  it("falls back to the legacy oh-my-opencode package when canonical OMO is absent", async () => {
    await withSandbox("omo-legacy-fallback", async (sandbox, mod) => {
      const legacyPackagePath = join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-opencode", "package.json")

      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      mkdirSync(join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-opencode"), { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-opencode@3.12.2"] }))
      writeFileSync(legacyPackagePath, JSON.stringify({ version: "3.12.2" }))

      const versionInfo = mod.detectOmoVersionInfo()
      expect(versionInfo.packageName).toBe("oh-my-openagent")
      expect(versionInfo.registered).toBe(true)
      expect(versionInfo.registeredEntry).toBe("oh-my-opencode@3.12.2")
      expect(versionInfo.registeredVersion).toBe("3.12.2")
      expect(versionInfo.loadedVersion).toBe("3.12.2")
      expect(versionInfo.loadedPackagePath).toBe(legacyPackagePath)
      expect(versionInfo.configPath).toBe(null)
    })
  })

  it("prefers the registered legacy OMO package when both canonical and legacy copies exist", async () => {
    await withSandbox("omo-registered-legacy-preferred", async (sandbox, mod) => {
      const canonicalPackagePath = join(sandbox.globalConfigDir, "node_modules", "oh-my-openagent", "package.json")
      const legacyPackagePath = join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-opencode", "package.json")

      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      mkdirSync(join(sandbox.globalConfigDir, "node_modules", "oh-my-openagent"), { recursive: true })
      mkdirSync(join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-opencode"), { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-opencode@3.17.6"] }))
      writeFileSync(canonicalPackagePath, JSON.stringify({ version: "3.15.3" }))
      writeFileSync(legacyPackagePath, JSON.stringify({ version: "3.17.6" }))

      const versionInfo = mod.detectOmoVersionInfo()
      expect(versionInfo.registeredEntry).toBe("oh-my-opencode@3.17.6")
      expect(versionInfo.loadedVersion).toBe("3.17.6")
      expect(versionInfo.loadedPackagePath).toBe(legacyPackagePath)
    })
  })

  it("does not treat unrelated file plugins as OMO registrations", async () => {
    await withSandbox("omo-unrelated-file-plugin", async (sandbox, mod) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(
        sandbox.globalOpenCodePath,
        JSON.stringify({ plugin: ["file:///tmp/custom-local-plugin", "@grant-vine/wunderkind"] }),
      )

      const versionInfo = mod.detectOmoVersionInfo()
      expect(versionInfo.registered).toBe(false)
      expect(versionInfo.registeredEntry).toBe(null)
      expect(versionInfo.registeredVersion).toBe(null)
    })
  })

  it("requires OMO registration for install readiness even when a package copy is present", async () => {
    await withSandbox("omo-readiness-needs-registration", async (sandbox, mod) => {
      const canonicalPackagePath = join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-openagent", "package.json")

      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      mkdirSync(join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-openagent"), { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
      writeFileSync(canonicalPackagePath, JSON.stringify({ version: "3.15.3" }))

      const readiness = mod.detectOmoInstallReadiness()
      expect(readiness.installed).toBe(false)
      expect(readiness.registered).toBe(false)
      expect(readiness.loadedVersion).toBe("3.15.3")
      expect(readiness.freshnessSummary.state).toBe("not-detected")
    })
  })

  it("detectOmoVersionInfo parses upstream freshness JSON when get-local-version succeeds", async () => {
    await withSandbox("omo-freshness-success", async (sandbox) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-openagent@3.12.2"] }))

      const childProcess = await import("node:child_process")
      const originalSpawnSync = childProcess.spawnSync

      mock.module("node:child_process", () => ({
        spawnSync: ((command: string, args: string[]) => {
          if (
            command === "bunx" &&
            args[0] === "oh-my-opencode" &&
            args[1] === "get-local-version" &&
            args[2] === "--json"
          ) {
            return {
              status: 0,
              stdout: JSON.stringify({
                currentVersion: "3.12.2",
                latestVersion: "3.13.1",
                isUpToDate: false,
                isLocalDev: false,
                isPinned: false,
                pinnedVersion: null,
                status: "outdated",
              }),
              stderr: "",
            }
          }

          return originalSpawnSync(command, args, { encoding: "utf8" })
        }) as typeof childProcess.spawnSync,
      }))

      try {
        const freshMod = (await import(`${CONFIG_MANAGER_MODULE_URL}&omo-freshness-success=1`)) as ConfigManagerModule
        freshMod.__setConfigManagerPathOverrideForTests({ cwd: sandbox.projectDir, home: sandbox.homeDir })
        const info = freshMod.detectOmoVersionInfo()
        expect(info.freshness?.status).toBe("outdated")
        expect(info.freshness?.latestVersion).toBe("3.13.1")
        expect(info.freshness?.currentVersion).toBe("3.12.2")
      } finally {
        mock.module("node:child_process", () => ({ spawnSync: originalSpawnSync }))
      }
    })
  })

  it("detectOmoVersionInfo falls back when upstream freshness JSON is invalid", async () => {
    await withSandbox("omo-freshness-invalid", async (sandbox) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-openagent@3.12.2"] }))

      const childProcess = await import("node:child_process")
      const originalSpawnSync = childProcess.spawnSync

      mock.module("node:child_process", () => ({
        spawnSync: ((command: string, args: string[]) => {
          if (command === "bunx" && args[0] === "oh-my-opencode" && args[1] === "get-local-version") {
            return {
              status: 0,
              stdout: "not-json",
              stderr: "",
            }
          }

          return originalSpawnSync(command, args, { encoding: "utf8" })
        }) as typeof childProcess.spawnSync,
      }))

      try {
        const freshMod = (await import(`${CONFIG_MANAGER_MODULE_URL}&omo-freshness-invalid=1`)) as ConfigManagerModule
        freshMod.__setConfigManagerPathOverrideForTests({ cwd: sandbox.projectDir, home: sandbox.homeDir })
        const info = freshMod.detectOmoVersionInfo()
        expect(info.freshness?.status).toBe("unknown")
        expect(info.freshness?.currentVersion).toBeNull()
        expect(info.currentVersion).toBeNull()
        expect(info.freshness?.latestVersion).toBe(null)
      } finally {
        mock.module("node:child_process", () => ({ spawnSync: originalSpawnSync }))
      }
    })
  })

  it("writes, detects, and removes native asset files in an isolated sandbox", async () => {
    await withSandbox("native-assets", async (_sandbox, mod) => {
      const emptyAgentStatus = mod.detectNativeAgentFiles("global")
      expect(emptyAgentStatus.presentCount).toBe(0)
      expect(emptyAgentStatus.allPresent).toBe(false)

      const emptyCommandStatus = mod.detectNativeCommandFiles()
      expect(emptyCommandStatus.presentCount).toBe(0)
      expect(emptyCommandStatus.allPresent).toBe(false)

      const emptySkillStatus = mod.detectNativeSkillFiles("global")
      expect(emptySkillStatus.presentCount).toBe(0)
      expect(emptySkillStatus.allPresent).toBe(false)
      expect(mod.removeNativeAgentFiles("global").changed).toBe(false)
      expect(mod.removeNativeCommandFiles().changed).toBe(false)
      expect(mod.removeNativeSkillFiles("global").changed).toBe(false)

      expect(mod.writeNativeAgentFiles("global").success).toBe(true)
      expect(mod.writeNativeCommandFiles().success).toBe(true)
      expect(mod.writeNativeSkillFiles("global").success).toBe(true)

      const [firstAgentFile] = mod.getNativeAgentFilePaths("global")
      const [firstCommandFile] = mod.getNativeCommandFilePaths()
      const [firstSkillDir] = mod.getNativeSkillDirectories("global")

      if (!firstAgentFile || !firstCommandFile || !firstSkillDir) {
        throw new Error("Expected packaged native assets to exist for coverage tests")
      }

      rmSync(firstAgentFile, { force: true })
      rmSync(firstCommandFile, { force: true })
      rmSync(firstSkillDir, { recursive: true, force: true })
      writeFileSync(join(mod.getNativeAgentDir(), "keep.txt"), "keep\n")

      const agentStatus = mod.detectNativeAgentFiles("global")
      expect(agentStatus.totalCount).toBeGreaterThan(1)
      expect(agentStatus.presentCount).toBe(agentStatus.totalCount - 1)
      expect(agentStatus.allPresent).toBe(false)

      const commandStatus = mod.detectNativeCommandFiles()
      expect(commandStatus.totalCount).toBeGreaterThan(0)
      expect(commandStatus.presentCount).toBe(commandStatus.totalCount - 1)
      expect(commandStatus.allPresent).toBe(false)

      const skillStatus = mod.detectNativeSkillFiles("global")
      expect(skillStatus.totalCount).toBeGreaterThan(1)
      expect(skillStatus.presentCount).toBe(skillStatus.totalCount - 1)
      expect(skillStatus.allPresent).toBe(false)

      const removedAgents = mod.removeNativeAgentFiles("global")
      expect(removedAgents.success).toBe(true)
      expect(removedAgents.changed).toBe(true)
      expect(existsSync(mod.getNativeAgentDir())).toBe(true)
      expect(existsSync(join(mod.getNativeAgentDir(), "keep.txt"))).toBe(true)

      const removedCommands = mod.removeNativeCommandFiles()
      expect(removedCommands.success).toBe(true)
      expect(removedCommands.changed).toBe(true)
      expect(existsSync(mod.getNativeCommandsDir())).toBe(false)

      const removedSkills = mod.removeNativeSkillFiles("global")
      expect(removedSkills.success).toBe(true)
      expect(removedSkills.changed).toBe(true)
      expect(existsSync(mod.getNativeSkillsDir())).toBe(false)

      rmSync(join(mod.getNativeAgentDir(), "keep.txt"), { force: true })
      const removedEmptyAgentDir = mod.removeNativeAgentFiles("global")
      expect(removedEmptyAgentDir.success).toBe(true)
      expect(removedEmptyAgentDir.changed).toBe(true)
      expect(existsSync(mod.getNativeAgentDir())).toBe(false)
    })
  })

  it("writeNativeCommandFiles includes generated retained commands and rejects duplicate command names", async () => {
    await withSandbox("native-command-generated", async (_sandbox, mod) => {
      const writeResult = mod.writeNativeCommandFiles()
      expect(writeResult.success).toBe(true)

      const nativeCommandPaths = mod.getNativeCommandFilePaths()
      expect(nativeCommandPaths.some((filePath) => filePath.endsWith("docs-index.md"))).toBe(true)
      expect(nativeCommandPaths.some((filePath) => filePath.endsWith("design-md.md"))).toBe(true)
      expect(nativeCommandPaths.some((filePath) => filePath.endsWith("threat-model.md"))).toBe(true)
      expect(nativeCommandPaths.some((filePath) => filePath.endsWith("prd.md"))).toBe(true)
      expect(nativeCommandPaths.some((filePath) => filePath.endsWith("dream.md"))).toBe(true)

      const threatModelContent = readFileSync(join(mod.getNativeCommandsDir(), "threat-model.md"), "utf-8")
      expect(threatModelContent).toContain("agent: ciso")
      expect(threatModelContent).toContain("name: threat-model")

      const dreamContent = readFileSync(join(mod.getNativeCommandsDir(), "dream.md"), "utf-8")
      expect(dreamContent).toContain("agent: product-wunderkind")

      let duplicateError: string | null = null
      try {
        collectGeneratedRetainedNativeCommands({
          alpha: {
            commands: [{ command: "/shared", summary: "first" }],
          },
          beta: {
            commands: [{ command: "/shared <scope>", summary: "second" }],
          },
        })
      } catch (error) {
        duplicateError = error instanceof Error ? error.message : String(error)
      }

      expect(duplicateError).toBe('Duplicate retained slash command name "shared" declared by "alpha" and "beta"')

    })
  })

  it("uses scope-aware config readers and write helpers without leaking across scopes", async () => {
    await withSandbox("scope-readers", async (sandbox, mod) => {
      expect(mod.readGlobalWunderkindConfig()).toBe(null)
      expect(mod.readWunderkindConfigForScope("global")).toBe(null)
      expect(mod.readWunderkindConfigForScope("project")).toBe(null)
      expect(mod.removeGlobalWunderkindConfig()).toEqual({
        success: true,
        configPath: sandbox.globalWunderkindPath,
        changed: false,
      })

      const globalWrite = mod.writeWunderkindConfig(
        {
          ...mod.getDefaultInstallConfig(),
          region: "South Africa",
          industry: "SaaS",
          primaryRegulation: "POPIA",
          secondaryRegulation: "GDPR",
        },
        "global",
      )
      expect(globalWrite).toEqual({ success: true, configPath: sandbox.globalWunderkindPath })

      const globalConfig = mod.readGlobalWunderkindConfig()
      expect(globalConfig).toEqual({
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      })
      expect(mod.readWunderkindConfigForScope("global")).toEqual(globalConfig)

      const projectWrite = mod.writeWunderkindConfig(
        {
          ...mod.getDefaultInstallConfig(),
          region: "EU",
          docsEnabled: true,
          docsPath: "./docs-output",
          docHistoryMode: "append-dated",
          teamCulture: "formal-strict",
        },
        "project",
      )
      expect(projectWrite.success).toBe(true)
      expect(projectWrite.configPath.endsWith(join(".wunderkind", "wunderkind.config.jsonc"))).toBe(true)
      expect(existsSync(projectWrite.configPath)).toBe(true)

      const projectScoped = mod.readWunderkindConfigForScope("project")
      expect(projectScoped?.region).toBe("EU")
      expect(projectScoped?.docsEnabled).toBe(true)
      expect(projectScoped?.docsPath).toBe("./docs-output")
      expect(projectScoped?.docHistoryMode).toBe("append-dated")
      expect(projectScoped?.teamCulture).toBe("formal-strict")

      const removedGlobal = mod.removeGlobalWunderkindConfig()
      expect(removedGlobal.success).toBe(true)
      expect(removedGlobal.changed).toBe(true)
      expect(existsSync(sandbox.globalWunderkindPath)).toBe(false)
    })
  })

  it("writes sparse project config without baseline fields when they match the global baseline", async () => {
    await withSandbox("project-sparse-baseline", async (_sandbox, mod) => {
      expect(mod.writeGlobalWunderkindConfig({
        ...mod.getDefaultGlobalConfig(),
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }).success).toBe(true)

      const result = mod.writeWunderkindConfig({
        ...mod.getDefaultInstallConfig(),
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }, "project")
      expect(result.success).toBe(true)
      expect(result.configPath.endsWith(join(".wunderkind", "wunderkind.config.jsonc"))).toBe(true)

      const written = readFileSync(result.configPath, "utf-8")
      expect(written).not.toContain('"region"')
      expect(written).not.toContain('"industry"')
      expect(written).not.toContain('"primaryRegulation"')
      expect(written).not.toContain('"secondaryRegulation"')
      expect(written).toContain('"teamCulture"')
      expect(written).toContain('"docsEnabled"')
    })
  })

  it("writes project baseline overrides when they differ from the global baseline", async () => {
    await withSandbox("project-override-baseline", async (_sandbox, mod) => {
      expect(mod.writeGlobalWunderkindConfig({
        ...mod.getDefaultGlobalConfig(),
        region: "South Africa",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        secondaryRegulation: "GDPR",
      }).success).toBe(true)

      const result = mod.writeWunderkindConfig({
        ...mod.getDefaultInstallConfig(),
        region: "EU",
        industry: "Marketplace",
        primaryRegulation: "GDPR",
        secondaryRegulation: "",
      }, "project")
      expect(result.success).toBe(true)

      const written = readFileSync(result.configPath, "utf-8")
      expect(written).toContain('"region": "EU"')
      expect(written).toContain('"industry": "Marketplace"')
      expect(written).toContain('"primaryRegulation": "GDPR"')
      expect(written).toContain('"secondaryRegulation": ""')
    })
  })

  it("writes native asset files into the sandboxed global OpenCode directories", async () => {
    await withSandbox("native-asset-write-paths", async (_sandbox, mod) => {
      const agentResult = mod.writeNativeAgentFiles("project")
      expect(agentResult.success).toBe(true)

      const agentDir = mod.getNativeAgentDir()
      const marketingPath = join(agentDir, "marketing-wunderkind.md")
      const cisoPath = join(agentDir, "ciso.md")
      expect(existsSync(agentDir)).toBe(true)
      expect(existsSync(marketingPath)).toBe(true)
      expect(existsSync(cisoPath)).toBe(true)
      expect(readFileSync(marketingPath, "utf-8")).toContain("# Marketing Wunderkind")

      const commandResult = mod.writeNativeCommandFiles()
      expect(commandResult.success).toBe(true)

      const commandDir = mod.getNativeCommandsDir()
      const docsIndexPath = join(commandDir, "docs-index.md")
      const designMdPath = join(commandDir, "design-md.md")
      const threatModelPath = join(commandDir, "threat-model.md")
      const prdPath = join(commandDir, "prd.md")
      const dreamPath = join(commandDir, "dream.md")
      expect(existsSync(commandDir)).toBe(true)
      expect(existsSync(docsIndexPath)).toBe(true)
      expect(existsSync(designMdPath)).toBe(true)
      expect(existsSync(threatModelPath)).toBe(true)
      expect(existsSync(prdPath)).toBe(true)
      expect(existsSync(dreamPath)).toBe(true)
      expect(readFileSync(docsIndexPath, "utf-8")).toContain("/docs-index")
      expect(readFileSync(dreamPath, "utf-8")).toContain("agent: product-wunderkind")
      expect(readFileSync(threatModelPath, "utf-8")).toContain("name: threat-model")
      expect(readFileSync(prdPath, "utf-8")).toContain("name: prd")

      const skillResult = mod.writeNativeSkillFiles("project")
      expect(skillResult.success).toBe(true)

      const skillsDir = mod.getNativeSkillsDir()
      const agilePmSkill = join(skillsDir, "agile-pm", "SKILL.md")
      const securityAnalystSkill = join(skillsDir, "security-analyst", "SKILL.md")
      expect(existsSync(skillsDir)).toBe(true)
      expect(existsSync(agilePmSkill)).toBe(true)
      expect(existsSync(securityAnalystSkill)).toBe(true)
      expect(readFileSync(agilePmSkill, "utf-8")).toContain("Agile PM")
    })
  })

  it("removes an empty global Wunderkind directory after deleting the global config file", async () => {
    await withSandbox("remove-empty-global-dir", async (sandbox, mod) => {
      mkdirSync(join(sandbox.homeDir, ".wunderkind"), { recursive: true })
      writeFileSync(sandbox.globalWunderkindPath, "{}\n")

      const result = mod.removeGlobalWunderkindConfig()
      expect(result.success).toBe(true)
      expect(result.changed).toBe(true)
      expect(result.configPath).toBe(sandbox.globalWunderkindPath)
      expect(existsSync(sandbox.globalWunderkindPath)).toBe(false)
      expect(existsSync(join(sandbox.homeDir, ".wunderkind"))).toBe(false)
    })
  })

  it("writes the schema URL into global config output", async () => {
    await withSandbox("global-schema-output", async (sandbox, mod) => {
      const result = mod.writeGlobalWunderkindConfig(mod.getDefaultGlobalConfig())
      expect(result.success).toBe(true)

      const written = readFileSync(sandbox.globalWunderkindPath, "utf-8")
      expect(written).toContain('"$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"')
    })
  })

  it("writes the schema URL into project config output", async () => {
    await withSandbox("project-schema-output", async (sandbox, mod) => {
      const result = mod.writeProjectWunderkindConfig(mod.getDefaultProjectConfig())
      expect(result.success).toBe(true)

      const written = readFileSync(sandbox.projectConfigPath, "utf-8")
      expect(written).toContain('"$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"')
    })
  })

  it("__setConfigManagerPathOverrideForTests clears override when called with empty object", async () => {
    const mod = await importConfigManager()
    const sandbox = createSandbox("wk-config-manager-clear-override-")
    try {
      mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox.projectDir, home: sandbox.homeDir })
      mod.__setConfigManagerPathOverrideForTests({})
      const result = mod.resolveOpenCodeConfigPath("project")
      expect(result).toHaveProperty("path")
    } finally {
      mod.__resetConfigManagerPathOverrideForTests()
      cleanupSandbox(sandbox)
    }
  })

  it("readWunderkindConfig returns null when neither global nor project config file exists", async () => {
    await withSandbox("null-both", async (_sandbox, mod) => {
      const result = mod.readWunderkindConfig()
      expect(result).toBe(null)
    })
  })

  it("compareVersions returns 0 for equal versions via staleOverrideWarning returning null", async () => {
    await withSandbox("compare-equal-versions", async (sandbox, mod) => {
      const globalPkg = join(sandbox.globalConfigDir, "node_modules", "oh-my-openagent", "package.json")
      const cachePkg = join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-openagent", "package.json")
      mkdirSync(join(sandbox.globalConfigDir, "node_modules", "oh-my-openagent"), { recursive: true })
      mkdirSync(join(sandbox.homeDir, ".cache", "opencode", "node_modules", "oh-my-openagent"), { recursive: true })
      writeFileSync(globalPkg, JSON.stringify({ version: "3.0.0" }))
      writeFileSync(cachePkg, JSON.stringify({ version: "3.0.0" }))
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["oh-my-openagent@3.0.0"] }))

      const info = mod.detectOmoVersionInfo()
      expect(info.staleOverrideWarning).toBe(null)
    })
  })

  it("getProjectOverrideMarker returns project-override marker when key exists in project config", async () => {
    const mod = await importConfigManager()
    const withKey = mod.getProjectOverrideMarker("region", { region: "EU" })
    expect(withKey.marker).toBe("●")
    expect(withKey.sourceLabel).toBe("project override")

    const withNull = mod.getProjectOverrideMarker("region", null)
    expect(withNull.marker).toBe("○")
    expect(withNull.sourceLabel).toBe("inherited default")

    const withMissing = mod.getProjectOverrideMarker("region", {})
    expect(withMissing.marker).toBe("○")
    expect(withMissing.sourceLabel).toBe("inherited default")
  })

  it("detectGitHubWorkflowReadiness returns not-a-git-repo for a temp dir with no git", async () => {
    const mod = await importConfigManager()
    const tempDir = mkdtempSync(join(tmpdir(), "wk-gh-readiness-"))
    try {
      const result = mod.detectGitHubWorkflowReadiness(tempDir)
      expect(result.isGitRepo).toBe(false)
      expect(result.hasGitHubRemote).toBe(false)
      expect(result.ghInstalled).toBe(false)
      expect(result.authVerified).toBe(false)
      expect(result.authCheckAttempted).toBe(false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("detectGitHubWorkflowReadiness returns isGitRepo=true for the wunderkind repo itself", async () => {
    const mod = await importConfigManager()
    const result = mod.detectGitHubWorkflowReadiness(PROJECT_ROOT)
    expect(result.isGitRepo).toBe(true)
  })

  it("detectRegistration returns project-only scope when only project config has plugin", async () => {
    await withSandbox("detect-project-only", async (sandbox, mod) => {
      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
      const detected = mod.detectCurrentConfig()
      expect(detected.registrationScope).toBe("project")
      expect(detected.isInstalled).toBe(true)
    })
  })

  it("detectRegistration returns global-only scope when only global config has plugin", async () => {
    await withSandbox("detect-global-only", async (sandbox, mod) => {
      mkdirSync(sandbox.globalConfigDir, { recursive: true })
      writeFileSync(sandbox.globalOpenCodePath, JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
      const detected = mod.detectCurrentConfig()
      expect(detected.registrationScope).toBe("global")
      expect(detected.isInstalled).toBe(true)
    })
  })

  it("removePluginFromOpenCodeConfig returns changed:false when file does not exist", async () => {
    await withSandbox("remove-no-file", async (sandbox, mod) => {
      const result = mod.removePluginFromOpenCodeConfig("project")
      expect(result.success).toBe(true)
      expect(result.changed).toBe(false)
      expect(result.configPath).toBe(sandbox.projectOpenCodePath)
    })
  })

  it("removePluginFromOpenCodeConfig returns changed:false when plugin is not listed", async () => {
    await withSandbox("remove-not-listed", async (sandbox, mod) => {
      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["other-plugin"] }))
      const result = mod.removePluginFromOpenCodeConfig("project")
      expect(result.success).toBe(true)
      expect(result.changed).toBe(false)
    })
  })

  it("removePluginFromOpenCodeConfig deletes plugin key entirely when it was the only entry", async () => {
    await withSandbox("remove-only-entry", async (sandbox, mod) => {
      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
      const result = mod.removePluginFromOpenCodeConfig("project")
      expect(result.success).toBe(true)
      expect(result.changed).toBe(true)
      const written = JSON.parse(readFileSync(sandbox.projectOpenCodePath, "utf-8")) as Record<string, unknown>
      expect(written).not.toHaveProperty("plugin")
    })
  })

  it("addPluginToOpenCodeConfig replaces wunderkind@0.x legacy alias entry", async () => {
    await withSandbox("add-legacy-alias", async (sandbox, mod) => {
      writeFileSync(sandbox.projectOpenCodePath, JSON.stringify({ plugin: ["other-plugin", "wunderkind@0.5.0"] }))
      const result = mod.addPluginToOpenCodeConfig("project")
      expect(result.success).toBe(true)
      const content = readFileSync(sandbox.projectOpenCodePath, "utf-8")
      expect(content).toContain("@grant-vine/wunderkind")
      expect(content).not.toContain("wunderkind@0.5.0")
      expect(content).toContain("other-plugin")
    })
  })
})
