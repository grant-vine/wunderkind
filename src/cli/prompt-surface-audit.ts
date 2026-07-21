import { readFileSync } from "node:fs"
import { WUNDERKIND_AGENT_DEFINITIONS } from "../agents/manifest.js"
import { WUNDERKIND_CANONICAL_MANIFEST } from "../agents/canonical-manifest.js"
import { renderNativeAgentMarkdown } from "../agents/render-markdown.js"
import {
  getGeneratedRetainedNativeCommands,
  renderGeneratedRetainedNativeCommandMarkdown,
} from "../agents/slash-commands.js"

export type TokenAuditSurface = "agents" | "commands" | "skills" | "all"
export type TokenAuditFormat = "table" | "json"

export interface TokenAuditEntry {
  readonly id: string
  readonly group: string
  readonly path: string
  readonly bytes: number
  readonly lines: number
}

export interface TokenAuditGroup {
  readonly name: string
  readonly files: number
  readonly bytes: number
  readonly lines: number
}

export interface TokenAuditReport {
  readonly surface: TokenAuditSurface
  readonly totals: {
    readonly files: number
    readonly bytes: number
    readonly lines: number
  }
  readonly groups: readonly TokenAuditGroup[]
  readonly entries: readonly TokenAuditEntry[]
}

function countLines(content: string): number {
  return content.split(/\r?\n/).length
}

function createEntry(group: string, id: string, path: string, content: string): TokenAuditEntry {
  return {
    id,
    group,
    path,
    bytes: Buffer.byteLength(content, "utf8"),
    lines: countLines(content),
  }
}

function collectAgentEntries(): readonly TokenAuditEntry[] {
  return WUNDERKIND_AGENT_DEFINITIONS.map((definition) =>
    createEntry("agents", definition.id, `agents/${definition.id}.md`, renderNativeAgentMarkdown(definition)),
  )
}

function collectCommandEntries(): readonly TokenAuditEntry[] {
  const staticEntries = WUNDERKIND_CANONICAL_MANIFEST.commands.static.map((command) =>
    createEntry(
      "commands-static",
      command.name,
      command.sourcePath,
      readFileSync(new URL(`../../${command.sourcePath}`, import.meta.url), "utf8"),
    ),
  )
  const generatedEntries = getGeneratedRetainedNativeCommands().map((command) =>
    createEntry(
      "commands-generated",
      command.name,
      `generated:${command.name}`,
      renderGeneratedRetainedNativeCommandMarkdown(command),
    ),
  )

  return [...staticEntries, ...generatedEntries]
}

function collectSkillEntries(): readonly TokenAuditEntry[] {
  return WUNDERKIND_CANONICAL_MANIFEST.skills.map((skill) =>
    createEntry(
      "skills",
      skill.id,
      skill.sourcePath,
      readFileSync(new URL(`../../${skill.sourcePath}`, import.meta.url), "utf8"),
    ),
  )
}

function summarizeGroup(name: string, entries: readonly TokenAuditEntry[]): TokenAuditGroup {
  return {
    name,
    files: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    lines: entries.reduce((sum, entry) => sum + entry.lines, 0),
  }
}

export function collectTokenAuditReport(surface: TokenAuditSurface = "agents"): TokenAuditReport {
  const groups = new Map<string, readonly TokenAuditEntry[]>()

  if (surface === "agents" || surface === "all") {
    groups.set("agents", collectAgentEntries())
  }

  if (surface === "commands" || surface === "all") {
    const commandEntries = collectCommandEntries()
    groups.set(
      "commands-static",
      commandEntries.filter((entry) => entry.group === "commands-static"),
    )
    groups.set(
      "commands-generated",
      commandEntries.filter((entry) => entry.group === "commands-generated"),
    )
  }

  if (surface === "skills" || surface === "all") {
    groups.set("skills", collectSkillEntries())
  }

  const summarizedGroups = [...groups.entries()].map(([name, entries]) => summarizeGroup(name, entries))
  const entries = [...groups.values()].flat()

  return {
    surface,
    totals: {
      files: entries.length,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      lines: entries.reduce((sum, entry) => sum + entry.lines, 0),
    },
    groups: summarizedGroups,
    entries,
  }
}

export function renderTokenAuditTable(report: TokenAuditReport): readonly string[] {
  const lines = [
    "Token audit report",
    `Surface: ${report.surface}`,
    `Files: ${report.totals.files}`,
    `Bytes: ${report.totals.bytes}`,
    `Lines: ${report.totals.lines}`,
  ]

  for (const group of report.groups) {
    lines.push(`${group.name}: ${group.files} files, ${group.bytes} bytes, ${group.lines} lines`)
  }

  return lines
}
