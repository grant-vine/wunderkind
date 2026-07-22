# Social Media Maven Reference

Use this file for regional matrices, benchmarks, and extended audit criteria after the router in `SKILL.md` determines the task belongs here.

## Regional platform defaults

| Region | Primary Platforms | Notes |
|---|---|---|
| **Global (default)** | LinkedIn, Instagram, X/Twitter, TikTok, YouTube | Broadest reach across B2B and B2C |
| **North America** | LinkedIn, Instagram, TikTok, X/Twitter, Facebook | Facebook still matters for older demographics |
| **Europe** | LinkedIn, Instagram, TikTok, X/Twitter | WhatsApp is strong for direct engagement |
| **Sub-Saharan Africa** | WhatsApp, Facebook, Instagram, TikTok | WhatsApp is dominant for peer and B2C messaging |
| **Latin America** | WhatsApp, Instagram, TikTok, Facebook, YouTube | WhatsApp often doubles as CRM |
| **Asia Pacific** | WeChat, LINE, KakaoTalk, Instagram, TikTok | Market is highly fragmented |
| **Middle East** | Instagram, TikTok, Snapchat, X/Twitter | Snapchat is especially strong in GCC markets |
| **South Asia** | YouTube, Instagram, WhatsApp, Facebook | YouTube is dominant content platform |

## Content framework

- 40% educational
- 30% entertaining
- 20% promotional
- 10% UGC/community

## Hashtag research delegation

```typescript
task(
  subagent_type="librarian",
  load_skills=[],
  description="Research hashtags for [topic]",
  prompt="Search for trending hashtags for '[topic]' on Instagram and TikTok in 2026. Find: high-volume (1M+), mid-volume (100K-1M), niche (10K-100K), trending/emerging. Return tiered list with platform recommendations.",
  run_in_background=false
)
```

## Engagement benchmarks

- Instagram: >3% good, >6% excellent
- LinkedIn: >2% good, >4% excellent
- X/Twitter: >0.5% good, >1% excellent
- TikTok: >5% good, >9% excellent

## Extended audit criteria

### Engagement audit

1. Posting cadence over 30/60/90 days
2. Engagement rate vs platform benchmark
3. Content mix vs 40/30/20/10 target
4. Top-performing formats, topics, and timing
5. Response rate to comments and DMs
6. Follower-growth trend and likely causes
7. Hashtag contribution vs noise

### Content audit

1. Brand voice consistency
2. Visual consistency
3. CTA clarity
4. Content mix compliance
5. SEO / discoverability
6. Accessibility
7. Broken links or outdated offers

## Optional delegations

Visual asset generation:

```typescript
task(
  category="visual-engineering",
  load_skills=["frontend-ui-ux"],
  description="Generate social media graphics for [topic]",
  prompt="Create visual templates/concepts for [topic] using current design trends.",
  run_in_background=false
)
```

Competitor analysis:

```typescript
task(
  subagent_type="librarian",
  load_skills=[],
  description="Analyze competitor [brand] social presence",
  prompt="Research the social media presence and engagement strategies of [brand] in the target market. Find: platforms active on, posting frequency, content mix, engagement rates (estimate), top content formats, and hashtag strategy. Return a comparison matrix.",
  run_in_background=false
)
```
