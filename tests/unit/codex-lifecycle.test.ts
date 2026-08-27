import { describe, expect, it } from "bun:test"
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { __resetCodexPathOverrideForTests, __setCodexPathOverrideForTests } from "../../src/cli/codex/paths.js"
import { __setCodexProcessRunnerForTests, CODEX_PROCESS_TIMEOUT_MS, validateCodexPluginRemovalResponse } from "../../src/cli/codex/process.js"
import { getCodexGlobalInstallReadiness, installCodexWunderkind } from "../../src/cli/codex/install.js"
import { getCodexDoctorReport } from "../../src/cli/codex/doctor.js"
import { runCodexProjectInit } from "../../src/cli/codex/project-lifecycle.js"
import { upgradeCodexWunderkind } from "../../src/cli/codex/upgrade.js"
import { uninstallCodexWunderkind } from "../../src/cli/codex/uninstall.js"
import { __resetCodexInstallStateWriterForTests, __setCodexInstallStateWriterForTests } from "../../src/cli/codex/state.js"
import { AGENT_NAMES, captureError, cleanup, configure, createFakeCodex, createLazyCodexEnvelope, hasAgentHashes, hasCall, PACKAGE_VERSION, result, sandbox } from "./helpers/codex-lifecycle-fixtures.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPayloadManifest(value: unknown): value is { files: { readonly path: string; readonly sha256: string }[] } {
  return isRecord(value) && Array.isArray(value["files"]) && value["files"].every((entry) =>
    isRecord(entry) && typeof entry["path"] === "string" && typeof entry["sha256"] === "string")
}

