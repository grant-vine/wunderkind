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
  "brandPersonality": "authentic-builder",

  // Memory adapter — "file" (default) | "sqlite" | "vector" | "mem0"
  "memoryAdapter": "file"
}
```

---

## Memory

Wunderkind agents accumulate project-specific knowledge across sessions. Memories are stored locally (or in an external service for vector/mem0 adapters) and loaded by agents when they start.

### Commands

```bash
# Save a note to an agent's memory
wunderkind memory take-note --agent ciso --note "All production DB access must go through the jump box."

# Pin a note so it is never pruned automatically
wunderkind memory take-note --agent ciso --note "Critical finding" --pin

# Search an agent's memories
wunderkind memory search --agent ciso --query "database access"

# Show memory count and stats for all agents
wunderkind memory count

# Show stats for a specific agent
wunderkind memory count --agent ciso

# Check the health of the configured memory adapter
wunderkind memory status

# Start memory services (required for vector/mem0 adapters)
wunderkind memory start

# Preview stale memories that could be pruned
wunderkind memory reduce-noise --agent ciso

# Actually remove stale entries
wunderkind memory reduce-noise --agent ciso --confirm

# Export all memories to a zip file in .wunderkind/exports/
wunderkind memory export

# Export to a custom path
wunderkind memory export --output backup.zip

# Import memories from a backup zip
wunderkind memory import backup.zip

# Import with overwrite strategy (clears existing memories first)
wunderkind memory import backup.zip --strategy overwrite
```

### Import Strategies

| Strategy | Behaviour |
|---|---|
| `merge` (default) | Adds new memories from the zip; skips any that already exist (matched by slug). |
| `overwrite` | Clears existing memories for each agent in the zip, then imports all entries. |

### Memory Adapters

Wunderkind supports four memory adapters. Set `memoryAdapter` in your `wunderkind.config.jsonc` to switch.

| Adapter | Default | Storage | External service required |
|---|---|---|---|
| `file` | ✓ | `.wunderkind/memory/<agent>.md` per project | No |
| `sqlite` | | `.wunderkind/memory.db` per project | No |
| `vector` | | Qdrant (semantic search) | Yes — Docker |
| `mem0` | | mem0 OSS (advanced memory management) | Yes — Docker |

---

<details>
<summary><strong>SQLite adapter</strong></summary>

Drop-in replacement for the file adapter with no external dependencies. Stores all agent memories in a single SQLite database file.

```jsonc
{
  "memoryAdapter": "sqlite"
}
```

Storage location: `.wunderkind/memory.db` in your project directory.

</details>

---

<details>
<summary><strong>Vector adapter (Qdrant)</strong></summary>

Stores memories as vector embeddings in a local Qdrant instance. Enables semantic (similarity) search — useful when agents need to retrieve conceptually related memories rather than keyword matches.

**Requires Docker.**

```jsonc
{
  "memoryAdapter": "vector",

  // Qdrant server URL (default: "http://localhost:6333")
  "qdrantUrl": "http://localhost:6333",

  // Embedding model — must match vectorSize (default: "Xenova/all-MiniLM-L6-v2")
  "vectorEmbedModel": "Xenova/all-MiniLM-L6-v2",

  // Embedding vector dimensions — must match the model (default: 384)
  "vectorSize": 384,

  // Qdrant collection name (default: "wunderkind-memories")
  "vectorCollection": "wunderkind-memories",

  // Optional: local cache directory for the embedding model weights
  "vectorCacheDir": "~/.cache/wunderkind/transformers"
}
```

Start the Qdrant service:

```bash
wunderkind memory start
```

This runs `docker compose -f ~/.wunderkind/docker-compose.vector.yml up -d`. The Docker Compose file is placed in `~/.wunderkind/` during install.

Memories are namespaced per project using a slug derived from your `package.json` `name` field (fallback: directory name). Different projects sharing the same Qdrant instance will not see each other's memories.

</details>

---

<details>
<summary><strong>mem0 adapter</strong></summary>

Uses the [mem0 OSS](https://github.com/mem0ai/mem0) framework for advanced memory management with an LLM-backed memory layer.

**Requires Docker.**

```jsonc
{
  "memoryAdapter": "mem0",

  // mem0 server URL (default: "http://localhost:8000")
  "mem0Url": "http://localhost:8000",

  // LLM provider for mem0 (e.g. "openai", "ollama", "anthropic")
  "mem0LlmProvider": "ollama",
  "mem0LlmModel": "llama3",
  "mem0LlmBaseUrl": "http://localhost:11434",    // required for Ollama

  // Embedding provider
  "mem0EmbedProvider": "ollama",
  "mem0EmbedModel": "nomic-embed-text",
  "mem0EmbedDims": 768,
  "mem0EmbedBaseUrl": "http://localhost:11434",  // required for Ollama

  // Vector store backend for mem0 (default: built-in)
  "mem0VectorStore": "qdrant",
  "mem0VectorStoreHost": "localhost",
  "mem0VectorStorePort": 6333,
  "mem0VectorStoreCollection": "wunderkind-mem0"
}
```

Start the mem0 service:

```bash
wunderkind memory start
```

This runs `docker compose -f ~/.wunderkind/docker-compose.mem0.yml up -d`. The Docker Compose file is placed in `~/.wunderkind/` during install.

Memories are namespaced per project using a composite agent ID: `<project-slug>:<agent-name>`. The project slug is derived from your `package.json` `name` field (fallback: directory name).

</details>

---

## Directory Structure

### Per-project (gitignored automatically)

```
.wunderkind/
  wunderkind.config.jsonc     # per-project config override
  oh-my-opencode.json         # wunderkind agent model config (project scope)
  memory/                     # file adapter storage (one .md per agent)
  memory.db                   # sqlite adapter storage
  exports/                    # memory export zips
