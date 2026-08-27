---
name: docs-index
description: "USE FOR: refreshing Wunderkind-managed documentation lanes and their index from durable project context."
---

# Docs Index

Refresh the documentation lanes that Wunderkind manages for the current project.

## Primary owner

`wunderkind-product`

## Filesystem scope

Enabled managed documentation output and its index.

## When to trigger

Use when managed documentation needs a bounded refresh or bootstrap.

## Anti-triggers

Do not rewrite unrelated documentation or infer ownership of external docs.

## Process

1. Inspect the configured documentation lanes.
2. Identify stale or missing managed entries.
3. Refresh only the owned index and entries.

## Hard rules

Preserve user-authored documentation outside Wunderkind-managed lanes.

## Review gate

The index reflects the managed lanes without claiming broader ownership.
