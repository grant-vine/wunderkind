export type PromptSurfaceOwnership = "wunderkind-owned" | "runtime-owned" | "user-authored-excluded"
export type PromptSurfaceCollectionMode = "static-owned" | "runtime-fixture" | "compaction-fixture"
export const PROMPT_OPTIMIZATION_MODES = ["off", "advisory", "active"] as const
export const PROMPT_OPTIMIZATION_REPORTING_MODES = ["off", "persist", "summary"] as const
export const PROMPT_OPTIMIZATION_LEVELS = [
  "latest-user",
  "runtime-and-tools",
  "contextual",
  "transcript",
] as const
export const PROMPT_OPTIMIZATION_PUBLIC_SETTING_KEYS = [
  "promptOptimizationEnabled",
  "promptOptimizationMode",
  "promptOptimizationLevel",
  "promptOptimizationReportingMode",
  "promptOptimizationTokenBudget",
  "promptOptimizationByteBudget",
] as const
export const PROMPT_OPTIMIZATION_ELIGIBLE_SURFACES = [
  "latest-user-message",
  "runtime-owned-sections",
  "tool-outputs",
  "selected-context",
  "history-and-transcript",
] as const
export const PROMPT_OPTIMIZATION_SURFACE_IDS = [
  "runtime-docs-output",
  "runtime-context",
  "runtime-native-agents",
  "compaction-continuity",
  "latest-user-message",
  "tool-outputs",
  "selected-context",
  "earlier-user-messages",
  "retained-history",
  "transcript-wide-compaction",
  "soul-overlays",
] as const
export const PROMPT_OPTIMIZATION_OUT_OF_SCOPE_EXCLUSIONS = [
  "persistent-cross-session-memory",
  "automatic-context-injection",
] as const
export const PROMPT_OPTIMIZATION_OBJECTIVE_RANKING = [
  "token-reduction-first",
  "observability-required-proof-surface",
] as const

export const PROMPT_RUNTIME_AUDIT_MODE = "audit-only-v1" as const
export const PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT_MODE =
  "supplementary-prompt-optimization-v1" as const
export const PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT_MODE =
  "latest-user-prompt-optimization-contract-v1" as const
export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_CONTRACT_MODE =
  "prompt-optimization-runtime-report-v3" as const
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
  "fixture-tool-output-noisy",
  "fixture-tool-output-no-growth",
  "fixture-tool-output-suppressed",
] as const

export const PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_IDS = [
  "safe-latest-user-message",
  "risky-immutable-user-message",
] as const

export type PromptRuntimeFixtureId =
  | (typeof PROMPT_RUNTIME_CANONICAL_FIXTURE_IDS)[number]
  | (typeof PROMPT_OPTIMIZATION_HELPER_FIXTURE_IDS)[number]
export type PromptOptimizationV4UserPromptFixtureId =
  (typeof PROMPT_OPTIMIZATION_V4_USER_PROMPT_FIXTURE_IDS)[number]
export type PromptOptimizationMode = (typeof PROMPT_OPTIMIZATION_MODES)[number]
export type PromptOptimizationReportingMode = (typeof PROMPT_OPTIMIZATION_REPORTING_MODES)[number]
export type PromptOptimizationLevel = (typeof PROMPT_OPTIMIZATION_LEVELS)[number]
export type PromptOptimizationPublicSettingKey =
  (typeof PROMPT_OPTIMIZATION_PUBLIC_SETTING_KEYS)[number]
export type PromptOptimizationEligibleSurface =
  (typeof PROMPT_OPTIMIZATION_ELIGIBLE_SURFACES)[number]
export type PromptOptimizationSurfaceId = (typeof PROMPT_OPTIMIZATION_SURFACE_IDS)[number]
export type PromptOptimizationSurfaceGroup =
  | PromptOptimizationEligibleSurface
  | "soul-overlays"
export type PromptOptimizationSurfaceScopeStatus = "in-scope" | "deferred" | "out-of-scope"
export type PromptOptimizationSurfaceInvariantClass =
  | "exact-preserve"
  | "semantic-preserve"
  | "shrink-only"
  | "no-touch"
export type PromptOptimizationSurfaceFallbackRule =
  | "preserve-byte-exact"
  | "preserve-original-on-risk"
  | "preserve-original-on-no-shrink"
  | "whole-surface-passthrough"
  | "never-mutate"
export type PromptOptimizationOutOfScopeExclusion =
  (typeof PROMPT_OPTIMIZATION_OUT_OF_SCOPE_EXCLUSIONS)[number]
