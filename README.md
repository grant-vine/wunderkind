# Wunderkind

A specialist AI agent addon for [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) that extends your team with eight professional agents covering marketing, design, product, engineering, brand building, QA, operations, and security.

**Requires oh-my-opencode.** This package cannot be used standalone.

---

## Install

```bash
bunx wunderkind
```

or

```bash
npx wunderkind
```

The interactive installer will:
1. Add `wunderkind` to your OpenCode plugin config (`~/.config/opencode/config.json`)
2. Write a `wunderkind.config.jsonc` in your current directory with your region, industry, and data-protection regulation

---

## Non-interactive install

```bash
bunx wunderkind install --no-tui \
  --region="South Africa" \
  --industry=SaaS \
  --primary-regulation=POPIA
```

---

## Agents

| Agent | Role |
|---|---|
| `wunderkind:marketing-wunderkind` | CMO-calibre marketing strategist |
| `wunderkind:creative-director` | Brand identity & UI/UX design leader |
| `wunderkind:product-wunderkind` | VP Product-calibre product manager |
| `wunderkind:fullstack-wunderkind` | CTO-calibre fullstack engineer |
| `wunderkind:brand-builder` | Community, thought leadership, PR |
| `wunderkind:qa-specialist` | TDD, test writing, coverage analysis |
| `wunderkind:operations-lead` | SRE/SLO, runbooks, incident response |
| `wunderkind:ciso` | Security architecture, OWASP, compliance |

---

## Sub-skills

| Skill | Parent Agent | Domain |
|---|---|---|
| `wunderkind:social-media-maven` | marketing-wunderkind | Social media strategy & content |
| `wunderkind:visual-artist` | creative-director | Colour palettes, design tokens, WCAG |
| `wunderkind:agile-pm` | product-wunderkind | Sprint planning, task decomposition |
| `wunderkind:db-architect` | fullstack-wunderkind | Drizzle ORM, PostgreSQL, Neon DB |
| `wunderkind:vercel-architect` | fullstack-wunderkind | Vercel, Next.js App Router, Edge Runtime |
| `wunderkind:security-analyst` | ciso | OWASP Top 10, vulnerability assessment |
| `wunderkind:pen-tester` | ciso | Penetration testing, ASVS, attack simulation |
| `wunderkind:compliance-officer` | ciso | GDPR, POPIA, data classification |

---

## Configuration

The installer creates `wunderkind.config.jsonc` in your project directory:

```jsonc
// Wunderkind configuration — edit these values to tailor agents to your project context
{
  // Geographic region — e.g. "South Africa", "United States", "United Kingdom"
  "REGION": "South Africa",
  // Industry vertical — e.g. "SaaS", "FinTech", "eCommerce", "HealthTech"
  "INDUSTRY": "SaaS",
  // Primary data-protection regulation — e.g. "GDPR", "POPIA", "CCPA", "LGPD"
  "PRIMARY_REGULATION": "POPIA",
  // Optional secondary regulation
  "SECONDARY_REGULATION": ""
}
```

---

## Manual installation

If you prefer to configure manually, add `wunderkind` to your OpenCode plugin list in `~/.config/opencode/config.json`:

```json
{
  "plugin": ["oh-my-opencode", "wunderkind"]
}
```

---

## Requirements

- [OpenCode](https://opencode.ai)
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) v3.10+
- Node.js 18+ or Bun 1+

---

## License

MIT
