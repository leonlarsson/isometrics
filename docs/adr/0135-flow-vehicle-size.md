---
status: proposed
date: 2026-11-04
---

# 0135. A road flow's vehicles have a size

## Context and problem statement

A road's flow (ADR-0112) draws its vehicles at their part's own size, the scale cars and houses are built at (about 3.6 m to a grid unit). Worlds traced from a map are drawn at a much smaller scale: Monaco's circuit and the Stockholm template (12.5 m to a unit) scale the vehicles they place by hand (`scale` 0.5–0.6), or a car is as long as a city block. A flow's vehicles couldn't be, so the most data-capable way to show traffic (a flow whose density follows a value, ADR-0019) looked wrong on exactly the worlds made to show a real place's data: Centralbron's traffic in Stockholm had to be cars placed one by one, which can't follow a value.

## Decision drivers

- Data first (ADR-0019): a road's traffic should be able to follow a value at any map scale.
- One idea, one name: an object's size is its `scale`; a flow's vehicles should read the same way.
- Saved worlds keep drawing as they did (ADR-0106).

## Considered options

1. A `vehicleScale` in the road's `flow`, default 1, with a Vehicle size slider in the road's flow panel.
2. A world-wide vehicle scale (every vehicle and flow drawn smaller).
3. Leave it: place vehicles by hand on small-scale maps.

## Decision outcome

Chosen option: **1**. It's contained (one field with a default that draws every saved world as it was), sits where the flow's other settings are, and uses the word objects already use for size. The flow's spacing and turning use the vehicles' length at that size (`flowVehicleLength`, `editor/roadFlows.ts`), so smaller vehicles also fit closer together, as a density asks for. A world-wide scale (2) would change what objects mean by `scale`, and how the template's hand-placed vehicles look; it may come later as a world setting if many worlds want it.

### Consequences

- Good: flows work on map-scale worlds; a road's traffic can follow data there (Stockholm's Centralbron).
- Good: no upgrade needed; old worlds get 1.
- Bad: one more setting in the flow panel.

## More information

`RoadFlowSchema.vehicleScale` (`scene/schema.ts`), `render/RoadFlow.tsx`, `ui/RoadDataTab.tsx`. ADR-0112 (road flows), ADR-0019 (data-capable features).
