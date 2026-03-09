import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  createMarketingWunderkindAgent,
  createCreativeDirectorAgent,
  createProductWunderkindAgent,
  createFullstackWunderkindAgent,
  createBrandBuilderAgent,
  createQaSpecialistAgent,
  createOperationsLeadAgent,
  createCisoAgent,
  createDevrelWunderkindAgent,
  createLegalCounselAgent,
  createDataAnalystAgent,
  createSupportEngineerAgent,
} from "./agents/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
// When compiled: dist/build-agents.js → agents/ is at ../../agents relative to __dirname
// i.e. project root is one level above dist/
const projectRoot = join(__dirname, "..")
const agentsDir = join(projectRoot, "agents")

mkdirSync(agentsDir, { recursive: true })

const agents = [
  { name: "marketing-wunderkind", factory: createMarketingWunderkindAgent },
  { name: "creative-director", factory: createCreativeDirectorAgent },
  { name: "product-wunderkind", factory: createProductWunderkindAgent },
  { name: "fullstack-wunderkind", factory: createFullstackWunderkindAgent },
  { name: "brand-builder", factory: createBrandBuilderAgent },
  { name: "qa-specialist", factory: createQaSpecialistAgent },
  { name: "operations-lead", factory: createOperationsLeadAgent },
  { name: "ciso", factory: createCisoAgent },
  { name: "devrel-wunderkind", factory: createDevrelWunderkindAgent },
  { name: "legal-counsel", factory: createLegalCounselAgent },
  { name: "data-analyst", factory: createDataAnalystAgent },
  { name: "support-engineer", factory: createSupportEngineerAgent },
] as const

for (const { name, factory } of agents) {
  const config = factory("")
  const description = (config.description ?? "").replace(/\n/g, "\n  ")
  const frontmatter = `---\nname: ${name}\ndescription: >\n  ${description}\n---\n\n`
  const content = frontmatter + (config.prompt ?? "")
  writeFileSync(join(agentsDir, `${name}.md`), content, "utf-8")
  console.log(`Generated agents/${name}.md`)
}

console.log(`\nGenerated ${agents.length} agent files in ${agentsDir}`)