export type PromptOptimizationObjective = (typeof PROMPT_OPTIMIZATION_OBJECTIVE_RANKING)[number]
export type PromptOptimizationEnabledInput = boolean | "omitted"
export type PromptOptimizationModeInput = PromptOptimizationMode | "omitted"
export type PromptOptimizationPublicSettingRole =
  | "master-enable-gate"
  | "optimization-mode"
  | "eligible-surface-level"
  | "runtime-reporting-mode"
  | "exact-token-budget"
  | "byte-budget-fallback"
export type PromptOptimizationPublicSettingCompatibility = "existing-frozen" | "new-public-key"
export type PromptOptimizationRuntimeReportRequiredField =
  | "hookPath"
  | "modelId"
  | "promptOptimizationMode"
  | "countState"
  | "budgetBasis"
  | "budgetLimit"
  | "trimBasis"
  | "trimBudgetLimit"
  | "eligibleSections"
  | "beforeBytes"
  | "afterBytes"
  | "savedBytes"
  | "trimApplied"
  | "trimExhausted"
  | "trimmedSections"
  | "noTrimReason"
  | "exactTokenDelta"
export type PromptOptimizationRuntimeAxisField =
  | "budgetBasis"
  | "budgetLimit"
  | "trimBasis"
  | "trimBudgetLimit"
export type PromptOptimizationRuntimePublicValueClass = "safe-scalar-enum-id" | "safe-literal"
export type PromptOptimizationRuntimeSecretHandling = "never-redact" | "redaction-candidate"
export type PromptOptimizationRuntimeSecretRuleId =
  | "openai-api-key-prefix"
  | "github-classic-pat-prefix"
  | "github-fine-grained-pat-prefix"
  | "slack-bot-token-prefix"
  | "slack-user-token-prefix"
  | "bearer-token-prefix"
  | "jwt-shape"
  | "credentialed-url-authority"
  | "pem-private-key-sentinel"
export type PromptOptimizationV4MutableSurfaceExclusion =
  | "earlier-user-messages"
  | "retained-history"
  | "transcript-wide-compaction"
  | "soul-overlays"
  | "runtime-owned-trim-surfaces"
export type PromptOptimizationV4ImmutableContentRuleId =
  | "immutable-code-block"
  | "immutable-url"
  | "immutable-file-path"
  | "immutable-command"
  | "immutable-explicit-requirement"
  | "immutable-compliance-legal-security"
  | "immutable-quoted-user-text"
export type PromptOptimizationV4MutableAllowlistRuleId =
  | "allowlist-plain-natural-language-filler"
  | "allowlist-repetitive-natural-language-prose"
export type PromptOptimizationV4PassthroughReasonId =
  | "v4-low-confidence-no-allowlist-match"
  | "v4-low-confidence-mixed-immutable-content"
  | "v4-safety-code-block"
  | "v4-safety-command-or-path"
  | "v4-safety-explicit-requirement"
  | "v4-safety-compliance-legal-security"
  | "v4-safety-quoted-user-text"
export type PromptOptimizationLatestUserPassthroughReasonId =
  | "latest-user-low-confidence-no-allowlist-match"
  | "latest-user-low-confidence-mixed-immutable-content"
  | "latest-user-safety-code-block"
  | "latest-user-safety-command-or-path"
  | "latest-user-safety-explicit-requirement"
  | "latest-user-safety-compliance-legal-security"
  | "latest-user-safety-quoted-user-text"
export type PromptOptimizationV4PassthroughReasonClass = "low-confidence" | "safety-risk"

export interface PromptOptimizationRuntimePublicFieldDefinition {
  readonly field: PromptOptimizationRuntimeReportRequiredField
  readonly publicValueClass: PromptOptimizationRuntimePublicValueClass
  readonly secretHandling: PromptOptimizationRuntimeSecretHandling
}

export interface PromptOptimizationRuntimeRedactionPolicy {
  readonly unconstrainedStringCarriers: readonly ["modelId"]
  readonly omissionPrecedence: "omit-when-possible"
  readonly stringFieldFallback: "preserve-safe-literal-unless-secret-rule-matches"
  readonly secretMatchHandling: "mask-entire-public-value"
  readonly redactionMask: "***"
}

export interface PromptOptimizationRuntimeSecretRuleDefinition {
  readonly id: PromptOptimizationRuntimeSecretRuleId
  readonly matcher: string
}

export interface PromptOptimizationV4ImmutableContentRuleDefinition {
  readonly id: PromptOptimizationV4ImmutableContentRuleId
  readonly comment: string
}

export interface PromptOptimizationNamingPolicy {
  readonly publicSettingKeys: "capability-based-only"
  readonly publicLevelValues: "capability-based-only"
  readonly forbiddenVersionLabelPolicy: "no-version-labelled-public-keys-or-values"
}

