import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CODEX_CAPABILITY_MANIFEST } from "../../src/codex/capability-manifest.js"
import { getCodexDoctorReport, runCodexDoctor } from "../../src/cli/codex/doctor.js"
import { installCodexWunderkind } from "../../src/cli/codex/install.js"
import { __setCodexProcessRunnerForTests } from "../../src/cli/codex/process.js"
import { sha256File } from "../../src/cli/codex/state.js"
import { PACKAGE_VERSION, cleanup, configure, createFakeCodex, createLazyCodexEnvelope, sandbox } from "./helpers/codex-lifecycle-fixtures.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function installedPlugins(fixture: ReturnType<typeof createFakeCodex>): unknown[] {
  if (!isRecord(fixture.lazyPlugin)) throw new Error("Expected plugin fixture")
  const installed = Reflect.get(fixture.lazyPlugin, "installed")
  if (!Array.isArray(installed)) throw new Error("Expected installed plugin fixture")
  return installed
}

function installedPlugin(fixture: ReturnType<typeof createFakeCodex>, pluginId: string): Record<string, unknown> {
  const plugin = installedPlugins(fixture).find((candidate) => isRecord(candidate) && candidate["pluginId"] === pluginId)
  if (!isRecord(plugin)) throw new Error(`Expected ${pluginId} fixture`)
  return plugin
}

function removeInstalledPlugin(fixture: ReturnType<typeof createFakeCodex>, pluginId: string): void {
  const plugins = installedPlugins(fixture)
  const index = plugins.findIndex((entry) => isRecord(entry) && entry["pluginId"] === pluginId)
  if (index === -1) throw new Error(`Expected ${pluginId} fixture`)
  plugins.splice(index, 1)
}

