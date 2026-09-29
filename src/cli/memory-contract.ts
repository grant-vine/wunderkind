export const MEMORY_AUTOMATIC_CAPTURE_CONTRACT = {
  mode: "chat.message",
  pluginVersion: "1.18.33",
  fallback: "memory capture",
} as const

export const MEMORY_CLI_GRAMMAR = [
  "memory status --format json",
  "memory start",
  "memory stop",
  "memory capture --file <path> [--source-id <id>]",
  "memory recall --query <text> --format json",
  "memory rebuild views",
  "memory forget fact --id <fact-id>",
  "memory forget source --id <source-id>",
  "memory export --output <path> [--force]",
] as const
