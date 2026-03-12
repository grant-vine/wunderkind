import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { ProjectConfig } from "../../src/cli/types.js"

const DOCS_OUTPUT_SENTINEL = "<!-- wunderkind:docs-output-start -->"

const mockReadWunderkindConfig = mock<() => Partial<ProjectConfig> | null>(() => null)

mock.module("../../src/cli/config-manager/index.js", () => ({
  readWunderkindConfig: mockReadWunderkindConfig,
}))

import WunderkindPlugin from "../../src/index.js"

type PluginInput = Parameters<typeof WunderkindPlugin>[0]
type PluginResult = Awaited<ReturnType<typeof WunderkindPlugin>>
type SystemTransform = NonNullable<PluginResult["experimental.chat.system.transform"]>
type TransformInput = Parameters<SystemTransform>[0]
type TransformOutput = Parameters<SystemTransform>[1]

type TestOutput = {
  system: string[]
}

function hasDocsSection(system: string[]): boolean {
  return system.some((entry) => entry.includes("## Documentation Output"))
}

function countSentinel(system: string[]): number {
  return system.reduce((count, entry) => count + (entry.includes(DOCS_OUTPUT_SENTINEL) ? 1 : 0), 0)
}

async function runSystemTransform(output: TestOutput): Promise<void> {
  const pluginResult = await WunderkindPlugin({} as PluginInput)
  const transform = pluginResult["experimental.chat.system.transform"]
  if (!transform) {
    throw new Error("Expected experimental.chat.system.transform to exist")
  }
  await transform({} as TransformInput, output as TransformOutput)
}

describe("runtime docs-output system injection", () => {
  beforeEach(() => {
    mockReadWunderkindConfig.mockClear()
    mockReadWunderkindConfig.mockImplementation(() => null)
  })

  it("does not inject docs section when docsEnabled is false", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({ docsEnabled: false }))
    const output: TestOutput = { system: [] }

    await runSystemTransform(output)

    expect(hasDocsSection(output.system)).toBe(false)
    expect(countSentinel(output.system)).toBe(0)
  })

  it("injects docs section with docsPath and docHistoryMode when docsEnabled is true", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({
      docsEnabled: true,
      docsPath: "./docs/output",
      docHistoryMode: "append-dated",
    }))
    const output: TestOutput = { system: [] }

    await runSystemTransform(output)

    expect(hasDocsSection(output.system)).toBe(true)
    expect(output.system.some((entry) => entry.includes(DOCS_OUTPUT_SENTINEL))).toBe(true)
    expect(output.system.some((entry) => entry.includes("./docs/output"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("append-dated"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("Eligible Wunderkind docs targets:"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("docs scope: current project root only"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("managed home files"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("refresh or bootstrap"))).toBe(true)
    expect(output.system.some((entry) => entry.includes("explicit completion result"))).toBe(false)
  })

  it("does not duplicate docs section when transform runs twice", async () => {
    mockReadWunderkindConfig.mockImplementation(() => ({
      docsEnabled: true,
      docsPath: "./docs",
      docHistoryMode: "overwrite",
    }))
    const output: TestOutput = { system: [] }

    await runSystemTransform(output)
    await runSystemTransform(output)

    expect(countSentinel(output.system)).toBe(1)
    expect(output.system.filter((entry) => entry.includes("## Documentation Output")).length).toBe(1)
  })

  it("does not inject docs section when config is null", async () => {
    mockReadWunderkindConfig.mockImplementation(() => null)
    const output: TestOutput = { system: [] }

    await runSystemTransform(output)

    expect(hasDocsSection(output.system)).toBe(false)
    expect(countSentinel(output.system)).toBe(0)
  })

  it("does not inject docs section for an uninitialized project even if runtime has packaged defaults", async () => {
    mockReadWunderkindConfig.mockImplementation(() => null)
    const output: TestOutput = { system: [] }

    await runSystemTransform(output)

    expect(hasDocsSection(output.system)).toBe(false)
    expect(countSentinel(output.system)).toBe(0)
  })
})
