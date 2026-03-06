# Wunderkind

A generic addon package for [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) that extends any project with specialist AI agents covering marketing, design, product, engineering, brand building, QA, operations, and security.

**Requires oh-my-opencode to function.** This package cannot be used standalone.

## What this is

`wunderkind` extends oh-my-opencode with eight primary agents and eight sub-skills covering all major disciplines of a modern software product team. It is registered as a Claude Code plugin and loaded automatically by oh-my-opencode at startup.

## Agents

All agents are loaded as `wunderkind:<name>` and configured as `primary` agents in `oh-my-opencode.json`.

| Agent | Role | Default Model |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre marketing strategist | Claude Sonnet 4.6 |
| `wunderkind:creative-director` | Brand identity & UI/UX design leader | Gemini Pro |
| `wunderkind:product-wunderkind` | VP Product-calibre product manager | Claude Sonnet 4.6 |
| `wunderkind:fullstack-wunderkind` | CTO-calibre fullstack engineer | Claude Sonnet 4.6 |
| `wunderkind:brand-builder` | Community strategy, thought leadership, PR, cost gating | Claude Sonnet 4.6 |
| `wunderkind:qa-specialist` | TDD, test writing, coverage analysis, user story review | Claude Sonnet 4.6 |
| `wunderkind:operations-lead` | SRE/SLO, admin tooling, runbooks, incident response | Claude Sonnet 4.6 |
| `wunderkind:ciso` | Security architecture, OWASP, threat modelling, compliance | Claude Sonnet 4.6 |

Agent system prompts live in `agents/`.

## Skills

Sub-skills are loaded as `wunderkind:<name>` and scoped to their parent agent.

| Skill | Parent Agent | Domain |
|---|---|---|
| `wunderkind:social-media-maven` | marketing-wunderkind | Social media strategy & content |
| `wunderkind:visual-artist` | creative-director | Colour palettes, design tokens, WCAG |
| `wunderkind:agile-pm` | product-wunderkind | Sprint planning, task decomposition |
| `wunderkind:db-architect` | fullstack-wunderkind | Drizzle ORM, PostgreSQL, Neon DB |
| `wunderkind:vercel-architect` | fullstack-wunderkind | Vercel, Next.js App Router, Edge Runtime |
| `wunderkind:security-analyst` | ciso | OWASP Top 10, vulnerability assessment, auth testing |
| `wunderkind:pen-tester` | ciso | Penetration testing, ASVS, attack simulation |
| `wunderkind:compliance-officer` | ciso | GDPR, POPIA, data classification, breach notification |

Skill definitions live in `skills/`.

## Installation

Register in `~/.claude/plugins/installed_plugins.json`:

```json
{
  "version": 1,
  "plugins": {
    "wunderkind": {
      "installPath": "/path/to/wunderkind",
      "scope": "user",
      "version": "0.2.0"
    }
  }
}
```

Then configure agent overrides in your project's `.opencode/oh-my-opencode.json` using the namespaced agent names (e.g. `wunderkind:marketing-wunderkind`).

## Development

```bash
bun install
bun run build
```

## Structure

```
wunderkind/
  agents/                        # Agent system prompts (Markdown)
    marketing-wunderkind.md
    creative-director.md
    product-wunderkind.md
    fullstack-wunderkind.md
    brand-builder.md
    qa-specialist.md
    operations-lead.md
    ciso.md
  skills/                        # Sub-skill definitions (Markdown)
    agile-pm/SKILL.md
    db-architect/SKILL.md
    social-media-maven/SKILL.md
    vercel-architect/SKILL.md
    visual-artist/SKILL.md
    security-analyst/SKILL.md
    pen-tester/SKILL.md
    compliance-officer/SKILL.md
  src/
    index.ts                     # Plugin entry point (@opencode-ai/plugin)
  .claude-plugin/
    plugin.json                  # Plugin manifest
  package.json
  tsconfig.json
```
