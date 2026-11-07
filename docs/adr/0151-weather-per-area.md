---
status: proposed
date: 2026-11-07
---

# 0151. Weather per area: a storm over one district

## Context and problem statement

A world has one weather (ADR-0102): it rains, snows or fogs everywhere at once. The owner wants weather per area (2026-11-07), for a storm over one isolated district and for maps that show data as weather: a sentiment tracker where each region's mood is its sky, sunny where it's good and stormy where it's bad. It should be simple, and every effect the world's weather has should be able to stay in one place.

## Decision drivers

- Simple to use: no new kind of thing to learn; any area can have its own weather.
- Every effect that has a place stays in it: rain, snow, splashes, wet ground, snow on the ground, fog and haze, clouds, lightning, and the light dimming under the storm.
- Data first (ADR-0019): each area's amounts follow a value, so a table of regions can drive a map of weathers.
- A world where no area has its own weather looks and costs exactly as before (ADR-0072, ADR-0092).
- A frame costs what moves: many areas with weather must not mean a draw (or a particle system) per area.

## Considered options

1. **An area's own `weather`**, the world's whole weather group, `null` while it's the world's (the AGENTS.md vocabulary: a thing's overrides of a world group sit in a group of the same name).
2. **Weather zones**, a new list of outlines that only carry weather.
3. **Only some settings per area** (rain and snow), the rest world-wide.

## Decision outcome

Chosen option: **1**. Areas are already outlines the world can be drawn with, patched by id and listed in the outliner; a zone of its own would be a second kind of outline doing the same job. A whole weather group (not a few fields) means the area's Weather tab is the world's, and nothing is left world-wide that could have a place.

- **The format:** `area.weather` is a `WeatherSchema` or `null` (the default: the world's weather). Its own starts as a copy of the world's. Its `data` bindings are the area's (`areaBindingMapsOf`), so renames, deletes and redrawing on a value change cover them. Moods don't keep areas' weather: a mood is the world's look, the area's weather is the area's.
- **Inside and outside:** inside an area with its own weather, it replaces the world's; outside, the world's holds. The edge is soft (about two grid units), so a storm fades out rather than stopping at a line. Where areas with their own weather overlap, the later one is on top.
- **The weather map** (`scene/weatherMap.ts`, no three.js): a small top-down map over the areas with their own weather (at most 256 texels a side): each texel holds how much of an area's own weather covers it and that weather's amounts (rain, snow, wetness, snow cover, fog, haze, how much it darkens, splashes, how high its clouds float). Each area's coverage is worked out once per outline and kept; a change of amounts (a slider, a data value) only mixes them again. The view keeps it in three textures, which every weather shader reads: the amount at a place is the world's where nothing covers it, mixed towards the area's by its coverage.
- **Rain, snow and splashes** are one field each, moved on the GPU, over all of where they fall: the whole ground while the world's weather has them, else every area with its own (so 100% of a rainy area rains and splashes, wherever the camera is). As many fall as a view's worth over what's in view would be, so the density on screen stays the same at any zoom (up to a limit, past which a big region seen close up thins out). Each drop has a rank; it's drawn where the amount at its place is above its rank, so an area at 100% rains as hard as the whole world would, next to dry ground. Their number is the most any place in the world needs.
- **On the ground:** snow and wetness read the map at each point (`weatherShading`, compiled in while there's snow or wetness or any area has weather). An area's fog and haze lie over what's in it, thickest near the ground and in the area's own colours (grey fog, pale haze), and under its storm it darkens by how overcast its weather is (`softensLight`). Water takes no snow or wetness, but an area's fog, haze, darkening and lightning lie over it too, the reflective water's own shader included. The sky and the sun stay the world's: there is one sky.
- **Clouds** over an area with cloud cover: low-poly puffs gathered over it in both views (the world's float on a ring round it, in perspective only), on a grid laid over its outline: at 100% cover a cloud at every spot, overlapping, so the whole area is under cloud, and less cover leaving out spots in a scattered order (50% is about half the area); a very big area gets bigger clouds rather than more, greyer as it rains, snows or storms, drifting a little in place at its cloud speed. How high they float is the weather's **Cloud height** (`cloudAltitude`, null by default: an area's 9 over its top, the world's on their ring as before); an area's rain, snow and bolts start there, read from the map. How see-through they are is its **Cloud transparency** (`cloudTransparency`, 0 solid to 1 clear, which isn't drawn at all), for the world's clouds and each area's (each puff its own opacity). All areas' clouds are two instanced draws, the solid ones (writing depth, so a cloud hides its own back puffs) and the see-through ones (drawn unseen into depth first, then painted where they're nearest, so each cloud is one see-through body: what's behind shows through, puffs are never painted the wrong way round, though another cloud behind it doesn't show), and the pointer passes through them.
- **Lightning** in an area: at its rate, a jagged bolt from its clouds to a place inside it, and a flash that lights the ground and everything round where it struck, not the world; timed by the motion clock, so pausing holds it. At most four flashes light the view at once. The world's own lightning still lights the whole world.
- **Hidden areas:** a new area kind, `hidden_area_01` (**Hidden area**), as roads have a hidden route: it draws nothing outside Edit mode (a faint fill and a dashed outline while editing, to select it), leaves the ground as it is (never raised, nothing stands on it) and stays flat, with no Look tab. It's for weather over a district without painting its ground: a sentiment map's regions over a city.
- **An area's Area weather tab** (after Look; not called Weather, which is the world's tab beside it): **Has its own weather** (off: From the world), then the world's Weather tab's panels for the area's weather, every amount From data or by hand.

### Consequences

- Good: a storm, a fog bank or a snowfall in one place, and maps of weathers that follow data, with the controls people already know; over any ground, with a hidden area.
- Good: one map and one draw per effect however many areas have weather; nothing new is drawn or compiled while none do.
- Bad: while any area has weather, every standard material's shader reads the map (two texture reads per pixel); switching that on or off recompiles the shaders once, as snow and wetness already do.
- Bad: an area's fog lies on surfaces (the water's too), not in the air: there are no fog banks floating free of the ground.
- Later: areas following a table row (ADR-0108), so one sheet of regions drives every area; wind; the sky's colour over a big storm.

## More information

ADR-0102 (the weather), ADR-0021 (areas), ADR-0027 (inherited values), ADR-0058 (data bindings), ADR-0092 and ADR-0149 (what changes costs what it touches).
