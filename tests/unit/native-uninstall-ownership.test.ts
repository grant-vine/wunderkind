import { describe, expect, it } from "bun:test"
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

type ConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CACHE_BUST = Date.now()
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?native-uninstall-ownership=${CACHE_BUST}`

async function importConfigManager(): Promise<ConfigManagerModule> {
  return import(CONFIG_MANAGER_MODULE_URL) as Promise<ConfigManagerModule>
}

describe("native global uninstall ownership", () => {
  it("preserves edited active native assets when global uninstall cannot prove ownership", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "wk-native-uninstall-ownership-"))
    const homeDir = join(sandbox, "home")
    const configDir = join(homeDir, ".config", "opencode")
    const mod = await importConfigManager()

    try {
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, "opencode.json"), JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
      mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox, home: homeDir })

      const writes = [
        mod.writeNativeAgentFiles("global"),
        mod.writeNativeCommandFiles(),
        mod.writeNativeSkillFiles("global"),
      ]
      for (const write of writes) {
        expect(write.success).toBe(true)
      }

      const assetPaths = [
        join(configDir, "agents", "product-wunderkind.md"),
        join(configDir, "commands", "docs-index.md"),
        join(configDir, "skills", "release-upgrade", "SKILL.md"),
      ]
      for (const assetPath of assetPaths) {
        appendFileSync(assetPath, "\noperator edit\n", "utf8")
      }
      const expectedBytes = assetPaths.map((assetPath) => readFileSync(assetPath, "utf8"))

      const result = spawnSync(process.execPath, ["bin/wunderkind.js", "uninstall", "--scope=global"], {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          HOME: homeDir,
          XDG_CONFIG_HOME: join(homeDir, ".config"),
          USERPROFILE: homeDir,
        },
        encoding: "utf8",
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain("Preserved native agent file pending ownership proof")
      expect(result.stdout).toContain("Preserved native command file pending ownership proof")
      expect(result.stdout).toContain("Preserved native skill directory pending ownership proof")
      expect(assetPaths.every(existsSync)).toBe(true)
      expect(assetPaths.map((assetPath) => readFileSync(assetPath, "utf8"))).toEqual(expectedBytes)
    } finally {
      mod.__resetConfigManagerPathOverrideForTests()
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("holds active native assets with absent, malformed, and partial receipts", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "wk-native-uninstall-receipt-"))
    const homeDir = join(sandbox, "home")
    const mod = await importConfigManager()
    mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox, home: homeDir })

    try {
      const agentDir = mod.getNativeAgentDir()
      const agentPath = join(agentDir, "product-wunderkind.md")
      const markerPath = join(agentDir, ".wunderkind-version.json")
      mkdirSync(agentDir, { recursive: true })
      writeFileSync(agentPath, "unowned agent bytes\n", "utf8")

      const absentResult = mod.removeNativeAgentFiles("global")
      expect(absentResult.heldPaths).toContain(agentPath)
      expect(readFileSync(agentPath, "utf8")).toBe("unowned agent bytes\n")

      writeFileSync(markerPath, "not-json", "utf8")
      const malformedResult = mod.removeNativeAgentFiles("global")
      expect(malformedResult.heldPaths).toContain(agentPath)
      expect(malformedResult.heldPaths).toContain(markerPath)
      expect(readFileSync(markerPath, "utf8")).toBe("not-json")

      writeFileSync(markerPath, JSON.stringify({
        package: "@grant-vine/wunderkind",
        kind: "agents",
        version: "0.28.3",
        files: {},
      }), "utf8")
      const partialResult = mod.removeNativeAgentFiles("global")
      expect(partialResult.heldPaths).toContain(agentPath)
      expect(readFileSync(agentPath, "utf8")).toBe("unowned agent bytes\n")
      expect(existsSync(markerPath)).toBe(true)
    } finally {
      mod.__resetConfigManagerPathOverrideForTests()
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("holds native paths behind root, parent, leaf, and dangling symbolic links", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "wk-native-uninstall-symlink-"))
    const homeDir = join(sandbox, "home")
    const mod = await importConfigManager()
    mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox, home: homeDir })

    try {
      const commandWrite = mod.writeNativeCommandFiles()
      expect(commandWrite.success).toBe(true)
      const commandRoot = mod.getNativeCommandsDir()
      const externalCommandRoot = join(sandbox, "external-commands")
      const commandSentinel = join(externalCommandRoot, "sentinel.md")
      mkdirSync(externalCommandRoot)
      writeFileSync(commandSentinel, "external command root\n", "utf8")
      rmSync(commandRoot, { recursive: true, force: true })
      symlinkSync(externalCommandRoot, commandRoot, "dir")

      const rootResult = mod.removeNativeCommandFiles()
      expect(rootResult.heldPaths).toEqual([commandRoot])
      expect(readFileSync(commandSentinel, "utf8")).toBe("external command root\n")

      rmSync(commandRoot)
      const skillWrite = mod.writeNativeSkillFiles("global")
      expect(skillWrite.success).toBe(true)
      const skillDir = join(mod.getNativeSkillsDir(), "release-upgrade")
      const externalSkillDir = join(sandbox, "external-skill")
      const skillSentinel = join(externalSkillDir, "SKILL.md")
      mkdirSync(externalSkillDir)
      writeFileSync(skillSentinel, "external skill parent\n", "utf8")
      rmSync(skillDir, { recursive: true, force: true })
      symlinkSync(externalSkillDir, skillDir, "dir")

      const parentResult = mod.removeNativeSkillFiles("global")
      expect(parentResult.heldPaths).toContain(skillDir)
      expect(readFileSync(skillSentinel, "utf8")).toBe("external skill parent\n")

      rmSync(skillDir)
      const agentWrite = mod.writeNativeAgentFiles("global")
      expect(agentWrite.success).toBe(true)
      const agentPath = join(mod.getNativeAgentDir(), "product-wunderkind.md")
      rmSync(agentPath)
      symlinkSync(join(sandbox, "missing-agent.md"), agentPath)

      const leafResult = mod.removeNativeAgentFiles("global")
      expect(leafResult.heldPaths).toContain(agentPath)
      expect(existsSync(agentPath)).toBe(false)
    } finally {
      mod.__resetConfigManagerPathOverrideForTests()
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it("holds a mixed skill directory while removing unchanged receipt-owned assets", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "wk-native-uninstall-mixed-skill-"))
    const homeDir = join(sandbox, "home")
    const mod = await importConfigManager()
    mod.__setConfigManagerPathOverrideForTests({ cwd: sandbox, home: homeDir })

    try {
      const skillWrite = mod.writeNativeSkillFiles("global")
      expect(skillWrite.success).toBe(true)
      const mixedSkillDir = join(mod.getNativeSkillsDir(), "release-upgrade")
      const privatePath = join(mixedSkillDir, "PRIVATE.md")
      writeFileSync(privatePath, "operator private bytes\n", "utf8")
      const untouchedSkillDir = join(mod.getNativeSkillsDir(), "platform-compatibility")

      const result = mod.removeNativeSkillFiles("global")

      expect(result.changed).toBe(true)
      expect(result.heldPaths).toContain(mixedSkillDir)
      expect(readFileSync(privatePath, "utf8")).toBe("operator private bytes\n")
      expect(existsSync(untouchedSkillDir)).toBe(false)
    } finally {
      mod.__resetConfigManagerPathOverrideForTests()
      rmSync(sandbox, { recursive: true, force: true })
    }
  })
})