```

### Global (`~/.wunderkind/`)

```
~/.wunderkind/
  wunderkind.config.jsonc     # global config baseline
  oh-my-opencode.json         # wunderkind agent model config (global scope)
  docker-compose.vector.yml   # Qdrant compose file
  docker-compose.mem0.yml     # mem0 compose file
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

## Performance Benchmarks

Benchmarked on macOS (Apple Silicon). Numbers are averages across multiple runs. mem0 is only tested at 10 and 100 memories — it calls an AI model on every write, so larger tests would take hours.

### TL;DR — which adapter should I pick?

| If you want… | Use |
|---|---|
| Just works, no setup | `file` |
| Fast search, still no setup | `sqlite` |
| Agents that find memories by *meaning*, not just keywords — no Docker | `local-vec` |
| Meaning-based search with very large memory stores | `vector` |
| AI that actively summarises and consolidates memories over time | `mem0` |

### Speed

How long each operation takes, measured across small (10), medium (100), and large (1000) memory stores.

| Adapter | Memories | Save a memory | Load all memories | Search by keyword | Search by meaning | Delete old memories |
|---|---|---|---|---|---|---|
| File | 10 | 5.7ms | 0.4ms | 0.3ms | 0.1ms | 0.3ms |
| SQLite | 10 | 1.9ms | 0.1ms | 0.3ms | 0.0ms | 0.4ms |
| Local Vector | 10 | 53.8ms | 0.9ms | 2.8ms | 3.8ms | 4.7ms |
| Vector (Qdrant) | 10 | 105.3ms | 1.6ms | 5.3ms | 5.4ms | 1.5ms |
| mem0 | 10 | 3.8s | 309ms | 436ms | 377ms | 1.5s |
| File | 100 | 9.0ms | 0.3ms | 0.3ms | 0.3ms | 0.4ms |
| SQLite | 100 | 22.9ms | 0.2ms | 0.1ms | 0.0ms | 1.2ms |
| Local Vector | 100 | 766ms | 2.8ms | 5.0ms | 6.0ms | 140ms |
| Vector (Qdrant) | 100 | 921ms | 8.8ms | 10.0ms | 8.5ms | 2.9ms |
| mem0 | 100 | 37.8s | 371ms | 449ms | 393ms | 14.9s |
| File | 1000 | 171ms | 1.9ms | 1.5ms | 1.4ms | 1.6ms |
| SQLite | 1000 | 317ms | 1.0ms | 0.5ms | 0.1ms | 8.7ms |
| Local Vector | 1000 | 33.1s | 31.5ms | 27.5ms | 28.5ms | 12.7s |
| Vector (Qdrant) | 1000 | 10.5s | 44.6ms | 17.3ms | 12.7ms | 1.3ms |

