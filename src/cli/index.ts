#!/usr/bin/env node
import { Command } from "commander"
import { runCliInstaller, runCliUpgrade } from "./cli-installer.js"
import { runDoctorWithOptions } from "./doctor.js"
import { runWorkflowSync } from "./github-issues-sync.js"
import { runInit } from "./init.js"
import { runProjectArtifactMigration } from "./migrate.js"
import { runProjectCleanup } from "./cleanup.js"
import { runTokenAudit } from "./token-audit.js"
import { runTuiInstaller } from "./tui-installer.js"
import { runUninstall } from "./uninstall.js"
import { addAiTracesToGitignore } from "./gitignore-manager.js"
import type { DocHistoryMode, InstallArgs, InstallScope } from "./types.js"
import { LEGACY_PROJECT_ARTIFACT_DIR, PRIMARY_PROJECT_ARTIFACT_DIR } from "../project-artifacts.js"
import { WUNDERKIND_CANONICAL_MANIFEST } from "../agents/canonical-manifest.js"

const REGULATION_LIST = "GDPR, POPIA, CCPA, LGPD, HIPAA, PIPEDA, PDPA, APPI, SOC2, ISO27001, or any custom value"

function parseYesNoOption(flagName: string, value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === "yes" || normalized === "y" || normalized === "true") return true
  if (normalized === "no" || normalized === "n" || normalized === "false") return false
  console.error(`Error: ${flagName} must be yes|no, got: "${value}"`)
  process.exit(1)
}

const program = new Command()

program
  .name("wunderkind")
  .description(
    [
      WUNDERKIND_CANONICAL_MANIFEST.package.description,
      "",
      "Adds six retained native OpenCode agents covering",
      "marketing, design, product, engineering, security, and legal — each",
      "guided by your region, industry, and data-protection defaults when configured.",
      "",
      "Examples:",
      "  bunx @grant-vine/wunderkind install",
      "  bunx @grant-vine/wunderkind install --no-tui",
       "  bunx @grant-vine/wunderkind install --no-tui \\",
       "    --region='South Africa' --industry=SaaS --primary-regulation=POPIA",
       "  bunx @grant-vine/wunderkind upgrade --scope=global",
       "  bunx @grant-vine/wunderkind gitignore",
    ].join("\n"),
  )
  .version(WUNDERKIND_CANONICAL_MANIFEST.package.version)
  .showHelpAfterError()

program
  .command("install")
  .description(
    [
      "Install Wunderkind into your OpenCode setup.",
      "",
      "Runs the interactive TUI by default. Pass --no-tui for",
      "non-interactive use in CI or scripted environments.",
      "",
       "Upstream naming note: use oh-my-openagent for plugin entries, config basenames, and install commands.",
    ].join("\n"),
  )
  .option("--no-tui", "Run non-interactive CLI installer with optional baseline default flags")
  .option("--region <region>", "Geographic region, e.g. 'South Africa', 'United States', 'Global'")
  .option("--industry <industry>", "Industry vertical, e.g. SaaS, FinTech, eCommerce, HealthTech")
  .option(
    "--primary-regulation <regulation>",
    `Primary data-protection regulation.\n  Common values: ${REGULATION_LIST}`,
  )
  .option(
    "--secondary-regulation <regulation>",
    `Secondary regulation (optional).\n  Common values: ${REGULATION_LIST}`,
  )
  .option("--scope <scope>", "Install scope: global or project", "global")
  .addHelpText(
    "after",
    [
      "",
      "Examples:",
      "  # Interactive (default):",
      "  bunx @grant-vine/wunderkind install",
      "",
      "  # Non-interactive with inherited defaults:",
      "  bunx @grant-vine/wunderkind install --no-tui",
      "",
      "  # Non-interactive with explicit global baseline defaults:",
      "  bunx @grant-vine/wunderkind install --no-tui \\",
      "    --region='South Africa' --industry=SaaS --primary-regulation=POPIA",
      "",
      "  # EU SaaS:",
      "  bunx @grant-vine/wunderkind install --no-tui \\",
      "    --region=EU --industry=SaaS --primary-regulation=GDPR",
    ].join("\n"),
  )
  .action(async (opts: {
    tui: boolean
    scope: string
    region?: string | undefined
    industry?: string | undefined
    primaryRegulation?: string | undefined
    secondaryRegulation?: string | undefined
  }) => {
    if (opts.scope !== "global" && opts.scope !== "project") {
      console.error(`Error: --scope must be "global" or "project", got: "${opts.scope}"`)
      process.exit(1)
    }

    const args: InstallArgs = {
      tui: opts.tui,
      scope: opts.scope as InstallScope,
      region: opts.region,
      industry: opts.industry,
      primaryRegulation: opts.primaryRegulation,
      secondaryRegulation: opts.secondaryRegulation,
    }

    const exitCode = opts.tui ? await runTuiInstaller(opts.scope as InstallScope) : await runCliInstaller(args)
    process.exit(exitCode)
  })

