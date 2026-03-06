import * as p from "@clack/prompts"
import color from "picocolors"
import { addPluginToOpenCodeConfig, detectCurrentConfig, writeWunderkindConfig } from "./config-manager/index.js"

export async function runTuiInstaller(): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("Error: Interactive installer requires a TTY. Use --no-tui and pass flags directly.")
    return 1
  }

  const detected = detectCurrentConfig()
  const isUpdate = detected.isInstalled

  p.intro(color.bgMagenta(color.white(isUpdate ? " Wunderkind... Update " : " Wunderkind... Install ")))

  if (isUpdate) {
    p.log.info(
      `Existing configuration detected: Region=${detected.region}, Industry=${detected.industry || "(not set)"}`,
    )
  }

  const region = await p.text({
    message: "What region is your product based in?",
    placeholder: "Global",
    initialValue: detected.region,
    validate: (v) => (v.trim() ? undefined : "Region is required"),
  })
  if (p.isCancel(region)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const industry = await p.text({
    message: "What industry or vertical is your product in?",
    placeholder: "SaaS",
    initialValue: detected.industry,
  })
  if (p.isCancel(industry)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const primaryRegulation = await p.text({
    message: "What is your primary data-protection regulation?",
    placeholder: "GDPR",
    initialValue: detected.primaryRegulation,
    validate: (v) => (v.trim() ? undefined : "Primary regulation is required"),
  })
  if (p.isCancel(primaryRegulation)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const secondaryRegulation = await p.text({
    message: "Secondary regulation? (optional)",
    placeholder: "leave blank to skip",
    initialValue: detected.secondaryRegulation,
  })
  if (p.isCancel(secondaryRegulation)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const config = {
    region: (region as string).trim() || "Global",
    industry: (industry as string).trim(),
    primaryRegulation: (primaryRegulation as string).trim() || "GDPR",
    secondaryRegulation: (secondaryRegulation as string).trim(),
  }

  const spinner = p.spinner()

  spinner.start("Adding wunderkind to OpenCode config")
  const pluginResult = addPluginToOpenCodeConfig()
  if (!pluginResult.success) {
    spinner.stop(`Failed: ${pluginResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  spinner.stop(`Plugin added to ${color.cyan(pluginResult.configPath)}`)

  spinner.start("Writing wunderkind configuration")
  const configResult = writeWunderkindConfig(config)
  if (!configResult.success) {
    spinner.stop(`Failed: ${configResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  spinner.stop(`Config written to ${color.cyan(configResult.configPath)}`)

  p.note(
    [
      `Region:              ${color.cyan(config.region)}`,
      `Industry:            ${color.cyan(config.industry || color.dim("(not set)"))}`,
      `Primary regulation:  ${color.cyan(config.primaryRegulation)}`,
      config.secondaryRegulation ? `Secondary:           ${color.cyan(config.secondaryRegulation)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    isUpdate ? "Updated Configuration" : "Installation Complete",
  )

  p.log.success(color.bold(isUpdate ? "Configuration updated!" : "Installation complete!"))
  p.log.message(`Run ${color.cyan("opencode")} to start!`)

  p.outro(color.green("Wunderkind... Enjoy!"))

  return 0
}
