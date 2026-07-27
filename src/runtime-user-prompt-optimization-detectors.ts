import type {
  PromptOptimizationV4ImmutableContentRuleId,
  PromptOptimizationV4MutableAllowlistRuleId,
  PromptOptimizationV4PassthroughReasonId,
} from "./cli/prompt-runtime-contract.js"

const FENCED_CODE_BLOCK_REGEX = /```[\s\S]*?```/g
const INLINE_CODE_REGEX = /`[^`\n]+`/g
const URL_LINE_REGEX = /\bhttps?:\/\/[^\s<>"')\]]+/i
const FILE_PATH_LINE_REGEX =
  /(?:\.{1,2}\/|~\/|\/(?:[^\s"'`<>]+)|(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+)/
const COMMAND_LINE_REGEX =
  /^\s*(?:[$>#]\s*)?(?:bun|npm|npx|pnpm|node|python|pytest|tsc|git|gh|ls|mkdir|rm|cp|mv|perl|grep|bash|sh)\b/
const EXPLICIT_REQUIREMENT_LINE_REGEX =
  /\b(?:MUST(?:\s+NOT)?|DO\s+NOT|REQUIRED(?:\s+TOOLS)?|EXPECTED\s+OUTCOME|TASK)\b/i
const COMPLIANCE_LEGAL_SECURITY_LINE_REGEX =
  /\b(?:GDPR|POPIA|CCPA|CPRA|LGPD|PIPEDA|PDPA|OWASP|security|compliance|legal|privacy|credential|secret|token|vulnerability|breach|incident|auth(?:entication|orization)?)\b/i
const QUOTED_USER_TEXT_LINE_REGEX = /"[^"\n]+"|'[^'\n]+'|^\s*>\s+/m
const NATURAL_LANGUAGE_LINE_REGEX = /^[A-Za-z][A-Za-z0-9,.;:!?()\- ]+[.!?]\n?$/
const WORD_REGEX = /[A-Za-z]+/g
const LINE_REGEX = /.*(?:\n|$)/g

type V4UserPromptOptimizationSegmentBase = {
  readonly start: number
  readonly end: number
  readonly text: string
}

type V4UserPromptOptimizationImmutableSegment = V4UserPromptOptimizationSegmentBase & {
  readonly kind: "immutable"
  readonly ruleId: PromptOptimizationV4ImmutableContentRuleId
}

type V4UserPromptOptimizationMutableAllowlistSegment = V4UserPromptOptimizationSegmentBase & {
  readonly kind: "mutable-allowlist"
  readonly ruleId: PromptOptimizationV4MutableAllowlistRuleId
}

type V4UserPromptOptimizationImmutableUnclassifiedSegment = V4UserPromptOptimizationSegmentBase & {
  readonly kind: "immutable-unclassified"
  readonly ruleId: null
}

export type V4UserPromptOptimizationSegment =
  | V4UserPromptOptimizationImmutableSegment
  | V4UserPromptOptimizationMutableAllowlistSegment
  | V4UserPromptOptimizationImmutableUnclassifiedSegment

export interface V4UserPromptMutabilityAnalysis {
  readonly segments: readonly V4UserPromptOptimizationSegment[]
  readonly reconstructedMessage: string
  readonly immutableRuleIds: readonly PromptOptimizationV4ImmutableContentRuleId[]
  readonly mutableAllowlistRuleIds: readonly PromptOptimizationV4MutableAllowlistRuleId[]
}

const COMMAND_OR_PATH_IMMUTABLE_RULE_IDS = [
  "immutable-command",
  "immutable-file-path",
  "immutable-url",
] as const satisfies readonly PromptOptimizationV4ImmutableContentRuleId[]

type ImmutableCandidateSpan = {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly ruleId: PromptOptimizationV4ImmutableContentRuleId
}

function countWords(value: string): number {
  return value.match(WORD_REGEX)?.length ?? 0
}

function hasRepeatedSentence(value: string): boolean {
  const sentences = value
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence !== "")

  return new Set(sentences).size < sentences.length
}

function classifyAllowlistRule(line: string): PromptOptimizationV4MutableAllowlistRuleId | null {
  const trimmedLine = line.trim()
  if (!NATURAL_LANGUAGE_LINE_REGEX.test(line) || countWords(trimmedLine) < 5) {
    return null
  }

  if (hasRepeatedSentence(trimmedLine)) {
    return "allowlist-repetitive-natural-language-prose"
  }

  return "allowlist-plain-natural-language-filler"
}

