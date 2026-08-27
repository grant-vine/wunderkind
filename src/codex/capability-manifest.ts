export interface CodexAgentSource {
  readonly id: string
  readonly sourcePath: string
  readonly frontDoor: boolean
}

export interface CodexSkillSource {
  readonly id: string
  readonly ownerAgentId: string
  readonly sourcePath: string
}

export interface CodexLegacySkillDisposition {
  readonly id: string
  readonly disposition: "shipped-skill" | "delegated" | "excluded"
  readonly target: string
}

export interface CodexCommandDisposition {
  readonly id: string
  readonly disposition: "adapted-skill" | "cli-behavior" | "specialist-agent" | "delegated" | "deferred" | "excluded"
  readonly target: string
}

export interface CodexCapabilityManifest {
  readonly marketplace: { readonly id: string }
  readonly plugin: { readonly id: string }
  readonly lazyCodex: { readonly pluginId: string; readonly versionRange: string }
  readonly agents: readonly CodexAgentSource[]
  readonly skills: readonly CodexSkillSource[]
  readonly legacySkills: readonly CodexLegacySkillDisposition[]
  readonly staticCommands: readonly CodexCommandDisposition[]
  readonly generatedCommands: readonly CodexCommandDisposition[]
  readonly optionalCompanions: {
    readonly mattSkills: readonly string[]
    readonly skillPacks: readonly string[]
    readonly supabaseSkills: readonly string[]
    readonly plugins: readonly string[]
  }
  readonly deferredCapabilities: readonly string[]
}

export interface CodexSourceViolation {
  readonly rule: string
}

export class CodexCapabilityValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CodexCapabilityValidationError"
  }
}

const EXPECTED_AGENT_IDS = [
  "wunderkind-marketing", "wunderkind-creative-director", "wunderkind-product",
  "wunderkind-architecture", "wunderkind-ciso", "wunderkind-legal",
] as const
const EXPECTED_SKILL_IDS = [
  "wunderkind", "setup-wunderkind-workflow", "docs-index", "prd-pipeline", "release-upgrade",
  "experimentation-analyst", "supportability-review", "social-media-maven", "technical-writer",
  "compliance-officer", "oss-licensing-advisor",
] as const
const EXPECTED_LEGACY_SKILL_IDS = [
  "agile-pm", "code-health", "compliance-officer", "db-architect", "design-an-interface", "diagnose",
  "docs-with-grill", "experimentation-analyst", "grill-me", "improve-codebase-architecture",
  "oss-licensing-advisor", "platform-compatibility", "pen-tester", "prd-pipeline", "release-upgrade",
  "security-analyst", "setup-wunderkind-workflow", "social-media-maven", "supabase-architect",
  "supportability-review", "tdd", "technical-writer", "triage-issue", "ubiquitous-language",
  "vercel-architect", "visual-artist", "write-a-skill", "caveman",
] as const
const EXPECTED_STATIC_COMMAND_IDS = ["docs-index", "dream", "design-md", "workflow-sync", "token-audit", "wunderkind-team"] as const
const EXPECTED_GENERATED_COMMAND_IDS = [
  "gtm-plan", "content-calendar", "community-audit", "thought-leadership-plan", "docs-launch-brief", "dx-audit",
  "competitor-analysis", "brand-identity", "design-audit", "generate-palette", "design-system-review", "creative-brief",
  "setup-wunderkind-workflow", "docs-with-grill", "breakdown", "sprint-plan", "prd", "okr-design", "file-conflict-check",
  "north-star", "diagnose", "validate-page", "bundle-analyze", "db-audit", "edge-vs-node", "architecture-review",
  "supportability-review", "runbook", "threat-model", "security-audit", "compliance-check", "incident-response",
  "security-headers-check", "dependency-audit", "license-audit", "draft-tos", "draft-privacy-policy", "review-contract", "cla-setup",
] as const
const BUILT_IN_AGENT_NAMES = new Set(["default", "worker", "explorer"])

function skill(id: string, ownerAgentId: string): CodexSkillSource {
  return { id, ownerAgentId, sourcePath: `codex-src/skills/${id}/SKILL.md` }
}

function legacy(id: string, disposition: CodexLegacySkillDisposition["disposition"], target: string): CodexLegacySkillDisposition {
  return { id, disposition, target }
}

function command(id: string, disposition: CodexCommandDisposition["disposition"], target: string): CodexCommandDisposition {
  return { id, disposition, target }
}

