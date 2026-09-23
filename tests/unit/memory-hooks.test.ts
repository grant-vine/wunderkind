import { describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { appendMemoryContextToSystem } from "../../src/memory/hook-integration.js"
import { MemoryLedger } from "../../src/memory/index.js"

describe("memory hook integration", () => {
  it("leaves disabled system output byte-for-byte unchanged", () => {
    const system = ["base system", "existing context"]
    expect(appendMemoryContextToSystem({ system, enabled: false, query: "session-1" })).toEqual(system)
  })

  it("adds only bounded attributable local context when injection is enabled", () => {
    const project = mkdtempSync(join(tmpdir(), "wk-memory-hook-"))
    const now = Date.now()
    const ledger = new MemoryLedger({ projectRoot: project, now: () => now })
    try {
      ledger.recordSourceEvent({ eventId: "source-1", source: "test", occurredAt: now, rawExcerpt: "session-1 release", sensitivity: "internal" })
      ledger.recordCandidate({ candidateId: "candidate-1", sourceEventId: "source-1", subject: "session-1", predicate: "prefers", value: "local memory", sensitivity: "internal", observedAt: now })
      ledger.acceptCandidate({ factId: "fact-1", candidateId: "candidate-1", acceptedAt: now })
      const result = appendMemoryContextToSystem({ system: ["base system"], enabled: true, query: "session-1", projectRoot: project })
      expect(result).toHaveLength(2)
      expect(result[1]).toContain("fact: fact-1; source: source-1")
      expect(Buffer.byteLength(result[1] ?? "", "utf8") <= 4096).toBe(true)
    } finally {
      ledger.close()
      rmSync(project, { recursive: true, force: true })
    }
  })
})
