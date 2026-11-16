# Windows Codex setup

Native Windows policy-repair and LazyCodex doctor-launcher findings, the 0.28.11 fix, disposable test gate, telemetry defaults and recovery steps are tracked in [Windows policy repair](windows-policy-repair.md). Versions 0.28.9 and 0.28.10 do not include that fix; native Windows acceptance is operator-run on the target machine.

Use the Codex edition of Wunderkind, not its OpenCode installer. Native Windows and WSL have separate executable resolution, homes, and plugin installations. Install into the environment that runs the Codex task. This release has macOS validation; it does not claim native Windows execution or Windows policy-repair validation.

Start by inspecting `codex --version`, `codex plugin --help`, Node/npm, Git, the effective Codex home, and existing plugins/skills. In PowerShell, use `Get-Command codex -All` to distinguish the native executable from a wrapper. Wunderkind invokes `codex` directly through Node subprocesses without a shell; successful interactive wrapper discovery alone is insufficient. If invocation fails, resolve the supported native executable through the host installer rather than changing execution policy or enabling a shell globally. If a component requires WSL, explain the exact blocker before switching environments.

Wunderkind 0.28.11 targets LazyCodex 5.1.72 and Node >=22.12 (or Bun 1+). Read the upstream installation guide and current command help before installing LazyCodex. Marketplace-managed installs use the marketplace's upgrade path; do not overwrite their cache with a different installer. Retain permissions and user-owned model selections. Model-policy version compatibility and exact executable trust are separate checks.

Install Wunderkind through its documented lifecycle:

```powershell
npx --yes @grant-vine/wunderkind@0.28.11 codex install
npx --yes @grant-vine/wunderkind@0.28.11 codex doctor --json
```

Use `codex upgrade` instead of `codex install` within the Wunderkind command when doctor identifies a healthy existing owned installation that needs refreshing. Modified assets are held for recovery, not overwritten. Do not use OpenCode's top-level `install` command for this setup.

## Matt Pocock companions

These are optional separate installations, not Wunderkind's eleven bundled Codex skills. Inspect the current manager help and upstream inventory:

```powershell
npx --yes skills@latest --help
npx --yes skills@latest add mattpocock/skills
```

Select Codex and the intended global scope using the manager's supported flags or interactive selection. Review `grill-me`, `grill-with-docs`, `improve-codebase-architecture`, `tdd`, `triage`, `to-spec`, `to-tickets`, and `domain-modeling` where present. Include supporting `codebase-design` and `grilling` plus any further declared dependencies. Verify renamed or removed workflows against the current repository rather than creating guessed equivalents. Preserve edited destinations, record the exact source revision, and do not import in-progress software-factory workflows as a default.

The November 16 review found no Matt changes after `5863806dd4e15c63174bee4e7515a4256792ecfa`. This is a reviewed revision, not a claim that every listed optional workflow is installed on every host.

If doctor reports missing supported dependencies, preview `npx --yes @grant-vine/wunderkind@0.28.11 codex repair --dry-run`. Explicit repair installs known missing supporting skills only; it does not refresh existing companions.

## Acceptance

Doctor should report the installed package, six agents, eleven bundled skills, LazyCodex compatibility, and any exact-policy trust holds separately. Inspect companion YAML parsing and dependency closure. Start a new Codex task after installation or upgrade and verify actual skill/agent discovery there; files on disk do not prove this task loaded them. Configured model values do not prove a served inference route. Keep Astra opt-in and preserve user-owned overrides.

Do not enable remote/device services to satisfy local installation. OMO 5.1.72's remote wake belongs to the upstream host and has its own service versions and persistent-store migrations. A macOS packed smoke test does not establish those features work on Windows.

## Prompt for the target machine

> Install and verify Wunderkind's Codex edition 0.28.11, compatible LazyCodex 5.1.72, and the selected Matt Pocock companion workflows described in this document. Read the current official installation guides and command help first. Detect native Windows versus WSL and use only this session's environment. Preserve credentials, custom configuration, edited assets, model overrides, and unrelated repositories; create private backups before mutation. Install dependencies through their supported owners. Check exact policy-repair trust before any model-policy action, keep Astra opt-in, and do not bypass a hold. Verify doctor, skill parsing/dependencies, and fresh-task discovery. Do not enable remote services, run local model experiments, change project instructions, or commit/push project work as part of setup. Report versions, paths, installed inventory, checks, preserved conflicts, and target-specific blockers. Continue through reversible installation work; stop only when complete or a concrete blocker needs operator action.

Sources: [Wunderkind Codex capabilities](codex-capabilities.md), [OMO installation guide](https://github.com/code-yeongyu/oh-my-openagent/blob/v5.1.72/docs/guide/installation.md), [Matt Pocock skills](https://github.com/mattpocock/skills/tree/5863806dd4e15c63174bee4e7515a4256792ecfa), and [OpenAI Windows/WSL guidance](https://learn.chatgpt.com/docs/windows/wsl).
