# Unit Testing Learnings — wunderkind

Captured from the full test-coverage session (March 2026). These are hard-won discoveries about how Bun's test runner behaves with this codebase. Read before touching tests.

---

## Bun Coverage Merge Bug (CRITICAL)

**Symptom:** Running `bun test --coverage` on the full suite shows `src/cli/config-manager/index.ts` at ~16-19% coverage despite 23 tests that genuinely cover it.

**Root cause:** Bun merges coverage data across workers. Any test file that registers a top-level `mock.module("../cli/config-manager/index.ts", ...)` causes that worker to emit 0-coverage data for the module. When Bun merges workers, the mock worker's zero data overwrites the real coverage data from the config-manager-coverage worker.

**Files that register this mock:**
- `tests/unit/cli-installer.test.ts`
- `tests/unit/docs-injection.test.ts`
- `tests/unit/init-doctor.test.ts`
- `tests/unit/init-interactive.test.ts`
- `tests/unit/init-nontui.test.ts`
- `tests/unit/plugin-transform.test.ts`

**Fix:** Run config-manager tests in isolation for accurate coverage:
```bash
bun run test:coverage:config-manager
# = bun test --coverage tests/unit/config-manager-coverage.test.ts
```

Real isolated coverage: **96.15%** (accepted ceiling — remaining lines are genuine dead branches).

**Do not** try to work around this by reorganising mock registration — any top-level `mock.module` in a separate worker will reproduce the problem. It is a Bun bug, not a test architecture problem.

---

## Dynamic Import Query-String Busting

**Symptom:** When a test file uses `Date.now()` inside each test to create a fresh dynamic import URL, Bun's coverage instrument only attributes coverage to the first import URL. Subsequent tests import fresh module instances but Bun records them under a different URL, so coverage for that file stays low.

**Broken pattern:**
```ts
// Inside each test — WRONG
const mod = await import(`../../src/cli/gitignore-manager.ts?t=${Date.now()}`);
```

**Fixed pattern:**
```ts
// Single file-level query-string — correct
const CACHE_BUST = Date.now();
// Inside each test
const mod = await import(`../../src/cli/gitignore-manager.ts?t=${CACHE_BUST}`);
```

This ensures all tests in the file share one module URL, which Bun correctly attributes coverage to. Applies to: `tests/unit/gitignore-manager.test.ts`.

---

## `process.chdir()` Cleanup Order (CRITICAL)

**Rule:** When a test uses `process.chdir(tempDir)`, you MUST restore the original cwd **before** deleting the temp directory. Deleting the directory while still chdir'd into it leaves the process in a non-existent directory, which causes subsequent tests to fail with `ENOENT` on any relative path operation.

**Pattern:**
```ts
const ORIGINAL_CWD = process.cwd();
let tempDir: string | undefined;

try {
  tempDir = mkdtempSync(join(tmpdir(), "test-"));
  process.chdir(tempDir);
  // ... test code ...
} finally {
  process.chdir(ORIGINAL_CWD);          // ← FIRST: restore cwd
  if (tempDir) rmSync(tempDir, { recursive: true, force: true }); // ← THEN: delete
}
```

**Wrong order (will corrupt subsequent tests):**
```ts
} finally {
  if (tempDir) rmSync(tempDir, ...);    // deletes dir while still inside it
  process.chdir(ORIGINAL_CWD);          // too late — process is already lost
}
```

---

## Accepted Coverage Ceilings

These lines cannot be covered without fundamentally restructuring source code. Confirmed dead branches by Oracle.

| File | Lines | Reason |
|---|---|---|
| `src/cli/init.ts` | 456-457 | `normalizeDocHistoryMode()` at line 264 converts any invalid value to `"overwrite"` before the guard at 455 is reached. The TUI uses a closed `promptSelect` list. No reachable code path makes `validateDocHistoryMode()` return false here. |
| `src/cli/cli-installer.ts` | 102-112 | `validateNonTuiArgs()` always returns `{valid: true}` — the failure branch exists for future validation logic that has not been written yet. |
| `src/agents/docs-index-plan.ts` | 33 | Invariant guard — keys come from `Object.keys(AGENT_DOCS_CONFIG)`, so they can never be absent from that same map. |
| `src/cli/config-manager/index.ts` | (combined) | Bun merge bug — real isolated coverage is 96.15%. |
| `src/cli/index.ts` | (absent from report) | Pure Commander.js wiring with `process.exit()` in every handler. Subprocess-tested via `cli-help-text.test.ts`. Not instrumentable in-process. |

---

## Portable Path Pattern

All test files MUST use a portable root path. Never hardcode a machine path.

```ts
// Correct — works on any machine
const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;

// Wrong — breaks on any machine that isn't this one
const PROJECT_ROOT = "/Users/grantv/Code/wunderkind/";
```

---

## Test Commands

```bash
bun test tests/unit/                          # full suite (all 282 tests)
bun run test:coverage:config-manager          # accurate config-manager coverage (isolated)
bun test --coverage tests/unit/               # full combined coverage (config-manager shows low due to Bun bug)
```

---

## Coverage State (as of March 2026)

```
All files                             |   96.29 |   96.35 |
src/cli/gitignore-manager.ts          |  100.00 |  100.00 |
src/cli/docs-output-helper.ts         |  100.00 |  100.00 |
src/cli/doctor.ts                     |  100.00 |  100.00 |
src/cli/tui-installer.ts              |  100.00 |  100.00 |
src/cli/uninstall.ts                  |  100.00 |  100.00 |
src/cli/personality-meta.ts           |  100.00 |  100.00 |
src/index.ts                          |  100.00 |  100.00 |
src/cli/init.ts                       |   94.74 |   99.51 | lines 456-457 — accepted ceiling
src/cli/cli-installer.ts              |  100.00 |   95.60 | lines 102-112 — accepted ceiling
src/cli/config-manager/index.ts       |   16.18 |   19.17 | Bun merge bug; real isolated = 96.15%
src/agents/docs-index-plan.ts         |  100.00 |   98.21 | line 33 — accepted ceiling
[all src/agents/* files]              |  100.00 |  100.00 |
```
