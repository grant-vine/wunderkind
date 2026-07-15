import { WUNDERKIND_CANONICAL_MANIFEST } from "./canonical-manifest.js"

export interface SlashCommandDefinition {
  command: string
  summary: string
  details?: readonly string[]
}

export interface SlashCommandSection {
  heading: string
  items: readonly string[]
}

export interface SlashCommandRegistry {
  commands: readonly SlashCommandDefinition[]
  sections?: readonly SlashCommandSection[]
}

export interface GeneratedRetainedNativeCommand<TOwner extends string = string> {
  agent: TOwner
  name: string
  command: string
  summary: string
  details?: readonly string[]
}

export type RetainedAgentSlashCommandOwner = (typeof WUNDERKIND_CANONICAL_MANIFEST.agents)[number]["id"]

export const RETAINED_AGENT_SLASH_COMMANDS: Record<RetainedAgentSlashCommandOwner, SlashCommandRegistry> =
  WUNDERKIND_CANONICAL_MANIFEST.agents.reduce<Record<RetainedAgentSlashCommandOwner, SlashCommandRegistry>>(
    (registry, agent) => {
      const commands = WUNDERKIND_CANONICAL_MANIFEST.commands.generated
        .filter((command) => command.ownerAgentId === agent.id)
        .map((command) => ({
          command: command.command,
          summary: command.summary,
          ...("details" in command ? { details: command.details } : {}),
        }))

      const sections = WUNDERKIND_CANONICAL_MANIFEST.commands.generatedSections
        .filter((section) => section.ownerAgentId === agent.id)
        .map((section) => ({
          heading: section.heading,
          items: section.items,
        }))

      registry[agent.id] = {
        commands,
        ...(sections.length === 0 ? {} : { sections }),
      }

      return registry
    },
    {
      "marketing-wunderkind": { commands: [] },
      "creative-director": { commands: [] },
      "product-wunderkind": { commands: [] },
      "fullstack-wunderkind": { commands: [] },
      ciso: { commands: [] },
      "legal-counsel": { commands: [] },
    },
  )

function parseSlashCommandName(command: string): string {
  const token = command.trim().split(/\s+/, 1)[0]

  if (token === undefined || token === "" || !token.startsWith("/")) {
    throw new Error(`Invalid retained slash command declaration: ${command}`)
  }

  const name = token.slice(1).trim()
  if (name === "") {
    throw new Error(`Invalid retained slash command declaration: ${command}`)
  }

  return name
}

export function collectGeneratedRetainedNativeCommands<TOwner extends string>(
  registry: Readonly<Record<TOwner, SlashCommandRegistry>>,
): Array<GeneratedRetainedNativeCommand<TOwner>> {
  const commands: Array<GeneratedRetainedNativeCommand<TOwner>> = []
  const ownerByCommandName = new Map<string, TOwner>()

  for (const [agent, commandRegistry] of Object.entries(registry) as Array<[TOwner, SlashCommandRegistry]>) {
    for (const definition of commandRegistry.commands) {
      const name = parseSlashCommandName(definition.command)
      const existingOwner = ownerByCommandName.get(name)

      if (existingOwner !== undefined) {
        throw new Error(
          `Duplicate retained slash command name "${name}" declared by "${String(existingOwner)}" and "${String(agent)}"`,
        )
      }

      ownerByCommandName.set(name, agent)
      commands.push({
        agent,
        name,
        command: definition.command,
        summary: definition.summary,
        ...(definition.details !== undefined ? { details: definition.details } : {}),
      })
    }
  }

  return commands
}

export function getGeneratedRetainedNativeCommands(): Array<GeneratedRetainedNativeCommand<RetainedAgentSlashCommandOwner>> {
  return collectGeneratedRetainedNativeCommands(RETAINED_AGENT_SLASH_COMMANDS)
}

export function renderGeneratedRetainedNativeCommandMarkdown(command: GeneratedRetainedNativeCommand): string {
  const additionalGuidanceSection =
    command.details === undefined || command.details.length === 0
      ? null
      : [
          "## Additional Guidance",
          "",
          ...command.details.map((detail) => `- ${detail}`),
        ].join("\n")

  return [
    "---",
    `description: ${JSON.stringify(command.summary)}`,
    `agent: ${command.agent}`,
    "subtask: true",
    `name: ${command.name}`,
    "---",
    "",
    `You are executing the retained Wunderkind command \`${command.command}\`.`,
    "",
    "## Command",
    "",
    `This command is invoked as \`${command.command}\`.`,
    "",
    "## Purpose",
    "",
    command.summary,
    "",
    "## Constraints",
    "",
    `- This command is owned by \`${command.agent}\`.`,
    "- If the user asks what this command does or passes `--help`, explain the command purpose, accepted arguments, and expected output shape before doing any further work.",
    "- Use the current project and the resolved Wunderkind runtime context as the source of truth for this command.",
    ...(additionalGuidanceSection === null ? [] : ["", additionalGuidanceSection]),
    "",
    "<user-request>",
    "$ARGUMENTS",
    "</user-request>",
    "",
  ].join("\n")
}
