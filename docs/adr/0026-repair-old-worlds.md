---
status: accepted
date: 2026-10-22
---

# 0026. Repair old worlds instead of rejecting them

## Context and problem statement

The app is an experimental playground. The scene format changes in place, without version bumps or migrations, so a world saved in the browser or exported as a file may not validate in a later version. Parsing was all-or-nothing: one invalid value anywhere (a renamed road style, a road point out of range) made the whole world unreadable. ADR-0020 already keeps such a save as a backup, but the user still couldn't open it, and an exported file gave no better guarantee than the browser save.

## Decision drivers

- Keep the freedom to change the format quickly while the app is a playground; migrations for every change are too much overhead for now.
- Users should keep as much of their work as possible, and know when something was lost.
- Never discard the original (ADR-0020).

## Considered options

1. Keep rejecting worlds that don't validate.
2. Version the format and write a migration for every breaking change.
3. Repair what can't be read and keep everything else.

## Decision outcome

Chosen option: **3, repair**, because it costs nothing per format change and opens nearly every old world. Migrations (option 2) can come later, when the format settles and worlds need a compatibility promise; repair stays useful as a safety net then.

How it works (`src/scene/repair.ts`):

- Strict parsing comes first; only a world that fails it is repaired.
- Each object, road, area and data value is checked on its own. An invalid field is removed so its default applies; an invalid entry inside a list (one road point) is dropped; an item that still can't be read (e.g. it has no id) is left out. Duplicate ids keep their first item. Invalid scene settings (theme, ground…) fall back to defaults.
- Worlds from a newer version are repaired the same way. Input that doesn't look like a world (no version and no objects, roads or areas) is still rejected.
- The user is told in plain words what changed ("2 objects and 1 road couldn't be read and were left out…").

Where it applies:

- **Browser save:** a repaired save opens, the untouched original is kept as a backup (ADR-0020) and a bar explains what changed, with **Download original**. Only saves that can't be repaired at all stay unopened, as before.
- **Open file:** a repaired file opens with a toast describing the repairs; the file on disk is untouched.

The status banner says plainly that saved worlds, in the browser or as files, may be lost or only partly open in later versions.

### Consequences

- Good: old worlds keep working after most format changes, with no per-change effort.
- Good: nothing is silently lost: the user is told, and browser originals stay in Backups.
- Bad: a renamed field still loses its value without notice (the new field just gets its default); only a migration can carry it over.
- Bad: repaired worlds can differ from what the user built (a road with a reset style, a missing object).

## More information

- Related: ADR-0003 (scene document), ADR-0020 (never discard unreadable saves).
- Tests: `src/scene/repair.test.ts`, `src/editor/persistence.test.ts`.
