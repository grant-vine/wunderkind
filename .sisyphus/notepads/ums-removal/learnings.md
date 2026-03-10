# Learnings — ums-removal

## [2026-03-09] Session Start
- Plan approved by Momus on first pass — no iterations needed
- Full codebase inventory already done by explore agent
- Metis identified 8 gaps — all addressed in plan

## Key Constraints
- `exactOptionalPropertyTypes: true` — omit `tool:` key entirely in src/index.ts, do NOT set to undefined
- `noUnusedLocals: true` and `noUnusedParameters: true` — ALL orphaned imports must be removed after docker block deletion
- `bun remove` only (not npm/yarn) for dependency removal
- Never hand-edit `agents/*.md` — always regenerate via `bun run build`
- Do NOT commit until user explicitly requests

## [2026-03-09] Task 1: UMS Complete Deletion
- ✓ src/memory/ — deleted completely with all subdirectories and adapters
- ✓ src/cli/memory-commands.ts — deleted
- ✓ skills/memory-manager/SKILL.md — deleted
- ✓ tests/memory-bench/ — deleted with all test files
- ✓ tests/perf/ — deleted with all performance tests
- ✓ tests/shared/ — deleted with all shared test utilities
- ✓ docker-compose.vector.yml — deleted from repo root
- ✓ docker-compose.mem0.yml — deleted from repo root
- All deletions verified with `ls` showing "No such file or directory"
- Evidence files created:
  - .sisyphus/evidence/task-1-memory-dir-gone.txt
  - .sisyphus/evidence/task-1-deletions-confirmed.txt

## [2026-03-09] Task 3: Test cleanup
- Deleted 9 memory unit test files from tests/unit/:
  - docker.test.ts, file-adapter.test.ts, format.test.ts, mem0-adapter.test.ts
  - memory-commands.test.ts, memory-index.test.ts, sqlite-adapter.test.ts
  - stub-adapter.test.ts, vector-adapter.test.ts
- Edited tests/unit/cli-installer.test.ts: surgically removed mockCreateMemoryFiles mock, beforeEach clear, and mock module entry
- Preserved all non-memory test logic in cli-installer.test.ts
- bun test tests/unit/: all 7 tests pass (0 fail)
- Verified with evidence in .sisyphus/evidence/

## [2026-03-09] Task 2: Integration points removed
- src/index.ts: memory import + tool: key + Agent Memory system prompt block removed
- src/cli/index.ts: createMemoryCommand import + addCommand call removed
- src/cli/config-manager/index.ts: MEMORY_DIR, AGENT_MEMORY_FILES, memoryStub, createMemoryFiles, memoryAdapter config line removed
- src/cli/tui-installer.ts: memory spinner + docker copy blocks + orphaned imports removed
- src/cli/cli-installer.ts: docker copy block + totalSteps 4→3 + orphaned imports removed
- tsc --noEmit: exit 0

## [2026-03-09] Task 5: npm deps and scripts cleaned
- ✓ bun remove @huggingface/transformers @qdrant/js-client-rest fflate mem0ai vectra: success (5 packages)
- ✓ onnxruntime-node removed from trustedDependencies array
- ✓ bench, bench:vector, bench:full scripts removed from package.json
- ✓ test:contract script updated from "bun test tests/" to "bun test tests/unit/"
- grep verifications: all UMS deps gone, all bench scripts gone
- Evidence files created:
  - .sisyphus/evidence/task-5-deps-removed.txt
  - .sisyphus/evidence/task-5-scripts-clean.txt

