---
status: accepted
date: 2026-10-24
---

# 0056. Changes to the world format and to parts are checked against old worlds

## Context and problem statement

Worlds are repaired on load (ADR-0026) and renamed part kinds, road styles and area types are mapped (ADR-0053), but nothing checked that a change was made safely. A part prop added without a default, a tighter limit, or a renamed prop would quietly change or lose values in saved worlds, and nobody would notice until a user opened one. Editing an object's shape also wrote back only the props this version knew, dropping any others (from a newer version of the app, or a renamed prop's old name).

## Decision drivers

- Saved worlds must open as they were saved (ADR-0020): nothing lost, nothing changed by surprise.
- Mistakes should fail `pnpm test`, not be caught by reading the diff.
- Adding to the format should stay easy: a default and a description, not a migration.

## Considered options

1. Guard tests, real old worlds as test fixtures, and explicit renamed/removed props.
2. Version every change and write migrations now.
3. Rely on the checklist in AGENTS.md alone.

## Decision outcome

Chosen option: **1**. Migrations stay for when worlds get a compatibility promise (AGENTS.md).

- **Guard tests:** every part's schema parses `{}` (a default for every prop), every inspector field names a prop whose default it can show (in range, one of its options), and every scene field has a `.describe()`. Required fields (no default) are only the ones on a short allowlist in `scene/jsonSchema.test.ts`: ids, kinds, points, data keys and values.
- **Old worlds:** `src/scene/fixtures/old-worlds/` holds templates exactly as earlier commits' code made them (`<template>-<commit>.json`, compact like a browser save; never edited, and Biome leaves them alone). `scene/oldWorlds.test.ts` opens each with today's code and expects no repair, every object, road, area, data value and viewpoint kept, every part, road style and area type known, and every stored prop either still the part's with the same value, renamed, or removed on purpose. `pnpm fixture:old-world <commit> <template>` makes a new one from any commit (a temporary git worktree running that commit's code). The first ones span the old ids, viewpoints, the text part and time of day.
- **Renamed and removed props:** a part lists `renamedProps` (old name → new name), which `resolveProps` reads when the new name has no value, and `removedProps` for props dropped on purpose. A prop that disappears without either fails the old-world test.
- **Unknown props are kept:** editing a prop (`setEntityProp`) changes only that prop, so props this version doesn't know stay in the world. Unknown world and object fields outside `props` are still dropped when a world from a newer version is repaired; the original is kept as a backup (ADR-0020), which is enough while there's no compatibility promise.
- **Defaults keep the old look:** a new prop's default must draw existing worlds as they were (e.g. balconies off). That's in the AGENTS.md checklist; rendering old worlds and comparing pictures isn't automated yet.

### Consequences

- Good: losing or changing saved values fails a test, with a message saying what to do.
- Good: renaming a prop no longer loses its value.
- Bad: the fixtures add about 200 KB of JSON to the repository, and each format change should add one more.

## More information

`src/parts/registry.test.ts`, `src/scene/jsonSchema.test.ts`, `src/scene/oldWorlds.test.ts`, `scripts/old-world-fixture.mjs`, `src/parts/types.ts` (`renamedProps`, `removedProps`). Related: ADR-0020, ADR-0026, ADR-0053.
