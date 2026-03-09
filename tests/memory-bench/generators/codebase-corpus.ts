export interface CorpusEntry {
  id: string
  content: string
  agent: string
  tags: string[]
  timestamp: string
  supersedes?: string
}

export interface WeakSeedPair {
  id: string
  agent: string
  query: string
  expectedEntryId: string
}

export interface LatestTruthPair {
  id: string
  agent: string
  query: string
  olderEntryId: string
  newerEntryId: string
}

export interface CorpusResult {
  entries: CorpusEntry[]
  weakSeedQueryPairs: WeakSeedPair[]
  latestTruthPairs: LatestTruthPair[]
  wrongAgentContaminationSet: CorpusEntry[]
}

type Scale = "small" | "medium" | "large"

type ArtifactType =
  | "module-description"
  | "dependency-record"
  | "adr"
  | "known-issue"
  | "risk-record"
  | "change-history"
  | "support-chain"
  | "cross-module-relationship"

interface ScalePreset {
  moduleCount: number
  periodCount: number
  baselineArtifactCount: number
}

interface PeriodDefinition {
  index: number
  label: string
  releaseName: string
  timestamp: string
  stabilizationFocus: string
}

interface ModuleBlueprint {
  name: string
  slug: string
  domain: string
  purpose: string
  customerOutcome: string
  ownerTeam: string
  backupTeam: string
}

interface ModuleProfile {
  legacyStateModel: string
  currentStateModel: string
  legacyStore: string
  currentStore: string
  legacyInterface: string
  currentInterface: string
  riskVector: string
  mitigation: string
  issuePattern: string
  validationFocus: string
  adrRationale: string
  changeTheme: string
}

type ModuleHistory = Record<ArtifactType, string[]>

interface ArtifactContext {
  artifact: ArtifactType
  module: ModuleBlueprint
  profile: ModuleProfile
  period: PeriodDefinition
  moduleIndex: number
  periodIndex: number
  isCurrentTruth: boolean
  primaryDependency: ModuleBlueprint
  secondaryDependency: ModuleBlueprint
  tertiaryDependency: ModuleBlueprint
  issueCode: string
  riskCode: string
  adrCode: string
  releaseLead: string
}

const SCALE_PRESETS: Record<Scale, ScalePreset> = {
  small: { moduleCount: 8, periodCount: 7, baselineArtifactCount: 2 },
  medium: { moduleCount: 20, periodCount: 12, baselineArtifactCount: 2 },
  large: { moduleCount: 40, periodCount: 15, baselineArtifactCount: 2 },
}

const ARTIFACT_ORDER: ArtifactType[] = [
  "module-description",
  "dependency-record",
  "adr",
  "known-issue",
  "risk-record",
  "change-history",
  "support-chain",
  "cross-module-relationship",
]

