# OMO Overlay vs Adjacent-Runtime Decision Memo

**Decision date**: 2026-03-19  
**Status**: CURRENT — overlay, migration gates defined below

---

## 1. Current Overlay Surface

Wunderkind today is a pure synchronous plugin loaded by OpenCode at agent-invocation time. Its complete external dependencies are:

### OpenCode plugin API (`@opencode-ai/plugin`)
- **`Plugin` type** — the single export Wunderkind conforms to; its contract is `async (_input) => { "experimental.chat.system.transform": async (_input, output) => { ... } }`
- **`output.system.push(string)`** — the only mutation Wunderkind performs; it appends sections to the agent system prompt
- **No OpenCode API is called; no callback is registered; no persistent handle is retained**

### oh-my-openagent (OMO)
- **Agent registration** via `oh-my-opencode.jsonc` — Wunderkind registers its six retained agents with categories, colors, and modes in OMO config; OMO then surfaces these agents in OpenCode's agent picker
- **`oh-my-opencode install`** — OMO's own CLI that Wunderkind's TUI installer auto-invokes if OMO is absent; Wunderkind has no runtime dependency on this command
- **Detection** via `detectCurrentConfig()` in `src/cli/config-manager/index.ts` — checks the `plugin` array in `~/.config/opencode/opencode.json` for `@grant-vine/wunderkind`

### Runtime behavior (synchronous, no persistent state)
1. `readWunderkindConfig()` — reads and merges `~/.wunderkind/wunderkind.config.jsonc` with `.wunderkind/wunderkind.config.jsonc` synchronously
2. `readFileSync(soulPath)` — reads `.wunderkind/souls/<agent-key>.md` synchronously if present
3. `output.system.push(...)` — injects: docs-output block, resolved runtime context block, SOUL overlay block (if a soul file exists), and native-agent catalog block
4. Returns; OpenCode takes over request lifecycle

Wunderkind has **no scheduler, no process, no async queue, no retry logic, no persistent session state, and no observability pipeline**. It is invoked per-request by OpenCode's plugin runner and then exits scope.

---

## 2. Why Stay Overlay Now

| Advantage | Explanation |
|---|---|
| **Zero runtime footprint** | No daemon, no process, no memory leak risk, no port conflicts |
| **No persistent state complexity** | Config is read from disk per-invocation; SOUL files are per-project flat markdown; no DB, no queue |
| **No scheduler ownership** | OMO/OpenCode own agent dispatch; Wunderkind only shapes the system prompt |
| **Stateless agents** | All six retained specialists are prompt-only entities; their state lives in `.sisyphus/` and SOUL files managed by the user |
| **Trivial install** | A single `plugin` array entry in `opencode.json`; no server, no daemon, no infrastructure |
| **Alignment with OpenCode lifecycle** | OpenCode manages context window, conversation turns, and model selection; Wunderkind augments without duplicating |
| **Safe composability** | Multiple plugins can coexist without port conflicts or process isolation requirements |
| **Proven model** | The current harness already delivers 6 specialist agents, per-project SOUL customization, docs-output, and config-merged runtime context entirely through synchronous prompt injection |

---

## 3. Migration Triggers (Concrete)

Each of the following represents a specific capability gap in the overlay model. **None currently exists.** They are documented here so migration is never triggered by preference alone.

### Trigger 1 — Persistent delegation state across sessions
**What it means**: Wunderkind needs to remember, across separate OpenCode sessions, that Agent A delegated to Agent B, that B returned a partial result, and that A must resume when B finishes.  
**Why the overlay can't satisfy it**: `output.system.push()` is per-request; there is no mechanism to write state that survives across sessions without a user-managed file (which `.sisyphus/` already handles for human-readable notes).  
**Current status**: Not needed. All inter-agent coordination today is prompt-described convention, not orchestrated state.

### Trigger 2 — Retry / backoff logic owned by Wunderkind
**What it means**: Wunderkind (not OpenCode, not the user) must detect that a delegated agent failed, apply a backoff policy, and re-issue the request automatically.  
**Why the overlay can't satisfy it**: The plugin transform has no access to response data; it only injects into the system prompt. It cannot observe outcomes or trigger retries.  
**Current status**: Not needed. Retry/backoff is a user decision or an orchestrator-model-level behavior.

