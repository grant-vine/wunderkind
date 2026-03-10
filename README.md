# Wunderkind

Wunderkind — specialist AI agent addon for OpenCode that extends your team with 12 professional agents covering marketing, design, product, engineering, brand building, QA, operations, security, devrel, legal, support, and data analysis.

**Requires [OpenCode](https://opencode.ai) and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent).** This package cannot be used standalone.

> [!IMPORTANT]
> **Breaking change (0.7.0)**: This is a pre-1.0 release. Older installs are not supported. Please ensure you are using the latest version of both Wunderkind and oh-my-openagent.

---

## Install

### Have Your Agent Install This

Copy this prompt to your AI assistant (Claude, Copilot, Cursor, etc.):

```
Please install and configure @grant-vine/wunderkind by following the instructions at:
https://raw.githubusercontent.com/grant-vine/wunderkind/main/docs/guide/installation.md
```

For agents that can run shell commands directly:

```bash
curl -s https://raw.githubusercontent.com/grant-vine/wunderkind/main/docs/guide/installation.md
```

The guide contains all flags for non-interactive install so the agent can run a single command without prompts.

---

### Interactive TUI (recommended)

```bash
bunx @grant-vine/wunderkind
```

or

```bash
npx @grant-vine/wunderkind
```

The TUI will guide you through:
1. Installing oh-my-openagent if it isn't already (runs its own setup flow first).
2. Selecting the install scope (Global vs Project).
3. Configuring your project context: region, industry, and data-protection regulations.
4. Tailoring agent personalities and your team's culture baseline.

### Non-interactive install

For CI/CD or scripted environments, use the `install` command with the `--no-tui` flag.

> **oh-my-openagent must already be installed** before running non-interactive mode. If it isn't, install it first:
> ```bash
> bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes
> ```
> See the [oh-my-openagent docs](https://github.com/code-yeongyu/oh-my-openagent) for all available options.

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

Wunderkind writes its own agent config to a separate file — it never modifies your existing oh-my-openagent configuration. Removing Wunderkind leaves oh-my-openagent intact.

---

## Agents

| Agent Key | Role | Category |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre strategist | writing |
| `wunderkind:creative-director` | Brand & UI/UX lead | visual-engineering |
| `wunderkind:product-wunderkind` | VP Product | writing |
| `wunderkind:fullstack-wunderkind` | CTO-calibre engineer | unspecified-high |
| `wunderkind:brand-builder` | Community, PR, thought leadership | writing |
| `wunderkind:qa-specialist` | TDD, coverage, user story review | unspecified-high |
| `wunderkind:operations-lead` | SRE/SLO, runbooks, incident response | unspecified-high |
| `wunderkind:ciso` | Security architecture, OWASP, compliance | unspecified-high |
| `wunderkind:devrel-wunderkind` | Developer relations and advocacy | writing |
| `wunderkind:legal-counsel` | Legal and regulatory compliance | writing |
| `wunderkind:support-engineer` | Technical support and troubleshooting | writing |
| `wunderkind:data-analyst` | Data analysis and insights | writing |

Agent models are determined by category inheritance configured in `oh-my-opencode.jsonc`. Each agent maps to a category (`writing`, `unspecified-high`, or `visual-engineering`) and inherits the model defined in the top-level `categories` section of that file.

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

## Configuration

Wunderkind uses a hierarchical configuration system. The per-project config is merged on top of the global baseline at runtime — project values take precedence.

| File | Scope |
|---|---|
| `~/.wunderkind/wunderkind.config.jsonc` | Global baseline (applies to all projects) |
| `.wunderkind/wunderkind.config.jsonc` | Per-project override |

Edit either file directly to change any value after install. The installer pre-fills both files with the values you provided during setup.

### Configuration Reference

```jsonc
// Wunderkind configuration — edit these values to tailor agents to your project context
{
  // Geographic region — e.g. "South Africa", "United States", "United Kingdom", "Australia"
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
  // CISO: "paranoid-enforcer" | "pragmatic-risk-manager" | "educator-collaborator"
  "cisoPersonality": "pragmatic-risk-manager",
  // CTO/Fullstack: "grizzled-sysadmin" | "startup-bro" | "code-archaeologist"
  "ctoPersonality": "code-archaeologist",
  // CMO/Marketing: "data-driven" | "brand-storyteller" | "growth-hacker"
  "cmoPersonality": "data-driven",
  // QA: "rule-enforcer" | "risk-based-pragmatist" | "rubber-duck"
  "qaPersonality": "risk-based-pragmatist",
  // Product: "user-advocate" | "velocity-optimizer" | "outcome-obsessed"
  "productPersonality": "outcome-obsessed",
  // Operations: "on-call-veteran" | "efficiency-maximiser" | "process-purist"
  "opsPersonality": "on-call-veteran",
  // Creative Director: "perfectionist-craftsperson" | "bold-provocateur" | "pragmatic-problem-solver"
  "creativePersonality": "pragmatic-problem-solver",
  // Brand Builder: "community-evangelist" | "pr-spinner" | "authentic-builder"
  "brandPersonality": "authentic-builder"
}
```

---

## Directory Structure

### Per-project (gitignored automatically)

```
.wunderkind/
  wunderkind.config.jsonc     # per-project config override
```

### Global (`~/.wunderkind/`)

```
~/.wunderkind/
  wunderkind.config.jsonc     # global config baseline
```

---

## Manual Installation

To manually add Wunderkind to your OpenCode configuration, update the `plugin` array in your `opencode.json`:

```json
{
  "plugin": ["@grant-vine/wunderkind"]
}
```

---

## Gitignore

Run this command to ensure `.wunderkind/` and other AI tooling directories are gitignored in your project:

```bash
wunderkind gitignore
```

This adds `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, and `.opencode/` to your `.gitignore` if they aren't already present.

---

## Requirements

- [OpenCode](https://opencode.ai)
- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
- Node.js 18+ or Bun 1+

---

## License

MIT
