import { describe, it, expect, spyOn } from "bun:test"
import * as childProcess from "node:child_process"
import * as fs from "node:fs"
import { checkMemoryStatus, startMemoryServices } from "../../src/memory/docker.js"

describe("checkMemoryStatus — mem0 adapter (default)", () => {
  it("returns ok: true with message when fetch returns ok", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: true } as Response))
    const result = await checkMemoryStatus("http://localhost:8000")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(true)
    expect(result.message).toBe("mem0 is running at http://localhost:8000")
  })

  it("returns ok: false with HTTP status when fetch returns non-ok response", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: false, status: 500 } as Response))
    const result = await checkMemoryStatus("http://localhost:8000")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("mem0 returned HTTP 500")
  })

  it("returns ok: false with message when fetch throws a network error", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => {
      throw new Error("connection refused")
    })
    const result = await checkMemoryStatus("http://localhost:9999")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("Cannot reach mem0 at http://localhost:9999")
  })

  it("returns ok: true when adapter is explicitly 'mem0'", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: true } as Response))
    const result = await checkMemoryStatus("http://localhost:8000", "mem0")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(true)
    expect(result.message).toContain("mem0")
  })
})

describe("checkMemoryStatus — vector adapter (Qdrant)", () => {
  it("returns ok: true when Qdrant /healthz responds ok", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: true } as Response))
    const result = await checkMemoryStatus("http://localhost:6333", "vector")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(true)
    expect(result.message).toBe("Qdrant is running at http://localhost:6333")
  })

  it("returns ok: false with HTTP status when Qdrant returns non-ok response", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => ({ ok: false, status: 503 } as Response))
    const result = await checkMemoryStatus("http://localhost:6333", "vector")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("Qdrant returned HTTP 503")
  })

  it("returns ok: false when fetch throws for vector adapter", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(async () => {
      throw new Error("timeout")
    })
    const result = await checkMemoryStatus("http://localhost:6333", "vector")
    fetchSpy.mockRestore()
    expect(result.ok).toBe(false)
    expect(result.message).toBe("Cannot reach Qdrant at http://localhost:6333")
  })
})

describe("startMemoryServices — mem0 adapter (default)", () => {
  it("returns success: true when execSync does not throw", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => true)
    const execSpy = spyOn(childProcess, "execSync")
    execSpy.mockImplementationOnce(() => Buffer.from(""))
    const result = startMemoryServices("/tmp/fake-project")
    existsSpy.mockRestore()
    execSpy.mockRestore()
    expect(result.success).toBe(true)
    expect(result.message).toBe("mem0 services started")
  })

  it("returns success: false with error message when execSync throws", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => true)
    const execSpy = spyOn(childProcess, "execSync")
    execSpy.mockImplementationOnce(() => {
      throw new Error("compose not found")
    })
    const result = startMemoryServices("/tmp/fake-project")
    existsSpy.mockRestore()
    execSpy.mockRestore()
    expect(result.success).toBe(false)
    expect(result.message).toContain("compose not found")
  })

  it("returns success: true when adapter is explicitly 'mem0'", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => true)
    const execSpy = spyOn(childProcess, "execSync")
    execSpy.mockImplementationOnce(() => Buffer.from(""))
    const result = startMemoryServices("/tmp/fake-project", "mem0")
    existsSpy.mockRestore()
    execSpy.mockRestore()
    expect(result.success).toBe(true)
    expect(result.message).toBe("mem0 services started")
  })

  it("returns success: false when compose file does not exist", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => false)
    const result = startMemoryServices("/tmp/fake-project", "mem0")
    existsSpy.mockRestore()
    expect(result.success).toBe(false)
    expect(result.message).toBe("Run wunderkind install first to set up the global ~/.wunderkind/ directory")
  })
})

describe("startMemoryServices — vector adapter (Qdrant)", () => {
  it("returns success: true when Qdrant compose starts successfully", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => true)
    const execSpy = spyOn(childProcess, "execSync")
    execSpy.mockImplementationOnce(() => Buffer.from(""))
    const result = startMemoryServices("/tmp/fake-project", "vector")
    existsSpy.mockRestore()
    execSpy.mockRestore()
    expect(result.success).toBe(true)
    expect(result.message).toBe("Qdrant services started")
  })

  it("returns success: false with error message when Qdrant compose fails", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => true)
    const execSpy = spyOn(childProcess, "execSync")
    execSpy.mockImplementationOnce(() => {
      throw new Error("qdrant image not found")
    })
    const result = startMemoryServices("/tmp/fake-project", "vector")
    existsSpy.mockRestore()
    execSpy.mockRestore()
    expect(result.success).toBe(false)
    expect(result.message).toContain("qdrant image not found")
  })

  it("returns success: false when compose file does not exist", () => {
    const existsSpy = spyOn(fs, "existsSync")
    existsSpy.mockImplementationOnce(() => false)
    const result = startMemoryServices("/tmp/fake-project", "vector")
    existsSpy.mockRestore()
    expect(result.success).toBe(false)
    expect(result.message).toBe("Run wunderkind install first to set up the global ~/.wunderkind/ directory")
  })
})