function classifyImmutableLineRule(line: string): PromptOptimizationV4ImmutableContentRuleId | null {
  if (COMMAND_LINE_REGEX.test(line)) {
    return "immutable-command"
  }

  if (EXPLICIT_REQUIREMENT_LINE_REGEX.test(line)) {
    return "immutable-explicit-requirement"
  }

  if (COMPLIANCE_LEGAL_SECURITY_LINE_REGEX.test(line)) {
    return "immutable-compliance-legal-security"
  }

  if (QUOTED_USER_TEXT_LINE_REGEX.test(line)) {
    return "immutable-quoted-user-text"
  }

  if (URL_LINE_REGEX.test(line)) {
    return "immutable-url"
  }

  if (FILE_PATH_LINE_REGEX.test(line)) {
    return "immutable-file-path"
  }

  return null
}

function collectRegexMatches(
  message: string,
  regex: RegExp,
  ruleId: PromptOptimizationV4ImmutableContentRuleId,
): readonly ImmutableCandidateSpan[] {
  const spans: ImmutableCandidateSpan[] = []

  for (const match of message.matchAll(regex)) {
    const matchedText = match[0]
    const start = match.index
    if (typeof start !== "number" || matchedText === "") {
      continue
    }

    spans.push({ start, end: start + matchedText.length, text: matchedText, ruleId })
  }

  return spans
}

function collectCodeSpans(message: string): readonly ImmutableCandidateSpan[] {
  const candidates = [
    ...collectRegexMatches(message, FENCED_CODE_BLOCK_REGEX, "immutable-code-block"),
    ...collectRegexMatches(message, INLINE_CODE_REGEX, "immutable-code-block"),
  ].sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start
    }

    return right.end - right.start - (left.end - left.start)
  })

  const spans: ImmutableCandidateSpan[] = []
  let cursor = 0

  for (const candidate of candidates) {
    if (candidate.start < cursor) {
      continue
    }

    spans.push(candidate)
    cursor = candidate.end
  }

  return spans
}

function appendLineSegments(
  segments: V4UserPromptOptimizationSegment[],
  text: string,
  baseStart: number,
): void {
  for (const match of text.matchAll(LINE_REGEX)) {
    const lineText = match[0]
    const index = match.index
    if (typeof index !== "number" || lineText === "") {
      continue
    }

    const start = baseStart + index
    const end = start + lineText.length
    const immutableRule = classifyImmutableLineRule(lineText)
    if (immutableRule !== null) {
      segments.push({ kind: "immutable", ruleId: immutableRule, start, end, text: lineText })
      continue
    }

    const mutableRule = classifyAllowlistRule(lineText)
    if (mutableRule !== null) {
      segments.push({ kind: "mutable-allowlist", ruleId: mutableRule, start, end, text: lineText })
      continue
    }

    segments.push({ kind: "immutable-unclassified", ruleId: null, start, end, text: lineText })
  }
}

export function analyzeV4UserPromptMutability(message: string): V4UserPromptMutabilityAnalysis {
  const codeSpans = collectCodeSpans(message)
  const segments: V4UserPromptOptimizationSegment[] = []
  let cursor = 0

  for (const span of codeSpans) {
    if (cursor < span.start) {
      appendLineSegments(segments, message.slice(cursor, span.start), cursor)
    }

    segments.push({
      kind: "immutable",
      ruleId: span.ruleId,
      start: span.start,
      end: span.end,
      text: span.text,
    })
    cursor = span.end
  }

  if (cursor < message.length) {
    appendLineSegments(segments, message.slice(cursor), cursor)
  }

  return {
    segments,
    reconstructedMessage: segments.map((segment) => segment.text).join(""),
    immutableRuleIds: [...new Set(segments.flatMap((segment) => segment.kind === "immutable" ? [segment.ruleId] : []))],
    mutableAllowlistRuleIds: [
      ...new Set(
        segments.flatMap((segment) =>
          segment.kind === "mutable-allowlist" ? [segment.ruleId] : [],
        ),
      ),
    ],
  }
}

export function getV4UserPromptPassthroughReason(
  analysis: V4UserPromptMutabilityAnalysis,
): PromptOptimizationV4PassthroughReasonId | null {
  if (analysis.immutableRuleIds.includes("immutable-code-block")) {
    return "v4-safety-code-block"
  }

  if (COMMAND_OR_PATH_IMMUTABLE_RULE_IDS.some((ruleId) => analysis.immutableRuleIds.includes(ruleId))) {
    return "v4-safety-command-or-path"
  }

  if (analysis.immutableRuleIds.includes("immutable-explicit-requirement")) {
    return "v4-safety-explicit-requirement"
  }

  if (analysis.immutableRuleIds.includes("immutable-compliance-legal-security")) {
    return "v4-safety-compliance-legal-security"
  }

  if (analysis.immutableRuleIds.includes("immutable-quoted-user-text")) {
    return "v4-safety-quoted-user-text"
  }

  if (analysis.mutableAllowlistRuleIds.length === 0) {
    return "v4-low-confidence-no-allowlist-match"
  }

  return analysis.segments.some((segment) => segment.kind === "immutable-unclassified")
    ? "v4-low-confidence-mixed-immutable-content"
    : null
}
