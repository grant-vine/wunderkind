---
name: caveman
description: >
  USE FOR: terse mode, low-token replies, compressed communication, user asks
  like "caveman mode", "be brief", "less tokens", or "talk like caveman" while
  keeping technical accuracy intact.

---

# Caveman

Switch to ultra-compressed communication while preserving technical accuracy.

## Primary owner

**Owned by:** wunderkind:product-wunderkind

## Output target

Chat output only. No filesystem writes.

## When to trigger

- The user explicitly asks for caveman mode.
- The user asks for fewer tokens, briefer replies, or less filler.
- The task benefits from high-signal, low-ceremony communication.

## Anti-triggers

- Do not use by default.
- Temporarily suspend caveman mode for destructive-action warnings, legal/security risk language, or sequences where excessive compression could cause a dangerous misunderstanding.
- Do not alter code blocks, exact error messages, or quoted commands.

## Process

1. Drop filler, pleasantries, and hedging.
2. Keep technical substance exact.
3. Prefer short, direct patterns like `problem -> cause -> fix`.
4. Resume normal mode only when the user explicitly asks.

## Hard rules

1. Technical accuracy beats brevity.
2. Safety warnings stay explicit even if they require temporarily leaving caveman mode.
3. Code, commands, and exact error text remain unchanged.
4. If the user seems confused, switch back to clearer prose immediately.

## Review gate

This skill is complete when the response is materially shorter, still technically correct, and still safe to act on.
