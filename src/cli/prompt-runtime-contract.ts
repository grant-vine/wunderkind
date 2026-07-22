export type PromptSurfaceOwnership = "wunderkind-owned" | "runtime-owned" | "user-authored-excluded"
export type PromptSurfaceCollectionMode = "static-owned" | "runtime-fixture" | "compaction-fixture"

export const PROMPT_RUNTIME_AUDIT_MODE = "audit-only-v1" as const
export const PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS = [
  "fixture-default-no-config",
  "fixture-docs-valid",
  "fixture-docs-invalid-reserved",
  "fixture-docs-invalid-absolute",
  "fixture-docs-invalid-parent-traversal",
  "fixture-docs-invalid-project-root",
  "fixture-docs-invalid-symlink",
  "fixture-runtime-context",
  "fixture-runtime-context-github",
  "fixture-caveman-enabled",
] as const

export type PromptRuntimeFixtureId = (typeof PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS)[number]

export interface PromptSurfaceLayerDefinition {
  readonly id: string
  readonly group: string
  readonly title: string
  readonly ownership: PromptSurfaceOwnership
  readonly collectionMode: PromptSurfaceCollectionMode
  readonly includedInTotals: boolean
  readonly fixtureIds: readonly PromptRuntimeFixtureId[]
}

export interface PromptRuntimeContract {
  readonly auditMode: typeof PROMPT_RUNTIME_AUDIT_MODE
  readonly livePromptMutation: false
  readonly modelTokenTruthClaims: false
  readonly runtimeFixtureIds: readonly PromptRuntimeFixtureId[]
  readonly layers: readonly PromptSurfaceLayerDefinition[]
}

export const PROMPT_SURFACE_LAYER_DEFINITIONS = [
  {
    id: "static-agents",
    group: "agents",
    title: "Rendered native agent markdown",
    ownership: "wunderkind-owned",
    collectionMode: "static-owned",
    includedInTotals: true,
    fixtureIds: [],
  },
  {
    id: "static-commands-static",
    group: "commands-static",
    title: "Static native command markdown",
    ownership: "wunderkind-owned",
    collectionMode: "static-owned",
    includedInTotals: true,
    fixtureIds: [],
  },
  {
    id: "static-commands-generated",
    group: "commands-generated",
    title: "Generated retained command markdown",
    ownership: "wunderkind-owned",
    collectionMode: "static-owned",
    includedInTotals: true,
    fixtureIds: [],
  },
  {
    id: "static-skills",
    group: "skills",
    title: "Shipped skill markdown",
    ownership: "wunderkind-owned",
    collectionMode: "static-owned",
    includedInTotals: true,
    fixtureIds: [],
  },
  {
    id: "runtime-docs-output",
    group: "runtime-docs-output",
    title: "Docs-output runtime injection fixtures",
    ownership: "runtime-owned",
    collectionMode: "runtime-fixture",
    includedInTotals: false,
    fixtureIds: [
      "fixture-docs-valid",
      "fixture-docs-invalid-reserved",
      "fixture-docs-invalid-absolute",
      "fixture-docs-invalid-parent-traversal",
      "fixture-docs-invalid-project-root",
      "fixture-docs-invalid-symlink",
    ],
  },
  {
    id: "runtime-context",
    group: "runtime-context",
    title: "Resolved runtime-context injection fixtures",
    ownership: "runtime-owned",
    collectionMode: "runtime-fixture",
    includedInTotals: false,
    fixtureIds: [
      "fixture-default-no-config",
      "fixture-runtime-context",
      "fixture-runtime-context-github",
      "fixture-caveman-enabled",
    ],
  },
  {
    id: "runtime-native-agents",
    group: "runtime-native-agents",
    title: "Native-agent catalog runtime injection fixtures",
    ownership: "runtime-owned",
    collectionMode: "runtime-fixture",
    includedInTotals: false,
    fixtureIds: [...PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS],
  },
  {
    id: "runtime-soul-overlay",
    group: "runtime-soul-overlay",
    title: "User-authored SOUL overlay runtime fixtures",
    ownership: "user-authored-excluded",
    collectionMode: "runtime-fixture",
    includedInTotals: false,
    fixtureIds: [],
  },
  {
    id: "compaction-continuity",
    group: "compaction-continuity",
    title: "Compaction continuity fixture layer",
    ownership: "runtime-owned",
    collectionMode: "compaction-fixture",
    includedInTotals: false,
    fixtureIds: [...PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS],
  },
] as const satisfies readonly PromptSurfaceLayerDefinition[]

export type PromptSurfaceLayerId = (typeof PROMPT_SURFACE_LAYER_DEFINITIONS)[number]["id"]

export const PROMPT_RUNTIME_CONTRACT: PromptRuntimeContract = {
  auditMode: PROMPT_RUNTIME_AUDIT_MODE,
  livePromptMutation: false,
  modelTokenTruthClaims: false,
  runtimeFixtureIds: PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
  layers: PROMPT_SURFACE_LAYER_DEFINITIONS,
}

export function getPromptRuntimeContract(): PromptRuntimeContract {
  return PROMPT_RUNTIME_CONTRACT
}
