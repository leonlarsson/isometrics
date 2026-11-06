---
status: proposed
date: 2026-11-06
---

# 0147. A road's flow can drive on through junctions: background traffic without placing vehicles

## Context and problem statement

A road's flow (ADR-0112) draws vehicles on its one road: evenly spaced, growing in at the start and shrinking out at the end, round and round. ADR-0136 kept it there on purpose ("Flows stay on their own road"): a flow shows an amount for that road, and a vehicle crossing to another would show it on the wrong one. But the other thing people ask of a town is that its streets look busy, and the only way across junctions is placing vehicle objects that follow a road (`follow`), one by one. On a network a flow looks wrong: its vehicles shrink to nothing at every junction. Validate already warns of exactly that (#53), and could only point at placing objects.

## Decision drivers

- Busy streets in one step, without managing dozens of objects (the reason flows exist, ADR-0112).
- A flow that shows an amount must keep showing it on its road: no saved world and no data flow may change by itself (ADR-0106, ADR-0019).
- One idea, one name: driving through junctions is already a setting, **Drive through junctions onto other roads** (`drivesThroughJunctions`), on the world, a road and a vehicle (ADR-0136).
- Reachable by people who build a city without data (ADR-0115), whose worlds have no Data tabs.
- Flows can be dense (up to 6 vehicles per 10 units each way): per frame per vehicle must stay small, and their vehicles must still batch (ADR-0086, PERFORMANCE.md).

## Considered options

For the setting:

1. `flow.drivesThroughJunctions: boolean`, default `false`, its own and nothing else's.
2. `flow.drivesThroughJunctions: boolean | null`, null following the road's and the world's `traffic.drivesThroughJunctions` (ADR-0027).
3. `flow.drivesThroughJunctions: boolean | null`, null meaning off.
4. A flow kind (`flow.kind: "amount" | "traffic"`).

For the arrows: keep them pointing the start road's bigger way, or none while it drives on.

## Decision outcome

Chosen: **1**, and **no arrows** while it drives on.

- **The name** is the one vehicles, roads and the world already use, for the same thing: whether vehicles that start here drive on through junctions onto other roads. The UI label is the same words, **Drive through junctions onto other roads**.
- **Its own, not inherited.** Option 2 would turn every flow in a world on a network into traffic as soon as it was saved (the world's switch is on by default), changing what data flows show; that's the opposite of what a flow is for. Option 3 gives `null` a meaning ADR-0027 reserves for "inherited", and a reader of the format would expect it to follow something. A plain boolean whose default is the old behaviour reads as what it is. The world's and the road's `traffic.drivesThroughJunctions` stay about vehicle objects; their descriptions say so, and say the flow has its own.
- Not a kind (4): it's one behaviour of the same vehicles (same counts, density, speed, size and vehicle), and a boolean keeps patches (ADR-0118) and hand-written worlds simple.
- **Arrows:** a flow that drives on is traffic, not a direction; the start road's direction would be one of many on a network, and arrows on every street read as one-way streets. `showsArrows` is kept as set (it comes back when the switch is off); its switch is greyed out while the flow drives on, its label saying why.

### How it drives

`flowDrivesOn` (`scene/flows.ts`) is the one test: the flow is shown, its switch is on, and its road has a junction at an end (`network.connects`). Otherwise it draws exactly as before; the size formula moved into `flowVehicleSize` unchanged (a test compares it with the old code for every distance).

Driving on, each way's stream (`DrivingOnStream`, `render/RoadFlow.tsx`) spreads its vehicles along the road as a stream does (`vehiclesOnStream`, `flowOffsets`: the counts or density are how many **start** on the road), then gives each a network trip (`createFlowTrip` → `createNetworkTrip`, ADR-0136) from where it starts, the other way's from the road's last point. A trip picks a way at random at each junction, never back the way it came, and turns round only at dead ends, as vehicle objects do. Its choices are seeded by `flowVehicleSeed` (the road's id, the way and the vehicle's place in its stream), so it takes the same way every time the world plays. A vehicle grows in once, over the first 1.5 units of its stream (as today's flows do at their start), and never shrinks. It drives in each road's lanes as network vehicles do (a one-way flow on its own road drives down the middle; driving on it keeps to its lane). It keeps its start road's vehicle, size and speed everywhere.

