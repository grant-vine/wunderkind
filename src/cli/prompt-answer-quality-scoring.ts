import type {
  PromptAnswerQualityCaseDefinition,
  PromptAnswerQualityCaseId,
  PromptAnswerQualityFacetExpectation,
  PromptAnswerQualityFacetId,
  PromptAnswerQualityFacetScore,
  PromptAnswerQualityRubricScore,
} from "./prompt-answer-quality-contract.js"

export function normalizePromptAnswerQualityText(value: string): string {
  return value.toLowerCase().replace(/[`*_>#-]/g, " ").replace(/\s+/g, " ").trim()
}

export function evaluatePromptAnswerQualityFacet(
  caseDefinition: PromptAnswerQualityCaseDefinition,
  facet: PromptAnswerQualityFacetExpectation,
  answer: string,
): PromptAnswerQualityFacetScore {
  const requiredLiterals = getRequiredLiterals(caseDefinition)

  switch (facet.facetId) {
    case "instruction-following": return buildFacetScore(facet.facetId, scoreInstructionFollowing(caseDefinition.caseId, answer), "instruction shape checked")
    case "constraint-preservation": return buildFacetScore(facet.facetId, scoreByRatio(countMatches(answer, requiredLiterals), requiredLiterals.length), "required literals checked")
    case "evidence-use": return buildFacetScore(facet.facetId, scoreEvidenceUse(caseDefinition.caseId, answer), "case evidence checked")
    case "actionability": return buildFacetScore(facet.facetId, scoreActionability(caseDefinition.caseId, answer), "actionability checked")
    default: return assertNever(facet.facetId)
  }
}

function scoreInstructionFollowing(caseId: PromptAnswerQualityCaseId, answer: string): PromptAnswerQualityRubricScore {
  const bullets = getBulletLines(answer)
  const normalized = normalizePromptAnswerQualityText(answer)

  switch (caseId) {
    case "answer-quality-latest-user-preserves-constraints":
      return bullets.length !== 2 ? 0 : scoreByChecks(!getNonEmptyLines(answer)[0]?.startsWith("- "), wordCount(answer) <= 90, true)
    case "answer-quality-runtime-tools-uses-noisy-output":
      return scoreByChecks(normalized.includes("summary:"), normalized.includes("likely cause:"), normalized.includes("rerun:"))
    case "answer-quality-contextual-synthesizes-selected-context":
      return scoreByChecks(bullets.length === 2, normalizePromptAnswerQualityText(bullets[0] ?? "").includes("preserved"), normalizePromptAnswerQualityText(bullets[1] ?? "").includes("compress"))
    case "answer-quality-transcript-reconciles-history":
      return scoreByChecks(bullets.length === 3, normalized.includes("latest request"), normalized.includes("protected history") && normalized.includes("compressible history"))
    default: return assertNever(caseId)
  }
}

function scoreEvidenceUse(caseId: PromptAnswerQualityCaseId, answer: string): PromptAnswerQualityRubricScore {
  const normalized = normalizePromptAnswerQualityText(answer)

  switch (caseId) {
    case "answer-quality-latest-user-preserves-constraints": return scoreByChecks(normalized.includes("latest user") || normalized.includes("latest-user"), normalized.includes("immutable") || normalized.includes("byte exact") || normalized.includes("preserve"), answer.includes("src/runtime-user-prompt-optimization.ts"))
    case "answer-quality-runtime-tools-uses-noisy-output": return scoreByChecks(normalized.includes("warning") || normalized.includes("retry"), normalized.includes("cache"), normalized.includes("signal") || normalized.includes("noise"))
    case "answer-quality-contextual-synthesizes-selected-context": return scoreByChecks(normalized.includes("repeated note"), normalized.includes("shrink") || normalized.includes("compress"), normalized.includes("preserve markers") || normalized.includes("protected"))
    case "answer-quality-transcript-reconciles-history": return scoreByChecks(normalized.includes("repeated summaries") || normalized.includes("repeated earlier diagnosis line"), normalized.includes("compressible"), normalized.includes("protected"))
    default: return assertNever(caseId)
  }
}

function scoreActionability(caseId: PromptAnswerQualityCaseId, answer: string): PromptAnswerQualityRubricScore {
  const normalized = normalizePromptAnswerQualityText(answer)

  switch (caseId) {
    case "answer-quality-latest-user-preserves-constraints": return scoreByChecks(getBulletLines(answer).length === 2, answer.includes("$ bun test tests/unit/prompt-optimization-level-fixture.test.ts"), normalized.includes("inspect") || normalized.includes("rerun") || normalized.includes("re run"))
    case "answer-quality-runtime-tools-uses-noisy-output": return scoreByChecks(answer.includes("$ bun test tests/unit/prompt-optimization-efficacy.test.ts"), normalized.includes("rerun"), normalized.includes("likely cause"))
    case "answer-quality-contextual-synthesizes-selected-context": return scoreByChecks(normalized.includes("preserve") && normalized.includes("compress"), normalized.includes("rule") || normalized.includes("exact"), getBulletLines(answer).length === 2)
    case "answer-quality-transcript-reconciles-history": return scoreByChecks(normalized.includes("practical preserve versus compress rule") || normalized.includes("practical preserve-versus-compress rule"), normalized.includes("preserving the latest request") || normalized.includes("preserving the latest request and protected literals"), getBulletLines(answer).length === 3)
    default: return assertNever(caseId)
  }
}

function getRequiredLiterals(caseDefinition: PromptAnswerQualityCaseDefinition): readonly string[] {
  const lines = readSurfaceLines(caseDefinition)

  switch (caseDefinition.caseId) {
    case "answer-quality-latest-user-preserves-constraints": return ["src/runtime-user-prompt-optimization.ts", "$ bun test tests/unit/prompt-optimization-level-fixture.test.ts", '"leave this exact text alone"', "src/cli/"]
    case "answer-quality-runtime-tools-uses-noisy-output": return compactStrings([findLine(lines, "Path: "), findUrl(lines), findCommand(lines)])
    case "answer-quality-contextual-synthesizes-selected-context": return compactStrings([findLine(lines, "<!-- wunderkind:selected-context-preserve-start -->"), findLine(lines, "<!-- wunderkind:selected-context-preserve-end -->"), findLine(lines, "Path: "), findCommand(lines), findUrl(lines)])
    case "answer-quality-transcript-reconciles-history": return compactStrings([caseDefinition.prompt.surfaces.latestUserMessage, findLine(lines, "Background task id: "), findLine(lines, "Quoted user example: "), findLine(lines, "Path: ")])
    default: return assertNever(caseDefinition.caseId)
  }
}

function buildFacetScore(facetId: PromptAnswerQualityFacetId, score: PromptAnswerQualityRubricScore, rationale: string): PromptAnswerQualityFacetScore { return { facetId, score, maxScore: 4, rationale } }
function readSurfaceLines(caseDefinition: PromptAnswerQualityCaseDefinition): readonly string[] { const surfaces = caseDefinition.prompt.surfaces; return [surfaces.latestUserMessage, ...surfaces.runtimeOwnedSections, ...surfaces.toolOutputs, ...surfaces.selectedContext, ...surfaces.retainedHistory, ...surfaces.transcriptWideCompaction].flatMap((surface) => surface.split("\n").map((line) => line.trim()).filter((line) => line !== "")) }
function getNonEmptyLines(answer: string): readonly string[] { return answer.split("\n").map((line) => line.trim()).filter((line) => line !== "") }
function getBulletLines(answer: string): readonly string[] { return getNonEmptyLines(answer).filter((line) => line.startsWith("- ") || line.startsWith("* ")) }
function wordCount(answer: string): number { return normalizePromptAnswerQualityText(answer).split(" ").filter((token) => token !== "").length }
function countMatches(answer: string, literals: readonly string[]): number { return literals.filter((literal) => answer.includes(literal)).length }
function findLine(lines: readonly string[], prefix: string): string | null { return lines.find((line) => line.startsWith(prefix)) ?? null }
function findCommand(lines: readonly string[]): string | null { return lines.find((line) => line.startsWith("$ ")) ?? null }
function findUrl(lines: readonly string[]): string | null { for (const line of lines) { const match = line.match(/https?:\/\/\S+/); if (match?.[0]) return match[0] } return null }
function compactStrings(values: readonly (string | null)[]): readonly string[] { return values.filter((value): value is string => value !== null) }
function scoreByChecks(...checks: readonly boolean[]): PromptAnswerQualityRubricScore { return scoreByRatio(checks.filter(Boolean).length, checks.length) }
function scoreByRatio(matches: number, total: number): PromptAnswerQualityRubricScore { return total === 0 ? 0 : matches === total ? 4 : matches / total >= 0.75 ? 3 : matches / total >= 0.5 ? 2 : matches > 0 ? 1 : 0 }
function assertNever(value: never): never { throw new Error(`Unexpected prompt answer quality value: ${String(value)}`) }
