#!/usr/bin/env node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const runtimeSectionsModule =
  typeof Bun === "undefined"
    ? await import("../../../dist/runtime-prompt-sections.js")
    : await import("../../../src/runtime-prompt-sections.ts")

const { applyWunderkindSystemTransform } = runtimeSectionsModule

const sandboxRoot = mkdtempSync(join(tmpdir(), "wk-runtime-soul-boundary-"))
const projectDir = join(sandboxRoot, "project")

try {
  mkdirSync(join(projectDir, ".wunderkind", "souls"), { recursive: true })
  writeFileSync(
    join(projectDir, ".wunderkind", "souls", "product-wunderkind.md"),
    [
      "<!-- wunderkind:soul-file:v1 -->",
      "# Product Wunderkind SOUL",
      "",
      "## Boundary Proof",
      "- Secret-shaped sample must stay raw in runtime assembly: sk-live-soul-boundary-proof",
    ].join("\n"),
    "utf8",
  )

  const system = ["# Product Wunderkind\nBase retained prompt"]
  const transformResult = applyWunderkindSystemTransform({
    system,
    cwd: projectDir,
    wunderkindConfig: {
      region: "Project Region",
      industry: "SaaS",
      primaryRegulation: "POPIA",
      teamCulture: "pragmatic-balanced",
      orgStructure: "flat",
      promptOptimizationEnabled: true,
      promptOptimizationMode: "active",
      promptOptimizationByteBudget: 1,
    },
  })

  process.stdout.write(
    JSON.stringify({
      systemSections: system,
      eligibleSectionIds: transformResult.eligibleSections.map((section) => section.id),
      eligibleContent: transformResult.eligibleSections.map((section) => section.content).join("\n"),
      trimmedSectionIds: transformResult.trimResult.trimmedSections,
    }),
  )
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true })
}
