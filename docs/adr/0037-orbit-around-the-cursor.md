---
status: accepted
date: 2026-10-23
---

# 0037. Orbit around the point under the cursor, with a wider tilt

## Context and problem statement

Right-drag orbited around the view's centre (ADR-0028), so turning to look at something meant panning it to the middle first, and the tilt was held close to the iso angle (polar 0.25–1.2 rad). Map apps orbit around the point you grab, and the owner asked for more camera freedom (TODO: "More camera freedom", "Orbit around the cursor").

## Decision outcome

- **Orbit around the cursor.** Right-drag (or Ctrl/Shift + left-drag) turns the view around the point under the cursor at the press: the nearest visible mesh, else the ground. OrbitControls only orbits around its target, so `useOrbitAroundCursor` turns the camera and the target together around that point (`orbitAround` in `src/render/orbit.ts`); the point keeps its place on screen. The mouse no longer goes through OrbitControls' rotate (its left and right buttons do nothing; the wheel and middle button still zoom). Touch twist keeps orbiting around the view's centre.
- **Wider tilt:** polar 0.05–1.3 rad, from nearly straight down to fairly low over the ground.
- **Target stays over the ground.** After each orbit step the target slides along the line of sight (the picture doesn't change) to where it meets the ground, or the nearest point of it over the slab (`settleTarget`). Otherwise the rule that keeps the target over the ground would shift the view and the orbit would jump.
- **Re-centre** still returns to the iso view. **Frame selection (F)** now keeps the angle you're looking from instead of snapping back to iso.

### Consequences

- Good: look around anything by grabbing it; views from straight above to low over the ground.
- Bad: after a very low orbit, the view centre sits at the slab's edge, so panning further out meets the existing "keep the world in view" resistance sooner.

## More information

Amends ADR-0028 (orbit around the view's centre, tilt limits from ADR-0004). Tests: `src/render/orbit.test.ts`.
