import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

type StitchPresence = "missing" | "project-local" | "global-only" | "both"

interface ConfigManagerModule {
  __setConfigManagerPathOverrideForTests: (override: { cwd?: string; home?: string }) => void
  __resetConfigManagerPathOverrideForTests: () => void
}

interface McpHelpersModule {
  detectStitchMcpPresence: (projectPath?: string) => Promise<StitchPresence>
  mergeStitchMcpConfig: (projectPath: string) => Promise<void>
  writeStitchSecretFile: (apiKey: string, cwd: string) => Promise<void>
}

interface TestSandbox {
  rootDir: string
  homeDir: string
  projectDir: string
  globalConfigDir: string
  globalOpenCodePath: string
  projectOpenCodePath: string
  secretDir: string
  secretFilePath: string
}

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CACHE_BUST = Date.now()
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?mcp-helpers-config=${CACHE_BUST}`
const MCP_HELPERS_MODULE_URL = `${PROJECT_ROOT}src/cli/mcp-helpers.ts?mcp-helpers=${CACHE_BUST}`

let configManagerPromise: Promise<ConfigManagerModule> | null = null
let mcpHelpersPromise: Promise<McpHelpersModule> | null = null

function createSandbox(prefix: string): TestSandbox {
  const rootDir = mkdtempSync(join(tmpdir(), prefix))
  const homeDir = join(rootDir, "home")
  const projectDir = join(rootDir, "project")
  const globalConfigDir = join(homeDir, ".config", "opencode")
  const secretDir = join(projectDir, ".wunderkind", "stitch")

  mkdirSync(homeDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })

  return {
    rootDir,
    homeDir,
    projectDir,
    globalConfigDir,
    globalOpenCodePath: join(globalConfigDir, "opencode.json"),
    projectOpenCodePath: join(projectDir, "opencode.json"),
    secretDir,
    secretFilePath: join(secretDir, "google-stitch-api-key"),
  }
}

function cleanupSandbox(sandbox: TestSandbox): void {
  rmSync(sandbox.rootDir, { recursive: true, force: true })
}

async function importConfigManager(): Promise<ConfigManagerModule> {
  configManagerPromise ??= import(CONFIG_MANAGER_MODULE_URL) as Promise<ConfigManagerModule>
  return configManagerPromise
}

async function importMcpHelpers(): Promise<McpHelpersModule> {
  mcpHelpersPromise ??= import(MCP_HELPERS_MODULE_URL) as Promise<McpHelpersModule>
  return mcpHelpersPromise
}

function applySandboxPathOverride(mod: ConfigManagerModule, sandbox: TestSandbox): void {
  mod.__setConfigManagerPathOverrideForTests({
    cwd: sandbox.projectDir,
    home: sandbox.homeDir,
  })
}

async function withSandbox(
  label: string,
  callback: (sandbox: TestSandbox, helpers: McpHelpersModule) => Promise<void> | void,
): Promise<void> {
  const sandbox = createSandbox(`wk-mcp-helpers-${label}-`)

  try {
    const configManager = await importConfigManager()
    applySandboxPathOverride(configManager, sandbox)
    const helpers = await importMcpHelpers()
    await callback(sandbox, helpers)
  } finally {
    const configManager = await importConfigManager()
    configManager.__resetConfigManagerPathOverrideForTests()
    cleanupSandbox(sandbox)
  }
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>
}

describe("mcp helpers", () => {
  describe("detectStitchMcpPresence", () => {
    it("returns missing when neither config contains Stitch", async () => {
      await withSandbox("detect-missing", async (sandbox, helpers) => {
        writeJson(sandbox.globalOpenCodePath, { plugin: ["@grant-vine/wunderkind"] })
        writeJson(sandbox.projectOpenCodePath, { agent: { model: "gpt-5" } })

        expect(await helpers.detectStitchMcpPresence(sandbox.projectDir)).toBe("missing")
      })
    })

    it("returns project-local when only project config has the google-stitch key", async () => {
      await withSandbox("detect-project-local", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://example.com/custom-stitch",
              enabled: true,
            },
          },
        })

        expect(await helpers.detectStitchMcpPresence(sandbox.projectDir)).toBe("project-local")
      })
    })

    it("returns global-only when only global config has a matching Stitch URL", async () => {
      await withSandbox("detect-global-only", async (sandbox, helpers) => {
        mkdirSync(sandbox.globalConfigDir, { recursive: true })
        writeJson(sandbox.globalOpenCodePath, {
          mcp: {
            "shared-design": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
            },
          },
        })

        expect(await helpers.detectStitchMcpPresence(sandbox.projectDir)).toBe("global-only")
      })
    })

    it("returns both when global and project configs each contain Stitch", async () => {
      await withSandbox("detect-both", async (sandbox, helpers) => {
        mkdirSync(sandbox.globalConfigDir, { recursive: true })
        writeJson(sandbox.globalOpenCodePath, {
          mcp: {
            "shared-design": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
            },
          },
        })
        writeJson(sandbox.projectOpenCodePath, {
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://example.com/custom-stitch",
              enabled: true,
            },
          },
        })

        expect(await helpers.detectStitchMcpPresence(sandbox.projectDir)).toBe("both")
      })
    })
  })

  describe("mergeStitchMcpConfig", () => {
    it("creates a new opencode.json with schema and canonical Stitch MCP config", async () => {
      await withSandbox("merge-create", async (sandbox, helpers) => {
        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        expect(existsSync(sandbox.projectOpenCodePath)).toBe(true)
        expect(readJson(sandbox.projectOpenCodePath)).toEqual({
          $schema: "https://opencode.ai/config.json",
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
              },
            },
          },
        })
      })
    })

    it("preserves unrelated plugin, agent, tools, and other mcp keys", async () => {
      await withSandbox("merge-preserve-unrelated", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          plugin: ["@grant-vine/wunderkind"],
          agent: { model: "gpt-5" },
          tools: { webfetch: { enabled: true } },
          mcp: {
            existing: {
              type: "remote",
              url: "https://example.com/mcp",
              enabled: true,
            },
          },
        })

        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        expect(readJson(sandbox.projectOpenCodePath)).toEqual({
          $schema: "https://opencode.ai/config.json",
          plugin: ["@grant-vine/wunderkind"],
          agent: { model: "gpt-5" },
          tools: { webfetch: { enabled: true } },
          mcp: {
            existing: {
              type: "remote",
              url: "https://example.com/mcp",
              enabled: true,
            },
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
              },
            },
          },
        })
      })
    })

    it("adds schema to an existing config that lacks it", async () => {
      await withSandbox("merge-add-schema", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          plugin: ["@grant-vine/wunderkind"],
        })

        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        const config = readJson(sandbox.projectOpenCodePath)
        expect(config.$schema).toBe("https://opencode.ai/config.json")
      })
    })

    it("does not overwrite a non-drifted existing Stitch entry", async () => {
      await withSandbox("merge-keep-existing", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp/",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:custom-secret-file}",
              },
            },
          },
        })

        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        expect(readJson(sandbox.projectOpenCodePath)).toEqual({
          $schema: "https://opencode.ai/config.json",
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp/",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:custom-secret-file}",
              },
            },
          },
        })
      })
    })

    it("overwrites a drifted Stitch entry when the URL mismatches after slash trimming", async () => {
      await withSandbox("merge-url-drift", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://example.com/other-stitch/",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:custom-secret-file}",
              },
            },
          },
        })

        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        expect(readJson(sandbox.projectOpenCodePath)).toEqual({
          $schema: "https://opencode.ai/config.json",
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
              },
            },
          },
        })
      })
    })

    it("overwrites a drifted Stitch entry when oauth is true", async () => {
      await withSandbox("merge-oauth-drift", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
              oauth: true,
              headers: {
                Authorization: "Bearer {file:custom-secret-file}",
              },
            },
          },
        })

        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        expect(readJson(sandbox.projectOpenCodePath)).toEqual({
          $schema: "https://opencode.ai/config.json",
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: true,
              oauth: false,
              headers: {
                Authorization: "Bearer {file:.wunderkind/stitch/google-stitch-api-key}",
              },
            },
          },
        })
      })
    })

    it("treats a missing oauth field as non-drifted and leaves the entry untouched", async () => {
      await withSandbox("merge-missing-oauth", async (sandbox, helpers) => {
        writeJson(sandbox.projectOpenCodePath, {
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: false,
              headers: {
                Authorization: "Bearer {file:custom-secret-file}",
              },
            },
          },
        })

        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        expect(readJson(sandbox.projectOpenCodePath)).toEqual({
          $schema: "https://opencode.ai/config.json",
          mcp: {
            "google-stitch": {
              type: "remote",
              url: "https://stitch.googleapis.com/mcp",
              enabled: false,
              headers: {
                Authorization: "Bearer {file:custom-secret-file}",
              },
            },
          },
        })
      })
    })

    it("uses the file placeholder header and never writes the raw secret into JSON config", async () => {
      await withSandbox("merge-secret-safety", async (sandbox, helpers) => {
        await helpers.writeStitchSecretFile("  live-secret-value  ", sandbox.projectDir)
        await helpers.mergeStitchMcpConfig(sandbox.projectDir)

        const fileContent = readFileSync(sandbox.projectOpenCodePath, "utf-8")
        expect(fileContent).toContain("Bearer {file:.wunderkind/stitch/google-stitch-api-key}")
        expect(fileContent).not.toContain("live-secret-value")
      })
    })
  })

  describe("writeStitchSecretFile", () => {
    it("writes the trimmed API key to the canonical secret file path", async () => {
      await withSandbox("write-secret", async (sandbox, helpers) => {
        await helpers.writeStitchSecretFile("  secret-token  ", sandbox.projectDir)

        expect(readFileSync(sandbox.secretFilePath, "utf-8")).toBe("secret-token")
      })
    })

    it("creates the .wunderkind/stitch directory recursively when needed", async () => {
      await withSandbox("write-secret-dir", async (sandbox, helpers) => {
        expect(existsSync(sandbox.secretDir)).toBe(false)

        await helpers.writeStitchSecretFile("secret-token", sandbox.projectDir)

        expect(existsSync(sandbox.secretDir)).toBe(true)
      })
    })
  })
})
