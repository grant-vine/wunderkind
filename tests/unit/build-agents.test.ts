import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { WUNDERKIND_AGENT_DEFINITIONS } from "../../src/agents/manifest.js"
import { renderNativeAgentMarkdown } from "../../src/agents/render-markdown.js"
import { RETAINED_AGENT_SLASH_COMMANDS } from "../../src/agents/slash-commands.js"

const AGENTS_DIR = fileURLToPath(new URL("../../agents/", import.meta.url))

describe("build-agents script", () => {
  it("regenerates every shipped agent markdown file from the manifest", async () => {
    const backups = new Map<string, string>()
    const messages: string[] = []
    const originalLog = console.log

    for (const definition of WUNDERKIND_AGENT_DEFINITIONS) {
      const filePath = join(AGENTS_DIR, `${definition.id}.md`)
      if (existsSync(filePath)) {
        backups.set(filePath, readFileSync(filePath, "utf-8"))
      }
    }

    console.log = (...args: unknown[]) => {
      messages.push(args.map((arg) => String(arg)).join(" "))
    }

    try {
      await import(`../../src/build-agents.ts?build-agents-test=${Date.now()}`)

      expect(messages.some((message) => message.includes("Generated agents/marketing-wunderkind.md"))).toBe(true)
      expect(messages.some((message) => message.includes(`Generated ${WUNDERKIND_AGENT_DEFINITIONS.length} agent files`))).toBe(true)

      for (const definition of WUNDERKIND_AGENT_DEFINITIONS) {
        const filePath = join(AGENTS_DIR, `${definition.id}.md`)
        expect(existsSync(filePath)).toBe(true)
        expect(readFileSync(filePath, "utf-8")).toBe(renderNativeAgentMarkdown(definition))
      }
    } finally {
      console.log = originalLog

      for (const [filePath, content] of backups) {
        writeFileSync(filePath, content, "utf-8")
      }
    }
  })

  it("keeps high-signal generated prompt surfaces in the expected markdown shape", () => {
    const marketing = readFileSync(join(AGENTS_DIR, "marketing-wunderkind.md"), "utf-8")
    const ciso = readFileSync(join(AGENTS_DIR, "ciso.md"), "utf-8")
    const fullstack = readFileSync(join(AGENTS_DIR, "fullstack-wunderkind.md"), "utf-8")

    expect(marketing).toContain("---\ndescription: >")
    expect(marketing).toContain("mode: all")
    expect(marketing).toContain("# Marketing Wunderkind — Soul")
    expect(marketing).toContain("## SOUL Maintenance (.wunderkind/souls/)")
    expect(marketing).toContain("Every slash command must support a `--help` form.")
    expect(marketing).toContain("task: deny")
    expect(ciso).toContain("# CISO — Soul")
    expect(ciso).toContain("72 hours")
    expect(fullstack).toContain("# Fullstack Wunderkind — Soul")
    expect(fullstack).not.toContain("task: deny")
  })

  it("renders all registered slash commands into generated markdown", () => {
    for (const [agentId, registry] of Object.entries(RETAINED_AGENT_SLASH_COMMANDS)) {
      const markdown = readFileSync(join(AGENTS_DIR, `${agentId}.md`), "utf-8")
      expect(markdown).toContain("Every slash command must support a `--help` form.")

      for (const command of registry.commands) {
        expect(markdown).toContain(`### \`${command.command}\``)
      }
    }
  })

  it("tracks delegation contract coverage in generated agent markdown", () => {
    const TASK_CAPABLE = ["product-wunderkind", "fullstack-wunderkind", "ciso"] as const
    const TASK_DENIED = ["marketing-wunderkind", "creative-director", "legal-counsel"] as const

    for (const agent of TASK_CAPABLE) {
      const markdown = readFileSync(join(AGENTS_DIR, `${agent}.md`), "utf-8")
      expect(markdown).toContain("## Delegation Contract")
    }

    for (const agent of TASK_DENIED) {
      const markdown = readFileSync(join(AGENTS_DIR, `${agent}.md`), "utf-8")
      expect(markdown).not.toContain("## Delegation Contract")
    }
  })
})