const MODULE_BLUEPRINTS: ModuleBlueprint[] = [
  {
    name: "AuthService",
    slug: "auth-service",
    domain: "identity",
    purpose: "user sign-in, session issuance, and reauthentication",
    customerOutcome: "login state stable across web and mobile journeys",
    ownerTeam: "@identity-platform",
    backupTeam: "@platform-oncall",
  },
  {
    name: "SessionStore",
    slug: "session-store",
    domain: "identity",
    purpose: "active session persistence and token revocation checks",
    customerOutcome: "account sessions survive refreshes and device hops",
    ownerTeam: "@identity-platform",
    backupTeam: "@infra-runtime",
  },
  {
    name: "UserRepository",
    slug: "user-repository",
    domain: "identity",
    purpose: "profile persistence, account preferences, and lookup indexing",
    customerOutcome: "user records stay consistent across touchpoints",
    ownerTeam: "@customer-data",
    backupTeam: "@identity-platform",
  },
  {
    name: "PermissionsService",
    slug: "permissions-service",
    domain: "identity",
    purpose: "policy evaluation for roles, scopes, and tenant grants",
    customerOutcome: "access checks remain predictable during permission changes",
    ownerTeam: "@trust-boundary",
    backupTeam: "@identity-platform",
  },
  {
    name: "TenantResolver",
    slug: "tenant-resolver",
    domain: "multi-tenant",
    purpose: "tenant routing, region affinity, and workspace mapping",
    customerOutcome: "requests land in the correct tenant shard",
    ownerTeam: "@tenant-platform",
    backupTeam: "@platform-oncall",
  },
  {
    name: "CustomerProfileService",
    slug: "customer-profile-service",
    domain: "customer-data",
    purpose: "customer profile aggregation and lifecycle attributes",
    customerOutcome: "support and product flows see the same customer profile",
    ownerTeam: "@customer-data",
    backupTeam: "@support-systems",
  },
  {
    name: "CheckoutOrchestrator",
    slug: "checkout-orchestrator",
    domain: "commerce",
    purpose: "checkout step orchestration, cart locks, and handoff sequencing",
    customerOutcome: "checkout completes without duplicate or missing steps",
    ownerTeam: "@commerce-core",
    backupTeam: "@payments-oncall",
  },
  {
    name: "PricingEngine",
    slug: "pricing-engine",
    domain: "commerce",
    purpose: "price calculation, discount stacking, and regional tax rules",
    customerOutcome: "buyers see correct totals before they pay",
    ownerTeam: "@commerce-core",
    backupTeam: "@finance-platform",
  },
  {
    name: "InventoryPlanner",
    slug: "inventory-planner",
    domain: "commerce",
    purpose: "stock reservation forecasts and availability reconciliation",
    customerOutcome: "products do not oversell under demand spikes",
    ownerTeam: "@supply-ops",
    backupTeam: "@commerce-core",
  },
  {
    name: "OrderLedger",
    slug: "order-ledger",
    domain: "commerce",
    purpose: "order state transitions, immutable receipts, and fulfillment markers",
    customerOutcome: "order history remains auditable and recoverable",
    ownerTeam: "@order-systems",
    backupTeam: "@finance-platform",
  },
  {
    name: "PaymentGateway",
    slug: "payment-gateway",
    domain: "payments",
    purpose: "payment authorization routing and processor fallback handling",
    customerOutcome: "charges complete even when a processor is degraded",
    ownerTeam: "@payments-oncall",
    backupTeam: "@finance-platform",
  },
  {
    name: "InvoiceService",
    slug: "invoice-service",
    domain: "payments",
    purpose: "invoice generation, tax summaries, and billing document delivery",
    customerOutcome: "finance teams receive correct invoices without manual fixes",
    ownerTeam: "@finance-platform",
    backupTeam: "@payments-oncall",
  },
  {
    name: "RefundCoordinator",
    slug: "refund-coordinator",
    domain: "payments",
    purpose: "refund workflow routing and processor reconciliation tracking",
    customerOutcome: "refunds settle without duplicate payout attempts",
    ownerTeam: "@payments-oncall",
    backupTeam: "@support-systems",
  },
  {
    name: "SubscriptionLifecycle",
    slug: "subscription-lifecycle",
    domain: "billing",
    purpose: "plan changes, renewals, cancellations, and grace-period rules",
    customerOutcome: "subscription status stays accurate during billing changes",
    ownerTeam: "@finance-platform",
    backupTeam: "@commerce-core",
  },
  {
    name: "CatalogIndexer",
    slug: "catalog-indexer",
    domain: "catalog",
    purpose: "catalog projection building and searchable product snapshots",
    customerOutcome: "new catalog changes become searchable quickly",
    ownerTeam: "@discovery-search",
    backupTeam: "@supply-ops",
  },
  {
    name: "SearchGateway",
    slug: "search-gateway",
    domain: "catalog",
    purpose: "search query parsing, ranking fallback, and relevance routing",
    customerOutcome: "buyers find the right item without repetitive filtering",
    ownerTeam: "@discovery-search",
    backupTeam: "@platform-oncall",
  },
  {
    name: "RecommendationEngine",
    slug: "recommendation-engine",
    domain: "catalog",
    purpose: "personalized recommendations and similarity candidate blending",
    customerOutcome: "users see useful recommendations instead of stale suggestions",
    ownerTeam: "@growth-systems",
    backupTeam: "@discovery-search",
  },
  {
    name: "FeatureFlagService",
    slug: "feature-flag-service",
    domain: "platform",
    purpose: "flag evaluation, audience targeting, and rollout scheduling",
    customerOutcome: "rollouts can ramp safely without full redeploys",
    ownerTeam: "@release-engineering",
    backupTeam: "@platform-oncall",
  },
  {
    name: "ExperimentOrchestrator",
    slug: "experiment-orchestrator",
    domain: "platform",
    purpose: "experiment assignment, exposure logging, and holdout policies",
    customerOutcome: "A/B tests stay statistically clean during launches",
    ownerTeam: "@growth-systems",
    backupTeam: "@release-engineering",
  },
  {
    name: "NotificationRouter",
    slug: "notification-router",
    domain: "messaging",
    purpose: "multi-channel notification dispatch planning and throttling",
    customerOutcome: "important notifications reach the right channel first",
    ownerTeam: "@messaging-platform",
    backupTeam: "@support-systems",
  },
  {
    name: "EmailComposer",
    slug: "email-composer",
    domain: "messaging",
    purpose: "email template rendering and delivery payload composition",
    customerOutcome: "email content remains personalized and localized",
    ownerTeam: "@messaging-platform",
    backupTeam: "@brand-systems",
  },
  {
    name: "SmsDispatcher",
    slug: "sms-dispatcher",
    domain: "messaging",
    purpose: "SMS provider routing and regional compliance throttles",
    customerOutcome: "time-sensitive texts send through the best available route",
    ownerTeam: "@messaging-platform",
    backupTeam: "@platform-oncall",
  },
  {
    name: "WebhookRelay",
    slug: "webhook-relay",
    domain: "integrations",
    purpose: "outbound webhook fan-out, signing, and replay handling",
    customerOutcome: "partner systems receive reliable event callbacks",
    ownerTeam: "@partner-integrations",
    backupTeam: "@platform-oncall",
  },
  {
    name: "IntegrationHub",
    slug: "integration-hub",
    domain: "integrations",
    purpose: "partner connector lifecycles and external schema translations",
    customerOutcome: "partners onboard with fewer custom data fixes",
    ownerTeam: "@partner-integrations",
    backupTeam: "@support-systems",
  },
  {
    name: "WorkflowEngine",
    slug: "workflow-engine",
    domain: "automation",
    purpose: "workflow state transitions, retries, and operator approvals",
    customerOutcome: "automations progress without manual babysitting",
    ownerTeam: "@automation-core",
    backupTeam: "@platform-oncall",
  },
  {
    name: "JobScheduler",
    slug: "job-scheduler",
    domain: "automation",
    purpose: "background job claiming, pacing, and retry queues",
    customerOutcome: "scheduled work runs on time without thundering herds",
    ownerTeam: "@automation-core",
    backupTeam: "@infra-runtime",
  },
  {
    name: "AnalyticsPipeline",
    slug: "analytics-pipeline",
    domain: "analytics",
    purpose: "event ingestion, transformation, and warehouse publishing",
    customerOutcome: "reports reflect product activity without drift",
    ownerTeam: "@data-platform",
    backupTeam: "@observability-foundation",
  },
  {
    name: "ReportBuilder",
    slug: "report-builder",
    domain: "analytics",
    purpose: "report materialization and scheduled stakeholder exports",
    customerOutcome: "stakeholders receive stable daily reports instead of stale snapshots",
    ownerTeam: "@data-platform",
    backupTeam: "@support-systems",
  },
  {
    name: "FraudMonitor",
    slug: "fraud-monitor",
    domain: "risk",
    purpose: "suspicious activity scoring and fraud intervention routing",
    customerOutcome: "high-risk actions pause before funds or data are exposed",
    ownerTeam: "@risk-ops",
    backupTeam: "@payments-oncall",
  },
  {
    name: "RiskRulesEngine",
    slug: "risk-rules-engine",
    domain: "risk",
    purpose: "real-time risk rule evaluation and override policy handling",
    customerOutcome: "risk checks stay explainable during policy changes",
    ownerTeam: "@risk-ops",
    backupTeam: "@trust-boundary",
  },
  {
    name: "AuditTrail",
    slug: "audit-trail",
    domain: "compliance",
    purpose: "audit event persistence, tamper checks, and export packaging",
    customerOutcome: "investigations can reconstruct who changed what and when",
    ownerTeam: "@governance-core",
    backupTeam: "@trust-boundary",
  },
  {
    name: "ComplianceJournal",
    slug: "compliance-journal",
    domain: "compliance",
    purpose: "regulation mapping, evidence linking, and control exceptions",
    customerOutcome: "compliance reviews finish without hunting through ad hoc notes",
    ownerTeam: "@governance-core",
    backupTeam: "@support-systems",
  },
  {
    name: "DocumentVault",
    slug: "document-vault",
    domain: "documents",
    purpose: "document retention, signed exports, and sensitive attachment controls",
    customerOutcome: "regulated files remain available but tightly controlled",
    ownerTeam: "@document-systems",
    backupTeam: "@governance-core",
  },
  {
    name: "MediaProcessor",
    slug: "media-processor",
    domain: "media",
    purpose: "media transcoding, image derivatives, and asset validation",
    customerOutcome: "uploads become usable quickly across devices",
    ownerTeam: "@media-platform",
    backupTeam: "@platform-oncall",
  },
  {
    name: "AssetCDNManager",
    slug: "asset-cdn-manager",
    domain: "media",
    purpose: "asset cache invalidation, edge policies, and URL signing",
    customerOutcome: "new assets appear quickly without serving stale versions",
    ownerTeam: "@media-platform",
    backupTeam: "@infra-runtime",
  },
  {
    name: "MobileSync",
    slug: "mobile-sync",
    domain: "mobile",
    purpose: "mobile delta sync planning and offline reconciliation markers",
    customerOutcome: "mobile clients recover gracefully after reconnecting",
    ownerTeam: "@mobile-platform",
    backupTeam: "@identity-platform",
  },
  {
    name: "SupportWorkbench",
    slug: "support-workbench",
    domain: "support",
    purpose: "support tooling aggregation and guided remediation shortcuts",
    customerOutcome: "support agents resolve incidents without escalations bouncing around",
    ownerTeam: "@support-systems",
    backupTeam: "@platform-oncall",
  },
  {
    name: "IncidentConsole",
    slug: "incident-console",
    domain: "operations",
    purpose: "incident timeline aggregation and responder coordination views",
    customerOutcome: "on-call can triage a live issue from one console",
    ownerTeam: "@observability-foundation",
    backupTeam: "@platform-oncall",
  },
  {
    name: "ObservabilityHub",
    slug: "observability-hub",
    domain: "operations",
    purpose: "trace correlation, SLO rollups, and alert annotation",
    customerOutcome: "operators can explain regressions before customers notice",
    ownerTeam: "@observability-foundation",
    backupTeam: "@infra-runtime",
  },
  {
    name: "SecretsBroker",
    slug: "secrets-broker",
    domain: "security",
    purpose: "runtime secret leasing, rotation coordination, and access brokering",
    customerOutcome: "services rotate sensitive credentials without coordinated downtime",
    ownerTeam: "@trust-boundary",
    backupTeam: "@infra-runtime",
  },
]

