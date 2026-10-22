---
status: accepted
date: 2026-10-22
---

# 0031. Vehicles drive either way; dropping one on a road offers to follow it

## Context and problem statement

Every vehicle drove its road in the order the points were drawn: everything on a loop went the same way round, and on an open road everything set off towards the last point. Two-way traffic was impossible. Making a vehicle follow a road also meant finding the right road in a *Drive along* dropdown, by name, with no idea where on the road it would start.

## Decision drivers

- Traffic should look like traffic: both lanes in use, loops driven both ways.
- Non-technical users think spatially: "put the van on that road", not "pick road 3 in a list".
- Never surprise: a drop shouldn't silently turn a parked prop into a moving one.

## Considered options

1. A per-vehicle direction flag, and drag-onto-road with a preview and a confirmation.
2. Per-road two-way traffic (the road decides, vehicles alternate lanes).
3. Drop onto a road makes the vehicle drive immediately, with undo as the way back.

## Decision outcome

Chosen option: **1**.

- **Direction:** `follow.reverse` (default `false`) drives a vehicle against the order of the road's points, which puts it in the other lane, since the lane is always on the driving side of the direction of travel. `follow.offset` still counts from the road's first point either way, so the *Start point* slider keeps its meaning. `createRouteSampler` (`src/scene/routes.ts`) wraps the path sampler: reversed, it samples the reversed centre line (a loop keeps its first point) and starts at `length - offset`. The inspector shows it as *Drive the other way*.
- **Drop onto a road:** while a vehicle is dragged (from the Add to scene panel, by its body, or by the gizmo's move square), a road under where it would land snaps it into that lane at the nearest point, facing the way it would drive. The half of the road under the pointer picks the direction, as if every road had a lane on the driving side: on roads with lanes it's the lane you see, and centre-lane roads and hidden routes use the same rule, so moving across the centre line flips the arrows. The lane lights up with direction arrows, and a bar names the road. Elevated roads are hit where they appear on screen. **Alt** skips the snapping, like it skips grid snapping.
- **Confirmation:** dropping leaves the vehicle parked on the road (one undo step) and a bar asks *Drive along "…"?*. **Drive along** sets `follow` (as its own undo step, resetting elevation and rotation, which would otherwise add to the road's); **Keep parked** or **Esc** dismisses it. The offer (`followOffer`) and the drag preview (`routePreview`) are runtime UI state in the store, never in the scene. The offer lapses when the vehicle is moved, deleted or something else is selected.
- **Driving vehicles can be dragged too** (by their body or the gizmo's move square; they have no axis arrows). Grabbing one lifts it off its route where it is on screen at that moment (the scene only knows where it started, so the renderer supplies the pose). Dropped on a road, the same or another, it drives on from there straight away, keeping its speed and turns, with no question, since it was already driving. Dropped anywhere else, it parks there. Either way the whole drag is one undo step. The bar says which will happen while it's held (`rerouting`, runtime state).

### Consequences

- Good: two-way traffic on any road, and making a vehicle drive is a drag plus one click, with the route shown before you commit.
- Good: older worlds load unchanged (`reverse` defaults to `false`, so ADR-0026 repair fills it in).
- Bad: a vehicle dropped near a road snaps onto it even if you meant to park it beside the road; Alt is the way out, and the bar says so.
- Bad: keyboard moves (G) and the gizmo's axis arrows don't snap onto roads.
- Bad: on small vehicles the gizmo's arrows cover most of the body, so the move square is the easier grip.

## More information

ADR-0017 (roads as routes), ADR-0018 (elevated roads), ADR-0022 (centre lanes), ADR-0029 (gizmo). Code: `src/scene/routes.ts`, `src/render/routeDrop.ts`, `src/render/RouteHighlight.tsx`, `src/ui/FollowOfferBar.tsx`.