**What the operations mean:**
- **Save a memory** — total time to write N memories (the headline cost of the adapter)
- **Load all memories** — time to read everything back for a single agent
- **Search by keyword** — find memories containing a specific word (e.g. "database")
- **Search by meaning** — find memories that are *about* a topic even if they use different words
- **Delete old memories** — prune stale entries

**Why is mem0 so slow to save?** Every write calls a local AI model (Ollama) to understand and consolidate the memory. It's not designed for bulk storage — it's designed to slowly accumulate a handful of important facts per agent over time.

**Why does Local Vector get slow at 1000 memories?** The in-process vector index has to rebuild itself on every deletion. Qdrant (the external Vector adapter) handles this in milliseconds because deletion is a native database operation.

### Search quality

Can agents actually find the right memory when they search? Tested with 100 memories in the store.

**Keyword search** — searching for a specific word that appears in ~33% of memories:

| Adapter | Of results returned, how many were correct? | Of all matching memories, how many were found? |
|---|---|---|
| File | 100% | 100% |
| SQLite | 100% | 29% |
| Local Vector | 100% | 29% |
| Vector (Qdrant) | 100% | 29% |

File returns every single match. The others return the top 10 most relevant results — so if there are 34 matching memories, they'll find the best 10 (29%) but skip the rest. This is usually fine; you want the most relevant results, not everything.

**Meaning-based search** — searching by concept using different words than what's stored (e.g. asking *"how should we handle database connections?"* to find memories written as *"PostgreSQL pool must be configured with max_connections=100"*):

| Adapter | Of results returned, how many were on-topic? | Of all on-topic memories, how many were found? |
|---|---|---|
| File | 0% | 0% |
| SQLite | 0% | 0% |
| Local Vector | 60% | 34% |
| Vector (Qdrant) | 60% | 13% |

File and SQLite only match exact words — they can't find memories by concept. The vector adapters understand meaning: when you ask about "database connections", they find memories about connection pools and pgBouncer even if those exact words weren't in your query. Local Vector finds more of the relevant memories (34% vs 13%) because the external Vector adapter applies extra ranking filters that are more conservative.

> **The practical takeaway:** if your agents save knowledge phrased one way but search for it another way, only `local-vec`, `vector`, or `mem0` will find it.

### Which embedding model is best? (Local Vector only)

Local Vector lets you choose the AI model used to understand memory meaning. We tested three:

| Model | Download size | Of results returned, how many were on-topic? | Of all on-topic memories, how many were found? |
|---|---|---|---|
| MiniLM-L6 (default) | 22MB | 60% | 34% |
| BGE-small | 32MB | 44% | 25% |
| BGE-base | 105MB | 52% | 30% |

The default (MiniLM-L6) actually performs best on this workload. Bigger doesn't always mean better for short conversational text — and it's the fastest to download.

### Running the benchmark yourself

```bash
# File + SQLite only (no Docker needed)
bun run bench

# Adds Local Vector + Qdrant Vector (requires Docker)
bun run bench:vector

# All five adapters including mem0 (requires Docker + Ollama)
bun run bench:full
```

---

## Requirements

- [OpenCode](https://opencode.ai)
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
- Node.js 18+ or Bun 1+
- Docker (only for `vector` or `mem0` memory adapters)

---

## License

MIT