const EXPECTED_LEGACY_SKILL_DISPOSITIONS: readonly CodexLegacySkillDisposition[] = [
  legacy("agile-pm", "delegated", "OMO $ulw-plan and $start-work; optional Matt to-tickets"), legacy("code-health", "delegated", "OMO $review-work and Codex review agents"),
  legacy("compliance-officer", "shipped-skill", "compliance-officer"), legacy("db-architect", "delegated", "Codex engineering; optional Supabase skills"),
  legacy("design-an-interface", "excluded", "excluded entirely"), legacy("diagnose", "delegated", "OMO $debugging"),
  legacy("docs-with-grill", "delegated", "optional Matt grill-with-docs"), legacy("experimentation-analyst", "shipped-skill", "experimentation-analyst"),
  legacy("grill-me", "delegated", "optional Matt grill-me"), legacy("improve-codebase-architecture", "delegated", "optional Matt improve-codebase-architecture and OMO $refactor"),
  legacy("oss-licensing-advisor", "shipped-skill", "oss-licensing-advisor"), legacy("platform-compatibility", "excluded", "repo-maintainer and OpenCode source only"),
  legacy("pen-tester", "delegated", "Wunderkind CISO judgment; optional Codex Security"), legacy("prd-pipeline", "shipped-skill", "prd-pipeline"),
  legacy("release-upgrade", "shipped-skill", "release-upgrade"), legacy("security-analyst", "delegated", "Wunderkind CISO judgment; optional Codex Security"),
  legacy("setup-wunderkind-workflow", "shipped-skill", "setup-wunderkind-workflow"), legacy("social-media-maven", "shipped-skill", "social-media-maven"),
  legacy("supabase-architect", "delegated", "Codex engineering; optional Supabase skills"), legacy("supportability-review", "shipped-skill", "supportability-review"),
  legacy("tdd", "delegated", "OMO $programming; optional Matt tdd"), legacy("technical-writer", "shipped-skill", "technical-writer"),
  legacy("triage-issue", "delegated", "optional Matt triage and optional GitHub plugin"), legacy("ubiquitous-language", "delegated", "optional Matt domain-modeling or grill-with-docs"),
  legacy("vercel-architect", "delegated", "optional Vercel skills or plugin"), legacy("visual-artist", "delegated", "OMO $frontend and $visual-qa; native image generation; optional Figma or Canva"),
  legacy("write-a-skill", "delegated", "Codex system skill-creator"), legacy("caveman", "delegated", "normal response preference or optional Matt caveman"),
]

const EXPECTED_STATIC_COMMAND_DISPOSITIONS: readonly CodexCommandDisposition[] = [
  command("docs-index", "adapted-skill", "docs-index"), command("dream", "specialist-agent", "wunderkind-product"), command("design-md", "specialist-agent", "wunderkind-creative-director"),
  command("workflow-sync", "cli-behavior", "Codex CLI behavior"), command("token-audit", "deferred", "Codex prompt and token optimization revisit"), command("wunderkind-team", "delegated", "OMO $teammode"),
]

const EXPECTED_GENERATED_COMMAND_DISPOSITIONS: readonly CodexCommandDisposition[] = EXPECTED_GENERATED_COMMAND_IDS.map((id) => command(id, "excluded", "No Codex command alias promotion"))

