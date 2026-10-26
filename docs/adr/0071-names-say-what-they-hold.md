---
status: accepted
date: 2026-10-26
---

# 0071. Names say what they hold, and renamed world fields are read under their old names

## Context and problem statement

Many settings had single-word names that read like things rather than what they are: `title: true` (a switch, not a title), `closed` (a road that loops, not one closed to traffic), `lights: "auto"` next to an object's own `lights`, a data binding's bare `above`, `full`, `low` and `high`, a house's `chimney` and a tower's `floors`. People and AIs writing worlds (`/schema.json`) have to guess what they mean, and the code reads the same way. The app isn't published yet, so this is the time to rename them, but saved worlds must keep every value (ADR-0020, ADR-0026, ADR-0056).

## Decision drivers

- A field's name alone says what it holds: on/off, which colour, how much of what.
- Worlds saved under the old names open with nothing lost or repaired.
- One way to rename, so later renames are cheap and safe too.

## Considered options

1. Keep the names and explain them in descriptions.
2. Rename, and bump `SCENE_VERSION` with a migration.
3. Rename, and read old names on load like the old part kinds (ADR-0053) and renamed props (ADR-0056).

## Decision outcome

Chosen option: **3**. The convention is in AGENTS.md (Conventions: *Names say what they hold*): switches read as a yes/no or a verb phrase (`showTitle`, `loops`, `keepSpacing`), colours say whose and where (`colorAtHorizon`), amounts say what they measure (`floorCount`, `cloudCover`), settings that only apply together share a prefix (`gradientStart`, `gradientAngle`), and one field never means two things.

Renamed now:

- World: `driving` → `drivingSide`, `turns` → `turnStyle`; On screen `title`, `subtitle`, `timeOfDay`, `labelCards`, `details`, `viewpointBar` → `showTitle` … `showViewpointBar`; `lighting.lights` → `whenLightsAreOn`; `traffic.spacing` / `overtaking` → `keepSpacing` / `allowOvertaking`; `camera.turntable` / `tiltShift` → `turntableOn` / `tiltShiftOn`.
- Roads: `closed` → `loops`, `markings` → `showMarkings`, `railings` → `showRailings`, `lane` → `drivingLane`, `turns` → `turnStyle`. A vehicle's `follow.turns` → `turnStyle`.
- An object's light settings: `mode` → `whenOn`. Data bindings: `above` → `onAbove`, `full` → `valueAtFull`, `low` / `high` → `valueAtLowColor` / `valueAtHighColor`.
- Part props, through each part's `renamedProps`: house `chimney` → `showChimney`; grandstand `roof`, `crowd`, `rows` → `showRoof`, `showCrowd`, `seatRows`; warehouse `solar`, `doors` → `showSolarPanels`, `doorCount`; depot `garageDoor` → `showGarageDoor`; text `plate`, `size` → `showPlate`, `letterHeight`; beacon `pulse` → `pulses`; tunnel `building` → `buildingFloors`; yacht `decks` → `deckCount`; parcel stack `count` → `parcelCount`; office tower `floors` → `floorCount`.
- Preferences: `smoothing` → `cameraSmoothing`, `copyNames` → `namesOfCopies`.

Inspector labels say the same ("Show the title", "Number of floors"). Old names are read on load: world fields by the renamed-field tables in `scene/legacy.ts` (part of `upgradeLegacyIds`, so every parse and repair gets them; a value under the new name wins), part props by `renamedProps`, preferences by `RENAMED_PREFERENCES`. Entries are never removed.

### Consequences

- Good: the format reads as what it means, for people, AIs and code; renaming a world field is now as safe as renaming a prop.
- Bad: the tables of old names only grow. Code that builds a world from untyped objects (templates, `SceneSchema.parse({...})`) gets no type error for an old name, which Zod drops: the old-world fixtures and the template tests catch what they cover.

## More information

ADR-0026 (repair on load), ADR-0053 (old ids), ADR-0056 (old worlds and renamed props), ADR-0070 (the sky, named this way from the start). Tests: `scene/legacy.test.ts` (*renamed fields*), `editor/preferences.test.ts`, `scene/oldWorlds.test.ts`.
