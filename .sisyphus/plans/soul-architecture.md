# SOUL Architecture Decision

## Decision

Wunderkind will replace static, duplicated personality prose with optional per-persona SOUL files that live inside the project-local `.wunderkind/` directory and are injected at runtime by `src/index.ts`.

This is a runtime-overlay design, not a build-time design.

The neutral base prompt remains the shipped default for every retained agent. A project only gets SOUL payload for a persona when `.wunderkind/souls/<agent-key>.md` exists and contains non-empty content.

## Why Runtime Injection Wins

Runtime injection is mandatory for this feature.

Rejected alternative: build-time injection in `src/build-agents.ts`.

Reasons build-time is rejected:

1. Editing `.wunderkind/souls/*.md` would otherwise require `bun run build` before the change takes effect.
2. `/docs-index` and similar project-learning workflows need to update SOUL files and have those updates become active immediately.
3. `.wunderkind/` is project-local, gitignored runtime state, so it should not be compiled into shipped native agent markdown.
4. The existing plugin already injects resolved runtime context and docs-output instructions in `src/index.ts`, so SOUL overlays belong in the same runtime layer.

## Retained Persona Scope

This design applies only to the six retained topology agents from `.sisyphus/plans/topology-decision.md`.

Valid SOUL files are:

- `.wunderkind/souls/product-wunderkind.md`
- `.wunderkind/souls/fullstack-wunderkind.md`
- `.wunderkind/souls/marketing-wunderkind.md`
- `.wunderkind/souls/creative-director.md`
- `.wunderkind/souls/ciso.md`
- `.wunderkind/souls/legal-counsel.md`

Rules:

- Use the bare retained `agent-key` as the filename.
- Do not use the `wunderkind:` namespace prefix in filenames.
- Do not create SOUL files for retired agents.
- Do not use display-name filenames like `product.md` or `cto.md`.

## File Location Convention

The fixed location convention is:

```text
.wunderkind/souls/<agent-key>.md
```

This convention is confirmed and not revised.

Rationale:

- The files are project-local and naturally belong under the already-gitignored `.wunderkind/` directory.
- `souls/` keeps persona overlays separate from `.wunderkind/wunderkind.config.jsonc`, which should remain compact runtime config rather than long prose.
- The path is stable, easy to document, and deterministic for runtime lookups.

## Exact SOUL File Format

Every per-persona SOUL file must use this exact Markdown structure.

```md
<!-- wunderkind:soul-file:v1 -->
# <Display Name> SOUL

- agentKey: <agent-key>

## Customization
- Priority lens: <required text>
- Challenge style: <required text>
- Project memory: <required text>
- Anti-goals: <required text>

## Durable Knowledge
### <YYYY-MM-DDTHH-mm-ssZ> - <source label>
- Pointers:
  - `<project-relative-path>`
- Learned rules:
  - <durable rule or remembered project truth>
```

Format rules:

1. The first line must be `<!-- wunderkind:soul-file:v1 -->`.
2. The H1 must be `# <Display Name> SOUL` using the persona display name exactly.
3. The metadata bullet must be exactly `- agentKey: <agent-key>`.
4. `## Customization` is always present.
5. `## Customization` always contains exactly four bullets, in this exact order:
   - `Priority lens`
   - `Challenge style`
   - `Project memory`
   - `Anti-goals`
6. `## Durable Knowledge` is always present, even if it has no entries yet.
7. Each durable-knowledge entry uses an H3 timestamp line in exact UTC format `YYYY-MM-DDTHH-mm-ssZ` followed by ` - ` and the source label.
8. Each durable-knowledge entry must contain both a `Pointers` list and a `Learned rules` list.
9. Paths inside `Pointers` must be project-relative.
10. The file stays plain Markdown. No JSON, YAML frontmatter, or embedded code fences inside the file body.

If a SOUL file is created by a learning event before any user customization exists, the `## Customization` bullets must use this exact neutral placeholder text:

