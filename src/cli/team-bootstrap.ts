import {
  type WunderkindTeamSpec,
  resolveWunderkindTeamConfigPath,
  writeWunderkindTeamConfig,
} from "./config-manager/index.js"
import type { TeamBootstrapScope } from "./types.js"

export interface TeamBootstrapOptions {
  readonly scope: TeamBootstrapScope
  readonly name: string
  readonly dryRun: boolean
}

export const DEFAULT_WUNDERKIND_TEAM_NAME = "wunderkind-daily-brief" as const

function isValidTeamName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-_]*$/.test(name)
}

export function createCanonicalWunderkindTeamSpec(name: string): WunderkindTeamSpec {
  return {
    name,
    description:
      "Canonical Wunderkind retained-specialist team mapped onto upstream OpenCode/OMO team mode storage and member kinds.",
    lead: {
      name: "wunderkind-team-lead",
      kind: "subagent_type",
      subagent_type: "sisyphus",
      prompt:
        "You are the Wunderkind team lead. Start by asking exactly \"What do you want to do today?\". Then route work through the team members while preserving the retained-specialist posture and falling back to solo product-wunderkind orchestration if the wider runtime is unavailable.",
    },
    members: [
      {
        name: "product-router",
        kind: "category",
        category: "writing",
        prompt:
          "Act as the Wunderkind product front door. Clarify goals, preserve scope, and route next steps in the style of product-wunderkind.",
      },
      {
        name: "marketing-specialist",
        kind: "category",
        category: "writing",
        prompt:
          "Handle positioning, docs-led launch strategy, GTM framing, community, and adoption work in the style of marketing-wunderkind.",
      },
      {
        name: "design-specialist",
        kind: "category",
        category: "visual-engineering",
        prompt:
          "Handle brand, UI/UX, accessibility, and design-system work in the style of creative-director.",
      },
      {
        name: "engineering-specialist",
        kind: "category",
        category: "unspecified-high",
        prompt:
          "Handle engineering implementation, diagnosis, reliability, and architecture work in the style of fullstack-wunderkind.",
      },
      {
        name: "security-specialist",
        kind: "category",
        category: "unspecified-high",
        prompt:
          "Handle security architecture, OWASP review, and compliance control thinking in the style of ciso.",
      },
      {
        name: "legal-specialist",
        kind: "category",
        category: "writing",
        prompt:
          "Handle policy, privacy, OSS licensing, and legal wording review in the style of legal-counsel.",
      },
      {
        name: "research-specialist",
        kind: "subagent_type",
        subagent_type: "atlas",
      },
    ],
  }
}

export async function runTeamBootstrap(options: TeamBootstrapOptions): Promise<number> {
  const trimmedName = options.name.trim()
  if (!isValidTeamName(trimmedName)) {
    console.error(
      `Error: --name must match /^[A-Za-z0-9][A-Za-z0-9-_]*$/, got: ${JSON.stringify(options.name)}`,
    )
    return 1
  }

  const spec = createCanonicalWunderkindTeamSpec(trimmedName)
  const configPath = resolveWunderkindTeamConfigPath(options.scope, trimmedName)

  if (options.dryRun) {
    console.log(`Dry run: would write canonical Wunderkind team spec to ${configPath}`)
    console.log(`Scope: ${options.scope}`)
    console.log(`Team: ${trimmedName}`)
    console.log(`Members: ${spec.members.map((member) => member.name).join(", ")}`)
    console.log("Lifecycle guardrail: install/init/upgrade/cleanup/uninstall do not create or mutate this path automatically.")
    return 0
  }

  const result = writeWunderkindTeamConfig(spec, options.scope)
  if (!result.success) {
    console.error(`Error: ${result.error ?? "Failed to write Wunderkind team spec."}`)
    return 1
  }

  console.log(`Wrote canonical Wunderkind team spec to ${result.configPath}`)
  console.log(`Scope: ${options.scope}`)
  console.log(`Team: ${trimmedName}`)
  console.log("Lifecycle guardrail: this explicit bootstrap command is the only Wunderkind CLI flow that writes .omo/teams state.")
  return 0
}
