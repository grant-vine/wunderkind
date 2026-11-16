# Windows policy gate timeout follow-up

0.28.12 updates the disposable gate. Live model-policy repair remains on hold until the native Windows tester returns an accepted full gate result. Mac execution and a standalone CLI smoke are not native acceptance.

## Finding and bounded fix

0.28.11 assigned 20-second deadlines to tests that execute a real installer with a 45-second subprocess deadline, plus fixture setup, hashing, copying and cleanup. The nested skill-sync child has its own 15-second limit. The reported Windows smoke completed in about 28 seconds: it shows that a valid action can outlive the test envelope, not that a particular Windows phase or antivirus product caused the slowdown. The exact slow phase remains unverified until Windows traces return.

Integration test and CLI harness envelopes are now 90 seconds. Product deadlines remain 45 seconds for the installer and 15 seconds for sync, with no retries, sleeps or skipped assertions. This leaves time for fixture work and cleanup while ensuring an inner timeout surfaces as a diagnostic failure before the test runner deadline. Conflict tests now assert that the injected conflict was reached; a generic staging error cannot masquerade as successful conflict protection.

Set `WUNDERKIND_POLICY_TRACE=1` for bounded JSON records on stderr: fixture setup, package copy, installer/sync subprocess start/end, PID, elapsed milliseconds, exit status, signal/error code, reached conflicts and stage cleanup. Trace records do not contain command arguments, configuration contents, credentials or provider requests. Normal tracing is off and CLI JSON stdout is preserved. Failure diagnostics include the subprocess outcome even when tracing is off.

## Why two graphs

5.1.70 reproduces the originally reported native Windows installation. 0.28.11 packages and verifies the reviewed 5.1.72 artifact graph for live repair. A 5.1.70-only gate cannot establish 5.1.72 acceptance. The revised gate downloads both exact npm archives, checks each fixed SHA-512 SRI, runs all 30 cases and the disposable CLI smoke separately for each graph, and fails immediately if either fails. Trusted executable/role hashes are still verified by the implementation. This does not authorize a different or modified artifact graph.

## Windows handoff

Use a new disposable checkout of tag `v0.28.12`, verified against the exact commit supplied in the handoff and npm's `gitHead`. Do not reuse or modify a dirty working tree. In native PowerShell, with Node 24.22.3 and Bun 1.4.4 (record actual versions):

```powershell
git rev-parse HEAD
git status --short
node --version
bun --version
$evidence = Join-Path $env:TEMP ('wk-gate-evidence-' + [Guid]::NewGuid().ToString('N'))
powershell -NoProfile -File .\scripts\test-windows-codex-policy.ps1 -EvidenceDirectory $evidence
$gateExit = $LASTEXITCODE
Write-Output "gateExit=$gateExit evidence=$evidence"
```

Run exactly once initially, without another suite/build running concurrently. Do not alter timeouts or command flags locally to obtain a pass. The script sets telemetry opt-out and trace variables only for its process/children, restores them on exit, removes disposable homes/archive extractions, and retains evidence outside those homes. It does not install into the real Codex home, invoke model inference or enable services. Host plugin discovery in the smoke is fixture metadata.

Expected: exit 0; two separate 30-pass/zero-fail test summaries, one for 5.1.70 and one for 5.1.72; both `conflict.reached` kinds on each graph; both smokes report `cliPolicyAction: pass`, matching upstream versions and subprocess status 0; two graph-pass records in `graphs.json`; final BOTH-graphs success line. A smoke pass, 28/30, a timeout, missing graph, or a partial summary is a failed/incomplete gate.

Return:

- exact HEAD, source status, Node/Bun/PowerShell versions and Windows build
- full gate exit code, start/end times and command
- sanitized `gate-transcript.txt` and `graphs.json` if produced
- all trace records for each failing case: fixture/package-copy timing, runner/sync start/end, elapsed time, status, signal/error code, conflict-reached and cleanup records
- whether each graph reached all 30 tests and its smoke; describe the last phase seen if interrupted
- any missing trace/transcript output (do not infer it passed)

Do not return credentials or raw live configuration. Do not rerun live repair, patch caches/manifests, delete receipts, bypass trust or change sandbox settings. Leave live repair held and send the evidence back for review, including on a full pass. A successful disposable gate alone does not prove real host hooks/MCP execution or model serving.
