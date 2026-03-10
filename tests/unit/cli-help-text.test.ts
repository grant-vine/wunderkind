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

describe("CLI help copy", () => {
  it("uses oh-my-openagent branding in top-level help text", () => {
    const output = runCliHelp("--help")

    expect(output).toContain("Extends oh-my-openagent with twelve professional agents covering")
    expect(output).toContain("security, devrel, legal, support, and data analysis")
  })

  it("keeps the revised installer copy in install help", () => {
    const output = runCliHelp("install", "--help")

    expect(output).toContain("Install Wunderkind into your OpenCode setup.")
    expect(output).toContain("non-interactive use in CI or scripted environments")
  })
})
