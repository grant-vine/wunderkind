# Wunderkind

Wunderkind — specialist AI agent addon for OpenCode that extends your team with 6 retained specialist agents covering marketing, design, product, engineering, security, and legal.

**Requires [OpenCode](https://opencode.ai) and [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent).** This package cannot be used standalone.

> [!IMPORTANT]
> Wunderkind is still pre-1.0. Keep Wunderkind and oh-my-openagent up to date together; older installs are not expected to remain compatible.

> [!WARNING]
> **Breaking changes in this version.** The automated code-cleanup product surface has been fully removed from the Wunderkind product contract. If you are upgrading from an older version that included this feature, the following surfaces have changed:
> - The `init` flag that enabled the cleanup tool no longer exists. Passing it will fail as an unknown flag.
> - The corresponding config key is no longer written or read. Existing config files that contain it are silently tolerated — the key is ignored on read and will not be written back.
> - The managed gitignore entry for the cleanup tool's working directory is no longer added by `wunderkind gitignore`.
> - The first-trigger fallback message that referenced the cleanup tool has been removed from all agent prompts.
> - The `code-health` skill is now an audit/reporting tool only — it does not install or invoke any automated cleanup tool.

---

## CLI

Wunderkind provides a tiered CLI for installation, project setup, and health checks.

| Command | Purpose | Modifies |
|---|---|---|
| `wunderkind install` | Registers the plugin in OpenCode | OpenCode config + native agents/skills (+ shared native commands) |
| `wunderkind upgrade` | Refreshes Wunderkind-owned native assets | Native agents/skills + shared native commands |
| `wunderkind init` | Bootstraps a project with soul files | `.wunderkind/`, `AGENTS.md`, `.sisyphus/`, docs README |
| `wunderkind cleanup` | Removes project-local Wunderkind wiring and state | project OpenCode config + `.wunderkind/` |
| `wunderkind doctor` | Read-only diagnostics | None |
| `wunderkind uninstall` | Safely removes Wunderkind plugin wiring | OpenCode plugin config (+ global Wunderkind config when applicable) |
| `wunderkind gitignore` | Adds AI traces to `.gitignore` | `.gitignore` |

---

## Install vs Init

Wunderkind distinguishes between **installing** the plugin and **initializing** a project:

1. **Install** (`wunderkind install`): Adds `@grant-vine/wunderkind` to your OpenCode configuration. This makes the agents available to your AI assistant. You typically do this once globally.
2. **Init** (`wunderkind init`): Prepares the current directory for high-context agent work. It creates or updates the `.wunderkind/` configuration directory, the `AGENTS.md` project knowledge base, optional project-local SOUL files, and optional documentation output folders.

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
3. Optionally configuring shared baseline defaults: region, industry, and data-protection regulations.
4. Optionally initializing the current project immediately.

> Note: upstream now prefers `oh-my-openagent` for plugin entries and OMO config basenames, while the npm package and CLI command still remain `oh-my-opencode`.

### Non-interactive install

For CI/CD or scripted environments, use the `install` command with the `--no-tui` flag.

> **oh-my-openagent must already be installed** before running non-interactive mode. If it isn't, install it first:
> ```bash
> bunx oh-my-opencode install --no-tui --claude=yes --gemini=no --copilot=yes
> ```
> See the [oh-my-openagent docs](https://github.com/code-yeongyu/oh-my-openagent) for all available options.

```bash
bunx @grant-vine/wunderkind install --no-tui --scope=global
```

Or provide explicit shared defaults during install:

```bash
bunx @grant-vine/wunderkind install --no-tui \
  --scope=global \
  --region="South Africa" \
  --industry=SaaS \
  --primary-regulation=POPIA
```

To install at the project scope with inherited defaults:

```bash
bunx @grant-vine/wunderkind install --no-tui --scope=project
```

Or install at the project scope with explicit project-local baseline overrides:

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

Current upgrade behavior:
- refreshes Wunderkind native agents and native skills in the requested scope
- refreshes Wunderkind's shipped native command assets globally (e.g. `/docs-index`, `/dream`)
- preserves project-local soul/docs settings unless you explicitly opt into config refresh behavior
- supports `--dry-run` and `--refresh-config` for safe testing

Older installs require `wunderkind upgrade` to receive the `/dream` command. `wunderkind doctor` will surface missing or stale command assets.

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
| `--docs-history-mode <mode>` | Update style: `append-dated` (default), `overwrite`, `new-dated-file`, `overwrite-archive` | `append-dated` |
| `--docs-enabled <yes\|no>` | Enable or disable documentation output | `no` |
| `--no-tui` | Skip interactive prompts | (false) |

Interactive `wunderkind init` always asks for team culture, org structure, and docs-output settings. It can also optionally create project-local SOUL files for any retained persona. Those SOUL questions are now select-first with an explicit custom-answer fallback, show a compact persona banner before each persona block, and prefill current project-local SOUL answers when you rerun `init` on an already configured project. Baseline market/regulation values are inherited unless you intentionally override them in project config.

Wave 2 also lets `init` set the PRD/planning workflow mode for the project:
- `filesystem` — PRDs, plans, issues, triage notes, RFCs, and glossary artifacts live in `.sisyphus/`
- `github` — GitHub-backed workflows can be used when `gh` is installed and the repo is GitHub-ready

If `prdPipelineMode` is absent in an older project config, Wunderkind treats it as `filesystem`.

`wunderkind init` creates the following project "soul files":
- `.wunderkind/wunderkind.config.jsonc` — Project-specific configuration
- `AGENTS.md` — Project knowledge base for agents
- `.sisyphus/` — Directory for agent planning, notepads, and evidence
- `<docsPath>/README.md` — Auto-generated documentation index (if enabled)

### Documentation History Modes

| Mode | Description |
|---|---|
| `append-dated` | Appends a UTC-timestamped section like `## Update 2026-03-12T18-37-52Z` to the canonical file (default) |
| `overwrite` | Replaces the file contents each time |
| `new-dated-file` | Creates a UTC-timestamped file like `marketing-strategy--2026-03-12T18-37-52Z.md` beside the canonical file |
| `overwrite-archive` | Overwrites the current file and archives the old one |

### JSON Schema

Generated Wunderkind config files now include a top-level `$schema` field for editor validation.

- Latest schema URL:
  - `https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json`
- Immutable tagged schema URLs should use the same path on a release tag:
  - `https://raw.githubusercontent.com/grant-vine/wunderkind/<tag>/schemas/wunderkind.config.schema.json`

The schema is scope-aware:
- global config validates shared baseline defaults (`region`, `industry`, `primaryRegulation`, `secondaryRegulation`) but allows them to be omitted when inherited defaults are acceptable
- project config validates soul/personality/docs fields and also permits sparse project-local baseline overrides when needed

### Design Workflow (Google Stitch)

`wunderkind init` can optionally enable Google Stitch as the design tool for the current project.

```bash
# Enable Stitch with a project-local API key file
wunderkind init --no-tui --design-tool=google-stitch --stitch-setup=project-local --stitch-api-key-file=./my-stitch-key.txt

# Enable Stitch reusing an existing MCP setup
wunderkind init --no-tui --design-tool=google-stitch --stitch-setup=reuse

# Enable Stitch interactively (guided prompts)
wunderkind init
```

- `/design-md` supports `new` for greenfield Q&A and `capture-existing` for existing-app capture.
- `DESIGN.md` at the project root is the canonical design artifact for this workflow.
- Use the Stitch workflow to keep `DESIGN.md` aligned with the current design direction and captured source assets.

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
- Active region, industry, and regulation baseline with source markers
- PRD workflow mode and GitHub-readiness signals
- All agent personality settings with human-readable descriptions
- Docs output configuration (path, history mode, enabled status)

Legend:
- `●` = project override
- `○` = inherited default

Example output (project context with defaults):

```
Agent Personalities
- ciso:       pragmatic-risk-manager   (Balances risk vs. velocity; default posture)
- fullstack:  code-archaeologist       (Deep digs into legacy systems; explains history)
- marketing:  data-driven              (Metrics and attribution first; no vanity metrics)
- product:    outcome-obsessed         (Business outcomes and measurable impact first)
- creative:   pragmatic-problem-solver (Design that ships; form follows function)
- legal:      pragmatic-advisor        (Risk-calibrated; enables the business to move)
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

## Cleanup

Remove Wunderkind from just the current project without touching shared global capabilities:

```bash
wunderkind cleanup
```

`wunderkind cleanup` removes project-local OpenCode plugin wiring and the project's `.wunderkind/` directory. It intentionally leaves `AGENTS.md`, `.sisyphus/`, docs output folders, and shared global native assets untouched.

---

## Documentation Output

When enabled, agents can persist their decisions and strategies to your project's docs folder.

1. **Enable** via interactive `wunderkind init`, or non-interactively with `wunderkind init --no-tui --docs-enabled=yes --docs-path ./docs`
2. **Configure** in `.wunderkind/wunderkind.config.jsonc` via `docsEnabled`, `docsPath`, and `docHistoryMode`.
3. **Refresh or bootstrap** via `/docs-index`. This executable plugin command uses one shared UTC token per run (`YYYY-MM-DDTHH-mm-ssZ`, for example `2026-03-12T18-37-52Z`). In `append-dated`, it updates canonical files with headings like `## Update 2026-03-12T18-37-52Z`. In `new-dated-file`, it writes managed family files like `marketing-strategy--2026-03-12T18-37-52Z.md` beside the canonical file. Existing date-only artifacts are preserved unchanged.

---

## Code Health

The `code-health` skill (owned by `fullstack-wunderkind`) produces a structured, evidence-based code health audit report with severity-ranked findings. It is an analysis and reporting tool only — it does not mutate code, run automated cleanup tools, or create GitHub issues or RFCs.

Use it when you want a prioritised list of engineering hygiene findings (coupling, testability, dependency risk, systemic patterns) before deciding what to fix. The audit report is produced as structured markdown in the agent response, with findings grouped by severity: `critical`, `high`, `medium`, `low`, and `informational`.

To request an audit, ask `fullstack-wunderkind` directly or invoke the `code-health` skill.

---

## Init-Deep Workflow

`init-deep` is an oh-my-openagent workflow concept, not a Wunderkind CLI command.

Wunderkind supports that upstream bootstrap flow in this order:

1. Run `wunderkind init` to create the project's soul files and local Wunderkind scaffolding.
2. Have an agent populate `AGENTS.md` with project knowledge, conventions, and operating context.
3. Systematically explore the codebase and capture durable findings in `.sisyphus/` notepads and evidence.
4. Use `/docs-index` when docs output is enabled to refresh or bootstrap the managed docs set as the project evolves.

Treat this as the recommended audit/bootstrap process for bringing a project up to a high-context Wunderkind baseline.

---

## /dream

The `/dream` native command is a mixed-domain workflow for ideation, soul synthesis, and project-aware exploration. It is owned by `product-wunderkind` and shipped as a static command asset.

1. **Workflow**: /dream [topic] → ideation → soul synthesis → exploration.
2. **Context**: Uses project-local SOUL overlays from `.wunderkind/souls/<agent-key>.md`, `AGENTS.md` knowledge, and `.sisyphus/` notepads/evidence for high-fidelity reasoning.
3. **Output**: Chat-first. Any durable findings or artifacts must be explicitly requested for save (to `.sisyphus/notepads/` or `.sisyphus/evidence/` only).
4. **Lifecycle**: Refreshed via `wunderkind install` and `wunderkind upgrade`. Run `wunderkind doctor` to check for stale assets.

---

## Install Scope

| Scope | Description |
|---|---|
| `global` (default) | Adds the plugin to `~/.config/opencode/opencode.json`. Agents are available in all projects. |
| `project` | Adds the plugin to `./opencode.json` (created if missing). Agents are limited to the current project. |

Wunderkind installs native markdown assets into OpenCode's supported directories. Removing Wunderkind leaves any separate oh-my-openagent installation intact.

> **Native asset install note**: Wunderkind registers its specialist agents and skills through OpenCode-native markdown files. Global installs and upgrades refresh the shared native assets, and the shipped `/docs-index` command is refreshed globally as a native command asset.

---

## Agents

| Agent Key | Role | OpenCode Category |
|---|---|---|
| `marketing-wunderkind` | CMO-calibre strategist for brand, community, developer advocacy, docs-led launches, and GTM | `writing` |
| `creative-director` | Brand & UI/UX lead | `visual-engineering` |
| `product-wunderkind` | Default orchestrator and front door for all Wunderkind requests. Routes, clarifies, and synthesises across specialists. VP Product authority: roadmaps, OKRs, PRDs, issue intake, acceptance review, sprint planning, and decomposition. | `writing` |
| `fullstack-wunderkind` | CTO-calibre engineer | `unspecified-high` |
| `ciso` | Security architecture, OWASP, compliance | `unspecified-high` |
| `legal-counsel` | Legal and regulatory compliance | `writing` |

Wunderkind agents are distributed as native OpenCode markdown agents. Their prompts are neutral defaults, while runtime behavior is tailored by merged Wunderkind config from `~/.wunderkind/wunderkind.config.jsonc` and `.wunderkind/wunderkind.config.jsonc`, plus optional project-local SOUL overlays in `.wunderkind/souls/<agent-key>.md`.

> **About prompt size:** Wunderkind specialists are intentionally more focused and domain-heavy than many generic assistants. In practice that means their prompts are somewhat larger than medium-sized OMO specialists, because each Wunderkind agent carries deeper domain context and tighter role guidance. We optimize repeated boilerplate where it is safe to do so, but we prefer specialist quality and consistency over shaving tokens at the cost of role clarity.

---

## Sub-skills

Skill authoring and review in this repo follow `skills/SKILL-STANDARD.md`. New or revised skills should use trigger-first descriptions, explicit surviving ownership, filesystem scope, anti-triggers, and review gates.

| Skill Name | Parent Agent | Domain |
|---|---|---|
| `social-media-maven` | marketing-wunderkind | Social media strategy & content |
| `visual-artist` | creative-director | Colour palettes, design tokens, WCAG |
| `agile-pm` | product-wunderkind | Sprint planning, task decomposition |
| `grill-me` | product-wunderkind | Requirement interrogation & ambiguity collapse |
| `ubiquitous-language` | product-wunderkind | Shared domain glossary & canonical terminology |
| `prd-pipeline` | product-wunderkind | PRD → plan → issues workflow |
| `triage-issue` | product-wunderkind | Issue intake, repro shaping, acceptance clarity, and backlog-ready handoff |
| `experimentation-analyst` | product-wunderkind | Product experiments, feature readouts, and statistical interpretation |
| `write-a-skill` | product-wunderkind | Wunderkind-native skill authoring and adaptation |
| `db-architect` | fullstack-wunderkind | Drizzle ORM, PostgreSQL, Neon DB |
| `code-health` | fullstack-wunderkind | Severity-ranked code health audit reports (coupling, testability, dependency risk) |
| `vercel-architect` | fullstack-wunderkind | Vercel, Next.js App Router, Edge Runtime |
| `improve-codebase-architecture` | fullstack-wunderkind | Architecture RFCs, module boundaries, deep modules |
| `design-an-interface` | fullstack-wunderkind | High-complexity API and abstraction design |
| `tdd` | fullstack-wunderkind | Red-green-refactor loops for Bun + strict TypeScript |
| `security-analyst` | ciso | OWASP Top 10, vulnerability assessment |
| `pen-tester` | ciso | Penetration testing, ASVS, attack simulation |
| `compliance-officer` | ciso | GDPR, POPIA, data classification |
| `technical-writer` | marketing-wunderkind | Developer docs, guides, and reference writing |
| `oss-licensing-advisor` | legal-counsel | Open source license compliance and compatibility |

---

## Configuration

Wunderkind uses a split configuration model:
- global config stores shared market/regulation defaults
- project config stores personality/docs/workflow settings plus only the baseline values that intentionally override those defaults
- project-local SOUL files in `.wunderkind/souls/` store long-form persona customization and durable learned context
- when a user asks an agent to remember a durable project-specific preference or personality adjustment, that instruction should be written back into the matching SOUL file so it survives future sessions

| File | Scope |
|---|---|
| `~/.wunderkind/wunderkind.config.jsonc` | Global baseline (applies to all projects) |
| `.wunderkind/wunderkind.config.jsonc` | Per-project soul/personality/docs/workflow settings and sparse baseline overrides |

Edit the global file to change region/industry/regulation defaults after install. Edit the project file to change team culture, personalities, docs-output settings, PRD workflow mode, or only the baseline values that differ for this project after init.

### Configuration Reference

```jsonc
// Global baseline config (all fields optional; omitted values fall back to built-in defaults)
{
  "$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json",
  // Geographic region — e.g. "South Africa", "United States", "United Kingdom", "Australia"
  "region": "Global",
  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"
  "industry": "",
  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"
  "primaryRegulation": "",
  // Optional secondary regulation
  "secondaryRegulation": ""
}
```

```jsonc
// Project-local soul/docs config (sparse overrides only)
{
  "$schema": "https://raw.githubusercontent.com/grant-vine/wunderkind/main/schemas/wunderkind.config.schema.json",
  // Optional project-specific baseline override example:
  // "industry": "Software Development Services",

  // Team culture baseline — affects all agents' communication style and decision rigour
  "teamCulture": "pragmatic-balanced",
  // Org structure — "flat" (peers) | "hierarchical" (domain authority applies)
  "orgStructure": "flat",

  // Agent personalities — controls each retained agent's default character archetype
  "cisoPersonality": "pragmatic-risk-manager",
  "ctoPersonality": "code-archaeologist",
  "cmoPersonality": "data-driven",
  "productPersonality": "outcome-obsessed",
  "creativePersonality": "pragmatic-problem-solver",
  "legalPersonality": "pragmatic-advisor",

  // Documentation Output (Init-only customizations)
  "docsEnabled": false,
  "docsPath": "./docs",
  "docHistoryMode": "append-dated",

  // PRD / planning workflow mode
  "prdPipelineMode": "filesystem"
}
```

---

## Personality Reference

Each agent's behaviour is controlled by a `*Personality` key in your project config. Choose the archetype that matches your team's operating style.

### CISO (`cisoPersonality`)

| Value | What it means |
|---|---|
| `paranoid-enforcer` | Maximum threat paranoia; blocks anything unproven |
| `pragmatic-risk-manager` | Balances risk, incident urgency, compliance impact, and delivery speed; default posture (default) |
| `educator-collaborator` | Guides teams through security thinking, incident posture, and compliance tradeoffs collaboratively |

### CTO / Fullstack (`ctoPersonality`)

| Value | What it means |
|---|---|
| `grizzled-sysadmin` | Battle-hardened ops mindset; stability, runbooks, supportability, and regression proof over novelty |
| `startup-bro` | Move fast; bias toward shipping, direct technical triage, and pragmatic test depth |
| `code-archaeologist` | Deep digs into legacy systems, flaky tests, and recurring incident history before changing architecture (default) |

### CMO / Marketing (`cmoPersonality`)

| Value | What it means |
|---|---|
| `data-driven` | Metrics, attribution, community health, docs adoption, activation, and TTFV first; no vanity metrics (default) |
| `brand-storyteller` | Narrative, PR trust-building, thought leadership, and developer education over raw data alone |
| `growth-hacker` | Experiments, onboarding loops, docs-led adoption, community flywheels, and funnel obsession |

### Product (`productPersonality`)

| Value | What it means |
|---|---|
| `user-advocate` | User pain, issue clarity, adoption friction, and acceptance quality over internal efficiency |
| `velocity-optimizer` | Throughput, backlog-ready triage, and rapid experiment cadence over perfect specs |
| `outcome-obsessed` | Business outcomes, acceptance rigor, issue intake quality, and usage-driven prioritization first (default) |

### Creative Director (`creativePersonality`)

| Value | What it means |
|---|---|
| `perfectionist-craftsperson` | Pixel-perfect; never ships unpolished |
| `bold-provocateur` | Intentionally disruptive visual choices |
| `pragmatic-problem-solver` | Design that ships; form follows function (default) |

### Legal Counsel (`legalPersonality`)

| Value | What it means |
|---|---|
| `cautious-gatekeeper` | Blocks anything legally ambiguous |
| `pragmatic-advisor` | Risk-calibrated; enables the business to move (default) |
| `plain-english-counselor` | Translates legalese into plain language |

---

## Directory Structure

### Per-project (gitignored automatically)

```
.wunderkind/
  wunderkind.config.jsonc     # per-project config override
  souls/
    <agent-key>.md            # optional project-local SOUL overlays for retained personas
```

### Global (`~/.wunderkind/`)

```
~/.wunderkind/
  wunderkind.config.jsonc     # global config baseline
```

## Research Inputs

Wunderkind's evolving workflow strategy is informed in part by Matt Pocock's public skills repository:

- https://github.com/mattpocock/skills

We plan to adapt selected ideas such as ubiquitous language, structured questioning, and PRD/planning flows to Wunderkind's filesystem-first `.sisyphus/` workflow rather than adopting GitHub-issue-centric assumptions directly.

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
