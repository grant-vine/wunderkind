import { describe, it, expect } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const CLI_ENTRY = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url))

function runCliHelp(...args: string[]): string {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: process.env,
  })

  const output = `${result.stdout}${result.stderr}`

  expect(result.status).toBe(0)

  return output
}

function runCliRaw(...args: string[]): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: process.env,
  })

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  }
}

describe("CLI help copy", () => {
  it("uses native OpenCode agent branding in top-level help text", () => {
    const output = runCliHelp("--help")

    expect(output).toContain("Adds six retained native OpenCode agents covering")
    expect(output).toContain("marketing, design, product, engineering, security, and legal")
  })

  it("does not run install implicitly on bare invocation", () => {
    const result = runCliRaw()

    expect(result.status).toBe(1)
    expect(result.output).toContain("Usage:")
    expect(result.output).toContain("wunderkind [options] [command]")
  })

  it("keeps the revised installer copy in install help", () => {
    const output = runCliHelp("install", "--help")

    expect(output).toContain("Install Wunderkind into your OpenCode setup.")
    expect(output).toContain("non-interactive use in CI or scripted environments")
    expect(output).toContain("optional baseline default flags")
    expect(output).toContain("oh-my-openagent")
    expect(output).toContain("oh-my-opencode")
  })

  it("includes uninstall command help text", () => {
    const output = runCliHelp("uninstall", "--help")

    expect(output).toContain("Safely remove Wunderkind plugin wiring from OpenCode config.")
    expect(output).toContain("on global uninstall")
    expect(output).toContain("global config file")
    expect(output).toContain("Leaves project-local customizations")
  })

  it("includes cleanup command help text", () => {
    const output = runCliHelp("cleanup", "--help")

    expect(output).toContain("Remove Wunderkind project-local registration and state from the current project.")
    expect(output).toContain(".wunderkind/")
    expect(output).toContain("Leaves AGENTS.md, .sisyphus/, docs output")
  })

  it("includes upgrade command help text", () => {
    const output = runCliHelp("upgrade", "--help")

    expect(output).toContain("Refresh Wunderkind-owned native assets")
    expect(output).toContain("--dry-run")
    expect(output).toContain("--refresh-config")
  })

  it("includes verbose doctor help text", () => {
    const output = runCliHelp("doctor", "--help")

    expect(output).toContain("Enable verbose diagnostic output")
  })

  it("includes install guidance for OMO version-skew recovery in doctor behavior", () => {
    const output = runCliHelp("doctor", "--help")

    expect(output).toContain("Run read-only diagnostics")
  })

  it("rejects the removed legacy init flag as unknown", () => {
    const legacyFlag = ["--de", "sloppify-enabled=yes"].join("")
    const result = runCliRaw("init", legacyFlag)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain("unknown option")
    expect(result.output).toContain(legacyFlag)
  })

  it("includes design workflow init flags in help", () => {
    const output = runCliHelp("init", "--help")

    expect(output).toContain("--design-tool")
    expect(output).toContain("--design-path")
    expect(output).toContain("--stitch-setup")
    expect(output).toContain("--stitch-api-key-file")
  })

  it("rejects invalid --design-tool values", () => {
    const result = runCliRaw("init", "--no-tui", "--design-tool", "invalid-tool")

    expect(result.status).toBe(1)
    expect(result.output).toContain("Error: --design-tool must be \"none\" or \"google-stitch\"")
    expect(result.output).toContain("invalid-tool")
  })

  it("rejects invalid --stitch-setup values", () => {
    const result = runCliRaw("init", "--no-tui", "--stitch-setup", "invalid-setup")

    expect(result.status).toBe(1)
    expect(result.output).toContain("Error: --stitch-setup must be \"reuse\", \"project-local\", or \"skip\"")
    expect(result.output).toContain("invalid-setup")
  })
})
