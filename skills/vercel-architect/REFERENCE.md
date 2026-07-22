# Vercel Architect Reference

Use this file for detailed runtime heuristics, commands, and code examples after the router in `SKILL.md` determines the task belongs here.

## Core principles

- Edge-first **only where compatible**
- Prefer Server Components for data fetching
- Prefer ISR over full SSR where freshness permits
- Treat client imports as user-cost
- Use isolated Neon branches per preview deployment when possible

## Rendering strategy decision tree

1. Same data for all users → **ISR**
2. User-specific, not real-time → **SSR**
3. Marketing/docs page → **SSG**
4. Live dashboard → **SSR** + client hydration strategy
5. Lightweight API route → **Edge Runtime**
6. Needs Node APIs or TCP ORM → **Node.js Runtime**

## Data-fetching examples

```ts
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

## Caching examples

```ts
export const dynamic = 'force-static';
export const revalidate = 60;
fetch(url, { next: { tags: ['products'] } });
```

## Edge-compatible Neon + Drizzle

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);
```

## Command patterns

### `/validate-page <url>`

```typescript
task(category="unspecified-low", load_skills=["agent-browser"], description="Validate page [url]", prompt="Navigate to [url], waitUntil: networkidle. Then run accessibility, CWV, console, broken-link, and screenshot checks.", run_in_background=false)
```

### `/bundle-analyze`

```bash
ANALYZE=true npx next build
```

Flag automatically:
- `lodash` → `lodash-es` / narrower imports
- `moment.js` → `dayjs`
- Components >50KB → consider `dynamic()`

### `/edge-vs-node <filepath>`

Signals that usually force Node:
- `fs`, `path`, `os`, `child_process`, `node:*`
- `Buffer` heavy reliance
- non-edge Prisma / `pg` / `mysql2`

Signals that usually remain Edge-compatible:
- `fetch`, `NextRequest`, `NextResponse`, `cookies()`
- `drizzle-orm` + `@neondatabase/serverless`

### `/neon-branch`

```bash
BRANCH_NAME=$(git branch --show-current | tr '/' '-')
PROJECT_ID=${NEON_PROJECT_ID:-$(neon projects list -o json | jq -r '.[0].id')}
neon branches create --project-id "$PROJECT_ID" --name "$BRANCH_NAME" --parent main -o json
```

## Common pitfalls

1. `cookies()` / `headers()` in `layout.tsx` deopts subtree caching
2. server-only modules imported in shared utils leak into the wrong runtime
3. `useSearchParams()` without `Suspense`
4. env-var confusion between build and runtime
5. heavy server packages bloating route bundles
