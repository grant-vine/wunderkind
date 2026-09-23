import { MemoryLedgerError } from "./errors.js"
import type { MemoryLedger } from "./ledger.js"
import type { CaptureDisposition } from "./providers.js"
import type { RelevantFact } from "./types.js"

export const MEMORY_CONTEXT_SENTINEL = "<!-- wunderkind:memory-context-start -->"

export interface MemoryContextConfig {
  readonly enabled: boolean
  readonly byteBudget: number
  readonly maximumAgeMs: number
  readonly maxResults?: number
  readonly summaryThresholdBytes?: number
  readonly now?: () => number
}

export interface ContextUnit {
  readonly factId: string
  readonly sourceEventIds: readonly string[]
  readonly sensitivity: "public" | "internal"
  readonly acceptedAt: number
  readonly score: number
  readonly disposition: Exclude<CaptureDisposition, "omit">
  readonly content: string
}

export interface MemoryContextCompileResult {
  readonly section: string | null
  readonly units: readonly ContextUnit[]
  readonly omitted: {
    readonly sensitive: number
    readonly stale: number
    readonly overBudget: number
    readonly irrelevant: number
    readonly unsafe: number
  }
}

export interface MemoryContextCompileInput {
  readonly ledger: MemoryLedger
  readonly query: string
  readonly config: MemoryContextConfig
}

const CONTEXT_HEADING = "## Wunderkind Memory Context"
const DEFAULT_MAX_RESULTS = 20
const DEFAULT_SUMMARY_THRESHOLD_BYTES = 512
const INSTRUCTION_LIKE_FACT_PATTERN = /\b(ignore|disregard|override)\b.{0,80}\b(instruction|system|previous)\b|\b(exfiltrate|reveal|leak)\b.{0,80}\b(secret|token|credential)s?\b/iu

function assertPositiveSafeInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryLedgerError("validation")
  }
  return value
}

function normalizeQuery(query: string): string {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized === "") {
    throw new MemoryLedgerError("validation")
  }
  return normalized
}

function queryTokens(query: string): readonly string[] {
  return [...new Set(query.split(/\s+/u).filter((token) => token !== ""))]
}

function occurrenceCount(content: string, term: string): number {
  let count = 0
  let position = 0
  while (true) {
    const next = content.indexOf(term, position)
    if (next === -1) return count
    count += 1
    position = next + term.length
  }
}

function relevanceScore(relevant: RelevantFact, query: string): number {
  const corpus = `${relevant.fact.subject} ${relevant.fact.predicate} ${relevant.fact.value}`.toLocaleLowerCase()
  const phraseScore = corpus.includes(query) ? 100 : 0
  const tokenScore = queryTokens(query).reduce((total, token) => total + occurrenceCount(corpus, token), 0)
  return phraseScore + tokenScore
}

function compareScoredFacts(
  left: { readonly relevant: RelevantFact; readonly score: number },
  right: { readonly relevant: RelevantFact; readonly score: number },
): number {
  const scoreDifference = right.score - left.score
  if (scoreDifference !== 0) return scoreDifference
  const acceptedDifference = right.relevant.fact.acceptedAt - left.relevant.fact.acceptedAt
  if (acceptedDifference !== 0) return acceptedDifference
  return left.relevant.fact.id.localeCompare(right.relevant.fact.id)
}

function fullContextLine(relevant: RelevantFact): string {
  return `- ${relevant.fact.subject} ${relevant.fact.predicate}: ${relevant.fact.value} (fact: ${relevant.fact.id}; source: ${relevant.sourceEventIds.join(", ")}; acceptedAt: ${new Date(relevant.fact.acceptedAt).toISOString()})`
}

function summaryContextLine(relevant: RelevantFact): string {
  return `- ${relevant.fact.subject} ${relevant.fact.predicate}: ${relevant.fact.value} (source: ${relevant.sourceEventIds.join(", ")})`
}

function selectContextDisposition(relevant: RelevantFact, summaryThresholdBytes: number): Exclude<CaptureDisposition, "omit"> {
  return Buffer.byteLength(fullContextLine(relevant), "utf8") > summaryThresholdBytes ? "summary" : "full"
}

function createSection(lines: readonly string[]): string {
  return [MEMORY_CONTEXT_SENTINEL, CONTEXT_HEADING, ...lines].join("\n")
}

function isInstructionLikeFact(relevant: RelevantFact): boolean {
  return INSTRUCTION_LIKE_FACT_PATTERN.test(
    `${relevant.fact.subject} ${relevant.fact.predicate} ${relevant.fact.value}`,
  )
}

export function compileMemoryContextSection(input: MemoryContextCompileInput): MemoryContextCompileResult {
  if (!input.config.enabled) {
    return {
      section: null,
      units: [],
      omitted: { sensitive: 0, stale: 0, overBudget: 0, irrelevant: 0, unsafe: 0 },
    }
  }

  const query = normalizeQuery(input.query)
  const byteBudget = assertPositiveSafeInteger(input.config.byteBudget)
  const maximumAgeMs = assertPositiveSafeInteger(input.config.maximumAgeMs)
  const maxResults = assertPositiveSafeInteger(input.config.maxResults ?? DEFAULT_MAX_RESULTS)
  const summaryThresholdBytes = assertPositiveSafeInteger(input.config.summaryThresholdBytes ?? DEFAULT_SUMMARY_THRESHOLD_BYTES)
  const now = input.config.now ?? Date.now
  const relevantFacts = input.ledger.findRelevantFacts({ query, unbounded: true })

  let sensitive = 0
  let stale = 0
  let overBudget = 0
  let irrelevant = 0
  let unsafe = 0
  const units: ContextUnit[] = []
  const eligibleFacts: { readonly relevant: RelevantFact; readonly score: number }[] = []

  for (const relevant of relevantFacts) {
    const score = relevanceScore(relevant, query)
    if (score === 0) {
      irrelevant += 1
      continue
    }
    if (relevant.fact.sensitivity === "sensitive") {
      sensitive += 1
      continue
    }
    if (isInstructionLikeFact(relevant)) {
      unsafe += 1
      continue
    }
    if (now() - relevant.fact.acceptedAt > maximumAgeMs) {
      stale += 1
      continue
    }

    eligibleFacts.push({ relevant, score })
  }

  eligibleFacts.sort(compareScoredFacts)

  for (const { relevant, score } of eligibleFacts.slice(0, maxResults)) {

    const disposition = selectContextDisposition(relevant, summaryThresholdBytes)
    const content = disposition === "full" ? fullContextLine(relevant) : summaryContextLine(relevant)
    const candidateSection = createSection([...units.map((unit) => unit.content), content])
    if (Buffer.byteLength(candidateSection, "utf8") > byteBudget) {
      overBudget += 1
      continue
    }
    units.push({
      factId: relevant.fact.id,
      sourceEventIds: relevant.sourceEventIds,
      sensitivity: relevant.fact.sensitivity === "public" ? "public" : "internal",
      acceptedAt: relevant.fact.acceptedAt,
      score,
      disposition,
      content,
    })
  }

  if (units.length === 0) {
    return {
      section: null,
      units,
      omitted: { sensitive, stale, overBudget, irrelevant, unsafe },
    }
  }

  return {
    section: createSection(units.map((unit) => unit.content)),
    units,
    omitted: { sensitive, stale, overBudget, irrelevant, unsafe },
  }
}

export function mergeMemoryContextSection(
  existingSections: readonly string[],
  compiled: MemoryContextCompileResult,
): readonly string[] {
  return compiled.section === null ? [...existingSections] : [...existingSections, compiled.section]
}