export interface PromptOptimizationPublicSettingDefinition {
  readonly key: PromptOptimizationPublicSettingKey
  readonly role: PromptOptimizationPublicSettingRole
  readonly compatibility: PromptOptimizationPublicSettingCompatibility
}

export interface PromptOptimizationLevelDefinition {
  readonly level: PromptOptimizationLevel
  readonly eligibleSurfaces: readonly PromptOptimizationEligibleSurface[]
}

export interface PromptOptimizationSurfaceRegistryEntry {
  readonly id: PromptOptimizationSurfaceId
  readonly group: PromptOptimizationSurfaceGroup
  readonly scopeStatus: PromptOptimizationSurfaceScopeStatus
  readonly invariantClass: PromptOptimizationSurfaceInvariantClass
  readonly fallbackRule: PromptOptimizationSurfaceFallbackRule
  readonly minimumLevel: PromptOptimizationLevel | null
  readonly explicitLevels: readonly PromptOptimizationLevel[]
  readonly includedInLegacyCompatibilityProfile: boolean
}

export interface PromptOptimizationLegacyCompatibilityProfile {
  readonly profile: "legacy-enabled-without-level"
  readonly persistedPublicLevel: null
  readonly eligibleSurfaces: readonly ["latest-user-message", "runtime-owned-sections"]
  readonly excludedExpandedSurfaces: readonly [
    "tool-outputs",
    "selected-context",
    "history-and-transcript",
  ]
  readonly publicWriteBehavior: "require-explicit-level-selection"
}

export interface PromptOptimizationV4MutableAllowlistRuleDefinition {
  readonly id: PromptOptimizationV4MutableAllowlistRuleId
  readonly comment: string
}

export interface PromptOptimizationV4PassthroughReasonDefinition {
  readonly id: PromptOptimizationV4PassthroughReasonId
  readonly class: PromptOptimizationV4PassthroughReasonClass
  readonly comment: string
}

export interface PromptOptimizationLatestUserPassthroughReasonDefinition {
  readonly id: PromptOptimizationLatestUserPassthroughReasonId
  readonly class: PromptOptimizationV4PassthroughReasonClass
  readonly comment: string
}

export interface PromptOptimizationV4UserPromptContract {
  readonly contractMode: typeof PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT_MODE
  readonly mutableSurface: {
    readonly target: "latest-user-message-only"
    readonly excludes: readonly PromptOptimizationV4MutableSurfaceExclusion[]
  }
  readonly immutableContentRules: readonly PromptOptimizationV4ImmutableContentRuleDefinition[]
  readonly mutableContentPolicy: {
    readonly defaultMutability: "immutable-unless-allowlisted"
    readonly allowlistRules: readonly PromptOptimizationV4MutableAllowlistRuleDefinition[]
  }
  readonly fallbackBehavior: {
    readonly mode: "whole-message-passthrough"
    readonly passthroughReasonTaxonomy: readonly PromptOptimizationV4PassthroughReasonDefinition[]
  }
  readonly reasonVisibility: {
    readonly runtimeReport: "reason-codes-only"
    readonly summaryMetadata: "omit-latest-user-passthrough-reasons"
    readonly forbiddenSummaryFields: readonly ["noTrimReason"]
  }
  readonly openTokenAdoption: {
    readonly dependencyAllowed: false
    readonly productSurfaceAdoptionAllowed: false
    readonly designInputOnly: true
  }
}

export interface PromptOptimizationLatestUserPromptContract {
  readonly contractMode: typeof PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT_MODE
  readonly mutableSurface: {
    readonly target: "latest-user-message-only"
    readonly excludes: readonly PromptOptimizationV4MutableSurfaceExclusion[]
  }
  readonly immutableContentRules: readonly PromptOptimizationV4ImmutableContentRuleDefinition[]
  readonly mutableContentPolicy: {
    readonly defaultMutability: "immutable-unless-allowlisted"
    readonly allowlistRules: readonly PromptOptimizationV4MutableAllowlistRuleDefinition[]
  }
  readonly fallbackBehavior: {
    readonly mode: "whole-message-passthrough"
    readonly passthroughReasonTaxonomy: readonly PromptOptimizationLatestUserPassthroughReasonDefinition[]
  }
  readonly reasonVisibility: {
    readonly runtimeReport: "reason-codes-only"
    readonly summaryMetadata: "omit-latest-user-passthrough-reasons"
    readonly forbiddenSummaryFields: readonly ["noTrimReason"]
  }
  readonly openTokenAdoption: {
    readonly dependencyAllowed: false
    readonly productSurfaceAdoptionAllowed: false
    readonly designInputOnly: true
  }
}

