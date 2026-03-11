import * as p from "@clack/prompts"
import color from "picocolors"
import {
  addPluginToOpenCodeConfig,
  detectCurrentConfig,
  detectLegacyConfig,
  getDefaultGlobalConfig,
  readWunderkindConfigForScope,
  writeNativeAgentFiles,
  writeWunderkindConfig,
} from "./config-manager/index.js"
import { addAiTracesToGitignore } from "./gitignore-manager.js"
import { isProjectContext, runInit } from "./init.js"
import type {
  InstallScope,
} from "./types.js"

const COMMON_REGULATIONS = [
  { value: "GDPR", label: "GDPR", hint: "EU General Data Protection Regulation" },
  { value: "POPIA", label: "POPIA", hint: "South Africa Protection of Personal Information Act" },
  { value: "CCPA", label: "CCPA", hint: "California Consumer Privacy Act" },
  { value: "LGPD", label: "LGPD", hint: "Brazil Lei Geral de Proteção de Dados" },
  { value: "HIPAA", label: "HIPAA", hint: "US Health Insurance Portability and Accountability Act" },
  { value: "PIPEDA", label: "PIPEDA", hint: "Canada Personal Information Protection and Electronic Documents Act" },
  { value: "PDPA", label: "PDPA", hint: "Thailand/Singapore Personal Data Protection Act" },
  { value: "APPI", label: "APPI", hint: "Japan Act on the Protection of Personal Information" },
  { value: "SOC2", label: "SOC 2", hint: "AICPA Service Organization Control 2" },
  { value: "ISO27001", label: "ISO 27001", hint: "Information security management standard" },
  { value: "__other__", label: "Enter manually…", hint: "Type a custom regulation name" },
] as const

async function promptRegulation(message: string, initialValue: string, isRequired: boolean): Promise<string | null> {
  const knownValues = COMMON_REGULATIONS.map((r) => r.value).filter((v) => v !== "__other__")
  const initial = knownValues.includes(initialValue as typeof knownValues[number]) ? initialValue : "__other__"

  const selection = await p.select({
    message,
    options: COMMON_REGULATIONS as unknown as Array<{ value: string; label: string; hint?: string }>,
    initialValue: initial,
  })

  if (p.isCancel(selection)) {
    p.cancel("Installation cancelled.")
    return null
  }

  if (selection !== "__other__") {
    return selection as string
  }

  const custom = isRequired
    ? await p.text({
        message: "Enter regulation name:",
        placeholder: "GDPR",
        initialValue: knownValues.includes(initialValue as typeof knownValues[number]) ? "" : initialValue,
        validate: (v) => (v.trim() ? undefined : "Regulation name is required"),
      })
    : await p.text({
        message: "Enter regulation name:",
        placeholder: "leave blank to skip",
        initialValue: knownValues.includes(initialValue as typeof knownValues[number]) ? "" : initialValue,
      })

  if (p.isCancel(custom)) {
    p.cancel("Installation cancelled.")
    return null
  }

  return (custom as string).trim()
}