const LEGACY_STATE_MODELS = [
  "JWT refresh-token sessions",
  "nightly batch synchronization",
  "single-region sticky sessions",
  "cron-driven polling loops",
  "synchronous REST fan-out",
  "shared mutable cache state",
  "static rules pushed by deploy",
  "table-scan reconciliation jobs",
] as const

const CURRENT_STATE_MODELS = [
  "server-side session ledgers",
  "event-sourced state transitions",
  "region-aware active-active coordination",
  "queue-backed workflow claims",
  "idempotent event-driven handoffs",
  "append-only projection streams",
  "policy bundles refreshed in memory",
  "checkpointed incremental reconciliation",
] as const

const LEGACY_STORES = [
  "local in-memory caches",
  "single PostgreSQL primary tables",
  "flat audit tables in MySQL",
  "Redis lists without shard awareness",
  "CSV-style warehouse staging drops",
  "shared MongoDB documents",
  "region-local SQLite snapshots",
  "S3 manifest files",
] as const

const CURRENT_STORES = [
  "Redis-backed session partitions",
  "PostgreSQL tables with logical read models",
  "Kafka-backed event streams",
  "Qdrant search projections",
  "columnar warehouse mirrors",
  "append-only object manifests",
  "tenant-scoped document bundles",
  "durable queue checkpoints",
] as const