export interface PromptOptimizationReportingModeDefinition {
  readonly mode: PromptOptimizationReportingMode
  readonly persistsLatestReport: boolean
  readonly emitsSessionSummary: boolean
}

export interface PromptOptimizationRuntimeReportArtifact {
  readonly hookPath: "experimental.chat.system.transform" | "experimental.session.compacting"
  readonly filePath: string
}

export interface PromptOptimizationRuntimeReportContract {
  readonly contractMode: typeof PROMPT_OPTIMIZATION_RUNTIME_REPORT_CONTRACT_MODE
  readonly defaultReportingMode: "off"
  readonly reportingModes: readonly PromptOptimizationReportingModeDefinition[]
  readonly countStates: readonly PromptOptimizationCountStateDefinition[]
  readonly measurementAxisFields: readonly ["budgetBasis", "budgetLimit"]
  readonly mutationAxisFields: readonly ["trimBasis", "trimBudgetLimit"]
  readonly requiredFields: readonly PromptOptimizationRuntimeReportRequiredField[]
  readonly publicFieldInventory: readonly PromptOptimizationRuntimePublicFieldDefinition[]
  readonly redactionPolicy: PromptOptimizationRuntimeRedactionPolicy
  readonly secretRules: readonly PromptOptimizationRuntimeSecretRuleDefinition[]
  readonly latestArtifacts: readonly PromptOptimizationRuntimeReportArtifact[]
}

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
  readonly namingPolicy: PromptOptimizationNamingPolicy
  readonly publicSettingDefinitions: readonly PromptOptimizationPublicSettingDefinition[]
  readonly countStates: readonly PromptOptimizationCountStateDefinition[]
  readonly modeMatrix: readonly PromptOptimizationModeMatrixRow[]
  readonly levelMatrix: readonly PromptOptimizationLevelDefinition[]
  readonly surfaceRegistry: readonly PromptOptimizationSurfaceRegistryEntry[]
  readonly legacyCompatibilityProfile: PromptOptimizationLegacyCompatibilityProfile
  readonly objectiveRanking: readonly PromptOptimizationObjective[]
  readonly outOfScopeExclusions: readonly PromptOptimizationOutOfScopeExclusion[]
  readonly latestUserPromptOptimization: PromptOptimizationLatestUserPromptContract
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

export const PROMPT_OPTIMIZATION_RUNTIME_REPORTING_MODE_DEFINITIONS = [
  { mode: "off", persistsLatestReport: false, emitsSessionSummary: false },
  { mode: "persist", persistsLatestReport: true, emitsSessionSummary: false },
  { mode: "summary", persistsLatestReport: true, emitsSessionSummary: true },
] as const satisfies readonly PromptOptimizationReportingModeDefinition[]

export const PROMPT_OPTIMIZATION_NAMING_POLICY = {
  publicSettingKeys: "capability-based-only",
  publicLevelValues: "capability-based-only",
  forbiddenVersionLabelPolicy: "no-version-labelled-public-keys-or-values",
} as const satisfies PromptOptimizationNamingPolicy

export const PROMPT_OPTIMIZATION_PUBLIC_SETTING_DEFINITIONS = [
  {
    key: "promptOptimizationEnabled",
    role: "master-enable-gate",
    compatibility: "existing-frozen",
  },
  {
    key: "promptOptimizationMode",
    role: "optimization-mode",
    compatibility: "existing-frozen",
  },
  {
    key: "promptOptimizationLevel",
    role: "eligible-surface-level",
    compatibility: "new-public-key",
  },
  {
    key: "promptOptimizationReportingMode",
    role: "runtime-reporting-mode",
    compatibility: "existing-frozen",
  },
  {
    key: "promptOptimizationTokenBudget",
    role: "exact-token-budget",
    compatibility: "existing-frozen",
  },
  {
    key: "promptOptimizationByteBudget",
    role: "byte-budget-fallback",
    compatibility: "existing-frozen",
  },
] as const satisfies readonly PromptOptimizationPublicSettingDefinition[]

export const PROMPT_OPTIMIZATION_LEVEL_MATRIX = [
  {
    level: "latest-user",
    eligibleSurfaces: ["latest-user-message"],
  },
  {
    level: "runtime-and-tools",
    eligibleSurfaces: ["latest-user-message", "runtime-owned-sections", "tool-outputs"],
  },
  {
    level: "contextual",
    eligibleSurfaces: [
      "latest-user-message",
      "runtime-owned-sections",
      "tool-outputs",
      "selected-context",
    ],
  },
  {
    level: "transcript",
    eligibleSurfaces: [
      "latest-user-message",
      "runtime-owned-sections",
      "tool-outputs",
      "selected-context",
      "history-and-transcript",
    ],
  },
] as const satisfies readonly PromptOptimizationLevelDefinition[]

