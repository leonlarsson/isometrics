---
status: accepted
date: 2026-10-23
---

# 0042. Vehicles on a road keep their distance and overtake

## Context and problem statement

Each driving vehicle moved on its own: every frame it added its speed to the distance it had travelled and looked up its position on the road (ADR-0017, ADR-0031). No vehicle knew about another, so faster ones drove straight through slower ones. Simply following would turn every road into a queue behind its slowest vehicle, which on a loop is permanent and hides the speeds people set, often to show data.

## Decision drivers

- Vehicles must never drive through each other in the same lane.
- Speeds set by the user (or by data) should stay visible on average: faster vehicles get past.
- Nothing about it is saved: the world still only stores where each vehicle starts and how fast it goes.
- Keep the logic framework-free and testable, like the rest of `scene/`.

## Considered options

1. Following distance only.
2. Following distance plus overtaking, in a shared per-road step.
3. Multi-lane roads (several lanes per direction) with lane changes.

## Decision outcome

Chosen option: **2**.

- **Where a vehicle is in traffic.** A route sampler can now say where a vehicle is in its road's traffic (`IRouteSampler.place`, `src/scene/routes.ts`). An open road is one cycle (there, U-turn, back, U-turn), and driving it reversed is the same cycle starting on the way back. A loop has a forward and a reverse stream. Vehicles in the same stream share a lane and direction.
- **The traffic step.** `stepRoadTraffic` (`src/scene/traffic.ts`) moves the vehicles of one road each frame:
  - It eases off to keep a gap (a minimum plus a time gap), and never moves into the vehicle ahead.
  - After following a slower vehicle for a while (1.5 to 3.5 s, different per vehicle), it overtakes if the way is clear for the whole move. On two-way roads it pulls into the oncoming lane, but only when nothing comes the other way in time and the road doesn't end first. On roads without lanes (centre-lane roads, hidden routes) it moves beside the line.
  - It pulls back in once clear ahead, and gives up an overtake that takes too long.
- **Runtime state.** It keeps a little runtime state per vehicle: its current speed, how far out it is, and whom it's passing.
- **Wiring.** `TrafficStep` (`src/render/traffic.tsx`) runs before the vehicles draw. It groups the registered vehicles by road and runs the step. Each `EntityNode` registers while it drives (hidden vehicles don't), and reads its distance and sideways shift back from it, leaning slightly into lane changes.
- **Switches.** Two world settings under `traffic` (Scene tab → Roads & traffic), both on by default:
  - `traffic.spacing` keeps the distance. Off turns the whole thing off: every vehicle drives at its own speed, through the others, as before.
  - `traffic.overtaking` lets vehicles get past. Off makes them queue behind slower ones. It only applies with spacing on.
  - Later traffic systems (junctions, lights) get their own keys in the same object.

Multi-lane roads were left out: they change the road model, and passing on a two-way road covers the common case. The passing logic would carry over.

### Consequences

- Good: no more vehicles driving through each other in a lane; faster vehicles still get past, so set speeds stay meaningful.
- Good: framework-free and covered by unit tests (following, overtaking, waiting for oncoming traffic, never meeting it while out).
- Bad: positions now depend on what happened before, not just time, so two runs drift apart. Nothing relied on that.
- Bad: vehicles going opposite ways on a road without lanes (a hidden ferry route driven both ways) still pass through each other; that needs meeting logic later.
- Bad: vehicles on different roads still ignore each other where roads cross (no junctions yet, ADR-0017).

## More information

ADR-0017 (roads as routes), ADR-0022 (centre lanes), ADR-0031 (two-way routes). Code: `src/scene/traffic.ts`, `src/scene/routes.ts`, `src/render/traffic.tsx`, `src/render/EntityNode.tsx`.