const LEGACY_INTERFACES = [
  "v1 REST callbacks",
  "polling-based admin exports",
  "legacy mobile refresh endpoints",
  "CSV reconciliation uploads",
  "SOAP-style partner adapters",
  "manual operator replays",
  "synchronous webhook retries",
  "shared cron handoffs",
] as const

const CURRENT_INTERFACES = [
  "signed event contracts",
  "cursor-based sync feeds",
  "mobile delta streams",
  "self-serve replay controls",
  "idempotent webhook contracts",
  "versioned partner envelopes",
  "asynchronous export jobs",
  "tenant-aware control-plane APIs",
] as const

const RISK_VECTORS = [
  "silent backlog growth during retry storms",
  "stale tenant routing after cache churn",
  "misordered event replay under regional failover",
  "Redis eviction hiding active customer state",
  "warehouse lag masking partial writes",
  "cross-region clock skew in reconciliation windows",
  "control-plane drift after emergency toggles",
  "partner callback replays outrunning idempotency keys",
] as const

const MITIGATIONS = [
  "pin queue depth alerts to customer-impacting workflows first",
  "tie shard movement to explicit tenant warm-up checks",
  "enforce monotonic sequence watermarks before replay",
  "switch cache policies to noeviction on customer-critical partitions",
  "compare warehouse freshness against the source-of-truth ledger",
  "gate reconciliation batches behind region skew thresholds",
  "record emergency toggles in an approval journal within five minutes",
  "require callback dedupe keys before enabling fast retries",
] as const

const ISSUE_PATTERNS = [
  "race condition during concurrent updates",
  "partial retry loop after network jitter",
  "out-of-order projection refreshes",
  "stale cache stampede after config rollout",
  "duplicate notification delivery under failover",
  "long-tail latency spike after warm restart",
  "idempotency gap in multi-step recovery",
  "support dashboard showing stale derived state",
] as const

const VALIDATION_FOCUS = [
  "shadow traffic replay comparisons",
  "multi-tenant regression sweeps",
  "failure-injection drills",
  "contract snapshots across partner versions",
  "chaos tests for regional handoff",
  "load tests around partial rollback paths",
  "golden-record assertion packs",
  "support-runbook walkthrough checks",
] as const

const ADR_RATIONALES = [
  "mobile clients could not recover reliably from token refresh drift",
  "support teams needed a single audit trail for partial retries",
  "regional growth made sticky routing operationally brittle",
  "partner integrations required replay-safe delivery semantics",
  "batch windows were masking customer-facing failures for hours",
  "manual backfills kept reintroducing stale state after hotfixes",
  "shared caches were leaking noisy-neighbour behaviour across tenants",
  "SLO reviews showed synchronous chains amplifying transient failures",
] as const

