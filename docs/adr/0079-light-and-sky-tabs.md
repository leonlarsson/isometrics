---
status: proposed
date: 2026-10-26
---

# 0079. Sun & sky splits into Moods, Light, and Sky & water

## Context and problem statement

The Sun & sky tab (ADR-0052, ADR-0054) grew to seven panels and some 27 fields: moods (ADR-0078), the time of day, the sun (with sun and shade contrast, ADR-0072), the sky in perspective and the backdrop (ADR-0070), the water's ripples and reflections (ADR-0075), and when lights come on (ADR-0061). It had outgrown itself (the owner, 2026-10-26).

## Decision drivers

- Each tab short enough to see at a glance.
- Things that are set together sit together: the time of day decides the sun's place and colour and when lights come on; the sky, the backdrop and the water are what surrounds the world.
- Moods span all of them (and tilt-shift from the Camera tab), so they don't belong inside any one.

## Considered options

1. **Moods, Light, Sky & water.**
2. **Light, Sky & water**, with Moods at the top of Light.
3. **Time, Sun & lights, Sky, Water**, one small tab each.

## Decision outcome

Chosen option: **1** (the owner's choice).

- **Moods** (`moods`, palette icon): the world's moods.
- **Light** (`light`, sun icon): the time of day and where it comes from, the sun (direction, height, colour, strength, sun and shade contrast), and when the world's lights come on.
- **Sky & water** (`sky`, cloud icon, the old tab's id): the sky in perspective, the backdrop behind the diorama, the water.
- The panels keep their ids (`sky.time`, `sky.water`…), so folded panels stay folded. Buttons and hints that pointed at Sun & sky point at the tab that now has the setting (Open the Light tab, Open the Moods tab). Settings search finds them in their new tabs.
- The world tabs on the rail: World, Moods, Light, Sky & water, Camera, Viewpoints, Traffic, Data.

### Consequences

- Good: shorter tabs, grouped by what's set together; moods have a place of their own.
- Bad: eight world tabs on the rail; one more click between the time of day and the sky.

## More information

Code: `src/ui/Inspector.tsx` (`WORLD_TABS`), `src/ui/LightTab.tsx`, `src/ui/SkySettings.tsx` (`SkyWaterTab`), `src/ui/MoodsSection.tsx`, `src/editor/store.ts` (`TWorldTab`). Supersedes, for the tab, ADR-0054's Sun & sky. Related: ADR-0052, ADR-0061, ADR-0070, ADR-0072, ADR-0075, ADR-0078.
