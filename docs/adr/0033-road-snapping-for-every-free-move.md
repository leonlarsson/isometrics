---
status: accepted
date: 2026-10-22
---

# 0033. Road snapping for every free move; the gizmo's centre grabs the object

## Context and problem statement

ADR-0031 snapped vehicles onto roads when they were dragged by their body or the gizmo's move square, but not with the G key, and G was switched off for driving vehicles altogether. The gizmo's arrow hit areas also started a few pixels from its centre, so on a small vehicle at normal zoom they covered almost the whole body: grabbing the vehicle itself mostly grabbed an arrow. This amends ADR-0031 and ADR-0029.

## Decision drivers

- Every way of moving a vehicle freely should behave the same near roads.
- A move the user made exact (an axis lock, a typed number) must stay exact.
- Small objects must be grabbable under their own gizmo.

## Decision outcome

- **G snaps too.** A free G move parks a vehicle on a road under it, exactly like a drag. Confirming leaves it parked and offers to drive along (or, for a vehicle that was driving, it drives on), and confirming off the roads parks a driving vehicle. G now works on driving vehicles: it lifts them off their route first, and Esc puts them back. During G the transform bar says what confirming will do, instead of a second bar on top of it.
- **Exact moves don't snap.** The gizmo's axis arrows, G with X/Y/Z, and G with a typed number never snap onto roads (a lane would pull the vehicle off the axis or the number).
- **Live poses.** Driving vehicles register where they are right now (`livePoses` in `render/routeDrop.ts`, filled by EntityNode), so any of these moves can pick one up without the caller passing its pose.
- **Gizmo centre.** Arrow hit areas now run from 0.45 to 1.15 gizmo units out (the arrow tips end at 1.12), leaving the centre to the object underneath.
- **Label cards during G.** A click on a floating label card confirms or cancels a keyboard transform like a click on the canvas, instead of selecting that card's object mid-transform.

### Consequences

- Good: drag, gizmo square and G all agree, and small vehicles can be grabbed by their body.
- Bad: the inner part of each arrow's shaft is no longer grabbable; grab the outer part or the tip.
- R and S stay off for driving vehicles (their pivot would be the road's start, not the moving vehicle); the gizmo's ring and size knob still work.
