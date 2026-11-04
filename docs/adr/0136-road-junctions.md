---
status: proposed
date: 2026-11-03
---

# 0136. Road junctions: roads that meet, and vehicles that drive across them

## Context and problem statement

Roads are drawn one at a time (ADR-0017, ADR-0018), and each is its own world: where two meet they only overlap, each a hair above the other, with both centre lines running through, and a vehicle drives one road back and forth or round and round (ADR-0031, ADR-0042). A town's streets, a depot's yard or a flow map (ADR-0112) all look unfinished where roads meet, and traffic never goes anywhere. **Join** (ADR-0018) merges two roads into one, which is right for a road drawn in two goes but not for a crossroads. Both ADR-0017 and ADR-0042 left junctions for later; TODO.md has them as *Connected road networks (junctions)*.

## Decision drivers

- Roads that meet look like one surface: no flicker, no overlapping markings.
- Vehicles drive across the network, choosing their way, and never turn round in the middle of it.
- Old worlds open and look and drive exactly as they did (ADR-0026, ADR-0056); a vehicle on a road without junctions drives as it always did.
- Simple to edit for people who aren't technical: the same gestures as joining (drag an end onto another), and one obvious way to undo it.
- The format stays easy to write by hand or by an AI (ADR-0034, ADR-0116), and patches can change junctions one by one (ADR-0118).
- Nothing per frame per object beyond what traffic already costs (PERFORMANCE.md); geometry stays framework-free and tested in `scene/`.

## Considered options

For what a junction joins:

