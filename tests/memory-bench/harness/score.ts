import type { TestCase } from "../generators/story-generator.js"

export interface ScoringBucket {
  total: number
  exactMatchPct: number
  meanF1: number
}

export interface BenchmarkMetrics {
  weak_seed_hit_at_1: number
  graph_weak_seed_hit_at_1: number | null
  gold_in_expanded_neighborhood: number | null
  chain_hit_at_3: number
  supersede_win_rate: number
  wrong_agent_leakage_rate: number
}

export interface RankedRetrievalCase {
  expectedEntryId: string
  resultEntryIds: string[]
}

export interface GraphNeighborhoodCase {
  goldInExpandedNeighborhood: boolean
}

export interface SupersedeCase {
  olderEntryId: string
  newerEntryId: string
  resultEntryIds: string[]
}

export interface WrongAgentLeakageCase {
  wrongEntryIds: string[]
  resultEntryIds: string[]
}

export interface BenchmarkMetricsInput {
  weakSeedHitAt1Cases: RankedRetrievalCase[]
  graphWeakSeedHitAt1Cases: RankedRetrievalCase[] | null
  goldInExpandedNeighborhoodCases: GraphNeighborhoodCase[] | null
  chainHitAt3Cases: RankedRetrievalCase[]
  supersedeCases: SupersedeCase[]
  wrongAgentLeakageCases: WrongAgentLeakageCase[]
}

export interface ScoringReport {
  overall: ScoringBucket
  byType: Record<TestCase["type"], ScoringBucket>
  benchmarkMetrics: BenchmarkMetrics
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
}

function tokenize(text: string): string[] {
  const matches = normalize(text).match(/[\p{L}\p{N}]+/gu)
  return matches ?? []
}

function bucket(total: number, exactMatches: number, f1Total: number): ScoringBucket {
  if (total === 0) {
    return { total: 0, exactMatchPct: 0, meanF1: 0 }
  }

  return {
    total,
    exactMatchPct: (exactMatches / total) * 100,
    meanF1: f1Total / total,
  }
}

function ratio(matches: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return matches / total
}

function isHitWithin(resultEntryIds: readonly string[], expectedEntryId: string, limit: number): boolean {
  const bounded = Math.min(limit, resultEntryIds.length)
  for (let index = 0; index < bounded; index += 1) {
    if (resultEntryIds[index] === expectedEntryId) {
      return true
    }
  }

  return false
}

function rankOf(resultEntryIds: readonly string[], entryId: string): number {
  const index = resultEntryIds.indexOf(entryId)
  return index === -1 ? Number.POSITIVE_INFINITY : index
}

export function emptyBenchmarkMetrics(): BenchmarkMetrics {
  return {
    weak_seed_hit_at_1: 0,
    graph_weak_seed_hit_at_1: null,
    gold_in_expanded_neighborhood: null,
    chain_hit_at_3: 0,
    supersede_win_rate: 0,
    wrong_agent_leakage_rate: 0,
  }
}

export function scoreBenchmarkMetrics(input: BenchmarkMetricsInput): BenchmarkMetrics {
  const weakSeedHits = input.weakSeedHitAt1Cases.filter((item) => isHitWithin(item.resultEntryIds, item.expectedEntryId, 1)).length
  const graphWeakSeedHits = input.graphWeakSeedHitAt1Cases?.filter((item) =>
    isHitWithin(item.resultEntryIds, item.expectedEntryId, 1),
  ).length
  const expandedNeighborhoodHits = input.goldInExpandedNeighborhoodCases?.filter(
    (item) => item.goldInExpandedNeighborhood,
  ).length
  const chainHits = input.chainHitAt3Cases.filter((item) => isHitWithin(item.resultEntryIds, item.expectedEntryId, 3)).length
  const supersedeWins = input.supersedeCases.filter((item) => rankOf(item.resultEntryIds, item.newerEntryId) < rankOf(item.resultEntryIds, item.olderEntryId)).length
  const leakageHits = input.wrongAgentLeakageCases.filter((item) =>
    item.resultEntryIds.some((resultEntryId) => item.wrongEntryIds.includes(resultEntryId)),
  ).length

  return {
    weak_seed_hit_at_1: ratio(weakSeedHits, input.weakSeedHitAt1Cases.length),
    graph_weak_seed_hit_at_1:
      input.graphWeakSeedHitAt1Cases === null ? null : ratio(graphWeakSeedHits ?? 0, input.graphWeakSeedHitAt1Cases.length),
    gold_in_expanded_neighborhood:
      input.goldInExpandedNeighborhoodCases === null
        ? null
        : ratio(expandedNeighborhoodHits ?? 0, input.goldInExpandedNeighborhoodCases.length),
    chain_hit_at_3: ratio(chainHits, input.chainHitAt3Cases.length),
    supersede_win_rate: ratio(supersedeWins, input.supersedeCases.length),
    wrong_agent_leakage_rate: ratio(leakageHits, input.wrongAgentLeakageCases.length),
  }
}