### Trigger 3 — Explicit task graph / DAG execution
**What it means**: A multi-step plan must be encoded as a directed acyclic graph that Wunderkind schedules and executes — with explicit step dependencies, parallel lanes, and completion signals — rather than leaving that structure in human-readable `.sisyphus/` plans.  
**Why the overlay can't satisfy it**: Prompt injection cannot encode executable task graphs; it can only describe them. Execution requires a runtime that tracks node state.  
**Current status**: Not needed. DAG workflows today are Atlas/orchestrator-model behavior, not Wunderkind-owned scheduling.

### Trigger 4 — Scheduler ownership (cron, event-driven dispatch)
**What it means**: Wunderkind itself must own a time- or event-triggered dispatch loop — e.g., nightly docs refreshes, webhook-triggered compliance scans, or recurring health checks — without a human initiating each invocation.  
**Why the overlay can't satisfy it**: The overlay has no process; it cannot receive events or trigger on a schedule.  
**Current status**: Not needed. All Wunderkind agent interactions are user-initiated.

### Trigger 5 — Observability requirements the OMO plugin surface cannot satisfy
**What it means**: Wunderkind needs structured traces, audit logs, per-session token metrics, or compliance-grade evidence that the OMO/OpenCode plugin surface does not expose and that cannot be approximated by appending to `.sisyphus/` notepad/evidence files.  
**Why the overlay can't satisfy it**: `output.system.push()` has no telemetry hooks; OpenCode does not expose trace or audit APIs to plugins.  
**Current status**: Not needed. Current evidence capture is user/agent-directed writes to `.sisyphus/evidence/`.

---

## 4. Migration Trigger Threshold

Migration to an adjacent-runtime model is justified **only when ALL of the following are true simultaneously**:

1. **At least two of the five triggers above fire concurrently** — a single trigger is likely addressable by extending the existing overlay or `.sisyphus/` conventions
2. **A concrete capability gap is demonstrated** — a specific user need cannot be achieved at all within the overlay model, not just "would be cleaner" as a runtime
3. **The gap cannot be closed by extending OMO's plugin API** — Wunderkind should first file an upstream feature request or PR before standing up its own runtime
4. **The adjacent runtime has been evaluated for install complexity, version coupling, and breakage risk** — the Wunderkind overlay model's primary value is zero install footprint; any migration must demonstrate the tradeoff is worth it

---

## 5. Explicit Recommendation

**Stay overlay.** Wunderkind should remain a synchronous OMO/OpenCode plugin until at least two of the five concrete migration triggers fire simultaneously and a capability gap is demonstrated that cannot be addressed by extending the existing plugin API or `.sisyphus/` conventions.

---

## 6. What Adjacent-Runtime Would Look Like

If migration is eventually justified, the adjacent-runtime model would involve:

- A **Wunderkind server process** (likely a Bun HTTP or WebSocket server) running alongside OpenCode, exposed on a local port or Unix socket
- **State persistence** via a lightweight store (SQLite via `bun:sqlite`, or a flat-file journal) to hold delegation state, retry queues, and task-graph node status
- **OMO/OpenCode integration via a lightweight shim** — the existing plugin transform would become a thin proxy that routes requests to the local Wunderkind server rather than injecting directly into `output.system`
- **Explicit agent execution units** — each specialist agent becomes an invocable endpoint rather than a prompt section; the orchestrator schedules them as tasks with typed inputs/outputs
- **Observability hooks** — structured trace emission to a local SQLite log or stdout JSON stream that tools like the `wunderkind doctor` command could query

This architecture would add meaningful install complexity (process management, port assignment, startup sequencing) and would couple Wunderkind's release cycle more tightly to OpenCode's. It is not warranted until the trigger threshold above is met.

---

## Appendix: Files Examined for This Decision

| File | Role |
|---|---|
| `src/index.ts` | Full plugin transform implementation — the complete overlay surface |
| `src/cli/config-manager/index.ts` | OMO detection logic, config path constants, install/upgrade machinery |
| `oh-my-opencode.jsonc` | Six retained agent blocks — OMO registration contract |
| `src/agents/manifest.ts` | Agent registry powering the native-agent catalog |
| `.sisyphus/plans/topology-decision.md` | Retained six-agent topology this overlay serves |
| `.claude-plugin/plugin.json` | Plugin manifest format |
