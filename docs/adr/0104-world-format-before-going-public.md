---
status: proposed
date: 2026-10-30
---

# 0104. The world format before going public: one name per idea, settings where they belong

## Context and problem statement

Before the app is public, the world format was audited as a whole (2026-10-30). It had grown a feature at a time, and it showed: vehicle settings were split between the top of the world and `traffic`; clouds were stored in `sky` but shown and thought of as weather, so they couldn't follow data; the time of day took its data key from a one-off `timeKey`; switches came in four grammatical forms (`showSun`, `showsSplashes`, `keepOverGround`, `turntableOn`); `elevation` meant a height on objects and an angle everywhere else; which registered thing something is was `kind`, `style` or `type`; a data value's `label` was its name, while an object's `label` was its card; objects stored their turn as `rotation` and their tilt as `pitch` and `roll`, whose meaning changed with the way a part faces; roads, areas and the ground had a bare `color` that couldn't follow data; nature parts had a `size` that did exactly what `scale` does, both shown as "Size"; and formats older worlds used (`color`, `accent`, one `lights` mode for all) were still listed in `/schema.json` for people and AIs to copy.

Once worlds are out in public, every rename costs a migration. Now it costs a line in a table. This decision settles the vocabulary so that what comes later (more parts, more data, aircraft, junctions, block modelling) has an obvious place and name.

## Decision drivers

- A field's name says what it holds, and one idea has one name: in the file, `/schema.json`, the code and the properties' labels.
- Settings live where people look for them, and grouped as the properties group them.
- Anything drawn can follow data where that's natural (ADR-0019).
- Saved worlds open with nothing lost (ADR-0020, ADR-0026, ADR-0056): every old name and shape is read on load.
- The rules are written down, so the next field is named right the first time.

## Considered options

1. Fix names one at a time as they bother someone.
2. Bump `SCENE_VERSION` and migrate.
3. Settle the vocabulary now, rename and move everything that breaks it, and read old names and shapes on load, as ADR-0071 did.

## Decision outcome

Chosen option: **3**. This supersedes ADR-0071's form for switches (`showTitle`, `keepSpacing`); the rest of ADR-0071 stands.

### The vocabulary

