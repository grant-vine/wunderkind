# DB Architect Reference

Use this file for long-form database procedures after the router in `SKILL.md` decides the task belongs here.

## Environment prerequisites

- `DATABASE_URL` env var must be set
- `psql` available for direct queries
- `npx` / `bun x` available for drizzle-kit commands
- Optional: `mermerd` for ERD generation

## Detailed command flows

### `/describe [table]`

```bash
psql "$DATABASE_URL" -c "\d+ [table]"

psql "$DATABASE_URL" -c "
SELECT
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = '[table]';
"
```

### `/generate-erd`

```bash
mermerd \
  --connectionString "$DATABASE_URL" \
  --schema public \
  --encloseWithMermaidBackticks \
  --outputFileName /tmp/erd.md
```

Fallback query:

```bash
psql "$DATABASE_URL" -c "
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
"
```

### `/query-analyze <sql>`

```bash
psql "$DATABASE_URL" -c "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) [sql];"
```

| Plan Node | Issue | Action |
|---|---|---|
| `Seq Scan` on large table | Missing index | Create index on filter/join column |
| `Hash Join` with large batches | Memory pressure | Check `work_mem` |
| `Nested Loop` with many rows | Poor join strategy | Consider join reorder |
| Rows estimated vs actual > 10× off | Stale statistics | `ANALYZE [table];` |
| `Buffers: read` >> `Buffers: hit` | Cache miss | Check `shared_buffers`, connection pooling |

### `/migration-diff`

```bash
npx drizzle-kit pull --dialect=postgresql --url="$DATABASE_URL" --out=./drizzle/live-snapshot
npx drizzle-kit generate --dialect=postgresql --schema=./src/db/schema.ts --out=./drizzle/pending
```

### `/index-audit`

Missing FK indexes:

```bash
psql "$DATABASE_URL" -c "
SELECT
  conrelid::regclass AS table_name,
  a.attname AS column_name,
  confrelid::regclass AS references_table,
  'CREATE INDEX CONCURRENTLY idx_' || conrelid::regclass || '_' || a.attname
    || ' ON ' || conrelid::regclass || '(' || a.attname || ');' AS fix
FROM pg_constraint c
JOIN pg_attribute a
  ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute ia
      ON ia.attrelid = i.indrelid AND ia.attnum = ANY(i.indkey)
    WHERE i.indrelid = c.conrelid AND ia.attnum = a.attnum
  );
"
```

Unused indexes:

```bash
psql "$DATABASE_URL" -c "
SELECT
  schemaname || '.' || tablename AS table_name,
  indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
WHERE idx_scan < 50
  AND NOT indisunique
  AND NOT indisprimary
ORDER BY pg_relation_size(indexname::regclass) DESC;
"
```

Sequential-scan hotspots:

```bash
psql "$DATABASE_URL" -c "
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup AS row_count,
  pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_stat_user_tables
WHERE seq_scan > 100
  AND n_live_tup > 10000
  AND seq_scan > idx_scan
ORDER BY seq_tup_read DESC
LIMIT 15;
"
```

## Drizzle ORM conventions

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

- Prefer UUID primary keys with `.defaultRandom()`
- Include `createdAt` / `updatedAt`
- Prefer soft deletes over hard deletes where product semantics allow it

## Delegation patterns

```typescript
task(subagent_type="explore", load_skills=[], description="Research Neon DB connection pooling best practices", prompt="...", run_in_background=false)
task(category="writing", load_skills=[], description="Write migration runbook", prompt="...", run_in_background=false)
```
