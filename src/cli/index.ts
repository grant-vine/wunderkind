#!/usr/bin/env node
import { Command } from "commander"
import { createRequire } from "node:module"
import { runCliInstaller } from "./cli-installer.js"
import { runTuiInstaller } from "./tui-installer.js"
import type { InstallArgs } from "./types.js"

const require = createRequire(import.meta.url)
const pkg = require("../../package.json") as { version: string }

const program = new Command()

program
  .name("wunderkind")
  .description("Install and configure the Wunderkind oh-my-opencode addon")
  .version(pkg.version)

program
  .command("install", { isDefault: true })
  .description("Install Wunderkind into your OpenCode setup")
  .option("--no-tui", "Run non-interactive CLI installer")
  .option("--region <region>", "Geographic region (e.g. 'South Africa')")
  .option("--industry <industry>", "Industry vertical (e.g. SaaS)")
  .option("--primary-regulation <regulation>", "Primary data-protection regulation (e.g. GDPR)")
  .option("--secondary-regulation <regulation>", "Secondary regulation (optional)")
  .option("--skip-auth", "Skip post-install auth instructions")
  .action(async (opts: {
    tui: boolean
    region?: string
    industry?: string
    primaryRegulation?: string
    secondaryRegulation?: string
    skipAuth?: boolean
  }) => {
    const args: InstallArgs = {
      tui: opts.tui,
      region: opts.region,
      industry: opts.industry,
      primaryRegulation: opts.primaryRegulation,
      secondaryRegulation: opts.secondaryRegulation,
    }

    const exitCode = opts.tui ? await runTuiInstaller() : await runCliInstaller(args)
    process.exit(exitCode)
  })

program.parse()