- `Priority lens: neutral base prompt still authoritative; no explicit customization yet.`
- `Challenge style: neutral base prompt still authoritative; no explicit customization yet.`
- `Project memory: no explicit customization yet; rely on durable knowledge entries below.`
- `Anti-goals: neutral base prompt still authoritative; no explicit customization yet.`

## Example Template

Concrete example for `product-wunderkind`:

```md
<!-- wunderkind:soul-file:v1 -->
# Product Wunderkind SOUL

- agentKey: product-wunderkind

## Customization
- Priority lens: Optimize for activation and retention before roadmap breadth.
- Challenge style: Push back early when scope expands without a measurable outcome.
- Project memory: This team prefers thin vertical slices, explicit acceptance criteria, and filesystem-first planning in .sisyphus/.
- Anti-goals: Do not generate roadmap theater, vague strategy decks, or big-bang release plans.

## Durable Knowledge
### 2026-03-19T18-45-00Z - /docs-index
- Pointers:
  - `docs/product-decisions.md`
  - `.sisyphus/notepads/agent-harness-optimization-audit/decisions.md`
- Learned rules:
  - Product plans should default to filesystem-backed artifacts unless GitHub workflow readiness is already verified.
  - Durable product decisions belong in the managed docs lane and should be reflected in future decomposition work.
```

## Runtime Injection Contract

Task 13 must implement SOUL injection in `src/index.ts`, not in `src/build-agents.ts`.

### Exact insertion point

Insert SOUL runtime injection in `src/index.ts` inside `experimental.chat.system.transform`:

1. After the existing docs-output injection block.
2. After the existing `## Wunderkind Resolved Runtime Context` block is appended.
3. Before the existing `## Wunderkind Native Agents` block is appended.

The order is therefore:

1. Optional docs-output section
2. Optional resolved runtime context section
3. Optional persona SOUL overlay section
4. Native agent catalog section

### Active-persona detection

Task 13 must determine the active retained persona by scanning `output.system.join("\n")` for these heading markers, in this exact order:

1. `# Product Wunderkind` -> `product-wunderkind`
2. `# Fullstack Wunderkind` -> `fullstack-wunderkind`
3. `# Marketing Wunderkind` -> `marketing-wunderkind`
4. `# Creative Director` -> `creative-director`
5. `# CISO` -> `ciso`
6. `# Legal Counsel` -> `legal-counsel`

If no retained-agent heading is found, inject no SOUL overlay.

This heading-scan rule is the fallback-safe contract because the current plugin transform already receives the fully assembled system prompt content, while local tests do not expose a guaranteed agent-key field on transform input.

### Runtime lookup and wrapper

For the detected agent key:

1. Resolve `.wunderkind/souls/<agent-key>.md` from `process.cwd()`.
2. If the file does not exist, inject nothing.
3. If the file exists but trims to an empty string, inject nothing.
4. If the file exists and is non-empty, append this wrapper block exactly once:

```md
<!-- wunderkind:soul-runtime-start:<agent-key> -->
## Wunderkind SOUL Overlay

Use this project-local SOUL overlay as additive guidance for the active persona. It refines the neutral base prompt with project-specific customization and durable learned context. If it conflicts with an explicit user instruction, follow the user.

<full contents of .wunderkind/souls/<agent-key>.md>
```

Idempotency rule:

- Before injecting, check `output.system.join("")` for `<!-- wunderkind:soul-runtime-start:<agent-key> -->`.
- If that sentinel already exists, do not append a second SOUL block.

## Neutral-Agent Rule

This rule is explicit and mandatory:

If a project has no per-persona customization and no learning-created SOUL file for a persona, that persona contributes no SOUL payload anywhere.

Implementation consequences for Task 13:

1. Retained agent source files must stop embedding long personality-archetype prose in their base prompts.
2. Generated native agent markdown must remain neutral by default.
3. `src/build-agents.ts` must not read `.wunderkind/souls/`.
4. `src/index.ts` must inject SOUL text only when the matching `.wunderkind/souls/<agent-key>.md` file exists and is non-empty.
5. `wunderkind init` must not create `.wunderkind/souls/` when the user declines customization.

