# Security Analyst Reference

Use this file for detailed OWASP guidance, examples, and deep checklists after the router in `SKILL.md` determines the task belongs here.

## OWASP Top 10 reference

| # | Category | Prevalence |
|---|---|---|
| A01 | Broken Access Control | 94% of apps tested |
| A02 | Cryptographic Failures | — |
| A03 | Injection | — |
| A04 | Insecure Design | — |
| A05 | Security Misconfiguration | — |
| A06 | Vulnerable and Outdated Components | — |
| A07 | Identification and Authentication Failures | — |
| A08 | Software and Data Integrity Failures | — |
| A09 | Security Logging and Monitoring Failures | — |
| A10 | Server-Side Request Forgery (SSRF) | — |

## Example patterns

### Broken access control

```typescript
const order = await db.select().from(orders).where(eq(orders.id, orderId));

const safeOrder = await db.select().from(orders)
  .where(and(eq(orders.id, orderId), eq(orders.userId, currentUser.id)));
```

### Injection

```typescript
const result = await db.execute(`SELECT * FROM users WHERE email = '${email}'`);

const safeResult = await db.select().from(users).where(eq(users.email, email));
```

## Auth-review checklist

- Password hashing algorithm and strength
- Rate limiting on login / register / forgot-password
- Account lockout or throttling posture
- JWT secret entropy and token expiry
- Refresh-token rotation
- Token invalidation on logout
- Cookie flags: `HttpOnly`, `Secure`, `SameSite`
- MFA for privileged accounts

## Delegation patterns

```typescript
task(
  category="unspecified-high",
  load_skills=["wunderkind:pen-tester"],
  description="Active pen test for [vulnerability type] in [scope]",
  prompt="...",
  run_in_background=false
)
```

```typescript
task(
  category="unspecified-high",
  load_skills=["wunderkind:compliance-officer"],
  description="Compliance impact of [vulnerability] on [regulation]",
  prompt="...",
  run_in_background=false
)
```
