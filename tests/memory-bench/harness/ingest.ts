import type { MemoryAdapter } from "../../../src/memory/adapters/types.js"
import { renderFactText, type Fact, type Story } from "../generators/story-generator.js"

type MemoryClass = "procedural" | "factual" | "contextual" | "observational"

const TTL_DEFAULTS: Record<MemoryClass, number | null> = {
  procedural: null,
  factual: 90,
  contextual: 7,
  observational: 3,
}

interface BenchMemoryWrite {
  agent: string
  slug: string
  content: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  accessCount: number
  accessCount90d: number
  memoryClass: MemoryClass
  ttlDays: number | null
  pinnedReason: "manual" | "auto" | null
  expiredAt: number | null
  invalidAt: number | null
  pinned: boolean
  metadata: Record<string, string>
}

function factToText(fact: Fact, story: Story): string {
  return renderFactText(fact, story.characters)
}

export async function ingestStory(story: Story, adapter: MemoryAdapter, agent: string): Promise<void> {
  const memoryClass: MemoryClass = "factual"
  for (const fact of story.facts) {
    const createdAt = Date.parse(fact.timestamp)
    const entry: BenchMemoryWrite = {
      agent,
      slug: fact.id,
      content: factToText(fact, story),
      createdAt,
      updatedAt: createdAt,
      lastAccessedAt: createdAt,
      accessCount: 0,
      accessCount90d: 0,
      memoryClass,
      ttlDays: TTL_DEFAULTS[memoryClass],
      pinnedReason: null,
      expiredAt: null,
      invalidAt: null,
      pinned: false,
      metadata: fact.supersedesFactId ? { supersedesFactId: fact.supersedesFactId } : {},
    }
    await adapter.write(agent, entry)
  }
}
