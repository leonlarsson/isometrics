---
status: accepted
date: 2026-10-21
---

# 0006. Local-first persistence, no database (yet)

## Context and problem statement

Do we need a database? This isn't a SaaS product yet: there are no accounts, no multi-tenancy, and no need to query across worlds.

## Decision outcome

**No database.** The scene autosaves to `localStorage` (debounced, `src/editor/persistence.ts`) and can be exported or imported as a `.json` file. Everything loaded goes through `parseScene()` (ADR-0003).

Planned escalation path, taking each step only when a feature needs it:

1. URL-hash sharing (compressed scene JSON in the link).
2. Cloudflare KV or R2: one key or object per world, for short share links.
3. Cloudflare D1: once there are users, lists of worlds, or queries.

### Consequences

- Good: zero infrastructure, works offline, nothing to secure.
- Bad: worlds live in one browser until exported; clearing site data loses them.
