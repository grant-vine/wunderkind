import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const CLI_ENTRY = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url))

function runCli(...args: readonly string[]): { readonly status: number | null; readonly output: string } {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: process.env,
  })

  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

describe("Codex CLI help", () => {
  it("exposes only the nested Codex lifecycle family", () => {
    // Given: the installed Wunderkind CLI entry point.
    // When: the Codex command group help is requested.
    const result = runCli("codex", "--help")

    // Then: every Codex lifecycle verb is discoverable as a nested command.
    expect(result.status).toBe(0)
    for (const verb of ["install", "upgrade", "doctor", "uninstall", "init", "cleanup"]) {
      expect(result.output).toContain(verb)
    }
  })

  it("rejects unknown Codex verbs without running lifecycle actions", () => {
    // Given: the installed Wunderkind CLI entry point.
    // When: an unknown Codex command is requested.
    const result = runCli("codex", "unknown-verb")

    // Then: Commander rejects the request before any lifecycle action.
    expect(result.status).not.toBe(0)
    expect(result.output).toContain("unknown command")
  })

  it("keeps OpenCode-only flags out of Codex install", () => {
    // Given: the installed Wunderkind CLI entry point.
    // When: an OpenCode installer flag is supplied to Codex install.
    const result = runCli("codex", "install", "--scope=global")

    // Then: Commander rejects the incompatible option before installation.
    expect(result.status).not.toBe(0)
    expect(result.output).toContain("unknown option")
    expect(result.output).toContain("--scope")
  })

  it("renders help for each Codex lifecycle verb", () => {
    // Given: the installed Wunderkind CLI entry point.
    // When: every Codex lifecycle verb help page is requested.
    const helpPages = ["install", "upgrade", "doctor", "uninstall", "init", "cleanup"].map((verb) => ({
      verb,
      result: runCli("codex", verb, "--help"),
    }))

    // Then: each help page is available, with doctor exposing its report formats.
    for (const { result } of helpPages) expect(result.status).toBe(0)
    const doctor = helpPages.find(({ verb }) => verb === "doctor")
    expect(doctor?.result.output).toContain("--json")
    expect(doctor?.result.output).toContain("--verbose")
  })

  it("documents the released npx lifecycle while retaining the local packed equivalent", () => {
    // Given: the public Codex capability guide for the released Codex surface.
    const guide = readFileSync(fileURLToPath(new URL("../../docs/codex-capabilities.md", import.meta.url)), "utf8")

    // When: a released operator follows the documented install path.
    const releasedInstall = "npx @grant-vine/wunderkind codex install"

    // Then: the guide distinguishes the published command from the maintainer packed QA form.
    expect(guide).toContain(releasedInstall)
    expect(guide).toContain("node package/bin/wunderkind.js codex <verb>")
    expect(guide).toContain("ships in `@grant-vine/wunderkind` `0.27.0` and later")
    expect(guide).not.toContain("unreleased, local package surface")
  })
})