export const PROMPT_OPTIMIZATION_LEGACY_COMPATIBILITY_PROFILE = {
  profile: "legacy-enabled-without-level",
  persistedPublicLevel: null,
  eligibleSurfaces: ["latest-user-message", "runtime-owned-sections"],
  excludedExpandedSurfaces: ["tool-outputs", "selected-context", "history-and-transcript"],
  publicWriteBehavior: "require-explicit-level-selection",
} as const satisfies PromptOptimizationLegacyCompatibilityProfile

export const PROMPT_OPTIMIZATION_SURFACE_REGISTRY = [
  {
    id: "runtime-docs-output",
    group: "runtime-owned-sections",
    scopeStatus: "in-scope",
    invariantClass: "shrink-only",
    fallbackRule: "preserve-original-on-no-shrink",
    minimumLevel: "runtime-and-tools",
    explicitLevels: ["runtime-and-tools", "contextual", "transcript"],
    includedInLegacyCompatibilityProfile: true,
  },
  {
    id: "runtime-context",
    group: "runtime-owned-sections",
    scopeStatus: "in-scope",
    invariantClass: "exact-preserve",
    fallbackRule: "preserve-byte-exact",
    minimumLevel: "runtime-and-tools",
    explicitLevels: ["runtime-and-tools", "contextual", "transcript"],
    includedInLegacyCompatibilityProfile: true,
  },
  {
    id: "runtime-native-agents",
    group: "runtime-owned-sections",
    scopeStatus: "in-scope",
    invariantClass: "shrink-only",
    fallbackRule: "preserve-original-on-no-shrink",
    minimumLevel: "runtime-and-tools",
    explicitLevels: ["runtime-and-tools", "contextual", "transcript"],
    includedInLegacyCompatibilityProfile: true,
  },
  {
    id: "compaction-continuity",
    group: "runtime-owned-sections",
    scopeStatus: "in-scope",
    invariantClass: "semantic-preserve",
    fallbackRule: "preserve-original-on-risk",
    minimumLevel: "runtime-and-tools",
    explicitLevels: ["runtime-and-tools", "contextual", "transcript"],
    includedInLegacyCompatibilityProfile: true,
  },
  {
    id: "latest-user-message",
    group: "latest-user-message",
    scopeStatus: "in-scope",
    invariantClass: "semantic-preserve",
    fallbackRule: "whole-surface-passthrough",
    minimumLevel: "latest-user",
    explicitLevels: ["latest-user", "runtime-and-tools", "contextual", "transcript"],
    includedInLegacyCompatibilityProfile: true,
  },
  {
    id: "tool-outputs",
    group: "tool-outputs",
    scopeStatus: "in-scope",
    invariantClass: "shrink-only",
    fallbackRule: "preserve-original-on-no-shrink",
    minimumLevel: "runtime-and-tools",
    explicitLevels: ["runtime-and-tools", "contextual", "transcript"],
    includedInLegacyCompatibilityProfile: false,
  },
  {
    id: "selected-context",
    group: "selected-context",
    scopeStatus: "in-scope",
    invariantClass: "semantic-preserve",
    fallbackRule: "preserve-original-on-risk",
    minimumLevel: "contextual",
    explicitLevels: ["contextual", "transcript"],
    includedInLegacyCompatibilityProfile: false,
  },
  {
    id: "earlier-user-messages",
    group: "history-and-transcript",
    scopeStatus: "in-scope",
    invariantClass: "semantic-preserve",
    fallbackRule: "whole-surface-passthrough",
    minimumLevel: "transcript",
    explicitLevels: ["transcript"],
    includedInLegacyCompatibilityProfile: false,
  },
  {
    id: "retained-history",
    group: "history-and-transcript",
    scopeStatus: "in-scope",
    invariantClass: "semantic-preserve",
    fallbackRule: "whole-surface-passthrough",
    minimumLevel: "transcript",
    explicitLevels: ["transcript"],
    includedInLegacyCompatibilityProfile: false,
  },
  {
    id: "transcript-wide-compaction",
    group: "history-and-transcript",
    scopeStatus: "in-scope",
    invariantClass: "semantic-preserve",
    fallbackRule: "whole-surface-passthrough",
    minimumLevel: "transcript",
    explicitLevels: ["transcript"],
    includedInLegacyCompatibilityProfile: false,
  },
  {
    id: "soul-overlays",
    group: "soul-overlays",
    scopeStatus: "out-of-scope",
    invariantClass: "no-touch",
    fallbackRule: "never-mutate",
    minimumLevel: null,
    explicitLevels: [],
    includedInLegacyCompatibilityProfile: false,
  },
] as const satisfies readonly PromptOptimizationSurfaceRegistryEntry[]