export const CODEX_CAPABILITY_MANIFEST: CodexCapabilityManifest = {
  marketplace: { id: "grant-vine" },
  plugin: { id: "wunderkind" },
  lazyCodex: { pluginId: "omo@sisyphuslabs", versionRange: ">=4.19.4 <5" },
  agents: EXPECTED_AGENT_IDS.map((id) => ({
    id,
    sourcePath: `codex-src/agents/${id}.md`,
    frontDoor: id === "wunderkind-product",
  })),
  skills: [
    skill("wunderkind", "wunderkind-product"), skill("setup-wunderkind-workflow", "wunderkind-product"), skill("docs-index", "wunderkind-product"),
    skill("prd-pipeline", "wunderkind-product"), skill("release-upgrade", "wunderkind-product"), skill("experimentation-analyst", "wunderkind-product"),
    skill("supportability-review", "wunderkind-architecture"), skill("social-media-maven", "wunderkind-marketing"), skill("technical-writer", "wunderkind-marketing"),
    skill("compliance-officer", "wunderkind-ciso"), skill("oss-licensing-advisor", "wunderkind-legal"),
  ],
  legacySkills: EXPECTED_LEGACY_SKILL_DISPOSITIONS,
  staticCommands: EXPECTED_STATIC_COMMAND_DISPOSITIONS,
  generatedCommands: EXPECTED_GENERATED_COMMAND_DISPOSITIONS,
  optionalCompanions: {
    mattSkills: ["grill-me", "grill-with-docs", "improve-codebase-architecture", "tdd", "triage", "to-spec", "to-tickets", "domain-modeling"],
    skillPacks: ["supabase/agent-skills", "vercel-labs/agent-skills"],
    supabaseSkills: ["supabase", "supabase-postgres-best-practices"],
    plugins: ["github@openai-curated", "figma@openai-curated", "vercel@openai-curated", "sentry@openai-curated", "codex-security@openai-curated", "posthog@openai-curated", "mixpanel@openai-curated"],
  },
  deferredCapabilities: ["codex-prompt-token-optimization-revisit", "no-token-audit-port"],
}

