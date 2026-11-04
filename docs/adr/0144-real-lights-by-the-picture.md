---
status: proposed
date: 2026-11-04
---

# 0144. Real lights chosen by the picture, fading out at the edge; more of them in a still picture

## Context and problem statement

ADR-0074 gives the view a fixed number of point lights (Real lights at night: 16 on Nice, 64 on Ultra) and hands them each frame to the lit sources nearest the middle of the view (the controls' target), each one at full strength. A world with hundreds of lamps and lit windows (the Stockholm draft has 627 lit sources; Brightwater 76, Lantern Bay 92) then shows a disc round the middle of the view where lamps light the ground and walls, and a hard edge where they stop: "a circle in front of the camera that has better lighting". A still picture (Render a picture, ADR-0084) used 64 the same way and showed the same disc.

## Decision drivers

- No visible edge where real light gives way to painted glows, or at least none that reads as a shape.
- Little more cost per frame (PERFORMANCE.md): three's forward renderer pays every point light on every fragment, so the live counts can't simply go up.
- Standard mounts no real lights and doesn't change; the painted lights keep their colours; nothing goes into the world (ADR-0072).
- A still picture needn't keep up with a moving view, but must not fail to compile its shaders, or keep a weak card busy long enough to reset it.

## Considered options

1. **Pick by the picture and fade the edge:** only sources whose light reaches into the picture compete; they're ranked by how far they are from its middle in a rounded rectangle the shape of the picture; the outer third of the picked range fades to nothing, the first left out marking where.
2. **Pick by distance to the camera**: lights fill the near part of the view, the edge an arc across it.
3. **Merge far lights into fewer, bigger ones** (light clustering, as in lightcuts): every lit source contributes, near ones on their own and far ones grouped by a grid in the world.
4. **Raise the counts** (Nice 32, Ultra 128).
5. **Dim each lamp's painted pool while its light is real**, so the ground inside and outside the set matches more closely.

## Decision outcome

Chosen option: **1**, and for still pictures more lights, as many as the card and the picture's size allow.

- **In the picture.** A source competes only when its light (its reach × 2.6, as drawn) reaches into the picture: lights behind the camera or off to the side no longer take point lights from lights in view. Zoomed in, the visible lights are often fewer than the point lights, and then every one is real and full: no edge at all.
- **Filling the frame.** Its place is its distance from the middle in a rounded rectangle the shape of the picture ((x⁴ + y⁴)^¼ on screen, 0 in the middle, 1 at the edges): the picked lights spread out to the frame's shape rather than a disc round the target on the ground (which in perspective is an ellipse on screen, and leaves a wide picture's sides dark). It works the same in the diorama and in perspective, and in a still picture through the render's camera. Favouring lights big on screen (less their reach) was tried and left out: it handed the point lights to the broad washes of lit windows, and the lamps in the middle went dim.
- **A soft edge.** When there are more candidates than point lights, each picked light's strength fades by its place, from full to nothing across the outer 35% of the range from the best place to the first left out's (`edgeFade`). A light's strength follows its place, which moves smoothly with the camera, and is nothing when it changes hands, so lights neither pop nor ring. Strengths still ease (a quarter of a second to go from nothing to full, or back) for what jumps: a light coming on, an object added; a still picture takes them at once.
- **Counts stay** (Nice 16, Ultra 64): with the fade a small count reads as light that falls off away from the middle of the view, not a ring; raising them doubles their cost on every fragment, which Nice is meant to keep low.
- **Still pictures** (`realLightsForPicture`, `lightsTheCardHolds`): up to 192 lights, as many as keep the picture's lighting work (lights × drawn pixels) within that of the biggest picture already allowed with 64 (the browser's 2²⁵ pixels), so a picture the view's size smoothed twice gets 192 and 4K smoothed twice stays at 64; and over 64, only as many as the card's fragment shaders have room for (`MAX_FRAGMENT_UNIFORM_VECTORS`: 4 vectors a light, 256 left for the rest of a material; 1,024 on most desktop cards gives 192). The live view's counts are as set, as before. The change of count rebuilds the shaders once on the render's first frame, inside its 30 settling frames, and once more when the view goes back.

Options 2–5, not now:
- 2 moves the edge rather than removing it, and in a view straight down it's the same disc.
- 3 removes the edge entirely, but merged lights are blotchy close up and pop as groups split and join while zooming unless faded in and out with spare lights; it's the next step if the falloff isn't enough.
- 4 costs too much on Nice's cards; a still picture gets more instead.
- 5 changes what the painted pools look like, which ADR-0074 keeps as they are.

### Consequences

- Good: no hard ring at night in big worlds on Nice or Ultra; lights aren't spent off screen; a still picture of a big town lights far more of it; nothing changes on Standard or in the world.
- Good: per frame the choosing is about the same work as before (each lit source's place on screen instead of its distance, picking one more than there are lights).
- Bad: with more lights in view than point lights, the outer ones of the picked are dimmer than before (about half the picked lights are in the fading band, at about half strength on average), so the lit part of the view is a little smaller in a crowded view.
- Bad: on Nice, in a world as crowded with lights as the Stockholm draft, 16 lights still light only the middle of the view: a soft glow there rather than a disc with an edge, but a lit middle. Option 3 is what would light the rest.
- Bad: a still picture with 192 lights compiles bigger shaders (three unrolls its light loop) and works through three times the lights per pixel: a 1400×900 picture of the Stockholm draft at night took 921 s instead of 338 s on the software GPU of the test machine (real GPUs: to be measured), so it may take a few seconds longer on a slow card.

## More information

Code: `src/render/RealLights.tsx` (`placeInView`, `edgeFade`, `lightsTheCardHolds`), `src/editor/graphics.ts` (`realLightsForPicture`, `MOST_RENDER_REAL_LIGHTS`, `useGraphics`). Related: ADR-0072, ADR-0074 (refined here: which lights are real, and how strong), ADR-0084.