1. **Only road ends.** A T or a crossroads is made by cutting the road that goes through at the meeting point, so every junction joins two or more ends, and the network is a graph whose edges are whole roads.
2. Ends and points along a road: a junction refers to an end, or to a place along another road (a control point's index, or a distance).
3. No stored junctions: roads whose ends touch, or whose end lies on another road, are joined wherever that happens.

For where junctions are kept:

A. **A list of junctions in the world**, each naming the road ends it joins.
B. On each road: what each of its two ends is joined to.

## Decision outcome

Chosen: **1** and **A**.

Option 2 makes every edit of a road's points (insert, delete, split, join, continue drawing, several points at once, the whole-road gizmo) move the junctions along it, and a point index or a distance silently changes meaning when a point is added before it; a vehicle would have to look for junctions at every place along its road. Option 3 would change old worlds, whose roads already touch and cross in places nobody meant as junctions, and give no way to keep two touching roads apart. With option 1 a junction is a set of ends, the network's graph is plain (roads between junctions), and drawing and routing only ever deal with ends meeting at a point. The price is that a road you connect a side road to in its middle becomes two roads: the editor makes it on the spot, gives the second half the same settings and the name with "(2)", as **Split road here** already does, and moves the vehicles that started on that half to it.

Option A over B: one junction is one record (its ends are listed once, not twice or more on every road), so a patch adds or removes a junction as one item, and a road stays as it was.

### The format

A new list in the world, `junctions` (default empty, so every world saved before draws and drives as before; each field has a `.describe()` for `/api/worlds/schema`):

```json
"junctions": [
  { "id": "junction-1", "ends": [
    { "roadId": "main", "end": "end" },
    { "roadId": "main-2", "end": "start" },
    { "roadId": "side", "end": "start" }
  ] }
]
```

- `id`: unique among junctions.
- `ends`: two or more road ends (`roadId`, and `end`: `start` = its first point, `end` = its last), which meet at one place. Two ends of the same road may meet there (a loop cut open at a T).

A junction has no place of its own: it is where its ends are, and they must be at the same point (x, z and altitude). The editor keeps them together (below). A world written by hand or by an AI whose ends don't meet is read as it is: the junction is at its first end, and an end further from it than its road's width is left out of it (that road draws and drives as without the junction). Ends of roads that don't exist or that loop (a loop has no ends), and repeats, are left out too; a junction left with fewer than two ends does nothing. `/api/worlds/validate` warns of each of these, so an AI can put it right. `junctions` is in `PATCH_LISTS` (`scene/worldPatch.ts`), so a patch adds, changes and removes junctions by id.

### Drawing where roads meet

`scene/junctions.ts` (pure, tested) works out the network once per list of roads and junctions (`roadNetworkOf`, cached by the lists, which are replaced, never changed in place):

- **Trims.** Each road end at a junction is cut back (`trimAt`) to where its band leaves the other roads' bands, treating each as straight from the junction: for two roads at an angle θ with half widths wᵢ and wⱼ, road i is clear of road j from (wⱼ + wᵢ·|cos θ|) / sin θ along it, or from wᵢ·tan θ when road j points away behind it. Roads that carry straight on (two ends in line) need no cut. A road shorter than its two cuts is shared out between them. The surface, deck sides, railings, embankments, pillars and the dashed centre line are drawn from the cut centre line, so **markings stop at the junction**.
- **The pad.** The junction's own surface (`junctionPad`): a fan from the junction's centre over an outline that goes round the cut ends in turn, each end's edge exactly as the road's ribbon ends, and between neighbouring roads a curve (a quadratic Bézier through where their edges would meet, so it reads as a kerb on the inside of a turn and rounds the outside of a bend), straight where they are in line. It's drawn just above the highest of its roads (the same small steps roads already use, ADR-0017) and overlaps each cut end a little, so there is never a crack and never two surfaces at the same height. It takes the colour of its first paved road (a road over a dirt path), else its first road's. A raised junction gets a deck edge round the outline and an underside, like a raised road; it has no embankment or pillars of its own (its roads' stand beside it). Hidden routes draw nothing, and take no part in the pad or the drawn cuts.

### Vehicles across the network

A vehicle that follows a road with a junction at either end drives the network (`createNetworkTrip`, `scene/network.ts`, pure and tested); every other vehicle keeps its route sampler, so it drives exactly as before.

- It starts where it always did (`follow.startDistance`, `follow.drivesTheOtherWay`), and at a junction picks **at random among the ways out**, leaving out the end it came in by. Only where there is no other way (a dead end, or a junction with nothing else) does it turn round, as it did at a road's end. Its choices come from a generator seeded by its id, so a vehicle takes the same turns each time the world plays, and tests are repeatable. (Following data later: the choice is one function, `pickWayOut`, that could weight the ways by a value or a row.)
- **Through the junction** it drives a curve (a quadratic Bézier on the centre line, from the cut end it leaves by, through the junction, to the cut end it enters by), and its lane is the sideways offset from that curve as on any road, so turns on the driving side are tight and turns across are wide, and the driving side carries through. When the two roads' lanes differ (different widths, a centre-lane road, a hidden route), the offset eases from one to the other along the curve. Heading smoothing and leaning look a few units either way across the switch, so turns are smooth.
- **How it works:** a trip is a function of the distance driven, like a route sampler (it implements `IRouteSampler`, so `EntityNode`, leaning and boat wakes use it unchanged): it keeps the last few pieces it drove (one road between its two junction curves each), finds the one a distance falls in, and adds the next when it gets there. A distance before what it kept (driving starting again) replays from the start, which is cheap and gives the same way. Changing a road rebuilds the trip, and a vehicle picks up where its distance puts it, as vehicles on a changed road always have.
- **Traffic** (ADR-0042): a vehicle on the network is in its current road's traffic, in the stream of its direction, so it keeps its distance and overtakes there as before (never across a junction: an overtake must finish before the road ends). It also keeps its distance to the last vehicle that went on along the way it will take (`beyond`), so queues carry through a junction. Inside the junction, vehicles from different roads don't see each other: there is no giving way yet.
- **Where a vehicle is now.** A vehicle's `follow` is only where it starts. While it drives a network, each frame it says which road it's on and which way (`editor/vehiclesNow`, a runtime registry kept over hot reloads, never saved), and stays on the road it stopped on while motion is paused. Everything that shows the road a vehicle is on reads it, falling back to `follow`: the Motion tab (**Now on “…”** under Drive along, which stays the road it starts on), framing it, and a road's count of vehicles driving it. Camera follow, ride-along, label cards and picking a driving vehicle up already go by where it's drawn.
- **The way ahead.** Since a vehicle's choices are seeded by its id, its way can be worked out ahead (`pathAhead`, `scene/network.ts`, on a trip of its own, so exactly what the vehicle then drives). On a road with a junction the route highlight shows it instead of the old there-and-back lane: for a selected vehicle, the next 60 units from where it is (worked out again every 2 units it drives, and from where it stopped while paused), and while a vehicle is dropped onto such a road, from the drop, the way it would go (a vehicle placed from Add to scene gets its id when the drag begins, so the preview is its own way). It fades out towards its end. Roads without junctions keep the old highlight.
- **Flows** (ADR-0112) stay on their own road: they show the amount on that road, and a flow vehicle crossing to another road would show it on the wrong one.

### Editing

- **Dragging a road end** (on its own) onto another road's end offers, as joining did, **Keep separate**, **Connect** (a junction of the two ends, or the end added to the junction already there) or **Join** (one road, as before). Onto a junction (any of its ends): **Connect**. Onto the middle of another road (within its width; the place is the nearest point on the straight line between its control points, so the rest of the road keeps its shape): **Connect here**, which cuts that road there and makes a junction of three ends. Each is one undo step.
- **Drawing:** the first and the last point of a new road snap onto a road's end, a junction or a road's middle when clicked near one (a ring shows where), and finishing connects them there, as dragging would; the toast names what it connected to. **Draw a road from here** on a connected end starts a new road from the junction.
- **Moving:** a connected end takes the junction with it: the other ends follow it, from a point's drag, its gizmo, keys or the whole road's gizmo. This is one rule in the store's `commit` (`settleJunctions`), so every edit, present and future, keeps junctions together: after any change to the roads, each junction's ends are moved to the one that moved (or to its first end), and ends that no longer exist are dropped.
- **The point panel** of a connected end says what it's connected to and offers **Disconnect** (the end leaves the junction; the roads stay where they are), **Draw a road from here**, and at a junction of just two ends, **Join into one road**.
- **Deleting** a road takes its ends out of their junctions; a junction left with one end is removed (a T whose side road is deleted keeps its two halves connected, which drive and look as one road; **Join into one road** makes them one again). Deleting a connected end's point, or continuing a road's drawing from a connected end, takes that end out of the junction. Splitting a road moves its last end's place in a junction to the new half; joining two roads keeps the junctions at their other ends. Copying and pasting roads pastes them unconnected.

### Old worlds

`junctions` defaults to empty, nothing reads it for a world without it, no field changes meaning, and roads without junctions draw and drive as before. Roads in old worlds that overlap still overlap until someone connects them. The old-world fixtures open with no repairs.

### Out of scope

- Giving way, priority, traffic lights or stop signs; vehicles from different roads can pass through each other inside a junction.
- Junctions at different heights (all its ends are at one altitude), embankments under a junction, roundabouts, and more than one lane each way (TODO: *More traffic behaviour*).
- Routing by data (weights, a vehicle's destination), and flows that carry across junctions.
- Junction handles of their own in the view (a junction is moved by any of its ends), and a junction in the outliner.

### Consequences

- Good: streets meet cleanly; vehicles drive through towns; queues carry through junctions; editing is the gesture people know from joining.
- Good: old worlds are untouched, and vehicles on roads without junctions drive exactly as before.
- Good: one rule in `commit` keeps junctions together for every edit, so new editing features don't have to know about them.
- Bad: connecting to a road's middle cuts it in two, so a street becomes two roads in the outliner, each with its own settings.
- Bad: inside a junction vehicles may overlap briefly; there's no right of way.
- Bad: a vehicle's way depends on its seed and the network: editing any road on its way changes where it is, as editing its own road always did.

## More information

ADR-0017 (drawable roads), ADR-0018 (heights, splitting and joining), ADR-0022 (centre lanes), ADR-0023 (widths per point), ADR-0031 (two-way routes), ADR-0042 (traffic), ADR-0112 (flows), ADR-0118 (patches). Code: `src/scene/junctions.ts`, `src/scene/network.ts`, `src/render/JunctionMesh.tsx`, `src/editor/store.ts` (`connectRoads`, `disconnectRoadEnd`, `settleJunctions` in `commit`).
