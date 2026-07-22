import { readFileSync } from "node:fs"
import { WUNDERKIND_AGENT_DEFINITIONS } from "../agents/manifest.js"
import { WUNDERKIND_CANONICAL_MANIFEST } from "../agents/canonical-manifest.js"
import { renderNativeAgentMarkdown } from "../agents/render-markdown.js"
import {
  getGeneratedRetainedNativeCommands,
  renderGeneratedRetainedNativeCommandMarkdown,
} from "../agents/slash-commands.js"
import {
  getRuntimeSectionGroup,
  captureCanonicalRuntimeFixtures,
} from "./prompt-runtime-fixtures.js"
import {
  PROMPT_RUNTIME_CONTRACT,
  type PromptRuntimeContract,
  type PromptSurfaceCollectionMode,
  type PromptSurfaceLayerDefinition,
  type PromptSurfaceLayerId,
  type PromptSurfaceOwnership,
} from "./prompt-runtime-contract.js"

export type TokenAuditSurface = "agents" | "commands" | "skills" | "all"
export type TokenAuditFormat = "table" | "json"
export {
  getPromptRuntimeContract,
  PROMPT_RUNTIME_AUDIT_MODE,
  PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
  PROMPT_SURFACE_LAYER_DEFINITIONS,
  type PromptRuntimeFixtureId,
} from "./prompt-runtime-contract.js"

const PROMPT_SURFACE_LAYER_MAP = new Map(
  PROMPT_RUNTIME_CONTRACT.layers.map((layer) => [layer.id, layer] as const),
)

export interface TokenAuditEntry {
  readonly id: string
  readonly layerId: string
  readonly group: string
  readonly path: string
  readonly ownership: PromptSurfaceOwnership
  readonly collectionMode: PromptSurfaceCollectionMode
  readonly bytes: number
  readonly lines: number
}

export interface TokenAuditGroup {
  readonly name: string
  readonly layerId: string
  readonly ownership: PromptSurfaceOwnership
  readonly collectionMode: PromptSurfaceCollectionMode
  readonly files: number
  readonly bytes: number
  readonly lines: number
}

export interface TokenAuditReport {
  readonly surface: TokenAuditSurface
  readonly contract: PromptRuntimeContract
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

function getLayerDefinition(layerId: PromptSurfaceLayerId): PromptSurfaceLayerDefinition {
  const layer = PROMPT_SURFACE_LAYER_MAP.get(layerId)
  if (!layer) {
    throw new Error(`Unknown prompt surface layer: ${layerId}`)
  }

  return layer
}

function createEntry(layerId: PromptSurfaceLayerId, id: string, path: string, content: string): TokenAuditEntry {
  const layer = getLayerDefinition(layerId)

  return {
    id,
    layerId,
    group: layer.group,
    path,
    ownership: layer.ownership,
    collectionMode: layer.collectionMode,
    bytes: Buffer.byteLength(content, "utf8"),
    lines: countLines(content),
  }
}

function collectAgentEntries(): readonly TokenAuditEntry[] {
  return WUNDERKIND_AGENT_DEFINITIONS.map((definition) =>
    createEntry("static-agents", definition.id, `agents/${definition.id}.md`, renderNativeAgentMarkdown(definition)),
  )
}

function collectCommandEntries(): readonly TokenAuditEntry[] {
  const staticEntries = WUNDERKIND_CANONICAL_MANIFEST.commands.static.map((command) =>
    createEntry(
      "static-commands-static",
      command.name,
      command.sourcePath,
      readFileSync(new URL(`../../${command.sourcePath}`, import.meta.url), "utf8"),
    ),
  )
  const generatedEntries = getGeneratedRetainedNativeCommands().map((command) =>
    createEntry(
      "static-commands-generated",
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
      "static-skills",
      skill.id,
      skill.sourcePath,
      readFileSync(new URL(`../../${skill.sourcePath}`, import.meta.url), "utf8"),
    ),
  )
}

async function collectRuntimeFixtureEntries(): Promise<readonly TokenAuditEntry[]> {
  const runtimeFixtureReport = await captureCanonicalRuntimeFixtures()
  const entries: TokenAuditEntry[] = []

  for (const fixture of runtimeFixtureReport.fixtures) {
    for (const [index, section] of fixture.sections.entries()) {
      const group = getRuntimeSectionGroup(section)
      if (!group || group === "runtime-soul-overlay") continue

      const layerId = PROMPT_RUNTIME_CONTRACT.layers.find((layer) => layer.group === group)?.id
      if (!layerId) {
        throw new Error(`No prompt-runtime layer registered for group: ${group}`)
      }

      entries.push(
        createEntry(
          layerId as PromptSurfaceLayerId,
          `${fixture.fixtureId}:${group}:${index}`,
          `runtime-fixtures/${fixture.fixtureId}#${group}`,
          section,
        ),
      )
    }

    const compactionContent = fixture.compactionContext.join("\n")
    entries.push(
      createEntry(
        "compaction-continuity",
        `${fixture.fixtureId}:compaction-continuity`,
        `runtime-fixtures/${fixture.fixtureId}#compaction-continuity`,
        compactionContent,
      ),
    )
  }

  return entries
}

function summarizeGroup(entries: readonly TokenAuditEntry[]): TokenAuditGroup {
  const firstEntry = entries[0]
  if (!firstEntry) {
    throw new Error("Cannot summarize an empty token-audit group")
  }

  return {
    name: firstEntry.group,
    layerId: firstEntry.layerId,
    ownership: firstEntry.ownership,
    collectionMode: firstEntry.collectionMode,
    files: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    lines: entries.reduce((sum, entry) => sum + entry.lines, 0),
  }
}

export async function collectTokenAuditReport(surface: TokenAuditSurface = "agents"): Promise<TokenAuditReport> {
  const groupedEntries: TokenAuditEntry[][] = []

  if (surface === "agents" || surface === "all") {
    groupedEntries.push([...collectAgentEntries()])
  }

  if (surface === "commands" || surface === "all") {
    const commandEntries = collectCommandEntries()
    groupedEntries.push(commandEntries.filter((entry) => entry.group === "commands-static"))
    groupedEntries.push(commandEntries.filter((entry) => entry.group === "commands-generated"))
  }

  if (surface === "skills" || surface === "all") {
    groupedEntries.push([...collectSkillEntries()])
  }

  if (surface === "all") {
    const runtimeEntries = await collectRuntimeFixtureEntries()
    groupedEntries.push(runtimeEntries.filter((entry) => entry.group === "runtime-docs-output"))
    groupedEntries.push(runtimeEntries.filter((entry) => entry.group === "runtime-context"))
    groupedEntries.push(runtimeEntries.filter((entry) => entry.group === "runtime-native-agents"))
    groupedEntries.push(runtimeEntries.filter((entry) => entry.group === "compaction-continuity"))
  }

  const filteredGroups = groupedEntries.filter((entries) => entries.length > 0)
  const summarizedGroups = filteredGroups.map((entries) => summarizeGroup(entries))
  const entries = filteredGroups.flat()

  return {
    surface,
    contract: PROMPT_RUNTIME_CONTRACT,
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
