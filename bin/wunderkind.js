#!/usr/bin/env node
import { spawnSync } from "node:child_process"

if (process.argv[2] === "memory" && process.versions.bun === undefined) {
  const handoff = spawnSync("bun", [process.argv[1], ...process.argv.slice(2)], { stdio: "inherit" })
  if (handoff.error) {
    console.error("Error: Wunderkind memory requires Bun runtime")
    process.exit(1)
  }
  process.exit(handoff.status ?? 1)
}

import "../dist/cli/index.js"
