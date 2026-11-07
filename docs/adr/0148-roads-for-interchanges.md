---
status: proposed
date: 2026-11-07
---

# 0148. Roads for interchanges: smooth curves, one-way roads, pillars that keep clear, raised junctions on pillars

## Context and problem statement

People want to build motorway interchanges and flyovers: carriageways, ramps sweeping up on columns, roads meeting in mid-air (the owner's reference pictures). Roads, heights, pillars (ADR-0017, ADR-0018), junctions and network trips (ADR-0136) and flows that drive on (ADR-0147) get most of the way. A feasibility study built a cloverleaf, a stack and ramps with them, and found what breaks:

1. **No one-way roads.** A carriageway gets vehicles driving it the wrong way, head-on: coming back from junctions and turning round at dead ends.
2. **Ways through junctions are chosen at random** (`pickWayOut`), with no turn rules: a car goes up one loop and straight back down the next.
3. **Roads bend only at rounded corners**, so a spiral or a sweeping ramp is straight stretches with small elbows.
4. **Pillars** are square posts every `pillarSpacing` along the centre line, placed blindly: one stood in the middle of the road below, one on the road's own lower turn of a spiral. There is one look.
5. **Raised junctions** have no support of their own, and a hand-written junction whose ends are at different altitudes draws a near-vertical wall into its pad.
6. **Vehicles drive through each other** where roads meet.

The first design covered more (slip roads that merge along a gore, lanes, flows that follow data, rail). Those were built on a branch and reviewed, but aren't good enough yet; what ships here is what is (**Not yet**, below).

## Decision drivers

- **Every saved world draws and drives as before** (ADR-0026, ADR-0056, ADR-0106): every new field has a default that is the old behaviour, and what could change an old world's traffic is keyed on something no old world has. The few visible changes are fixes, listed under **Old worlds**.
- One road model: one-way, curve shape and pillars are settings of a road, drawn by the same ribbon, pillar and junction code, followed by the same trips and traffic.
- The world's vocabulary and naming rules (AGENTS.md, ADR-0104): switches state something (`isOneWay`, `pillarsKeepClear`, `standsOnPillars`), a thing's kind is `kind`.
- Simple to write by hand or by an AI (ADR-0034, ADR-0116), checked by validate (ADR-0117), patchable (ADR-0118).
- Cheap: nothing per frame per object beyond what traffic already costs; Standard graphics' look and cost unchanged (ADR-0072, PERFORMANCE.md).

## Considered options

**One-way.** (a) `isOneWay: boolean`, driven in the order of the road's points, with a **Reverse direction** action to turn a road round; (b) a direction field (`"bothWays" | "alongPoints" | "againstPoints"`). (b) gives three ways to say two things (a road against its points is the same road reversed); a road's points already are its forward direction (ADR-0031). Chosen: **(a)**.

**What keys the new junction behaviour** (turn rules, taking turns). (a) A world switch, off for old worlds; (b) on everywhere; (c) **on at junctions where a one-way road meets.** (b) would change the routes vehicles take in every saved world with junctions (Stockholm). (a) leaves interchanges wrong until someone finds a switch. One-way roads are new, so (c) provably changes no old world's traffic, and it is where the rules belong: a junction of one-way carriageways and ramps is a road system people drive through to get somewhere; a junction of two-way streets keeps ADR-0136's sightseeing traffic. Chosen: **(c)**, with a per-junction override of the turns allowed.

**Pillars keeping clear.** (a) On for every road; (b) a road switch, off by default (old worlds), on for every road drawn in the editor and recommended to AIs. Pillars of old bridges stand in water and on roads below today, and moving them would change those worlds. Chosen: **(b)**.

## Decision outcome

### The format

Every field has a `.describe()` for `/api/worlds/schema`. Defaults are the old behaviour; "new in the editor" says what a road or junction made in the editor gets instead (the schema's default keeps old worlds as they were, and the editor writes the better value for new things).

**Road** (top level, next to `width`):

| Field | Type, default | Meaning |
|---|---|---|
| `curveShape` | `"roundedCorners" \| "throughPoints"`, `"roundedCorners"`; **new in the editor: `"throughPoints"`** | How its line bends between its points. roundedCorners = straight between the points, each corner rounded with `cornerRadius` (as every road was); throughPoints = one smooth curve through every point; `cornerRadius` doesn't apply. |
| `isOneWay` | boolean, `false` | Vehicles drive it only in the order of its points, first to last. Its vehicles' `follow.drivesTheOtherWay` and its flow's `vehicleCountAgainst` don't apply. Two-way when false, as every road was. |
| `showsEdgeLines` | boolean or `null`, `null`; **new in the editor: `true`** | Whether it shows a solid line along each edge, a little in from the kerb (kinds with markings), as real carriageways have. null = like its way: on for a one-way road, off for a two-way road, so every saved road looks as it did. A one-way road has no centre line (nothing comes the other way), so these are its markings; lines between lanes come with lanes (not yet). |
| `pillarKind` | `"post_01" \| "column_01" \| "hammerhead_01" \| "pair_01" \| "wall_01"`, `"post_01"` | What its pillars look like (numbered so each can get variants): post = the square post pillars always were; column = a round column; hammerhead = a column with a crosshead under the deck; pair = two posts under the deck's edges joined by a beam; wall = a thin pier wall across under the deck. |
| `pillarSpacing` | number or `null`, `null` (was `4`) | The distance between pillars. null = its pillar kind's: 4 for posts (as roads always had), about four times the road's width (8 to 20) for the others, as real viaducts span. A saved `4` with no `pillarKind` is read as null (the same 4). |
| `pillarsKeepClear` | boolean, `false`; **new in the editor: `true`** | Whether its pillars keep clear of what's below: other roads' surfaces and junctions, water areas, and the road's own lower turns (a spiral). A pillar that would stand in one moves along the road, up to half the spacing, to the nearest clear place, else isn't built. |

**Junction**:

| Field | Type, default | Meaning |
|---|---|---|
| `standsOnPillars` | boolean, `false`; **new in the editor: `true`** | Whether a raised junction stands on pillars of its own under its surface, in its first pillared road's `pillarKind`. false = only its roads' pillars hold it up, beside it, as before. |
| `ends[].leadsTo` | list of `{ roadId, end }` or `null`, `null` | The ends vehicles arriving by this end may leave by. null = any way the rules allow (below). |

No new list of things with ids, so `PATCH_LISTS` is unchanged; `leadsTo` changes with its junction.

### One-way roads and the way through a junction

A trip (`createNetworkTrip`, ADR-0136) and a route on a single road follow these rules. Who drives: vehicle objects that follow a road, and flows.

- **Never against a one-way road.** A way out of a junction onto a one-way road is only its `start` (driving away from its first point). A vehicle on a one-way road drives forward whatever its `drivesTheOtherWay` says.
- **At a one-way road's end with no way on** (a dead end, or a junction with no allowed way out), the vehicle doesn't turn round: it shrinks out over its last 1.5 units (the size flows already use, `FLOW_EASE_LENGTH`) and **starts over at an entry to the network** (`entryToStartOverAt`, `scene/network.ts`): an open road end, at no junction, where traffic drives in (the first point of a one-way road, or an open end of a two-way road), from which its own start road can be reached, driving as vehicles may. Of those, ones by the ground's edge first (traffic coming in from off the map), then the nearer drives to its road, picked by its seed, so the same vehicle comes in the same way each time; it grows in there. So vehicles never pop in at a junction or mid-road when the network has an entry. Only where nothing drives into the network does it start over where it began (a flow's vehicles at their road's start), and validate says so. A dead end at the edge of the world is meant (traffic leaving the map).
- **The way chosen** (`pickWayOut`, now given the arrival direction and each way's departure direction):
  - the end it came in by is never a way out (as before);
  - with `leadsTo` on the end it arrives by, only those (still never against a one-way road);
  - **at a junction where any road is one-way** (an interchange): a way that turns back more than 150° from the way it arrived (a U-turn through the pad) is left out unless there is no other; and ways are weighted by how straight on they go, `(1 + cos θ)² + 0.05` for a turn of θ, so a car that came up a loop carries on along the carriageway, and only sometimes leaves at the next slip road;
  - **elsewhere**, every way alike, exactly as before.
  The weights use the same seeded chance as before (`chanceOf`), so a junction that keeps ADR-0136's rule gives exactly the same choice.
- A vehicle on a road without junctions that is one-way drives it first to last and starts over (not back and forth).
- `traffic.drivesThroughJunctions` and a flow's own switch are unchanged.

**Editing.** The road's **Road** tab, Traffic panel: **One-way (in the order of its points)** (a switch, Reset to off) and **Reverse direction** (a button: the road's points turned round, its junction ends swapped, and the vehicles that start on it moved to where they were, driving the same way on the ground). A one-way road shows small arrows on its surface in Edit mode, so its way is seen. The Flow panel's **Vehicles the other way** is greyed out on a one-way road, its label saying **(one-way road)**; so is a vehicle's **Drive the other way**. A connected end's point panel lists **Vehicles arriving here go on to**: a switch per other end at the junction (greyed out, "(one-way, the other way)", where one-way rules forbid it), all on while `leadsTo` is null; turning one off writes the list, **Reset** writes null.

### Smooth curves

The study's pictures show where every point of a spiral or a loop ramp is: each corner is a quadratic fillet whose radius is capped at half of each neighbouring stretch, so with points close together (a spiral, a sweeping ramp) the fillets are tiny and the line is mostly straight stretches with small elbows, and its curvature jumps where a fillet meets a straight part.

- **`curveShape: "throughPoints"`** draws the road as a **centripetal Catmull-Rom spline** (alpha 0.5: no cusps, no loops within a stretch, no overshoot past sharp turns) through every point. An open road ends at its first and last points, heading at its neighbours; a loop closes on itself with no seam. Each stretch between two points is halved again and again where it bends more than about 2° between samples (and every half unit along a ramp), up to 256 samples a stretch, so a tight loop is round and a straight stretch is a handful of segments.
- **Altitudes and widths** are pinned at each point (its station, as for rounded corners) and eased between them by a **monotone cubic** (Fritsch–Carlson) instead of the smoothstep rounded corners use: through every point's value with no overshoot, and a steady grade stays steady through the points between, so a spiral ramp climbs evenly instead of levelling off at every point (which smoothstep does, and which reads as steps on a spiral). It levels at a peak, a dip and an open road's ends, as roads always have.
- **One centre line for everything.** `roadCenterlineOf` (and `centerlineOf`, its cache) is the one place the line is made; vehicles and their samplers, pillars, junction cut-backs and pads, the road's surface for objects standing on roads (`roadSurface`), the route highlight, the point handles' Insert dots (the curve's middle between two points, not the straight line's), connecting a road to another's middle (the nearest place on the curve) and validate all read it, so they follow either shape.
- **Why not smooth for every saved road.** The owner allowed it if it's clearly better and harms nothing. It isn't, for most saved roads: town streets are drawn with a few points at their corners (Brightwater's, Stockholm's), and a spline through a corner point swings out round it in a wide arc, off the street's straight stretches and, on the templates, into buildings beside the road (checked: with every road `throughPoints`, validate finds objects standing on roads in Brightwater (11: its beach tables and chairs), Lantern Bay (10: its promenade lamps) and Stockholm (11: its bridge lamps), against none with rounded corners; Monaco, the data maps and Shape Castle are unchanged). Spirals and ramps, which do suffer, are new and drawn with many points. So the default stays **roundedCorners** (every saved world draws exactly as before) and **every road drawn in the editor is `throughPoints`**, its points placed where the curve should pass; **Curve** in the Shape tab switches either way (Reset goes back to a new road's, smooth). Templates keep their shape.
- **Editing.** The Shape tab's **Whole road** panel: **Curve** (**Smooth through the points** / **Rounded corners**), next to **Curves** (the corner radius), which is greyed out while the road is smooth, its label saying **(rounded corners only)**.

### Markings

A one-way road has no centre line: nothing comes the other way. It shows a solid **edge line** along each side instead, `EDGE_LINE_INSET` (0.2) in from the kerb, as carriageways do, cut back at junctions as the centre line is. Edge lines on two-way roads were weighed against old worlds: on by default they would change the look of every saved road (Brightwater's and Stockholm's streets), so `showsEdgeLines` is null by default, meaning like its way (on for one-way, off for two-way), and every road drawn in the editor has it on, two-way roads alongside their dashed centre line. Look panel: **Edge lines** (Default: like its way; Reset back to it); **Centre line** is greyed out on a one-way road, saying "(two-way roads only)". No dashed lines between lanes: lanes aren't in this change, and a one-way road's vehicles drive down its middle.

### Pillars

`placePillars` (`scene/pillars.ts`, pure and tested) replaces `pillarPositions` where roads are drawn; with the defaults (`post_01`, `pillarsKeepClear` off) it returns exactly `pillarPositions`' places, and the post is drawn as before (a test compares them for every template road with the defaults).

1. **Candidates** every `pillarSpacing` (or its kind's span) along the cut centre line, from half a spacing in, where the deck is at least `PILLAR_MIN` high (as before).
2. **Keeping clear** (when on): a pillar's footprint (its kind's, by the deck's width there: a post or column a small square, a hammerhead's column, a pair's two posts under the deck's edges, a wall's slab across) must not overlap another road's surface or a junction's pad below the deck, a water area, or the road's own surface lower down (a spiral's lower turn). A blocked pillar tries places along the road in steps of a quarter unit, nearer first, up to half the spacing either way; the first clear one wins, else it's dropped.
3. **Height**: every pillar reaches from the ground to the deck's underside at its place, and a hammerhead's crosshead and a pair's cap sit inside the deck's width, under it.

A road's pillars are built as **one geometry** (they were a mesh each), in the deck's colour: the same faces, far fewer draws.

**Editing.** Shape tab, **Elevated sections** panel: **Pillar look** (the five kinds), **Pillar spacing** (Default: its pillar look's span; Reset back to it) and **Keep pillars clear of roads and water below** (Reset to on, a new road's value), all greyed out while the road isn't held up by pillars, saying so.

### Raised junctions

- **Support.** A raised junction with `standsOnPillars` gets a pillar under its pad (in the pillar kind of its first road held up by pillars, as wide as its widest road), moved out along one of its roads, within its surface, when something is below. Its roads' own pillars within half their spacing of the junction stop, so they don't crowd round it. `connectEnds` and `connectToMiddle` write `standsOnPillars: true` for new junctions. A connected end's point panel has **Stands on pillars of its own** (Reset to on), greyed out on the ground or where none of its roads stands on pillars, saying so.
- **Railings round its kerbs.** A raised pad's edges between its roads get the roads' railings, so a T in mid-air has one continuous railing round it.
- **Ends at different altitudes are left out, not drawn.** A junction's ends must be at one place, altitude included (ADR-0136; the editor keeps them there with `settleJunctions`). The network now leaves out an end more than 0.05 from the first end's altitude, as it already left out one too far away on the ground: that road drives and draws as a dead end, so nothing draws a wall into the pad. Validate says which end, at what altitude, and how to fix it ("put it at the same altitude, or ramp the road to it").

### Taking turns at junctions with a one-way road

At a junction where any road is one-way (`giveWayStops`, `scene/traffic.ts`), vehicles arriving by different ends never cross it at once: one waits at its line while another from a different end is in it (or its rear still is), and of those coming to it from different ends, the nearest goes first. A vehicle also waits at the line, rather than drive in and block the junction, while the way out it will take is queued back into it (a box junction), so a busy network doesn't lock up with every junction held by a vehicle that can't leave. Should two from different ends be inside at once (put there as a world opens), the one nearer where it leaves goes on and the other stops short. Junctions of two-way roads are as before (ADR-0136).

The traffic step is now a pure frame, `stepAllTraffic` (`scene/trafficFrame.ts`), which the editor's TrafficStep calls, so tests run the same step. A test drives about a hundred vehicles (one every 3 units, a third of the road taken) for ten minutes round two one-way rings crossing at four junctions: none stops for a minute, and none comes nearer another than 1.7 units. At nearly half the road taken, the rings fill and lock as real roads would; nothing in a world's flows asks for that (a flow's density of 3 vehicles per 10 units is the test's).

### Checking a world (ADR-0117)

New warnings: a one-way road into a junction with no way out of it allowed (its vehicles start over); a one-way road leading to a dead end in a network nothing drives into from an open end (its vehicles would start over where they began, appearing from nowhere); a junction end's `leadsTo` naming an end not at the junction, or onto a one-way road against its way, or leaving no way on; a junction whose ends are at different altitudes (which end is left out, how far above or below, and how to fix it); a one-way road steeper than 12 in 100 (where, and that ramps climb about 6). Every template passes with no warnings.

### The guide

The guide's **Motorways and interchanges** section walks through smooth curves, one-way roads and Reverse direction, choosing turns, flyovers with a pillar look that keeps clear, gentle ramps, and roads meeting in mid-air on pillars of their own; the format section for AIs says how to write each.

### Old worlds

Every field's default is the old behaviour: two-way, rounded corners, posts at the spacing they had, pillars where they were, junctions without pillars of their own. Everything that changes how vehicles choose ways or take turns applies only where a road is one-way, which no saved world has. Old-world fixtures (an extraction-shooters world and an every-field world, both at bee221c) open with no repairs.

Visible changes to existing worlds, each a fix:

- **Railings grow in with height**: a ramp's railings rise out of the deck from a third of their height's altitude to whole at it, instead of standing up all at once where the deck reached their height.
- **Deck sides face outward on both sides**: a raised road's right-hand side was drawn facing inward, so the shadow pass striped it (shadow acne) when seen from outside; now both sides face out and shade cleanly.
- **Railings and deck edges shade smoothly round bends**, as one bent rail rather than a facet a segment.
- **A raised junction's pad gets railings round its kerbs** where its roads have railings (it had none, leaving gaps in the railing at every raised junction).
- **Pillars are one mesh per road**: the same posts in the same places, drawn in fewer calls.
- **A junction end at another altitude** (only a hand-written world can have one) is left out instead of drawing a wall.

### Not yet

Built on `roads-for-interchanges` (PR #56, shelved) and not shipped: slip roads joining and leaving a carriageway along a painted gore (one deck widening by a lane, a rounded nose, chevrons), per-point pillar choices (`pillarsAtPoints`), lanes (`laneCountEachWay`), a flow's speed from data and its vehicles' colours, and rail with a train. They need another round of review (merging traffic on long gores waited too long; vehicles and ramps needed more work in a large world) before they ship, each with its own ADR or an update of this one. PR #57 (`traffic-landscape`) holds the Interchange world built with them.

### Consequences

- Good: flyovers, spirals and ramps can be built cleanly: smooth curves, columns that stand clear of what's below, roads meeting in mid-air on their own pillars, one-way carriageways with sensible routing and vehicles that take turns.
- Good: saved worlds keep their traffic and shape; their few visible changes are fixes.
- Good: one model: one-way, curve shape and pillars are settings of a road, so trips, traffic, flows, junctions and the editor all work with each without special cases.
- Bad: the junction rules differ between a junction with a one-way road and one without; the ADR and the guide say so, and per-junction `leadsTo` covers anything else.
- Bad: two opt-ins whose schema default differs from what the editor writes (`pillarsKeepClear`, `standsOnPillars`), so an AI must be told to set them; the descriptions and the guide do.
- Bad: traffic does a little more work per vehicle at junctions with a one-way road (taking turns).

## More information

ADR-0017, ADR-0018 (heights, pillars), ADR-0031 (two-way routes), ADR-0042 (traffic), ADR-0086 (batching), ADR-0104 (vocabulary), ADR-0106 (old worlds), ADR-0112 (flows), ADR-0117 (validate), ADR-0118 (patches), ADR-0136 (junctions), ADR-0147 (flows that drive on). Code: `src/scene/roads.ts`, `src/scene/pillars.ts`, `src/scene/junctions.ts`, `src/scene/network.ts`, `src/scene/routes.ts`, `src/scene/traffic.ts`, `src/scene/trafficFrame.ts`, `src/render/RoadMesh.tsx`, `src/render/JunctionMesh.tsx`, `src/render/pillarGeometry.ts`, `src/render/RoadFlow.tsx`, `src/render/traffic.tsx`, `src/ui/RoadInspector.tsx`, `src/ui/RoadPointPanel.tsx`, `src/ui/RoadDataTab.tsx`, `src/parts/validateWorld.ts`, `src/guide/guide.ts`.