program
  .command("upgrade")
  .description(
    [
      "Refresh Wunderkind-owned native assets without resetting project-local customizations.",
      "",
      "Refreshes native agents and skills for the selected scope, plus the global native commands.",
    ].join("\n"),
  )
  .option("--no-tui", "Reserved for future interactive upgrade support")
  .option("--scope <scope>", "Upgrade scope: global or project")
  .option("--dry-run", "Show what would be refreshed without writing files")
  .option("--refresh-config", "Rewrite Wunderkind config in canonical current format")
  .option("--caveman-enabled <yes|no>", "Set project-default caveman mode during project-scope upgrade")
  .addHelpText(
    "after",
    [
      "",
      "Example:",
      "  bunx @grant-vine/wunderkind upgrade --scope=global",
      "",
      "Current behavior:",
      "  - refreshes Wunderkind native agents and skills in the requested scope",
      "  - refreshes Wunderkind native commands globally",
      "  - preserves project-local soul/docs settings unless explicit config overrides are passed",
      "  - keeps hard-cut removals in place: no .sisyphus migration, no legacy oh-my-opencode config use, no retired skill aliases",
      "  - supports --dry-run and --refresh-config for safe testing",
      "  - project upgrades can set --caveman-enabled yes|no; global upgrades keep caveman session-scoped",
    ].join("\n"),
  )
  .action((opts: { scope?: string | undefined; dryRun?: boolean | undefined; refreshConfig?: boolean | undefined; cavemanEnabled?: string | undefined }) => {
    if (opts.scope !== undefined && opts.scope !== "global" && opts.scope !== "project") {
      console.error(`Error: --scope must be \"global\" or \"project\", got: \"${opts.scope}\"`)
      process.exit(1)
    }

    const cavemanEnabled = typeof opts.cavemanEnabled === "string"
      ? parseYesNoOption("--caveman-enabled", opts.cavemanEnabled)
      : undefined

    const upgradeArgs = {
      scope: (opts.scope as InstallScope | undefined) ?? "global",
      dryRun: opts.dryRun === true,
      refreshConfig: opts.refreshConfig === true,
      ...(cavemanEnabled !== undefined ? { cavemanEnabled } : {}),
    }

    runCliUpgrade(upgradeArgs).then((exitCode) => {
      process.exit(exitCode)
    })
  })