describe("Codex lifecycle install", () => {
  it("installs once, then repeats idempotently with bounded Codex argv", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)

    try {
      const first = installCodexWunderkind()
      const second = installCodexWunderkind()

      expect(first.packageVersion).toBe(PACKAGE_VERSION)
      expect(second.packageVersion).toBe(PACKAGE_VERSION)
      expect(fake.calls).toEqual([["--version"], ["plugin", "list", "--json"], ["plugin", "marketplace", "list", "--json"], ["plugin", "marketplace", "add", join(paths.wunderkindHome, "codex", "marketplace"), "--json"], ["plugin", "add", "wunderkind@grant-vine", "--json"], ["--version"], ["plugin", "list", "--json"], ["plugin", "marketplace", "list", "--json"], ["plugin", "add", "wunderkind@grant-vine", "--json"]])
      expect(existsSync(join(paths.codexHome, "config.toml"))).toBe(false)
      expect(CODEX_PROCESS_TIMEOUT_MS).toBe(15_000)
      const state: unknown = JSON.parse(readFileSync(join(paths.wunderkindHome, "codex", "install-state.json"), "utf8"))
      if (!hasAgentHashes(state)) throw new Error("Expected valid Codex install state")
      expect(state.agents).toHaveLength(6)
      expect(state.agents.every((agent) => /^[a-f0-9]{64}$/u.test(agent.sha256))).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves an agent modified during repeat-install Codex discovery instead of reporting success", () => {
    const paths = sandbox()
    const cisoPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    const operatorBytes = "operator-owned ciso agent after discovery\n"
    let mutateDuringNextVersion = false
    const fake = createFakeCodex({
      onRun(argv) {
        if (mutateDuringNextVersion && argv.length === 1 && argv[0] === "--version") {
          writeFileSync(cisoPath, operatorBytes, "utf8")
          mutateDuringNextVersion = false
        }
      },
    })
    configure(paths, fake)

    try {
      expect(installCodexWunderkind().packageVersion).toBe(PACKAGE_VERSION)
      mutateDuringNextVersion = true

      const error = captureError(() => installCodexWunderkind())

      expect(error instanceof Error).toBe(true)
      expect(error?.message ?? "").toContain("already exists and is not Wunderkind-owned")
      expect(readFileSync(cisoPath, "utf8")).toBe(operatorBytes)
      expect(fake.calls.filter((argv) => argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json")).toHaveLength(1)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves an agent changed during successful plugin add without recording it as owned", () => {
    const paths = sandbox()
    const cisoPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const operatorBytes = "operator-owned ciso agent during plugin add\n"
    configure(paths, createFakeCodex({
      onRun(argv) {
        if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") {
          writeFileSync(cisoPath, operatorBytes, "utf8")
        }
      },
    }))

    try {
      const error = captureError(() => installCodexWunderkind())
      const removed = uninstallCodexWunderkind()

      expect(error?.message).toContain("recovery required")
      expect(readFileSync(cisoPath, "utf8")).toBe(operatorBytes)
      expect(existsSync(statePath)).toBe(false)
      expect(removed.removedAgents).toEqual([])
      expect(readFileSync(cisoPath, "utf8")).toBe(operatorBytes)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves immutable plugin bytes changed during successful plugin add without publishing ownership", () => {
    const paths = sandbox()
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const pluginManifest = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json")
    const skill = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md")
    const changedPluginManifest = "{\"name\":\"operator-changed\"}\n"
    const changedSkill = "operator-changed skill\n"
    configure(paths, createFakeCodex({
      onRun(argv) {
        if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") {
          writeFileSync(pluginManifest, changedPluginManifest, "utf8")
          writeFileSync(skill, changedSkill, "utf8")
        }
      },
    }))

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("immutable payload changed during plugin add")
      expect(readFileSync(pluginManifest, "utf8")).toBe(changedPluginManifest)
      expect(readFileSync(skill, "utf8")).toBe(changedSkill)
      expect(existsSync(statePath)).toBe(false)
      expect(getCodexDoctorReport().core.healthy).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a descriptor changed during repeat-install plugin add and leaves recovery to uninstall", () => {
    const paths = sandbox()
    const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const operatorBytes = "operator-owned descriptor during repeat plugin add\n"
    let mutateDuringPluginAdd = false
    const fake = createFakeCodex({
      onRun(argv) {
        if (mutateDuringPluginAdd && argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") {
          writeFileSync(descriptorPath, operatorBytes, "utf8")
          mutateDuringPluginAdd = false
        }
      },
    })
    configure(paths, fake)

    try {
      installCodexWunderkind()
      const stateBefore = readFileSync(statePath, "utf8")
      mutateDuringPluginAdd = true

      const error = captureError(() => installCodexWunderkind())
      const removed = uninstallCodexWunderkind()

      expect(error?.message).toContain("descriptor changed during plugin add")
      expect(readFileSync(descriptorPath, "utf8")).toBe(operatorBytes)
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(removed.recoveryRequired).toBe(true)
      expect(removed.stateRemoved).toBe(false)
      expect(readFileSync(descriptorPath, "utf8")).toBe(operatorBytes)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves install state changed during repeat-install plugin add without replacing agent ownership", () => {
    const paths = sandbox()
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const cisoPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    let operatorBytes = ""
    let mutateDuringPluginAdd = false
    const fake = createFakeCodex({
      onRun(argv) {
        if (mutateDuringPluginAdd && argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") {
          writeFileSync(statePath, operatorBytes, "utf8")
          mutateDuringPluginAdd = false
        }
      },
    })
    configure(paths, fake)

    try {
      installCodexWunderkind()
      const stateBefore = readFileSync(statePath, "utf8")
      const agentBefore = readFileSync(cisoPath, "utf8")
      operatorBytes = JSON.stringify(JSON.parse(stateBefore))
      mutateDuringPluginAdd = true

      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("install state changed during plugin add")
      expect(readFileSync(statePath, "utf8")).toBe(operatorBytes)
      expect(readFileSync(cisoPath, "utf8")).toBe(agentBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("rejects a foreign marketplace descriptor without install state before creating agents or calling Codex", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
    const agentPath = join(paths.codexHome, "agents", "wunderkind-product.toml")
    const foreignDescriptor = "operator-owned marketplace descriptor\n"
    mkdirSync(join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins"), { recursive: true })
    writeFileSync(descriptorPath, foreignDescriptor, "utf8")
    configure(paths, fake)

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("descriptor already exists and is not Wunderkind-owned")
      expect(readFileSync(descriptorPath, "utf8")).toBe(foreignDescriptor)
      expect(existsSync(agentPath)).toBe(false)
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(false)
      expect(fake.calls).toEqual([])
      expect(getCodexDoctorReport().core.healthy).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a pre-modified descriptor and blocks repeat install before Codex discovery", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const agentPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    const operatorBytes = "operator descriptor before repeat install\n"
    configure(paths, fake)

    try {
      installCodexWunderkind()
      writeFileSync(descriptorPath, operatorBytes, "utf8")
      const stateBefore = readFileSync(statePath, "utf8")
      const agentBefore = readFileSync(agentPath, "utf8")
      const calls = fake.calls.length

      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("descriptor is missing or modified")
      expect(fake.calls.slice(calls)).toEqual([])
      expect(readFileSync(descriptorPath, "utf8")).toBe(operatorBytes)
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(readFileSync(agentPath, "utf8")).toBe(agentBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves dangling ownership leaves before install without invoking Codex", () => {
    for (const leaf of ["agent", "descriptor", "install-state"] as const) {
      const paths = sandbox()
      const fake = createFakeCodex()
      const outsideTarget = join(paths.root, `${leaf}-outside-target`)
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const agentPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      const leafPath = leaf === "agent" ? agentPath : leaf === "descriptor" ? descriptorPath : statePath
      mkdirSync(join(leafPath, ".."), { recursive: true })
      symlinkSync(outsideTarget, leafPath)
      configure(paths, fake)

      try {
        expect(captureError(() => installCodexWunderkind()) instanceof Error).toBe(true)
        expect(lstatSync(leafPath).isSymbolicLink()).toBe(true)
        expect(existsSync(outsideTarget)).toBe(false)
        expect(existsSync(statePath)).toBe(false)
        expect(existsSync(agentPath)).toBe(false)
        expect(existsSync(join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json"))).toBe(false)
        expect(fake.calls).toEqual([])
      } finally {
        cleanup(paths)
      }
    }
  })

  it("rejects a plugin manifest changed during Codex discovery before publishing ownership", () => {
    const paths = sandbox()
    const pluginManifest = join(paths.payloadRoot, "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json")
    const tamperedPlugin = "{\"name\":\"tampered\"}\n"
    let mutateDuringDiscovery = true
    configure(paths, createFakeCodex({
      onRun(argv) {
        if (mutateDuringDiscovery && argv.join("\u0000") === "--version") {
          writeFileSync(pluginManifest, tamperedPlugin, "utf8")
          mutateDuringDiscovery = false
        }
      },
    }))

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("plugin manifest")
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(false)
      expect(existsSync(join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json"))).toBe(false)
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-product.toml"))).toBe(false)
      expect(getCodexDoctorReport().core.healthy).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("rejects a required skill changed during Codex discovery before publishing ownership", () => {
    const paths = sandbox()
    const skill = join(paths.payloadRoot, "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md")
    const tamperedSkill = "---\nname: tampered\ndescription: Tampered fixture skill.\n---\n"
    let mutateDuringDiscovery = true
    configure(paths, createFakeCodex({
      onRun(argv) {
        if (mutateDuringDiscovery && argv.join("\u0000") === "--version") {
          writeFileSync(skill, tamperedSkill, "utf8")
          mutateDuringDiscovery = false
        }
      },
    }))

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("payload")
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(false)
      expect(existsSync(join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md"))).toBe(false)
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-product.toml"))).toBe(false)
      expect(getCodexDoctorReport().core.healthy).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("blocks absent, disabled, old, OMO 5, and malformed LazyCodex discovery", () => {
    const fixtures: readonly unknown[] = [
      { installed: [], available: [] },
      { installed: [{ pluginId: "omo@sisyphuslabs", version: "4.19.4", installed: true, enabled: false }], available: [] }, createLazyCodexEnvelope("4.19.3"), createLazyCodexEnvelope("5.0.0"),
      createLazyCodexEnvelope("4.19.4junk"), createLazyCodexEnvelope("4.19.4-beta.1"), createLazyCodexEnvelope("04.019.004"), createLazyCodexEnvelope("4.19.04"),
      { invalid: true },
    ]

    for (const lazyPlugin of fixtures) {
      const paths = sandbox()
      configure(paths, createFakeCodex({ lazyPlugin }))
      try {
        expect(captureError(() => installCodexWunderkind()) instanceof Error).toBe(true)
      } finally {
        cleanup(paths)
      }
    }
  })

  it("accepts the stable minimum and build metadata", () => {
    for (const version of ["4.19.4", "4.19.4+build.9"]) {
      const paths = sandbox(); configure(paths, createFakeCodex({ lazyPlugin: createLazyCodexEnvelope(version) }))
      try { expect(installCodexWunderkind().packageVersion).toBe(PACKAGE_VERSION) } finally { cleanup(paths) }
    }
  })

  it("blocks when Codex is unavailable before parsing plugin JSON", () => {
    const paths = sandbox()
    __setCodexPathOverrideForTests(paths)
    __setCodexProcessRunnerForTests({ run: () => result("codex not found", 1) })
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("Codex CLI is required")
    } finally {
      cleanup(paths)
    }
  })

  it("preserves foreign agents, rejects payload tampering and marketplace collisions", () => {
    const collisionPaths = sandbox()
    configure(collisionPaths, createFakeCodex())
    const foreignAgent = join(collisionPaths.codexHome, "agents", "wunderkind-ciso.toml")
    try {
      mkdirSync(join(collisionPaths.codexHome, "agents"), { recursive: true })
      writeFileSync(foreignAgent, "foreign", "utf8")
      expect(captureError(() => installCodexWunderkind())?.message).toContain("already exists")
      expect(readFileSync(foreignAgent, "utf8")).toBe("foreign")
    } finally {
      cleanup(collisionPaths)
    }

    const digestPaths = sandbox()
    configure(digestPaths, createFakeCodex())
    try {
      writeFileSync(join(digestPaths.payloadRoot, "agents", "wunderkind-ciso.toml"), "tampered", "utf8")
      expect(captureError(() => installCodexWunderkind())?.message).toContain("digest")
    } finally {
      cleanup(digestPaths)
    }

    const marketplacePaths = sandbox()
    configure(marketplacePaths, createFakeCodex({ marketplaces: [{ name: "grant-vine", path: "/foreign/root" }] }))
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("marketplace")
    } finally {
      cleanup(marketplacePaths)
    }
  })

  it("rejects a payload manifest that omits canonical agents before creating install roots or calling Codex", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    const foreignAgent = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    const foreignBytes = "foreign operator-owned ciso agent\n"
    const manifestPath = join(paths.payloadRoot, "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
    const marketplaceRoot = join(paths.wunderkindHome, "codex", "marketplace")
    const installRoot = join(paths.wunderkindHome, "codex")

    mkdirSync(join(paths.codexHome, "agents"), { recursive: true })
    writeFileSync(foreignAgent, foreignBytes, "utf8")
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
    if (!isPayloadManifest(manifest)) throw new Error("Expected valid payload manifest")
    writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, files: manifest.files.filter((entry) => !entry.path.startsWith("agents/")) }, null, 2)}\n`, "utf8")
    configure(paths, fake)

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("missing required file")
      expect(readFileSync(foreignAgent, "utf8")).toBe(foreignBytes)
      expect(existsSync(installRoot)).toBe(false)
      expect(existsSync(marketplaceRoot)).toBe(false)
      expect(fake.calls).toEqual([])
    } finally {
      cleanup(paths)
    }
  })

  it("rejects missing and unexpected canonical skill payload entries before creating install roots or calling Codex", () => {
    const cases: readonly {
      readonly name: string
      readonly mutate: (manifest: { readonly files: readonly { readonly path: string; readonly sha256: string }[] }, paths: ReturnType<typeof sandbox>) => { readonly files: readonly { readonly path: string; readonly sha256: string }[] }
      readonly expectedMessage: string
    }[] = [
      {
        name: "missing skill",
        mutate: (manifest) => ({
          files: manifest.files.filter((entry) => entry.path !== `marketplace/plugins/wunderkind/${PACKAGE_VERSION}/skills/wunderkind/SKILL.md`),
        }),
        expectedMessage: "missing required file",
      },
      {
        name: "unexpected skill",
        mutate: (manifest, paths) => {
          const path = `marketplace/plugins/wunderkind/${PACKAGE_VERSION}/skills/unexpected/SKILL.md`
          const content = "---\nname: unexpected\ndescription: Unexpected fixture skill.\n---\n"
          const target = join(paths.payloadRoot, path)
          mkdirSync(join(target, ".."), { recursive: true })
          writeFileSync(target, content, "utf8")
          return { files: [...manifest.files, { path, sha256: createHash("sha256").update(content).digest("hex") }] }
        },
        expectedMessage: "unexpected file",
      },
    ]

    for (const testCase of cases) {
      const paths = sandbox()
      const fake = createFakeCodex()
      const foreignAgent = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
      const foreignBytes = "foreign operator-owned ciso agent\n"
      const manifestPath = join(paths.payloadRoot, "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
      const marketplaceRoot = join(paths.wunderkindHome, "codex", "marketplace")
      const installRoot = join(paths.wunderkindHome, "codex")

      mkdirSync(join(paths.codexHome, "agents"), { recursive: true })
      writeFileSync(foreignAgent, foreignBytes, "utf8")
      const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
      if (!isPayloadManifest(manifest)) throw new Error("Expected valid payload manifest")
      writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, ...testCase.mutate(manifest, paths) }, null, 2)}\n`, "utf8")
      configure(paths, fake)

      try {
        const error = captureError(() => installCodexWunderkind())

        expect(error?.message).toContain(testCase.expectedMessage)
        expect(readFileSync(foreignAgent, "utf8")).toBe(foreignBytes)
        expect(existsSync(installRoot)).toBe(false)
        expect(existsSync(marketplaceRoot)).toBe(false)
        expect(fake.calls).toEqual([])
      } finally {
        cleanup(paths)
      }
    }
  })

  it("rejects a hash-matching packaged skill directory symlink before creating install roots or calling Codex", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    const installRoot = join(paths.wunderkindHome, "codex")
    const marketplaceRoot = join(installRoot, "marketplace")
    const skillDirectory = join(paths.payloadRoot, "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind")
    const externalDirectory = join(paths.root, "external matching skill")
    const externalSkill = join(externalDirectory, "SKILL.md")

    cpSync(skillDirectory, externalDirectory, { recursive: true })
    const externalBytes = readFileSync(externalSkill, "utf8")
    rmSync(skillDirectory, { recursive: true, force: true })
    symlinkSync(externalDirectory, skillDirectory, "dir")
    configure(paths, fake)

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("unsafe file")
      expect(readFileSync(externalSkill, "utf8")).toBe(externalBytes)
      expect(existsSync(installRoot)).toBe(false)
      expect(existsSync(marketplaceRoot)).toBe(false)
      expect(fake.calls).toEqual([])
    } finally {
      cleanup(paths)
    }
  })

  it("rejects payload version drift before creating install roots or calling Codex", () => {
    const cases: readonly {
      readonly name: string
      readonly mutate: (paths: ReturnType<typeof sandbox>) => void
    }[] = [
      {
        name: "a renamed self-consistent plugin payload",
        mutate: (paths) => {
          const pluginRoot = join(paths.payloadRoot, "marketplace", "plugins", "wunderkind")
          const candidateVersion = "0.26.4"
          const original = join(pluginRoot, PACKAGE_VERSION)
          const candidate = join(pluginRoot, candidateVersion)
          cpSync(original, candidate, { recursive: true })
          rmSync(original, { recursive: true, force: true })
          const pluginManifest = join(candidate, ".codex-plugin", "plugin.json")
          writeFileSync(pluginManifest, readFileSync(pluginManifest, "utf8").replaceAll(PACKAGE_VERSION, candidateVersion))
          const payloadManifest = join(candidate, "payload-manifest.json")
          const manifest: unknown = JSON.parse(readFileSync(payloadManifest, "utf8"))
          if (!isPayloadManifest(manifest)) throw new Error("Expected valid payload manifest")
          manifest.files = manifest.files.map((entry) => {
            const path = entry.path.replaceAll(PACKAGE_VERSION, candidateVersion)
            return { path, sha256: hash(readFileSync(join(paths.payloadRoot, path), "utf8")) }
          })
          writeFileSync(payloadManifest, `${JSON.stringify(manifest, null, 2)}\n`)
        },
      },
      {
        name: "a marketplace descriptor pointing at a non-canonical plugin version",
        mutate: (paths) => {
          const descriptor = join(paths.payloadRoot, "marketplace", ".agents", "plugins", "marketplace.json")
          writeFileSync(descriptor, readFileSync(descriptor, "utf8").replaceAll(PACKAGE_VERSION, "0.26.4"))
        },
      },
    ]

    for (const testCase of cases) {
      const paths = sandbox()
      const fake = createFakeCodex()
      const installRoot = join(paths.wunderkindHome, "codex")
      const marketplaceRoot = join(installRoot, "marketplace")
      testCase.mutate(paths)
      configure(paths, fake)

      try {
        expect(captureError(() => installCodexWunderkind()) instanceof Error).toBe(true)
        expect(existsSync(installRoot)).toBe(false)
        expect(existsSync(marketplaceRoot)).toBe(false)
        expect(fake.calls).toEqual([])
      } finally {
        cleanup(paths)
      }
    }
  })

  it("fails closed before writes when a forged canonical state claims foreign agents", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const marketplaceRoot = join(paths.wunderkindHome, "codex", "marketplace")
    const foreignAgent = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    const foreignBytes = "foreign operator-owned ciso agent\n"
    const unsafeState = `${JSON.stringify({
      packageVersion: PACKAGE_VERSION,
      marketplace: { name: "grant-vine", root: join(paths.wunderkindHome, "codex", "marketplace") },
      plugin: { id: "wunderkind", version: PACKAGE_VERSION },
      agents: AGENT_NAMES.map((name) => {
        const bytes = name === "wunderkind-ciso" ? foreignBytes : `foreign operator-owned ${name} agent\n`
        return { name, path: join(paths.codexHome, "agents", `${name}.toml`), sha256: createHash("sha256").update(bytes).digest("hex") }
      }),
    })}\n`
    mkdirSync(join(paths.wunderkindHome, "codex"), { recursive: true })
    mkdirSync(join(paths.codexHome, "agents"), { recursive: true })
    writeFileSync(statePath, unsafeState, "utf8")
    for (const name of AGENT_NAMES) {
      const bytes = name === "wunderkind-ciso" ? foreignBytes : `foreign operator-owned ${name} agent\n`
      writeFileSync(join(paths.codexHome, "agents", `${name}.toml`), bytes, "utf8")
    }
    expect(existsSync(marketplaceRoot)).toBe(false)
    configure(paths, fake)

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("descriptor is missing or modified")
      expect(readFileSync(foreignAgent, "utf8")).toBe(foreignBytes)
      expect(readFileSync(statePath, "utf8")).toBe(unsafeState)
      expect(existsSync(marketplaceRoot)).toBe(false)
      expect(existsSync(join(marketplaceRoot, ".agents", "plugins", "marketplace.json"))).toBe(false)
      expect(fake.calls).toEqual([])
    } finally {
      cleanup(paths)
    }
  })

  it("rolls back candidate files and state when plugin installation fails", () => {
    const paths = sandbox()
    const fake = createFakeCodex({ failPluginAdd: true })
    configure(paths, fake)
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("plugin add")
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(false)
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-product.toml"))).toBe(false)
      expect(existsSync(join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json"))).toBe(false)
      expect(existsSync(join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json"))).toBe(false)
      expect(hasCall(fake.calls, ["plugin", "marketplace", "remove", "grant-vine", "--json"])).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("reverses a successful plugin registration when install-state persistence fails", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    configure(paths, fake)
    __setCodexInstallStateWriterForTests(() => { throw new Error("injected install-state failure") })

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("injected install-state failure")
      expect(hasCall(fake.calls, ["plugin", "add", "wunderkind@grant-vine", "--json"])).toBe(true)
      expect(hasCall(fake.calls, ["plugin", "remove", "wunderkind@grant-vine", "--json"])).toBe(true)
      expect(hasCall(fake.calls, ["plugin", "marketplace", "remove", "grant-vine", "--json"])).toBe(true)
      expect(fake.marketplaces).toEqual([])
      expect(JSON.stringify(fake.lazyPlugin)).not.toContain("wunderkind@grant-vine")
      expect(existsSync(statePath)).toBe(false)
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-product.toml"))).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("recovers failed plugin rollback candidates through uninstall before a clean reinstall", () => {
    const paths = sandbox()
    const fake = createFakeCodex({ failPluginRemove: true })
    configure(paths, fake)
    __setCodexInstallStateWriterForTests(() => { throw new Error("injected install-state failure") })

    try {
      const error = captureError(() => installCodexWunderkind())

      expect(error?.message).toContain("plugin rollback failed")
      expect(hasCall(fake.calls, ["plugin", "remove", "wunderkind@grant-vine", "--json"])).toBe(true)
      expect(fake.marketplaces).toHaveLength(1)
      expect(JSON.stringify(fake.lazyPlugin)).toContain("wunderkind@grant-vine")
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-product.toml"))).toBe(true)

      __resetCodexInstallStateWriterForTests()
      Reflect.set(fake, "failPluginRemove", false)
      const recovered = uninstallCodexWunderkind()

      expect(recovered.removedAgents).toHaveLength(6)
      expect(recovered.preservedAgents).toEqual([])
      expect(recovered.marketplaceRemoved).toBe(true)
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-product.toml"))).toBe(false)
      expect(existsSync(join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json"))).toBe(false)
      expect(installCodexWunderkind().packageVersion).toBe(PACKAGE_VERSION)
    } finally {
      cleanup(paths)
    }
  })

  it("rejects a symlinked exact-byte marketplace recovery candidate before Codex removal", () => {
    const paths = sandbox()
    const fake = createFakeCodex({ failPluginRemove: true })
    configure(paths, fake)
    __setCodexInstallStateWriterForTests(() => { throw new Error("injected install-state failure") })

    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("plugin rollback failed")
      const marketplace = join(paths.wunderkindHome, "codex", "marketplace")
      const operatorMarketplace = join(paths.root, "operator-marketplace")
      const operatorDescriptor = join(operatorMarketplace, ".agents", "plugins", "marketplace.json")
      cpSync(marketplace, operatorMarketplace, { recursive: true })
      const originalDescriptor = readFileSync(operatorDescriptor, "utf8")
      rmSync(marketplace, { recursive: true, force: true })
      symlinkSync(operatorMarketplace, marketplace, "dir")

      __resetCodexInstallStateWriterForTests()
      Reflect.set(fake, "failPluginRemove", false)
      const before = fake.calls.length
      const recovered = uninstallCodexWunderkind()

      expect(recovered).toEqual({ removedAgents: [], preservedAgents: [], marketplaceRemoved: false, stateRemoved: false, recoveryRequired: true })
      expect(fake.calls.slice(before)).toEqual([])
      expect(readFileSync(operatorDescriptor, "utf8")).toBe(originalDescriptor)
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(false)
      expect(AGENT_NAMES.every((name) => existsSync(join(paths.codexHome, "agents", `${name}.toml`)))).toBe(true)
      expect(fake.marketplaces).toHaveLength(1)
      expect(JSON.stringify(fake.lazyPlugin)).toContain("wunderkind@grant-vine")
    } finally {
      __resetCodexInstallStateWriterForTests()
      cleanup(paths)
    }
  })

  it("blocks project init before writes when live plugin health or canonical agent ownership is absent", async () => {
    for (const kind of ["missing-plugin", "disabled-plugin", "noncanonical-agent"] as const) {
      const paths = sandbox()
      const fake = createFakeCodex()
      configure(paths, fake)
      const project = join(paths.root, `project-${kind}`)
      mkdirSync(project)
      try {
        installCodexWunderkind()
        if (kind === "noncanonical-agent") {
          const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
          const state = JSON.parse(readFileSync(statePath, "utf8"))
          state.agents[0].path = join(paths.root, "operator-agent.toml")
          writeFileSync(statePath, `${JSON.stringify(state)}\n`, "utf8")
        } else if (typeof fake.lazyPlugin === "object" && fake.lazyPlugin !== null && Array.isArray(Reflect.get(fake.lazyPlugin, "installed"))) {
          const installed = Reflect.get(fake.lazyPlugin, "installed")
          if (!Array.isArray(installed)) throw new Error("Expected installed plugin fixture")
          const plugin = installed.find((entry) => typeof entry === "object" && entry !== null && Reflect.get(entry, "pluginId") === "wunderkind@grant-vine")
          if (plugin === undefined || typeof plugin !== "object" || plugin === null) throw new Error("Expected Wunderkind plugin fixture")
          if (kind === "missing-plugin") installed.splice(installed.indexOf(plugin), 1)
          else Reflect.set(plugin, "enabled", false)
        } else throw new Error("Expected plugin discovery fixture")

        const readiness = getCodexGlobalInstallReadiness()
        const code = await runCodexProjectInit({ cwd: project, globalInstall: readiness, packageVersion: PACKAGE_VERSION })

        expect(readiness.healthy).toBe(false)
        expect(code).toBe(1)
        expect(existsSync(join(project, ".wunderkind", "codex-project.json"))).toBe(false)
        expect(existsSync(join(project, ".wunderkind", "runtime", "codex", "workflow-guidance.md"))).toBe(false)
      } finally {
        cleanup(paths)
      }
    }
  })

  it("rejects invalid successful plugin JSON and preserves prior Windows-path rollback state", () => {
    const invalidPaths = sandbox()
    configure(invalidPaths, createFakeCodex({ pluginAddOutput: "not json" }))
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("invalid JSON")
    } finally {
      cleanup(invalidPaths)
    }

    const schemaInvalidPaths = sandbox()
    configure(schemaInvalidPaths, createFakeCodex({ pluginAddOutput: "{}" }))
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("invalid JSON")
    } finally {
      cleanup(schemaInvalidPaths)
    }

    const paths = sandbox()
    const firstFake = createFakeCodex()
    configure(paths, firstFake)
    try {
      installCodexWunderkind()
      const stateBefore = readFileSync(join(paths.wunderkindHome, "codex", "install-state.json"), "utf8")
      const descriptor = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      const descriptorBefore = readFileSync(descriptor, "utf8")
      const agentsBefore = AGENT_NAMES.map((name) => readFileSync(join(paths.codexHome, "agents", `${name}.toml`), "utf8"))
      const failingFake = createFakeCodex({ failPluginAdd: true })
      configure(paths, failingFake)
      expect(captureError(() => installCodexWunderkind())?.message).toContain("plugin add")
      expect(readFileSync(join(paths.wunderkindHome, "codex", "install-state.json"), "utf8")).toBe(stateBefore)
      expect(readFileSync(descriptor, "utf8")).toBe(descriptorBefore)
      const agentsAfter = AGENT_NAMES.map((name) => readFileSync(join(paths.codexHome, "agents", `${name}.toml`), "utf8"))
      expect(agentsAfter).toEqual(agentsBefore)
      expect(hasCall(failingFake.calls, ["plugin", "marketplace", "remove", "grant-vine", "--json"])).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("accepts an exact contract marketplace descriptor without state and preserves it on plugin failure", () => {
    const paths = sandbox()
    const descriptor = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
    const sourceDescriptor = join(paths.payloadRoot, "marketplace", ".agents", "plugins", "marketplace.json")
    mkdirSync(join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins"), { recursive: true })
    writeFileSync(descriptor, readFileSync(sourceDescriptor))
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      expect(readFileSync(descriptor, "utf8")).toBe(readFileSync(sourceDescriptor, "utf8"))
    } finally {
      cleanup(paths)
    }

    const rollbackPaths = sandbox()
    const rollbackDescriptor = join(rollbackPaths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
    const rollbackSourceDescriptor = join(rollbackPaths.payloadRoot, "marketplace", ".agents", "plugins", "marketplace.json")
    mkdirSync(join(rollbackPaths.wunderkindHome, "codex", "marketplace", ".agents", "plugins"), { recursive: true })
    writeFileSync(rollbackDescriptor, readFileSync(rollbackSourceDescriptor))
    configure(rollbackPaths, createFakeCodex({ failPluginAdd: true }))
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("plugin add")
      expect(readFileSync(rollbackDescriptor, "utf8")).toBe(readFileSync(rollbackSourceDescriptor, "utf8"))
    } finally {
      cleanup(rollbackPaths)
    }
  })

  it("rejects parseable but schema-invalid marketplace mutation responses", () => {
    const addPaths = sandbox()
    const addFake = createFakeCodex({ marketplaceAddOutput: {} })
    configure(addPaths, addFake)
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("marketplace add returned invalid JSON")
      expect(hasCall(addFake.calls, ["plugin", "marketplace", "remove", "grant-vine", "--json"])).toBe(true)
    } finally {
      cleanup(addPaths)
    }

    const removePaths = sandbox()
    configure(removePaths, createFakeCodex({ failPluginAdd: true, marketplaceRemoveOutput: {} }))
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("marketplace remove returned invalid JSON")
    } finally {
      cleanup(removePaths)
    }
    expect(captureError(() => validateCodexPluginRemovalResponse({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine" }, { pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine" }))).toBe(undefined)
    expect(captureError(() => validateCodexPluginRemovalResponse({ pluginId: "wunderkind@grant-vine", name: "wunderkind" }, { pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine" }))?.message).toContain("plugin remove returned invalid JSON")
  })

  it("rejects nested owned-path symlinks before descriptor or immutable writes", () => {
    const descriptorPaths = sandbox(); const descriptorOutside = join(descriptorPaths.root, "outside descriptor")
    mkdirSync(join(descriptorPaths.wunderkindHome, "codex", "marketplace"), { recursive: true }); mkdirSync(descriptorOutside); symlinkSync(descriptorOutside, join(descriptorPaths.wunderkindHome, "codex", "marketplace", ".agents")); configure(descriptorPaths, createFakeCodex())
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("Unsafe Codex ownership root")
      expect(existsSync(join(descriptorOutside, "plugins", "marketplace.json"))).toBe(false)
    } finally { cleanup(descriptorPaths) }

    const immutablePaths = sandbox(); const immutableOutside = join(immutablePaths.root, "outside immutable")
    mkdirSync(join(immutablePaths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind"), { recursive: true }); mkdirSync(immutableOutside); symlinkSync(immutableOutside, join(immutablePaths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION)); configure(immutablePaths, createFakeCodex())
    try {
      expect(captureError(() => installCodexWunderkind())?.message).toContain("Unsafe Codex ownership root")
      expect(existsSync(join(immutableOutside, ".codex-plugin", "plugin.json"))).toBe(false)
    } finally { cleanup(immutablePaths) }
  })
})

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function prepareCanonicalUpgrade(paths: ReturnType<typeof sandbox>): void {
  const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
  const state: unknown = JSON.parse(readFileSync(statePath, "utf8"))
  if (!isRecord(state) || !isRecord(state["plugin"])) throw new Error("Expected valid Codex install state")
  state["packageVersion"] = "0.26.2"
  state["plugin"]["version"] = "0.26.2"
  writeFileSync(statePath, `${JSON.stringify(state)}\n`)
}

describe("Codex lifecycle upgrade and uninstall", () => {
  it("preserves a dangling immutable candidate symlink before plugin add and state mutation", () => {
    const paths = sandbox()
    const manifestPath = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json")
    const absentTarget = join(paths.root, "missing-plugin.json")
    configure(paths, createFakeCodex())

    try {
      installCodexWunderkind()
      prepareCanonicalUpgrade(paths)
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const stateBefore = readFileSync(statePath, "utf8")
      rmSync(manifestPath)
      symlinkSync(absentTarget, manifestPath)
      const fake = createFakeCodex({ pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }) })
      configure(paths, fake)

      const error = captureError(() => upgradeCodexWunderkind())

      expect(error?.message).toContain("immutable payload collision")
      expect(lstatSync(manifestPath).isSymbolicLink()).toBe(true)
      expect(existsSync(absentTarget)).toBe(false)
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(hasCall(fake.calls, ["plugin", "add", "wunderkind@grant-vine", "--json"])).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a dangling immutable payload manifest symlink before plugin add and state mutation", () => {
    const paths = sandbox()
    const manifestPath = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
    const absentTarget = join(paths.root, "missing-payload-manifest.json")
    configure(paths, createFakeCodex())

    try {
      installCodexWunderkind()
      prepareCanonicalUpgrade(paths)
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const stateBefore = readFileSync(statePath, "utf8")
      rmSync(manifestPath)
      symlinkSync(absentTarget, manifestPath)
      const fake = createFakeCodex({ pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }) })
      configure(paths, fake)

      const error = captureError(() => upgradeCodexWunderkind())

      expect(error?.message).toContain("immutable payload collision: payload manifest")
      expect(lstatSync(manifestPath).isSymbolicLink()).toBe(true)
      expect(existsSync(absentTarget)).toBe(false)
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(hasCall(fake.calls, ["plugin", "add", "wunderkind@grant-vine", "--json"])).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("upgrades a hash-owned installation and rolls descriptor and agents back after a plugin failure", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      prepareCanonicalUpgrade(paths)
      configure(paths, createFakeCodex({ pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }) }))
      const upgraded = upgradeCodexWunderkind()
      expect(upgraded).toEqual({ packageVersion: PACKAGE_VERSION, upgraded: true })

      const agentsBeforeFailure = AGENT_NAMES.map((name) => readFileSync(join(paths.codexHome, "agents", `${name}.toml`), "utf8"))
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      const descriptorBeforeFailure = readFileSync(descriptorPath, "utf8")
      prepareCanonicalUpgrade(paths)
      const stateBeforeFailure = readFileSync(statePath, "utf8")
      configure(paths, createFakeCodex({ failPluginAdd: true }))
      expect(captureError(() => upgradeCodexWunderkind())?.message).toContain("plugin add")
      expect(readFileSync(statePath, "utf8")).toBe(stateBeforeFailure)
      expect(readFileSync(descriptorPath, "utf8")).toBe(descriptorBeforeFailure)
      expect(AGENT_NAMES.map((name) => readFileSync(join(paths.codexHome, "agents", `${name}.toml`), "utf8"))).toEqual(agentsBeforeFailure)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves immutable plugin bytes changed during successful upgrade plugin add without publishing ownership", () => {
    const paths = sandbox()
    const pluginManifest = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json")
    const skill = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md")
    const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
    const changedPluginManifest = "{\"name\":\"operator-upgrade-change\"}\n"
    const changedSkill = "operator-upgrade skill\n"
    configure(paths, createFakeCodex())

    try {
      installCodexWunderkind()
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      configure(paths, createFakeCodex({
        pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }),
        onRun(argv) {
          if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") {
            writeFileSync(pluginManifest, changedPluginManifest, "utf8")
            writeFileSync(skill, changedSkill, "utf8")
          }
        },
      }))

      const error = captureError(() => upgradeCodexWunderkind())

      expect(error?.message).toContain("immutable payload changed during plugin add")
      expect(readFileSync(pluginManifest, "utf8")).toBe(changedPluginManifest)
      expect(readFileSync(skill, "utf8")).toBe(changedSkill)
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(getCodexDoctorReport().core.healthy).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves modified agents and shared or mismatched marketplaces on uninstall", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)
    try {
      installCodexWunderkind()
      const modified = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
      writeFileSync(modified, "operator change", "utf8")
      fake.marketplaces.push({ name: "grant-vine", path: join(paths.wunderkindHome, "codex", "marketplace") })
      if (typeof fake.lazyPlugin !== "object" || fake.lazyPlugin === null || !Array.isArray(Reflect.get(fake.lazyPlugin, "installed"))) throw new Error("Expected plugin fixture")
      const installed = Reflect.get(fake.lazyPlugin, "installed")
      if (!Array.isArray(installed)) throw new Error("Expected installed plugin fixture")
      installed.push({ pluginId: "other@grant-vine", version: "1.0.0", installed: true, enabled: true, marketplaceSource: "grant-vine" })
      const removed = uninstallCodexWunderkind()
      expect(removed.preservedAgents).toEqual(["wunderkind-ciso"])
      expect(removed.marketplaceRemoved).toBe(false)
      expect(removed.stateRemoved).toBe(false)
      expect(readFileSync(modified, "utf8")).toBe("operator change")
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("keeps a shared marketplace descriptor, payload, and recovery state coherent after uninstall", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)
    try {
      installCodexWunderkind()
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      const payloadPath = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const descriptor = readFileSync(descriptorPath, "utf8")
      const payload = readFileSync(payloadPath, "utf8")
      const state = readFileSync(statePath, "utf8")
      if (typeof fake.lazyPlugin !== "object" || fake.lazyPlugin === null || !Array.isArray(Reflect.get(fake.lazyPlugin, "installed"))) throw new Error("Expected plugin fixture")
      const installed = Reflect.get(fake.lazyPlugin, "installed")
      if (!Array.isArray(installed)) throw new Error("Expected installed plugin fixture")
      installed.push({ pluginId: "other@grant-vine", version: "1.0.0", installed: true, enabled: true, marketplaceSource: "grant-vine" })

      const removed = uninstallCodexWunderkind()

      expect(removed.marketplaceRemoved).toBe(false)
      expect(removed.stateRemoved).toBe(false)
      expect(removed.recoveryRequired).toBe(true)
      expect(removed.removedAgents).toHaveLength(6)
      expect(readFileSync(descriptorPath, "utf8")).toBe(descriptor)
      expect(readFileSync(payloadPath, "utf8")).toBe(payload)
      expect(readFileSync(statePath, "utf8")).toBe(state)
      expect(fake.marketplaces).toEqual([{ name: "grant-vine", path: join(paths.wunderkindHome, "codex", "marketplace") }])
      expect(installed.some((entry) => typeof entry === "object" && entry !== null && Reflect.get(entry, "pluginId") === "other@grant-vine")).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("rejects an upgrade with a modified agent and preserves a marketplace with a mismatched root", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)
    try {
      installCodexWunderkind()
      writeFileSync(join(paths.codexHome, "agents", "wunderkind-ciso.toml"), "operator change", "utf8")
      prepareCanonicalUpgrade(paths)
      expect(captureError(() => upgradeCodexWunderkind())?.message).toContain("modified")
      const marketplace = fake.marketplaces.find((entry) => typeof entry === "object" && entry !== null && Reflect.get(entry, "name") === "grant-vine")
      if (marketplace === undefined || typeof marketplace !== "object" || marketplace === null) throw new Error("Expected grant-vine marketplace fixture")
      Reflect.set(marketplace, "path", join(paths.root, "foreign-marketplace"))
      const removed = uninstallCodexWunderkind()
      expect(removed.marketplaceRemoved).toBe(false)
      expect(readFileSync(join(paths.codexHome, "agents", "wunderkind-ciso.toml"), "utf8")).toBe("operator change")
    } finally {
      cleanup(paths)
    }
  })

  it("rejects duplicate stale ownership before upgrading and preserves an unrecorded modified canonical agent", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const state = JSON.parse(readFileSync(statePath, "utf8"))
      state.agents = Array.from({ length: 6 }, () => state.agents[0])
      writeFileSync(statePath, `${JSON.stringify(state)}\n`)
      const ciso = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
      writeFileSync(ciso, "operator-owned bytes", "utf8")
      prepareCanonicalUpgrade(paths)
      expect(captureError(() => upgradeCodexWunderkind())?.message).toContain("unsafe agent record")
      expect(readFileSync(ciso, "utf8")).toBe("operator-owned bytes")
    } finally {
      cleanup(paths)
    }
  })

  it("rejects out-of-root, wrong-name, duplicate, missing-record, and symlink uninstall state without deleting local files", () => {
    const cases = ["out-of-root", "wrong-name", "duplicate", "missing-record", "symlink"] as const
    for (const kind of cases) {
      const paths = sandbox()
      configure(paths, createFakeCodex())
      try {
        installCodexWunderkind()
        const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
        const state = JSON.parse(readFileSync(statePath, "utf8"))
        const operator = join(paths.root, "operator-important.txt")
        writeFileSync(operator, "operator-owned bytes", "utf8")
        if (kind === "out-of-root") {
          state.agents[0].path = operator
          state.agents[0].sha256 = hash("operator-owned bytes")
        } else if (kind === "wrong-name") state.agents[0].name = "foreign-agent"
        else if (kind === "duplicate") state.agents[1] = state.agents[0]
        else if (kind === "missing-record") state.agents.pop()
        else {
          const target = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
          rmSync(target)
          symlinkSync(operator, target)
        }
        writeFileSync(statePath, `${JSON.stringify(state)}\n`)
        expect(captureError(() => uninstallCodexWunderkind()) instanceof Error).toBe(true)
        expect(readFileSync(operator, "utf8")).toBe("operator-owned bytes")
      } finally {
        cleanup(paths)
      }
    }
  })

  it("retains recovery state and manifest when a hash-owned payload file was modified", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const payload = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md")
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const manifestPath = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
      writeFileSync(payload, "operator-modified payload bytes", "utf8")
      const result = uninstallCodexWunderkind()
      expect(result.recoveryRequired).toBe(true)
      expect(result.stateRemoved).toBe(false)
      expect(readFileSync(payload, "utf8")).toBe("operator-modified payload bytes")
      expect(existsSync(statePath)).toBe(true)
      expect(existsSync(manifestPath)).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("rejects non-canonical marketplace and plugin state before every external removal command", () => {
    for (const kind of ["marketplace", "plugin"] as const) {
      const paths = sandbox()
      const fake = createFakeCodex()
      configure(paths, fake)
      try {
        installCodexWunderkind()
        const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
        const state = JSON.parse(readFileSync(statePath, "utf8"))
        if (kind === "marketplace") { state.marketplace.name = "operator-market"; state.marketplace.root = join(paths.root, "operator-market") }
        else { state.plugin.id = "operator-plugin"; state.plugin.version = "9.9.9" }
        writeFileSync(statePath, `${JSON.stringify(state)}\n`)
        const before = fake.calls.length
        expect(captureError(() => uninstallCodexWunderkind()) instanceof Error).toBe(true)
        expect(fake.calls.slice(before)).toEqual([])
      } finally {
        cleanup(paths)
      }
    }
  })

  it("preserves external payload bytes and recovery state when a payload ancestor is symlinked", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const internal = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind")
      const external = join(paths.root, "operator-skill")
      mkdirSync(external, { recursive: true })
      const externalSkill = join(external, "SKILL.md")
      writeFileSync(externalSkill, readFileSync(join(internal, "SKILL.md")))
      rmSync(internal, { recursive: true, force: true })
      symlinkSync(external, internal)
      const result = uninstallCodexWunderkind()
      expect(result.recoveryRequired).toBe(true)
      expect(readFileSync(externalSkill, "utf8")).not.toBe("")
      expect(existsSync(join(paths.wunderkindHome, "codex", "install-state.json"))).toBe(true)
    } finally { cleanup(paths) }
  })

  it("rejects malformed internally-equal package and plugin versions before external mutation", () => {
    for (const version of ["../../operator-version", "0.27.1-beta.1", "0.027.1"] as const) {
      const paths = sandbox(); const fake = createFakeCodex(); configure(paths, fake)
      try {
        installCodexWunderkind()
        const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
        const state = JSON.parse(readFileSync(statePath, "utf8"))
        state.packageVersion = version; state.plugin.version = version
        writeFileSync(statePath, `${JSON.stringify(state)}\n`)
        const ciso = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
        const before = readFileSync(ciso, "utf8"); const calls = fake.calls.length
        expect(captureError(() => uninstallCodexWunderkind()) instanceof Error).toBe(true)
        expect(fake.calls.slice(calls)).toEqual([])
        expect(readFileSync(ciso, "utf8")).toBe(before)
      } finally { cleanup(paths) }
    }
  })

  it("preserves a pre-modified descriptor and blocks upgrade before plugin add", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      writeFileSync(descriptorPath, "operator descriptor edit", "utf8")
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      const calls = fake.calls.length
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(descriptorPath, "utf8")).toBe("operator descriptor edit")
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(hasCall(fake.calls.slice(calls), ["plugin", "add", "wunderkind@grant-vine", "--json"])).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a descriptor changed during Codex version discovery before candidate writes", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      const fake = createFakeCodex({
        onRun(argv) {
          if (argv.join("\u0000") === "--version") writeFileSync(descriptorPath, "operator descriptor after version", "utf8")
        },
      })
      configure(paths, fake)
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(descriptorPath, "utf8")).toBe("operator descriptor after version")
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      expect(hasCall(fake.calls, ["plugin", "add", "wunderkind@grant-vine", "--json"])).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("rejects payload bytes changed during Codex version discovery before upgrade ownership publication", () => {
    const paths = sandbox()
    const cisoPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    const payloadCisoPath = join(paths.payloadRoot, "agents", "wunderkind-ciso.toml")
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      prepareCanonicalUpgrade(paths)
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const stateBefore = readFileSync(statePath, "utf8")
      const agentBefore = readFileSync(cisoPath, "utf8")
      configure(paths, createFakeCodex({
        onRun(argv) {
          if (argv.join("\u0000") === "--version") {
            writeFileSync(payloadCisoPath, "tampered payload after verification\n", "utf8")
          }
        },
      }))

      const error = captureError(() => upgradeCodexWunderkind())

      expect(error?.message).toContain("digest mismatch")
      expect(readFileSync(cisoPath, "utf8")).toBe(agentBefore)
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves install state changed during successful plugin add and declines the upgrade", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const cisoPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
      const cisoBefore = readFileSync(cisoPath, "utf8")
      prepareCanonicalUpgrade(paths)
      configure(paths, createFakeCodex({
        pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }),
        onRun(argv) {
          if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") writeFileSync(statePath, "operator state edit", "utf8")
        },
      }))
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(statePath, "utf8")).toBe("operator state edit")
      expect(readFileSync(cisoPath, "utf8")).toBe(cisoBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a concurrent descriptor edit after failed plugin add and reports recovery", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      configure(paths, createFakeCodex({
        failPluginAdd: true,
        onRun(argv) {
          if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") writeFileSync(descriptorPath, "operator descriptor edit", "utf8")
        },
      }))
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(descriptorPath, "utf8")).toBe("operator descriptor edit")
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a concurrent descriptor edit after successful plugin add and declines the upgrade", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      configure(paths, createFakeCodex({
        pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }),
        onRun(argv) {
          if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") writeFileSync(descriptorPath, "operator descriptor edit", "utf8")
        },
      }))
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(descriptorPath, "utf8")).toBe("operator descriptor edit")
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a concurrent agent edit after successful plugin add and leaves prior ownership state", () => {
    const paths = sandbox()
    const ciso = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      configure(paths, createFakeCodex({
        pluginAddOutput: JSON.stringify({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind" }),
        onRun(argv) {
          if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") writeFileSync(ciso, "operator concurrent edit", "utf8")
        },
      }))
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(ciso, "utf8")).toBe("operator concurrent edit")
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
      const removed = uninstallCodexWunderkind()
      expect(removed.preservedAgents).toContain("wunderkind-ciso")
      expect(readFileSync(ciso, "utf8")).toBe("operator concurrent edit")
    } finally {
      cleanup(paths)
    }
  })

  it("preserves a concurrent agent edit after failed plugin add and reports incomplete recovery", () => {
    const paths = sandbox()
    const ciso = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      prepareCanonicalUpgrade(paths)
      const stateBefore = readFileSync(statePath, "utf8")
      configure(paths, createFakeCodex({
        failPluginAdd: true,
        onRun(argv) {
          if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") writeFileSync(ciso, "operator concurrent edit", "utf8")
        },
      }))
      const error = captureError(() => upgradeCodexWunderkind())
      expect(error?.message).toContain("recovery")
      expect(readFileSync(ciso, "utf8")).toBe("operator concurrent edit")
      expect(readFileSync(statePath, "utf8")).toBe(stateBefore)
    } finally {
      cleanup(paths)
    }
  })

  it("retains install state changed during uninstall for recovery", () => {
    const paths = sandbox()
    let statePath = ""
    const fake = createFakeCodex({
      onRun(argv) {
        if (argv.join("\u0000") === "plugin\u0000remove\u0000wunderkind@grant-vine\u0000--json" && statePath !== "") {
          writeFileSync(statePath, "operator recovery note", "utf8")
        }
      },
    })
    configure(paths, fake)
    try {
      installCodexWunderkind()
      statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const result = uninstallCodexWunderkind()
      expect(result.stateRemoved).toBe(false)
      expect(result.recoveryRequired).toBe(true)
      expect(readFileSync(statePath, "utf8")).toBe("operator recovery note")
    } finally {
      cleanup(paths)
    }
  })

  it("removes a clean owned installation and is repeat-safe with exact plugin argv", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)
    try {
      installCodexWunderkind()
      const first = uninstallCodexWunderkind()
      const second = uninstallCodexWunderkind()
      expect(first.removedAgents).toHaveLength(6)
      expect(first.preservedAgents).toEqual([])
      expect(first.stateRemoved).toBe(true)
      expect(second).toEqual({ removedAgents: [], preservedAgents: [], marketplaceRemoved: false, stateRemoved: false })
      expect(hasCall(fake.calls, ["plugin", "remove", "wunderkind@grant-vine", "--json"])).toBe(true)
      expect(existsSync(join(paths.codexHome, "agents", "wunderkind-ciso.toml"))).toBe(false)
    } finally {
      cleanup(paths)
    }
  })
})
