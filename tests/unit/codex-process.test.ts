import { expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname

it("reads a Codex catalog larger than the default subprocess buffer", () => {
  const directory = mkdtempSync(join(tmpdir(), "wunderkind-codex-catalog-"))
  try {
    writeFileSync(join(directory, "codex"), '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ installed: [], available: [], padding: "x".repeat(2 * 1024 * 1024) }));\n', { mode: 0o755 })
    const program = `
      import { requireCodexJson } from "./src/cli/codex/process.ts";
      const catalog = requireCodexJson(["plugin", "list", "--available", "--json"], "catalog discovery");
      console.log(catalog.padding.length);
    `

    const result = spawnSync(process.execPath, ["--eval", program], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PATH: `${directory}${delimiter}${process.env["PATH"] ?? ""}` },
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
    })

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(String(2 * 1024 * 1024))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
