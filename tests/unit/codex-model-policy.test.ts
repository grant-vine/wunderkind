import { describe, expect, it } from "bun:test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { applyCodexModelPolicy, inspectCodexModelPolicy } from "../../src/cli/codex/model-policy.js"
import { cleanup, sandbox } from "./helpers/codex-lifecycle-fixtures.js"

describe("Codex model policy", () => {
  it("replaces detected Astra assignments with the user-owned Sol and Luna policy", () => {
    const paths = sandbox()
    const highWorker = join(paths.codexHome, "agents", "lazycodex-worker-high.toml")
    const explorer = join(paths.codexHome, "agents", "explorer.toml")
    const rootConfig = join(paths.codexHome, "config.toml")

    try {
      mkdirSync(join(paths.codexHome, "agents"), { recursive: true })
      writeFileSync(rootConfig, 'model = "gpt-6-astra"\n', "utf8")
      writeFileSync(highWorker, 'model = "gpt-6-astra"\n', "utf8")
      writeFileSync(explorer, 'model = "gpt-6-astra"\n', "utf8")

      const detected = inspectCodexModelPolicy(paths)
      expect(detected.status).toBe("drifted")
      expect(detected.astraAssignments).toEqual(["root", "lazycodex-worker-high", "explorer"])

      const applied = applyCodexModelPolicy(paths)

      expect(applied.status).toBe("compliant")
      expect(readFileSync(rootConfig, "utf8")).toContain('model = "gpt-6-sol"')
      expect(readFileSync(highWorker, "utf8")).toContain('model = "gpt-6-sol"')
      expect(readFileSync(explorer, "utf8")).toContain('model = "gpt-6-luna"')
      expect(inspectCodexModelPolicy(paths).astraAssignments).toEqual([])
    } finally {
      cleanup(paths)
    }
  })
})
