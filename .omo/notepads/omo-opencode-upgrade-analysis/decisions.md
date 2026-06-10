# OMO/OpenCode capability adoption matrix

This record locks the selected aggressive-expansion scope while preserving Wunderkind's zero-runtime overlay model.

Guardrails:
- zero-runtime overlay remains mandatory
- no daemon, no scheduler, no retry engine, no persistent task graph
- no Wunderkind-owned MCP lifecycle management
- optional upstream capabilities must degrade cleanly

## OpenCode capabilities

### Adopt

- `permission.ask` and `experimental.chat.system.transform`
  - keep and harden as the core plugin boundary already in use
- richer plugin compatibility verification around adjacent verified hook surfaces
  - use verified hook names to keep Wunderkind compatible with current OpenCode plugin contracts
- MCP-related routing and diagnostic guidance
  - continue exposing and diagnosing MCP-backed workflows like Stitch without owning MCP lifecycle

### Detect-only

- `tool.execute.before`
- `tool.execute.after`
- `command.execute.before`
- `chat.headers`
- `shell.env`
- `experimental.session.compacting`
- ACP Support / IDE editor-awareness surfaces
- Commands metadata surface
- Agents metadata surface
- SDK surface
- Server surface
- LSP Servers surface
- Custom Tools surface

Rationale: these are real upstream capabilities worth tracking, but this wave should first report or route around them rather than expanding Wunderkind runtime behavior around them.

### Defer

- first-class ACP/editor-specific product features
- plugin behavior that depends on OpenCode-only session compaction internals beyond compatibility
- any capability that would make Wunderkind own runtime orchestration or hidden control flow

Rationale: aggressive expansion does not justify runtime ownership drift.

## oh-my-openagent capabilities

### Adopt

- canonical `oh-my-openagent` naming as the primary emitted/configured path
- stronger session/delegation contract language in prompts and shipped guidance where it improves retained-agent behavior
- compatibility-aware detection/reporting for modern OMO capabilities in install/doctor/help surfaces

### Leverage passively

- ultrawork
- background agents
- Prometheus planning workflows
- Hash-anchored Edit Tool
- built-in LSP / AST-Grep
- tmux integration
- Ralph Loop
- session tools
- model fallbacks

Rationale: Wunderkind should leverage these as platform capabilities through guidance and routing, not by re-implementing them.

### Detect-only

- built-in MCP availability beyond explicitly supported current workflows
- Session Recovery and doctor/runtime hardening signals that are useful for doctor/supportability messaging

### Defer

- Wunderkind-managed runtime features built on top of ultrawork/background execution
- Wunderkind-owned MCP server lifecycle or registry management
- any feature that turns OMO platform behavior into a Wunderkind daemon/scheduler concern

## Explicit adoption boundary

Adopt = implement directly in Wunderkind this wave.

Leverage passively = rely on the upstream platform capability and reflect it in prompts, commands, or diagnostics without taking ownership of orchestration.

Detect-only = surface or verify capability presence/status without making Wunderkind depend on it.

Defer = out of scope for this wave because it would add runtime ownership, hidden prerequisites, or unnecessary product surface area.
