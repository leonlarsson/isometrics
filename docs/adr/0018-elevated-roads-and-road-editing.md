---
status: accepted
date: 2026-10-21
---

# 0018. Elevated roads (height per point) and point-level road editing

## Context and problem statement

Drawable roads (ADR-0017) were flat and could only be reshaped by dragging points. The owner wants bridges and elevated roads, finer editing (deleting points, cutting and joining roads), and eventually mountains that roads tunnel through.

## Decision drivers

- Bridges and flyovers without a separate "bridge" concept.
- Must extend naturally to terrain and tunnels later.
- Editing must stay approachable for non-technical users.

## Considered options

1. **Height per road point.** The road rises and falls between points; a bridge is just raised points.
2. Bridge as a separate part placed over a flat road.

## Decision outcome

Chosen option: **height per point**.

Model (`src/scene/schema.ts`):
- Road points are `[x, z, height]`, with height above ground and `[x, z]` accepted as height 0.
- Roads gain `supports: "pillars" | "embankment"`, a per-road choice the owner asked for, and `railings: boolean`.

Geometry (`src/scene/roads.ts`, pure and tested):
- `roadCenterline` emits `[x, z, height]`. The shape is built first. Then each control point's height is pinned at its station on the rounded line (a corner's station is the middle of its curve), and heights ease (smoothstep) between stations by distance along the line. This keeps slopes continuous through bends. The first version eased per straight segment and blended linearly across curves, which made a visible kink where a ramp met a bend. Straight parts whose height changes are subdivided.
- `buildRibbon`: one quad per segment, plus a round wedge filling only the outer side of each bend, at the bend's exact height. Full flat discs poked through sloped surfaces, hiding markings and shading differently. Normals follow the slope per centre-line vertex and are shared, so shading is continuous through bends and ramps.
- `buildElevatedSides` builds the deck edge (`DECK_THICKNESS`), railings (from `RAILING_MIN`) and embankment slopes (`EMBANKMENT_RUN`, 45°) where the road is above `ELEVATED_MIN`. These are continuous strips: each centre-line vertex has one sideways direction, averaged from its two segments. Per-segment offsets fanned apart on curves and left gaps. Embankment feet are clamped to the ground slab.
- `pillarPositions` places a pillar every `PILLAR_SPACING` where the road is at least `PILLAR_MIN` high.
- The path sampler returns `height` and `pitch`, so vehicles ride up ramps and tilt on slopes.

Editing (store and UI):
- Click a point to select it. The Object tab then shows its position and height, Delete point, and **Split road here** (or **Open loop here**). End points also get **Continue drawing** and **Join with** nearby road ends.
- Shift+drag raises or lowers a point. Pixels-per-unit comes from the camera's projection of world up, so the point tracks the mouse.
- Dragging a road end within `JOIN_SNAP` of another road end snaps to it, and `JoinOfferBar` asks whether to join. Joining a road's own two ends makes a loop.
- `splitRoad`, `joinRoads`, `continueDrawing`, `setRoadPointHeight` and `selectRoadPoint` live in the store. Each is one undo step. Vehicles on an absorbed road move to the joined road.
- Delete removes the selected point, else the road or object. Escape steps out one level: point → road → nothing.
- Drawing continues at the last point's height, so you can keep extending an elevated road.

Future terrain (not built): height stays "above ground level 0". With terrain, the road renders as a bridge where it's above the terrain surface and as a tunnel (portals, hidden inside) where it's below. Supports should then reach down to the terrain instead of y = 0.

### Consequences

- Good: bridges, flyovers and causeways come from one concept. Editing covers the common operations. The model is ready for terrain.
- Bad: no real junctions yet. Crossing roads overlap, and vehicles stay on one road. Embankments are drawn on top of anything below them, so roads shouldn't pass under an embankment section (use pillars there). Very steep ramps are allowed, so users may build unrealistic slopes.
