export interface CodexAgentTomlInput {
  readonly name: string
  readonly description: string
  readonly developerInstructions: string
  readonly model?: string
  readonly modelReasoningEffort?: string
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
    ...(input.model === undefined ? [] : [`model = ${renderTomlString(input.model)}`]),
    ...(input.modelReasoningEffort === undefined ? [] : [`model_reasoning_effort = ${renderTomlString(input.modelReasoningEffort)}`]),
    `developer_instructions = ${renderTomlString(input.developerInstructions)}`,
    "",
  ].join("\n")
}
