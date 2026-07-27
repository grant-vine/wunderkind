import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS,
  PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_IDS,
  PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
  type PromptOptimizationV4ImmutableContentRuleId,
  type PromptOptimizationV4MutableAllowlistRuleId,
  type PromptOptimizationV4PassthroughReasonId,
  type PromptOptimizationV4UserPromptFixtureId,
  type PromptRuntimeFixtureId,
} from "./prompt-runtime-contract.js"
import { applyWunderkindSystemTransform, buildCompactionContext } from "../runtime-prompt-sections.js"
import type { InstallConfig } from "./types.js"

const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"
const RUNTIME_CONTEXT_SENTINEL = "<!-- wunderkind:runtime-context-start -->"
const NATIVE_AGENTS_SENTINEL = "<!-- wunderkind:native-agents-start -->"
const SOUL_RUNTIME_SENTINEL_PREFIX = "<!-- wunderkind:soul-runtime-start:"

export interface CanonicalRuntimeFixtureCapture {
  readonly fixtureId: PromptRuntimeFixtureId
  readonly sections: readonly string[]
  readonly compactionContext: readonly string[]
}

export interface CanonicalRuntimeFixtureReport {
  readonly fixtures: readonly CanonicalRuntimeFixtureCapture[]
}

export interface PromptOptimizationEligibleSection {
  readonly id: "runtime-docs-output" | "runtime-context" | "runtime-native-agents" | "compaction-continuity"
  readonly content: string
}

export type PromptOptimizationHelperFixtureId = (typeof PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS)[number]
export type PromptOptimizationV4UserPromptFixtureMessage = {
  readonly role: "user" | "assistant"
  readonly content: string
}

export interface PromptOptimizationV4UserPromptFixtureExpectation {
  readonly kind: "safe-optimization" | "whole-message-passthrough"
  readonly earlierUserMessage: string
  readonly beforeLatestUserMessage: string
  readonly afterLatestUserMessage: string
  readonly expectedMessagesAfterOptimization: readonly PromptOptimizationV4UserPromptFixtureMessage[]
  readonly expectedPassthroughReason: PromptOptimizationV4PassthroughReasonId | null
  readonly expectedImmutableRuleIds: readonly (
    | PromptOptimizationV4ImmutableContentRuleId
    | PromptOptimizationV4MutableAllowlistRuleId
    | null
  )[]
}

export interface PromptOptimizationV4UserPromptFixtureCapture {
  readonly fixtureId: PromptOptimizationV4UserPromptFixtureId
  readonly wunderkindConfig: Partial<InstallConfig>
  readonly input: {
    readonly modelId: string
    readonly model: string
    readonly messages: readonly PromptOptimizationV4UserPromptFixtureMessage[]
  }
  readonly expectation: PromptOptimizationV4UserPromptFixtureExpectation
}

const PROMPT_OPTIMIZATION_HELPER_FIXTURE_ID_SET = new Set<string>(PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS)
const PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_ID_SET = new Set<string>(
  PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_IDS,
)
const PROMPT_RUNTIME_FIXTURE_ID_SET = new Set<string>([
  ...PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
  ...PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS,
])

function createV4UserPromptFixtureConfig(): Partial<InstallConfig> {
  return {
    region: "Project Region",
    industry: "SaaS",
    primaryRegulation: "POPIA",
    teamCulture: "pragmatic-balanced",
    orgStructure: "flat",
    promptOptimizationEnabled: true,
    promptOptimizationMode: "active",
    promptOptimizationReportingMode: "summary",
    promptOptimizationTokenBudget: 120000,
    promptOptimizationByteBudget: 120000,
  }
}

function writeSoulFixture(projectDir: string): void {
  const soulsDir = join(projectDir, ".wunderkind", "souls")
  mkdirSync(soulsDir, { recursive: true })
  writeFileSync(
    join(soulsDir, "product-wunderkind.md"),
    [
      "<!-- wunderkind:soul-file:v1 -->",
      "# Product Wunderkind SOUL",
      "",
      "## Customization",
      "- Priority lens: Optimize for activation first.",
      "- Challenge style: Push back on weak evidence early.",
    ].join("\n"),
    "utf-8",
  )
}

