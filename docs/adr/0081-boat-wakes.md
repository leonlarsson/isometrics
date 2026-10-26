---
status: accepted
date: 2026-10-26
---

# 0081. Boat wakes: foam behind boats on a route, and waves in Ultra

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

Chosen option: **3** (the owner's idea).

- A graphics setting, **Boat wakes** (`boatWakes`: off, foam, foam and waves). Standard off, Nice foam, Ultra foam and waves. In wireframe it's off, as wireframe draws with Standard's settings (ADR-0080).
- A part says it leaves a wake (`wake` in its definition: how wide it is where the wake starts, and how far behind its centre); the yacht does. Only while it follows a route.
- `render/BoatWake.tsx`: the wake is made from where the route goes behind the boat (`sampler.at(offset, travelled − distance)`), not from where it has been, so there's no history to keep and it's the same every time. It's as long as the boat times 1.2 plus its speed (at most five boat lengths), grows from nothing as the boat sets off, and is gone when it stands still. Across, two bands of foam (the V) and churned water down the middle, which fades sooner; it widens and fades towards its end, with a slight shimmer drifting back along it.
- Inside a tight turn the wake narrows to fit the turn's radius, so it never folds over itself (folded triangles faced down and were left out, which showed as gaps); it's drawn from both sides too.
- Lit like the world (a standard material, white, transparent, no depth writes), so it doesn't glow at night; clicks go through it.
- **Waves** (`render/WakeField.tsx`), modelled on a real wake seen from above (the owner's photo): a V of its own, longer than the foam (the boat's length times 2.5 plus 1.5 × its speed, at most six lengths), whose point is at the bow, as on real water (the bow pushes out the main waves, which pass along the hull), with arms opening at Kelvin's angle (19.5° off the track) from where each part was made, whatever came after it, so waves already made stay where they are in a turn (inside it their crests cross, as real ones do), and only its first half boat length behind the stern swings with the boat (alongside the hull it moves with it; the foam's first whole length swings). Each arm is a few crests running along it (about 0.4 apart, the outermost strongest), fixed to the boat as it goes; inside the V the water's own ripples are calmed (by up to 90%); the churned water at the stern is the foam's. Each frame the boats' Vs are drawn from above into a half-float texture over the ground (16 texels a unit, at most 2048 a side): red and green how the water tilts, blue how calm it is. Drawn afresh every frame, so there's no simulation to keep. The reflective water's shader (`Water.tsx`) calms its ripples by it and adds the tilt to them and to the reflection's shift, so the surface and the reflection rock along the arms. Only reflective water shows them, so the field is drawn only while Water reflections are on. With waves the foam is only the short stretch at the stern (at most 2.5 lengths), as on real water; Foam on its own keeps the longer trail.

### Consequences

- Good: boats read as moving; the foam costs about 0.1 ms for Lantern Bay's ferry, and the waves less than the runs' noise (about 1 ms) on an RTX 4080 SUPER.
- Bad: white foam on pale daytime water shows little (as in life); the wake ignores overtaking shifts (boats rarely overtake).
- Bad: waves show only on reflective water (Nice and Ultra have it, Standard doesn't), and they don't spread beyond the wake's ribbon or bounce off quays.
- Later: wakes for other boats as they're added. *Data:* a boat's speed from data already makes its wake follow it.

## More information

Code: `src/render/BoatWake.tsx`, `src/render/WakeField.tsx`, `src/render/Water.tsx`, `src/render/EntityNode.tsx`, `src/parts/types.ts` (`wake`), `src/parts/vehicles/yacht_01.tsx`, `src/editor/graphics.ts` and `src/editor/preferences.ts` (`boatWakes`), `src/ui/GraphicsPreferences.tsx`. Related: ADR-0017, ADR-0042, ADR-0072, ADR-0075.