- **Switches state something about their owner**, in the third person (`sky.showsSun`, `road.loops`, `traffic.keepsDistance`, `leansInTurns`), or with `is` for a state (`isLocked`, `isHidden`, `isOpen`, `isOn`). Never an imperative: `showSun` reads as an action and `loop` or `pulse` as a thing. (Preferences, the viewer's own instructions to the app, keep theirs: "Show the wireframe".)
- **`kind`** is which registered thing it is, for everything: an object's part, a road's, area's or fence's kind, the backdrop's.
- **Heights:** `altitude` is how high above the base ground something is (an object, a road point, a viewpoint's target), `lift` is how far above what it stands on (a fence point above the ground under it, an area corner or peak above the area's height), and `height` is how tall something is (a part, a fence, an area's raised top).
- **Angles:** `azimuth` is a compass direction (degrees counter-clockwise from +x seen from above), `elevation` an angle above the horizontal. Nothing else is called either.
- **Rotation** is `[x, y, z]` in degrees, applied y, then z, then x (each about the object's own axes after the ones before), as the Transform panel shows it.
- **Groups:** a thing's own overrides of a world group sit in a group of the same name, each `null` while it's the world's (a road's `traffic`, a water area's `water`). A feature with an on/off switch and settings of its own is a group with `isOn` (`camera.turntable`, `camera.tiltShift`). Settings that only apply together otherwise share a prefix (`gradientStart`, `embankmentAngle`).
- **Colours** of anything drawn are a `colors` map by colour id, each a colour setting (a colour, a transparency for glass, and data): objects, fences, roads, areas and the ground. So all of them can follow data, and a new colour (a road's railings) is a new id, not a new field.
- **Data:** a setting follows data through a `data` map next to it, by setting (`lighting.data.time`, `weather.data.cloudCover`), never a one-off `…Key` field. What shows values names them by key (`label.dataKeys`, `details.dataKeys`, the text part's `dataKey`).
- **Amounts** say what they measure: a share from 0 to 1 ends in `Share` (`builtShare`, `litPaneShare`), a number of things in `Count` (`floorCount`, `seatRowCount`), a relative weight in `Weight` (`paneWeight`).
- **Sizes:** buildings, whose front faces +z, are `width` (x) by `depth` (z); long things (vehicles, benches, beds, logs, tunnels) are `length` (x) by `width` (z).
- **Units:** grid units, for every distance.

### What changed (old → new)

World:
- `drivingSide`, `turnStyle`, `leansInTurns` → `traffic.drivingSide`, `traffic.turnStyle`, `traffic.leansInTurns`; `traffic.keepSpacing` → `keepsDistance`, `allowOvertaking` → `overtakes`.
- `sky.showInPerspective`, `showSun`, `showMoon` → `showsInPerspective`, `showsSun`, `showsMoon`.
- `sky.cloudCover`, `cloudColor`, `cloudSpeed` → `weather.cloudCover`, `cloudColor`, `cloudSpeed`; `weather.data` can drive `cloudCover`.
- `lighting.timeKey` → `lighting.data.time` (a data binding; its `key` is the value holding the hour).
- `onScreen.showTitle` … `showViewpointBar` → `showsTitle` … `showsViewpointBar`.
- `camera.keepOverGround` → `keepsOverGround`; `steepestElevation` → `highestElevation`; `turntableOn`, `turntableSpeed`, `turntableDelay` → `turntable.isOn`, `speed`, `delay`; `tiltShiftOn`, `tiltShiftBlur`, `tiltShiftFocus`, `tiltShiftPosition` → `tiltShift.isOn`, `blurStrength`, `sharpBandHeight`, `sharpBandPosition`.
- Moods: `camera` (its tilt-shift) → `tiltShift`, with their clouds, time key and the rest moved as the world's are.
- `ground.color` → `ground.colors.surface`.
- Data values: `label` → `name`.
- Viewpoints: `targetHeight` → `targetAltitude`.

Objects:
- `elevation` → `altitude`; `rotation`, `pitch`, `roll` → `rotation: [roll, rotation, pitch]`.
- `locked`, `hidden` → `isLocked`, `isHidden` (objects, roads, areas and fences).
- `label` is always there: `label: null` → `label.isShown: false`; `label.enabled` → `isShown`.
- `follow.offset` → `startDistance`; `follow.reverse` → `drivesTheOtherWay`.
- `color`, `accent` → `colors.<id>` of the part's colours marked `legacy` (ADR-0060); `lights: "auto" | "on" | "off"` → each of its lights' `whenOn`; the settings lights' `legacy` hooks read from props and the accent → those lights' settings. Files and AIs may still write the old ones; `/schema.json` no longer lists them.
- Light settings: `litPanes` → `litPaneShare`, `weight` → `paneWeight` (and the data setting `litPanes` → `litPaneShare`). Data bindings: `onAbove` → `switchesOnAbove`.
- Nature parts' `size` → multiplied into `scale`.

Roads: `style` → `kind`; `showMarkings` → `showsCentreLine`; `showRailings` → `showsRailings`; `supports` → `heldUpBy`; `drivingLane`, `turnStyle`, `leansInTurns` → `traffic.*`; `color` → `colors.surface`; `embankmentColor` → `colors.embankment`.

Areas: `type` → `kind`; `color` → `colors.surface`; `rippleStrength`, `reflectionStrength` → `water.*`.

Fences: `style` → `kind`.

Parts: every `show…` prop → `shows…`; the lighthouse's `beamTurns` → `beamRotates`; the wind turbine's `rotorTurns` → `rotorSpins`; the tunnel's `buildingFloors` (a height, not a count) → `buildingHeight`; the grandstand's `seatRows` → `seatRowCount`; the cargo ship's `containerLayers` → `containerLayerCount`; the shipping container's `stackHeight` → `containerCount`; the church's, barn's and greenhouse's `length` → `depth`. Lights: `warningLamp` (mobile crane, gantry crane, pylon) and the forklift's `beacon` → `warningLight`; the sailing boat's `masthead` and the cargo ship's `mastheadLamp` → `mastheadLight`; the bicycle's `lamp` → `headlight`; the race car's `rain` → `rainLight`.

### Reading worlds

Untrusted JSON (storage, files, paste, AI) goes through one function, `readWorld` (`parts/readWorld.ts`):

1. `upgradeLegacyIds` (`scene/legacy.ts`, framework-free): old ids, renamed fields and moved fields, as tables plus a few moves; a value under the new name wins; entries are never removed.
2. `upgradePartSettings` (`parts/`, which knows the parts): the old `color` and `accent`, one `lights` mode for all, the lights' `legacy` hooks, renamed props and lights written under their new names, props folded into `scale`.
3. Parse, or repair what still doesn't validate (ADR-0026).

So the document holds what the app draws, and nothing reads old shapes at draw time.

### Consequences

- Good: one vocabulary for the file, `/schema.json`, the code and the labels; settings are grouped as the properties show them; roads, areas, the ground and clouds can follow data; old worlds open unchanged.
- Good: worlds come out of `readWorld` in the current shape, so saving them once brings them up to date.
- Bad: a large one-off change across the code; the legacy tables grow.
- Later: once worlds travel between versions (sharing links), keep fields this version doesn't know instead of dropping them (TODO), and bump `SCENE_VERSION` for breaking changes from then on.

## More information

ADR-0026 (repair), ADR-0027 (inherited values), ADR-0050 and ADR-0053 (numbered kinds), ADR-0056 (safe changes), ADR-0058 and ADR-0060 (lights and colours), ADR-0071 (names say what they hold), ADR-0097 (rotation in three axes), ADR-0098 (objects stand on the ground), ADR-0102 (weather), ADR-0103 (fences). The conventions are in AGENTS.md (*Names say what they hold*).