function setupFixture(projectDir: string, fixtureId: PromptRuntimeFixtureId): Partial<InstallConfig> | null {
  switch (fixtureId) {
    case "fixture-default-no-config":
      return null
    case "fixture-docs-valid":
      return {
        docsEnabled: true,
        docsPath: "./docs/output",
        docHistoryMode: "append-dated",
      }
    case "fixture-docs-invalid-reserved":
      return {
        docsEnabled: true,
        docsPath: "./DESIGN.md/subdir",
        docHistoryMode: "append-dated",
      }
    case "fixture-docs-invalid-absolute":
      return {
        docsEnabled: true,
        docsPath: "/tmp/docs",
        docHistoryMode: "append-dated",
      }
    case "fixture-docs-invalid-parent-traversal":
      return {
        docsEnabled: true,
        docsPath: "../outside-docs",
        docHistoryMode: "append-dated",
      }
    case "fixture-docs-invalid-project-root":
      return {
        docsEnabled: true,
        docsPath: ".",
        docHistoryMode: "append-dated",
      }
    case "fixture-docs-invalid-symlink": {
      mkdirSync(join(projectDir, "real-docs"), { recursive: true })
      symlinkSync(join(projectDir, "real-docs"), join(projectDir, "linked-docs"), "dir")
      return {
        docsEnabled: true,
        docsPath: "./linked-docs",
        docHistoryMode: "append-dated",
      }
    }
    case "fixture-runtime-context":
      return {
        region: "South Africa",
        industry: "",
        primaryRegulation: "",
        secondaryRegulation: "GDPR",
        teamCulture: "experimental-informal",
        orgStructure: "hierarchical",
      }
    case "fixture-runtime-context-github":
      return {
        region: "Project Region",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        teamCulture: "pragmatic-balanced",
        orgStructure: "flat",
        prdPipelineMode: "github",
      }
    case "fixture-caveman-enabled":
      return {
        region: "Project Region",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        teamCulture: "pragmatic-balanced",
        orgStructure: "flat",
        cavemanEnabled: true,
      }
    case "fixture-runtime-soul-overlay":
      writeSoulFixture(projectDir)
      return {
        region: "Project Region",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        teamCulture: "pragmatic-balanced",
        orgStructure: "flat",
      }
    case "fixture-runtime-active-trim":
      return {
        region: "Project Region",
        industry: "SaaS",
        primaryRegulation: "POPIA",
        teamCulture: "pragmatic-balanced",
        orgStructure: "flat",
        docsEnabled: true,
        docsPath: "./docs/output",
        docHistoryMode: "append-dated",
      }
  }
}

function createInitialSystemSections(fixtureId: PromptRuntimeFixtureId): string[] {
  switch (fixtureId) {
    case "fixture-runtime-soul-overlay":
      return ["# Product Wunderkind\nBase retained prompt"]
    default:
      return []
  }
}

function shapeCompactionContextForFixture(
  fixtureId: PromptRuntimeFixtureId,
  compactionContext: readonly string[],
): readonly string[] {
  switch (fixtureId) {
    case "fixture-runtime-active-trim": {
      const delegationContinuity = compactionContext[1]
      return delegationContinuity ? [delegationContinuity] : compactionContext
    }
    default:
      return compactionContext
  }
}

export function parsePromptRuntimeFixtureId(value: string | null | undefined): PromptRuntimeFixtureId | null {
  if (!value) {
    return null
  }

  if (!PROMPT_RUNTIME_FIXTURE_ID_SET.has(value)) {
    return null
  }

  for (const fixtureId of PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS) {
    if (fixtureId === value) {
      return fixtureId
    }
  }

  for (const fixtureId of PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS) {
    if (fixtureId === value) {
      return fixtureId
    }
  }

  return null
}

export function parsePromptOptimizationHelperFixtureId(
  value: string | null | undefined,
): PromptOptimizationHelperFixtureId | null {
  if (!value) {
    return null
  }

  if (!PROMPT_OPTIMIZATION_HELPER_FIXTURE_ID_SET.has(value)) {
    return null
  }

  for (const fixtureId of PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS) {
    if (fixtureId === value) {
      return fixtureId
    }
  }

  return null
}

export function parsePromptOptimizationV4UserPromptFixtureId(
  value: string | null | undefined,
): PromptOptimizationV4UserPromptFixtureId | null {
  if (!value) {
    return null
  }

  if (!PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_ID_SET.has(value)) {
    return null
  }

  for (const fixtureId of PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_IDS) {
    if (fixtureId === value) {
      return fixtureId
    }
  }

  return null
}

