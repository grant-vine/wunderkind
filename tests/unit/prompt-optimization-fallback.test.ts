import { describe, expect, it } from "bun:test"
import { fileURLToPath } from "node:url"
import { runTokenAudit } from "../../src/cli/token-audit.js"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))

describe("prompt optimization fallback policy", () => {
  it("emits the frozen three-state fallback policy in token-audit JSON", async () => {
    const logs: string[] = []

    const exitCode = await runTokenAudit({
      cwd: PROJECT_ROOT,
      surface: "all",
      format: "json",
      writeStdout: (line) => logs.push(line),
      writeStderr: () => {},
    })

    expect(exitCode).toBe(0)
    expect(logs).toHaveLength(1)

    const parsed = JSON.parse(logs[0] ?? "{}") as {
      readonly contract: {
        readonly supplementaryOptimization: {
          readonly countStates?: readonly {
            readonly state: string
            readonly label: string
          }[]
        }
      }
    }

    expect(parsed.contract.supplementaryOptimization.countStates).toEqual([
      { state: "exact-local", label: "supported OpenAI model map" },
      { state: "provider-api-only", label: "unmapped OpenAI aliases" },
      { state: "unsupported", label: "non-OpenAI providers" },
    ])
  })

  it("renders the frozen three-state fallback policy in token-audit table output", async () => {
    const logs: string[] = []

    const exitCode = await runTokenAudit({
      cwd: PROJECT_ROOT,
      surface: "all",
      format: "table",
      writeStdout: (line) => logs.push(line),
      writeStderr: () => {},
    })

    expect(exitCode).toBe(0)
    expect(logs).toContain("Prompt optimization count states:")
    expect(logs).toContain("- exact-local: supported OpenAI model map")
    expect(logs).toContain("- provider-api-only: unmapped OpenAI aliases")
    expect(logs).toContain("- unsupported: non-OpenAI providers")
  })
})
