import { describe, expect, it, mock } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { ResolvedMemoryConfig } from "../../src/cli/types.js"
import { MemoryLedger } from "../../src/memory/index.js"
import { appendMemoryContextToSystem } from "../../src/memory/hook-integration.js"
import { readMemoryQuery } from "../../src/memory/session-query.js"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const ORIGINAL_CWD = process.cwd()
const MEMORY_CONFIG_OVERRIDE_KEY = Symbol.for("wunderkind.memoryPluginHookConfigOverride")
const CONFIG_MANAGER_JS_URL = new URL("src/cli/config-manager/index.js", `file://${PROJECT_ROOT}`).href
const CONFIG_MANAGER_TS_URL = new URL("src/cli/config-manager/index.ts", `file://${PROJECT_ROOT}`).href
const REAL_CONFIG_MANAGER_MODULE_URL = new URL(
  `src/cli/config-manager/index.ts?memory-plugin-hook-config=${Date.now()}`,
  `file://${PROJECT_ROOT}`,
).href

type RealConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")
const realConfigManager: RealConfigManagerModule = await import(REAL_CONFIG_MANAGER_MODULE_URL)

type SystemOutput = { system: string[] }

type MemoryPluginModule = {
  default: (input: unknown) => Promise<{
    "chat.message"?: (input: { sessionID: string; messageID?: string }, output: { message: unknown; parts: readonly unknown[] }) => Promise<void>
    "experimental.chat.system.transform"?: (input: { sessionID?: string }, output: SystemOutput) => Promise<void>
  }>
}

function readMemoryConfigOverride(): { readonly memory: object } | null {
  const value = Reflect.get(globalThis, MEMORY_CONFIG_OVERRIDE_KEY)
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const memory = Reflect.get(value, "memory")
  if (typeof memory !== "object" || memory === null || Array.isArray(memory)) return null
  return { memory }
}

function registerConfigManagerMock(): void {
  const factory = () => ({
    ...realConfigManager,
    detectCurrentConfig: () => readMemoryConfigOverride() ?? realConfigManager.detectCurrentConfig(),
  })
  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.js`, factory)
  mock.module(`${PROJECT_ROOT}src/cli/config-manager/index.ts`, factory)
  mock.module(CONFIG_MANAGER_JS_URL, factory)
  mock.module(CONFIG_MANAGER_TS_URL, factory)
}

function memoryConfig(enabled: boolean, injectionEnabled: boolean): ResolvedMemoryConfig {
  return {
    enabled,
    captureEnabled: false,
    injectionEnabled,
    extraction: { provider: "ollama", ollama: { baseUrl: "http://127.0.0.1:11434", model: "fake", timeoutMs: 5000, enqueueTimeoutMs: 75, maxQueue: 64, maxResponseBytes: 32768 } },
  }
}

function configureMemoryProject(project: string, memory: ResolvedMemoryConfig): void {
  mkdirSync(join(project, ".wunderkind"), { recursive: true })
  writeFileSync(join(project, "opencode.json"), JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
  writeFileSync(join(project, ".wunderkind", "wunderkind.config.jsonc"), JSON.stringify({ memory }))
  const testOverrideStore = globalThis as Record<PropertyKey, unknown>
  testOverrideStore[MEMORY_CONFIG_OVERRIDE_KEY] = { memory }
  realConfigManager.__setConfigManagerPathOverrideForTests({ cwd: project, home: project })
  process.chdir(project)
}

async function loadMemoryPlugin(): Promise<Awaited<ReturnType<MemoryPluginModule["default"]>>> {
  registerConfigManagerMock()
  const mod = (await import(new URL(`src/index.ts?memory-plugin-hook=${Date.now()}`, `file://${PROJECT_ROOT}`).href)) as MemoryPluginModule
  return mod.default({})
}

function cleanupMemoryProject(project: string): void {
  const testOverrideStore = globalThis as Record<PropertyKey, unknown>
  delete testOverrideStore[MEMORY_CONFIG_OVERRIDE_KEY]
  realConfigManager.__resetConfigManagerPathOverrideForTests()
  process.chdir(ORIGINAL_CWD)
  rmSync(project, { recursive: true, force: true })
}

