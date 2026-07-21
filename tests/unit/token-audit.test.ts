import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { WUNDERKIND_AGENT_DEFINITIONS } from "../../src/agents/manifest.js"
import { WUNDERKIND_CANONICAL_MANIFEST } from "../../src/agents/canonical-manifest.js"
import { renderNativeAgentMarkdown } from "../../src/agents/render-markdown.js"
import {
  getGeneratedRetainedNativeCommands,
  renderGeneratedRetainedNativeCommandMarkdown,
} from "../../src/agents/slash-commands.js"
import { runTokenAudit } from "../../src/cli/token-audit.js"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))

function countLines(content: string): number {
  return content.split(/\r?\n/).length
}

describe("runTokenAudit", () => {
  it("defaults to an agents table report derived from rendered native agent markdown", async () => {
    const logs: string[] = []
    const errors: string[] = []
    const renderedAgents = WUNDERKIND_AGENT_DEFINITIONS.map((definition) => renderNativeAgentMarkdown(definition))
    const totalBytes = renderedAgents.reduce((sum, markdown) => sum + Buffer.byteLength(markdown, "utf8"), 0)
    const totalLines = renderedAgents.reduce((sum, markdown) => sum + countLines(markdown), 0)

    const exitCode = await runTokenAudit({
      cwd: PROJECT_ROOT,
      writeStdout: (line) => logs.push(line),
      writeStderr: (line) => errors.push(line),
    })

    expect(exitCode).toBe(0)
    expect(errors).toEqual([])
    expect(logs).toContain("Token audit report")
    expect(logs).toContain("Surface: agents")
    expect(logs).toContain(`Files: ${WUNDERKIND_AGENT_DEFINITIONS.length}`)
    expect(logs).toContain(`Bytes: ${totalBytes}`)
    expect(logs).toContain(`Lines: ${totalLines}`)
  })

  it("emits deterministic JSON for the commands surface using source-owned assets and renderers", async () => {
    const logs: string[] = []
    const errors: string[] = []
    const staticCommands = WUNDERKIND_CANONICAL_MANIFEST.commands.static.map((command) => ({
      id: command.name,
      bytes: Buffer.byteLength(readFileSync(new URL(`../../${command.sourcePath}`, import.meta.url), "utf8"), "utf8"),
      lines: countLines(readFileSync(new URL(`../../${command.sourcePath}`, import.meta.url), "utf8")),
    }))
    const generatedCommands = getGeneratedRetainedNativeCommands().map((command) => ({
      id: command.name,
      bytes: Buffer.byteLength(renderGeneratedRetainedNativeCommandMarkdown(command), "utf8"),
      lines: countLines(renderGeneratedRetainedNativeCommandMarkdown(command)),
    }))

    const exitCode = await runTokenAudit({
      cwd: PROJECT_ROOT,
      surface: "commands",
      format: "json",
      writeStdout: (line) => logs.push(line),
      writeStderr: (line) => errors.push(line),
    })

    expect(exitCode).toBe(0)
    expect(errors).toEqual([])
    expect(logs).toHaveLength(1)

    const parsed = JSON.parse(logs[0] ?? "{}") as {
      readonly surface: string
      readonly totals: {
        readonly files: number
        readonly bytes: number
        readonly lines: number
      }
      readonly groups: readonly {
        readonly name: string
        readonly files: number
        readonly bytes: number
        readonly lines: number
      }[]
    }

    const expectedStaticBytes = staticCommands.reduce((sum, command) => sum + command.bytes, 0)
    const expectedGeneratedBytes = generatedCommands.reduce((sum, command) => sum + command.bytes, 0)
    const expectedStaticLines = staticCommands.reduce((sum, command) => sum + command.lines, 0)
    const expectedGeneratedLines = generatedCommands.reduce((sum, command) => sum + command.lines, 0)

    expect(parsed.surface).toBe("commands")
    expect(parsed.totals.files).toBe(staticCommands.length + generatedCommands.length)
    expect(parsed.totals.bytes).toBe(expectedStaticBytes + expectedGeneratedBytes)
    expect(parsed.totals.lines).toBe(expectedStaticLines + expectedGeneratedLines)
    expect(parsed.groups).toEqual([
      {
        name: "commands-static",
        files: staticCommands.length,
        bytes: expectedStaticBytes,
        lines: expectedStaticLines,
      },
      {
        name: "commands-generated",
        files: generatedCommands.length,
        bytes: expectedGeneratedBytes,
        lines: expectedGeneratedLines,
      },
    ])
  })
})