const CHANGE_THEMES = [
  "removed the legacy compatibility shim",
  "introduced stricter replay guards",
  "moved retries behind queue ownership boundaries",
  "split noisy read paths from write-critical flows",
  "standardized regional failover markers",
  "tightened partner retry envelopes",
  "collapsed manual operator steps into guided tooling",
  "added source-of-truth assertions before publish",
] as const

const RELEASE_NAMES = [
  "Aurora",
  "Beacon",
  "Cinder",
  "Delta",
  "Ember",
  "Fjord",
  "Grove",
  "Harbor",
  "Ion",
  "Jasper",
  "Keystone",
  "Lattice",
  "Meridian",
  "Nimbus",
  "Orchid",
] as const

const STABILIZATION_FOCI = [
  "latency containment",
  "tenant isolation",
  "regional failover readiness",
  "support escalation clarity",
  "replay safety",
  "cache freshness",
  "dependency decoupling",
  "incident triage speed",
] as const

const RELEASE_LEADS = [
  "@alice",
  "@bruno",
  "@carmen",
  "@dev",
  "@elena",
  "@farah",
  "@gabe",
  "@hana",
] as const

function atCycle<T>(values: readonly T[], index: number): T {
  const normalized = ((index % values.length) + values.length) % values.length
  const value = values[normalized]
  if (value === undefined) {
    throw new Error("Expected non-empty collection")
  }
  return value
}

function buildPeriods(count: number): PeriodDefinition[] {
  const periods: PeriodDefinition[] = []
  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.UTC(2023, index, 15, 9, 0, 0))
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    periods.push({
      index,
      label: `${date.getUTCFullYear()}-${month}`,
      releaseName: atCycle(RELEASE_NAMES, index),
      timestamp: date.toISOString(),
      stabilizationFocus: atCycle(STABILIZATION_FOCI, index),
    })
  }
  return periods
}

function buildHistory(): ModuleHistory {
  return {
    "module-description": [],
    "dependency-record": [],
    adr: [],
    "known-issue": [],
    "risk-record": [],
    "change-history": [],
    "support-chain": [],
    "cross-module-relationship": [],
  }
}

function buildProfile(moduleIndex: number): ModuleProfile {
  return {
    legacyStateModel: atCycle(LEGACY_STATE_MODELS, moduleIndex),
    currentStateModel: atCycle(CURRENT_STATE_MODELS, moduleIndex + 3),
    legacyStore: atCycle(LEGACY_STORES, moduleIndex + 1),
    currentStore: atCycle(CURRENT_STORES, moduleIndex + 4),
    legacyInterface: atCycle(LEGACY_INTERFACES, moduleIndex + 2),
    currentInterface: atCycle(CURRENT_INTERFACES, moduleIndex + 5),
    riskVector: atCycle(RISK_VECTORS, moduleIndex + 2),
    mitigation: atCycle(MITIGATIONS, moduleIndex + 4),
    issuePattern: atCycle(ISSUE_PATTERNS, moduleIndex + 1),
    validationFocus: atCycle(VALIDATION_FOCUS, moduleIndex + 2),
    adrRationale: atCycle(ADR_RATIONALES, moduleIndex + 3),
    changeTheme: atCycle(CHANGE_THEMES, moduleIndex + 5),
  }
}

function artifactId(moduleSlug: string, artifact: ArtifactType, snapshotIndex: number): string {
  const suffix = String(snapshotIndex + 1).padStart(2, "0")
  return `${moduleSlug}-${artifact}-${suffix}`
}

function artifactTags(
  artifact: ArtifactType,
  module: ModuleBlueprint,
  agent: string,
  period: PeriodDefinition,
  relatedModules: readonly ModuleBlueprint[],
): string[] {
  const tags = [
    `artifact:${artifact}`,
    `module:${module.slug}`,
    `domain:${module.domain}`,
    `agent:${agent}`,
    `period:${period.label}`,
    `owner:${module.ownerTeam}`,
  ]

  for (const relatedModule of relatedModules) {
    tags.push(`related:${relatedModule.slug}`)
  }

  return tags
}

function buildModuleDescription(context: ArtifactContext): string {
  if ((context.moduleIndex + context.periodIndex) % 2 === 0) {
    return `${context.module.name} handles ${context.module.purpose}. Analysis snapshot ${context.period.label}: the service now anchors ${context.module.customerOutcome} through ${context.isCurrentTruth ? context.profile.currentStateModel : context.profile.legacyStateModel}. Owned by ${context.module.ownerTeam}; escalation backup ${context.module.backupTeam}. Review focus for ${context.period.releaseName}: ${context.period.stabilizationFocus}.`
  }

  return `Codebase review ${context.period.label}: ${context.module.name} remains the primary module for ${context.module.purpose}. Current truth is ${context.isCurrentTruth ? context.profile.currentStateModel : context.profile.legacyStateModel}, replacing ad hoc handling around ${context.module.customerOutcome}. Ownership sits with ${context.module.ownerTeam}, with ${context.module.backupTeam} covering incidents outside office hours.`
}

