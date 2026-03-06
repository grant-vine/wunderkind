import { describe, it, expect, spyOn, afterEach } from "bun:test"
import * as memoryModule from "../../src/memory/index.js"
import { createMemoryCommand } from "../../src/cli/memory-commands.js"

function silenceConsole(): () => void {
  const origLog = console.log
  const origErr = console.error
  console.log = () => {}
  console.error = () => {}
  return () => {
    console.log = origLog
    console.error = origErr
  }
}

describe("memory export subcommand", () => {
  let exportSpy: ReturnType<typeof spyOn<typeof memoryModule, "exportMemories">>

  afterEach(() => {
    exportSpy.mockRestore()
  })

  it("calls exportMemories with cwd and no output path when --output is not provided", async () => {
    exportSpy = spyOn(memoryModule, "exportMemories").mockImplementation(() =>
      Promise.resolve("/fake/.wunderkind/exports/123.zip"),
    )
    const cmd = createMemoryCommand()
    const restore = silenceConsole()
    try {
      await cmd.parseAsync(["node", "wunderkind", "export"])
      expect(exportSpy).toHaveBeenCalledTimes(1)
      const calls = exportSpy.mock.calls
      expect(calls[0]?.[0]).toBe(process.cwd())
      expect(calls[0]?.length).toBe(1)
    } finally {
      restore()
    }
  })

  it("calls exportMemories with cwd and custom output path when --output is provided", async () => {
    exportSpy = spyOn(memoryModule, "exportMemories").mockImplementation(() =>
      Promise.resolve("/fake/.wunderkind/exports/custom.zip"),
    )
    const cmd = createMemoryCommand()
    const restore = silenceConsole()
    try {
      await cmd.parseAsync(["node", "wunderkind", "export", "--output", "/custom/path.zip"])
      expect(exportSpy).toHaveBeenCalledTimes(1)
      const calls = exportSpy.mock.calls
      expect(calls[0]?.[0]).toBe(process.cwd())
      expect(calls[0]?.[1]).toBe("/custom/path.zip")
    } finally {
      restore()
    }
  })
})

describe("memory import subcommand", () => {
  let importSpy: ReturnType<typeof spyOn<typeof memoryModule, "importMemories">>

  afterEach(() => {
    importSpy.mockRestore()
  })

  it("calls importMemories with cwd, zip path, and default strategy 'merge'", async () => {
    importSpy = spyOn(memoryModule, "importMemories").mockImplementation(() =>
      Promise.resolve({ imported: 5, skipped: 2 }),
    )
    const cmd = createMemoryCommand()
    const restore = silenceConsole()
    try {
      await cmd.parseAsync(["node", "wunderkind", "import", "/some/backup.zip"])
      expect(importSpy).toHaveBeenCalledTimes(1)
      const calls = importSpy.mock.calls
      expect(calls[0]?.[0]).toBe(process.cwd())
      expect(calls[0]?.[1]).toBe("/some/backup.zip")
      expect(calls[0]?.[2]).toBe("merge")
    } finally {
      restore()
    }
  })

  it("calls importMemories with strategy 'overwrite' when --strategy=overwrite is passed", async () => {
    importSpy = spyOn(memoryModule, "importMemories").mockImplementation(() =>
      Promise.resolve({ imported: 3, skipped: 0 }),
    )
    const cmd = createMemoryCommand()
    const restore = silenceConsole()
    try {
      await cmd.parseAsync(["node", "wunderkind", "import", "/some/backup.zip", "--strategy=overwrite"])
      expect(importSpy).toHaveBeenCalledTimes(1)
      const calls = importSpy.mock.calls
      expect(calls[0]?.[2]).toBe("overwrite")
    } finally {
      restore()
    }
  })

  it("calls process.exit(1) when --strategy has an invalid value", async () => {
    importSpy = spyOn(memoryModule, "importMemories").mockImplementation(() =>
      Promise.resolve({ imported: 0, skipped: 0 }),
    )
    const cmd = createMemoryCommand()
    const restore = silenceConsole()

    const exitCalls: number[] = []
    const origExit = process.exit
    process.exit = ((code?: number) => {
      exitCalls.push(code ?? 0)
    }) as typeof process.exit

    try {
      await cmd.parseAsync(["node", "wunderkind", "import", "/some/backup.zip", "--strategy=invalid"])
    } finally {
      process.exit = origExit
      restore()
    }

    expect(exitCalls).toContain(1)
  })
})