describe("Codex doctor", () => {
  it("reports a versioned, redacted JSON health result without mutating a current install", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const agentPath = join(paths.codexHome, "agents", "wunderkind-ciso.toml")
      const descriptorPath = join(paths.wunderkindHome, "codex", "marketplace", ".agents", "plugins", "marketplace.json")
      const manifestPath = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
      const before = [readFileSync(statePath, "utf8"), readFileSync(agentPath, "utf8"), readFileSync(descriptorPath, "utf8"), readFileSync(manifestPath, "utf8")]
      const report = getCodexDoctorReport()
      expect(report.schemaVersion).toBe(1)
      expect(report.core.healthy).toBe(true)
      expect(report.core.codex.status).toBe("enabled")
      expect(report.core.lazyCodex.status).toBe("enabled")
      expect(report.core.marketplace.status).toBe("enabled")
      expect(report.core.plugin.status).toBe("enabled")
      expect(Object.keys(report.core.agents)).toHaveLength(6)
      expect(Object.keys(report.core.skills)).toHaveLength(11)
      expect(report.paths).toBeUndefined()
      expect(JSON.stringify(report)).not.toContain(paths.wunderkindHome)
      expect(JSON.stringify(report)).not.toContain(paths.codexHome)
      expect([readFileSync(statePath, "utf8"), readFileSync(agentPath, "utf8"), readFileSync(descriptorPath, "utf8"), readFileSync(manifestPath, "utf8")]).toEqual(before)
    } finally {
      cleanup(paths)
    }
  })

  it("accepts installer-supported LazyCodex build metadata as healthy", () => {
    const paths = sandbox()
    const fake = createFakeCodex({ lazyPlugin: createLazyCodexEnvelope("4.19.4+build.9") })
    configure(paths, fake)
    try {
      installCodexWunderkind()
      const report = getCodexDoctorReport()
      expect(report.core.healthy).toBe(true)
      expect(report.core.lazyCodex.version).toBe("4.19.4+build.9")
      expect(report.remediation).toEqual([])
    } finally {
      cleanup(paths)
    }
  })

  it("rejects LazyCodex versions the installer rejects", () => {
    for (const version of ["04.19.4", "4.19.4-beta.1", "4.19.4+", "5.0.0"] as const) {
      const paths = sandbox()
      const fake = createFakeCodex()
      configure(paths, fake)
      try {
        installCodexWunderkind()
        Reflect.set(installedPlugin(fake, "omo@sisyphuslabs"), "version", version)
        const report = getCodexDoctorReport()
        expect(report.core.healthy).toBe(false)
        expect(report.remediation).toContain("Install LazyCodex (`omo@sisyphuslabs`) at version `>=4.19.4 <5`, then rerun `wunderkind codex doctor`.")
      } finally {
        cleanup(paths)
      }
    }
  })

  it("reports a valid canonical Codex project marker as ready without mutation", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    const originalCwd = process.cwd()
    try {
      installCodexWunderkind()
      const markerPath = join(paths.root, ".wunderkind", "codex-project.json")
      mkdirSync(join(paths.root, ".wunderkind"), { recursive: true })
      const marker = `${JSON.stringify({ schemaVersion: 1, packageVersion: PACKAGE_VERSION, runtimeFiles: [] })}\n`
      writeFileSync(markerPath, marker, "utf8")
      process.chdir(paths.root)
      expect(getCodexDoctorReport().core.projectBootstrap.ready).toBe(true)
      expect(readFileSync(markerPath, "utf8")).toBe(marker)
    } finally {
      process.chdir(originalCwd)
      cleanup(paths)
    }
  })

  it("treats contradictory installed-false core plugin records as unhealthy", () => {
    const paths = sandbox()
    const fake = createFakeCodex()
    configure(paths, fake)
    try {
      installCodexWunderkind()
      if (typeof fake.lazyPlugin !== "object" || fake.lazyPlugin === null || !Array.isArray(Reflect.get(fake.lazyPlugin, "installed"))) throw new Error("Expected plugin fixture")
      const installed = Reflect.get(fake.lazyPlugin, "installed")
      if (!Array.isArray(installed)) throw new Error("Expected installed plugins")
      for (const id of ["omo@sisyphuslabs", "wunderkind@grant-vine"]) {
        const entry = installed.find((candidate) => typeof candidate === "object" && candidate !== null && Reflect.get(candidate, "pluginId") === id)
        if (entry === undefined || typeof entry !== "object" || entry === null) throw new Error("Expected core plugin")
        Reflect.set(entry, "installed", false)
        Reflect.set(entry, "enabled", true)
      }
      const report = getCodexDoctorReport()
      expect(report.core.healthy).toBe(false)
      expect(report.core.lazyCodex.status).not.toBe("enabled")
      expect(report.core.plugin.status).not.toBe("enabled")
      expect(report.remediation).not.toEqual([])
    } finally {
      cleanup(paths)
    }
  })

  it("treats malformed or structurally invalid Codex project markers as not ready without mutation", () => {
    const cases = [
      "not-json",
      JSON.stringify({ schemaVersion: 2, packageVersion: PACKAGE_VERSION, runtimeFiles: [] }),
      JSON.stringify({ schemaVersion: 1, packageVersion: PACKAGE_VERSION, runtimeFiles: [{ path: "../escape", sha256: "0".repeat(64) }] }),
      JSON.stringify({ schemaVersion: 1, packageVersion: "not-semver", runtimeFiles: [] }),
      JSON.stringify({ schemaVersion: 1, packageVersion: PACKAGE_VERSION, runtimeFiles: [{ path: "workflow-guidance.md", sha256: "not-a-sha" }] }),
    ] as const
    const originalCwd = process.cwd()
    for (const marker of cases) {
      const paths = sandbox()
      configure(paths, createFakeCodex())
      try {
        const markerPath = join(paths.root, ".wunderkind", "codex-project.json")
        mkdirSync(join(paths.root, ".wunderkind"), { recursive: true })
        writeFileSync(markerPath, marker, "utf8")
        process.chdir(paths.root)
        expect(getCodexDoctorReport().core.projectBootstrap.ready).toBe(false)
        expect(readFileSync(markerPath, "utf8")).toBe(marker)
      } finally {
        process.chdir(originalCwd)
        cleanup(paths)
      }
    }
  })

  it("distinguishes missing and modified core agents while keeping companions optional", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      writeFileSync(join(paths.codexHome, "agents", "wunderkind-ciso.toml"), "changed", "utf8")
      const report = getCodexDoctorReport()
      expect(report.core.healthy).toBe(false)
      expect(report.core.agents["wunderkind-ciso"]).toBe("stale-owned")
      expect("unavailable" in report.optional).toBe(false)
    } finally {
      cleanup(paths)
    }
  })

  it("reports a modified owned plugin manifest as unhealthy with payload remediation", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const pluginManifest = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, ".codex-plugin", "plugin.json")
      writeFileSync(pluginManifest, "{\"name\":\"operator-change\"}\n", "utf8")

      const report = getCodexDoctorReport()

      expect(report.core.healthy).toBe(false)
      expect(report.core.pluginManifest).toBe("modified")
      expect(report.remediation).toContain("Restore modified Wunderkind payload files from a trusted package copy, then rerun `wunderkind codex doctor`.")
    } finally {
      cleanup(paths)
    }
  })

  it("classifies optional plugins and documented skill-root packs without installing them", () => {
    const paths = sandbox()
    const fake = createFakeCodex({
      lazyPlugin: {
        installed: [
          { pluginId: "omo@sisyphuslabs", version: "4.19.4", installed: true, enabled: true },
          { pluginId: "github@openai-curated", version: "1.0.0", installed: true, enabled: false },
          { pluginId: "figma@openai-curated", version: "1.0.0", installed: true, enabled: true },
        ],
        available: [{ pluginId: "vercel@openai-curated" }],
      },
    })
    configure(paths, fake)
    try {
      installCodexWunderkind()
      mkdirSync(join(paths.codexHome, "skills", "grill-me"), { recursive: true })
      mkdirSync(join(paths.codexHome, "skills", "supabase"), { recursive: true })
      mkdirSync(join(paths.codexHome, "skills", "supabase-postgres-best-practices"), { recursive: true })
      mkdirSync(join(paths.codexHome, "skills", "vercel"), { recursive: true })
      const report = getCodexDoctorReport()
      if ("unavailable" in report.optional) throw new Error("Expected companion report")
      expect(report.optional.plugins["github@openai-curated"]).toBe("installed")
      expect(report.optional.plugins["figma@openai-curated"]).toBe("enabled")
      expect(report.optional.plugins["vercel@openai-curated"]).toBe("available")
      expect(report.optional.plugins["sentry@openai-curated"]).toBe("absent")
      expect(report.optional.matt).toBe("absent")
      expect(report.optional.supabasePack).toBe("absent")
      expect(report.optional.vercelPack).toBe("absent")
      expect(existsSync(join(paths.codexHome, "skills", "grill-me"))).toBe(true)
    } finally {
      cleanup(paths)
    }
  })

  it("requires regular SKILL.md files for complete companion packs", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const root = join(paths.codexHome, "skills")
      for (const name of [...CODEX_CAPABILITY_MANIFEST.optionalCompanions.mattSkills, ...CODEX_CAPABILITY_MANIFEST.optionalCompanions.supabaseSkills, "vercel"]) {
        const directory = join(root, name)
        mkdirSync(directory, { recursive: true })
        writeFileSync(join(directory, "SKILL.md"), "---\nname: test\n---\n", "utf8")
      }
      const report = getCodexDoctorReport()
      if ("unavailable" in report.optional) throw new Error("Expected companion report")
      expect(report.optional.matt).toBe("enabled")
      expect(report.optional.supabasePack).toBe("enabled")
      expect(report.optional.vercelPack).toBe("enabled")
    } finally {
      cleanup(paths)
    }
  })

  it("does not count a symlinked companion SKILL.md as installed", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      installCodexWunderkind()
      const external = join(paths.root, "external-skill.md")
      writeFileSync(external, "---\nname: external\n---\n", "utf8")
      const directory = join(paths.codexHome, "skills", "grill-me")
      mkdirSync(directory, { recursive: true })
      symlinkSync(external, join(directory, "SKILL.md"))
      const report = getCodexDoctorReport()
      if ("unavailable" in report.optional) throw new Error("Expected companion report")
      expect(report.optional.matt).toBe("absent")
    } finally {
      cleanup(paths)
    }
  })

  it("does not follow a symlinked repository .codex ancestor to external companion packs", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    const originalCwd = process.cwd()
    try {
      const externalCodex = join(paths.root, "external-codex")
      for (const name of CODEX_CAPABILITY_MANIFEST.optionalCompanions.mattSkills) {
        const directory = join(externalCodex, "skills", name)
        mkdirSync(directory, { recursive: true })
        writeFileSync(join(directory, "SKILL.md"), "---\nname: external\n---\n", "utf8")
      }
      symlinkSync(externalCodex, join(paths.root, ".codex"))
      process.chdir(paths.root)
      const report = getCodexDoctorReport()
      if ("unavailable" in report.optional) throw new Error("Expected companion report")
      expect(report.optional.matt).toBe("absent")
      expect(readFileSync(join(externalCodex, "skills", "grill-me", "SKILL.md"), "utf8")).toContain("external")
    } finally {
      process.chdir(originalCwd)
      cleanup(paths)
    }
  })

  it("does not follow a symlinked CODEX_HOME ancestor to external companion packs", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    try {
      const externalCodex = join(paths.root, "external-codex")
      for (const name of [...CODEX_CAPABILITY_MANIFEST.optionalCompanions.supabaseSkills, "vercel"]) {
        const directory = join(externalCodex, "skills", name)
        mkdirSync(directory, { recursive: true })
        writeFileSync(join(directory, "SKILL.md"), "---\nname: external\n---\n", "utf8")
      }
      symlinkSync(externalCodex, paths.codexHome)
      const report = getCodexDoctorReport()
      if ("unavailable" in report.optional) throw new Error("Expected companion report")
      expect(report.optional.supabasePack).toBe("absent")
      expect(report.optional.vercelPack).toBe("absent")
      expect(readFileSync(join(externalCodex, "skills", "vercel", "SKILL.md"), "utf8")).toContain("external")
    } finally {
      cleanup(paths)
    }
  })

  it("fails core health for LazyCodex, plugin, marketplace, and recorded-manifest drift", () => {
    for (const kind of ["lazy", "plugin", "marketplace", "manifest", "skill-and-manifest"] as const) {
      const paths = sandbox()
      const fake = createFakeCodex()
      configure(paths, fake)
      try {
        installCodexWunderkind()
        const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
        if (kind === "lazy" || kind === "plugin") {
          if (typeof fake.lazyPlugin !== "object" || fake.lazyPlugin === null || !Array.isArray(Reflect.get(fake.lazyPlugin, "installed"))) throw new Error("Expected plugin fixture")
          const installed = Reflect.get(fake.lazyPlugin, "installed")
          if (!Array.isArray(installed)) throw new Error("Expected installed fixture")
          const id = kind === "lazy" ? "omo@sisyphuslabs" : "wunderkind@grant-vine"
          const entry = installed.find((candidate) => typeof candidate === "object" && candidate !== null && Reflect.get(candidate, "pluginId") === id)
          if (entry === undefined || typeof entry !== "object" || entry === null) throw new Error("Expected installed plugin")
          Reflect.set(entry, "version", kind === "lazy" ? "5.0.0" : "0.1.0")
        } else if (kind === "marketplace") {
          const entry = fake.marketplaces.find((candidate) => typeof candidate === "object" && candidate !== null && Reflect.get(candidate, "name") === "grant-vine")
          if (entry === undefined || typeof entry !== "object" || entry === null) throw new Error("Expected marketplace fixture")
          Reflect.set(entry, "path", join(paths.root, "foreign-root"))
        } else if (kind === "manifest") {
          const state = JSON.parse(readFileSync(statePath, "utf8"))
          state.payloadManifestSha256 = "0".repeat(64)
          writeFileSync(statePath, `${JSON.stringify(state)}\n`)
        } else {
          const manifest = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "payload-manifest.json")
          const skill = join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md")
          writeFileSync(skill, "operator-modified skill", "utf8")
          const payload = JSON.parse(readFileSync(manifest, "utf8"))
          const entry = payload.files.find((candidate: { path: string }) => candidate.path.endsWith("skills/wunderkind/SKILL.md"))
          if (entry === undefined) throw new Error("Expected skill manifest entry")
          entry.sha256 = sha256File(skill)
          writeFileSync(manifest, `${JSON.stringify(payload, null, 2)}\n`)
        }
        const report = getCodexDoctorReport()
        expect(report.core.healthy).toBe(false)
        if (kind === "manifest" || kind === "skill-and-manifest") expect(report.core.skills["wunderkind"]).toBe("modified")
      } finally {
        cleanup(paths)
      }
    }
  })

  it("returns a distinct exact remediation for every blocking core failure class", () => {
    const cases: readonly {
      readonly name: string
      readonly setup: (paths: ReturnType<typeof sandbox>, fixture: ReturnType<typeof createFakeCodex>) => void
      readonly remediation: string
    }[] = [
      {
        name: "missing LazyCodex",
        setup: (_paths, fixture) => { removeInstalledPlugin(fixture, "omo@sisyphuslabs") },
        remediation: "Install LazyCodex (`omo@sisyphuslabs`) at version `>=4.19.4 <5`, enable it in Codex, then rerun `wunderkind codex doctor`.",
      },
      {
        name: "disabled LazyCodex",
        setup: (_paths, fixture) => { Reflect.set(installedPlugin(fixture, "omo@sisyphuslabs"), "enabled", false) },
        remediation: "Enable LazyCodex (`omo@sisyphuslabs`) in Codex, then rerun `wunderkind codex doctor`.",
      },
      {
        name: "incompatible LazyCodex",
        setup: (_paths, fixture) => { Reflect.set(installedPlugin(fixture, "omo@sisyphuslabs"), "version", "5.0.0") },
        remediation: "Install LazyCodex (`omo@sisyphuslabs`) at version `>=4.19.4 <5`, then rerun `wunderkind codex doctor`.",
      },
      {
        name: "missing Wunderkind plugin",
        setup: (_paths, fixture) => { removeInstalledPlugin(fixture, "wunderkind@grant-vine") },
        remediation: "Run `wunderkind codex install` to add `wunderkind@grant-vine`, then rerun `wunderkind codex doctor`.",
      },
      {
        name: "disabled Wunderkind plugin",
        setup: (_paths, fixture) => { Reflect.set(installedPlugin(fixture, "wunderkind@grant-vine"), "enabled", false) },
        remediation: "Enable `wunderkind@grant-vine` in Codex, then rerun `wunderkind codex doctor`.",
      },
      {
        name: "Wunderkind plugin version drift",
        setup: (_paths, fixture) => { Reflect.set(installedPlugin(fixture, "wunderkind@grant-vine"), "version", "0.1.0") },
        remediation: "Run `wunderkind codex install` to re-register the recorded Wunderkind plugin version, then rerun `wunderkind codex doctor`.",
      },
      {
        name: "marketplace root mismatch",
        setup: (paths, fixture) => {
          const marketplace = fixture.marketplaces.find((entry) => typeof entry === "object" && entry !== null && Reflect.get(entry, "name") === "grant-vine")
          if (marketplace === undefined || typeof marketplace !== "object" || marketplace === null) throw new Error("Expected marketplace fixture")
          Reflect.set(marketplace, "path", join(paths.root, "other-marketplace"))
        },
        remediation: "Resolve the `grant-vine` marketplace root mismatch with the Codex CLI without removing third-party plugins, then rerun `wunderkind codex install`.",
      },
      {
        name: "agent drift",
        setup: (paths) => { writeFileSync(join(paths.codexHome, "agents", "wunderkind-ciso.toml"), "operator change", "utf8") },
        remediation: "Restore modified Wunderkind agent files from a trusted package copy before running `wunderkind codex upgrade`.",
      },
      {
        name: "payload drift",
        setup: (paths) => { writeFileSync(join(paths.wunderkindHome, "codex", "marketplace", "plugins", "wunderkind", PACKAGE_VERSION, "skills", "wunderkind", "SKILL.md"), "operator change", "utf8") },
        remediation: "Restore modified Wunderkind payload files from a trusted package copy, then rerun `wunderkind codex doctor`.",
      },
    ]

    for (const testCase of cases) {
      const paths = sandbox()
      const fixture = createFakeCodex()
      configure(paths, fixture)
      try {
        installCodexWunderkind()
        testCase.setup(paths, fixture)
        expect(getCodexDoctorReport().remediation).toEqual([testCase.remediation])
      } finally {
        cleanup(paths)
      }
    }
  })

  it("returns exact recovery guidance for missing or invalid state and an unavailable Codex CLI", () => {
    const cases: readonly {
      readonly name: string
      readonly setup: (paths: ReturnType<typeof sandbox>) => void
      readonly remediation: readonly string[]
    }[] = [
      {
        name: "missing state",
        setup: (paths) => { rmSync(join(paths.wunderkindHome, "codex", "install-state.json")) },
        remediation: ["Run `wunderkind codex install` only when no existing `wunderkind-*` agents need preservation; otherwise recover `~/.wunderkind/codex/install-state.json` first."],
      },
      {
        name: "invalid state",
        setup: (paths) => {
          const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
          const state: unknown = JSON.parse(readFileSync(statePath, "utf8"))
          if (!isRecord(state) || !isRecord(state["marketplace"])) throw new Error("Expected install state fixture")
          state["marketplace"]["name"] = "invalid-marketplace"
          writeFileSync(statePath, `${JSON.stringify(state)}\n`, "utf8")
        },
        remediation: ["Repair or restore `~/.wunderkind/codex/install-state.json`; do not overwrite existing `wunderkind-*` agents. Then run `wunderkind codex install`."],
      },
      {
        name: "unavailable Codex CLI",
        setup: () => {
          __setCodexProcessRunnerForTests({ run: () => ({ status: 1, stdout: "", stderr: "codex unavailable" }) })
        },
        remediation: [
          "Install Codex and ensure `codex` is on PATH, then rerun `wunderkind codex doctor`.",
          "Repair Codex plugin discovery for LazyCodex (`omo@sisyphuslabs`), then rerun `wunderkind codex doctor`.",
          "Repair Codex plugin discovery for `wunderkind@grant-vine`, then rerun `wunderkind codex doctor`.",
          "Repair Codex marketplace discovery for `grant-vine`, then rerun `wunderkind codex doctor`.",
        ],
      },
    ]

    for (const testCase of cases) {
      const paths = sandbox()
      configure(paths, createFakeCodex())
      try {
        installCodexWunderkind()
        testCase.setup(paths)
        expect(getCodexDoctorReport().remediation).toEqual(testCase.remediation)
      } finally {
        cleanup(paths)
      }
    }
  })

  it("marks non-canonical state invalid and prints remediation plus advisory companion statuses", () => {
    const paths = sandbox(); configure(paths, createFakeCodex())
    const originalLog = console.log; const lines: string[] = []; console.log = (...values: unknown[]): void => { lines.push(values.join(" ")) }
    try {
      installCodexWunderkind()
      const statePath = join(paths.wunderkindHome, "codex", "install-state.json")
      const state = JSON.parse(readFileSync(statePath, "utf8")); state.marketplace.name = "operator-market"
      writeFileSync(statePath, `${JSON.stringify(state)}\n`)
      const report = getCodexDoctorReport()
      expect(report.core.state).toBe("invalid"); expect(report.core.healthy).toBe(false)
      expect(report.remediation[0]).toContain("wunderkind codex install")
      expect(runCodexDoctor()).toBe(1)
      expect(lines.join("\n")).toContain("Optional companions:")
      expect(lines.join("\n")).toContain("wunderkind codex install")
    } finally { console.log = originalLog; cleanup(paths) }
  })

  it("prints JSON only when requested and returns a non-zero code for blocking health", () => {
    const paths = sandbox()
    configure(paths, createFakeCodex())
    const originalLog = console.log
    const lines: string[] = []
    console.log = (...values: unknown[]): void => { lines.push(values.join(" ")) }
    try {
      expect(runCodexDoctor({ json: true })).toBe(1)
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('"schemaVersion":1')
      expect(lines[0]).not.toContain(paths.wunderkindHome)
    } finally {
      console.log = originalLog
      cleanup(paths)
    }
  })
})
