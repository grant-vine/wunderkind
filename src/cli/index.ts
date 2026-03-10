#!/usr/bin/env node
import { Command } from "commander"
import { createRequire } from "node:module"
import { runCliInstaller } from "./cli-installer.js"
import { runDoctor } from "./doctor.js"
import { runInit } from "./init.js"
import { runTuiInstaller } from "./tui-installer.js"
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
      "Extends oh-my-openagent with twelve professional agents covering",
      "marketing, design, product, engineering, brand, QA, operations,",
      "security, devrel, legal, support, and data analysis — each",
      "pre-tuned to your region, industry, and data-protection regulation.",
      "",
      "Examples:",
      "  bunx @grant-vine/wunderkind",
      "  bunx @grant-vine/wunderkind install --no-tui \\",
      "    --region='South Africa' --industry=SaaS --primary-regulation=POPIA",
      "  bunx @grant-vine/wunderkind gitignore",
    ].join("\n"),
  )
  .version(pkg.version)

program
  .command("install", { isDefault: true })
  .description(
    [
      "Install Wunderkind into your OpenCode setup.",
      "",
      "Runs the interactive TUI by default. Pass --no-tui for",
      "non-interactive use in CI or scripted environments.",
    ].join("\n"),
  )
  .option("--no-tui", "Run non-interactive CLI installer (requires --region, --industry, --primary-regulation)")
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
      "  bunx @grant-vine/wunderkind",
      "",
      "  # Non-interactive:",
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
      "Bootstraps project-local config and soul files (.sisyphus, AGENTS.md, docs README).",
      "Requires Wunderkind to already be installed via `wunderkind install`.",
    ].join("\n"),
  )
  .option("--no-tui", "Run non-interactive project bootstrap")
  .option("--region <region>", "Geographic region, e.g. 'South Africa', 'United States', 'Global'")
  .option("--industry <industry>", "Industry vertical, e.g. SaaS, FinTech, eCommerce, HealthTech")
  .option(
    "--primary-regulation <regulation>",
    `Primary data-protection regulation.\n  Common values: ${REGULATION_LIST}`,
  )
  .option("--secondary-regulation <regulation>", "Secondary regulation (optional)")
  .option("--docs-enabled <yes|no>", "Enable docs output during init")
  .option("--docs-path <path>", "Docs output path (relative to current project)")
  .option("--doc-history-mode <mode>", "Doc history mode: overwrite | append-dated | new-dated-file | overwrite-archive")
  .addHelpText(
    "after",
    [
      "",
      "Example:",
      "  bunx @grant-vine/wunderkind init --no-tui --region=EU --industry=SaaS --primary-regulation=GDPR",
    ].join("\n"),
  )
  .action(async (opts: {
    tui: boolean
    region?: string | undefined
    industry?: string | undefined
    primaryRegulation?: string | undefined
    secondaryRegulation?: string | undefined
    docsEnabled?: string | undefined
    docsPath?: string | undefined
    docHistoryMode?: string | undefined
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

    const initOptions: {
      noTui: boolean
      region?: string
      industry?: string
      primaryRegulation?: string
      secondaryRegulation?: string
      docsEnabled?: boolean
      docsPath?: string
      docHistoryMode?: DocHistoryMode
    } = {
      noTui: !opts.tui,
    }

    if (opts.region !== undefined) initOptions.region = opts.region
    if (opts.industry !== undefined) initOptions.industry = opts.industry
    if (opts.primaryRegulation !== undefined) initOptions.primaryRegulation = opts.primaryRegulation
    if (opts.secondaryRegulation !== undefined) initOptions.secondaryRegulation = opts.secondaryRegulation
    if (docsEnabled !== undefined) initOptions.docsEnabled = docsEnabled
    if (opts.docsPath !== undefined) initOptions.docsPath = opts.docsPath
    if (opts.docHistoryMode !== undefined) initOptions.docHistoryMode = opts.docHistoryMode as DocHistoryMode

    const exitCode = await runInit(initOptions)
    process.exit(exitCode)
  })

program
  .command("doctor")
  .description("Run read-only diagnostics for Wunderkind install and current project context.")
  .action(async () => {
    const exitCode = await runDoctor()
    process.exit(exitCode)
  })

program.parse()
