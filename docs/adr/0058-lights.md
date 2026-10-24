---
status: accepted
date: 2026-10-24
---

# 0058. Lights are a shared system: parts declare them, objects set each one, data can switch them

## Context and problem statement

Night lights (ADR-0052) grew part by part, five different ways: office windows had a helper, houses, warehouses and yachts glowed with their own emissive materials, a street lamp's light colour was its accent and its brightness and reach were props, road vehicles had headlights in the theme's fixed lamplight colour, and the race car's rain light had a colour prop of its own. Each object had one setting (after dark, always, never) for all its lights, folded into the palette's `night`. A car's headlights couldn't be recoloured, switched apart from its other lights, or driven by data, and every new light meant another one-off.

## Decision drivers

- Vehicles and other assets will have several kinds of lights (headlights, rain and brake lights, beacons, landing lights), each switched and coloured on its own.
- One way to build, set and draw a light, so every part and every future light benefits.
- Data is a core pillar (ADR-0019): a light should be switchable by a value.
- Old worlds keep their lights as they were (ADR-0020, ADR-0056).

## Considered options

1. A shared model: parts declare an array of lights, objects store settings per light by id, one resolve function, shared drawing helpers and one settings card.
2. Keep one setting per object and add colour and strength props part by part.

## Decision outcome

Chosen option: **1**.

- **Parts declare their lights** (`lights: ILightSpec[]` in `parts/types.ts`): an `id` (stable; renamed ids go in `renamedLights`), a `name`, a `shape` (`lens`, `beam`, `pool`, `windows`, `glow`; beams and pools have a reach) and defaults: colour (the theme's lamplight if none), strength, reach, and `when` (`dark`, or `driving` for lights only on after dark while driving along a road). A light's shape and place are the part's; objects change the rest.
- **Objects store settings per light, by id** (`entity.lights`, `EntityLightSchema`): `mode` (auto / on / off), `color`, `strength`, `reach`, and `data`, the settings that follow a data value. Every field is null while it's as the part has it (ADR-0027), and only lights with a setting are stored, so a part gaining, losing or reordering lights never mixes them up.
- **Data bindings, built for more** (`DataBindingSchema` in the scene format, `parts/dataBinding.ts`): a binding is `{ key, above, full }`, a data value and its options, and a light's `data` maps settings to bindings: `{ on: …, strength: …, color: … }`. Three kinds of reading, shared by anything that follows data: **switch** (on while the value is a number above `above`, 0 by default, or the text on, yes or true; anything else is off), **scale** (value ÷ `full`, so `full` gives 100%) and **colour** (any CSS colour: a name, #rgb or #rrggbb, rgb() or hsl()). A value that's missing or doesn't read as its kind leaves the setting as it is. `LIGHT_DATA` in the light model says which setting reads which kind; making another setting follow data is a line there, a line in `resolveLight` and the shared `DataBindingFields` in the card, with no change to the format: `data` is a map, so saved worlds stay valid, and new binding options get defaults. Renaming a data value renames it in every binding; deleting one stops those settings following data. Nothing in the bindings is about lights, so part props (a building's height) or area heights can follow data the same way later.
- **One resolve function** (`parts/lightModel.ts`, pure and tested): from a light's spec, the object's setting, how dark it is (the palette's `night`, with the world's light setting applied), whether it drives and the data, it gives `{ on, level, color, reach }`. Parts get every light resolved, by id, as `lights` in their render props, and never decide on/off themselves.
- **Shared drawing helpers** (`parts/lights.tsx`) take a resolved light: `lightEmission` for a part's own glowing surfaces, `LightLens`, `Headlights` (beams as long as the reach), `LightPool` (a pool on the ground, anywhere) and `LitWindows`. Still painted-on light (emissive and unlit materials, additive discs), no real light sources.
- **Settings:** a Lights tab (the bulb icon) on the selection's rail, with a card per light (`ui/LightSettings.tsx`, made only from kit fields). One question per setting, so they can't contradict each other, in three groups (`FieldGroup`, a titled inset box, new in the kit): **Turns on** (When: after dark / always / never / by a data value, which adds the data value and **On above**), **Brightness** (Source: by hand, as a Level in percent, 100% normal up to 300%; or from data, with the data value and **100% at**) and **Look** (Source for the colour: by hand, or from data, any CSS colour; and for lights on the ground Beam length or Glow size). Settings that follow data show the shared `DataBindingFields`, which say what the data does right now ("Queue is 60, so it's on now"; "Passengers is 12, so it's at 240% now"; "Status is “orange”, so it's #ffa500 now"). Without a time of day the tab explains that it never gets dark, so after-dark lights stay off. The world's Sun & sky → Lights stays the default for every light.
- **A Light part** (`light_01`, Ground & props): a small ground spotlight or no fixture, with one pool light: a light on its own, set like any other.
- **Old worlds:** an object's old single setting (`"auto"`, `"on"`, `"off"`) still reads as the mode for all its lights, and becomes each light's own setting the first time one is changed. A light's `legacy` hook reads settings that used to live elsewhere: the street lamp's `brightness` and `reach` props and its accent colour, the race car's `rainLight` prop (all now in `removedProps`). The old-world tests open every saved world with nothing lost, including Monaco as it was just before this change.
- **`/schema.json`** lists each kind's lights (id, name, shape) and explains the settings.

### Consequences

- Good: every light can be switched, coloured, dimmed and driven by data on its own, the same way everywhere; a new light is a line in the part plus a helper where it's drawn.
- Good: placeable lights come for free.
- Bad: the scene's `lights` field is a union while old worlds still use the single value.
- Bad: lights still don't light their surroundings (a TODO).

## More information

`src/parts/lightModel.ts` (+ tests), `src/parts/lights.tsx`, `src/parts/types.ts`, `src/ui/LightSettings.tsx`, `src/parts/infrastructure/light_01.tsx`, `src/scene/schema.ts` (`EntityLightSchema`). Refines ADR-0052's per-object Lights setting. Related: ADR-0019, ADR-0027, ADR-0054, ADR-0056.
