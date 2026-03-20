import color from "picocolors"
import type { InstallArgs, InstallConfig, InstallScope } from "./types.js"
import {
  addPluginToOpenCodeConfig,
  detectCurrentConfig,
  detectLegacyConfig,
  getDefaultGlobalConfig,
  readWunderkindConfigForScope,
  writeNativeAgentFiles,
  writeNativeCommandFiles,
  writeNativeSkillFiles,
  writeWunderkindConfig,
} from "./config-manager/index.js"
import { addAiTracesToGitignore } from "./gitignore-manager.js"

export const SYMBOLS = {
  check: color.green("[OK]"),
  cross: color.red("[X]"),
  arrow: color.cyan("->"),
  bullet: color.dim("*"),
  info: color.blue("[i]"),
  warn: color.yellow("[!]"),
  star: color.yellow("*"),
}

export function printHeader(isUpdate: boolean): void {
  const mode = isUpdate ? "Update" : "Install"
  console.log()
  console.log(color.bgMagenta(color.white(` Wunderkind... ${mode} `)))
  console.log()
}

export function printStep(step: number, total: number, message: string): void {
  console.log(`${color.dim(`[${step}/${total}]`)} ${message}`)
}

export function printSuccess(message: string): void {
  console.log(`${SYMBOLS.check} ${message}`)
}

export function printError(message: string): void {
  console.log(`${SYMBOLS.cross} ${color.red(message)}`)
}

export function printInfo(message: string): void {
  console.log(`${SYMBOLS.info} ${message}`)
}

export function printWarning(message: string): void {
  console.log(`${SYMBOLS.warn} ${color.yellow(message)}`)
}

export function printBox(content: string, title?: string): void {
  const lines = content.split("\n")
  const ansiPattern = new RegExp("\\u001b\\[[0-9;]*m", "g")
  const maxWidth =
    Math.max(
      ...lines.map((line) => line.replace(ansiPattern, "").length),
      title?.length ?? 0,
    ) + 4
  const border = color.dim("─".repeat(maxWidth))

  console.log()
  if (title) {
    console.log(
      color.dim("┌─") +
        color.bold(` ${title} `) +
        color.dim("─".repeat(maxWidth - title.length - 4)) +
        color.dim("┐"),
    )
  } else {
    console.log(color.dim("┌") + border + color.dim("┐"))
  }

  for (const line of lines) {
    const stripped = line.replace(ansiPattern, "")
    const padding = maxWidth - stripped.length
    console.log(color.dim("│") + ` ${line}${" ".repeat(padding - 1)}` + color.dim("│"))
  }

  console.log(color.dim("└") + border + color.dim("┘"))
  console.log()
}

export function validateNonTuiArgs(_args: InstallArgs): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] }
}

export interface UpgradeArgs {
  scope: InstallScope
  dryRun?: boolean
  refreshConfig?: boolean
  region?: string
  industry?: string
  primaryRegulation?: string
  secondaryRegulation?: string
}

