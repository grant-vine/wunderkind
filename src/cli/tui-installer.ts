import { copyFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import * as p from "@clack/prompts"
import color from "picocolors"
import {
  addPluginToOpenCodeConfig,
  createMemoryFiles,
  detectCurrentConfig,
  detectLegacyConfig,
  writeWunderkindConfig,
} from "./config-manager/index.js"
import { addAiTracesToGitignore } from "./gitignore-manager.js"
import type {
  BrandPersonality,
  CisoPersonality,
  CmoPersonality,
  CreativePersonality,
  CtoPersonality,
  InstallScope,
  OpsPersonality,
  OrgStructure,
  ProductPersonality,
  QaPersonality,
  TeamCulture,
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

  const detected = detectCurrentConfig()
  const isUpdate = detected.isInstalled

  if (detectLegacyConfig()) {
    p.cancel(
      "Legacy config found at project root wunderkind.config.jsonc — move it to .wunderkind/wunderkind.config.jsonc",
    )
    return 1
  }

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

  const primaryRegulation = await promptRegulation(
    "What is your primary data-protection regulation?",
    detected.primaryRegulation,
    true,
  )
  if (primaryRegulation === null) return 1

  const secondaryRegulation = await promptRegulation(
    "Secondary regulation? (optional)",
    detected.secondaryRegulation,
    false,
  )
  if (secondaryRegulation === null) return 1

  p.log.step(color.bold("Team & Agent Personalities"))
  p.log.message("These shape how your agents communicate, challenge decisions, and handle conflict.")

  const teamCultureRaw = await p.select<TeamCulture>({
    message: "What's your team culture baseline?",
    options: [
      {
        value: "pragmatic-balanced",
        label: "Pragmatic & Balanced",
        hint: "Ship fast but don't cut corners. Debate is welcome, consensus is valued.",
      },
      {
        value: "formal-strict",
        label: "Formal & Strict",
        hint: "Process first. Rigour over speed. Every decision documented and justified.",
      },
      {
        value: "experimental-informal",
        label: "Experimental & Informal",
        hint: "Move fast, break things (sometimes). Bets over committees. High tolerance for ambiguity.",
      },
    ],
    initialValue: detected.teamCulture,
  })
  if (p.isCancel(teamCultureRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const orgStructureRaw = await p.select<OrgStructure>({
    message: "What's your org structure?",
    options: [
      {
        value: "flat",
        label: "Flat",
        hint: "All agents are peers. Conflicts escalate to you (the user).",
      },
      {
        value: "hierarchical",
        label: "Hierarchical",
        hint: "Domain authority applies. CTO owns engineering calls. CISO has hard veto on security. Unresolvable conflicts escalate to you.",
      },
    ],
    initialValue: detected.orgStructure,
  })
  if (p.isCancel(orgStructureRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  p.log.step(color.bold("Agent Personality Overrides") + color.dim(" (optional — press Enter to keep defaults)"))

  const cisoRaw = await p.select<CisoPersonality>({
    message: "CISO personality:",
    options: [
      {
        value: "pragmatic-risk-manager",
        label: "Pragmatic Risk Manager",
        hint: "Paranoid but practical. Prioritises by real-world exploitability. Recommends, not just red-flags.",
      },
      {
        value: "paranoid-enforcer",
        label: "Paranoid Enforcer",
        hint: "Everything is a threat until proven otherwise. Zero tolerance, zero exceptions.",
      },
      {
        value: "educator-collaborator",
        label: "Educator & Collaborator",
        hint: "Explains attack vectors, provides doc links, teaches the team to fish.",
      },
    ],
    initialValue: detected.cisoPersonality,
  })
  if (p.isCancel(cisoRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const ctoRaw = await p.select<CtoPersonality>({
    message: "CTO / Fullstack Engineer personality:",
    options: [
      {
        value: "code-archaeologist",
        label: "Code Archaeologist",
        hint: "Methodical, empathetic to legacy, understand before rewrite. Ships with confidence.",
      },
      {
        value: "grizzled-sysadmin",
        label: "Grizzled Sysadmin",
        hint: "Anti-hype, brutally pragmatic. Your container orchestration is just process management with YAML.",
      },
      {
        value: "startup-bro",
        label: "Startup Bro",
        hint: "Ship it. Tests are a Series B problem. Move fast, apologise if needed.",
      },
    ],
    initialValue: detected.ctoPersonality,
  })
  if (p.isCancel(ctoRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const cmoRaw = await p.select<CmoPersonality>({
    message: "CMO / Marketing personality:",
    options: [
      {
        value: "data-driven",
        label: "Data-Driven Performance Marketer",
        hint: "CAC, LTV, attribution. If you can't measure it, it doesn't exist.",
      },
      {
        value: "brand-storyteller",
        label: "Brand Storyteller",
        hint: "Products are features, brands are feelings. Narrative is the strategy.",
      },
      {
        value: "growth-hacker",
        label: "Growth Hacker",
        hint: "Channels, virality loops, PMF as religion. Every week is an experiment.",
      },
    ],
    initialValue: detected.cmoPersonality,
  })
  if (p.isCancel(cmoRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const qaRaw = await p.select<QaPersonality>({
    message: "QA Lead personality:",
    options: [
      {
        value: "risk-based-pragmatist",
        label: "Risk-Based Pragmatist",
        hint: "Test the happy path and top 3 failure modes. Ship, then harden.",
      },
      {
        value: "rule-enforcer",
        label: "Rule Enforcer",
        hint: "Zero merges without 80% coverage. No exceptions, no deadlines.",
      },
      {
        value: "rubber-duck",
        label: "Rubber Duck / Process Guide",
        hint: "Socratic. Makes you think through what could go wrong. Collaborative, not gatekeeping.",
      },
    ],
    initialValue: detected.qaPersonality,
  })
  if (p.isCancel(qaRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const productRaw = await p.select<ProductPersonality>({
    message: "VP Product personality:",
    options: [
      {
        value: "outcome-obsessed",
        label: "Outcome-Obsessed PM",
        hint: "I don't care about features. I care about whether users changed behaviour.",
      },
      {
        value: "user-advocate",
        label: "User Advocate",
        hint: "I am the customer's voice in every engineering meeting. Empathy first.",
      },
      {
        value: "velocity-optimizer",
        label: "Velocity Optimizer",
        hint: "Feature velocity as competitive moat. Fast > perfect.",
      },
    ],
    initialValue: detected.productPersonality,
  })
  if (p.isCancel(productRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const opsRaw = await p.select<OpsPersonality>({
    message: "Operations Lead personality:",
    options: [
      {
        value: "on-call-veteran",
        label: "On-Call Veteran",
        hint: "Calm, structured, incident-first. Classify before remediate. SEV2 until proven SEV1.",
      },
      {
        value: "efficiency-maximiser",
        label: "Efficiency Maximiser",
        hint: "Your cloud bill is 23% waste. Here's the Pareto fix. Toil is the enemy.",
      },
      {
        value: "process-purist",
        label: "Process Purist",
        hint: "DORA metrics, runbooks for everything. If it's not documented, it doesn't exist.",
      },
    ],
    initialValue: detected.opsPersonality,
  })
  if (p.isCancel(opsRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const creativeRaw = await p.select<CreativePersonality>({
    message: "Creative Director personality:",
    options: [
      {
        value: "pragmatic-problem-solver",
        label: "Pragmatic Problem Solver",
        hint: "Design solves real problems within real constraints. Ship beautiful work on time.",
      },
      {
        value: "perfectionist-craftsperson",
        label: "Perfectionist Craftsperson",
        hint: "Every pixel must earn its place. Pixel-perfect or not shipped.",
      },
      {
        value: "bold-provocateur",
        label: "Bold Provocateur",
        hint: "Push the boundaries. Safe is forgettable. The best designs divide opinion.",
      },
    ],
    initialValue: detected.creativePersonality,
  })
  if (p.isCancel(creativeRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const brandRaw = await p.select<BrandPersonality>({
    message: "Brand Builder personality:",
    options: [
      {
        value: "authentic-builder",
        label: "Authentic Builder",
        hint: "Build the brand by doing the work publicly. Genuine usefulness over polish.",
      },
      {
        value: "community-evangelist",
        label: "Community Evangelist",
        hint: "Community is infrastructure. Invest in it consistently. People first.",
      },
      {
        value: "pr-spinner",
        label: "PR Strategist",
        hint: "Narrative is everything. Every story angle, every journalist, every moment.",
      },
    ],
    initialValue: detected.brandPersonality,
  })
  if (p.isCancel(brandRaw)) {
    p.cancel("Installation cancelled.")
    return 1
  }

  const config = {
    region: (region as string).trim() || "Global",
    industry: (industry as string).trim(),
    primaryRegulation: primaryRegulation || "GDPR",
    secondaryRegulation: secondaryRegulation,
    teamCulture: teamCultureRaw,
    orgStructure: orgStructureRaw,
    cisoPersonality: cisoRaw,
    ctoPersonality: ctoRaw,
    cmoPersonality: cmoRaw,
    qaPersonality: qaRaw,
    productPersonality: productRaw,
    opsPersonality: opsRaw,
    creativePersonality: creativeRaw,
    brandPersonality: brandRaw,
  }

  const spinner = p.spinner()

  spinner.start("Adding wunderkind to OpenCode config")
  const pluginResult = addPluginToOpenCodeConfig(scope)
  if (!pluginResult.success) {
    spinner.stop(`Failed: ${pluginResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  spinner.stop(`Plugin added to ${color.cyan(pluginResult.configPath)}`)

  spinner.start("Writing wunderkind configuration")
  const configResult = writeWunderkindConfig(config, scope)
  if (!configResult.success) {
    spinner.stop(`Failed: ${configResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  spinner.stop(`Config written to ${color.cyan(configResult.configPath)}`)

  spinner.start("Creating agent memory files")
  const memoryResult = createMemoryFiles()
  if (!memoryResult.success) {
    spinner.stop(`Warning: ${memoryResult.error}`)
    p.log.warn("Memory files could not be created. Agents will work without persistent memory.")
  } else {
    spinner.stop(`Memory directory created at ${color.cyan(memoryResult.configPath)}`)
  }

  const gitignoreResult = addAiTracesToGitignore()
  if (gitignoreResult.added.length > 0) {
    p.log.info(`Added to .gitignore: ${gitignoreResult.added.join(", ")}`)
  }
  if (gitignoreResult.error) {
    p.log.warn(`Could not update .gitignore: ${gitignoreResult.error}`)
  }

  spinner.start("Setting up global memory services")
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
    spinner.stop(`Global memory services ready at ${color.cyan(globalDir)}`)
  } catch (err) {
    spinner.stop("Global memory services setup skipped")
    p.log.warn(`Could not copy docker-compose files: ${String(err)}`)
  }

  p.note(
    [
      `Region:              ${color.cyan(config.region)}`,
      `Industry:            ${color.cyan(config.industry || color.dim("(not set)"))}`,
      `Primary regulation:  ${color.cyan(config.primaryRegulation)}`,
      config.secondaryRegulation ? `Secondary:           ${color.cyan(config.secondaryRegulation)}` : "",
      ``,
      `Team culture:        ${color.cyan(config.teamCulture)}`,
      `Org structure:       ${color.cyan(config.orgStructure)}`,
      ``,
      `CISO:                ${color.cyan(config.cisoPersonality)}`,
      `CTO/Fullstack:       ${color.cyan(config.ctoPersonality)}`,
      `CMO/Marketing:       ${color.cyan(config.cmoPersonality)}`,
      `QA:                  ${color.cyan(config.qaPersonality)}`,
      `Product:             ${color.cyan(config.productPersonality)}`,
      `Ops:                 ${color.cyan(config.opsPersonality)}`,
      `Creative:            ${color.cyan(config.creativePersonality)}`,
      `Brand:               ${color.cyan(config.brandPersonality)}`,
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