export async function runTuiInstaller(scopeHint?: InstallScope): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("Error: Interactive installer requires a TTY. Use --no-tui and pass flags directly.")
    return 1
  }

  p.intro(color.bgMagenta(color.white(" Wunderkind... Install ")))

  const scopeRaw = await p.select<InstallScope>({
    message: "Install scope:",
    options: [
      {
        value: "global",
        label: "Global",
        hint: "Adds wunderkind to ~/.config/opencode/opencode.json — available in all projects",
      },
      {
        value: "project",
        label: "Project",
        hint: "Adds wunderkind to ./opencode.json — scoped to this project only",
      },
    ],
    initialValue: scopeHint ?? "global",
  })
  if (p.isCancel(scopeRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }
  const scope = scopeRaw

  const inProjectContext = isProjectContext(process.cwd())
  let shouldInitProjectNow = false
  let shouldUpdateGitignore = false
  if (inProjectContext) {
    const initNow = await p.confirm({
      message: "Initialize the current project now?",
      initialValue: scope === "project",
    })
    if (p.isCancel(initNow)) {
      p.cancel("Installation cancelled.")
      return 1
    }
    shouldInitProjectNow = initNow

    if (shouldInitProjectNow) {
      const updateGit = await p.confirm({
        message: "Add AI tooling traces to .gitignore?",
        initialValue: true,
      })
      if (p.isCancel(updateGit)) {
        p.cancel("Installation cancelled.")
        return 1
      }
      shouldUpdateGitignore = updateGit
    }
  }

  const detected = detectCurrentConfig()
  const defaults = getDefaultGlobalConfig()
  const scopedConfig = readWunderkindConfigForScope(scope)
  const installBase = {
    ...defaults,
    ...(scopedConfig ?? {}),
  }
  const isUpdate = scope === "project" ? detected.projectInstalled === true : detected.globalInstalled === true

  if (detectLegacyConfig()) {
    p.cancel(
      "Legacy config found at project root wunderkind.config.jsonc — move it to .wunderkind/wunderkind.config.jsonc",
    )
    return 1
  }

  if (isUpdate) {
    p.log.info(
      `Existing configuration detected: Region=${installBase.region}, Industry=${installBase.industry || "(not set)"}`,
    )
  }

  const region = await p.text({
    message: "What region is your product based in?",
    placeholder: "Global",
    initialValue: installBase.region,
    validate: (v) => (v.trim() ? undefined : "Region is required"),
  })
  if (p.isCancel(region)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const industry = await p.text({
    message: "What industry or vertical is your product in?",
    placeholder: "SaaS",
    initialValue: installBase.industry,
  })
  if (p.isCancel(industry)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const primaryRegulation = await promptRegulation(
    "What is your primary data-protection regulation?",
    installBase.primaryRegulation,
    true,
  )
  if (primaryRegulation === null) return 1

  const secondaryRegulation = await promptRegulation(
    "Secondary regulation? (optional)",
    installBase.secondaryRegulation,
    false,
  )
  if (secondaryRegulation === null) return 1

  const config = {
    region: (region as string).trim() || "Global",
    industry: (industry as string).trim(),
    primaryRegulation: primaryRegulation || "GDPR",
    secondaryRegulation: secondaryRegulation,
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
    devrelPersonality: detected.devrelPersonality,
    legalPersonality: detected.legalPersonality,
    supportPersonality: detected.supportPersonality,
    dataAnalystPersonality: detected.dataAnalystPersonality,
    docsEnabled: detected.docsEnabled,
    docsPath: detected.docsPath,
    docHistoryMode: detected.docHistoryMode,
  }

  const spinner = p.spinner()

  spinner.start("Applying configuration")
  
  const pluginResult = addPluginToOpenCodeConfig(scope)
  if (!pluginResult.success) {
    spinner.stop(color.red(`Failed to add plugin: ${pluginResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  const configResult = writeWunderkindConfig(config, scope)
  if (!configResult.success) {
    spinner.stop(color.red(`Failed to write config: ${configResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  spinner.stop("Configuration applied successfully")

  const nativeAgentsResult = writeNativeAgentFiles(scope)
  if (!nativeAgentsResult.success) {
    spinner.stop(color.red(`Failed to write native agent files: ${nativeAgentsResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  p.log.success(`Plugin added to ${color.cyan(pluginResult.configPath)}`)
  p.log.success(`Config written to ${color.cyan(configResult.configPath)}`)
  p.log.success(`Native agents written to ${color.cyan(nativeAgentsResult.configPath)}`)

  if (shouldUpdateGitignore) {
    const gitignoreResult = addAiTracesToGitignore()
    if (gitignoreResult.added.length > 0) {
      p.log.success(`Added ${gitignoreResult.added.length} entries to ${color.cyan(".gitignore")}`)
    } else if (!gitignoreResult.error) {
      p.log.info(color.dim(".gitignore already contains AI tooling traces"))
    }
    if (gitignoreResult.error) {
      p.log.warn(`Could not update .gitignore: ${gitignoreResult.error}`)
    }
  }

  p.note(
    [
      `Scope:               ${color.cyan(scope)}`,
      `Region:              ${color.cyan(config.region)}`,
      `Industry:            ${color.cyan(config.industry || color.dim("(not set)"))}`,
      `Primary regulation:  ${color.cyan(config.primaryRegulation)}`,
      config.secondaryRegulation ? `Secondary:           ${color.cyan(config.secondaryRegulation)}` : "",
      ``,
      `${color.dim("Advanced team/personality and docs settings are managed via 'wunderkind init'.")}`,
    ]
      .filter(Boolean)
      .join("\n"),
    isUpdate ? "Updated Setup" : "Installation Setup",
  )

  if (shouldInitProjectNow) {
    p.log.message(`\n${color.bold("→ Handoff to Project Initialization")}`)
    const initExitCode = await runInit({
      noTui: false,
      docsEnabled: config.docsEnabled,
      docsPath: config.docsPath,
      docHistoryMode: config.docHistoryMode,
    })
    if (initExitCode !== 0) {
      p.log.warn("Install succeeded, but project initialization failed.")
      p.outro(color.yellow("Wunderkind install complete with init warning."))
      return initExitCode
    }
    p.log.success("Current project initialized.")
  }

  p.outro(
    `${color.green("✔ Wunderkind... Enjoy!")}\n\n` +
    `  Run ${color.cyan("opencode")} to start your session.`
  )

  return 0
}
