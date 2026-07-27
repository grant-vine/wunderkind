import { z } from "zod"
import {
  analyzeV4UserPromptMutability,
  getV4UserPromptPassthroughReason,
  type V4UserPromptMutabilityAnalysis,
} from "./runtime-user-prompt-optimization-detectors.js"
import type { PromptOptimizationV4PassthroughReasonId } from "./cli/prompt-runtime-contract.js"
import type { PromptOptimizationMode } from "./cli/types.js"

export {
  analyzeV4UserPromptMutability,
  getV4UserPromptPassthroughReason,
  type V4UserPromptMutabilityAnalysis,
  type V4UserPromptOptimizationSegment,
} from "./runtime-user-prompt-optimization-detectors.js"

const MESSAGE_PART_SCHEMA = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough()

const MESSAGE_SCHEMA = z
  .object({
    role: z.string(),
    content: z.union([z.string(), z.array(MESSAGE_PART_SCHEMA)]),
  })
  .passthrough()

const V4_USER_PROMPT_OPTIMIZATION_SURFACE_INPUT_SCHEMA = z
  .object({
    messages: z.array(MESSAGE_SCHEMA).default([]),
    retainedHistory: z.array(z.string()).default([]),
    transcriptWideCompaction: z.array(z.string()).default([]),
    soulOverlays: z.array(z.string()).default([]),
    runtimeOwnedTrimSurfaces: z.array(z.string()).default([]),
  })
  .passthrough()

const V4_USER_PROMPT_OPTIMIZATION_EXCLUDED_SURFACE_IDS = [
  "earlier-user-messages",
  "retained-history",
  "transcript-wide-compaction",
  "soul-overlays",
  "runtime-owned-trim-surfaces",
] as const

type V4UserPromptOptimizationMessage = z.infer<typeof MESSAGE_SCHEMA>

export interface V4UserPromptOptimizationSurface {
  readonly target: "latest-user-message-only"
  readonly latestUserMessage: string | null
  readonly latestUserMessageAnalysis: V4UserPromptMutabilityAnalysis | null
  readonly latestUserMessagePassthroughReason: PromptOptimizationV4PassthroughReasonId | null
  readonly latestUserMessageOptimizationMeasurement: V4UserPromptOptimizationMeasurement | null
  readonly combinedUserHistory: string
  readonly earlierUserMessages: readonly string[]
  readonly retainedHistory: readonly string[]
  readonly transcriptWideCompaction: readonly string[]
  readonly soulOverlays: readonly string[]
  readonly runtimeOwnedTrimSurfaces: readonly string[]
  readonly excludedSurfaceIds: readonly (typeof V4_USER_PROMPT_OPTIMIZATION_EXCLUDED_SURFACE_IDS)[number][]
}

export interface V4UserPromptOptimizationMeasurement {
  readonly beforeMessage: string
  readonly afterMessage: string
  readonly beforeBytes: number
  readonly afterBytes: number
  readonly savedBytes: number
  readonly trimApplied: boolean
}

export interface V4UserPromptOptimizationOptions {
  readonly promptOptimizationEnabled?: boolean | undefined
  readonly promptOptimizationMode?: PromptOptimizationMode | undefined
}

type UnknownRecord = Record<string, unknown>

function normalizeStringList(values: readonly string[]): readonly string[] {
  return values.filter((value) => value.trim() !== "")
}

function normalizeMessageContent(content: V4UserPromptOptimizationMessage["content"]): string {
  if (typeof content === "string") {
    return content
  }

  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function findLatestUserMessageIndex(messages: readonly V4UserPromptOptimizationMessage[]): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === "user" && normalizeMessageContent(message.content).trim() !== "") {
      return index
    }
  }

  return null
}

function shouldMeasureV4UserPromptOptimization(options: V4UserPromptOptimizationOptions): boolean {
  return options.promptOptimizationEnabled !== false && options.promptOptimizationMode === "active"
}

function splitTrailingNewline(text: string): { readonly body: string; readonly trailingNewline: string } {
  return text.endsWith("\n")
    ? { body: text.slice(0, -1), trailingNewline: "\n" }
    : { body: text, trailingNewline: "" }
}

function normalizeWhitespaceOnlyOptimization(text: string): string {
  const { body, trailingNewline } = splitTrailingNewline(text)
  return `${body.replace(/\s+/g, " ").trim()}${trailingNewline}`
}

function dedupeRepeatedSentenceOptimization(text: string): string {
  const { body, trailingNewline } = splitTrailingNewline(text)
  const dedupedSentences = body
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "")
    .filter((sentence, index, sentences) => sentences.indexOf(sentence) === index)

  return `${dedupedSentences.join(" ")}${trailingNewline}`
}

function optimizeAllowlistedSegment(
  segment: Extract<V4UserPromptMutabilityAnalysis["segments"][number], { kind: "mutable-allowlist" }>,
): string {
  switch (segment.ruleId) {
    case "allowlist-plain-natural-language-filler":
      return normalizeWhitespaceOnlyOptimization(segment.text)
    case "allowlist-repetitive-natural-language-prose":
      return dedupeRepeatedSentenceOptimization(segment.text)
  }
}

function buildV4OptimizedLatestUserMessage(analysis: V4UserPromptMutabilityAnalysis): string {
  return analysis.segments
    .map((segment) =>
      segment.kind === "mutable-allowlist" ? optimizeAllowlistedSegment(segment) : segment.text,
    )
    .join("")
}