program
  .command("gitignore")
  .description(
      [
      "Add AI tooling traces to .gitignore in the current directory.",
      "",
      "Adds entries for: .wunderkind/, AGENTS.md, .omo/, .opencode/",
      "Historical .sisyphus/ directories are not managed by this command.",
      "Skips entries that are already present. Safe to run multiple times.",
      ].join("\n"),
  )
  .addHelpText(
    "after",
    [
      "",
      "Example:",
      "  bunx @grant-vine/wunderkind gitignore",
    ].join("\n"),
  )
  .action(() => {
    const result = addAiTracesToGitignore()
    if (!result.success) {
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
    if (result.added.length > 0) {
      console.log(`Added to .gitignore:`)
      for (const entry of result.added) {
        console.log(`  + ${entry}`)
      }
    }
    if (result.alreadyPresent.length > 0) {
      console.log(`Already in .gitignore:`)
      for (const entry of result.alreadyPresent) {
        console.log(`  ✓ ${entry}`)
      }
    }
    if (result.added.length === 0 && result.alreadyPresent.length > 0) {
      console.log("Nothing to add — all AI trace entries already present.")
    }
  })

program
  .command("init")
  .description(
    [
      "Initialize Wunderkind in the current project folder.",
      "",
      "Bootstraps project-local config, optional retained-persona SOUL files, and project artifact lanes (.omo/, AGENTS.md, docs README).",
      "Uses .omo/ as the primary project-working directory. If legacy .sisyphus/ artifacts still exist, move any needed files into .omo/ manually.",
      "Project-local config stays sparse and only stores values that intentionally override inherited defaults.",
      "Init also configures the PRD/planning workflow mode for this project.",
      "Requires Wunderkind to already be installed via `wunderkind install`.",
    ].join("\n"),
  )
  .option("--no-tui", "Run non-interactive project bootstrap")
  .option("--docs-enabled <yes|no>", "Enable docs output during init")
  .option("--docs-path <path>", "Docs output path (relative to current project)")
  .option("--doc-history-mode <mode>", "Doc history mode: overwrite | append-dated | new-dated-file | overwrite-archive")
  .option("--design-tool <none|google-stitch>", "Design workflow tool (none, google-stitch)", "none")
  .option("--design-path <path>", "Path for DESIGN.md file", "./DESIGN.md")
  .option("--stitch-setup <reuse|project-local|skip>", "Stitch MCP setup mode (reuse, project-local, skip)")
  .option("--stitch-api-key-file <path>", "Path to file containing Stitch API key")
  .option("--caveman-enabled <yes|no>", "Enable project-default caveman mode during init")
  .addHelpText(
    "after",
    [
      "",
      "Example:",
      "  bunx @grant-vine/wunderkind init --no-tui --docs-enabled=yes --docs-path=./docs",
      "",
      "PRD workflow modes:",
      "  - filesystem: writes PRDs/plans/issues into .omo/",
      "  - github: expects gh plus a GitHub-backed repo; doctor reports readiness",
    ].join("\n"),
  )
  .action(async (opts: {
    tui: boolean
    docsEnabled?: string | undefined
    docsPath?: string | undefined
    docHistoryMode?: string | undefined
    designTool?: string | undefined
    designPath?: string | undefined
    stitchSetup?: string | undefined
    stitchApiKeyFile?: string | undefined
    cavemanEnabled?: string | undefined
  }) => {
    let docsEnabled: boolean | undefined
    if (typeof opts.docsEnabled === "string") {
      const normalized = opts.docsEnabled.trim().toLowerCase()
      if (normalized === "yes" || normalized === "y" || normalized === "true") {
        docsEnabled = true
      } else if (normalized === "no" || normalized === "n" || normalized === "false") {
        docsEnabled = false
      } else {
        console.error(`Error: --docs-enabled must be yes|no, got: "${opts.docsEnabled}"`)
        process.exit(1)
      }
    }

    const cavemanEnabled = typeof opts.cavemanEnabled === "string"
      ? parseYesNoOption("--caveman-enabled", opts.cavemanEnabled)
      : undefined

    if (typeof opts.designTool === "string" && opts.designTool !== "none" && opts.designTool !== "google-stitch") {
      console.error(`Error: --design-tool must be "none" or "google-stitch", got: "${opts.designTool}"`)
      process.exit(1)
    }

    if (
      typeof opts.stitchSetup === "string"
      && opts.stitchSetup !== "reuse"
      && opts.stitchSetup !== "project-local"
      && opts.stitchSetup !== "skip"
    ) {
      console.error(
        `Error: --stitch-setup must be "reuse", "project-local", or "skip", got: "${opts.stitchSetup}"`,
      )
      process.exit(1)
    }

    const initOptions: {
      noTui: boolean
      docsEnabled?: boolean
      docsPath?: string
      docHistoryMode?: DocHistoryMode
      designTool?: string
      designPath?: string
      stitchSetup?: string
      stitchApiKeyFile?: string
      cavemanEnabled?: boolean
    } = {
      noTui: !opts.tui,
    }

    if (docsEnabled !== undefined) initOptions.docsEnabled = docsEnabled
    if (opts.docsPath !== undefined) initOptions.docsPath = opts.docsPath
    if (opts.docHistoryMode !== undefined) initOptions.docHistoryMode = opts.docHistoryMode as DocHistoryMode
    if (opts.designTool !== undefined) initOptions.designTool = opts.designTool
    if (opts.designPath !== undefined) initOptions.designPath = opts.designPath
    if (opts.stitchSetup !== undefined) initOptions.stitchSetup = opts.stitchSetup
    if (opts.stitchApiKeyFile !== undefined) initOptions.stitchApiKeyFile = opts.stitchApiKeyFile
    if (cavemanEnabled !== undefined) initOptions.cavemanEnabled = cavemanEnabled

    const exitCode = await runInit(initOptions)
    process.exit(exitCode)
  })

program
  .command("workflow-sync")
  .description(
    [
      "Synchronize a local .omo workflow plan into GitHub Issues.",
      "",
      "Dry-run by default. Pass --apply to create or update GitHub Issues and persist local workflow state.",
    ].join("\n"),
  )
  .option("--plan <path>", "Path to the local .omo workflow plan to synchronize")
  .option("--all", "Synchronize every direct-child .omo/plans/*.md workflow plan in lexicographic order")
  .option("--apply", "Create or update GitHub Issues and write local workflow state")
  .addHelpText(
    "after",
    [
      "",
      "Examples:",
      "  bunx @grant-vine/wunderkind workflow-sync --plan ./.omo/plans/my-plan.md",
      "  bunx @grant-vine/wunderkind workflow-sync --plan ./.omo/plans/my-plan.md --apply",
      "  bunx @grant-vine/wunderkind workflow-sync --all",
      "  bunx @grant-vine/wunderkind workflow-sync --all --apply",
      "",
      "Behavior:",
      "  - provide exactly one of --plan <path> or --all",
      "  - intended for projects using the GitHub PRD workflow mode and requires GitHub readiness",
      "  - keeps local workflow state authoritative",
      "  - stores machine-local sync state under .wunderkind/workflows/github-issues/",
      "  - refuses blind recreation when local or remote drift is detected",
    ].join("\n"),
  )
  .action(async (opts: { plan?: string | undefined; all?: boolean | undefined; apply?: boolean | undefined }) => {
    const workflowSyncOptions: { plan?: string; all?: boolean; apply: boolean } = {
      apply: opts.apply === true,
      ...(opts.plan !== undefined ? { plan: opts.plan } : {}),
      ...(opts.all === true ? { all: true } : {}),
    }

    const exitCode = await runWorkflowSync(workflowSyncOptions)
    process.exit(exitCode)
  })

program
  .command("token-audit")
  .description(
    [
      "Report deterministic prompt-surface size metrics for Wunderkind-owned assets.",
      "",
      "Read-only by design. Reports bytes, lines, and file counts from source-owned renderers and shipped markdown assets.",
    ].join("\n"),
  )
  .option("--surface <surface>", "Surface to audit: agents, commands, skills, or all", "agents")
  .option("--format <format>", "Output format: table or json", "table")
  .addHelpText(
    "after",
    [
      "",
      "Examples:",
      "  bunx @grant-vine/wunderkind token-audit",
      "  bunx @grant-vine/wunderkind token-audit --surface commands --format json",
      "",
      "Behavior:",
      "  - reads source-owned renderers and shipped markdown assets only",
      "  - does not mutate prompts, native assets, or project files",
      "  - reports deterministic bytes, lines, and file counts rather than model-specific token truth",
    ].join("\n"),
  )
  .action(async (opts: { surface?: string | undefined; format?: string | undefined }) => {
    const surface = opts.surface ?? "agents"
    const format = opts.format ?? "table"

    if (surface !== "agents" && surface !== "commands" && surface !== "skills" && surface !== "all") {
      console.error(`Error: --surface must be "agents", "commands", "skills", or "all", got: "${surface}"`)
      process.exit(1)
    }

    if (format !== "table" && format !== "json") {
      console.error(`Error: --format must be "table" or "json", got: "${format}"`)
      process.exit(1)
    }

    const exitCode = await runTokenAudit({
      surface,
      format,
    })
    process.exit(exitCode)
  })

program
  .command("migrate")
  .description(
    [
      `wunderkind migrate was removed in this hard-cut release.`,
      "",
      `Use ${PRIMARY_PROJECT_ARTIFACT_DIR}/ as the primary project-working directory and follow the printed corrective migration guidance for any remaining legacy artifacts.`,
    ].join("\n"),
  )
  .option("--dry-run", "Print the same corrective migration guidance without performing any file moves")
  .addHelpText(
    "after",
    [
      "",
      "Behavior:",
      "  bunx @grant-vine/wunderkind migrate",
      "  bunx @grant-vine/wunderkind migrate --dry-run",
      "",
      `Both forms fail with guidance only. Automated ${LEGACY_PROJECT_ARTIFACT_DIR}/ -> ${PRIMARY_PROJECT_ARTIFACT_DIR}/ moves are no longer supported.`,
    ].join("\n"),
  )
  .action(async (opts: { dryRun?: boolean | undefined }) => {
    const exitCode = await runProjectArtifactMigration({ dryRun: opts.dryRun === true })
    process.exit(exitCode)
  })

program
  .command("cleanup")
  .description(
    [
      "Remove Wunderkind project-local registration and state from the current project.",
      "",
      "Removes project-local OpenCode plugin wiring and the .wunderkind/ directory.",
      "Leaves AGENTS.md, .omo/, docs output, and shared global capabilities untouched.",
    ].join("\n"),
  )
  .action(async () => {
    const exitCode = await runProjectCleanup()
    process.exit(exitCode)
  })

program
  .command("doctor")
  .description("Run read-only diagnostics for Wunderkind install and current project context.")
  .option("-v, --verbose", "Enable verbose diagnostic output")
  .action(async (opts: { verbose?: boolean | undefined }) => {
    const exitCode = await runDoctorWithOptions({ verbose: opts.verbose === true })
    process.exit(exitCode)
  })

program
  .command("uninstall")
  .description(
    [
      "Safely remove Wunderkind plugin wiring from OpenCode config.",
      "",
      "Removes plugin registration and, on global uninstall, deletes Wunderkind's shared global capabilities and global config file.",
      "Optionally removes project-local Google Stitch MCP wiring when Wunderkind owns or reused the project entry.",
      "Leaves project-local customizations and bootstrap artifacts untouched.",
    ].join("\n"),
  )
  .option("--scope <scope>", "Uninstall scope: global or project")
  .option("--remove-mcp <ask|yes|no>", "Project-scope Stitch MCP removal mode: ask, yes, or no")
  .action(async (opts: { scope?: string | undefined; removeMcp?: string | undefined }) => {
    if (opts.scope !== undefined && opts.scope !== "global" && opts.scope !== "project") {
      console.error(`Error: --scope must be \"global\" or \"project\", got: \"${opts.scope}\"`)
      process.exit(1)
    }

    if (opts.removeMcp !== undefined && opts.removeMcp !== "ask" && opts.removeMcp !== "yes" && opts.removeMcp !== "no") {
      console.error(`Error: --remove-mcp must be "ask", "yes", or "no", got: "${opts.removeMcp}"`)
      process.exit(1)
    }

    const uninstallOptions: { scope?: InstallScope; removeMcp?: "ask" | "yes" | "no" } = {}
    if (opts.scope !== undefined) {
      uninstallOptions.scope = opts.scope as InstallScope
    }
    if (opts.removeMcp !== undefined) {
      uninstallOptions.removeMcp = opts.removeMcp
    }
    const exitCode = await runUninstall(uninstallOptions)
    process.exit(exitCode)
  })

if (process.argv.length <= 2) {
  program.outputHelp()
  process.exit(1)
}

program.parse()
