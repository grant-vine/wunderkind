import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { __resetCodexPathOverrideForTests, __setCodexPathOverrideForTests, type CodexPathOverride } from "../../../src/cli/codex/paths.js"
import { __resetCodexProcessRunnerForTests, __setCodexProcessRunnerForTests, type CodexProcessResult } from "../../../src/cli/codex/process.js"
import { __resetCodexInstallStateWriterForTests } from "../../../src/cli/codex/state.js"

const PROJECT_ROOT = new URL("../../../", import.meta.url).pathname

export const PACKAGE_VERSION = "0.27.2"
export const AGENT_NAMES = ["wunderkind-marketing", "wunderkind-creative-director", "wunderkind-product", "wunderkind-architecture", "wunderkind-ciso", "wunderkind-legal"] as const

export interface FakeCodex {
  readonly calls: string[][]
  readonly failPluginAdd: boolean
  readonly failPluginRemove: boolean
  readonly pluginAddOutput: string
  readonly marketplaceAddOutput: unknown
  readonly marketplaceRemoveOutput: unknown
  readonly pluginRemoveOutput: unknown
  readonly lazyPlugin: unknown
  readonly marketplaces: unknown[]
  readonly onRun?: (argv: readonly string[]) => void
}

export interface CodexSandbox extends CodexPathOverride {
  readonly root: string
  readonly codexHome: string
  readonly wunderkindHome: string
  readonly payloadRoot: string
}

const json = (value: unknown): string => JSON.stringify(value)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function registerFixturePlugin(value: unknown): void {
  if (!isRecord(value) || !Array.isArray(value["installed"])) return
  const installed = value["installed"]
  if (installed.some((entry) => isRecord(entry) && entry["pluginId"] === "wunderkind@grant-vine")) return
  installed.push({ pluginId: "wunderkind@grant-vine", version: PACKAGE_VERSION, installed: true, enabled: true, marketplaceSource: "grant-vine" })
}

export const result = (stdout: string, status = 0): CodexProcessResult => ({ status, stdout, stderr: "" })

export function captureError(action: () => void): Error | undefined {
  try {
    action()
    return undefined
  } catch (error) {
    return error instanceof Error ? error : new Error("Unknown failure")
  }
}

export function hasAgentHashes(value: unknown): value is { readonly agents: readonly { readonly sha256: string }[] } {
  if (typeof value !== "object" || value === null) return false
  const agents = Reflect.get(value, "agents")
  return Array.isArray(agents) && agents.every((agent: unknown) => typeof agent === "object" && agent !== null && typeof Reflect.get(agent, "sha256") === "string")
}

export function createFakeCodex(overrides: Partial<Omit<FakeCodex, "calls">> = {}): FakeCodex {
  return {
    calls: [], failPluginAdd: overrides.failPluginAdd ?? false,
    failPluginRemove: overrides.failPluginRemove ?? false,
    pluginAddOutput: overrides.pluginAddOutput ?? json({ pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine", version: PACKAGE_VERSION, installedPath: "/fake/wunderkind", authPolicy: "ON_INSTALL" }),
    marketplaceAddOutput: overrides.marketplaceAddOutput ?? undefined,
    marketplaceRemoveOutput: overrides.marketplaceRemoveOutput ?? { marketplaceName: "grant-vine", installedRoot: null },
    pluginRemoveOutput: overrides.pluginRemoveOutput ?? { pluginId: "wunderkind@grant-vine", name: "wunderkind", marketplaceName: "grant-vine" },
    lazyPlugin: overrides.lazyPlugin ?? { installed: [{ pluginId: "omo@sisyphuslabs", version: "4.19.4", installed: true, enabled: true, marketplaceSource: "sisyphuslabs" }], available: [] },
    marketplaces: Array.isArray(overrides.marketplaces) ? [...overrides.marketplaces] : [],
    ...(overrides.onRun === undefined ? {} : { onRun: overrides.onRun }),
  }
}

function installRunner(fake: FakeCodex): void {
  __setCodexProcessRunnerForTests({
    run(argv) {
      fake.calls.push([...argv])
      fake.onRun?.(argv)
      if (argv.join("\u0000") === "--version") return result("codex 1.0.0\n")
      if (argv.join("\u0000") === "plugin\u0000list\u0000--json" || argv.join("\u0000") === "plugin\u0000list\u0000--available\u0000--json") return result(json(fake.lazyPlugin))
      if (argv.join("\u0000") === "plugin\u0000marketplace\u0000list\u0000--json") return result(json({ marketplaces: fake.marketplaces }))
      if (argv[0] === "plugin" && argv[1] === "marketplace" && argv[2] === "add") {
        const root = argv[3]
        if (root === undefined) return result("missing marketplace root", 1)
        fake.marketplaces.push({ name: "grant-vine", path: root })
        return result(json(fake.marketplaceAddOutput ?? { marketplaceName: "grant-vine", installedRoot: root, alreadyAdded: false }))
      }
      if (argv.join("\u0000") === "plugin\u0000add\u0000wunderkind@grant-vine\u0000--json") {
        if (fake.failPluginAdd) return result("plugin add failed", 1)
        registerFixturePlugin(fake.lazyPlugin)
        return result(fake.pluginAddOutput)
      }
      if (argv.join("\u0000") === "plugin\u0000remove\u0000wunderkind@grant-vine\u0000--json") {
        if (fake.failPluginRemove) return result("plugin remove failed", 1)
        if (isRecord(fake.lazyPlugin) && Array.isArray(fake.lazyPlugin["installed"])) {
          const installed = fake.lazyPlugin["installed"]
          const index = installed.findIndex((entry) => isRecord(entry) && entry["pluginId"] === "wunderkind@grant-vine")
          if (index !== -1) installed.splice(index, 1)
        }
        return result(json(fake.pluginRemoveOutput))
      }
      if (argv.join("\u0000") === "plugin\u0000marketplace\u0000remove\u0000grant-vine\u0000--json") {
        const index = fake.marketplaces.findIndex((entry) => isRecord(entry) && entry["name"] === "grant-vine")
        if (index !== -1) fake.marketplaces.splice(index, 1)
        return result(json(fake.marketplaceRemoveOutput))
      }
      return result("{}")
    },
  })
}

export function sandbox(): CodexSandbox {
  const root = mkdtempSync(join(tmpdir(), "wunderkind codex lifecycle "))
  const payloadRoot = join(root, "payload")
  cpSync(join(PROJECT_ROOT, "codex"), payloadRoot, { recursive: true })
  return { root, codexHome: join(root, "codex home"), wunderkindHome: join(root, "wunderkind home"), payloadRoot }
}

export function configure(paths: CodexSandbox, fake: FakeCodex): void {
  __setCodexPathOverrideForTests(paths)
  installRunner(fake)
}

export function hasCall(calls: readonly string[][], expected: readonly string[]): boolean {
  return calls.some((call) => call.length === expected.length && call.every((value, index) => value === expected[index]))
}

export function cleanup(paths: CodexSandbox): void {
  __resetCodexInstallStateWriterForTests()
  __resetCodexProcessRunnerForTests()
  __resetCodexPathOverrideForTests()
  rmSync(paths.root, { recursive: true, force: true })
}

export function createLazyCodexEnvelope(version: string): unknown {
  return { installed: [{ pluginId: "omo@sisyphuslabs", version, installed: true, enabled: true }], available: [] }
}
