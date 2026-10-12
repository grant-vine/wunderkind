import { mkdirSync, mkdtempSync, readdirSync, realpathSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs"
import { get } from "node:https"
import { dirname, join, resolve } from "node:path"
import { getMissingCodexSkillDependencies, type CodexCompanionReport } from "./companions.js"
import { resolveCodexPaths } from "./paths.js"
import { lstatOrMissing } from "./state.js"

const SOURCE_REF = "49dd158d1076134a641b33efb035946536778336"
const SOURCE_URL = `https://raw.githubusercontent.com/mattpocock/skills/${SOURCE_REF}`
const SOURCES: Readonly<Record<string, { readonly directory: string; readonly files: readonly string[] }>> = {
  "codebase-design": { directory: "skills/engineering/codebase-design", files: ["SKILL.md", "DEEPENING.md", "DESIGN-IT-TWICE.md", "agents/openai.yaml"] },
  grilling: { directory: "skills/productivity/grilling", files: ["SKILL.md", "agents/openai.yaml"] },
  "domain-modeling": { directory: "skills/engineering/domain-modeling", files: ["SKILL.md", "ADR-FORMAT.md", "GLOSSARY-FORMAT.md", "agents/openai.yaml"] },
}

export class CodexCompanionRepairError extends Error {
  readonly name = "CodexCompanionRepairError"
}

export interface CodexCompanionRepairResult {
  readonly schemaVersion: 1
  readonly status: "planned" | "repaired" | "current"
  readonly skills: readonly string[]
  readonly remainingDependencies: CodexCompanionReport["missingSkillDependencies"]
}

type CompanionDownload = (url: string) => Promise<string>
let downloadOverride: CompanionDownload | undefined

function downloadFile(url: string): Promise<string> {
  return new Promise((resolveDownload, reject) => {
    const request = get(url, { signal: AbortSignal.timeout(15_000) }, (response) => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new CodexCompanionRepairError(`Supporting-skill download failed (HTTP ${response.statusCode ?? "unknown"}). Retry repair when upstream is reachable.`))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (size > 256 * 1024) response.destroy(new CodexCompanionRepairError("Supporting-skill download exceeded its size limit."))
        else chunks.push(chunk)
      })
      response.on("end", () => resolveDownload(Buffer.concat(chunks).toString("utf8")))
      response.on("error", reject)
    })
    request.on("error", reject)
  })
}

function requireSafeDirectory(path: string): void {
  const stat = lstatOrMissing(path)
  if (stat === undefined) {
    const parent = dirname(path)
    if (parent !== path) requireSafeDirectory(parent)
    return
  }
  if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(path) !== resolve(path)) {
    throw new CodexCompanionRepairError(`Repair requires a regular directory without linked ancestors: ${path}`)
  }
}

function requireMissingDestination(root: string, skill: string): void {
  requireSafeDirectory(root)
  if (lstatOrMissing(join(root, skill)) !== undefined) {
    throw new CodexCompanionRepairError(`Supporting skill ${skill} already exists in the Codex skills directory. Preserve or move its existing contents before repair; nothing was overwritten.`)
  }
}

function installSupportingSkill(root: string, skill: string, files: readonly { readonly name: string; readonly content: string }[]): void {
  requireMissingDestination(root, skill)
  const staging = mkdtempSync(join(root, ".wunderkind-repair-"))
  const destination = join(root, skill)
  try {
    for (const file of files) {
      const path = join(staging, file.name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, file.content, { encoding: "utf8", flag: "wx" })
    }
    writeFileSync(join(staging, "UPSTREAM-SOURCE.json"), `${JSON.stringify({ repository: "mattpocock/skills", ref: SOURCE_REF }, null, 2)}\n`, { flag: "wx" })
    requireMissingDestination(root, skill)
    mkdirSync(destination)
    const reserved = lstatOrMissing(destination)
    try { renameSync(staging, destination) }
    catch (error) {
      const current = lstatOrMissing(destination)
      if (current?.ino === reserved?.ino && current?.dev === reserved?.dev && current?.isDirectory() && !current.isSymbolicLink() && readdirSync(destination).length === 0) rmdirSync(destination)
      throw error
    }
  } finally { rmSync(staging, { recursive: true, force: true }) }
}

export async function repairCodexCompanions(options: { readonly dryRun?: boolean } = {}): Promise<CodexCompanionRepairResult> {
  const root = join(resolveCodexPaths().codexHome, "skills")
  requireSafeDirectory(root)
  const missing = getMissingCodexSkillDependencies()
  const skills = [...new Set(missing.flatMap((dependency) => dependency.missingSkills))].sort()
  for (const skill of skills) {
    if (!Object.hasOwn(SOURCES, skill)) throw new CodexCompanionRepairError(`Unsupported supporting skill: ${skill}. Install it through its upstream owner, then rerun repair.`)
    requireMissingDestination(root, skill)
  }
  if (options.dryRun === true || skills.length === 0) {
    return { schemaVersion: 1, status: skills.length === 0 ? "current" : "planned", skills, remainingDependencies: missing }
  }
  const download = downloadOverride ?? downloadFile
  const license = await download(`${SOURCE_URL}/LICENSE`)
  const payloads = await Promise.all(skills.map(async (skill) => {
    const source = SOURCES[skill]
    if (source === undefined) throw new CodexCompanionRepairError(`Unsupported supporting skill: ${skill}`)
    const files = await Promise.all(source.files.map(async (name) => ({ name, content: await download(`${SOURCE_URL}/${source.directory}/${name}`) })))
    const main = files.find((file) => file.name === "SKILL.md")
    if (main === undefined || !new RegExp(`^name:\\s*${skill}\\s*$`, "m").test(main.content)) throw new CodexCompanionRepairError(`Upstream supporting skill ${skill} has an unexpected identity.`)
    return { skill, files: [...files, { name: "LICENSE", content: license }] }
  }))
  for (const skill of skills) requireMissingDestination(root, skill)
  mkdirSync(root, { recursive: true })
  for (const payload of payloads) installSupportingSkill(root, payload.skill, payload.files)
  const remainingDependencies = getMissingCodexSkillDependencies()
  if (remainingDependencies.length > 0) throw new CodexCompanionRepairError("Some supporting dependencies remain unresolved after repair. Run `wunderkind codex doctor` for details.")
  return { schemaVersion: 1, status: "repaired", skills, remainingDependencies }
}

export async function runCodexCompanionRepair(options: { readonly dryRun?: boolean; readonly json?: boolean } = {}): Promise<number> {
  const result = await repairCodexCompanions(options)
  if (options.json === true) console.log(JSON.stringify(result))
  else if (result.status === "current") console.log("No missing supporting skills need repair.")
  else {
    console.log(`${result.status === "planned" ? "Would install" : "Installed"} supporting skills: ${result.skills.join(", ")}.`)
    if (result.status === "repaired") console.log("Supporting dependencies verified. Start a new Codex task to load the installed skills.")
  }
  return 0
}

export function __setCompanionDownloadForTests(download: CompanionDownload | undefined): void {
  downloadOverride = download
}