function buildDependencyRecord(context: ArtifactContext): string {
  if ((context.moduleIndex + context.periodIndex) % 3 === 0) {
    return `${context.module.name} dependency map (${context.period.label}): depends on ${context.primaryDependency.name}, ${context.secondaryDependency.name}, and ${context.tertiaryDependency.name}. Primary state backend is ${context.isCurrentTruth ? context.profile.currentStore : context.profile.legacyStore}. ${context.primaryDependency.name} provides the first coordination hop for ${context.module.customerOutcome}.`
  }

  return `Dependency analysis for ${context.module.name} in ${context.period.releaseName}: first-hop dependency ${context.primaryDependency.name}, second-hop dependency ${context.secondaryDependency.name}, operational fallback ${context.tertiaryDependency.name}. Persistence posture moved ${context.isCurrentTruth ? "toward" : "around"} ${context.isCurrentTruth ? context.profile.currentStore : context.profile.legacyStore}, which is the store most likely to affect ${context.module.customerOutcome}.`
}

function buildAdr(context: ArtifactContext): string {
  if ((context.moduleIndex + context.periodIndex) % 2 === 0) {
    return `${context.adrCode}: ${context.module.name} ${context.isCurrentTruth ? `migrated from ${context.profile.legacyStateModel} to ${context.profile.currentStateModel}` : `retained ${context.profile.legacyStateModel} instead of jumping early to ${context.profile.currentStateModel}`}. Rationale: ${context.profile.adrRationale}. Impact: ${context.module.customerOutcome} now relies on ${context.isCurrentTruth ? context.profile.currentInterface : context.profile.legacyInterface}.`
  }

  return `${context.adrCode} review note — ${context.module.name} ${context.isCurrentTruth ? `standardized on ${context.profile.currentStateModel}` : `continued with ${context.profile.legacyStateModel}`}. Decision driver: ${context.profile.adrRationale}. Consequence: operators must verify ${context.isCurrentTruth ? context.profile.currentInterface : context.profile.legacyInterface} before closing incidents tied to ${context.module.customerOutcome}.`
}

function buildKnownIssue(context: ArtifactContext): string {
  return `${context.issueCode}: ${context.module.name} shows a ${context.profile.issuePattern} when ${context.primaryDependency.name} slows down and ${context.secondaryDependency.name} retries at the same time. Severity: ${context.periodIndex % 4 === 0 ? "High" : "Medium"}. Status: ${context.isCurrentTruth ? "Mitigating but still observable under peak load" : "Open"}. QA focus: ${context.profile.validationFocus}.`
}

function buildRiskRecord(context: ArtifactContext): string {
  return `${context.riskCode}: ${context.module.name} carries a risk of ${context.profile.riskVector}. If ${context.isCurrentTruth ? context.profile.currentStore : context.profile.legacyStore} stalls, ${context.module.customerOutcome} can fail before frontline alerts page. Mitigation: ${context.profile.mitigation}. Security review owner: ${context.module.ownerTeam} with escalation via ${context.module.backupTeam}.`
}

function buildChangeHistory(context: ArtifactContext): string {
  if ((context.moduleIndex + context.periodIndex) % 2 === 0) {
    return `${context.period.label}: ${context.module.name} refactored by ${context.releaseLead}. ${context.profile.changeTheme}. Compatibility note: ${context.isCurrentTruth ? `${context.profile.legacyInterface} retired; ${context.profile.currentInterface} is now required` : `${context.profile.legacyInterface} remains enabled for dependent modules while ${context.profile.currentInterface} is staged`}.`
  }

  return `${context.period.label} release history for ${context.module.name}: ${context.releaseLead} landed work that ${context.profile.changeTheme}. Breaking-change watch: ${context.isCurrentTruth ? `${context.profile.currentInterface} is the supported path and ${context.profile.legacyInterface} is deprecated` : `${context.profile.legacyInterface} is still active while downstream teams prepare for ${context.profile.currentInterface}`}.`
}

function buildSupportChain(context: ArtifactContext): string {
  return `Support chain for ${context.module.name} (${context.period.label}): when ${context.module.customerOutcome} degrades → inspect ${context.primaryDependency.name} health → verify ${context.secondaryDependency.name} latency → confirm ${context.isCurrentTruth ? context.profile.currentStore : context.profile.legacyStore} saturation → review ${context.riskCode} and ${context.issueCode} → escalate to ${context.module.backupTeam} if the mitigation is not holding.`
}

function buildCrossModuleRelationship(context: ArtifactContext): string {
  return `${context.module.name} → coordinates with ${context.primaryDependency.name} → which relies on ${context.secondaryDependency.name} → while ${context.tertiaryDependency.name} closes the final loop for ${context.module.customerOutcome}. Relationship review ${context.period.releaseName}: keep this chain aligned with ${context.isCurrentTruth ? context.profile.currentStateModel : context.profile.legacyStateModel} so stale assumptions from ${context.profile.legacyInterface} do not reappear.`
}