function createV4UserPromptOptimizationMeasurement(
  beforeMessage: string,
  afterMessage: string,
): V4UserPromptOptimizationMeasurement {
  const beforeBytes = Buffer.byteLength(beforeMessage, "utf8")
  const afterBytes = Buffer.byteLength(afterMessage, "utf8")

  return {
    beforeMessage,
    afterMessage,
    beforeBytes,
    afterBytes,
    savedBytes: Math.max(0, beforeBytes - afterBytes),
    trimApplied: afterBytes < beforeBytes,
  }
}

function applyOptimizedLatestUserMessageToInput(options: {
  readonly input: unknown
  readonly parsedMessages: readonly V4UserPromptOptimizationMessage[]
  readonly latestUserMessageIndex: number
  readonly optimizedMessage: string
}): boolean {
  if (!isRecord(options.input)) {
    return false
  }

  const latestMessage = options.parsedMessages[options.latestUserMessageIndex]
  if (!latestMessage) {
    return false
  }

  const updatedMessages = [...options.parsedMessages]

  if (typeof latestMessage.content === "string") {
    updatedMessages[options.latestUserMessageIndex] = {
      ...latestMessage,
      content: options.optimizedMessage,
    }
    options.input["messages"] = updatedMessages
    return true
  }

  const firstPart = latestMessage.content[0]
  if (latestMessage.content.length !== 1 || firstPart?.type !== "text") {
    return false
  }

  updatedMessages[options.latestUserMessageIndex] = {
    ...latestMessage,
    content: [{ ...firstPart, text: options.optimizedMessage }],
  }
  options.input["messages"] = updatedMessages
  return true
}

function collectUserMessages(messages: readonly V4UserPromptOptimizationMessage[]): readonly string[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeMessageContent(message.content))
    .filter((message) => message.trim() !== "")
}

export function createEmptyV4UserPromptOptimizationSurface(): V4UserPromptOptimizationSurface {
  return {
    target: "latest-user-message-only",
    latestUserMessage: null,
    latestUserMessageAnalysis: null,
    latestUserMessagePassthroughReason: null,
    latestUserMessageOptimizationMeasurement: null,
    combinedUserHistory: "",
    earlierUserMessages: [],
    retainedHistory: [],
    transcriptWideCompaction: [],
    soulOverlays: [],
    runtimeOwnedTrimSurfaces: [],
    excludedSurfaceIds: [...V4_USER_PROMPT_OPTIMIZATION_EXCLUDED_SURFACE_IDS],
  }
}

export function buildV4UserPromptOptimizationSurface(
  input: unknown,
  options: V4UserPromptOptimizationOptions = {},
): V4UserPromptOptimizationSurface {
  const parsed = V4_USER_PROMPT_OPTIMIZATION_SURFACE_INPUT_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return createEmptyV4UserPromptOptimizationSurface()
  }

  const userMessages = collectUserMessages(parsed.data.messages)
  const latestUserMessageIndex = findLatestUserMessageIndex(parsed.data.messages)
  const latestUserMessageEntry =
    latestUserMessageIndex === null ? null : (parsed.data.messages[latestUserMessageIndex] ?? null)
  const latestUserMessage = latestUserMessageEntry === null
    ? null
    : normalizeMessageContent(latestUserMessageEntry.content)
  const latestUserMessageAnalysis = latestUserMessage === null ? null : analyzeV4UserPromptMutability(latestUserMessage)
  const latestUserMessagePassthroughReason =
    latestUserMessageAnalysis === null ? null : getV4UserPromptPassthroughReason(latestUserMessageAnalysis)
  const shouldMeasureOptimization = latestUserMessage !== null && shouldMeasureV4UserPromptOptimization(options)
  let latestUserMessageOptimizationMeasurement: V4UserPromptOptimizationMeasurement | null = null

  if (latestUserMessage !== null && shouldMeasureOptimization) {
    if (latestUserMessagePassthroughReason !== null || latestUserMessageAnalysis === null) {
      latestUserMessageOptimizationMeasurement = createV4UserPromptOptimizationMeasurement(
        latestUserMessage,
        latestUserMessage,
      )
    } else {
      const optimizedLatestUserMessage = buildV4OptimizedLatestUserMessage(latestUserMessageAnalysis)
      if (
        optimizedLatestUserMessage !== latestUserMessage
        && latestUserMessageIndex !== null
        && applyOptimizedLatestUserMessageToInput({
          input,
          parsedMessages: parsed.data.messages,
          latestUserMessageIndex,
          optimizedMessage: optimizedLatestUserMessage,
        })
      ) {
        latestUserMessageOptimizationMeasurement = createV4UserPromptOptimizationMeasurement(
          latestUserMessage,
          optimizedLatestUserMessage,
        )
      } else {
        latestUserMessageOptimizationMeasurement = createV4UserPromptOptimizationMeasurement(
          latestUserMessage,
          latestUserMessage,
        )
      }
    }
  }

  return {
    target: "latest-user-message-only",
    latestUserMessage,
    latestUserMessageAnalysis,
    latestUserMessagePassthroughReason,
    latestUserMessageOptimizationMeasurement,
    combinedUserHistory: userMessages.join("\n\n"),
    earlierUserMessages: userMessages.slice(0, -1),
    retainedHistory: normalizeStringList(parsed.data.retainedHistory),
    transcriptWideCompaction: normalizeStringList(parsed.data.transcriptWideCompaction),
    soulOverlays: normalizeStringList(parsed.data.soulOverlays),
    runtimeOwnedTrimSurfaces: normalizeStringList(parsed.data.runtimeOwnedTrimSurfaces),
    excludedSurfaceIds: [...V4_USER_PROMPT_OPTIMIZATION_EXCLUDED_SURFACE_IDS],
  }
}
