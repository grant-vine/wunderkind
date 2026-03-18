# Wunderkind

Wunderkind — specialist AI agent addon for OpenCode that extends your team with 12 professional agents covering marketing, design, product, engineering, brand building, QA, operations, security, devrel, legal, support, and data analysis.

**Requires [OpenCode](https://opencode.ai) and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent).** This package cannot be used standalone.

> [!IMPORTANT]
> **Breaking change (0.7.0)**: This is a pre-1.0 release. Older installs are not supported. Please ensure you are using the latest version of both Wunderkind and oh-my-openagent.

---

## CLI

Wunderkind provides a tiered CLI for installation, project setup, and health checks.

| Command | Purpose | Modifies |
|---|---|---|
| `wunderkind install` | Registers the plugin in OpenCode | `opencode.json` (Global or Project) |
| `wunderkind upgrade` | Upgrade lifecycle entry point for existing installs | None yet (surface only) |
| `wunderkind init` | Bootstraps a project with soul files | `.wunderkind/`, `AGENTS.md`, `.sisyphus/` |
| `wunderkind doctor` | Read-only diagnostics | None |
| `wunderkind uninstall` | Safely removes Wunderkind plugin wiring | OpenCode plugin config (+ global Wunderkind config when applicable) |
| `wunderkind gitignore` | Adds AI traces to `.gitignore` | `.gitignore` |

---

## Install vs Init

Wunderkind distinguishes between **installing** the plugin and **initializing** a project:

1. **Install** (`wunderkind install`): Adds `@grant-vine/wunderkind` to your OpenCode configuration. This makes the agents available to your AI assistant. You typically do this once globally.
2. **Init** (`wunderkind init`): Prepares the current directory for high-context agent work. It creates the `.wunderkind/` configuration directory, the `AGENTS.md` project knowledge base, and optional documentation output folders.

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
bunx @grant-vine/wunderkind install
```

or

The TUI will guide you through:
1. Installing oh-my-openagent if it isn't already (runs its own setup flow first).
2. Selecting the install scope (Global vs Project).
3. Configuring your shared baseline context: region, industry, and data-protection regulations.
4. Optionally initializing the current project immediately.

> Note: upstream's canonical npm package is `oh-my-openagent`, while the upstream CLI command and config filename remain `oh-my-opencode` and `oh-my-opencode.jsonc`.

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

> Running `wunderkind` with no subcommand now shows help and exits. Installation must be explicit via `wunderkind install`.

---

## Upgrade

Wunderkind exposes an explicit upgrade lifecycle command:

```bash
wunderkind upgrade --scope=global
```

Current first-wave upgrade behavior is intentionally narrow:
- it validates that Wunderkind is already installed in the requested scope
- it preserves all project-local soul/docs settings
- it currently behaves as a safe no-op until future baseline override flags are introduced

This keeps the lifecycle concept explicit without overloading `install`.

---

## Init

Initialize the current directory as a Wunderkind project to enable advanced features like Documentation Output and agent context persistence.

```bash
wunderkind init [options]
```

### Options

| Option | Description | Default |
|---|---|---|
| `--docs-path <path>` | Relative path for agent docs output | `./docs` |
| `--docs-history-mode <mode>` | Update style: `overwrite` (default), `append-dated`, `new-dated-file`, `overwrite-archive` | `overwrite` |
| `--docs-enabled <yes\|no>` | Enable or disable documentation output | `no` |
| `--no-tui` | Skip interactive prompts | (false) |

Interactive `wunderkind init` always asks for team culture, org structure, and docs-output settings. It can also optionally walk you through specialist personality overrides; if you skip that step, Wunderkind keeps the current/default specialist personalities already in effect.

`wunderkind init` creates the following project "soul files":
- `.wunderkind/wunderkind.config.jsonc` — Project-specific configuration
- `AGENTS.md` — Project knowledge base for agents
- `.sisyphus/` — Directory for agent planning, notepads, and evidence
- `<docsPath>/README.md` — Auto-generated documentation index (if enabled)

### Documentation History Modes

| Mode | Description |
|---|---|
| `overwrite` | Replaces the file contents each time (default) |
| `append-dated` | Appends a new dated section to the file |
| `new-dated-file` | Creates a new file with a date suffix |
| `overwrite-archive` | Overwrites the current file and archives the old one |

### JSON Schema

Generated Wunderkind config files now include a top-level `$schema` field for editor validation.

- Latest schema URL:
  - `https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json`
- Immutable tagged schema URLs should use the same path on a release tag:
  - `https://raw.githubusercontent.com/grant-vine/wunderkind/<tag>/schemas/wunderkind.config.schema.json`

The schema is scope-aware:
- global config validates only baseline fields (`region`, `industry`, `primaryRegulation`, `secondaryRegulation`)
- project config validates soul/personality/docs fields and also permits project-local baseline overrides when needed

---

## Doctor

Run diagnostics to verify your installation, configuration, and project health.

```bash
wunderkind doctor
```

`wunderkind doctor` reports:
- Installed version and scope (Global vs Project)
- Detected Wunderkind and OMO version state
- Location of configuration files
- Presence and status of project soul files (in a project context)
- Current Documentation Output configuration and index status

`wunderkind doctor` is strictly read-only and makes no changes to your filesystem.

### Doctor Verbose (`--verbose`)

`wunderkind doctor --verbose` additionally shows:
- Full path resolution for global and project OpenCode configs
- Active region, industry, and regulation baseline
- All agent personality settings with human-readable descriptions
- Docs output configuration (path, history mode, enabled status)

Example output (project context with defaults):

```
Agent Personalities
- ciso:         pragmatic-risk-manager  (Balances risk vs. velocity; default posture)
- fullstack:    code-archaeologist  (Deep digs into legacy systems; explains history)
- marketing:    data-driven  (Metrics and attribution first; no vanity metrics)
- qa:           risk-based-pragmatist  (Tests what matters most; ships with confidence)
- product:      outcome-obsessed  (Business outcomes and measurable impact first)
- ops:          on-call-veteran  (Incident-hardened; runbook-first)
- creative:     pragmatic-problem-solver  (Design that ships; form follows function)
- brand:        authentic-builder  (No spin; build trust through radical transparency)
- devrel:       dx-engineer  (Developer experience as a product; DX metrics)
- legal:        pragmatic-advisor  (Risk-calibrated; enables the business to move)
- support:      systematic-triage  (Classification, routing, and severity-driven)
- data analyst: insight-storyteller  (Translates data into narratives for decisions)
```

---

## Uninstall

Safely remove Wunderkind plugin/config wiring:

```bash
wunderkind uninstall
```

Optional scope targeting:

```bash
wunderkind uninstall --scope=global
wunderkind uninstall --scope=project
```

`wunderkind uninstall` removes Wunderkind plugin registration from OpenCode config. On global uninstall it also removes `~/.wunderkind/wunderkind.config.jsonc` (and the parent `~/.wunderkind/` directory if it becomes empty). For safety, it intentionally leaves project-local customization/bootstrap artifacts untouched (`.wunderkind/`, `AGENTS.md`, `.sisyphus/`, docs folders).

---

## Documentation Output

When enabled, agents can persist their decisions and strategies to your project's docs folder.

1. **Enable** via `wunderkind init --docs-path ./docs`
2. **Configure** in `.wunderkind/wunderkind.config.jsonc` via `docsEnabled`, `docsPath`, and `docHistoryMode`.
3. **Refresh or bootstrap** via `/docs-index`. This is an executable plugin command that asks eligible Wunderkind agents to refresh their canonical managed docs or create them if missing, then updates the docs index and can optionally offer `init-deep` as a follow-up question.

---

## Install Scope

| Scope | Description |
|---|---|
| `global` (default) | Adds the plugin to `~/.config/opencode/opencode.json`. Agents are available in all projects. |
| `project` | Adds the plugin to `./opencode.json` (created if missing). Agents are limited to the current project. |

Wunderkind installs its native agent markdown files into OpenCode's supported agent directories. Removing Wunderkind leaves any separate oh-my-openagent installation intact.

> **Native agent install note**: Wunderkind now registers its specialist agents through OpenCode-native markdown agent files. Global installs write to `~/.config/opencode/agents/`; project installs and `wunderkind init` write to `.opencode/agents/` for project-local precedence.

---

## Agents

| Agent Key | Role | Category |
|---|---|---|
| `marketing-wunderkind` | CMO-calibre strategist | primary |
| `creative-director` | Brand & UI/UX lead | primary |
| `product-wunderkind` | VP Product | primary |
| `fullstack-wunderkind` | CTO-calibre engineer | primary |
| `brand-builder` | Community, PR, thought leadership | primary |
| `qa-specialist` | TDD, coverage, user story review | primary |
| `operations-lead` | SRE/SLO, runbooks, incident response | primary |
| `ciso` | Security architecture, OWASP, compliance | primary |
| `devrel-wunderkind` | Developer relations and advocacy | primary |
| `legal-counsel` | Legal and regulatory compliance | primary |
| `support-engineer` | Technical support and troubleshooting | primary |
| `data-analyst` | Data analysis and insights | primary |

Wunderkind agents are distributed as native OpenCode markdown agents. Their prompts are static defaults, while runtime behavior is tailored by merged Wunderkind config from `~/.wunderkind/wunderkind.config.jsonc` and `.wunderkind/wunderkind.config.jsonc`.

> **About prompt size:** Wunderkind specialists are intentionally more focused and domain-heavy than many generic assistants. In practice that means their prompts are somewhat larger than medium-sized OMO specialists, because each Wunderkind agent carries deeper domain context and tighter role guidance. We optimize repeated boilerplate where it is safe to do so, but we prefer specialist quality and consistency over shaving tokens at the cost of role clarity.

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

Wunderkind uses a split configuration model:
- global config stores shared market/regulation baseline
- project config stores soul/personality/docs settings

| File | Scope |
|---|---|
| `~/.wunderkind/wunderkind.config.jsonc` | Global baseline (applies to all projects) |
| `.wunderkind/wunderkind.config.jsonc` | Per-project soul/personality/docs settings |

Edit the global file to change region/industry/regulation defaults after install. Edit the project file to change team culture, personalities, or docs-output settings after init.

### Configuration Reference

```jsonc
// Global baseline config
{
  "$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json",
  // Geographic region — e.g. "South Africa", "United States", "United Kingdom", "Australia"
  "region": "South Africa",
  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"
  "industry": "SaaS",
  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"
  "primaryRegulation": "POPIA",
  // Optional secondary regulation
  "secondaryRegulation": ""
}
```

```jsonc
// Project-local soul/docs config
{
  "$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json",
  // Team culture baseline — affects all agents' communication style and decision rigour
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
  "brandPersonality": "authentic-builder",
  "devrelPersonality": "dx-engineer",
  "legalPersonality": "pragmatic-advisor",
  "supportPersonality": "systematic-triage",
  "dataAnalystPersonality": "insight-storyteller",

  // Documentation Output (Init-only customizations)
  "docsEnabled": false,
  "docsPath": "./docs",
  "docHistoryMode": "overwrite"
}
```

---

## Personality Reference

Each agent's behaviour is controlled by a `*Personality` key in your project config. Choose the archetype that matches your team's operating style.

### CISO (`cisoPersonality`)

| Value | What it means |
|---|---|
| `paranoid-enforcer` | Maximum threat paranoia; blocks anything unproven |
| `pragmatic-risk-manager` | Balances risk vs. velocity; default posture (default) |
| `educator-collaborator` | Guides teams through security thinking collaboratively |

### CTO / Fullstack (`ctoPersonality`)

| Value | What it means |
|---|---|
| `grizzled-sysadmin` | Battle-hardened ops mindset; stability over novelty |
| `startup-bro` | Move fast; bias toward shipping |
| `code-archaeologist` | Deep digs into legacy systems; explains history (default) |

### CMO / Marketing (`cmoPersonality`)

| Value | What it means |
|---|---|
| `data-driven` | Metrics and attribution first; no vanity metrics (default) |
| `brand-storyteller` | Narrative and emotional resonance over raw data |
| `growth-hacker` | Experiments, loops, and funnel obsession |

### QA (`qaPersonality`)

| Value | What it means |
|---|---|
| `rule-enforcer` | Strict standards; gates every release |
| `risk-based-pragmatist` | Tests what matters most; ships with confidence (default) |
| `rubber-duck` | Walks devs through their own bugs; collaborative |

### Product (`productPersonality`)

| Value | What it means |
|---|---|
| `user-advocate` | User pain and delight over internal efficiency |
| `velocity-optimizer` | Throughput and cycle time over perfect specs |
| `outcome-obsessed` | Business outcomes and measurable impact first (default) |

### Operations (`opsPersonality`)

| Value | What it means |
|---|---|
| `on-call-veteran` | Incident-hardened; runbook-first (default) |
| `efficiency-maximiser` | Automates everything; cost and throughput focused |
| `process-purist` | Change management and process integrity |

### Creative Director (`creativePersonality`)

| Value | What it means |
|---|---|
| `perfectionist-craftsperson` | Pixel-perfect; never ships unpolished |
| `bold-provocateur` | Intentionally disruptive visual choices |
| `pragmatic-problem-solver` | Design that ships; form follows function (default) |

### Brand Builder (`brandPersonality`)

| Value | What it means |
|---|---|
| `community-evangelist` | Builds through authentic community engagement |
| `pr-spinner` | Narrative control and media-savvy messaging |
| `authentic-builder` | No spin; build trust through radical transparency (default) |

### DevRel (`devrelPersonality`)

| Value | What it means |
|---|---|
| `community-champion` | Forum presence, events, OSS contribution |
| `docs-perfectionist` | Every API documented; no gaps tolerated |
| `dx-engineer` | Developer experience as a product; DX metrics (default) |

### Legal Counsel (`legalPersonality`)

| Value | What it means |
|---|---|
| `cautious-gatekeeper` | Blocks anything legally ambiguous |
| `pragmatic-advisor` | Risk-calibrated; enables the business to move (default) |
| `plain-english-counselor` | Translates legalese into plain language |

### Support Engineer (`supportPersonality`)

| Value | What it means |
|---|---|
| `empathetic-resolver` | Treats every ticket as a relationship |
| `systematic-triage` | Classification, routing, and severity-driven (default) |
| `knowledge-builder` | Every fix becomes a doc; knowledge loop focus |

### Data Analyst (`dataAnalystPersonality`)

| Value | What it means |
|---|---|
| `rigorous-statistician` | Significance, confidence intervals, no p-hacking |
| `insight-storyteller` | Translates data into narratives for decisions (default) |
| `pragmatic-quant` | Good-enough analysis fast; directional signals |

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
