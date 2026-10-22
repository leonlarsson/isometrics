---
status: accepted
date: 2026-10-23
---

# 0040. The camera can follow a vehicle, or ride along behind it

## Context and problem statement

Vehicles drive their routes, but the camera stays put, so watching one means chasing it by hand. The owner wants follow-a-vehicle and ride-along as steps towards first-person and taking control (TODO).

## Decision outcome

- **Two ways:** *Follow with the camera* keeps the view's angle and distance and glides its centre onto the vehicle, then moves with it (orbit and zoom still work). *Ride along* switches to perspective (ADR-0038) and sits behind and a little above the vehicle, looking along its heading; distances scale with the vehicle's length. Both ease in (exponential smoothing), so starting and corners don't jerk.
- **Where:** buttons in a driving vehicle's Motion section and on its View mode detail card. A bar at the top says what the camera follows, switches between follow and ride, and stops. In View mode it takes the viewpoint bar's place while active.
- **Handing the camera back:** Esc, *Stop*, panning the view, or, while riding, any press or scroll. Going to a viewpoint, re-centring or framing a selection also stops it. A ride-along goes back to the camera type it started from.
- **State:** `cameraFollow` in the editor store (runtime only). The vehicle's live position comes from `livePoses` (ADR-0033). The "keep the view centre over the ground" rule pauses while following, so it doesn't fight the camera near the edge.

### Consequences

- Good: watch traffic, a ferry or a race car up close, in Edit or View mode; the base for driving it yourself.
- Bad: the ride camera can clip through tall things beside the road (no collision), and follows only vehicles that drive.

## More information

Code: `src/render/CameraFollow.tsx`, `src/ui/CameraFollowBar.tsx`. Related: ADR-0038 (perspective), ADR-0039 (viewpoints).
