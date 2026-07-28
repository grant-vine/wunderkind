export const SELECTED_CONTEXT_SENTINEL = "<!-- wunderkind:selected-context-start -->"
export const SELECTED_CONTEXT_PRESERVE_START =
  "<!-- wunderkind:selected-context-preserve-start -->"
export const SELECTED_CONTEXT_PRESERVE_END =
  "<!-- wunderkind:selected-context-preserve-end -->"

const PROTECTED_SELECTED_CONTEXT_LINE_PATTERNS = [
  /^```/,
  /^Path:\s/,
  /^File:\s/,
  /^\$\s/,
  /https?:\/\//,
] as const

export interface SelectedContextCompactionResult {
  readonly content: string
  readonly changed: boolean
}

function isProtectedSelectedContextLine(line: string): boolean {
  return PROTECTED_SELECTED_CONTEXT_LINE_PATTERNS.some((pattern) => pattern.test(line))
}

function preserveTrailingNewline(content: string, optimizedContent: string): string {
  if (!content.endsWith("\n") || optimizedContent === "") {
    return optimizedContent
  }

  return `${optimizedContent}\n`
}

export function compactSelectedContextContent(content: string): SelectedContextCompactionResult {
  if (content.trim() === "" || !content.includes(SELECTED_CONTEXT_SENTINEL)) {
    return { content, changed: false }
  }

  const source = content.endsWith("\n") ? content.slice(0, -1) : content
  const lines = source.split("\n")
  const compactedLines: string[] = []
  let insideCodeFence = false
  let insideExplicitPreserveSpan = false
  let previousMutableLine: string | null = null
  let emittedBlankLine = false

  for (const line of lines) {
    if (line === SELECTED_CONTEXT_PRESERVE_START) {
      compactedLines.push(line)
      insideExplicitPreserveSpan = true
      previousMutableLine = null
      emittedBlankLine = false
      continue
    }

    if (line === SELECTED_CONTEXT_PRESERVE_END) {
      compactedLines.push(line)
      insideExplicitPreserveSpan = false
      previousMutableLine = null
      emittedBlankLine = false
      continue
    }

    if (line.startsWith("```")) {
      compactedLines.push(line)
      insideCodeFence = !insideCodeFence
      previousMutableLine = null
      emittedBlankLine = false
      continue
    }

    if (
      insideCodeFence ||
      insideExplicitPreserveSpan ||
      line === SELECTED_CONTEXT_SENTINEL ||
      isProtectedSelectedContextLine(line)
    ) {
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