const SOURCE_RULES = [
  ["delegation-call", /\btask\s*\(/i], ["legacy-skill-call", /\bskill\s*\(\s*name\s*=/i],
  ["opencode-tool", /\b(?:opencode|agent-browser|visual-engineering|librarian)\b/i], ["command-alias", /(?:^|\s)\/[a-z][a-z-]*/m],
  ["third-party-ownership", /\b(?:matt pocock|vercel|supabase|codex security)\s+(?:owns|owner|ownership|owned)\b/i],
  ["prompt-token-optimization", /\b(?:prompt|token)\s+(?:optimization|optimisation|audit)\b|\btranscript compaction\b/i],
] as const

export function getCodexSourceViolations(_sourcePath: string, content: string): readonly CodexSourceViolation[] {
  return SOURCE_RULES.flatMap(([rule, pattern]) => (pattern.test(content) ? [{ rule }] : []))
}

export function renderCodexCapabilitySummary(manifest: CodexCapabilityManifest): string {
  return [
    `agents\t${manifest.agents.length}`,
    `skills\t${manifest.skills.length}`,
    `legacy-skills\t${manifest.legacySkills.length}`,
    `static-commands\t${manifest.staticCommands.length}`,
    `generated-commands\t${manifest.generatedCommands.length}`,
  ].join("\n")
}

export function validateCodexCapabilityManifest(manifest: CodexCapabilityManifest): void {
  ensureExactIds("agent", manifest.agents.map((entry) => entry.id), EXPECTED_AGENT_IDS)
  ensureExactIds("skill", manifest.skills.map((entry) => entry.id), EXPECTED_SKILL_IDS)
  ensureExactIds("legacy skill", manifest.legacySkills.map((entry) => entry.id), EXPECTED_LEGACY_SKILL_IDS)
  ensureExactIds("static command", manifest.staticCommands.map((entry) => entry.id), EXPECTED_STATIC_COMMAND_IDS)
  ensureExactIds("generated command", manifest.generatedCommands.map((entry) => entry.id), EXPECTED_GENERATED_COMMAND_IDS)
  ensureFrozenRoutes("legacy skill", manifest.legacySkills, EXPECTED_LEGACY_SKILL_DISPOSITIONS)
  ensureFrozenRoutes("static command", manifest.staticCommands, EXPECTED_STATIC_COMMAND_DISPOSITIONS)
  ensureFrozenRoutes("generated command", manifest.generatedCommands, EXPECTED_GENERATED_COMMAND_DISPOSITIONS)
  ensureNoBuiltInAgentNames(manifest.agents)
  ensureNoDuplicateOutputNames(manifest)
  ensureCanonicalSourcePaths(manifest)
  ensureSingleFrontDoor(manifest.agents)
  ensureCrossReferences(manifest)
  if (manifest.marketplace.id !== "grant-vine" || manifest.plugin.id !== "wunderkind") throw new CodexCapabilityValidationError("Expected frozen marketplace and plugin IDs")
  if (manifest.lazyCodex.pluginId !== "omo@sisyphuslabs" || manifest.lazyCodex.versionRange !== ">=4.19.4 <5") throw new CodexCapabilityValidationError("Expected frozen LazyCodex requirement")
  ensureExactIds("deferred capability", manifest.deferredCapabilities, ["codex-prompt-token-optimization-revisit", "no-token-audit-port"])
  ensureExactIds("optional Matt skill", manifest.optionalCompanions.mattSkills, ["grill-me", "grill-with-docs", "improve-codebase-architecture", "tdd", "triage", "to-spec", "to-tickets", "domain-modeling"])
  ensureExactIds("optional skill pack", manifest.optionalCompanions.skillPacks, ["supabase/agent-skills", "vercel-labs/agent-skills"])
  ensureExactIds("optional Supabase skill", manifest.optionalCompanions.supabaseSkills, ["supabase", "supabase-postgres-best-practices"])
  ensureExactIds("optional plugin", manifest.optionalCompanions.plugins, ["github@openai-curated", "figma@openai-curated", "vercel@openai-curated", "sentry@openai-curated", "codex-security@openai-curated", "posthog@openai-curated", "mixpanel@openai-curated"])
}

function ensureExactIds(label: string, actual: readonly string[], expected: readonly string[]): void {
  if (new Set(actual).size !== actual.length) throw new CodexCapabilityValidationError(`Duplicate ${label} ID`)
  if (actual.length !== expected.length || actual.some((id) => !expected.includes(id))) throw new CodexCapabilityValidationError(`Unclassified or missing ${label}`)
}

function ensureNoBuiltInAgentNames(agents: readonly CodexAgentSource[]): void {
  if (agents.some((agent) => BUILT_IN_AGENT_NAMES.has(agent.id))) throw new CodexCapabilityValidationError("Codex agent conflicts with a built-in name")
}

function ensureNoDuplicateOutputNames(manifest: CodexCapabilityManifest): void {
  const outputNames = [...manifest.agents.map((agent) => agent.id), ...manifest.skills.map((skill) => skill.id)]
  const sourcePaths = [...manifest.agents.map((agent) => agent.sourcePath), ...manifest.skills.map((skill) => skill.sourcePath)]
  if (new Set(outputNames).size !== outputNames.length || new Set(sourcePaths).size !== sourcePaths.length) throw new CodexCapabilityValidationError("Duplicate Codex output name or source path")
}

function ensureFrozenRoutes(
  label: string,
  actual: readonly { readonly id: string; readonly disposition: string; readonly target: string }[],
  expected: readonly { readonly id: string; readonly disposition: string; readonly target: string }[],
): void {
  if (actual.some((entry) => !expected.some((frozen) => frozen.id === entry.id && frozen.disposition === entry.disposition && frozen.target === entry.target))) throw new CodexCapabilityValidationError(`Changed frozen ${label} disposition`)
}

function ensureCanonicalSourcePaths(manifest: CodexCapabilityManifest): void {
  if (manifest.agents.some((agent) => agent.sourcePath !== `codex-src/agents/${agent.id}.md`)) throw new CodexCapabilityValidationError("Agent source path differs from frozen convention")
  if (manifest.skills.some((skill) => skill.sourcePath !== `codex-src/skills/${skill.id}/SKILL.md`)) throw new CodexCapabilityValidationError("Skill source path differs from frozen convention")
}

function ensureSingleFrontDoor(agents: readonly CodexAgentSource[]): void {
  if (agents.filter((agent) => agent.frontDoor).length !== 1 || !agents.some((agent) => agent.id === "wunderkind-product" && agent.frontDoor)) throw new CodexCapabilityValidationError("Expected wunderkind-product as the sole front door")
}

function ensureCrossReferences(manifest: CodexCapabilityManifest): void {
  const agentIds = new Set(manifest.agents.map((agent) => agent.id))
  const skillIds = new Set(manifest.skills.map((skill) => skill.id))
  if (manifest.skills.some((skill) => !agentIds.has(skill.ownerAgentId))) throw new CodexCapabilityValidationError("Skill references an unknown agent")
  if (manifest.legacySkills.some((skill) => skill.disposition === "shipped-skill" && !skillIds.has(skill.target))) throw new CodexCapabilityValidationError("Legacy skill references an unknown Codex skill")
  if (manifest.staticCommands.some((command) => command.disposition === "adapted-skill" && !skillIds.has(command.target))) throw new CodexCapabilityValidationError("Static command references an unknown Codex skill")
  if (manifest.staticCommands.some((command) => command.disposition === "specialist-agent" && !agentIds.has(command.target))) throw new CodexCapabilityValidationError("Static command references an unknown Codex agent")
}
