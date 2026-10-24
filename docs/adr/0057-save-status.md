---
status: accepted
date: 2026-10-24
---

# 0057. A save status next to the File menu says whether the world is saved

## Context and problem statement

Every change is saved to the browser 300 ms later (ADR-0006, ADR-0044), silently. The only feedback was a toast when a save failed, so it was unclear whether, when and where work was kept, and Ctrl+S (save to a file) suggested that nothing was saved otherwise.

## Decision drivers

- Always know whether the open world is saved, without having to ask.
- When it isn't, know why and what to do, with the fix one click away.
- Quiet when all is well; nothing in View mode, where nothing changes.

## Considered options

1. A small status next to the File menu, with its details in a menu.
2. A toast after every save.
3. A line in the File menu only.

## Decision outcome

Chosen option: **1**.

- **States** (`TSaveStatus` in `editor/persistence`, `useSaveStatus`): *Not saved yet* (a first visit's starter world, before any change), *Saving…* (a change waiting for the autosave), *Saved* (written; the time comes from the world list for a world that was just opened) and *Not saved*, with the reason: the browser's storage for the site is full, the browser doesn't allow storage at all (private browsing, blocked site data), or everything was just wiped (ADR-0045).
- **Where:** next to the File menu in Edit mode, an icon and a word (just the icon on phones); red when not saved. Hidden in View mode.
- **Its menu:** what the status means (saved in this browser at what time, and only in this browser; or why not and what to do) and **Save to file**. The kit's `Menu` gains `Menu.Note` (a paragraph that isn't an item) and a `tone="danger"` trigger.
- The toast when saving fails stays (once), now saying which of the two reasons it is.

### Consequences

- Good: it's always clear whether the world is saved, and a failed save can be fixed from the same place.
- Bad: "Saving…" flashes briefly after each change; it's small and muted, like other editors' save status.

## More information

`src/editor/persistence.ts`, `src/ui/SaveStatus.tsx`, `src/editor/saveStatus.test.ts`. Turning autosave off is a TODO. Related: ADR-0006, ADR-0020, ADR-0044, ADR-0045.
