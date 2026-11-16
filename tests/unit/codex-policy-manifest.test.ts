import { describe, expect, it } from "bun:test"
import { policyManifestRoles } from "../../src/cli/codex/policy-manifest.js"

const windowsHome = String.raw`C:\Users\GrantVine\.codex`

describe("policy manifest containment", () => {
  it("accepts native Windows paths and mixed separators inside the exact agents directory", () => {
    const entries = [String.raw`C:\Users\GrantVine\.codex\agents\default.toml`, "c:/Users/GrantVine/.codex/agents/explorer.toml"]
    expect(policyManifestRoles(windowsHome, entries)).toEqual(["default.toml", "explorer.toml"])
  })

  it("accepts POSIX paths without altering role names", () => {
    expect(policyManifestRoles("/home/grant/.codex", ["/home/grant/.codex/agents/default.toml"])).toEqual(["default.toml"])
  })

  for (const entry of [
    String.raw`C:\Users\GrantVine\.codex\agents-foreign\default.toml`,
    String.raw`C:\Users\GrantVine\.codex\agents\..\agents\default.toml`,
    String.raw`C:\Users\GrantVine\.codex\agents\nested\default.toml`,
    String.raw`D:\Users\GrantVine\.codex\agents\default.toml`,
    String.raw`C:Users\GrantVine\.codex\agents\default.toml`,
    String.raw`\Users\GrantVine\.codex\agents\default.toml`,
    String.raw`\\?\C:\Users\GrantVine\.codex\agents\default.toml`,
    String.raw`\\server\share\agents\default.toml`,
    String.raw`C:\Users\GrantVine\.codex\agents\default.toml:stream`,
    String.raw`C:\Users\GrantVine\.codex\agents\default.toml.`,
    String.raw`C:\Users\GrantVine\.codex\agents\default.toml `,
    String.raw`C:\Users\GrantVine\.codex\agents\custom.toml`,
    String.raw`C:\Users\GrantVine\.codex\agents\DEFAULT.toml`,
    "file:///C:/Users/GrantVine/.codex/agents/default.toml",
    "C:/Users/GrantVine/.codex/agents/%2e%2e/default.toml",
    "C:/Users/GrantVine/.codex/agents/default.toml\u0000",
  ]) it(`rejects unsafe or unexpected Windows entry ${JSON.stringify(entry)}`, () => {
    expect(() => policyManifestRoles(windowsHome, [entry])).toThrow()
  })

  for (const entries of [null, {}, [1], ["/home/grant/.codex/agents/custom.toml"], ["/home/grant/.codex/agents/default.toml", "/home/grant/.codex/agents/default.toml"], ["/home/grant/.codex/agents/../agents/default.toml"]]) {
    it(`rejects malformed, duplicate, unknown or traversing POSIX entries ${JSON.stringify(entries)}`, () => {
      expect(() => policyManifestRoles("/home/grant/.codex", entries)).toThrow()
    })
  }
})
