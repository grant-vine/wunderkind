import { describe, it, expect } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WUNDERKIND_AGENT_IDS } from "../../src/agents/manifest.js"
import { GOOGLE_STITCH_ADAPTER } from "../../src/cli/mcp-adapters.js"
import {
  bootstrapDesignMd,
  scaffoldDesignMd,
  validateDesignMd,
  validateDesignPath,
} from "../../src/cli/design-md-helper.js"

const WUNDERKIND_SCHEMA_URL = "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json"
type ConfigManagerModule = typeof import("../../src/cli/config-manager/index.js")
const PROJECT_ROOT = new URL("../../", import.meta.url).pathname
const CONFIG_MANAGER_MODULE_URL = `${PROJECT_ROOT}src/cli/config-manager/index.ts?config-template=${Date.now()}`

interface TestSandbox {
  rootDir: string
  homeDir: string
  projectDir: string
  globalWunderkindPath: string
  projectConfigPath: string
}

function createSandbox(prefix: string): TestSandbox {
  const rootDir = mkdtempSync(join(tmpdir(), prefix))
  const homeDir = join(rootDir, "home")
  const projectDir = join(rootDir, "project")

  mkdirSync(homeDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })

  return {
    rootDir,
    homeDir,
    projectDir,
    globalWunderkindPath: join(homeDir, ".wunderkind", "wunderkind.config.jsonc"),
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

async function withSandbox(
  label: string,
  callback: (sandbox: TestSandbox, mod: ConfigManagerModule) => Promise<void> | void,
): Promise<void> {
  const sandbox = createSandbox(`wk-config-template-${label}-`)

  try {
    const mod = await importConfigManager()
    mod.__setConfigManagerPathOverrideForTests({
      cwd: sandbox.projectDir,
      home: sandbox.homeDir,
    })
    await callback(sandbox, mod)
  } finally {
    const mod = await importConfigManager()
    mod.__resetConfigManagerPathOverrideForTests()
    cleanupSandbox(sandbox)
  }
}

describe("native wunderkind agent manifest", () => {
  it("defines the expected 6 filename-safe agent ids", () => {
    expect(WUNDERKIND_AGENT_IDS).toHaveLength(6)
    expect(WUNDERKIND_AGENT_IDS).toContain("marketing-wunderkind")
    expect(WUNDERKIND_AGENT_IDS).toContain("ciso")
    expect(WUNDERKIND_AGENT_IDS.every((id) => !id.includes(":"))).toBe(true)
  })
})

describe("package publish surface", () => {
  it("includes schema assets in package files", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { files?: string[] }

    expect(Array.isArray(pkg.files)).toBe(true)
    expect(pkg.files).toContain("schemas/")
  })

  it("includes plugin command assets in package files", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { files?: string[] }

    expect(Array.isArray(pkg.files)).toBe(true)
    expect(pkg.files).toContain("commands/")
  })

  it("includes both canonical and legacy OMO template assets in package files", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { files?: string[] }

    expect(Array.isArray(pkg.files)).toBe(true)
    expect(pkg.files).toContain("oh-my-openagent.jsonc")
    expect(pkg.files).toContain("oh-my-opencode.jsonc")
  })
})

describe("OMO template assets", () => {
  it("ships a canonical oh-my-openagent template and a legacy compatibility copy", () => {
    const canonical = readFileSync(new URL("../../oh-my-openagent.jsonc", import.meta.url), "utf8")
    const legacy = readFileSync(new URL("../../oh-my-opencode.jsonc", import.meta.url), "utf8")

    expect(canonical).toContain("Wunderkind OMO configuration template")
    expect(canonical).toContain('"$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json"')
    expect(canonical).toContain('"wunderkind:product-wunderkind"')

    expect(legacy).toContain("legacy filename retained for compatibility")
    expect(legacy).toContain("oh-my-openagent.jsonc")
    expect(legacy).toContain('"wunderkind:product-wunderkind"')
  })
})

