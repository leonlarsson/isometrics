---
status: accepted
date: 2026-10-21
---

# 0020. Never discard a saved world the app can't read

## Context and problem statement

Worlds autosave to the browser (ADR-0006). If a deploy changes the scene format in a breaking way, an older save fails validation. The app used to log a warning and open the starter template, and the first edit then autosaved over the old save, silently losing the user's work. The app is deployed now, so this can happen to real users.

## Decision outcome

An unreadable save is always kept:

- `loadStoredScene()` returns `empty`, `ok`, or `unreadable`. When unreadable, the raw saved text is first copied to a backup key (`<app>:scene-backup:<timestamp>`, see `src/editor/persistence.ts`). Only then can autosave replace the main save. An identical save is backed up only once, so reloading doesn't pile up copies. Only the newest 5 backups are kept.
- The app shows `RecoveryBar`: the save couldn't be opened, it's been kept, plus **Download backup** (the exact stored text) and **Dismiss**, and a short reason (the first validation issue). If backing up itself failed, the bar says so and still offers the download, because the raw text is in memory.
- **Scene → Backups** (`BackupsPanel`) lists backups with Download and Delete, so dismissing the bar never loses anything.

This is a safety net, not a substitute for migrations. While the app is unreleased, schema changes happen in place without migrations (AGENTS.md); once real users depend on it, breaking changes should bump `SCENE_VERSION` and migrate in `parseScene()` so saves upgrade automatically.

### Consequences

- Good: no silent data loss from schema changes, corrupted storage or bugs.
- Bad: backups use browser storage until users delete them (capped at 5). Users still have to restore by hand, by downloading the file and fixing or importing it.
