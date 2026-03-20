import * as p from "@clack/prompts"
import color from "picocolors"
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
import { isProjectContext, runInit } from "./init.js"
import type { InstallConfig, InstallScope } from "./types.js"

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
      `Existing configuration detected: Region=${scope === "project" ? detected.region : installBase.region}, Industry=${
        (scope === "project" ? detected.industry : installBase.industry) || "(not set)"
      }`,
    )
  }

  const effectiveBaseline = scope === "project"
    ? {
        region: detected.region,
        industry: detected.industry,
        primaryRegulation: detected.primaryRegulation,
        secondaryRegulation: detected.secondaryRegulation,
      }
    : {
        region: installBase.region,
        industry: installBase.industry,
        primaryRegulation: installBase.primaryRegulation,
        secondaryRegulation: installBase.secondaryRegulation,
      }

  const config: InstallConfig = {
    region: effectiveBaseline.region,
    industry: effectiveBaseline.industry,
    primaryRegulation: effectiveBaseline.primaryRegulation,
    secondaryRegulation: effectiveBaseline.secondaryRegulation,
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

  const spinner = p.spinner()

  spinner.start("Applying installation")
  
  const pluginResult = addPluginToOpenCodeConfig(scope)
  if (!pluginResult.success) {
    spinner.stop(color.red(`Failed to add plugin: ${pluginResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  const configResult = scope === "global" ? writeWunderkindConfig(config, scope) : null
  if (configResult && !configResult.success) {
    spinner.stop(color.red(`Failed to write config: ${configResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  spinner.stop("Installation applied successfully")

  const nativeAgentsResult = writeNativeAgentFiles(scope)
  if (!nativeAgentsResult.success) {
    spinner.stop(color.red(`Failed to write native agent files: ${nativeAgentsResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  const nativeCommandsResult = writeNativeCommandFiles()
  if (!nativeCommandsResult.success) {
    spinner.stop(color.red(`Failed to write native command files: ${nativeCommandsResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  const nativeSkillsResult = writeNativeSkillFiles(scope)
  if (!nativeSkillsResult.success) {
    spinner.stop(color.red(`Failed to write native skill files: ${nativeSkillsResult.error}`))
    p.outro(color.red("Installation failed."))
    return 1
  }

  p.log.success(`Plugin added to ${color.cyan(pluginResult.configPath)}`)
  if (configResult) {
    p.log.success(`Config written to ${color.cyan(configResult.configPath)}`)
  }
  p.log.success(`Native agents written to ${color.cyan(nativeAgentsResult.configPath)}`)
  p.log.success(`Global native commands written to ${color.cyan(nativeCommandsResult.configPath)}`)
  p.log.success(`Native skills written to ${color.cyan(nativeSkillsResult.configPath)}`)

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
      `Primary regulation:  ${color.cyan(config.primaryRegulation || color.dim("(not set)"))}`,
      config.secondaryRegulation ? `Secondary:           ${color.cyan(config.secondaryRegulation)}` : "",
      ``,
      `${color.dim("Use 'wunderkind init' for project-local market/regulation, team/personality, and docs settings.")}`,
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
