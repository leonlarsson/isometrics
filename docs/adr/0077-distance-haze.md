---
status: proposed
date: 2026-10-26
---

# 0077. Distance haze in perspective, as its own graphics setting

## Context and problem statement

Seen in perspective at a low angle, a world has no aerial perspective: far buildings are as crisp and saturated as near ones, which flattens the depth the camera gives. The owner wanted to see haze before deciding whether the top preset should have it (ADR-0072).

## Decision drivers

- Opt-in, and off in every preset until the owner decides.
- No effect in the isometric diorama, where everything is about equally far from the camera.
- At night the town's lights must keep their light and glow.

## Considered options

1. **three's distance fog** on the scene, coloured and scaled per frame.
2. **A depth-based haze pass in the effects composer** (height fog, scattering).

## Decision outcome

Chosen option: **1**, as a graphics setting **Distance haze** (`showDistanceHaze`; off in Standard, Nice and Ultra for now).

- In perspective, far things fade into the sky's colour at the horizon for the time of day: the haze starts at 1.1× the camera's distance to its target and is whole at 3.5×. It thins as it gets dark (13× further at full dark), so lit windows, lamps and their glow keep their light.
- In the diorama the fog stays on the scene but out of reach, so switching projections never rebuilds the shaders.
- Painted light pools, beams and lenses ignore fog: lights shine through haze.

### Consequences

- Good: depth in low perspective views by day and at dusk, for nothing in cost.
- Bad: subtle at the usual camera heights; lit window panes fade with distance like walls do.
- Later: if it's wanted in Ultra, the preset turns it on; a height fog in the composer if more is wanted.

## More information

Code: `src/render/DistanceHaze.tsx`, `src/parts/lights.tsx` (`fog={false}`), `src/editor/graphics.ts`, `src/ui/GraphicsPreferences.tsx`. Related: ADR-0070, ADR-0072, ADR-0073.
