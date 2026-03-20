import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

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
