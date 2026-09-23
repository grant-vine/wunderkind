import { redactExcerpt } from "./redaction.js"

const MAX_SESSION_QUERIES = 64
const MAX_QUERY_LENGTH = 1024
const MAX_QUERY_TERMS = 12
const sessionQueries = new Map<string, string>()
const QUERY_STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "do", "for", "from", "how", "i", "in", "is", "it", "me", "of", "on", "or", "please", "the", "this", "to", "was", "what", "when", "where", "who", "why", "with", "would", "you", "your",
])

function buildMemoryQuery(content: string): string {
  const redacted = redactExcerpt(content.trim())
  const terms = redacted.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []
  const salientTerms = terms.filter((term) => term.length > 1 && !QUERY_STOP_WORDS.has(term)).slice(0, MAX_QUERY_TERMS)
  return (salientTerms.length > 0 ? salientTerms.join(" ") : redacted).slice(0, MAX_QUERY_LENGTH)
}

export function rememberMemoryQuery(sessionID: string, content: string): void {
  const key = sessionID.trim()
  const query = buildMemoryQuery(content)
  if (key === "" || query === "") return
  sessionQueries.delete(key)
  sessionQueries.set(key, query)
  if (sessionQueries.size > MAX_SESSION_QUERIES) {
    const oldest = sessionQueries.keys().next().value
    if (oldest !== undefined) sessionQueries.delete(oldest)
  }
}

export function readMemoryQuery(sessionID: string | undefined): string | null {
  if (sessionID === undefined) return null
  return sessionQueries.get(sessionID.trim()) ?? null
}
