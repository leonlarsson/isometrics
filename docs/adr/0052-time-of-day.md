---
status: accepted
date: 2026-10-23
---

# 0052. Time of day: a sun that moves, a sky that changes, and lights after dark

## Context and problem statement

Every world was lit by the same fixed studio daylight. Worlds are dioramas of real places and real data, and the time of day is part of that: a city at dusk, a harbour at dawn, a dashboard that goes dark at night. It should also be driven by data (ADR-0019): real time, or a value.

## Decision drivers

- Existing worlds must look exactly as before until someone picks a time.
- One setting (the time) should be enough; everything else follows it, but can be set by hand.
- The time can come from data, the clock, or pass on its own.
- Cheap: no per-frame React re-renders of the world, few real lights.

## Considered options

1. A day model from keyframes, a moving sun and moon, a tinted sky, and cheap night lights (emissive windows, additive light pools).
2. Real point lights for every lamp, window and headlight.
3. Just a sun angle slider.

## Decision outcome

Chosen option: **1**.

- **Model** (`scene/sun.ts`, pure and tested): a day in keyframes (night, pre-dawn, dawn, morning, noon, afternoon, golden hour, sunset, dusk), blended for any hour: light colour and strength, fill light, sky tint, the sky behind the world, and how dark it is (`night`, 0–1). The sun rises at 06:00 in the east (+x), is highest around 12:45 in the south (+z) and sets at 19:30 in the west; at night the moon, cool and faint, lights from the opposite side.
- **Settings** (`scene.lighting`): `time` (hours; null = the classic daylight, unchanged), `timeSource` (fixed, a day `cycle` that runs while motion plays with `dayLength`, the viewer's `clock`, or `data` from the entry `timeKey`), the sun's `sunAzimuth`, `sunElevation`, `sunColor` and `sunStrength` (null = from the time of day, the inherited-value pattern of ADR-0027), and `nightLights` (auto, on, off).
- **Time at runtime** (`editor/dayClock`): the 3D lights read the exact hour every frame; React reads it in 10-minute steps, so a running day re-renders parts only when it gets noticeably darker.
- **Lights** (`render/SceneLights`): the sun (or moon) moves, colours and dims; the sky and fill lights are tinted; shadows follow the sun, never lower than 6° (no endless shadows).
- **Sky:** the stage behind the world blends the theme's background towards the day's sky as the light colours (none at noon, nearly all at night), and the light theme's title turns light on a night sky. The editor's panels keep the theme.
- **Night lights:** parts get `palette.night` and `palette.lamplight`. Office towers show lit and dark windows (one shared texture, one cell per window pane, shifted per building by whole cells so panes stay in the window grid; floors differ, some busy, most only lit here and there), houses, warehouse doorways and yacht cabins glow, street lamps brighten and light a soft pool on the ground (drawn above roads, so a pool that reaches over one isn't cut off), and cars, vans and trucks driving along a road get headlights with a beam on the road (a fan that opens out from the lights and fades with distance) (parked ones stay dark; parts get a `driving` prop). All cheap: emissive materials and additive, unlit discs, no extra lights. The editor grid darkens at night.
- **UI:** Scene tab → Sun & sky: the time with presets (dawn, morning, noon, golden hour, dusk, night), where the time comes from, and the sun's direction, height, colour and strength. The sun controls are always there: without a time they show the classic sun as "Default", and an override applies to the classic daylight too.

### Consequences

- Good: one slider changes the whole mood; old worlds are untouched; time can follow data or the clock.
- Good: no real lights added, so it stays fast.
- Bad: night lights don't light their surroundings (a lamp's pool is painted on, not cast); real placeable lights are the "Lighting system" TODO.
- Bad: parts need to opt in to night lights; new parts should use `palette.night` (`parts/nightLights.tsx`).

## More information

`src/scene/sun.ts`, `src/editor/dayClock.ts`, `src/render/SceneLights.tsx`, `src/parts/nightLights.tsx`, `src/ui/SunSection.tsx`, `src/ui/AppShell.tsx` (sky), `src/scene/schema.ts` (`LightingSchema`).
