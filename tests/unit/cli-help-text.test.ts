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
    expect(output).toContain("default-off multi-level prompt optimization engine")
    expect(output).toContain("promptOptimizationLevel")
    expect(output).toContain("promptOptimizationReportingMode")
    expect(output).toContain("sanitized/redacted latest-report artifacts")
    expect(output).toContain("summaries on the separate runtime-report surface")
    expect(output).toContain("separate runtime-report surface")
    expect(output).toContain("no public optimize command")
    expect(output).toContain("security-safe baseline")
    expect(output).toContain("Legacy enabled repos without a level")
    expect(output).toContain("no persistent cross-session memory")
    expect(output).toContain("no automatic context injection")
    expect(output).toContain("Direct `wunderkind ...` is supported")
    expect(output).toContain("on PATH")
    expect(output).toContain("`bunx @grant-vine/wunderkind ...` remains the safe fallback")
    expect(output).toContain("auto-edit shell PATH")
    expect(output).not.toContain("  optimize")
    expect(output).not.toContain("  prompt-optimization")
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
    expect(output).toContain("Registers Wunderkind with OpenCode")
    expect(output).toContain("does not bootstrap the current repo")
    expect(output).toContain("run `bunx @grant-vine/wunderkind init` after install")
    expect(output).toContain("non-interactive use in CI or scripted environments")
    expect(output).toContain("optional baseline default flags")
    expect(output).toContain("oh-my-openagent")
    expect(output).toContain("Direct `wunderkind ...` is supported")
    expect(output).toContain("current shell PATH")
    expect(output).toContain("`bunx @grant-vine/wunderkind ...` remains the safe fallback")
    expect(output).not.toContain("oh-my-opencode")
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
    expect(output).toContain("Leaves AGENTS.md, .omo/, docs output")
  })

  it("includes migrate command help text", () => {
    const output = runCliHelp("migrate", "--help")

    expect(output).toContain("Migrate legacy OMO config into the unified ~/.omo/omo.jsonc chain")
    expect(output).toContain("--dry-run")
    expect(output).toContain("--json")
    expect(output).toContain("oh-my-openagent config migrate")
  })

  it("includes upgrade command help text", () => {
    const output = runCliHelp("upgrade", "--help")

    expect(output).toContain("Refresh Wunderkind-owned native assets")
    expect(output).toContain("--dry-run")
    expect(output).toContain("--refresh-config")
    expect(output).toContain("promptOptimizationLevel")
    expect(output).toContain("legacy enabled repos")
    expect(output).toContain("explicitly choose a level")
  })

  it("includes verbose doctor help text", () => {
    const output = runCliHelp("doctor", "--help")

    expect(output).toContain("Enable verbose diagnostic output")
    expect(output).toContain("distinguishes install status from project readiness")
    expect(output).toContain("promptOptimizationReportingMode")
    expect(output).toContain(".wunderkind/runtime/prompt-optimization/system-transform.latest.json")
    expect(output).toContain(".wunderkind/runtime/prompt-optimization/session-compacting.latest.json")
    expect(output).toContain("configuration posture")
    expect(output).toContain("sanitized/redacted latest-report artifact status")
    expect(output).toContain("token-audit remains separate")
    expect(output).toContain("latest-user, runtime-and-tools, contextual")
    expect(output).toContain("transcript")
    expect(output).toContain("security-safe baseline")
    expect(output).toContain("no persistent cross-session memory writes")
    expect(output).toContain("no automatic context injection")
    expect(output).toContain("runtime-report-only")
    expect(output).toContain("promptOptimizationLevel")
    expect(output).toContain("legacy enabled repos without a level")
    expect(output).toContain("explicitly choose one")
    expect(output).toContain("reports whether direct `wunderkind` invocation is available in the current shell PATH")
    expect(output).toContain("does not edit shell PATH")
  })

  it("includes workflow-sync command help text", () => {
    const output = runCliHelp("workflow-sync", "--help")

    expect(output).toContain("Synchronize a local .omo workflow plan into GitHub Issues")
    expect(output).toContain("--plan <path>")
    expect(output).toContain("--all")
    expect(output).toContain("--apply")
    expect(output).toContain(".wunderkind/workflows/github-issues/")
    expect(output).not.toContain("requires prdPipelineMode=github")
  })

  it("includes token-audit command help text", () => {
    const output = runCliHelp("token-audit", "--help")

    expect(output).toContain("Report deterministic prompt-surface size metrics")
    expect(output).toContain("--surface <surface>")
    expect(output).toContain("--format <format>")
    expect(output).toContain("bytes, lines, and file counts")
    expect(output).toContain("audit-only")
    expect(output).toContain("no live prompt packing")
    expect(output).toContain("no model-token truth claims")
    expect(output).toContain("doctor --verbose")
    expect(output).toContain("runtime-report artifact status")
    expect(output).toContain("config-driven and separate from this audit-only report")
    expect(output).toContain("multi-level prompt optimization engine")
    expect(output).toContain("latest-user, runtime-and-tools, contextual")
    expect(output).toContain("transcript")
    expect(output).toContain("runtime-report-only")
    expect(output).toContain("not summary metadata guidance")
    expect(output).toContain("no persistent cross-session memory writes")
    expect(output).toContain("no automatic context injection")
    expect(output).toContain("exact-local")
    expect(output).toContain("provider-api-only")
    expect(output).toContain("unsupported")
    expect(output).toContain("configured-bytes")
    expect(output).toContain("budget-unavailable")
    expect(output).not.toContain("promptOptimizationReportingMode")
    expect(output).not.toContain("exact-openai-tokens")
  })

  it("includes team-bootstrap command help text", () => {
    const output = runCliHelp("team-bootstrap", "--help")

    expect(output).toContain("Create the canonical Wunderkind upstream team spec")
    expect(output).toContain("--scope <scope>")
    expect(output).toContain("project scope writes to <project>/.omo/teams/{name}/config.json")
    expect(output).toContain("user scope writes to ~/.omo/teams/{name}/config.json")
    expect(output).toContain("What do you want to do today?")
    expect(output).toContain("/wunderkind-team")
    expect(output).toContain("team_mode.enabled")
    expect(output).toContain("oh-my-openagent.jsonc/.json")
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

    expect(output).toContain("bunx @grant-vine/wunderkind")
    expect(output).toContain("Bootstraps repo-local readiness after install")
    expect(output).toContain("does not register Wunderkind with OpenCode")
    expect(output).toContain("does not replace")
    expect(output).toContain("@grant-vine/wunderkind install")
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
