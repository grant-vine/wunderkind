export interface CodexAgentTomlInput {
  readonly name: string
  readonly description: string
  readonly developerInstructions: string
}

function renderTomlString(value: string): string {
  if (value.includes('\"\"\"')) {
    throw new Error("Codex agent instructions cannot contain a TOML multiline delimiter")
  }

  if (!value.includes("\n")) {
    return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`
  }

  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", "\\r")
  return `\"\"\"\n${escaped}\n\"\"\"`
}

export function renderCodexAgentToml(input: CodexAgentTomlInput): string {
  return [
    `name = ${renderTomlString(input.name)}`,
    `description = ${renderTomlString(input.description)}`,
    `developer_instructions = ${renderTomlString(input.developerInstructions)}`,
    "",
  ].join("\n")
}
