export type PromptSurfaceOwnership = "wunderkind-owned" | "runtime-owned" | "user-authored-excluded"
export type PromptSurfaceCollectionMode = "static-owned" | "runtime-fixture" | "compaction-fixture"
export const PROMPT_OPTIMIZATION_MODES = ["off", "advisory", "active"] as const

export const PROMPT_RUNTIME_AUDIT_MODE = "audit-only-v1" as const
export const PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT_MODE =
  "supplementary-prompt-optimization-v1" as const
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

export const PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS = [
  "fixture-runtime-soul-overlay",
  "fixture-runtime-active-trim",
] as const

export type PromptRuntimeFixtureId =
  | (typeof PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS)[number]
  | (typeof PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS)[number]
export type PromptOptimizationMode = (typeof PROMPT_OPTIMIZATION_MODES)[number]
export type PromptOptimizationEnabledInput = boolean | "omitted"
export type PromptOptimizationModeInput = PromptOptimizationMode | "omitted"

export interface PromptSurfaceLayerDefinition {
  readonly id: string
  readonly group: string
  readonly title: string
  readonly ownership: PromptSurfaceOwnership
  readonly collectionMode: PromptSurfaceCollectionMode
  readonly includedInTotals: boolean
  readonly fixtureIds: readonly PromptRuntimeFixtureId[]
}

export interface PromptOptimizationModeMatrixRow {
  readonly enabledInput: PromptOptimizationEnabledInput
  readonly modeInput: PromptOptimizationModeInput
  readonly resolvedEnabled: boolean
  readonly resolvedMode: PromptOptimizationMode
}

export interface PromptOptimizationSupplementaryContract {
  readonly contractMode: typeof PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT_MODE
  readonly defaultEnabled: false
  readonly defaultMode: "off"
  readonly countStates: readonly PromptOptimizationCountStateDefinition[]
  readonly modeMatrix: readonly PromptOptimizationModeMatrixRow[]
}

export interface PromptOptimizationCountStateDefinition {
  readonly state: "exact-local" | "provider-api-only" | "unsupported"
  readonly label: string
}

export interface PromptRuntimeContract {
  readonly auditMode: typeof PROMPT_RUNTIME_AUDIT_MODE
  readonly livePromptMutation: false
  readonly modelTokenTruthClaims: false
  readonly supplementaryOptimization: PromptOptimizationSupplementaryContract
  readonly runtimeFixtureIds: readonly PromptRuntimeFixtureId[]
  readonly layers: readonly PromptSurfaceLayerDefinition[]
}

export const PROMPT_OPTIMIZATION_MODE_MATRIX = [
  { enabledInput: "omitted", modeInput: "omitted", resolvedEnabled: false, resolvedMode: "off" },
  { enabledInput: "omitted", modeInput: "off", resolvedEnabled: false, resolvedMode: "off" },
  { enabledInput: "omitted", modeInput: "advisory", resolvedEnabled: true, resolvedMode: "advisory" },
  { enabledInput: "omitted", modeInput: "active", resolvedEnabled: true, resolvedMode: "active" },
  { enabledInput: true, modeInput: "omitted", resolvedEnabled: true, resolvedMode: "advisory" },
  { enabledInput: true, modeInput: "off", resolvedEnabled: false, resolvedMode: "off" },
  { enabledInput: true, modeInput: "advisory", resolvedEnabled: true, resolvedMode: "advisory" },
  { enabledInput: true, modeInput: "active", resolvedEnabled: true, resolvedMode: "active" },
  { enabledInput: false, modeInput: "omitted", resolvedEnabled: false, resolvedMode: "off" },
  { enabledInput: false, modeInput: "off", resolvedEnabled: false, resolvedMode: "off" },
  { enabledInput: false, modeInput: "advisory", resolvedEnabled: false, resolvedMode: "off" },
  { enabledInput: false, modeInput: "active", resolvedEnabled: false, resolvedMode: "off" },
] as const satisfies readonly PromptOptimizationModeMatrixRow[]

export const PROMPT_OPTIMIZATION_COUNT_STATE_DEFINITIONS = [
  { state: "exact-local", label: "supported OpenAI model map" },
  { state: "provider-api-only", label: "unmapped OpenAI aliases" },
  { state: "unsupported", label: "non-OpenAI providers" },
] as const satisfies readonly PromptOptimizationCountStateDefinition[]

export const PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT: PromptOptimizationSupplementaryContract = {
  contractMode: PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT_MODE,
  defaultEnabled: false,
  defaultMode: "off",
  countStates: PROMPT_OPTIMIZATION_COUNT_STATE_DEFINITIONS,
  modeMatrix: PROMPT_OPTIMIZATION_MODE_MATRIX,
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
    fixtureIds: ["fixture-runtime-soul-overlay"],
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
  supplementaryOptimization: PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT,
  runtimeFixtureIds: PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS,
  layers: PROMPT_SURFACE_LAYER_DEFINITIONS,
}

export function getPromptRuntimeContract(): PromptRuntimeContract {
  return PROMPT_RUNTIME_CONTRACT
}
