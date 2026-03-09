import { mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const LONG_MEM_EVAL_URL = "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json?download=true"
const LONG_MEM_EVAL_NOTICE = [
  "LongMemEval fixture source: xiaowu0162/longmemeval-cleaned",
  "License: MIT",
  "Copyright 2024 Di Wu",
].join("\n")

const LOCOMO_NOTICE = [
  "LoCoMo dataset (CC BY-NC 4.0) is not included. For non-commercial research use only,",
  "download manually from https://github.com/snap-research/locomo and place",
  "locomo_dataset.json in tests/memory-bench/fixtures/.",
  "See THIRD_PARTY_NOTICES.md for details.",
].join("\n")

function fixtureFilePath(fileName: string): string {
  return path.join(process.cwd(), "tests", "memory-bench", "fixtures", fileName)
}

async function main(): Promise<void> {
  const fixturesDir = path.join(process.cwd(), "tests", "memory-bench", "fixtures")
  const longMemEvalPath = fixtureFilePath("longmemeval_oracle.json")

  await mkdir(fixturesDir, { recursive: true })

  console.log(LONG_MEM_EVAL_NOTICE)

  if (!existsSync(longMemEvalPath)) {
    const response = await fetch(LONG_MEM_EVAL_URL)
    if (!response.ok) {
      throw new Error(`Failed to download LongMemEval fixture: ${response.status} ${response.statusText}`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    await writeFile(longMemEvalPath, bytes)
    console.log(`Downloaded longmemeval_oracle.json -> ${longMemEvalPath}`)
  } else {
    console.log(`LongMemEval fixture already present -> ${longMemEvalPath}`)
  }

  console.log(LOCOMO_NOTICE)
}

await main()
