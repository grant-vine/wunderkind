import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { WUNDERKIND_AGENT_DEFINITIONS } from "./agents/manifest.js"
import { renderNativeAgentMarkdown } from "./agents/render-markdown.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
// When compiled: dist/build-agents.js → agents/ is at ../../agents relative to __dirname
// i.e. project root is one level above dist/
const projectRoot = join(__dirname, "..")
const agentsDir = join(projectRoot, "agents")

mkdirSync(agentsDir, { recursive: true })

for (const definition of WUNDERKIND_AGENT_DEFINITIONS) {
  const content = renderNativeAgentMarkdown(definition)
  writeFileSync(join(agentsDir, `${definition.id}.md`), content, "utf-8")
  console.log(`Generated agents/${definition.id}.md`)
}

console.log(`\nGenerated ${WUNDERKIND_AGENT_DEFINITIONS.length} agent files in ${agentsDir}`)