describe("memory plugin hook", () => {
  it("retrieves a relevant fact using the current chat prompt through the real plugin hooks", async () => {
    const project = join(tmpdir(), `wunderkind-memory-plugin-hook-${Date.now()}`)
    mkdirSync(join(project, ".wunderkind"), { recursive: true })
    writeFileSync(join(project, "opencode.json"), JSON.stringify({ plugin: ["@grant-vine/wunderkind"] }))
    writeFileSync(join(project, ".wunderkind", "wunderkind.config.jsonc"), JSON.stringify({
      memory: {
        enabled: true,
        captureEnabled: false,
        injectionEnabled: true,
        extraction: { provider: "ollama", ollama: { baseUrl: "http://127.0.0.1:11434", model: "fake" } },
      },
    }))
    const ledger = new MemoryLedger({ projectRoot: project })
    try {
      const now = Date.now()
      ledger.recordSourceEvent({ eventId: "release-source", source: "test", occurredAt: now, rawExcerpt: "release status is amber", sensitivity: "internal" })
      ledger.recordCandidate({ candidateId: "release-candidate", sourceEventId: "release-source", subject: "release", predicate: "status", value: "amber", sensitivity: "internal", observedAt: now })
      ledger.acceptCandidate({ factId: "release-fact", candidateId: "release-candidate", acceptedAt: now })
      const memory = memoryConfig(true, true)
      configureMemoryProject(project, memory)
      const plugin = await loadMemoryPlugin()
      const chatMessage = plugin["chat.message"]
      const transform = plugin["experimental.chat.system.transform"]
      if (chatMessage === undefined || transform === undefined) throw new Error("Expected memory plugin hooks")
      await chatMessage({ sessionID: "session-release", messageID: "message-release" }, { message: {}, parts: [{ type: "text", text: "What is the release status?" }] })
      expect(readMemoryQuery("session-release")).toBe("release status")
      const preview = appendMemoryContextToSystem({ system: [], enabled: true, query: readMemoryQuery("session-release"), projectRoot: project })
      expect(preview.join("\n")).toContain("fact: release-fact; source: release-source")
      const output: SystemOutput = { system: [] }
      await transform({ sessionID: "session-release" }, output)
      expect(output.system.join("\n")).toContain("fact: release-fact; source: release-source")
    } finally {
      ledger.close()
      cleanupMemoryProject(project)
    }
  })

  it("preserves normal chat and transform output when memory is disabled", async () => {
    const project = mkdtempSync(join(tmpdir(), "wunderkind-memory-disabled-"))
    try {
      configureMemoryProject(project, memoryConfig(false, false))
      const plugin = await loadMemoryPlugin()
      const chatMessage = plugin["chat.message"]
      const transform = plugin["experimental.chat.system.transform"]
      if (chatMessage === undefined || transform === undefined) throw new Error("Expected memory plugin hooks")
      const chatOutput = { message: { role: "user" }, parts: [{ type: "text", text: "What is the release status?" }] }
      const expectedChatOutput = { message: { role: "user" }, parts: [{ type: "text", text: "What is the release status?" }] }
      await chatMessage({ sessionID: "disabled-session", messageID: "disabled-message" }, chatOutput)
      expect(chatOutput).toEqual(expectedChatOutput)
      const baseline: SystemOutput = { system: ["baseline system"] }
      await transform({ sessionID: "disabled-baseline" }, baseline)
      const output: SystemOutput = { system: ["baseline system"] }
      await transform({ sessionID: "disabled-session" }, output)
      expect(output).toEqual(baseline)
      expect(output.system.join("\n")).not.toContain("wunderkind:memory-context-start")
    } finally {
      cleanupMemoryProject(project)
    }
  })

  it("preserves normal chat and transform output when memory retrieval fails", async () => {
    const project = mkdtempSync(join(tmpdir(), "wunderkind-memory-retrieval-failure-"))
    try {
      configureMemoryProject(project, memoryConfig(true, true))
      mkdirSync(join(project, ".wunderkind", "memory.sqlite"), { recursive: true })
      const plugin = await loadMemoryPlugin()
      const chatMessage = plugin["chat.message"]
      const transform = plugin["experimental.chat.system.transform"]
      if (chatMessage === undefined || transform === undefined) throw new Error("Expected memory plugin hooks")
      const chatOutput = { message: { role: "user" }, parts: [{ type: "text", text: "What is the release status?" }] }
      const expectedChatOutput = { message: { role: "user" }, parts: [{ type: "text", text: "What is the release status?" }] }
      await chatMessage({ sessionID: "failure-session", messageID: "failure-message" }, chatOutput)
      expect(chatOutput).toEqual(expectedChatOutput)
      expect(readMemoryQuery("failure-session")).toBe("release status")
      const baseline: SystemOutput = { system: ["baseline system"] }
      await transform({ sessionID: "failure-baseline" }, baseline)
      const output: SystemOutput = { system: ["baseline system"] }
      await transform({ sessionID: "failure-session" }, output)
      expect(output).toEqual(baseline)
      expect(output.system.join("\n")).not.toContain("wunderkind:memory-context-start")
    } finally {
      cleanupMemoryProject(project)
    }
  })
})
