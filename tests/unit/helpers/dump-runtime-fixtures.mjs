#!/usr/bin/env node

import { writeFileSync } from "node:fs"
import { captureCanonicalRuntimeFixtures } from "../../../dist/cli/prompt-runtime-fixtures.js"

function parseArgs(argv) {
  let outputPath = null

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--output") {
      outputPath = argv[index + 1] ?? null
      index += 1
    }
  }

  return { outputPath }
}

async function main() {
  const { outputPath } = parseArgs(process.argv.slice(2))
  const runtimeFixtures = await captureCanonicalRuntimeFixtures()
  const serialized = `${JSON.stringify(runtimeFixtures, null, 2)}\n`

  if (outputPath) {
    writeFileSync(outputPath, serialized, "utf8")
    return
  }

  process.stdout.write(serialized)
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
