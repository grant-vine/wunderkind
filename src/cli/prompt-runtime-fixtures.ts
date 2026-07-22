import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
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
    const sandboxRoot = mkdtempSync(join(tmpdir(), `wk-runtime-fixture-${fixtureId}-`))
    const projectDir = join(sandboxRoot, "project")
    mkdirSync(projectDir, { recursive: true })

    const wunderkindConfig = setupFixture(projectDir, fixtureId)
    const systemOutput = { system: [] as string[] }
    const compactionOutput = { context: [] as string[] }

    try {
      applyWunderkindSystemTransform({
        system: systemOutput.system,
        wunderkindConfig,
        cwd: projectDir,
      })
      compactionOutput.context.push(...buildCompactionContext(wunderkindConfig, projectDir))
      fixtures.push({
        fixtureId,
        sections: [...systemOutput.system],
        compactionContext: [...compactionOutput.context],
      })
    } finally {
      rmSync(sandboxRoot, { recursive: true, force: true })
    }
  }

  return { fixtures }
}
