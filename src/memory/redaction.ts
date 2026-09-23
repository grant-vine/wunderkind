const SECRET_ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*(?:key|token|secret|password)|key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi
const CONNECTION_ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*(?:url|uri|connectionstring|connection_string)|url|uri|connectionstring|connection_string)\s*[:=]\s*[^\s,;]+/gi
const BEARER_CREDENTIAL = /\b((?:proxy-)?authorization\s*:\s*bearer)\s+[^\s,;]+/gi
const PROVIDER_TOKEN = /\b(?:sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_-]+)/gu
const URI_CREDENTIAL = /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gu

export function redactExcerpt(excerpt: string): string {
  return excerpt
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]")
    .replace(CONNECTION_ASSIGNMENT, "$1=[REDACTED]")
    .replace(BEARER_CREDENTIAL, "$1 [REDACTED]")
    .replace(PROVIDER_TOKEN, "[REDACTED]")
    .replace(URI_CREDENTIAL, "$1[REDACTED]@")
}