This is the token-saving rule: no customization -> no SOUL payload in base generated agent markdown and no runtime SOUL overlay.

Later learning events are allowed to create a SOUL file for a previously neutral persona. Once that file exists, runtime injection becomes active for that persona only.

## Init Customization Flow

Task 13 must replace the current hard-coded twelve-personality selection flow in `src/cli/init.ts` with an opt-in SOUL customization flow for the six retained personas only.

### Step 1: ask whether any customization is wanted

Ask this exact confirm question first:

`Do you want to create project-local SOUL customizations for any retained Wunderkind personas?`

Rules:

- Default answer: `no`
- If the user answers `no`, do not create `.wunderkind/souls/` and do not ask any persona questions.
- If the user answers `yes`, continue to the multi-select.

### Step 2: multi-select retained personas

Present this exact multi-select list, in this exact order:

1. `Product Wunderkind (product-wunderkind)`
2. `Fullstack Wunderkind (fullstack-wunderkind)`
3. `Marketing Wunderkind (marketing-wunderkind)`
4. `Creative Director (creative-director)`
5. `CISO (ciso)`
6. `Legal Counsel (legal-counsel)`

Rules:

- Require at least one selection before continuing.
- Only selected personas get SOUL files at init time.
- Create `.wunderkind/souls/` only after the first persona is selected.

### Step 3: ask four framing questions per selected persona

For every selected persona, ask these exact persona-specific questions and require non-empty answers.

#### Product Wunderkind (`product-wunderkind`)

1. `What should Product Wunderkind optimize for first on this project?`
2. `How should Product Wunderkind challenge the team when scope, priorities, or evidence are weak?`
3. `What recurring product context must Product Wunderkind always remember?`
4. `What should Product Wunderkind avoid doing on this project, even when asked indirectly?`

#### Fullstack Wunderkind (`fullstack-wunderkind`)

1. `What should Fullstack Wunderkind optimize for first on this project: speed, maintainability, reliability, cost, or something else?`
2. `When Fullstack Wunderkind finds technical debt or weak architecture, how assertive should it be?`
3. `What recurring technical context must Fullstack Wunderkind always remember?`
4. `What engineering behaviors should Fullstack Wunderkind avoid on this project?`

#### Marketing Wunderkind (`marketing-wunderkind`)

1. `What should Marketing Wunderkind optimize for first on this project?`
2. `How should Marketing Wunderkind challenge positioning, channel, or launch assumptions that look weak?`
3. `What recurring market, audience, or brand context must Marketing Wunderkind always remember?`
4. `What marketing behaviors or tactics should Marketing Wunderkind avoid on this project?`

#### Creative Director (`creative-director`)

1. `What should Creative Director optimize for first on this project?`
2. `How should Creative Director challenge weak UX, visual, or brand decisions?`
3. `What recurring visual, accessibility, or brand context must Creative Director always remember?`
4. `What design behaviors should Creative Director avoid on this project?`

#### CISO (`ciso`)

1. `What security posture should CISO default to on this project?`
2. `How forcefully should CISO escalate or block work when security concerns appear?`
3. `What recurring security, privacy, or compliance context must CISO always remember?`
4. `What security shortcuts or assumptions must CISO never allow on this project?`

#### Legal Counsel (`legal-counsel`)

1. `What legal posture should Legal Counsel default to on this project?`
2. `How assertively should Legal Counsel escalate legal ambiguity or contractual risk?`
3. `What recurring jurisdiction, licensing, or regulatory context must Legal Counsel always remember?`
4. `What legal shortcuts, promises, or assumptions must Legal Counsel avoid on this project?`

### Step 4: map answers into the file format

For each selected persona, write one file using the exact SOUL format above.

Field mapping is fixed:

- Question 1 -> `Priority lens`
- Question 2 -> `Challenge style`
- Question 3 -> `Project memory`
- Question 4 -> `Anti-goals`

