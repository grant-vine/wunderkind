import color from "picocolors"
import { copyFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import type { InstallArgs, InstallConfig } from "./types.js"
import { addPluginToOpenCodeConfig, detectCurrentConfig, detectLegacyConfig, writeWunderkindConfig } from "./config-manager/index.js"
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
  const maxWidth =
    Math.max(
      ...lines.map((line) => line.replace(/\u001b\[[0-9;]*m/g, "").length),
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
    const stripped = line.replace(/\u001b\[[0-9;]*m/g, "")
    const padding = maxWidth - stripped.length
    console.log(color.dim("│") + ` ${line}${" ".repeat(padding - 1)}` + color.dim("│"))
  }

  console.log(color.dim("└") + border + color.dim("┘"))
  console.log()
}

export function validateNonTuiArgs(args: InstallArgs): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!args.region) errors.push("--region is required (e.g. --region='South Africa')")
  if (!args.industry) errors.push("--industry is required (e.g. --industry=SaaS)")
  if (!args.primaryRegulation) errors.push("--primary-regulation is required (e.g. --primary-regulation=GDPR)")
  return { valid: errors.length === 0, errors }
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
      "Usage: bunx wunderkind install --no-tui --region='South Africa' --industry=SaaS --primary-regulation=POPIA",
    )
    console.log()
    return 1
  }

  const detected = detectCurrentConfig()
  if (detectLegacyConfig()) {
    printError("Legacy config found at project root wunderkind.config.jsonc — move it to .wunderkind/wunderkind.config.jsonc")
    return 1
  }
  const isUpdate = detected.isInstalled

  printHeader(isUpdate)

  const totalSteps = 4
  let step = 1

  const config: InstallConfig = {
    region: args.region ?? "Global",
    industry: args.industry ?? "",
    primaryRegulation: args.primaryRegulation ?? "GDPR",
    secondaryRegulation: args.secondaryRegulation ?? "",
    teamCulture: detected.teamCulture,
    orgStructure: detected.orgStructure,
    cisoPersonality: detected.cisoPersonality,
    ctoPersonality: detected.ctoPersonality,
    cmoPersonality: detected.cmoPersonality,
    qaPersonality: detected.qaPersonality,
    productPersonality: detected.productPersonality,
    opsPersonality: detected.opsPersonality,
    creativePersonality: detected.creativePersonality,
    brandPersonality: detected.brandPersonality,
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

  printStep(step++, totalSteps, "Updating .gitignore with AI tooling traces...")
  const gitignoreResult = addAiTracesToGitignore()
  if (gitignoreResult.added.length > 0) {
    printSuccess(`Added to .gitignore: ${gitignoreResult.added.join(", ")}`)
  }
  if (gitignoreResult.error) {
    printWarning(`Could not update .gitignore: ${gitignoreResult.error}`)
  }

  printStep(step++, totalSteps, "Copying docker-compose files...")
  try {
    const globalDir = path.join(homedir(), ".wunderkind")
    await mkdir(globalDir, { recursive: true })
    const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
    for (const f of ["docker-compose.vector.yml", "docker-compose.mem0.yml"]) {
      const dest = path.join(globalDir, f)
      if (!existsSync(dest)) {
        await copyFile(path.join(pkgRoot, f), dest)
      }
    }
    printSuccess("Docker-compose files copied to ~/.wunderkind/")
  } catch (err) {
    printWarning(`Could not copy docker-compose files: ${String(err)}`)
  }

  printBox(
    [
      `  ${color.bold("Region:")}              ${color.cyan(config.region)}`,
      `  ${color.bold("Industry:")}            ${color.cyan(config.industry || color.dim("(not set)"))}`,
      `  ${color.bold("Primary regulation:")} ${color.cyan(config.primaryRegulation)}`,
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