export function capturePromptOptimizationV4UserPromptFixture(
  fixtureId: PromptOptimizationV4UserPromptFixtureId,
): PromptOptimizationV4UserPromptFixtureCapture {
  const wunderkindConfig = createV4UserPromptFixtureConfig()

  switch (fixtureId) {
    case "safe-latest-user-message": {
      const earlierUserMessage = "Earlier user MUST NOT be rewritten.\nPath: docs/README.md\n"
      const beforeLatestUserMessage = [
        "Please keep the diagnosis short and actionable for SAFEUSERSENTINEL. ",
        "Please keep the diagnosis short and actionable for SAFEUSERSENTINEL.\n",
      ].join("")
      const afterLatestUserMessage = "Please keep the diagnosis short and actionable for SAFEUSERSENTINEL.\n"
      const expectedMessagesAfterOptimization = [
        { role: "user", content: earlierUserMessage },
        { role: "assistant", content: "Assistant acknowledgement should remain untouched." },
        { role: "user", content: afterLatestUserMessage },
      ] as const satisfies readonly PromptOptimizationV4UserPromptFixtureMessage[]

      return {
        fixtureId,
        wunderkindConfig,
        input: {
          modelId: "gpt-4.1",
          model: "gpt-4.1",
          messages: [
            { role: "user", content: earlierUserMessage },
            { role: "assistant", content: "Assistant acknowledgement should remain untouched." },
            { role: "user", content: beforeLatestUserMessage },
          ],
        },
        expectation: {
          kind: "safe-optimization",
          earlierUserMessage,
          beforeLatestUserMessage,
          afterLatestUserMessage,
          expectedMessagesAfterOptimization,
          expectedPassthroughReason: null,
          expectedImmutableRuleIds: [],
        },
      }
    }
    case "risky-immutable-user-message": {
      const earlierUserMessage = "Earlier user history should stay byte-exact even when the latest message is risky."
      const beforeLatestUserMessage = [
        "Please keep the diagnosis short and actionable.\n",
        "Path: src/runtime-user-prompt-optimization.ts\n",
        "$ bun test tests/unit/plugin-transform.test.ts\n",
        "See https://example.com/spec for reference.\n",
        'Quoted user example: "leave this exact text alone".\n',
        "RISKY_USER_SENTINEL should never surface in reports.\n",
      ].join("")
      const expectedMessagesAfterOptimization = [
        { role: "user", content: earlierUserMessage },
        { role: "assistant", content: "Assistant acknowledgement should remain untouched." },
        { role: "user", content: beforeLatestUserMessage },
      ] as const satisfies readonly PromptOptimizationV4UserPromptFixtureMessage[]

      return {
        fixtureId,
        wunderkindConfig,
        input: {
          modelId: "gpt-4.1",
          model: "gpt-4.1",
          messages: [
            { role: "user", content: earlierUserMessage },
            { role: "assistant", content: "Assistant acknowledgement should remain untouched." },
            { role: "user", content: beforeLatestUserMessage },
          ],
        },
        expectation: {
          kind: "whole-message-passthrough",
          earlierUserMessage,
          beforeLatestUserMessage,
          afterLatestUserMessage: beforeLatestUserMessage,
          expectedMessagesAfterOptimization,
          expectedPassthroughReason: "v4-safety-command-or-path",
          expectedImmutableRuleIds: [
            "immutable-file-path",
            "immutable-command",
            "immutable-url",
            "immutable-quoted-user-text",
          ],
        },
      }
    }
  }
}

export function collectPromptOptimizationEligibleSections(
  fixture: CanonicalRuntimeFixtureCapture,
): readonly PromptOptimizationEligibleSection[] {
  const sections: PromptOptimizationEligibleSection[] = []

  for (const section of fixture.sections) {
    const group = getRuntimeSectionGroup(section)
    switch (group) {
      case "runtime-docs-output":
      case "runtime-context":
      case "runtime-native-agents":
        sections.push({ id: group, content: section })
        break
      case "runtime-soul-overlay":
      case null:
        break
    }
  }

  sections.push({
    id: "compaction-continuity",
    content: fixture.compactionContext.join("\n"),
  })

  return sections
}

export function captureCanonicalRuntimeFixture(fixtureId: PromptRuntimeFixtureId): CanonicalRuntimeFixtureCapture {
  const sandboxRoot = mkdtempSync(join(tmpdir(), `wk-runtime-fixture-${fixtureId}-`))
  const projectDir = join(sandboxRoot, "project")
  mkdirSync(projectDir, { recursive: true })

  const wunderkindConfig = setupFixture(projectDir, fixtureId)
  const systemOutput = { system: createInitialSystemSections(fixtureId) }
  const compactionOutput = { context: [] as string[] }

  try {
    applyWunderkindSystemTransform({
      system: systemOutput.system,
      wunderkindConfig,
      cwd: projectDir,
    })
    compactionOutput.context.push(...buildCompactionContext(wunderkindConfig, projectDir))
    const shapedCompactionContext = shapeCompactionContextForFixture(fixtureId, compactionOutput.context)
    return {
      fixtureId,
      sections: [...systemOutput.system],
      compactionContext: [...shapedCompactionContext],
    }
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true })
  }
}

export function getRuntimeSectionGroup(section: string):
  | "runtime-docs-output"
  | "runtime-context"
  | "runtime-native-agents"
  | "runtime-soul-overlay"
  | null {
  if (section.includes(DOCS_OUTPUT_SENTINEL)) return "runtime-docs-output"
  if (section.includes(RUNTIME_CONTEXT_SENTINEL)) return "runtime-context"
  if (section.includes(NATIVE_AGENTS_SENTINEL)) return "runtime-native-agents"
  if (section.includes(SOUL_RUNTIME_SENTINEL_PREFIX)) return "runtime-soul-overlay"
  return null
}

export async function captureCanonicalRuntimeFixtures(): Promise<CanonicalRuntimeFixtureReport> {
  const fixtures: CanonicalRuntimeFixtureCapture[] = []

  for (const fixtureId of PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS) {
    fixtures.push(captureCanonicalRuntimeFixture(fixtureId))
  }

  return { fixtures }
}
