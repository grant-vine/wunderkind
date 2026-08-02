# Supabase Architect Reference

Use this file for Supabase-specific architecture heuristics, commands, and operating notes after the router in `SKILL.md` decides the task belongs here.

## Contract anchors

- `owner=fullstack-wunderkind`
- route: `supabase-architect`
- neighboring routes: `db-architect`, `vercel-architect`, `security-analyst`, `compliance-officer`, `improve-codebase-architecture`

## Official-source posture

This reference is informed by current official Supabase docs and upstream repositories, especially:

- `https://supabase.com/docs/guides/auth/row-level-security`
- `https://supabase.com/docs/guides/realtime`
- `https://supabase.com/docs/guides/storage`
- `https://supabase.com/docs/guides/functions`
- `https://supabase.com/docs/guides/local-development`
- `https://supabase.com/docs/guides/deployment/branching`
- `https://supabase.com/docs/guides/telemetry/logs`
- `https://github.com/supabase/agent-skills`
- `https://github.com/supabase/mcp`

## Core platform heuristics

- Use this route only when Supabase changes the architecture, not when the work is generic Postgres or generic deployment.
- Treat Supabase Auth + RLS as one application-data boundary, not as separate afterthoughts.
- Keep `service_role` and other bypass paths server-only; never normalize them into browser flows.
- Prefer explicit environment separation: local stack, preview branch, persistent non-prod branch, production.
- Plan the observability path at the same time as the feature path: Auth, Postgres, Storage, Realtime, and Edge Functions all expose distinct logs.

## Auth and RLS anchors

Supabase's current RLS guidance is clear: browser-facing data access depends on RLS being enabled on exposed schemas, especially `public`.

- Enable RLS on every browser-exposed table.
- Write policies with explicit role intent such as `to authenticated` or `to anon`.
- Prefer `(select auth.uid())` and explicit `auth.uid() IS NOT NULL` checks in policies.
- Treat `raw_app_meta_data` as the safer JWT-backed authorization surface; do not rely on mutable `raw_user_meta_data` for authz.
- Remember that `UPDATE` behavior depends on a matching `SELECT` policy as well as `USING` / `WITH CHECK` policy design.

Use this route when the question is how auth and RLS shape the product architecture. Use `security-analyst` when the question is exploitability, access-control review severity, or OWASP posture.

## Realtime decision points

Supabase Realtime currently exposes three primary patterns:

- **Broadcast** for low-latency custom events
- **Presence** for shared user state
- **Postgres Changes** for database-originated change feeds

Architecture questions to resolve here:

- whether a workflow should emit app events or react to table changes
- whether presence is product-critical or merely decorative
- whether fan-out belongs in the client, an Edge Function, or another backend surface
- whether offline recovery and replay requirements make Realtime insufficient on its own

## Storage decision points

Supabase Storage is not just file hosting; it is a policy-governed object layer with CDN delivery, signed URL patterns, and resumable upload support.

- Split public and private bucket intent deliberately.
- Use signed URLs or signed upload URLs when client access should be temporary.
- Plan bucket layout around product behavior, not just MIME type.
- Treat large or failure-prone uploads as resumable flows.
- Keep authorization rules aligned with your RLS and identity model.

Use `db-architect` instead if the problem is generic relational schema or query design with no material Storage decision.

## Edge Functions anchors

Official guidance positions Edge Functions as globally distributed TypeScript functions running on the Supabase Edge Runtime.

- Prefer Edge Functions for low-latency HTTP endpoints, webhook receivers, lightweight orchestration, and Supabase-adjacent secrets handling.
- Keep them short-lived and idempotent; move heavy background work elsewhere.
- Use project secrets for credentials.
- Treat Postgres access as remote/serverless-friendly rather than long-lived direct connections.
- Use local serving for parity during development.

If the core question is runtime placement on Vercel/Next.js rather than Supabase platform leverage, reroute to `vercel-architect`.

## Local dev, branching, and rollout anchors

Official local-development guidance centers the Supabase CLI and a container runtime.

```bash
supabase init
supabase start
supabase functions serve
```

- local dev should exercise Auth, Storage, and Edge Functions together when the architecture depends on their interaction
- preview branches are isolated environments with separate credentials and no copied production data by default
- persistent branches fit staging or QA better than ephemeral preview branches
- seed data intentionally; do not assume branch environments inherit safe production-like data automatically

## Observability anchors

Supabase exposes separate logging surfaces for the products that matter most to this route:

- Auth logs
- Postgres logs
- Storage logs
- Realtime logs
- Edge Function invocation logs
- Edge Function runtime logs

Useful operating reminders from the official logging guidance:

- query one log source at a time
- use timestamps, request ids, or SQLSTATE codes as correlation anchors
- enable Realtime client logging explicitly when needed
- keep PII out of user-agent-style metadata and logs

## Escalation boundaries

- `db-architect`: generic schema design, migrations, EXPLAIN, index audits, destructive database operations
- `vercel-architect`: runtime placement, App Router, edge-vs-node, preview deployment mechanics, bundle and rendering strategy
- `security-analyst`: auth exploitability, broken access control, OWASP review, token abuse, privilege escalation
- `compliance-officer`: retention, consent, breach obligations, POPIA/GDPR/CCPA posture
- `improve-codebase-architecture`: module seams, deep refactors, RFC shape, architecture independent of Supabase product choice

## Quick review checklist

Before closing a `supabase-architect` task, verify that the answer names:

1. the specific Supabase product surfaces involved: Auth, RLS, Realtime, Storage, Edge Functions, local dev, branching, or logs
2. why Supabase changes the design instead of acting as interchangeable infrastructure
3. which adjacent specialist owns any follow-up outside this route
