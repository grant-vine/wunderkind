import type { MemoryAdapter } from "../../../src/memory/adapters/types.js"
import type { TestCase } from "../generators/story-generator.js"

export async function queryStory(testCase: TestCase, adapter: MemoryAdapter, agent: string): Promise<string> {
  const results = await adapter.search(agent, testCase.question)
  return results[0]?.content ?? ""
}
