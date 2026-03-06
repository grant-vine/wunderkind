import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { analyzeStale, generateId, generateSlug } from "../format.js"
import type { HistoryEntry, MemoryAdapter, MemoryCount, MemoryEntry, StaleAnalysis } from "./types.js"

const FRONTMATTER = "---"

export class FileAdapter implements MemoryAdapter {
  #memoryDir: string

  constructor(projectDir: string) {
    this.#memoryDir = path.join(projectDir, ".wunderkind", "memory")
  }

  async read(agent: string): Promise<MemoryEntry[]> {
    const filePath = this.#getPath(agent)
    try {
      const content = await readFile(filePath, "utf-8")
      return this.#parseEntries(agent, content)
    } catch (err) {
      if (isErrnoError(err) && err.code === "ENOENT") {
        return []
      }
      throw err
    }
  }

  async write(agent: string, entry: Omit<MemoryEntry, "id">): Promise<MemoryEntry> {
    const filePath = this.#getPath(agent)
    await mkdir(this.#memoryDir, { recursive: true })
    const id = generateId()
    const slug = entry.slug.trim().length > 0 ? entry.slug : generateSlug(entry.content)
    const createdAt = entry.createdAt
    const date = formatDate(createdAt)
    const section = this.#formatSection({ ...entry, id, slug }, date)
    let existing = ""
    try {
      existing = await readFile(filePath, "utf-8")
    } catch (err) {
      if (!isErrnoError(err) || err.code !== "ENOENT") {
        throw err
      }
    }

    if (existing.trim().length === 0) {
      const header = this.#frontmatter(agent)
      await writeFile(filePath, `${header}\n\n${section}`, "utf-8")
      return { ...entry, id, slug }
    }

    await writeFile(filePath, `${existing.trim()}\n\n${section}`, "utf-8")
    return { ...entry, id, slug }
  }

  async update(id: string, content: string): Promise<MemoryEntry> {
    const entry = await this.#updateEntry(id, content)
    return entry
  }

  async delete(id: string): Promise<void> {
    await this.#removeEntry(id)
  }

  async deleteAll(agent: string): Promise<void> {
    await mkdir(this.#memoryDir, { recursive: true })
    const filePath = this.#getPath(agent)
    await writeFile(filePath, this.#frontmatter(agent), "utf-8")
  }

  async search(agent: string, query: string): Promise<MemoryEntry[]> {
    const entries = await this.read(agent)
    const needle = query.toLowerCase()
    return entries.filter((entry) => {
      return (
        entry.content.toLowerCase().includes(needle) ||
        entry.slug.toLowerCase().includes(needle)
      )
    })
  }

  async history(_id: string): Promise<HistoryEntry[]> {
    return []
  }

  async analyzeStale(agent: string): Promise<StaleAnalysis> {
    const entries = await this.read(agent)
    return analyzeStale(entries)
  }

  async prune(agent: string, idsToRemove: string[]): Promise<number> {
    const entries = await this.read(agent)
    const ids = new Set(idsToRemove)
    const kept = entries.filter((entry) => !ids.has(entry.id))
    const removed = entries.length - kept.length
    await this.#writeAll(agent, kept)
    return removed
  }

   async count(agent: string): Promise<MemoryCount> {
     const entries = await this.read(agent)
     if (entries.length === 0) {
       return { total: 0, pinned: 0, oldest: 0, newest: 0 }
     }
     let pinned = 0
     let oldest = entries[0]?.createdAt ?? 0
     let newest = entries[0]?.createdAt ?? 0
     for (const entry of entries) {
       if (entry.pinned) pinned += 1
       if (entry.createdAt < oldest) oldest = entry.createdAt
       if (entry.createdAt > newest) newest = entry.createdAt
     }
     return { total: entries.length, pinned, oldest, newest }
   }

   async listAgents(): Promise<string[]> {
     let files: string[] = []
     try {
       files = await readdir(this.#memoryDir)
     } catch (err) {
       if (isErrnoError(err) && err.code === "ENOENT") {
         return []
       }
       throw err
     }
     return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort()
   }

   async status(): Promise<{ ok: boolean; message: string }> {
     return { ok: true, message: "file adapter ready" }
   }

  #getPath(agent: string): string {
    return path.join(this.#memoryDir, `${agent}.md`)
  }

  #frontmatter(agent: string): string {
    const date = formatDate(Date.now())
    return [FRONTMATTER, `agent: ${agent}`, `compacted: ${date}`, FRONTMATTER].join("\n")
  }

  #formatSection(entry: MemoryEntry, date: string): string {
    const pinnedLine = entry.pinned ? "\n> pinned" : ""
    return `## [${date}] ${entry.slug}\nid: ${entry.id}\n${entry.content}${pinnedLine}`
  }

  #parseEntries(agent: string, content: string): MemoryEntry[] {
    const sections = content.split(/\n## /).slice(1)
    const entries: MemoryEntry[] = []
    for (const section of sections) {
      const lines = section.split("\n")
      const header = lines[0]
      if (!header) continue
      const headingMatch = header.match(/^\[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/)
      if (!headingMatch) continue
      const [, dateText, slugText] = headingMatch
      if (!dateText || !slugText) continue
      const idLine = lines.find((line) => line.startsWith("id: "))
      if (!idLine) continue
      const id = idLine.replace("id: ", "").trim()
      const pinned = lines.some((line) => line.trim() === "> pinned")
      const contentLines = lines.filter((line) => {
        return line !== header && !line.startsWith("id: ") && line.trim() !== "> pinned"
      })
      const entryContent = contentLines.join("\n").trim()
      const createdAt = new Date(dateText).getTime()
      entries.push({
        id,
        agent,
        slug: slugText,
        content: entryContent,
        createdAt,
        pinned,
        metadata: {},
      })
    }
    return entries
  }

  async #writeAll(agent: string, entries: MemoryEntry[]): Promise<void> {
    await mkdir(this.#memoryDir, { recursive: true })
    const filePath = this.#getPath(agent)
    if (entries.length === 0) {
      await writeFile(filePath, this.#frontmatter(agent), "utf-8")
      return
    }
    const header = this.#frontmatter(agent)
    const body = entries
      .map((entry) => {
        const date = formatDate(entry.createdAt)
        return this.#formatSection(entry, date)
      })
      .join("\n\n")
    await writeFile(filePath, `${header}\n\n${body}`, "utf-8")
  }

  async #updateEntry(id: string, content: string): Promise<MemoryEntry> {
    const agent = await this.#findAgent(id)
    if (!agent) {
      throw new Error(`Memory entry not found: ${id}`)
    }
    const entries = await this.read(agent)
    const next = entries.map((entry) =>
      entry.id === id ? { ...entry, content } : entry,
    )
    await this.#writeAll(agent, next)
    const updated = next.find((entry) => entry.id === id)
    if (!updated) {
      throw new Error(`Memory entry not found: ${id}`)
    }
    return updated
  }

  async #removeEntry(id: string): Promise<void> {
    const agent = await this.#findAgent(id)
    if (!agent) {
      return
    }
    const entries = await this.read(agent)
    const filtered = entries.filter((entry) => entry.id !== id)
    await this.#writeAll(agent, filtered)
  }

  async #findAgent(id: string): Promise<string | null> {
    let files: string[] = []
    try {
      files = await readdir(this.#memoryDir)
    } catch (err) {
      if (isErrnoError(err) && err.code === "ENOENT") {
        return null
      }
      throw err
    }
    for (const file of files) {
      if (!file.endsWith(".md")) continue
      const agent = file.slice(0, -3)
      const entries = await this.read(agent)
      if (entries.some((entry) => entry.id === id)) {
        return agent
      }
    }
    return null
  }
}

function isErrnoError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}
