import type { V4UserPromptOptimizationSurface } from "./runtime-user-prompt-optimization.js"

const PROTECTED_TRANSCRIPT_LINE_PATTERNS = [
  /^Path:\s/,
  /^File:\s/,
  /^\$\s/,
  /https?:\/\//,
  /\bbg_[a-z0-9]+\b/i,
  /\bses_[a-z0-9]+\b/i,
  /"[^"]+"/,
] as const

interface TranscriptChunkCompactionResult {
  readonly content: string
  readonly changed: boolean
  readonly hasProtectedContent: boolean
}

function isProtectedTranscriptLine(line: string): boolean {
  return PROTECTED_TRANSCRIPT_LINE_PATTERNS.some((pattern) => pattern.test(line))
}

function preserveTrailingNewline(content: string, optimizedContent: string): string {
  if (!content.endsWith("\n") || optimizedContent === "") {
    return optimizedContent
  }

  return `${optimizedContent}\n`
}

function compactTranscriptChunk(content: string): TranscriptChunkCompactionResult {
  if (content.trim() === "" || content.includes("\u0000")) {
    return {
      content,
      changed: false,
      hasProtectedContent: content.includes("\u0000"),
    }
  }

  const source = content.endsWith("\n") ? content.slice(0, -1) : content
  const lines = source.split("\n")
  const compactedLines: string[] = []
  let insideCodeFence = false
  let previousMutableLine: string | null = null
  let emittedBlankLine = false
  let hasProtectedContent = false

  for (const line of lines) {
    if (line.startsWith("```")) {
      compactedLines.push(line)
      insideCodeFence = !insideCodeFence
      previousMutableLine = null
      emittedBlankLine = false
      hasProtectedContent = true
      continue
    }

    if (insideCodeFence || isProtectedTranscriptLine(line)) {
      compactedLines.push(line)
      previousMutableLine = null
      emittedBlankLine = false
      hasProtectedContent = true
      continue
    }

    if (line.trim() === "") {
      if (!emittedBlankLine) {
        compactedLines.push("")
        emittedBlankLine = true
      }
      previousMutableLine = null
      continue
    }

    if (previousMutableLine === line) {
      continue
    }

    compactedLines.push(line)
    previousMutableLine = line
    emittedBlankLine = false
  }

  const compactedContent = preserveTrailingNewline(content, compactedLines.join("\n"))
  if (Buffer.byteLength(compactedContent, "utf8") >= Buffer.byteLength(content, "utf8")) {
    return {
      content,
      changed: false,
      hasProtectedContent,
    }
  }

  return {
    content: compactedContent,
    changed: compactedContent !== content,
    hasProtectedContent,
  }
}

function compactTranscriptChunks(chunks: readonly string[]): readonly string[] {
  const compactedChunks: string[] = []
  const seenUnprotectedChunks = new Set<string>()

  for (const chunk of chunks) {
    const compactedChunk = compactTranscriptChunk(chunk)

    if (!compactedChunk.hasProtectedContent) {
      if (seenUnprotectedChunks.has(compactedChunk.content)) {
        continue
      }

      seenUnprotectedChunks.add(compactedChunk.content)
    }

    compactedChunks.push(compactedChunk.content)
  }

  return compactedChunks
}

function buildCombinedUserHistory(
  earlierUserMessages: readonly string[],
  latestUserMessage: string | null,
): string {
  const chunks = latestUserMessage === null
    ? [...earlierUserMessages]
    : [...earlierUserMessages, latestUserMessage]

  return chunks.join("\n\n")
}

export function compactTranscriptHistorySurface(
  surface: V4UserPromptOptimizationSurface,
): V4UserPromptOptimizationSurface {
  const earlierUserMessages = compactTranscriptChunks(surface.earlierUserMessages)
  const retainedHistory = compactTranscriptChunks(surface.retainedHistory)
  const transcriptWideCompaction = compactTranscriptChunks(surface.transcriptWideCompaction)

  return {
    ...surface,
    combinedUserHistory: buildCombinedUserHistory(earlierUserMessages, surface.latestUserMessage),
    earlierUserMessages,
    retainedHistory,
    transcriptWideCompaction,
  }
}