export async function runCliInstaller(args: InstallArgs): Promise<number> {
  const validation = validateNonTuiArgs(args)
  if (!validation.valid) {
    printHeader(false)
    printError("Validation failed:")
    for (const err of validation.errors) {
      console.log(`  ${SYMBOLS.bullet} ${err}`)
    }
    console.log()
    printInfo(
      "Usage: bunx wunderkind install --no-tui [--region='South Africa'] [--industry=SaaS] [--primary-regulation=POPIA]",
    )
    console.log()
    return 1
  }

  const detected = detectCurrentConfig()
  if (detectLegacyConfig()) {
    printError("Legacy config found at project root wunderkind.config.jsonc — move it to .wunderkind/wunderkind.config.jsonc")
    return 1
  }
  const isUpdate = args.scope === "project" ? detected.projectInstalled === true : detected.globalInstalled === true

  printHeader(isUpdate)

  const totalSteps = 3
  let step = 1

  const config: InstallConfig = {
    region: args.region ?? detected.region ?? "Global",
    industry: args.industry ?? detected.industry ?? "",
    primaryRegulation: args.primaryRegulation ?? detected.primaryRegulation ?? "",
    secondaryRegulation: args.secondaryRegulation ?? detected.secondaryRegulation ?? "",
    teamCulture: detected.teamCulture,
    orgStructure: detected.orgStructure,
    cisoPersonality: detected.cisoPersonality,
    ctoPersonality: detected.ctoPersonality,
    cmoPersonality: detected.cmoPersonality,
    productPersonality: detected.productPersonality,
    creativePersonality: detected.creativePersonality,
    legalPersonality: detected.legalPersonality,
    docsEnabled: detected.docsEnabled,
    docsPath: detected.docsPath,
    docHistoryMode: detected.docHistoryMode,
    prdPipelineMode: detected.prdPipelineMode,
  }

  printStep(step++, totalSteps, "Adding wunderkind to OpenCode config...")
  const pluginResult = addPluginToOpenCodeConfig(args.scope)
  if (!pluginResult.success) {
    printError(`Failed: ${pluginResult.error}`)
    return 1
  }
  printSuccess(`Plugin ${isUpdate ? "verified" : "added"} ${SYMBOLS.arrow} ${color.dim(pluginResult.configPath)}`)

  printStep(step++, totalSteps, "Writing wunderkind configuration...")
  const configResult = writeWunderkindConfig(config, args.scope)
  if (!configResult.success) {
    printError(`Failed: ${configResult.error}`)
    return 1
  }
  printSuccess(`Config written ${SYMBOLS.arrow} ${color.dim(configResult.configPath)}`)

  const nativeAgentsResult = writeNativeAgentFiles(args.scope)
  if (!nativeAgentsResult.success) {
    printError(`Failed to write native agent files: ${nativeAgentsResult.error}`)
    return 1
  }
  printSuccess(`Native agents written ${SYMBOLS.arrow} ${color.dim(nativeAgentsResult.configPath)}`)

  const nativeCommandsResult = writeNativeCommandFiles()
  if (!nativeCommandsResult.success) {
    printError(`Failed to write native command files: ${nativeCommandsResult.error}`)
    return 1
  }
  printSuccess(`Global native commands written ${SYMBOLS.arrow} ${color.dim(nativeCommandsResult.configPath)}`)

  const nativeSkillsResult = writeNativeSkillFiles(args.scope)
  if (!nativeSkillsResult.success) {
    printError(`Failed to write native skill files: ${nativeSkillsResult.error}`)
    return 1
  }
  printSuccess(`Native skills written ${SYMBOLS.arrow} ${color.dim(nativeSkillsResult.configPath)}`)

  printStep(step++, totalSteps, "Updating .gitignore with AI tooling traces...")
  const gitignoreResult = addAiTracesToGitignore()
  if (gitignoreResult.added.length > 0) {
    printSuccess(`Added to .gitignore: ${gitignoreResult.added.join(", ")}`)
  }
  if (gitignoreResult.error) {
    printWarning(`Could not update .gitignore: ${gitignoreResult.error}`)
  }

  printBox(
    [
      `  ${color.bold("Region:")}              ${color.cyan(config.region)}`,
      `  ${color.bold("Industry:")}            ${color.cyan(config.industry || color.dim("(not set)"))}`,
      `  ${color.bold("Primary regulation:")} ${color.cyan(config.primaryRegulation || color.dim("(not set)"))}`,
      config.secondaryRegulation ? `  ${color.bold("Secondary:")}           ${color.cyan(config.secondaryRegulation)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    isUpdate ? "Updated Configuration" : "Installation Complete",
  )

  console.log(`${SYMBOLS.star} ${color.bold(color.green(isUpdate ? "Configuration updated!" : "Installation complete!"))}`)
  console.log(`  Run ${color.cyan("opencode")} to start!`)
  console.log()

  return 0
}

export async function runCliUpgrade(args: UpgradeArgs): Promise<number> {
  const detected = detectCurrentConfig()
  if (detectLegacyConfig()) {
    printError("Legacy config found at project root wunderkind.config.jsonc — move it to .wunderkind/wunderkind.config.jsonc")
    return 1
  }

  const installedInScope = args.scope === "project" ? detected.projectInstalled === true : detected.globalInstalled === true
  if (!installedInScope) {
    printHeader(false)
    printError(
      args.scope === "project"
        ? "Wunderkind is not installed in the project scope. Did you mean 'wunderkind install --scope=project'?"
        : "Wunderkind is not installed in the global scope. Did you mean 'wunderkind install --scope=global'?",
    )
    return 1
  }

  printHeader(true)

  const defaults = getDefaultGlobalConfig()
  const persisted = readWunderkindConfigForScope(args.scope) ?? {}
  const effectiveBaseline = args.scope === "project"
    ? {
        region: detected.region,
        industry: detected.industry,
        primaryRegulation: detected.primaryRegulation,
        secondaryRegulation: detected.secondaryRegulation,
      }
    : {
        region: persisted.region ?? defaults.region,
        industry: persisted.industry ?? defaults.industry,
        primaryRegulation: persisted.primaryRegulation ?? defaults.primaryRegulation,
        secondaryRegulation: persisted.secondaryRegulation ?? defaults.secondaryRegulation,
      }
  const nextConfig = {
    region: args.region ?? effectiveBaseline.region,
    industry: args.industry ?? effectiveBaseline.industry,
    primaryRegulation: args.primaryRegulation ?? effectiveBaseline.primaryRegulation,
    secondaryRegulation: args.secondaryRegulation ?? effectiveBaseline.secondaryRegulation,
  }

  const isNoop =
    nextConfig.region === effectiveBaseline.region &&
    nextConfig.industry === effectiveBaseline.industry &&
    nextConfig.primaryRegulation === effectiveBaseline.primaryRegulation &&
    nextConfig.secondaryRegulation === effectiveBaseline.secondaryRegulation

  if (args.dryRun === true) {
    printInfo(`Dry run: would refresh native agents in ${args.scope} scope`)
    printInfo("Dry run: would refresh global native commands")
    printInfo(`Dry run: would refresh native skills in ${args.scope} scope`)
    if (args.refreshConfig === true || !isNoop) {
      printInfo(`Dry run: would rewrite Wunderkind config in ${args.scope} scope`)
    }
    return 0
  }

  if (args.refreshConfig === true || !isNoop) {
    const configForWrite: InstallConfig = {
      ...persisted,
      ...detected,
      ...nextConfig,
    }

    const configResult = writeWunderkindConfig(configForWrite, args.scope)

    if (!configResult.success) {
      printError(`Failed: ${configResult.error}`)
      return 1
    }

    printSuccess(`${args.scope === "global" ? "Global baseline" : "Project config"} updated ${SYMBOLS.arrow} ${color.dim(configResult.configPath)}`)
  }

  const nativeAgentsResult = writeNativeAgentFiles(args.scope)
  if (!nativeAgentsResult.success) {
    printError(`Failed to refresh native agent files: ${nativeAgentsResult.error}`)
    return 1
  }

  const nativeCommandsResult = writeNativeCommandFiles()
  if (!nativeCommandsResult.success) {
    printError(`Failed to refresh native command files: ${nativeCommandsResult.error}`)
    return 1
  }

  const nativeSkillsResult = writeNativeSkillFiles(args.scope)
  if (!nativeSkillsResult.success) {
    printError(`Failed to refresh native skill files: ${nativeSkillsResult.error}`)
    return 1
  }

  if (args.scope === "project" && detected.designMcpOwnership === "wunderkind-managed") {
    type McpHelpersModule = typeof import("./mcp-helpers.js")
    const mcpHelpersModuleUrl = new URL("./mcp-helpers.js", import.meta.url)
    mcpHelpersModuleUrl.searchParams.set("cli-upgrade-stitch", "1")
    const { mergeStitchMcpConfig } = (await import(mcpHelpersModuleUrl.href)) as McpHelpersModule
    await mergeStitchMcpConfig(process.cwd())
  }

  printSuccess(`Native agents refreshed ${SYMBOLS.arrow} ${color.dim(nativeAgentsResult.configPath)}`)
  printSuccess(`Global native commands refreshed ${SYMBOLS.arrow} ${color.dim(nativeCommandsResult.configPath)}`)
  printSuccess(`Native skills refreshed ${SYMBOLS.arrow} ${color.dim(nativeSkillsResult.configPath)}`)
  printBox(
    [
      `  ${color.bold("Scope:")}               ${color.cyan(args.scope)}`,
      `  ${color.bold("Region:")}              ${color.cyan(nextConfig.region)}`,
      `  ${color.bold("Industry:")}            ${color.cyan(nextConfig.industry || color.dim("(not set)"))}`,
      `  ${color.bold("Primary regulation:")} ${color.cyan(nextConfig.primaryRegulation || color.dim("(not set)"))}`,
      nextConfig.secondaryRegulation
        ? `  ${color.bold("Secondary:")}           ${color.cyan(nextConfig.secondaryRegulation)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    "Upgrade Complete",
  )

  return 0
}
