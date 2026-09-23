import type { Database } from "bun:sqlite"

export function refreshMarkdownView(database: Database, now: number): void {
  const rows = database.prepare<{
    readonly subject: string
    readonly predicate: string
    readonly value: string
    readonly source: string
    readonly source_event_id: string
  }>("SELECT subject, predicate, value, source, source_event_id FROM active_fact_sources ORDER BY subject ASC, predicate ASC, source_event_id ASC").all()
  const markdown = ["# Memory facts", ...rows.map((row) => `- ${row.subject} ${row.predicate}: ${row.value} (source: ${row.source}/${row.source_event_id})`)].join("\n") + "\n"
  database.prepare(
    "INSERT INTO markdown_views (name, markdown, updated_at) VALUES ($name, $markdown, $updatedAt) ON CONFLICT(name) DO UPDATE SET markdown = excluded.markdown, updated_at = excluded.updated_at",
  ).run({ $name: "facts", $markdown: markdown, $updatedAt: now })
}
