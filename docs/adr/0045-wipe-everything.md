---
status: accepted
date: 2026-10-23
---

# 0045. "Wipe everything" deletes all browser data, after two confirmations

## Context and problem statement

The app never discards stored worlds: unreadable saves, deleted worlds and "start fresh" all keep a backup first (ADR-0020, ADR-0044). That leaves no way to get back to a clean slate, for example to start over, hand the browser to someone else, or clear out test worlds and backups, short of clearing the site's data in the browser's settings.

## Decision drivers

- People should be able to remove everything the app stores, from inside the app.
- It must be very hard to do by accident.
- Everywhere else, the never-discard rule stays as it is.

## Considered options

1. No wipe; point people at the browser's own "clear site data".
2. A Wipe everything action with two confirmations, as the one deliberate exception to the never-discard rule.

## Decision outcome

Chosen option: **2**.

- **Where.** File menu → **Wipe everything…**, last in the menu, described as "Every world, backup and setting in this browser".
- **First confirmation.** It says what goes and offers Save to file.
- **Second confirmation.** It names the counts ("3 worlds and 2 backups will be deleted for good"), and its button only works after a 3-second countdown.
- **What it does.** `wipeEverything()` (`src/editor/persistence.ts`) clears the site's `localStorage` and `sessionStorage`. That covers every world (and with it each world's UI theme), every backup, the open world's id and preferences such as panel sizes. It also stops saving, so a pending autosave can't write the open world back, and then the page reloads as on a first visit.

This is the only code path that drops stored worlds without a backup.

### Consequences

- Good: a clean slate from inside the app, without hunting through browser settings.
- Bad: it really is gone; only files the user saved survive.

## More information

ADR-0020 (never discard saves), ADR-0044 (several worlds). Code: `src/editor/persistence.ts`, `src/ui/FileMenu.tsx`.
