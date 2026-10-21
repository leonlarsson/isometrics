---
status: accepted
date: 2026-10-22
---

# 0022. Roads can make vehicles drive down the centre

## Context and problem statement

Vehicles following a road keep to a lane on the scene's driving side (ADR-0017). That's right for town roads, but wrong for race tracks and other one-way roads, where traffic uses the whole width. On a narrow circuit, the lane offset also pushes race cars towards the kerb.

## Decision drivers

- A scene can mix town roads and a race track, so this can't be a scene-wide setting.
- The default must not change existing roads.

## Considered options

1. A per-road `lane` field: `"side"` (default) or `"centre"`.
2. A third scene-wide driving option, "centre".

## Decision outcome

Chosen option: **a per-road `lane` field**. `"side"` keeps the scene's driving side; `"centre"` puts followers on the centre line, as hidden routes already do. It's set in the road inspector under "Vehicles drive".

### Consequences

- Good: race circuits and one-way roads look right next to normal two-way roads.
- Bad: two vehicles going opposite ways on a centre-lane road drive through each other; it's meant for one-way traffic.

## More information

- Code: `laneOffset` in `src/scene/roads.ts`, `RoadSchema.lane` in `src/scene/schema.ts`.
- Related: ADR-0017 (drawable roads as vehicle routes).