function buildContent(context: ArtifactContext): string {
  if (context.artifact === "module-description") return buildModuleDescription(context)
  if (context.artifact === "dependency-record") return buildDependencyRecord(context)
  if (context.artifact === "adr") return buildAdr(context)
  if (context.artifact === "known-issue") return buildKnownIssue(context)
  if (context.artifact === "risk-record") return buildRiskRecord(context)
  if (context.artifact === "change-history") return buildChangeHistory(context)
  if (context.artifact === "support-chain") return buildSupportChain(context)
  return buildCrossModuleRelationship(context)
}

function agentForArtifact(artifact: ArtifactType): string {
  if (artifact === "known-issue" || artifact === "support-chain") return "qa-specialist"
  if (artifact === "risk-record") return "ciso"
  return "fullstack-wunderkind"
}

function latestId(ids: readonly string[]): string | null {
  if (ids.length === 0) return null
  return ids[ids.length - 1] ?? null
}

function earliestId(ids: readonly string[]): string | null {
  if (ids.length === 0) return null
  return ids[0] ?? null
}

export function generateCorpus(options?: { scale?: Scale }): CorpusResult {
  const scale = options?.scale ?? "large"
  const preset = SCALE_PRESETS[scale]
  const modules = MODULE_BLUEPRINTS.slice(0, preset.moduleCount)
  const periods = buildPeriods(preset.periodCount)
  const entries: CorpusEntry[] = []
  const histories = new Map<string, ModuleHistory>()
  const profiles = new Map<string, ModuleProfile>()
  const entryById = new Map<string, CorpusEntry>()
  const cisoEntries: CorpusEntry[] = []

  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
    const module = modules[moduleIndex]
    if (!module) {
      continue
    }

    const history = buildHistory()
    histories.set(module.slug, history)

    const profile = buildProfile(moduleIndex)
    profiles.set(module.slug, profile)

    const transitionIndex = Math.min(
      Math.max(1, Math.floor(preset.periodCount / 2) + (moduleIndex % 3) - 1),
      Math.max(1, preset.periodCount - 2),
    )

    const totalSnapshots = preset.baselineArtifactCount + preset.periodCount
    for (let snapshotIndex = 0; snapshotIndex < totalSnapshots; snapshotIndex += 1) {
      const isBaseline = snapshotIndex < preset.baselineArtifactCount
      const periodIndex = isBaseline ? 0 : snapshotIndex - preset.baselineArtifactCount
      const period = isBaseline
        ? {
            index: -preset.baselineArtifactCount + snapshotIndex,
            label: `baseline-${String(snapshotIndex + 1).padStart(2, "0")}`,
            releaseName: "Baseline",
            timestamp: new Date(Date.UTC(2022, snapshotIndex, 10, 9, 0, 0)).toISOString(),
            stabilizationFocus: "foundational analysis",
          }
        : periods[periodIndex]

      if (!period) {
        continue
      }

      const activeArtifacts = isBaseline
        ? ARTIFACT_ORDER.slice(0, preset.baselineArtifactCount)
        : ARTIFACT_ORDER

      for (const artifact of activeArtifacts) {
        const dependencyBase = moduleIndex + snapshotIndex + 1
        const primaryDependency = atCycle(modules, dependencyBase)
        const secondaryDependency = atCycle(modules, dependencyBase + 3)
        const tertiaryDependency = atCycle(modules, dependencyBase + 7)
        const issueCode = `ISSUE-${module.slug.toUpperCase().replace(/-/g, "_")}-${String(snapshotIndex + 1).padStart(2, "0")}`
        const riskCode = `RISK-${module.slug.toUpperCase().replace(/-/g, "_")}-${String(snapshotIndex + 1).padStart(2, "0")}`
        const adrCode = `ADR-${String(moduleIndex * 100 + snapshotIndex + 1).padStart(4, "0")}`
        const releaseLead = atCycle(RELEASE_LEADS, moduleIndex + snapshotIndex)
        const context: ArtifactContext = {
          artifact,
          module,
          profile,
          period,
          moduleIndex,
          periodIndex: snapshotIndex,
          isCurrentTruth: !isBaseline && periodIndex >= transitionIndex,
          primaryDependency,
          secondaryDependency,
          tertiaryDependency,
          issueCode,
          riskCode,
          adrCode,
          releaseLead,
        }
        const id = artifactId(module.slug, artifact, snapshotIndex)
        const previousIds = history[artifact]
        const supersedes = previousIds.length > 0 ? latestId(previousIds) : null
        const agent = agentForArtifact(artifact)
        const entry: CorpusEntry = {
          id,
          content: buildContent(context),
          agent,
          tags: artifactTags(artifact, module, agent, period, [primaryDependency, secondaryDependency, tertiaryDependency]),
          timestamp: period.timestamp,
          ...(supersedes ? { supersedes } : {}),
        }

        entries.push(entry)
        entryById.set(entry.id, entry)
        history[artifact].push(entry.id)

        if (entry.agent === "ciso") {
          cisoEntries.push(entry)
        }
      }
    }
  }

  const weakSeedQueryPairs: WeakSeedPair[] = []
  const latestTruthPairs: LatestTruthPair[] = []

  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
    const module = modules[moduleIndex]
    if (!module) {
      continue
    }

    const history = histories.get(module.slug)
    const profile = profiles.get(module.slug)
    if (!history || !profile) {
      continue
    }

    const latestDescription = latestId(history["module-description"])
    const latestDependency = latestId(history["dependency-record"])
    const latestAdr = latestId(history.adr)
    const latestIssue = latestId(history["known-issue"])
    const latestRisk = latestId(history["risk-record"])
    const latestChange = latestId(history["change-history"])
    const latestSupport = latestId(history["support-chain"])
    const latestRelationship = latestId(history["cross-module-relationship"])

    if (latestDescription) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-description`,
        agent: "fullstack-wunderkind",
        query: `How does the platform keep ${module.customerOutcome.toLowerCase()} today?`,
        expectedEntryId: latestDescription,
      })
    }

    if (latestDependency) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-dependency`,
        agent: "fullstack-wunderkind",
        query: `What systems sit underneath ${module.name} when it needs to get real work done?`,
        expectedEntryId: latestDependency,
      })
    }

    if (latestAdr) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-adr`,
        agent: "fullstack-wunderkind",
        query: `Why did the team change the operating style behind ${module.name}?`,
        expectedEntryId: latestAdr,
      })
    }

    if (latestIssue) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-issue`,
        agent: "qa-specialist",
        query: `Where does ${module.name} still get flaky when traffic and retries collide?`,
        expectedEntryId: latestIssue,
      })
    }

    if (latestRisk) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-risk`,
        agent: "ciso",
        query: `What quiet failure around ${module.name} could hurt users before people notice?`,
        expectedEntryId: latestRisk,
      })
    }

    if (latestChange) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-change`,
        agent: "fullstack-wunderkind",
        query: `What recently changed in ${module.name} that could surprise downstream teams?`,
        expectedEntryId: latestChange,
      })
    }

    if (latestSupport) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-support`,
        agent: "qa-specialist",
        query: `If ${module.customerOutcome.toLowerCase()} starts breaking, what investigation trail should support follow first?`,
        expectedEntryId: latestSupport,
      })
    }

    if (latestRelationship) {
      weakSeedQueryPairs.push({
        id: `weak-${module.slug}-relationship`,
        agent: "fullstack-wunderkind",
        query: `Which neighboring modules does ${module.name} lean on across a two-hop chain?`,
        expectedEntryId: latestRelationship,
      })
    }

    const earliestDescription = earliestId(history["module-description"])
    if (earliestDescription && latestDescription && earliestDescription !== latestDescription) {
      latestTruthPairs.push({
        id: `latest-${module.slug}-description`,
        agent: "fullstack-wunderkind",
        query: `What architecture now governs ${module.name}?`,
        olderEntryId: earliestDescription,
        newerEntryId: latestDescription,
      })
    }

    const earliestDependency = earliestId(history["dependency-record"])
    if (earliestDependency && latestDependency && earliestDependency !== latestDependency) {
      latestTruthPairs.push({
        id: `latest-${module.slug}-dependency`,
        agent: "fullstack-wunderkind",
        query: `Which storage and first-hop dependency does ${module.name} rely on now?`,
        olderEntryId: earliestDependency,
        newerEntryId: latestDependency,
      })
    }

    const earliestAdr = earliestId(history.adr)
    if (earliestAdr && latestAdr && earliestAdr !== latestAdr) {
      latestTruthPairs.push({
        id: `latest-${module.slug}-adr`,
        agent: "fullstack-wunderkind",
        query: `What is the current architecture decision behind ${module.name}?`,
        olderEntryId: earliestAdr,
        newerEntryId: latestAdr,
      })
    }

    const earliestChange = earliestId(history["change-history"])
    if (earliestChange && latestChange && earliestChange !== latestChange) {
      latestTruthPairs.push({
        id: `latest-${module.slug}-change`,
        agent: "fullstack-wunderkind",
        query: `Does ${module.name} still support ${profile.legacyInterface}, or has that path been retired?`,
        olderEntryId: earliestChange,
        newerEntryId: latestChange,
      })
    }
  }

  return {
    entries,
    weakSeedQueryPairs: weakSeedQueryPairs.slice(0, 72),
    latestTruthPairs: latestTruthPairs.slice(0, Math.min(48, latestTruthPairs.length)),
    wrongAgentContaminationSet: cisoEntries.slice(0, 24).map((entry) => entryById.get(entry.id) ?? entry),
  }
}