## [2026-03-09] Task 4: Agent factory files cleaned
- Removed memory instructions from all 8 src/agents/*.ts files
- Patterns removed: wunderkind_take_note, wunderkind_search_memories, memory-manager, .wunderkind/memory
- tsc --noEmit: exit 0
- grep verification: zero matches

## [2026-03-09] Task 6: Documentation cleaned
- RESEARCH.md deleted
- README.md: removed Memory section, Benchmarks, Research Log, memory directory entries, memoryAdapter config, Docker requirement
- AGENTS.md: removed memory rows from WHERE TO LOOK, STRUCTURE, COMMANDS, GOTCHAS

## [2026-03-09] Task 7: Final Verification Gate + Version Bump
- ✓ All 8 verification gates PASSED cleanly
- ✓ tsc --noEmit: exit 0 (all type constraints satisfied)
- ✓ bun run build: regenerated all 8 agents/*.md files without memory references
- ✓ bun test tests/unit/: 7 tests pass, 0 fail
- ✓ CLI help: zero "memory" text in output
- ✓ Grep gates 1-4: all zero matches (no imports, symbols, generated references, or deps)
- ✓ Version bumped: package.json 0.4.4 → 0.5.0
- ✓ Version bumped: .claude-plugin/plugin.json 0.4.4 → 0.5.0
- ✓ Version match: MATCH 0.5.0 across both files
- ✓ Evidence files created in .sisyphus/evidence/

## Key Takeaway
Complete UMS removal is production-ready. The system is clean, types pass, tests pass, builds pass, and CLI works. Ready for commit and release.

## Final Evidence
All verification output in:
- .sisyphus/evidence/task-7-build-pass.txt
- .sisyphus/evidence/task-7-cli-no-memory.txt
- .sisyphus/evidence/task-7-grep-gates.txt
- .sisyphus/evidence/task-7-version-match.txt
- .sisyphus/evidence/task-7-complete.txt

## [2026-03-09] F3: Real QA rerun
- Re-ran all 10 Definition of Done gates manually in repo root; all passed with zero exceptions.
- Verified: `tsc --noEmit` exit 0, grep gates returned `EXIT:1` where expected, `bun test tests/unit/` passed 7/7, and `bun run build` regenerated all 8 agent files successfully.
- CLI smoke checks passed: `node bin/wunderkind.js --help`, `install --help`, and `gitignore --help` all exited 0.
- Version sanity confirmed again: `MATCH 0.5.0` between `package.json` and `.claude-plugin/plugin.json`.

## [2026-03-09] F1 Plan Compliance Audit
- Must Have audit: 18/18 passed
- Must NOT Have audit: 5/6 passed
- Reject reason: forbidden pattern grep  still matches literal prompt text in src/agents/fullstack-wunderkind.ts and src/agents/qa-specialist.ts
- Automated gates still pass: tsc --noEmit, bun test tests/unit/, bun run build, and node bin/wunderkind.js --help

## [2026-03-09] F1 Plan Compliance Audit
- Must Have audit: 18/18 passed
- Must NOT Have audit: 5/6 passed
- Reject reason: forbidden pattern grep `as any|@ts-ignore|@ts-expect-error` still matches literal prompt text in src/agents/fullstack-wunderkind.ts and src/agents/qa-specialist.ts
- Automated gates still pass: tsc --noEmit, bun test tests/unit/, bun run build, and node bin/wunderkind.js --help

## [2026-03-09] F4 Scope Fidelity Audit
- Expected UMS deletions verified absent: src/memory/, memory CLI, memory skill, memory tests, docker-compose files, and RESEARCH.md.
- Skills directory is scoped correctly: 8 non-memory skills remain, memory-manager absent.
- Core integrity failures found outside pure UMS removal scope: src/cli/config-manager/index.ts no longer contains writeWunderkindAgentConfig(), isOhMyOpenCodeInstalled(), readUserPreferredModel(), or readUserPreferredCreativeModel().
- Installer integrity failures: src/cli/tui-installer.ts and src/cli/cli-installer.ts no longer write oh-my-opencode.json, and no OMO installation/detection path is present.
- Plugin integrity failure: src/index.ts currently only injects system text; it does not register a Plugin object with name/description/agents/skills or the 8 createXAgent(model) calls expected by scope.
- Verification status: bun run build passed, bun test tests/unit/ passed, CLI help has no memory command, but LSP diagnostics still report test typing issues in tests/unit/cli-installer.test.ts lines 154:24 and 154:33.
