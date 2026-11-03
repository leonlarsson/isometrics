---
status: proposed
date: 2026-11-03
---

# 0132. Deleting the open world shows the home screen, never another world

## Context and problem statement

Deleting the open world opened the most recently edited other one in its place (ADR-0121), and the home screen only when none was left. Someone who has just deleted a world doesn't expect a different one to appear in its place, maybe to be edited by mistake. The owner (2026-11-03): deleting a world should never take you to another world; always the home screen.

## Decision outcome

**File → Delete world…** (`deleteOpenWorld`) always ends on the home screen. One's other worlds are listed there to pick from, and the toast says it was deleted and where its copy is kept (File → Backups).
- With worlds left, its reason is `deleted`, with no notice of its own (the toast says it).
- With none left, it's `noWorlds`, as before.
- Deleting another world, from All worlds, leaves the open one open.
- Starting the app is unchanged: Preferences → **When the app opens** still decides.

### Consequences

- Good: no world opens that wasn't asked for.
- Bad: one more click to carry on in another world.

## More information

Changes what [ADR-0121](0121-what-is-open-links-previews-and-home.md) says happens on deleting the open world; the rest of ADR-0121 stands. `e2e/worlds.spec.ts` checks it.
