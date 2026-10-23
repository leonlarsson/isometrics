---
status: accepted
date: 2026-10-23
---

# 0044. Several worlds per browser, each in its own slot

## Context and problem statement

The browser kept one world (ADR-0006): it autosaved to a single key, and New, Start from a template and Open file replaced it after a "Replace?" dialog. Keeping two worlds meant saving one to a file first, and a mistaken confirm lost work.

## Decision drivers

- Never lose a world (ADR-0020): switching, creating and deleting must not drop anything.
- Keep autosave: users don't think about saving.
- Stay local-first: no backend yet (ADR-0006).

## Considered options

1. One key per world, a small index, and the id of the open world.
2. All worlds in one key (one JSON object with every world).
3. IndexedDB.

## Decision outcome

Chosen option: **1**, in `src/editor/persistence.ts`:

- **Keys.** Each world is stored under `<app>:world:<id>`, as the scene JSON. `<app>:world-index` lists them (`id`, title, last saved). `<app>:open-world-id` holds the id of the world that's open, so autosave writes there and the next visit opens it again (else the most recently edited world).
- **The index can't lose a world.** It's checked against the stored world keys every time it's read: a world missing from the index, or an index that can't be read, still shows up (titled from the world itself).
- **Migration.** The old single save (`<app>:scene`) is moved into a slot on load, exactly as stored. The old key is removed only once the copy is written.
- **New worlds open beside the others.** New empty world, New from a template and Open file each create a new world; the open one is saved first, so its last edits aren't left waiting for autosave. The "Replace?" dialog is gone.
- **File menu.** Open world lists the 8 most recently edited worlds, with the open one checked. **All worlds…** opens a searchable list of every world, where any of them can be opened, copied or deleted without opening it first. Duplicate world copies the open world as "… (copy)". Renaming is the world's title (Scene tab).
- **Distinct titles.** A new world (empty, from a template, from a file, or a copy) gets a title no other saved world has ("Untitled world 2"), so the list can tell them apart.
- **Deleting backs up first.** Delete world asks first, keeps a backup (Scene → Backups), then opens the most recently edited other world, or a new empty one. If the backup can't be made, nothing is deleted.
- **Repairs and backups are per world.** Opening a world goes through the same repair path as before (ADR-0026); an unreadable world is backed up and not opened.
- **Crash screen.** "Start fresh" opens a new world; the one that crashed stays in the list and is also backed up.
- **Full storage.** If saving fails (storage full), the user is told once, with the way out: save to a file, or delete worlds.

One key per world keeps each save small and independent (a broken world can't take the others with it). A single key would rewrite every world on every edit. IndexedDB would lift the ~5 MB limit, but is asynchronous throughout and isn't needed at today's world sizes; the slots can move there later without changing the File menu.

### Consequences

- Good: no more replacing worlds by accident; switching is instant; old saves carry over.
- Good: each world fails, repairs and backs up on its own.
- Bad: everything still shares the browser's ~5 MB for this site; many large worlds will eventually fill it.
- Bad: two tabs on different worlds share the stored open world's id, so a reload opens whichever was switched to last.
- Note: ADR-0020 names the old single save key; backups work as it describes, now for each world.

## More information

ADR-0006 (local-first persistence), ADR-0020 (never discard saves), ADR-0026 (repairs). Code: `src/editor/persistence.ts`, `src/editor/fileActions.ts`, `src/ui/FileMenu.tsx`, `src/ui/ErrorScreen.tsx`.
