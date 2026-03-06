# Wunderkind

Wunderkind — specialist AI agent addon for OpenCode that extends your team with eight professional agents covering marketing, design, product, engineering, brand building, QA, operations, and security.

**Requires OpenCode.** This package cannot be used standalone.

---

## Install

### Interactive TUI
The recommended way to install Wunderkind is using the interactive TUI. Run the following command in your project directory:

```bash
bunx @grant-vine/wunderkind
```

or

```bash
npx @grant-vine/wunderkind
```

The TUI will guide you through:
1. Selecting the install scope (Global vs Project).
2. Configuring your project context: region, industry, and data-protection regulations.
3. Tailoring agent personalities and your team's culture baseline.

### Non-interactive install
For CI/CD or scripted environments, use the `install` command with the `--no-tui` flag.

```bash
bunx @grant-vine/wunderkind install --no-tui \
  --scope=global \
  --region="South Africa" \
  --industry=SaaS \
  --primary-regulation=POPIA
```

To install at the project scope:

```bash
bunx @grant-vine/wunderkind install --no-tui \
  --scope=project \
  --region="United States" \
  --industry=FinTech \
  --primary-regulation=CCPA
```

---

## Install Scope

| Scope | Description |
|---|---|
| `global` (default) | Adds the plugin to `~/.config/opencode/opencode.json`. Agents are available in all projects. |
| `project` | Adds the plugin to `./opencode.json` (created if missing). Agents are limited to the current project. |

---

## Agents

| Agent Key | Role | Model |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre strategist | claude-sonnet-4-5 |
| `wunderkind:creative-director` | Brand & UI/UX lead | gemini-2.0-flash |
| `wunderkind:product-wunderkind` | VP Product | claude-sonnet-4-5 |
| `wunderkind:fullstack-wunderkind` | CTO-calibre engineer | claude-sonnet-4-5 |
| `wunderkind:brand-builder` | Community, PR, thought leadership | claude-sonnet-4-5 |
| `wunderkind:qa-specialist` | TDD, coverage, user story review | claude-sonnet-4-5 |
| `wunderkind:operations-lead` | SRE/SLO, runbooks, incident response | claude-sonnet-4-5 |
| `wunderkind:ciso` | Security architecture, OWASP, compliance | claude-sonnet-4-5 |

---

## Sub-skills

| Skill Name | Parent Agent | Domain |
|---|---|---|
| `social-media-maven` | marketing-wunderkind | Social media strategy & content |
| `visual-artist` | creative-director | Colour palettes, design tokens, WCAG |
| `agile-pm` | product-wunderkind | Sprint planning, task decomposition |
| `db-architect` | fullstack-wunderkind | Drizzle ORM, PostgreSQL, Neon DB |
| `vercel-architect` | fullstack-wunderkind | Vercel, Next.js App Router, Edge Runtime |
| `security-analyst` | ciso | OWASP Top 10, vulnerability assessment |
| `pen-tester` | ciso | Penetration testing, ASVS, attack simulation |
| `compliance-officer` | ciso | GDPR, POPIA, data classification |

---

## Memory Commands

Manage agent memories stored in `.wunderkind/memory/` using the `memory` subcommand.

```bash
# Save a note to an agent's memory
wunderkind memory take-note --agent ciso --note "All production database access must go through the jump box."

# Search an agent's memories
wunderkind memory search --agent ciso --query "database access"

# Show memory count and stats for all agents
wunderkind memory count

# Show stats for a specific agent
wunderkind memory count --agent ciso

# Check the health of the configured memory adapter
wunderkind memory status

# Start memory services (required for mem0 adapter)
wunderkind memory start

# Analyze and preview stale memories for an agent
wunderkind memory reduce-noise --agent ciso

# Actually remove stale entries
wunderkind memory reduce-noise --agent ciso --confirm

# Export all memories to a zip file in .wunderkind/exports/
wunderkind memory export

# Import memories from a backup zip
wunderkind memory import backup.zip --strategy merge
```

### Import Strategies
- `merge` (default): Adds new memories from the zip without removing existing ones.
- `overwrite`: Clears existing memories before importing from the zip.

---

## Configuration

Wunderkind uses a hierarchical configuration system.

- **Global baseline**: `~/.wunderkind/wunderkind.config.jsonc`
- **Per-project override**: `.wunderkind/wunderkind.config.jsonc`

### Configuration Structure
The `wunderkind.config.jsonc` file allows you to tailor agents to your project context:

```jsonc
// Wunderkind configuration — edit these values to tailor agents to your project context
{
  // Geographic region — e.g. "South Africa", "United States", "United Kingdom"
  "region": "South Africa",
  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"
  "industry": "SaaS",
  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"
  "primaryRegulation": "POPIA",
  // Optional secondary regulation
  "secondaryRegulation": "",

  // Team culture baseline — affects all agents' communication style and decision rigour
  // "formal-strict" | "pragmatic-balanced" | "experimental-informal"
  "teamCulture": "pragmatic-balanced",
  // Org structure — "flat" (peers) | "hierarchical" (domain authority applies)
  "orgStructure": "flat",

  // Agent personalities — controls each agent's default character archetype
  "cisoPersonality": "pragmatic-risk-manager",
  "ctoPersonality": "code-archaeologist",
  "cmoPersonality": "data-driven",
  "qaPersonality": "risk-based-pragmatist",
  "productPersonality": "outcome-obsessed",
  "opsPersonality": "on-call-veteran",
  "creativePersonality": "pragmatic-problem-solver",
  "brandPersonality": "authentic-builder"
}
```

---

## Directory Structure

### Project Local
```
.wunderkind/            # per-project directory (should be gitignored)
  wunderkind.config.jsonc
  memory/               # file adapter storage
  memory.db             # sqlite adapter storage
  exports/              # memory export zips
```

### Global Shared
```
~/.wunderkind/          # global shared directory
  wunderkind.config.jsonc
  docker-compose.vector.yml
  docker-compose.mem0.yml
```

---

## Memory Adapters

Wunderkind supports four memory adapters for agent persistence:

1. **`file`** (default): Stores memories as flat files in `.wunderkind/memory/`.
2. **`sqlite`**: Stores memories in a local `.wunderkind/memory.db` database.
3. **`vector`**: Uses Qdrant for vector-based semantic search.
4. **`mem0`**: Advanced memory management using the mem0 framework.

**Note**: Vector and mem0 adapters use a shared instance with project namespacing via a project slug derived from your `package.json` name.

---

## Manual Installation

To manually add Wunderkind to your OpenCode configuration, update the `plugin` array in your `opencode.json` or `opencode.jsonc` file:

```json
{
  "plugin": ["@grant-vine/wunderkind"]
}
```

---

## Requirements

- [OpenCode](https://opencode.ai)
- Node.js 18+ or Bun 1+

---

## License

MIT