export function getPromptOptimizationSurfaceRegistry():
  readonly PromptOptimizationSurfaceRegistryEntry[] {
  return PROMPT_OPTIMIZATION_SURFACE_REGISTRY
}

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_MEASUREMENT_AXIS_FIELDS = [
  "budgetBasis",
  "budgetLimit",
] as const satisfies readonly PromptOptimizationRuntimeAxisField[]

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_MUTATION_AXIS_FIELDS = [
  "trimBasis",
  "trimBudgetLimit",
] as const satisfies readonly PromptOptimizationRuntimeAxisField[]

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_REQUIRED_FIELDS = [
  "hookPath",
  "modelId",
  "promptOptimizationMode",
  "countState",
  "budgetBasis",
  "budgetLimit",
  "trimBasis",
  "trimBudgetLimit",
  "eligibleSections",
  "beforeBytes",
  "afterBytes",
  "savedBytes",
  "trimApplied",
  "trimExhausted",
  "trimmedSections",
  "noTrimReason",
  "exactTokenDelta",
] as const satisfies readonly PromptOptimizationRuntimeReportRequiredField[]

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_PUBLIC_FIELD_INVENTORY = [
  { field: "hookPath", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "modelId", publicValueClass: "safe-literal", secretHandling: "redaction-candidate" },
  {
    field: "promptOptimizationMode",
    publicValueClass: "safe-scalar-enum-id",
    secretHandling: "never-redact",
  },
  { field: "countState", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "budgetBasis", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "budgetLimit", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "trimBasis", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  {
    field: "trimBudgetLimit",
    publicValueClass: "safe-scalar-enum-id",
    secretHandling: "never-redact",
  },
  {
    field: "eligibleSections",
    publicValueClass: "safe-scalar-enum-id",
    secretHandling: "never-redact",
  },
  { field: "beforeBytes", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "afterBytes", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "savedBytes", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "trimApplied", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "trimExhausted", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "trimmedSections", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "noTrimReason", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
  { field: "exactTokenDelta", publicValueClass: "safe-scalar-enum-id", secretHandling: "never-redact" },
] as const satisfies readonly PromptOptimizationRuntimePublicFieldDefinition[]

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_REDACTION_POLICY = {
  unconstrainedStringCarriers: ["modelId"],
  omissionPrecedence: "omit-when-possible",
  stringFieldFallback: "preserve-safe-literal-unless-secret-rule-matches",
  secretMatchHandling: "mask-entire-public-value",
  redactionMask: "***",
} as const satisfies PromptOptimizationRuntimeRedactionPolicy

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_SECRET_RULES = [
  { id: "openai-api-key-prefix", matcher: "starts with sk-" },
  { id: "github-classic-pat-prefix", matcher: "starts with ghp_" },
  { id: "github-fine-grained-pat-prefix", matcher: "starts with github_pat_" },
  { id: "slack-bot-token-prefix", matcher: "starts with xoxb-" },
  { id: "slack-user-token-prefix", matcher: "starts with xoxp-" },
  { id: "bearer-token-prefix", matcher: "starts with Bearer " },
  { id: "jwt-shape", matcher: "three dot-separated segments with each segment length >= 8" },
  { id: "credentialed-url-authority", matcher: "contains credentialed URL authority like ://user:pass@" },
  {
    id: "pem-private-key-sentinel",
    matcher: "contains -----BEGIN and PRIVATE KEY----- in the same public value",
  },
] as const satisfies readonly PromptOptimizationRuntimeSecretRuleDefinition[]

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_ARTIFACTS = [
  {
    hookPath: "experimental.chat.system.transform",
    filePath: ".wunderkind/runtime/prompt-optimization/system-transform.latest.json",
  },
  {
    hookPath: "experimental.session.compacting",
    filePath: ".wunderkind/runtime/prompt-optimization/session-compacting.latest.json",
  },
] as const satisfies readonly PromptOptimizationRuntimeReportArtifact[]

export const PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT: PromptOptimizationV4UserPromptContract = {
  contractMode: PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT_MODE,
  mutableSurface: {
    target: "latest-user-message-only",
    excludes: [
      "earlier-user-messages",
      "retained-history",
      "transcript-wide-compaction",
      "soul-overlays",
      "runtime-owned-trim-surfaces",
    ],
  },
  immutableContentRules: [
    { id: "immutable-code-block", comment: "Preserve fenced and inline code spans byte-exact." },
    { id: "immutable-url", comment: "Preserve absolute URLs and URL-like literals byte-exact." },
    { id: "immutable-file-path", comment: "Preserve file-system paths and path-like literals byte-exact." },
    { id: "immutable-command", comment: "Preserve shell, CLI, and executable command text byte-exact." },
    {
      id: "immutable-explicit-requirement",
      comment: "Preserve explicit constraints, requirements, and must/must-not wording byte-exact.",
    },
    {
      id: "immutable-compliance-legal-security",
      comment: "Preserve compliance, legal, and security wording byte-exact.",
    },
    {
      id: "immutable-quoted-user-text",
      comment: "Preserve quoted user text and worked examples byte-exact.",
    },
  ],
  mutableContentPolicy: {
    defaultMutability: "immutable-unless-allowlisted",
    allowlistRules: [
      {
        id: "allowlist-plain-natural-language-filler",
        comment: "Allow only ordinary natural-language filler outside immutable spans.",
      },
      {
        id: "allowlist-repetitive-natural-language-prose",
        comment: "Allow only repetitive natural-language prose outside immutable spans.",
      },
    ],
  },
  fallbackBehavior: {
    mode: "whole-message-passthrough",
    passthroughReasonTaxonomy: [
      {
        id: "v4-low-confidence-no-allowlist-match",
        class: "low-confidence",
        comment: "No positive mutable allowlist rule matched the latest user-authored message.",
      },
      {
        id: "v4-low-confidence-mixed-immutable-content",
        class: "low-confidence",
        comment: "Immutable and mutable cues were interleaved too tightly to separate safely.",
      },
      {
        id: "v4-safety-code-block",
        class: "safety-risk",
        comment: "Code-block detector matched within the latest user-authored message.",
      },
      {
        id: "v4-safety-command-or-path",
        class: "safety-risk",
        comment: "Command, file-path, or URL detector matched within the latest user-authored message.",
      },
      {
        id: "v4-safety-explicit-requirement",
        class: "safety-risk",
        comment: "Explicit requirement or constraint detector matched within the latest user-authored message.",
      },
      {
        id: "v4-safety-compliance-legal-security",
        class: "safety-risk",
        comment: "Compliance, legal, or security wording detector matched within the latest user-authored message.",
      },
      {
        id: "v4-safety-quoted-user-text",
        class: "safety-risk",
        comment: "Quoted user text or quoted example detector matched within the latest user-authored message.",
      },
    ],
  },
  reasonVisibility: {
    runtimeReport: "reason-codes-only",
    summaryMetadata: "omit-latest-user-passthrough-reasons",
    forbiddenSummaryFields: ["noTrimReason"],
  },
  openTokenAdoption: {
    dependencyAllowed: false,
    productSurfaceAdoptionAllowed: false,
    designInputOnly: true,
  },
}

export const PROMPT_OPTIMIZATION_LATEST_USER_PROMPT_CONTRACT: PromptOptimizationLatestUserPromptContract = {
  contractMode: PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT_MODE,
  mutableSurface: {
    target: "latest-user-message-only",
    excludes: [
      "earlier-user-messages",
      "retained-history",
      "transcript-wide-compaction",
      "soul-overlays",
      "runtime-owned-trim-surfaces",
    ],
  },
  immutableContentRules: [
    { id: "immutable-code-block", comment: "Preserve fenced and inline code spans byte-exact." },
    { id: "immutable-url", comment: "Preserve absolute URLs and URL-like literals byte-exact." },
    { id: "immutable-file-path", comment: "Preserve file-system paths and path-like literals byte-exact." },
    { id: "immutable-command", comment: "Preserve shell, CLI, and executable command text byte-exact." },
    {
      id: "immutable-explicit-requirement",
      comment: "Preserve explicit constraints, requirements, and must/must-not wording byte-exact.",
    },
    {
      id: "immutable-compliance-legal-security",
      comment: "Preserve compliance, legal, and security wording byte-exact.",
    },
    {
      id: "immutable-quoted-user-text",
      comment: "Preserve quoted user text and worked examples byte-exact.",
    },
  ],
  mutableContentPolicy: {
    defaultMutability: "immutable-unless-allowlisted",
    allowlistRules: [
      {
        id: "allowlist-plain-natural-language-filler",
        comment: "Allow only ordinary natural-language filler outside immutable spans.",
      },
      {
        id: "allowlist-repetitive-natural-language-prose",
        comment: "Allow only repetitive natural-language prose outside immutable spans.",
      },
    ],
  },
  fallbackBehavior: {
    mode: "whole-message-passthrough",
    passthroughReasonTaxonomy: [
      {
        id: "latest-user-low-confidence-no-allowlist-match",
        class: "low-confidence",
        comment: "No positive mutable allowlist rule matched the latest user-authored message.",
      },
      {
        id: "latest-user-low-confidence-mixed-immutable-content",
        class: "low-confidence",
        comment: "Immutable and mutable cues were interleaved too tightly to separate safely.",
      },
      {
        id: "latest-user-safety-code-block",
        class: "safety-risk",
        comment: "Code-block detector matched within the latest user-authored message.",
      },
      {
        id: "latest-user-safety-command-or-path",
        class: "safety-risk",
        comment: "Command, file-path, or URL detector matched within the latest user-authored message.",
      },
      {
        id: "latest-user-safety-explicit-requirement",
        class: "safety-risk",
        comment: "Explicit requirement or constraint detector matched within the latest user-authored message.",
      },
      {
        id: "latest-user-safety-compliance-legal-security",
        class: "safety-risk",
        comment: "Compliance, legal, or security wording detector matched within the latest user-authored message.",
      },
      {
        id: "latest-user-safety-quoted-user-text",
        class: "safety-risk",
        comment: "Quoted user text or quoted example detector matched within the latest user-authored message.",
      },
    ],
  },
  reasonVisibility: {
    runtimeReport: "reason-codes-only",
    summaryMetadata: "omit-latest-user-passthrough-reasons",
    forbiddenSummaryFields: ["noTrimReason"],
  },
  openTokenAdoption: {
    dependencyAllowed: false,
    productSurfaceAdoptionAllowed: false,
    designInputOnly: true,
  },
}

export function isPromptOptimizationV4PassthroughReason(
  reason: string | null | undefined,
): reason is PromptOptimizationV4PassthroughReasonId {
  if (typeof reason !== "string") {
    return false
  }

  return PROMPT_OPTIMIZATION_V4_USER_PROMPT_CONTRACT.fallbackBehavior.passthroughReasonTaxonomy.some(
    ({ id }) => id === reason,
  )
}

export const PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT: PromptOptimizationSupplementaryContract = {
  contractMode: PROMPT_OPTIMIZATION_SUPPLEMENTARY_CONTRACT_MODE,
  defaultEnabled: false,
  defaultMode: "off",
  namingPolicy: PROMPT_OPTIMIZATION_NAMING_POLICY,
  publicSettingDefinitions: PROMPT_OPTIMIZATION_PUBLIC_SETTING_DEFINITIONS,
  countStates: PROMPT_OPTIMIZATION_COUNT_STATE_DEFINITIONS,
  modeMatrix: PROMPT_OPTIMIZATION_MODE_MATRIX,
  levelMatrix: PROMPT_OPTIMIZATION_LEVEL_MATRIX,
  surfaceRegistry: PROMPT_OPTIMIZATION_SURFACE_REGISTRY,
  legacyCompatibilityProfile: PROMPT_OPTIMIZATION_LEGACY_COMPATIBILITY_PROFILE,
  objectiveRanking: PROMPT_OPTIMIZATION_OBJECTIVE_RANKING,
  outOfScopeExclusions: PROMPT_OPTIMIZATION_OUT_OF_SCOPE_EXCLUSIONS,
  latestUserPromptOptimization: PROMPT_OPTIMIZATION_LATEST_USER_PROMPT_CONTRACT,
}

export const PROMPT_OPTIMIZATION_RUNTIME_REPORT_CONTRACT: PromptOptimizationRuntimeReportContract = {
  contractMode: PROMPT_OPTIMIZATION_RUNTIME_REPORT_CONTRACT_MODE,
  defaultReportingMode: "off",
  reportingModes: PROMPT_OPTIMIZATION_RUNTIME_REPORTING_MODE_DEFINITIONS,
  countStates: PROMPT_OPTIMIZATION_COUNT_STATE_DEFINITIONS,
  measurementAxisFields: ["budgetBasis", "budgetLimit"],
  mutationAxisFields: ["trimBasis", "trimBudgetLimit"],
  requiredFields: PROMPT_OPTIMIZATION_RUNTIME_REPORT_REQUIRED_FIELDS,
  publicFieldInventory: PROMPT_OPTIMIZATION_RUNTIME_REPORT_PUBLIC_FIELD_INVENTORY,
  redactionPolicy: PROMPT_OPTIMIZATION_RUNTIME_REPORT_REDACTION_POLICY,
  secretRules: PROMPT_OPTIMIZATION_RUNTIME_REPORT_SECRET_RULES,
  latestArtifacts: PROMPT_OPTIMIZATION_RUNTIME_REPORT_ARTIFACTS,
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

export function getPromptOptimizationRuntimeReportContract(): PromptOptimizationRuntimeReportContract {
  return PROMPT_OPTIMIZATION_RUNTIME_REPORT_CONTRACT
}