Write the answers verbatim after trimming leading and trailing whitespace. Do not summarize, paraphrase, or rewrite the user's wording.

## `/docs-index` and Similar Learning-Event Update Rules

SOUL files are not init-only. They also hold durable project knowledge that accumulates over time.

### Ownership mapping for SOUL updates

Use the retained topology owner and current docs ownership rules.

- `product-wunderkind` <- `/docs-index` may append from `docsPath/product-decisions.md`
- `fullstack-wunderkind` <- `/docs-index` may append from `docsPath/engineering-decisions.md`
- `marketing-wunderkind` <- `/docs-index` may append from `docsPath/marketing-strategy.md`
- `creative-director` <- `/docs-index` may append from `docsPath/design-decisions.md`
- `ciso` <- `/docs-index` may append from `docsPath/security-decisions.md`
- `legal-counsel` <- `/docs-index` does not append today because `legal-counsel` is not docs-eligible in `src/agents/docs-config.ts`; legal SOUL updates come from other legal learning events unless docs eligibility changes later

Never append SOUL knowledge for retired agents.

### What qualifies as durable SOUL knowledge

A learning event may append to a SOUL file only when the information is expected to matter again after the current session.

Allowed durable examples:

- stable decision rules
- repeated stakeholder preferences
- recurring architecture constraints
- standing brand or UX constraints
- recurring compliance obligations
- canonical source documents worth revisiting

Do not append ephemeral task chatter, one-off TODOs, or transient debugging details.

### Append protocol

When `/docs-index` or another project-learning workflow produces durable persona-specific knowledge:

1. Resolve the retained persona owner.
2. Resolve `.wunderkind/souls/<agent-key>.md`.
3. If the file does not exist, create it using the exact SOUL file format and the neutral placeholder customization bullets.
4. Append one new H3 entry to the bottom of `## Durable Knowledge`.
5. Use the current UTC timestamp in exact `YYYY-MM-DDTHH-mm-ssZ` format.
6. Use a source label such as `/docs-index`, `incident-review`, `triage-issue`, or `init-deep`.
7. Include at least one project-relative pointer.
8. Include at least one learned rule.
9. Never rewrite or reorder `## Customization`.
10. Never delete older durable-knowledge entries.

Dedup rule:

- If the newest existing entry for that SOUL file already has the same source label, the same pointers, and the same learned rules, skip the append.

### `/docs-index` specific rule

`/docs-index` updates SOUL files only after it refreshes or bootstraps the managed docs file for that retained persona.

That means the flow is:

1. Refresh or create the canonical docs file.
2. Extract only the durable persona-relevant takeaways.
3. Append them to the matching SOUL file under `## Durable Knowledge`.
4. Summarize the SOUL update in the command result alongside the docs refresh result.

`/docs-index` must not invent new SOUL paths, new persona IDs, or new ownership mappings.

## Non-Goals for Task 13

Task 13 should not make any new architectural choices beyond this document.

Task 13 is expected to wire the chosen design into code, but it must not:

- switch to build-time SOUL injection
- invent a different SOUL file format
- invent different init questions
- create SOUL files for retired agents
- make SOUL mandatory for neutral agents
- store long-form SOUL prose inside `.wunderkind/wunderkind.config.jsonc`

## Implementation Checklist for Task 13

Task 13 is done only if all of the following are true:

1. Retained base prompts are neutralized so personality prose is no longer statically duplicated.
2. `.wunderkind/souls/<agent-key>.md` is the only project-local long-form SOUL location.
3. `src/index.ts` injects SOUL at runtime using the insertion point and sentinel rules above.
4. `wunderkind init` follows the exact opt-in flow and exact question text above.
5. Declining customization creates no SOUL directory and injects no SOUL payload.
6. `/docs-index` and similar learning events append durable knowledge using the exact format above.
7. No further architectural judgment calls are needed.

## Final Rule

This document is the complete architecture contract for per-persona SOUL support.

Task 13 must implement this design exactly as written.