describe("wunderkind config schema asset", () => {
  it("uses the expected canonical schema URL as its id", () => {
    const schema = JSON.parse(readFileSync(new URL("../../schemas/wunderkind.config.schema.json", import.meta.url), "utf8")) as {
      $id?: string
      oneOf?: Array<{ properties?: Record<string, unknown>; required?: string[] }>
    }

    expect(schema.$id).toBe(WUNDERKIND_SCHEMA_URL)
    expect(Array.isArray(schema.oneOf)).toBe(true)
    expect(schema.oneOf?.length).toBe(2)
    const projectSchema = schema.oneOf?.[1]
    expect(projectSchema?.properties?.prdPipelineMode).toBeDefined()
    expect(projectSchema?.properties?.designTool).toBeDefined()
    expect(projectSchema?.properties?.designPath).toBeDefined()
    expect(projectSchema?.properties?.designMcpOwnership).toBeDefined()
    expect(projectSchema?.properties?.["de" + "sloppifyEnabled"]).toBeUndefined()
    expect(projectSchema?.required).not.toContain("prdPipelineMode")
    expect(projectSchema?.required).not.toContain("designTool")
    expect(projectSchema?.required).not.toContain("designPath")
    expect(projectSchema?.required).not.toContain("designMcpOwnership")
  })

  it("silently drops removed legacy project keys when parsing JSONC config", async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")

    const tempRoot = mkdtempSync(join(tmpdir(), "wk-config-schema-"))
    const originalCwd = process.cwd()
    const legacyKey = ["de", "sloppifyEnabled"].join("")

    try {
      process.chdir(tempRoot)
      mkdirSync(join(tempRoot, ".wunderkind"), { recursive: true })
      writeFileSync(
        join(tempRoot, ".wunderkind", "wunderkind.config.jsonc"),
        `{
  // stale legacy field should be ignored
  "teamCulture": "pragmatic-balanced",
  "${legacyKey}": true
}`,
      )

      const { readProjectWunderkindConfig } = await import(`../../src/cli/config-manager/index.ts?stale-key=${Date.now()}`)
      const parsed = readProjectWunderkindConfig()

      expect(parsed).toBeDefined()
      expect(parsed?.teamCulture).toBe("pragmatic-balanced")
      expect(Object.prototype.hasOwnProperty.call(parsed ?? {}, legacyKey)).toBe(false)
    } finally {
      process.chdir(originalCwd)
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

describe("design workflow config template", () => {
  it("returns design workflow defaults from detected config", async () => {
    await withSandbox("design-defaults", async (_sandbox, mod) => {
      const detected = mod.detectCurrentConfig()

      expect(detected.designTool).toBe("none")
      expect(detected.designPath).toBe("./DESIGN.md")
      expect(detected.designMcpOwnership).toBe("none")
    })
  })

  it("parses project config files that omit design workflow keys", async () => {
    await withSandbox("design-sparse", async (sandbox, mod) => {
      mkdirSync(join(sandbox.projectDir, ".wunderkind"), { recursive: true })
      writeFileSync(
        sandbox.projectConfigPath,
        `{
  "teamCulture": "pragmatic-balanced"
}`,
      )

      const parsed = mod.readProjectWunderkindConfig()

      expect(parsed).toBeDefined()
      expect(parsed?.teamCulture).toBe("pragmatic-balanced")
      expect(parsed?.designTool).toBeUndefined()
      expect(parsed?.designPath).toBeUndefined()
      expect(parsed?.designMcpOwnership).toBeUndefined()
    })
  })

  it("renders design workflow fields into project config output", async () => {
    await withSandbox("design-render", async (sandbox, mod) => {
      const result = mod.writeProjectWunderkindConfig({
        ...mod.getDefaultProjectConfig(),
        designTool: "google-stitch",
        designPath: "./DESIGN.md",
        designMcpOwnership: "wunderkind-managed",
      })

      expect(result.success).toBe(true)

      const rendered = readFileSync(sandbox.projectConfigPath, "utf8")

      expect(rendered).toContain("\"designTool\": \"google-stitch\"")
      expect(rendered).toContain("\"designPath\": \"./DESIGN.md\"")
      expect(rendered).toContain("\"designMcpOwnership\": \"wunderkind-managed\"")
    })
  })

  it("drops invalid designTool values during project config coercion", async () => {
    await withSandbox("design-invalid", async (sandbox, mod) => {
      mkdirSync(join(sandbox.projectDir, ".wunderkind"), { recursive: true })
      writeFileSync(
        sandbox.projectConfigPath,
        `{
  "designTool": "figma",
  "designPath": "./custom-design.md",
  "designMcpOwnership": "wunderkind-managed"
}`,
      )

      const parsed = mod.readProjectWunderkindConfig()

      expect(parsed?.designTool).toBeUndefined()
      expect(parsed?.designPath).toBe("./custom-design.md")
      expect(parsed?.designMcpOwnership).toBe("wunderkind-managed")
    })
  })
})

describe("design-md helpers", () => {
  it("validateDesignPath accepts valid relative paths", () => {
    expect(validateDesignPath("./DESIGN.md")).toEqual({ valid: true })
    expect(validateDesignPath("DESIGN.md")).toEqual({ valid: true })
    expect(validateDesignPath("docs/DESIGN.md")).toEqual({ valid: true })
  })

  it("validateDesignPath rejects an absolute path", () => {
    expect(validateDesignPath("/DESIGN.md")).toEqual({
      valid: false,
      error: "designPath must be a relative path",
    })
  })

  it("validateDesignPath rejects parent traversal", () => {
    expect(validateDesignPath("../DESIGN.md")).toEqual({
      valid: false,
      error: "designPath must not traverse parent directories",
    })
    expect(validateDesignPath("docs/../DESIGN.md")).toEqual({
      valid: false,
      error: "designPath must not traverse parent directories",
    })
  })

  it("scaffoldDesignMd returns all section headings in order", () => {
    const scaffold = scaffoldDesignMd()
    const headingMatches = [...scaffold.matchAll(/^## (.+)$/gm)].map((match) => match[1])

    expect(headingMatches).toEqual([...GOOGLE_STITCH_ADAPTER.designSections])
  })

  it("scaffoldDesignMd includes color placeholders in the Colors section", () => {
    const scaffold = scaffoldDesignMd()

    expect(scaffold).toContain("Primary:")
    expect(scaffold).toContain("Secondary:")
    expect(scaffold).toContain("Tertiary:")
    expect(scaffold).toContain("Neutral:")
  })

  it("scaffoldDesignMd includes at least 2 Do bullets and 2 Don't bullets", () => {
    const scaffold = scaffoldDesignMd()
    const doMatches = scaffold.match(/^- Do:/gm) ?? []
    const dontMatches = scaffold.match(/^- Don't:/gm) ?? []

    expect(doMatches.length).toBeGreaterThan(1)
    expect(dontMatches.length).toBeGreaterThan(1)
  })

  it("bootstrapDesignMd creates DESIGN.md when the file does not exist", () => {
    const sandbox = createSandbox("design-bootstrap-create")

    try {
      bootstrapDesignMd("docs/DESIGN.md", sandbox.projectDir)

      const created = readFileSync(join(sandbox.projectDir, "docs", "DESIGN.md"), "utf8")
      expect(created).toBe(scaffoldDesignMd())
    } finally {
      cleanupSandbox(sandbox)
    }
  })

  it("bootstrapDesignMd does not overwrite an existing DESIGN.md", () => {
    const sandbox = createSandbox("design-bootstrap-preserve")
    const designDir = join(sandbox.projectDir, "docs")
    const designPath = join(designDir, "DESIGN.md")
    const existingContent = "# Existing design file\n"

    try {
      mkdirSync(designDir, { recursive: true })
      writeFileSync(designPath, existingContent)

      bootstrapDesignMd("docs/DESIGN.md", sandbox.projectDir)

      expect(readFileSync(designPath, "utf8")).toBe(existingContent)
    } finally {
      cleanupSandbox(sandbox)
    }
  })

  it("bootstrapDesignMd supports nested dot-relative design paths", () => {
    const sandbox = createSandbox("design-bootstrap-dot-relative")

    try {
      bootstrapDesignMd("./design/system/DESIGN.md", sandbox.projectDir)

      const created = readFileSync(join(sandbox.projectDir, "design", "system", "DESIGN.md"), "utf8")
      expect(created).toBe(scaffoldDesignMd())
    } finally {
      cleanupSandbox(sandbox)
    }
  })

  it("validateDesignMd passes for the valid scaffold", () => {
    expect(validateDesignMd(scaffoldDesignMd())).toEqual({ valid: true, errors: [] })
  })

  it("validateDesignMd fails when a section is missing", () => {
    const invalid = scaffoldDesignMd().replace("## Typography\nDefine font families, sizes, weights, and usage rules before design generation.\n\n", "")
    const result = validateDesignMd(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error: string) => error.includes("Missing required section: Typography"))).toBe(true)
  })

  it("validateDesignMd fails when section order is wrong", () => {
    const invalid = `## Overview
Capture the product, audience, and intended experience in 2-4 sentences.

## Typography
Define font families, sizes, weights, and usage rules before design generation.

## Colors
Primary: TODO define the main brand color and usage.
Secondary: TODO define the supporting accent color and usage.
Tertiary: TODO define the optional highlight color and usage.
Neutral: TODO define the neutral palette and surfaces.

## Elevation
Describe shadows, borders, radii, and layering rules.

## Components
List priority components, states, and reusable interaction patterns.

## Do's and Don'ts
- Do: TODO capture one approved visual behavior.
- Do: TODO capture another approved visual behavior.
- Don't: TODO capture one disallowed visual behavior.
- Don't: TODO capture another disallowed visual behavior.
`
    const result = validateDesignMd(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error: string) => error.includes("Sections must appear in canonical order"))).toBe(true)
  })

  it("validateDesignMd fails when a top-level section is duplicated", () => {
    const invalid = `${scaffoldDesignMd()}\n## Colors\nPrimary: duplicate\nSecondary: duplicate\nTertiary: duplicate\nNeutral: duplicate\n`
    const result = validateDesignMd(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error: string) => error.includes("Duplicate top-level section: Colors"))).toBe(true)
  })

  it("validateDesignMd fails when required color entries are missing", () => {
    const invalid = scaffoldDesignMd().replace("Neutral: TODO define the neutral palette and surfaces.\n", "")
    const result = validateDesignMd(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error: string) => error.includes("Colors section must include Neutral:"))).toBe(true)
  })

  it("validateDesignMd fails when Do and Don't bullets are insufficient", () => {
    const invalid = scaffoldDesignMd().replace("- Don't: TODO capture another disallowed visual behavior.", "")
    const result = validateDesignMd(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error: string) => error.includes("Do's and Don'ts section must include at least 2 '- Don't:' bullets"))).toBe(true)
  })
})

describe("docs-index plugin command asset", () => {
  it("exists and uses the lightweight docs refresh contract", () => {
    const command = readFileSync(new URL("../../commands/docs-index.md", import.meta.url), "utf8")

    expect(command).toContain("agent: product-wunderkind")
    expect(command).toContain("/docs-index")
    expect(command).not.toContain("local docs-index planning support")
    expect(command).toContain("refresh/bootstrap")
    expect(command).toContain("bootstrapped from scratch when missing")
    expect(command).toContain("Never inspect parent directories")
    expect(command).toContain("ask the user whether to run `init-deep`")
    expect(command).not.toContain("explicit structured completion result")
    expect(command).not.toContain("one parallel background task per docs-eligible Wunderkind agent")
    expect(command).toContain("Partial success")
    expect(command).toContain("2026-03-12T18-37-52Z")
    expect(command).toContain("## Update 2026-03-12T18-37-52Z")
    expect(command).toContain("marketing-strategy--2026-03-12T18-37-52Z.md")
    expect(command).toContain("managed family files")
  })
})
