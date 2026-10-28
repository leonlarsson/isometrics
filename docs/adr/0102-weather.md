---
status: proposed
date: 2026-10-28
---

# 0102. Weather: rain, snow, fog, haze, lightning, and what it does to the ground

## Context and problem statement

A world's look has a time of day, a sky with clouds (ADR-0070) and moods (ADR-0078), but no weather. The owner asked for fog, rain, haze and snow (2026-10-28), with snow settling on the ground, wet ground, splashes and lightning in the first version, weather that softens the light, and amounts that mix rather than one type.

## Decision drivers

- Separate amounts that mix (misty rain, sleet), each able to follow data (ADR-0019, ADR-0058), kept by moods (ADR-0078).
- Works in the isometric diorama as well as in perspective (the distance haze, ADR-0077, only works in perspective).
- A world without weather looks and costs exactly as before; in particular the Standard graphics preset (ADR-0072) is untouched while it's dry and clear.
- Low-poly: flat, readable shapes, not photographic effects.

## Considered options

1. **Separate amounts** (rain, snow, fog, haze, lightning; snow on the ground and wet ground following them unless set), with quick picks that set them.
2. **One weather type** and how strong: simpler, but no mixing.

## Decision outcome

Chosen option: **1** (the owner, 2026-10-28).

- **The world's `weather`** (`WeatherSchema`): `rainAmount`, `snowAmount`, `fogDensity`, `hazeAmount`, `lightningRate` (0–1, 0 by default), `groundWetness` and `snowCover` (null: following the rain and the snow, ADR-0027), `showsSplashes` and `softensLight` (on). Each amount can follow a data value (`data`, by setting, as value ÷ valueAtFull), renamed and dropped with the value like objects' bindings. Clouds stay in `sky` (cloud cover, colour, speed) but are set in the Weather tab.
- **Moods** keep the weather too (`weather` in `MoodSchema`; moods from before get today's: none).
- **The light:** while `softensLight`, rain, snow and fog make it overcast (`overcastOf`): the sun dims and the fill grows, so shadows soften, and the sky and the light's colour grey a little, more as they grow (`skyLightAt` and `skyLookAt` take the overcast). Clouds alone don't, so worlds with clouds look as they did.
- **Falling:** rain as thin streaks and snow as soft flakes in a box round what the camera looks at, moved on the GPU by the motion clock (so pausing holds them); their number follows the amount. Splashes are small rings opening where drops land.
- **Fog and haze:** the world's fog in both views, thick and grey for fog, far and pale for haze, measured from the camera's target so the diorama fogs from its far side; combined with the viewer's distance haze (ADR-0077) where both are on.
- **On the ground:** snow settles on what faces up (roofs, grass, roads, treetops), whitening it; wet ground darkens and turns a little glossy. Both by a shared addition to every standard material (`render/weatherShading`), compiled in only while there's snow or wetness, so dry, snowless worlds draw with the shaders they always had. Water is left alone.
- **Lightning:** at its rate, a flash now and then lights the world from above for a moment, timed by the motion clock.
- **The Weather tab** (world tabs): quick picks (Clear, Cloudy, Rain, Storm, Snow, Fog), then Rain and snow, Fog and haze, On the ground, Lightning, Clouds (moved from Sky & water), and whether weather softens the light; every amount From data or by hand.

### Consequences

- Good: weather that mixes, follows data, travels with moods and shows in both views.
- Bad: snow and wetness add a little to every standard material's shader while they're on, and switching them on or off recompiles the shaders once.
- Later: weather per area, snow piling on paths walked or driven, wind bending rain and trees, rainbows.
