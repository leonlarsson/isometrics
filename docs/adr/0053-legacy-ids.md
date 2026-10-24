---
status: accepted
date: 2026-10-24
---

# 0053. Worlds saved before the numbered ids get the new ids on load

## Context and problem statement

ADR-0050 renamed every part kind, road style and area type (`tower` → `office_tower_01`, `asphalt` → `road_01`, `water` → `water_01`) and chose not to map the old ids. In practice that is worse than "placeholders": repair (ADR-0026) resets an unreadable road style or area type to its default, so a hidden ferry route becomes a visible road and a lake becomes grass, and every object shows as a pink placeholder. The renames are one to one, so nothing is lost by mapping them.

## Decision drivers

- Never discard user data (ADR-0020); a rename shouldn't cost anyone their world.
- No `SCENE_VERSION` bump or migrations while the app is a playground (ADR-0026).

## Considered options

1. Map old ids to new ones before validating, in `parseScene` and `repairScene`.
2. Keep ADR-0050's choice and rely on repair and the unknown-part warning.

## Decision outcome

Chosen option: **1**. This replaces ADR-0050's "Old ids aren't mapped"; the rest of ADR-0050 stands.

- `scene/legacy.ts` lists the old part kinds, road styles and area types with their new ids, and `upgradeLegacyIds` replaces them in a world's raw JSON. It copies rather than mutates, so callers still keep the original as a backup.
- `parseScene` runs it before validating, so an old world that is otherwise fine opens with no repair report. `repairScene` runs it too, so a world that needs repairing for another reason keeps its road styles and area types.
- It is silent: the parts, roads and areas are the same ones, under new names. Kinds that have no part (removed, or from a newer version) still show the warning from the unknown-part toast.
- A future rename of an id adds its old id here; a test checks that every entry points at an id that exists.

### Consequences

- Good: worlds saved before ADR-0050 open as they were; the next save writes the new ids.
- Bad: one more table to keep, until worlds get a version promise and this moves into `migrate.ts` as a real migration.

## More information

`src/scene/legacy.ts`, `src/scene/migrate.ts`, `src/scene/repair.ts`. ADR-0026, ADR-0050.