export function exactMatch(pred: string, ref: string): 0 | 1 {
  return normalize(pred) === normalize(ref) ? 1 : 0
}

export function tokenF1(pred: string, ref: string): number {
  const predTokens = tokenize(pred)
  const refTokens = tokenize(ref)

  if (predTokens.length === 0 && refTokens.length === 0) return 1
  if (predTokens.length === 0 || refTokens.length === 0) return 0

  const refCounts = new Map<string, number>()
  for (const token of refTokens) {
    refCounts.set(token, (refCounts.get(token) ?? 0) + 1)
  }

  let overlap = 0
  for (const token of predTokens) {
    const remaining = refCounts.get(token) ?? 0
    if (remaining > 0) {
      overlap += 1
      refCounts.set(token, remaining - 1)
    }
  }

  if (overlap === 0) return 0

  const precision = overlap / predTokens.length
  const recall = overlap / refTokens.length
  return (2 * precision * recall) / (precision + recall)
}

export function scoreResults(
  results: Array<{ testCase: TestCase; prediction: string }>,
  benchmarkMetrics: BenchmarkMetrics = emptyBenchmarkMetrics(),
): ScoringReport {
  const initialTypes: Record<TestCase["type"], { total: number; exactMatches: number; f1Total: number }> = {
    attribute: { total: 0, exactMatches: 0, f1Total: 0 },
    relationship: { total: 0, exactMatches: 0, f1Total: 0 },
    temporal: { total: 0, exactMatches: 0, f1Total: 0 },
    "knowledge-update": { total: 0, exactMatches: 0, f1Total: 0 },
    abstention: { total: 0, exactMatches: 0, f1Total: 0 },
    "multi-hop": { total: 0, exactMatches: 0, f1Total: 0 },
  }

  let overallExactMatches = 0
  let overallF1Total = 0

  for (const result of results) {
    const em = exactMatch(result.prediction, result.testCase.expectedAnswer)
    const f1 = tokenF1(result.prediction, result.testCase.expectedAnswer)
    const typeBucket = initialTypes[result.testCase.type]

    typeBucket.total += 1
    typeBucket.exactMatches += em
    typeBucket.f1Total += f1

    overallExactMatches += em
    overallF1Total += f1
  }

  return {
    overall: bucket(results.length, overallExactMatches, overallF1Total),
    byType: {
      attribute: bucket(initialTypes.attribute.total, initialTypes.attribute.exactMatches, initialTypes.attribute.f1Total),
      relationship: bucket(initialTypes.relationship.total, initialTypes.relationship.exactMatches, initialTypes.relationship.f1Total),
      temporal: bucket(initialTypes.temporal.total, initialTypes.temporal.exactMatches, initialTypes.temporal.f1Total),
      "knowledge-update": bucket(
        initialTypes["knowledge-update"].total,
        initialTypes["knowledge-update"].exactMatches,
        initialTypes["knowledge-update"].f1Total,
      ),
      abstention: bucket(initialTypes.abstention.total, initialTypes.abstention.exactMatches, initialTypes.abstention.f1Total),
      "multi-hop": bucket(initialTypes["multi-hop"].total, initialTypes["multi-hop"].exactMatches, initialTypes["multi-hop"].f1Total),
    },
    benchmarkMetrics,
  }
}
