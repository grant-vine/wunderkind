# F1 Plan Compliance Audit (Round 2) — `/dream`

## Verdict: APPROVE

The implementation complies with the plan contract in `.sisyphus/plans/dream-command.md` for F1.

## Evidence by requirement

1. **`/dream` exists as a static native command asset owned by product-wunderkind**
   - `commands/dream.md:1-4` has frontmatter and `agent: product-wunderkind`.
   - Plan requirement: `.sisyphus/plans/dream-command.md:55-57`.

2. **Command explicitly uses required context sources**
   - `.wunderkind/souls/<agent-key>.md`: `commands/dream.md:15,29`
   - `AGENTS.md`: `commands/dream.md:14`
   - `.sisyphus/`: `commands/dream.md:14,27-28,38`
   - Plan requirement: `.sisyphus/plans/dream-command.md:57-60`.

3. **Chat-first + save-only-on-explicit-request + restricted save lanes**
   - Chat-first: `commands/dream.md:26`
   - Save only on request: `commands/dream.md:27`
   - Restricted targets (`.sisyphus/notepads/`, `.sisyphus/evidence/`): `commands/dream.md:27`
   - Plan requirement: `.sisyphus/plans/dream-command.md:61-64`.

4. **Doctor standard output includes `/dream available:` in project context**
   - Implementation line: `src/cli/doctor.ts:429`
   - Supporting test: `tests/unit/init-doctor.test.ts:1601-1631`
   - Plan requirement: `.sisyphus/plans/dream-command.md:65`.

5. **Doctor verbose mode names `dream.md` when missing**
   - Missing-file warning mechanism: `src/cli/doctor.ts:388-395`
   - Test verifies verbose stale mode names dream filename: `tests/unit/init-doctor.test.ts:1637-1666`
   - Healthy verbose mode does not mention missing dream: `tests/unit/init-doctor.test.ts:1672-1702`
   - Plan requirement: `.sisyphus/plans/dream-command.md:66`.

6. **Removal-path coverage assessment (critical prior rejection claim)**
   - Low-level real sandbox write/remove cycle:
     - Write all native commands (includes shipped static assets): `tests/unit/config-manager-coverage.test.ts:488`
     - Remove native commands via real removal function: `tests/unit/config-manager-coverage.test.ts:525`
     - Assert native commands dir removed: `tests/unit/config-manager-coverage.test.ts:528`
     - This test exercises generic command-set removal behavior, which includes `dream.md` once written.
   - Global uninstall call-chain coverage:
     - Confirms uninstall invokes command removal exactly once: `tests/unit/uninstall.test.ts:159`
   - Conclusion: this combination satisfies plan Task 4’s shared-removal-path requirement (`.sisyphus/plans/dream-command.md:263-266,281-284`) without requiring a dream-named uninstall branch.

7. **Install/upgrade packaging coverage includes dream asset**
   - Native command writer verifies `dream.md` exists and content owner: `tests/unit/cli-installer.test.ts:1336-1345`
   - Config-manager coverage verifies inclusion and owner frontmatter: `tests/unit/config-manager-coverage.test.ts:553,559-560`

## Prior rejection claim re-evaluation

Prior claim said config-manager coverage only asserted write-time inclusion/frontmatter and not removal behavior.

That claim is **incorrect** for the current code state because:
- `tests/unit/config-manager-coverage.test.ts:470-540` is a distinct test block that performs real write + detect + remove operations, including command removal (`:525-528`).
- The write-time/frontmatter assertions are in a separate test block (`:543-578`) and do not replace the removal-path test.

## Must-NOT scope checks

- No edits in `src/agents/*`: confirmed by changed-file set (no `src/agents` diff).
- No edits in `src/index.ts`: confirmed (no diff).
- No edits in `src/cli/init.ts`: confirmed (no diff).
- No config/schema expansion required by this feature in reviewed surfaces.
- No `detectNativeCommandFiles()` signature change observed; it remains `{ dir, presentCount, totalCount, allPresent }` (`src/cli/config-manager/index.ts:1242`).
- No content-hash/content-drift detection introduced in this dream-specific path.

## Final decision

**APPROVE** — The `/dream` implementation and related diagnostics/tests satisfy the F1 plan compliance requirements, including shared removal-path coverage for `dream.md`.
