import { describe, expect, it } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  __resetConfigManagerPathOverrideForTests,
  __setConfigManagerPathOverrideForTests,
} from "../../src/cli/config-manager/index.js"
import {
  runCodexProjectCleanup,
  runCodexProjectInit,
} from "../../src/cli/codex/project-lifecycle.js"
import {
  __resetCodexProjectMarkerWriterForTests,
  __setCodexProjectMarkerWriterForTests,
} from "../../src/cli/codex/project-marker.js"

const PACKAGE_VERSION = "0.27.2"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function withSandbox(callback: (sandbox: string) => Promise<void>): Promise<void> {
  const sandbox = mkdtempSync(join(tmpdir(), "wk-codex-project-"))
  __setConfigManagerPathOverrideForTests({ cwd: sandbox, home: sandbox })

  try {
    await callback(sandbox)
  } finally {
    __resetConfigManagerPathOverrideForTests()
    rmSync(sandbox, { recursive: true, force: true })
  }
}

function healthyGlobalInstall() {
  return { healthy: true, guidance: "healthy fixture" }
}

describe("Codex project lifecycle", () => {
  it("creates the shared bootstrap and a hash-owned Codex attachment on repeated init", async () => {
    await withSandbox(async (sandbox) => {
      writeFileSync(join(sandbox, "package.json"), "{}\n")

      const first = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })
      const guidancePath = join(sandbox, ".wunderkind", "runtime", "codex", "workflow-guidance.md")
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const firstGuidance = readFileSync(guidancePath, "utf8")
      const firstMarker = readFileSync(markerPath, "utf8")

      const second = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(first).toBe(0)
      expect(second).toBe(0)
      expect(existsSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"))).toBe(true)
      expect(existsSync(join(sandbox, "AGENTS.md"))).toBe(true)
      expect(existsSync(join(sandbox, "CONTEXT.md"))).toBe(true)
      expect(existsSync(join(sandbox, ".omo", "plans"))).toBe(true)
      expect(existsSync(join(sandbox, ".omo", "notepads"))).toBe(true)
      expect(existsSync(join(sandbox, ".omo", "evidence"))).toBe(true)
      expect(existsSync(join(sandbox, ".codex"))).toBe(false)
      expect(readFileSync(guidancePath, "utf8")).toBe(firstGuidance)
      expect(readFileSync(markerPath, "utf8")).toBe(firstMarker)

      const marker: unknown = JSON.parse(firstMarker)
      if (!isRecord(marker)) throw new Error("Expected marker object")
      expect(Object.keys(marker).sort()).toEqual(["packageVersion", "runtimeFiles", "schemaVersion"])
      expect(marker["schemaVersion"]).toBe(1)
      expect(marker["packageVersion"]).toBe(PACKAGE_VERSION)
      const runtimeFiles = marker["runtimeFiles"]
      if (!Array.isArray(runtimeFiles) || runtimeFiles.length !== 1 || !isRecord(runtimeFiles[0])) {
        throw new Error("Expected one runtime ownership record")
      }
      expect(runtimeFiles[0]["path"]).toBe("workflow-guidance.md")
      expect(runtimeFiles[0]["sha256"]).toBe(createHash("sha256").update(firstGuidance, "utf8").digest("hex"))
    })
  })

  it("keeps inherited configuration sparse and supports docs plus GitHub PRD workflow mode", async () => {
    await withSandbox(async (sandbox) => {
      const code = await runCodexProjectInit({
        cwd: sandbox,
        globalInstall: healthyGlobalInstall(),
        packageVersion: PACKAGE_VERSION,
        docsEnabled: true,
        docsPath: "./documentation",
        prdPipelineMode: "github",
      })

      const config = readFileSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"), "utf8")
      const guidance = readFileSync(join(sandbox, ".wunderkind", "runtime", "codex", "workflow-guidance.md"), "utf8")

      expect(code).toBe(0)
      expect(config).not.toContain('"region"')
      expect(config).toContain('"docsEnabled": true')
      expect(config).toContain('"prdPipelineMode": "github"')
      expect(existsSync(join(sandbox, "documentation", "README.md"))).toBe(true)
      expect(guidance).toContain("$wunderkind")
      expect(guidance).toContain("$docs-index")
      expect(guidance).toContain("$init-deep")
      expect(guidance).toContain("$ulw-plan")
      expect(guidance).toContain("$start-work")
      expect(guidance).toContain("Lean response mode is the default")
      expect(guidance).toContain("detailed expansion only when asked or risk requires it")
    })
  })

  it("does not create a docs lane when docs output is disabled and retains filesystem workflow mode", async () => {
    await withSandbox(async (sandbox) => {
      const code = await runCodexProjectInit({
        cwd: sandbox,
        globalInstall: healthyGlobalInstall(),
        packageVersion: PACKAGE_VERSION,
        docsEnabled: false,
        prdPipelineMode: "filesystem",
      })

      const config = readFileSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"), "utf8")
      expect(code).toBe(0)
      expect(existsSync(join(sandbox, "docs"))).toBe(false)
      expect(config).toContain('"docsEnabled": false')
      expect(config).toContain('"prdPipelineMode": "filesystem"')
    })
  })

  it("rejects DESIGN.md as the docs path before creating project artifacts", async () => {
    await withSandbox(async (sandbox) => {
      const code = await runCodexProjectInit({
        cwd: sandbox,
        globalInstall: healthyGlobalInstall(),
        packageVersion: PACKAGE_VERSION,
        docsEnabled: true,
        docsPath: "./DESIGN.md",
      })

      expect(code).toBe(1)
      expect(existsSync(join(sandbox, "DESIGN.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
      expect(existsSync(join(sandbox, "AGENTS.md"))).toBe(false)
      expect(existsSync(join(sandbox, "CONTEXT.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".omo"))).toBe(false)
    })
  })

  it("rejects DESIGN.md descendants as docs paths before creating project artifacts", async () => {
    await withSandbox(async (sandbox) => {
      const code = await runCodexProjectInit({
        cwd: sandbox,
        globalInstall: healthyGlobalInstall(),
        packageVersion: PACKAGE_VERSION,
        docsEnabled: true,
        docsPath: "./DESIGN.md/docs-output",
      })

      expect(code).toBe(1)
      expect(existsSync(join(sandbox, "DESIGN.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
      expect(existsSync(join(sandbox, "AGENTS.md"))).toBe(false)
      expect(existsSync(join(sandbox, "CONTEXT.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".omo"))).toBe(false)
    })
  })

  it("rejects an unhealthy global install and a legacy root config without writes", async () => {
    await withSandbox(async (sandbox) => {
      const unhealthy = await runCodexProjectInit({
        cwd: sandbox,
        globalInstall: { healthy: false, guidance: "Run codex install first." },
        packageVersion: PACKAGE_VERSION,
      })
      writeFileSync(join(sandbox, "wunderkind.config.jsonc"), "{}\n")
      const legacy = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(unhealthy).toBe(1)
      expect(legacy).toBe(1)
      expect(existsSync(join(sandbox, ".wunderkind"))).toBe(false)
      expect(existsSync(join(sandbox, "AGENTS.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".omo"))).toBe(false)
    })
  })

  it("refuses a symlinked project config without overwriting its external target or bootstrapping artifacts", async () => {
    await withSandbox(async (sandbox) => {
      const externalConfig = join(sandbox, "outside", "operator-config.jsonc")
      const externalBytes = "OPERATOR_BYTES\n"
      mkdirSync(join(sandbox, ".wunderkind"), { recursive: true })
      mkdirSync(join(sandbox, "outside"))
      writeFileSync(externalConfig, externalBytes)
      symlinkSync(externalConfig, join(sandbox, ".wunderkind", "wunderkind.config.jsonc"), "file")

      const code = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(code).toBe(1)
      expect(readFileSync(externalConfig, "utf8")).toBe(externalBytes)
      expect(lstatSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc")).isSymbolicLink()).toBe(true)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "runtime"))).toBe(false)
      expect(existsSync(join(sandbox, "AGENTS.md"))).toBe(false)
      expect(existsSync(join(sandbox, "CONTEXT.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".omo"))).toBe(false)
    })
  })

  it("refuses a dangling AGENTS.md symlink before creating any shared bootstrap artifact", async () => {
    await withSandbox(async (sandbox) => {
      const agentsPath = join(sandbox, "AGENTS.md")
      const externalTarget = join(sandbox, "outside", "agents.md")
      mkdirSync(join(sandbox, "outside"))
      symlinkSync(externalTarget, agentsPath, "file")

      const code = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(code).toBe(1)
      expect(lstatSync(agentsPath).isSymbolicLink()).toBe(true)
      expect(existsSync(externalTarget)).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "runtime", "codex", "workflow-guidance.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
      expect(existsSync(join(sandbox, ".omo"))).toBe(false)
    })
  })

  it("refuses a dangling docs README symlink before creating an external target or project artifacts", async () => {
    await withSandbox(async (sandbox) => {
      const docsDirectory = join(sandbox, "docs")
      const readmePath = join(docsDirectory, "README.md")
      const externalTarget = join(sandbox, "outside", "created-readme.md")
      mkdirSync(docsDirectory)
      mkdirSync(join(sandbox, "outside"))
      symlinkSync(externalTarget, readmePath, "file")

      const code = await runCodexProjectInit({
        cwd: sandbox,
        globalInstall: healthyGlobalInstall(),
        packageVersion: PACKAGE_VERSION,
        docsEnabled: true,
        docsPath: "docs",
      })

      expect(code).toBe(1)
      expect(lstatSync(readmePath).isSymbolicLink()).toBe(true)
      expect(existsSync(externalTarget)).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "wunderkind.config.jsonc"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "runtime", "codex", "workflow-guidance.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
      expect(existsSync(join(sandbox, ".omo"))).toBe(false)
    })
  })

  it("refuses init when the Codex runtime root is a symlink", async () => {
    await withSandbox(async (sandbox) => {
      const runtimeParent = join(sandbox, ".wunderkind", "runtime")
      const runtimeRoot = join(runtimeParent, "codex")
      const outsideDirectory = join(sandbox, "outside")
      mkdirSync(runtimeParent, { recursive: true })
      mkdirSync(outsideDirectory)
      symlinkSync(outsideDirectory, runtimeRoot, "dir")

      const code = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(code).toBe(1)
      expect(existsSync(join(outsideDirectory, "workflow-guidance.md"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
    })
  })

  it("refuses init when the Codex guidance leaf is a dangling symlink", async () => {
    await withSandbox(async (sandbox) => {
      const runtimeDirectory = join(sandbox, ".wunderkind", "runtime", "codex")
      const outsideTarget = join(sandbox, "outside", "created.md")
      mkdirSync(runtimeDirectory, { recursive: true })
      symlinkSync(outsideTarget, join(runtimeDirectory, "workflow-guidance.md"), "file")

      const code = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(code).toBe(1)
      expect(existsSync(outsideTarget)).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
    })
  })

  it("refuses an external marker symlink before overwriting user guidance during init", async () => {
    await withSandbox(async (sandbox) => {
      const runtimeDirectory = join(sandbox, ".wunderkind", "runtime", "codex")
      const guidancePath = join(runtimeDirectory, "workflow-guidance.md")
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const outsideMarkerPath = join(sandbox, "outside", "codex-project.json")
      const userGuidance = "user-owned guidance\n"
      const messages: string[] = []
      const originalLog = console.log
      mkdirSync(runtimeDirectory, { recursive: true })
      mkdirSync(join(sandbox, "outside"))
      writeFileSync(guidancePath, userGuidance)
      writeFileSync(outsideMarkerPath, `${JSON.stringify({
        schemaVersion: 1,
        packageVersion: PACKAGE_VERSION,
        runtimeFiles: [{ path: "workflow-guidance.md", sha256: createHash("sha256").update(userGuidance, "utf8").digest("hex") }],
      })}\n`)
      symlinkSync(outsideMarkerPath, markerPath, "file")
      console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "))

      try {
        const code = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

        expect(code).toBe(1)
        expect(readFileSync(guidancePath, "utf8")).toBe(userGuidance)
        expect(lstatSync(markerPath).isSymbolicLink()).toBe(true)
        expect(readFileSync(outsideMarkerPath, "utf8")).toContain('"workflow-guidance.md"')
        expect(messages.some((message) => message.includes("Bootstrapped Codex project attachment"))).toBe(false)
      } finally {
        console.log = originalLog
      }
    })
  })

  it("publishes a physical marker without following a stale predictable temp symlink", async () => {
    await withSandbox(async (sandbox) => {
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const oldTemporaryPath = `${markerPath}.tmp-${process.pid}`
      const outsidePath = join(sandbox, "outside", "sentinel.json")
      const sentinel = "outside sentinel\n"
      mkdirSync(join(sandbox, ".wunderkind"), { recursive: true })
      mkdirSync(join(sandbox, "outside"))
      writeFileSync(outsidePath, sentinel)
      symlinkSync(outsidePath, oldTemporaryPath, "file")

      const code = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

      expect(code).toBe(0)
      expect(readFileSync(outsidePath, "utf8")).toBe(sentinel)
      expect(lstatSync(oldTemporaryPath).isSymbolicLink()).toBe(true)
      expect(lstatSync(markerPath).isFile()).toBe(true)
      expect(lstatSync(markerPath).isSymbolicLink()).toBe(false)
    })
  })

  it("restores guidance when marker publication fails so init can retry and cleanup", async () => {
    await withSandbox(async (sandbox) => {
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const guidancePath = join(sandbox, ".wunderkind", "runtime", "codex", "workflow-guidance.md")
      __setCodexProjectMarkerWriterForTests(() => {
        throw new Error("injected marker publication failure")
      })

      try {
        const failedInit = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })

        expect(failedInit).toBe(1)
        expect(existsSync(markerPath)).toBe(false)
        expect(existsSync(guidancePath)).toBe(false)
      } finally {
        __resetCodexProjectMarkerWriterForTests()
      }

      const retriedInit = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })
      const cleanup = runCodexProjectCleanup({ cwd: sandbox })

      expect(retriedInit).toBe(0)
      expect(cleanup).toBe(0)
      expect(existsSync(markerPath)).toBe(false)
      expect(existsSync(guidancePath)).toBe(false)
    })
  })

  it("removes only hash-matching Codex runtime files and preserves shared project artifacts", async () => {
    await withSandbox(async (sandbox) => {
      const sharedConfigPath = join(sandbox, ".wunderkind", "wunderkind.config.jsonc")
      const agentsPath = join(sandbox, "AGENTS.md")
      const contextPath = join(sandbox, "CONTEXT.md")
      const docsPath = join(sandbox, "docs", "README.md")
      const omoPath = join(sandbox, ".omo", "plans", "kept.md")
      const openCodePath = join(sandbox, "opencode.json")
      writeFileSync(openCodePath, '{"plugin":["other-plugin"]}\n')
      const initCode = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION, docsEnabled: true })
      writeFileSync(omoPath, "keep\n")
      const sharedConfig = readFileSync(sharedConfigPath, "utf8")
      const agents = readFileSync(agentsPath, "utf8")
      const context = readFileSync(contextPath, "utf8")
      const docs = readFileSync(docsPath, "utf8")

      const cleanupCode = runCodexProjectCleanup({ cwd: sandbox })

      expect(initCode).toBe(0)
      expect(cleanupCode).toBe(0)
      expect(existsSync(join(sandbox, ".wunderkind", "codex-project.json"))).toBe(false)
      expect(existsSync(join(sandbox, ".wunderkind", "runtime", "codex"))).toBe(false)
      expect(readFileSync(sharedConfigPath, "utf8")).toBe(sharedConfig)
      expect(readFileSync(agentsPath, "utf8")).toBe(agents)
      expect(readFileSync(contextPath, "utf8")).toBe(context)
      expect(readFileSync(docsPath, "utf8")).toBe(docs)
      expect(readFileSync(omoPath, "utf8")).toBe("keep\n")
      expect(readFileSync(openCodePath, "utf8")).toBe('{"plugin":["other-plugin"]}\n')
    })
  })

  it("preserves a modified marker-owned runtime file and marker with a non-zero cleanup result", async () => {
    await withSandbox(async (sandbox) => {
      const initCode = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })
      const runtimePath = join(sandbox, ".wunderkind", "runtime", "codex", "workflow-guidance.md")
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const messages: string[] = []
      const originalLog = console.log
      writeFileSync(runtimePath, "user modified\n")
      console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "))

      try {
        const cleanupCode = runCodexProjectCleanup({ cwd: sandbox })

        expect(initCode).toBe(0)
        expect(cleanupCode).toBe(1)
        expect(readFileSync(runtimePath, "utf8")).toBe("user modified\n")
        expect(existsSync(markerPath)).toBe(true)
        expect(messages.some((message) => message.includes("Removed Codex project attachment marker"))).toBe(false)
        expect(existsSync(join(sandbox, ".wunderkind", "runtime", "codex"))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })
  })

  it("preserves an outside file and marker when cleanup path crosses an intermediate symlink", async () => {
    await withSandbox(async (sandbox) => {
      const runtimeDirectory = join(sandbox, ".wunderkind", "runtime", "codex")
      const outsideDirectory = join(sandbox, "outside")
      const outsideFile = join(outsideDirectory, "victim.txt")
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const messages: string[] = []
      const originalLog = console.log
      mkdirSync(runtimeDirectory, { recursive: true })
      mkdirSync(outsideDirectory)
      writeFileSync(outsideFile, "outside bytes\n")
      symlinkSync(outsideDirectory, join(runtimeDirectory, "escape"), "dir")
      writeFileSync(markerPath, `${JSON.stringify({
        schemaVersion: 1,
        packageVersion: PACKAGE_VERSION,
        runtimeFiles: [{ path: "escape/victim.txt", sha256: createHash("sha256").update("outside bytes\n", "utf8").digest("hex") }],
      })}\n`)
      console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "))

      try {
        const code = runCodexProjectCleanup({ cwd: sandbox })
        expect(code).toBe(1)
        expect(readFileSync(outsideFile, "utf8")).toBe("outside bytes\n")
        expect(existsSync(markerPath)).toBe(true)
        expect(messages.some((message) => message.includes("Removed Codex runtime file"))).toBe(false)
      } finally {
        console.log = originalLog
      }
    })
  })

  it("preserves a dangling marker-owned symlink and marker during cleanup", async () => {
    await withSandbox(async (sandbox) => {
      const runtimeDirectory = join(sandbox, ".wunderkind", "runtime", "codex")
      const runtimePath = join(runtimeDirectory, "workflow-guidance.md")
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const messages: string[] = []
      const originalLog = console.log
      mkdirSync(runtimeDirectory, { recursive: true })
      symlinkSync(join(sandbox, "outside", "missing.md"), runtimePath, "file")
      writeFileSync(markerPath, `${JSON.stringify({
        schemaVersion: 1,
        packageVersion: PACKAGE_VERSION,
        runtimeFiles: [{ path: "workflow-guidance.md", sha256: "0".repeat(64) }],
      })}\n`)
      console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "))

      try {
        const code = runCodexProjectCleanup({ cwd: sandbox })
        expect(code).toBe(1)
        expect(existsSync(markerPath)).toBe(true)
        expect(lstatSync(runtimePath).isSymbolicLink()).toBe(true)
        expect(messages.some((message) => message.includes("Removed Codex project attachment marker"))).toBe(false)
      } finally {
        console.log = originalLog
      }
    })
  })

  it("preserves a companion file claimed by an external marker symlink during cleanup", async () => {
    await withSandbox(async (sandbox) => {
      const runtimeDirectory = join(sandbox, ".wunderkind", "runtime", "codex")
      const companionPath = join(runtimeDirectory, "companion-owned-by-user.md")
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const outsideMarkerPath = join(sandbox, "outside", "codex-project.json")
      const companionBytes = "companion owned by user\n"
      const messages: string[] = []
      const originalLog = console.log
      mkdirSync(runtimeDirectory, { recursive: true })
      mkdirSync(join(sandbox, "outside"))
      writeFileSync(companionPath, companionBytes)
      writeFileSync(outsideMarkerPath, `${JSON.stringify({
        schemaVersion: 1,
        packageVersion: PACKAGE_VERSION,
        runtimeFiles: [{ path: "companion-owned-by-user.md", sha256: createHash("sha256").update(companionBytes, "utf8").digest("hex") }],
      })}\n`)
      symlinkSync(outsideMarkerPath, markerPath, "file")
      console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "))

      try {
        const code = runCodexProjectCleanup({ cwd: sandbox })

        expect(code).toBe(1)
        expect(readFileSync(companionPath, "utf8")).toBe(companionBytes)
        expect(lstatSync(markerPath).isSymbolicLink()).toBe(true)
        expect(readFileSync(outsideMarkerPath, "utf8")).toContain('"companion-owned-by-user.md"')
        expect(messages.some((message) => message.includes("Removed Codex runtime file") || message.includes("Removed Codex project attachment marker"))).toBe(false)
      } finally {
        console.log = originalLog
      }
    })
  })

  it("preserves a dangling marker symlink instead of reporting the attachment absent", async () => {
    await withSandbox(async (sandbox) => {
      const markerPath = join(sandbox, ".wunderkind", "codex-project.json")
      const messages: string[] = []
      const originalLog = console.log
      mkdirSync(join(sandbox, ".wunderkind"), { recursive: true })
      symlinkSync(join(sandbox, "outside", "missing-marker.json"), markerPath, "file")
      console.log = (...args: unknown[]) => messages.push(args.map(String).join(" "))

      try {
        const code = runCodexProjectCleanup({ cwd: sandbox })

        expect(code).toBe(1)
        expect(lstatSync(markerPath).isSymbolicLink()).toBe(true)
        expect(messages.some((message) => message.includes("Codex project attachment already absent"))).toBe(false)
      } finally {
        console.log = originalLog
      }
    })
  })

  it("does not prune a Codex runtime directory that contains a companion asset", async () => {
    await withSandbox(async (sandbox) => {
      const initCode = await runCodexProjectInit({ cwd: sandbox, globalInstall: healthyGlobalInstall(), packageVersion: PACKAGE_VERSION })
      const runtimeDirectory = join(sandbox, ".wunderkind", "runtime", "codex")
      mkdirSync(runtimeDirectory, { recursive: true })
      writeFileSync(join(runtimeDirectory, "companion-state.json"), "{}\n")

      const cleanupCode = runCodexProjectCleanup({ cwd: sandbox })

      expect(initCode).toBe(0)
      expect(cleanupCode).toBe(0)
      expect(existsSync(join(runtimeDirectory, "companion-state.json"))).toBe(true)
      expect(existsSync(runtimeDirectory)).toBe(true)
    })
  })
})
