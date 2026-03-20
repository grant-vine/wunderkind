#!/usr/bin/env node
import { Command } from "commander"
import { createRequire } from "node:module"
import { runCliInstaller, runCliUpgrade } from "./cli-installer.js"
import { runDoctorWithOptions } from "./doctor.js"
import { runInit } from "./init.js"
import { runProjectCleanup } from "./cleanup.js"
import { runTuiInstaller } from "./tui-installer.js"
import { runUninstall } from "./uninstall.js"
import { addAiTracesToGitignore } from "./gitignore-manager.js"
import type { DocHistoryMode, InstallArgs, InstallScope } from "./types.js"

const require = createRequire(import.meta.url)
const pkg = require("../../package.json") as { version: string }

const REGULATION_LIST = "GDPR, POPIA, CCPA, LGPD, HIPAA, PIPEDA, PDPA, APPI, SOC2, ISO27001, or any custom value"

const program = new Command()

program
  .name("wunderkind")
  .description(
    [
      "Wunderkind — specialist AI agents for any software product team.",
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
  .version(pkg.version)
  .showHelpAfterError()

program
  .command("install")
  .description(
    [
      "Install Wunderkind into your OpenCode setup.",
      "",
      "Runs the interactive TUI by default. Pass --no-tui for",
      "non-interactive use in CI or scripted environments.",
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
      "  - supports --dry-run and --refresh-config for safe testing",
    ].join("\n"),
  )
  .action((opts: { scope?: string | undefined; dryRun?: boolean | undefined; refreshConfig?: boolean | undefined }) => {
    if (opts.scope !== undefined && opts.scope !== "global" && opts.scope !== "project") {
      console.error(`Error: --scope must be \"global\" or \"project\", got: \"${opts.scope}\"`)
      process.exit(1)
    }

    runCliUpgrade({
      scope: (opts.scope as InstallScope | undefined) ?? "global",
      dryRun: opts.dryRun === true,
      refreshConfig: opts.refreshConfig === true,
    }).then((exitCode) => {
      process.exit(exitCode)
    })
  })

program
  .command("gitignore")
  .description(
    [
      "Add AI tooling traces to .gitignore in the current directory.",
      "",
      "Adds entries for: .wunderkind/, AGENTS.md, .sisyphus/, .opencode/",
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
      "Bootstraps project-local config, optional retained-persona SOUL files, and soul files (.sisyphus, AGENTS.md, docs README).",
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
  .addHelpText(
    "after",
    [
      "",
      "Example:",
      "  bunx @grant-vine/wunderkind init --no-tui --docs-enabled=yes --docs-path=./docs",
      "",
      "PRD workflow modes:",
      "  - filesystem: writes PRDs/plans/issues into .sisyphus/",
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

    const exitCode = await runInit(initOptions)
    process.exit(exitCode)
  })

program
  .command("cleanup")
  .description(
    [
      "Remove Wunderkind project-local registration and state from the current project.",
      "",
      "Removes project-local OpenCode plugin wiring and the .wunderkind/ directory.",
      "Leaves AGENTS.md, .sisyphus/, docs output, and shared global capabilities untouched.",
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
