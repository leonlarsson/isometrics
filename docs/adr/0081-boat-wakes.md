---
status: proposed
date: 2026-10-26
---

# 0081. Boat wakes: foam behind boats on a route, waves later

## Context and problem statement

Boats drive along routes on the water (ADR-0017, hidden routes), but the water doesn't notice them. The owner asked how hard it would be for them to leave ripples or waves behind (2026-10-26).

## Decision drivers

- Standard is the view as it always was (ADR-0072): a wake is a graphics setting, off there.
- Cheap: one small mesh a boat, nothing that grows with time.
- The same every time, and right when the route turns.

## Considered options

1. **Foam:** a ribbon of foam along the stretch of route behind the boat.
2. **Waves:** boats push ripples into a texture over the water, which bends the water's surface and its reflection.
3. **Both, as levels of one setting:** foam in Nice, foam and waves in Ultra.

## Decision outcome

Chosen option: **3** (the owner's idea), foam first; waves are still to build.

- A graphics setting, **Boat wakes** (`boatWakes`: off, foam; "foam and waves" joins when it's built). Standard off, Nice and Ultra foam. In wireframe it's off, as wireframe draws with Standard's settings (ADR-0080).
- A part says it leaves a wake (`wake` in its definition: how wide it is where the wake starts, and how far behind its centre); the yacht does. Only while it follows a route.
- `render/BoatWake.tsx`: the wake is made from where the route goes behind the boat (`sampler.at(offset, travelled − distance)`), not from where it has been, so there's no history to keep and it's the same every time. It's as long as the boat times 1.2 plus its speed (at most five boat lengths), grows from nothing as the boat sets off, and is gone when it stands still. Across, two bands of foam (the V) and churned water down the middle, which fades sooner; it widens and fades towards its end, with a slight shimmer drifting back along it.
- Inside a tight turn the wake narrows to fit the turn's radius, so it never folds over itself (folded triangles faced down and were left out, which showed as gaps); it's drawn from both sides too.
- Lit like the world (a standard material, white, transparent, no depth writes), so it doesn't glow at night; clicks go through it.

### Consequences

- Good: boats read as moving; about 0.1 ms for Lantern Bay's ferry.
- Bad: white foam on pale daytime water shows little (as in life); the wake ignores overtaking shifts (boats rarely overtake).
- Later: waves in the water's surface for Ultra (`foamAndWaves`), and wakes for other boats as they're added. *Data:* a boat's speed from data already makes its wake follow it.

## More information

Code: `src/render/BoatWake.tsx`, `src/render/EntityNode.tsx`, `src/parts/types.ts` (`wake`), `src/parts/vehicles/yacht_01.tsx`, `src/editor/graphics.ts` and `src/editor/preferences.ts` (`boatWakes`), `src/ui/GraphicsPreferences.tsx`. Related: ADR-0017, ADR-0042, ADR-0072, ADR-0075.
