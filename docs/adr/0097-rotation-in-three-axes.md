---
status: proposed
date: 2026-10-28
---

# 0097. Objects turn in all three axes, and go below the ground

## Context and problem statement

Objects only turned around the vertical (`rotation`); `pitch` (−60–60°) was only set when a vehicle was parked on a ramp. People want to tilt and tip things over: a leaning sign, a fallen tree, a ship on its side, a ramp made of a part. They also want to sink things into the ground (a building half underground, a pool, a cellar), which every editing path stopped at 0. The owner asked for both (2026-10-28).

## Decision drivers

- Saved worlds look as they did (ADR-0026): `rotation` and `pitch` keep their meaning.
- Readable for people and AIs writing worlds: degrees, one number per axis.
- The same tools as the rest of the editor: a ring per axis on the gizmo, R with an axis lock and typed angles, a field in the Transform panel (Blender's ways).
- Driving vehicles keep their own tilt and lean from the road (ADR-0018, ADR-0082).

## Considered options

1. **Yaw, pitch and roll in degrees** on the object, applied in a fixed order.
2. **A quaternion** in the world format: no order to explain, but unreadable for people and AIs.
3. **Pitch and roll fields only**, no gizmo rings: the TODO's cheap first step, but turning in the view is how the rest of the editor works.

## Decision outcome

Chosen option: **1**.

- An object has `rotation` (degrees around the vertical, as before), `pitch` (around its own Z after that, now −180–180°; nose up for vehicles, which face +X) and a new `roll` (around its own X after both, −180–180°, default 0). They're applied in that order (three's Euler order `YZX`, as driving vehicles already were), so worlds without them don't change.
- **Transform panel:** Rotation is three numbers, X, Y and Z: roll, the turn and pitch, in degrees.
- **Gizmo:** besides the green ring around Y, a red arc turns it around X and a blue arc around Z: 55° pieces of upright rings, from 20° to 75° up at its front and its side, beside the arrows; they stop short of the top, where both rings pass, so they don't meet there. Whole rings were tried first and covered the object and its arrows, so grabbing the object beside the gizmo turned it instead. The arcs turn with the object around the vertical, so tipping it forward is its own forward. Dragging one follows the pointer around the gizmo's middle on screen. Turns snap to 15°, and Alt turns freely, as on the green ring.
- **Keyboard:** R then X, Y or Z locks the turn to that axis for a single object; a typed angle turns by exactly that much around it.
- A turn around X or Z is put together with the turn the object has (`turnAbout` in `render/transforms`) and stored as the three angles again.
- Several things turned together still turn around the vertical only (ADR-0064); each keeps its tilt.
- **Below the ground:** an object's height (`elevation`) may go below 0, to −30, from the lift arrow, G then Y, a group's lift and the Lift field. The ground hides what's below it, and the outliner still selects it. Roads and areas keep the ground as their floor, since the ground slab would hide them.
- Driving vehicles ignore their own pitch and roll, as they ignored pitch: the road tilts them.

### Consequences

- Good: leaning, tipped and upside-down things, and sunken ones, with the editor's usual tools.
- Bad: tipped objects don't keep their lowest corner on the ground by themselves, and their selection frame, footprint and label card still assume an upright box.
- Later: keeping a tipped object standing on the ground (lifting it by its turned bounding box), angles from data (a gauge needle, a leaning sign, ADR-0019).
