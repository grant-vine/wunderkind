# Wunderkind

Wunderkind — specialist AI agent addon for OpenCode that extends your team with eight professional agents covering marketing, design, product, engineering, brand building, QA, operations, and security.

**Requires [OpenCode](https://opencode.ai) and [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode).** This package cannot be used standalone.

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
1. Installing oh-my-opencode if it isn't already (runs its own setup flow first).
2. Selecting the install scope (Global vs Project).
3. Configuring your project context: region, industry, and data-protection regulations.
4. Tailoring agent personalities and your team's culture baseline.

### Non-interactive install

For CI/CD or scripted environments, use the `install` command with the `--no-tui` flag.

> **oh-my-opencode must already be installed** before running non-interactive mode. If it isn't, install it first:
> ```bash
> bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes
> ```
> See the [oh-my-opencode docs](https://github.com/code-yeongyu/oh-my-opencode) for all available options.

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

Wunderkind writes its own agent config to a separate file — it never modifies your existing oh-my-opencode configuration. Removing Wunderkind leaves oh-my-opencode intact.

| Scope | Agent config written to |
|---|---|
| `global` | `~/.wunderkind/oh-my-opencode.json` |
| `project` | `.wunderkind/oh-my-opencode.json` |

---

## Agents

| Agent Key | Role | Model |
|---|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre strategist | inherits from oh-my-opencode |
| `wunderkind:creative-director` | Brand & UI/UX lead | gemini-2.0-flash |
| `wunderkind:product-wunderkind` | VP Product | inherits from oh-my-opencode |
| `wunderkind:fullstack-wunderkind` | CTO-calibre engineer | inherits from oh-my-opencode |
| `wunderkind:brand-builder` | Community, PR, thought leadership | inherits from oh-my-opencode |
| `wunderkind:qa-specialist` | TDD, coverage, user story review | inherits from oh-my-opencode |
| `wunderkind:operations-lead` | SRE/SLO, runbooks, incident response | inherits from oh-my-opencode |
| `wunderkind:ciso` | Security architecture, OWASP, compliance | inherits from oh-my-opencode |

Agent models default to whatever provider you selected during oh-my-opencode setup (read from `agents.sisyphus.model` in your oh-my-opencode config). The creative-director uses Gemini regardless, as it requires a multimodal model.

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
  oh-my-opencode.json         # wunderkind agent model config (project scope)
```

### Global (`~/.wunderkind/`)

```
~/.wunderkind/
  wunderkind.config.jsonc     # global config baseline
  oh-my-opencode.json         # wunderkind agent model config (global scope)
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
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
- Node.js 18+ or Bun 1+

---

## License

MIT