**They join the traffic** (ADR-0042), unlike a flow that keeps to its road (ADR-0112). On its own road a flow's vehicles never meet: one speed, evenly spaced, in their own lanes. Driving on, streams from different roads merge at every junction, and on a regular grid they arrive in step: without the traffic, two that took the same way drove on inside each other, glued together until they parted at a junction (on the 10 × 10 grid below, up to 109 of 800 vehicles were within a car's length of another in their lane; in the traffic, at most 1). So each drive-on vehicle is in the traffic registry (`drivingVehicles`, under a key no object's id can be) with its trip, its flow's speed and its length, and `TrafficStep` moves it as it moves a vehicle object on a network: it keeps its distance, overtakes, and queues carry through junctions (`beyond`). The world's **Keep distance** and **Overtake slower vehicles** switches apply to them too. Inside a junction they pass through each other as every vehicle does (ADR-0136, no giving way yet).

What doesn't change (ADR-0112): flow vehicles aren't objects and aren't selectable or followed. They don't report where they are (`vehiclesNow`): nothing shows a flow vehicle's road.

**Editing the network.** A trip is a function of distance driven that replays its way from the start (ADR-0136); new trips starting from far along would walk every leg since (about 0.6 ms a vehicle after ten minutes of driving, half a second for 800). So when its trips are made again (any road or junction changed, or the flow's own settings), a stream starts again from where its vehicles start, in the traffic as new vehicles. Network vehicle objects jump to where their distance puts them; a flow's go back to their start places.

### Where the switch is

In the flow's own panel (**Flow**, after the hint, with a one-line hint of its own), since it changes what the panel's counts mean and lives in `flow`. On a road with no junction at its ends it's shown greyed out, its label ending **(no junction at its ends)** and its hint saying to connect the road (AGENTS.md: don't hide what isn't available yet; `SwitchField` takes `disabled`, greyed like a disabled slider). The hint above the panel says what the flow is now: an amount each way, or background traffic whose counts are how many start here.

The Flow panel was only in the road's **Data** tab, which a world without data doesn't have (ADR-0115): exactly the city builders who most want busy streets. So in such a world the Flow panel is in the road's **Road** tab, after **Traffic** (`RoadFlowSection`, the same component; **From data** isn't offered there, as everywhere with data off). It doesn't go in the Traffic panel beside the vehicles' switch: that switch is for vehicle objects and inherits from the world, and a flow's switch needs the flow's other settings next to it (its vehicle, how many, how fast).

### Checking a world (ADR-0117)

The warning of a flow on a road joined at a junction isn't given when its switch is on, and now suggests it: "for background traffic that drives on through junctions, turn on its `flow.drivesThroughJunctions`, or place vehicle objects that follow the road (`follow`) for particular vehicles". The too-short warning isn't given for a flow that drives on (it shrinks nowhere). A new warning says when the switch is on but the road has no junction at either end.

### The guide and the format

The schema's descriptions of `flow`, `flow.enabled` and the new field say a flow is either an amount on its road or background traffic; the guide's junctions section (for people) has a step for busy streets, and its format section (for AIs) gives a drive-on flow as the easy way to make streets busy, keeping vehicle objects with `follow` for particular vehicles (one to select, follow, label or drive by data).

### Performance

Measured on a 10 × 10 grid of streets (220 roads, 100 crossroads), every road's flow at 2 vehicles per 10 units each way: 800 vehicles, the densest network a world is likely to have. Per frame, in Node (V8) over a minute of frames at 60 a second:

| | median | 90th percentile | 99th |
|---|---|---|---|
| Keeping to their roads: placing them | 0.17 ms | 0.30 ms | 1.1 ms |
| Driving on: placing them (their trips) | 1.05 ms (1.3 µs a vehicle) | 1.5 ms | 2.2 ms |
| Driving on: the traffic step for them | 1.6 ms (2 µs a vehicle) | 2.8 ms | 4.0 ms |

So about 3 ms a frame for 800 vehicles driving on, against 0.2 ms keeping to their roads: the cost of a vehicle on a network, which vehicle objects pay too (and much more besides, each an `EntityNode`). It's per vehicle that moves, never per object in the world, and a few dozen vehicles (the test worlds) cost a fraction of a millisecond. A trip builds the path of each road as it comes onto it (a few per frame across 800 vehicles); the first frame builds them all (about 20 ms, once, while the 800 vehicles mount). Making the 800 trips takes 18 ms, and the network 8 ms. In the editor (Playwright's Chromium on SwiftShader, which only compares runs) the same world drew 615 draws a frame driving on and 610 keeping to its roads: the vehicles batch as before (ADR-0086), drawn by `useInstancedPart` as moving instances.

### Old worlds

The field defaults to `false`, which draws every saved world exactly as before; no field is renamed or changes meaning. Stockholm (a template with junctions and flows) is saved as an old world at the commit before the change, and the old every-field world reads with the switch off.

### Consequences

- Good: busy streets on a network in a few clicks, or one field for an AI, with nothing to manage per vehicle; data flows untouched.
- Good: the Flow panel is reachable in worlds without data, so background traffic is for city builders too.
- Bad: a flow that drives on no longer shows an amount on its road (its counts are where vehicles start); that's what the switch says, and data flows keep it off.
- Good: in the traffic, merging streams keep their distance and queue through junctions, as vehicle objects do.
- Bad: driving on costs about 15 times as much per vehicle per frame as keeping to a road (3 ms for 800 vehicles), most of it the traffic step.
- Bad: editing any road starts every drive-on flow's vehicles again from their start places.
- Bad: two switches with the same words in a world without data's Road tab (Traffic's, for vehicle objects, and Flow's); their panels and hints tell them apart.

## More information

`scene/flows.ts` (`flowDrivesOn`, `flowVehicleSize`, `flowVehicleSeed`, `createFlowTrip`), `render/RoadFlow.tsx` (`DrivingOnStream`), `render/traffic.tsx` (`drivingVehicles`, `TrafficStep`), `ui/RoadDataTab.tsx` (`RoadFlowSection`), `ui/RoadInspector.tsx`, `ui/fields/SwitchField.tsx` (`disabled`), `parts/validateWorld.ts`, `src/guide/guide.ts`. ADR-0112 (flows), ADR-0135 (`flow.vehicleScale`), ADR-0136 (junctions and network trips), ADR-0115 (a world without data), ADR-0042 (traffic), ADR-0117 (validate), ADR-0027 (inherited values).
