const SUPPRESSED_TOOL_OUTPUT_PATTERNS = [
  /\bbinary output\b/i,
  /\boutput suppressed\b/i,
  /\bsuppressed by upstream host\b/i,
] as const

const PROTECTED_TOOL_OUTPUT_LINE_PATTERNS = [
  /^```/,
  /^Path:\s/,
  /^File:\s/,
  /^\$\s/,
  /https?:\/\//,
] as const

export interface ToolOutputCompactionResult {
  readonly content: string
  readonly changed: boolean
}

function isProtectedToolOutputLine(line: string): boolean {
  return PROTECTED_TOOL_OUTPUT_LINE_PATTERNS.some((pattern) => pattern.test(line))
}

function shouldBypassToolOutputCompaction(content: string): boolean {
  if (content.includes("\u0000")) {
    return true
  }

  return SUPPRESSED_TOOL_OUTPUT_PATTERNS.some((pattern) => pattern.test(content))
}

function preserveTrailingNewline(content: string, optimizedContent: string): string {
  if (!content.endsWith("\n") || optimizedContent === "") {
    return optimizedContent
  }

  return `${optimizedContent}\n`
}

export function compactToolOutputContent(content: string): ToolOutputCompactionResult {
  if (content.trim() === "" || shouldBypassToolOutputCompaction(content)) {
    return { content, changed: false }
  }

  const source = content.endsWith("\n") ? content.slice(0, -1) : content
  const lines = source.split("\n")
  const compactedLines: string[] = []
  let insideCodeFence = false
  let previousMutableLine: string | null = null
  let emittedBlankLine = false

  for (const line of lines) {
    if (line.startsWith("```")) {
      compactedLines.push(line)
      insideCodeFence = !insideCodeFence
      previousMutableLine = null
      emittedBlankLine = false
      continue
    }

    if (insideCodeFence || isProtectedToolOutputLine(line)) {
      compactedLines.push(line)
      previousMutableLine = null
      emittedBlankLine = false
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
    return { content, changed: false }
  }

  return {
    content: compactedContent,
    changed: compactedContent !== content,
  }
}
