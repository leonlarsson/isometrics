---
status: proposed
date: 2026-11-06
---

# 0148. Roads for interchanges: one-way roads, ways through junctions, pillars, raised junctions, merges, lanes, flows that follow data, and rail

## Context and problem statement

People want to build motorway interchanges: a four-level stack, a cloverleaf, carriageways with slip roads, a raised rail line over them (the owner's reference pictures). Roads, heights, pillars (ADR-0017, ADR-0018), junctions and network trips (ADR-0136) and flows that drive on (ADR-0147) get most of the way. A feasibility study built a cloverleaf, a stack, carriageways and slip roads with them, and found what breaks:

1. **No one-way roads.** A carriageway still gets vehicles driving it the wrong way, head-on: coming back from junctions and turning round at dead ends.
2. **Ways through junctions are chosen at random** (`pickWayOut`), with no turn rules: a car goes up one cloverleaf loop and straight back down the next.
3. **Pillars** are square posts every `pillarSpacing` along the centre line, placed blindly: one stood in the middle of the road below, one on the road's own lower turn of a spiral. There is one look, and no way to say "not here".
4. **Raised junctions** have no support of their own, and a hand-written junction whose ends are at different altitudes draws a near-vertical wall into its pad.
5. **Slip roads** meet a carriageway as a right-angled pad, and merging vehicles drive into each other.
6. **One lane each way**: no motorways.
7. **A flow's speed** can't follow data (a jam can't crawl), and every vehicle of a flow is the same colour.
8. **No rail.**

These are one piece of work on one road model, so this ADR settles every field before any is built: a showcase world is being written from it at the same time, so the names below are final.

## Decision drivers

- **Every saved world draws and drives exactly as before** (ADR-0026, ADR-0056, ADR-0106, and the owner's condition): every new field has a default that is the old behaviour, and everything that could change an old world's look or traffic is keyed on something no old world has.
- One road model: lanes, one-way roads, pillars and rail are settings of a road, drawn by the same ribbon, pillar and junction code, followed by the same trips and traffic.
- The world's vocabulary and naming rules (AGENTS.md, ADR-0104): switches state something (`isOneWay`), counts end in `Count`, a thing's kind is `kind`, nothing that could mean two things.
- Simple to write by hand or by an AI (ADR-0034, ADR-0116), checked by validate (ADR-0117), and patchable (ADR-0118).
- Cheap: nothing per frame per object beyond what traffic already costs; Standard graphics' look and cost unchanged (ADR-0072, PERFORMANCE.md).

## Considered options

**One-way.** (a) `isOneWay: boolean`, driven in the order of the road's points, with a **Reverse direction** action to turn a road round; (b) a direction field (`"bothWays" | "alongPoints" | "againstPoints"`). (b) gives three ways to say two things (a road against its points is the same road reversed), and every reader of a road would have to turn it round in their head; a road's points already are its forward direction (ADR-0031). Chosen: **(a)**.

**What keys the new junction behaviour** (turn rules, merges, merging traffic). (a) A world switch, off for old worlds; (b) on everywhere; (c) **on at junctions where a one-way road meets.** (b) would change the routes vehicles take in every saved world with junctions (Stockholm), and how a slightly shallow T is drawn. (a) leaves interchanges wrong until someone finds a switch. One-way roads are new, so (c) provably changes no old world, and it is where the rules belong: a junction of one-way carriageways and ramps is a road system people drive through to get somewhere; a junction of two-way streets keeps ADR-0136's sightseeing traffic, picking any way. Chosen: **(c)**, with a per-junction override of the movements allowed.

**Per-point pillar settings.** (a) A fifth value in the point tuple; (b) a list on the road, by point index, kept by the editor's edits as fence gates are (ADR-0133); (c) a list by distance along the road. (a) mixes a word into a list of numbers that every reader of points takes as numbers, and needs a width placeholder; (c) moves when any point before it moves. Chosen: **(b)**: `pillarsAtPoints`, an index is how the point panel and a person writing a world name a point.

**Avoiding things.** (a) On for every road; (b) a road switch, off by default (old worlds), on for every road drawn in the editor and recommended to AIs. Pillars of old bridges stand in water and on roads below today, and moving them would change those worlds; (a) can't be proved harmless. Chosen: **(b)**.

**Lanes.** (a) A count each way; (b) a total count; (c) lanes per side as separate fields. "A two-lane road" means one each way to most people and two to others; a count each way can't be read wrongly, and on a one-way road it's simply its lanes. Chosen: **(a)**, `laneCountEachWay`.

**Merges.** (a) A junction kind set by hand; (b) recognised from the junction's shape. A slip road is recognisable (three ends, two in line, the third at a shallow angle), and (b) needs nothing written; recognising it only where the roads are one-way keeps old worlds' shallow T's as they are. Chosen: **(b)**.

## Decision outcome

### The format

Every field has a `.describe()` for `/api/worlds/schema`. Defaults are the old behaviour; "New in the editor" says what a road or junction made in the editor gets instead (as `surface.enabled` and other opt-ins do, the schema's default keeps old worlds as they were and the editor writes the better value for new things).

**Road** (top level, next to `width`):

| Field | Type, default | Meaning |
|---|---|---|
| `curveShape` | `"roundedCorners" \| "throughPoints"`, `"roundedCorners"`; **new in the editor: `"throughPoints"`** | How its line bends between its points. roundedCorners = straight between the points, each corner rounded with `cornerRadius` (as every road was); throughPoints = one smooth curve through every point, with no corners and no straight stretches unless the points lie in line; `cornerRadius` doesn't apply. |
| `isOneWay` | boolean, `false` | Vehicles drive it only in the order of its points, first to last. Its vehicles' `follow.drivesTheOtherWay` and its flow's `vehicleCountAgainst` don't apply. Two-way when false, as every road was. |
| `laneCountEachWay` | integer 1–4, `1` | Lanes in each way it's driven; on a one-way road, its lanes. 1 = as every road was. |
| `showsLaneLines` | boolean, `true` | Whether dashed lines are drawn between lanes going the same way (kinds with markings). With one lane each way there are none, so old roads draw as they did. |
| `pillarKind` | `"post_01" \| "column_01" \| "hammerhead_01" \| "pair_01" \| "wall_01"`, `"post_01"` | What its pillars look like (numbered so each can get variants): post = today's square post; column = a single round column; hammerhead = a column with a crosshead under the deck; pair = two posts under the deck's edges; wall = a thin pier wall across the deck. |
| `pillarsKeepClear` | boolean, `false`; **new in the editor: `true`** | Whether its pillars keep clear of what's below: other roads' surfaces and junctions, water areas, and the road's own lower turns (a spiral). A pillar that would stand in one moves along the road, up to half the spacing, to the nearest clear place, else isn't built. |
| `pillarsAtPoints` | list of `{ pointIndex, placement }`, `[]` | Choices at its points: `placement` `"here"` = a pillar stands at that point (and none other within half a spacing of it; it stands even where `pillarsKeepClear` would move it), `"noneHere"` = no pillar within half a spacing of the point, `"noneToNextPoint"` = no pillars from that point to the next. One entry per point. |

`pillarSpacing` and `heldUpBy` keep their meanings; the pillar settings apply where `heldUpBy` is `pillars`.

`traffic.drivingLane: "centre"` still puts every vehicle on the centre line, lanes or not (race tracks, hidden routes); its UI label no longer offers it for one-way roads, which have `isOneWay`.

**Road kind** `rail_01` (added to `RoadKindSchema`): a railway: ballast with sleepers and two rails on the same ribbon, deck, pillars and junction code; vehicles drive down its centre; no centre line or lanes.

**Flow** (`road.flow`):

| Field | Type, default | Meaning |
|---|---|---|
| `vehicleColors` | list of hex colours, `[]` | Colours its vehicles are painted, one picked per vehicle by a seed (the same each time the world plays), for the part's main colour (its colour marked `legacy: "color"`, a car's body). Empty = the part's own colour, as before. |

The flow's speed can follow data: `road.data.flowSpeed` (a range binding, 0.2–20 units a second, in `ROAD_DATA_SETTINGS`), so a jammed road's traffic crawls.

**Junction**:

| Field | Type, default | Meaning |
|---|---|---|
| `standsOnPillars` | boolean, `false`; **new in the editor: `true`** | Whether a raised junction stands on pillars of its own under its surface, in its first pillared road's `pillarKind`. false = only its roads' pillars hold it up, beside it, as before. |
| `ends[].leadsTo` | list of `{ roadId, end }` or `null`, `null` | The ends vehicles arriving by this end may leave by. null = any way the rules allow (below). |

No new list of things with ids, so `PATCH_LISTS` is unchanged; `pillarsAtPoints` and `leadsTo` change with their road or junction.

### One-way roads and the way through a junction

A trip (`createNetworkTrip`, ADR-0136) and a route on a single road follow these rules. Who drives: vehicle objects that follow a road, and flows.

- **Never against a one-way road.** A way out of a junction onto a one-way road is only its `start` (driving away from its first point). A vehicle on a one-way road drives forward whatever its `drivesTheOtherWay` says.
- **At a one-way road's end with no way on** (a dead end, or a junction with no allowed way out), the vehicle doesn't turn round: it **starts over** where it started, shrinking out over its last 1.5 units and growing in again (the size flows already use, `FLOW_EASE_LENGTH`), as a flow's own stream does. A dead end at the edge of the world is meant (traffic leaving the map), so validate only warns of a one-way road into a junction with no way out of it allowed.
- **The way chosen** (`pickWayOut`, now given the arrival direction and each way's departure direction):
  - the end it came in by is never a way out (as before);
  - with `leadsTo` on the end it arrives by, only those (still never against a one-way road);
  - **at a junction where any road is one-way** (an interchange): a way that turns back more than 150° from the way it arrived (a U-turn through the pad) is left out unless there is no other; and ways are weighted by how straight on they go, `(1 + cos θ)² + 0.05` for a turn of θ, so a car that came up a loop carries on along the carriageway, and only sometimes leaves at the next slip road;
  - **elsewhere**, every way alike, exactly as before.
  The weights use the same seeded chance as before (`chanceOf`), so a junction that keeps ADR-0136's rule gives exactly the same choice.
- A vehicle on a road without junctions that is one-way drives it first to last and starts over (not back and forth).
- `traffic.drivesThroughJunctions` and a flow's own switch are unchanged.

**Editing.** The road's **Road** tab, Traffic panel: **One-way (in the order of its points)** (a switch, Reset to off) and **Reverse direction** (a button: the road's points turned round, its junction ends swapped, its `pillarsAtPoints` re-indexed, and the vehicles that start on it moved to where they were, driving the same way on the ground). A one-way road shows small arrows on its surface in Edit mode, so its way is seen. The Flow panel's **Vehicles the other way** is greyed out on a one-way road, its label saying **(one-way road)**; so is a vehicle's **Drive the other way**. A connected end's point panel lists **Vehicles arriving here go on to**: a switch per other end at the junction (greyed out, "(one-way, the other way)", where one-way rules forbid it), all on while `leadsTo` is null; turning one off writes the list, **Reset** writes null.

### Smooth curves (added after the first design, at the owner's ask)

The study's pictures show where every point of a spiral or a loop ramp is: each corner is a quadratic fillet whose radius is capped at half of each neighbouring stretch, so with points close together (a spiral, a sweeping ramp) the fillets are tiny and the line is mostly straight stretches with small elbows, and its curvature jumps where a fillet meets a straight part.

- **`curveShape: "throughPoints"`** draws the road as a **centripetal Catmull-Rom spline** (alpha 0.5: no cusps, no loops within a stretch, no overshoot past sharp turns) through every point. An open road ends at its first and last points, heading at its neighbours; a loop closes on itself with no seam. Each stretch between two points is halved again and again where it bends more than about 2° between samples (and every half unit along a ramp), up to 256 samples a stretch, so a tight loop is round and a straight stretch is a handful of segments.
- **Altitudes and widths** are pinned at each point (its station, as for rounded corners) and eased between them by a **monotone cubic** (Fritsch–Carlson) instead of the smoothstep rounded corners use: through every point's value with no overshoot, and a steady grade stays steady through the points between, so a spiral ramp climbs evenly instead of levelling off at every point (which smoothstep does, and which reads as steps on a spiral). It levels at a peak, a dip and an open road's ends, as roads always have.
- **One centre line for everything.** `roadCenterlineOf` (and `centerlineOf`, its cache) is the one place the line is made; vehicles and their samplers, pillars, junction cut-backs and pads, the road's surface for objects standing on roads (`roadSurface`), the route highlight, the point handles' Insert dots (the curve's middle between two points, not the straight line's), connecting a road to another's middle (the nearest place on the curve) and validate all read it, so they follow either shape.
- **Why not smooth for every saved road.** The owner allowed it if it's clearly better and harms nothing. It isn't, for most saved roads: town streets are drawn with a few points at their corners (Brightwater's, Stockholm's), and a spline through a corner point swings out round it in a wide arc, off the street's straight stretches and, on the templates, into buildings beside the road (checked: with every road `throughPoints`, validate finds objects standing on roads in Brightwater (11: its beach tables and chairs), Lantern Bay (10: its promenade lamps) and Stockholm (11: its bridge lamps), against none with rounded corners; Monaco, the data maps and Shape Castle are unchanged). Spirals and ramps, which do suffer, are new and drawn with many points. So the default stays **roundedCorners** (every saved world draws exactly as before) and **every road drawn in the editor is `throughPoints`**, its points placed where the curve should pass; **Curve** in the Shape tab switches either way (Reset goes back to a new road's, smooth). Templates keep their shape.
- **Editing.** The Shape tab's **Whole road** panel: **Curve** (**Smooth through the points** / **Rounded corners**), next to **Curves** (the corner radius), which is greyed out while the road is smooth, its label saying **(rounded corners only)**.

### Pillars

`placePillars` (`scene/pillars.ts`, pure and tested) replaces `pillarPositions` where roads are drawn; with the defaults (`post_01`, `pillarsKeepClear` off, no `pillarsAtPoints`) it returns exactly `pillarPositions`' places, and the post is drawn as before (a test compares them for every template).

1. **Candidates** every `pillarSpacing` along the cut centre line, from half a spacing in, where the deck is at least `PILLAR_MIN` high (as before).
2. **Point choices**: `noneToNextPoint` removes candidates between that point's station and the next's; `noneHere` removes those within half a spacing of the point's station; `here` removes those within half a spacing and adds one at the station.
3. **Keeping clear** (when on): a pillar's footprint (its kind's, by the deck's width there: a post or column a small square, a hammerhead's column, a pair's two posts under the deck's edges, a wall's slab across) must not overlap another road's surface or a junction's pad below the deck (lower than the deck's underside), a water area, or the road's own surface lower down (another stretch of the same road whose surface there is lower than this deck's underside). A blocked pillar tries places along the road in steps of a quarter unit, nearer first, up to half the spacing either way; the first clear one wins, else it's dropped. `here` pillars aren't moved; validate warns if one stands in a road below.
4. **Height**: every pillar reaches from the ground to the deck's underside at its place (its own height, as before), and a hammerhead's crosshead and a pair's cap sit under the deck, as wide as the deck there.

Pillars of a road are built as **one geometry** per road (they were a mesh each), in the deck's colour: the same faces, far fewer draws.

**Editing.** Shape tab, **Elevated sections** panel: **Pillar look** (a select with the five kinds) and **Keep pillars clear of roads and water below** (a switch; Reset to on, the new road's value), both shown greyed out while it isn't held up by pillars, saying so. The point panel: **Pillar here** (a select: **As spaced** / **A pillar here** / **No pillar here** / **No pillars to the next point**), greyed out where the road isn't raised there or isn't on pillars, with the reason.

### Raised junctions

- **Support.** A raised junction with `standsOnPillars` gets pillars under its pad: one at its centre (in the pillar kind of its first road held up by pillars, sized by its widest road), and for a pad wider than three times that road's width, more round its middle. They keep clear as their roads' do. Its roads' own pillars within half their spacing of the junction stop, so they don't crowd round it. `connectEnds` and `connectToMiddle` write `standsOnPillars: true` for new junctions.
- **Ends at different altitudes are refused clearly, not drawn.** A junction's ends must be at one place, altitude included (ADR-0136 already says so; the editor keeps them there with `settleJunctions`). The network now leaves out an end more than 0.05 from the first end's altitude, as it already leaves out an end too far away on the ground: that road drives and draws as a dead end, so nothing draws a wall into the pad. Validate says which end, at what altitude, and how to fix it ("put it at the same altitude, or ramp the road to it"). Before, such a junction drew a wall: no saved world made in the editor can have one, and a hand-written one couldn't be drawn well.

### Merges and diverges

**Recognised**, not set: a junction is a **gore** (`junctionShapeOf`, `scene/junctions.ts`) when it has exactly three drawn ends whose roads are all one-way, two of them in line (directions within 20° of opposite: the carriageway, one arriving and one leaving), and the third at less than 35° to the leaving one (a diverge: a slip road leaving) or to the arriving one (a merge: a slip road joining). Every other junction is a **pad**, as before.

- **Drawing.** The carriageway's two ends aren't cut, so its surface and lane lines run through. The slip road is cut back to where its surface leaves the carriageway's (where their centre lines are half their widths apart, worked along the slip road), and the gore between them is one long tapered surface from the junction to that cut: the carriageway's edge on one side, the slip road's on the other, under the slip road's own lift. A raised gore has a deck edge and underside like a pad.
- **Driving.** Through vehicles drive straight on. A slip road's vehicles drive its own line to the junction and ease across into the carriageway's outside lane over the gore's length (a merge), or out of it (a diverge), instead of a curve through a point.
- **Keeping their distance.** At a junction where any road is one-way, vehicles arriving by different ends that go on by the same way out are queued as one (`mergeLeaderOf`, `render/traffic`): whichever is nearer the junction leads, the other keeps its distance behind as it would behind a vehicle on its own road (`beyond`). Ties go to the carriageway (the end in line with the way out). So merging traffic zips in rather than overlapping. Elsewhere, as before (no giving way inside a junction, ADR-0136).

### Lanes

- **Where vehicles drive.** Lanes share out most of each half of the road (one-way: of all of it): a two-way road's lane `i` (0 at the kerb, counting towards the centre line) of `n` each way is `w × 0.44 × (n − i − 0.5) / n` from the centre line on the driving side, which for `n = 1` is the old `0.22 w`; a one-way road's lanes share `0.88 w` across it, so one lane drives down the middle. `laneOffset` gains a lane index; `drivingLane: "centre"` still gives 0.
- **Which lane.** Each vehicle has a lane share from 0 to 1 from its seed (a vehicle's id, a flow vehicle's seed; `chanceOf(seed, -1)`), and drives lane `⌊share × n⌋` of each road it's on, so it keeps its lane from road to road where counts match. One lane: always 0, so old roads drive as before.
- **Markings.** A two-way road keeps its dashed centre line (`showsCentreLine`); between lanes going the same way, dashed lane lines (`showsLaneLines`). A one-way road has no centre line.
- **Width.** Old roads keep their width and one lane each way. Changing the lane count in the editor scales the road's width with the number of lanes (2.4 for one each way, 4.8 for two each way…), and Reset puts it back; a person can then set any width.
- **Traffic** (ADR-0042): each lane is its own stream, so vehicles follow the one ahead in their lane. Overtaking on a road with another lane the same way moves one lane towards the centre when that lane is clear beside and ahead for the whole move (no oncoming check), and back once past; a road with one lane each way overtakes in the oncoming lane exactly as before; a one-way road with one lane doesn't overtake. A vehicle overtaking on a network finishes before the road ends (as before).
- **Flows**: a flow's vehicles are spread over the lanes of each way in turn (vehicle `k` of a stream in lane `k mod n`), driving on or keeping to their road. A one-way flow on its own road keeps driving down the middle only when the road has one lane (as before); a flow on a one-way road shows only its along count.

### Flows that follow data, and colours

- `road.data.flowSpeed` sets `flow.speed` through `roadAsDrawn` (`ROAD_DATA_SETTINGS`), shown in the Data tab's Flow panel as **Speed** with By hand / From data, like the counts. Driving-on flows read it into their traffic speed each frame.
- `flow.vehicleColors`: each vehicle of a flow takes `vehicleColors[⌊chanceOf(seed, -2) × count⌋]` for its part's main colour; batching keeps working (each instance has its colour, ADR-0086). Edited in the Flow panel as a row of colour fields with **Add a colour** and remove buttons (each named, ADR-0089); **Reset** empties it.
- A minimum gap for flows is left for later: driving-on flows already keep their distance in the traffic.

### Rail

`rail_01` is a road kind: its ribbon is ballast (its `surface` colour), with sleepers and two rails drawn like markings; deck, railings, pillars (a viaduct is pillars, often `hammerhead_01`), junctions and trips are the road's. Vehicles on it drive its centre; it has no centre line or lanes, and `isOneWay` works on it like any road. A **train** part (`train_01`, `src/parts/vehicles/`) has a `carCount` prop (1–8 cars): its first car is the part, and its other cars follow the route behind it, each placed on the route at its own distance (a part's `trailingCars`, placed by `EntityNode` and flows from the same sampler), so a train bends round curves instead of cutting them. Built last; if it doesn't fit cleanly, it lands as its own follow-up and this section says so.

### Checking a world (ADR-0117)

New warnings: a one-way road into a junction with no way out of it allowed (vehicles on it start over); a junction whose ends are at different altitudes (the end left out, and how to fix it); a junction end's `leadsTo` naming an end not at the junction, or onto a one-way road against its way, or leaving no way at all; a `here` pillar standing in a road below; a `pillarsAtPoints` entry past the road's last point or repeated; a lane narrower than the road's vehicles. Every template passes with no warnings.

### The guide

The roads section gets steps for people (one-way roads and Reverse direction, lanes, pillars and point choices, slip roads, rail) and the format section for AIs gets an interchange example: one-way carriageways with two lanes each way, a slip road leaving at a shallow angle, a raised ramp on hammerhead pillars that keep clear, a junction standing on pillars.

### Old worlds

Every field defaults to the old behaviour (two-way, one lane, posts, pillars where they were, no point choices, junctions without their own pillars, flows in their part's colour). Everything that changes how vehicles choose ways, how a junction is drawn or how vehicles merge applies only where a road is one-way, which no saved world has. The one exception is a junction whose ends are at different altitudes, which only a hand-written world can have and which drew a wall; that end is now left out, as ADR-0136 already did for ends too far away on the ground. An extraction-shooters world is saved as an old world at bee221c, and a new every-field world carries every changed field. Brightwater and Lantern Bay are compared in screenshots before and after each feature.

### Where each feature lands

Commits on the `roads-for-interchanges` branch (PR "feat: roads for interchanges…"):

| Feature | Commit |
|---|---|
| This design | 047268e |
| One-way roads and the way through a junction | 74477e3 |
| Smooth curves (`curveShape`) | the commit after 74477e3 ("feat: smooth curves through the points") |
| Pillars | to come |
| Raised junctions | to come |
| Merges and diverges | to come |
| Lanes | to come |
| Flow speed from data and colours | to come |
| Rail and the train | to come |

### Consequences

- Good: interchanges can be built and driven: carriageways one way, ramps that carry on, slip roads that taper and merge, lanes, viaducts that stand clear of what's below.
- Good: no saved world changes: everything new is a default that is the old behaviour, or keyed on one-way roads, which no saved world has.
- Good: one model: lanes, one-way, pillars and rail are settings of a road, so trips, traffic, flows, junctions and the editor all work with each without special cases.
- Bad: the junction rules differ between a junction with a one-way road and one without; the ADR and the guide say so, and per-junction `leadsTo` covers anything else.
- Bad: two opt-ins whose schema default differs from what the editor writes (`pillarsKeepClear`, `standsOnPillars`), so an AI must be told to set them; the descriptions and the guide's example do.
- Bad: point choices are by index, so every edit of a road's points keeps them (as gates are kept); a world written with indices past its points gets a warning.
- Bad: traffic does more work per vehicle on multi-lane roads (a lane check when overtaking) and at interchanges (merging queues).

## More information

ADR-0017, ADR-0018 (heights, pillars), ADR-0022 (centre lanes), ADR-0023 (widths per point), ADR-0031 (two-way routes), ADR-0042 (traffic), ADR-0053 (renamed ids), ADR-0086 (batching), ADR-0104 (vocabulary), ADR-0106 (old worlds), ADR-0112 (flows), ADR-0117 (validate), ADR-0118 (patches), ADR-0133 (gates kept through edits), ADR-0135 (flow vehicle size), ADR-0136 (junctions), ADR-0147 (flows that drive on). Code: `src/scene/roads.ts`, `src/scene/pillars.ts`, `src/scene/junctions.ts`, `src/scene/network.ts`, `src/scene/routes.ts`, `src/scene/traffic.ts`, `src/scene/flows.ts`, `src/render/RoadMesh.tsx`, `src/render/JunctionMesh.tsx`, `src/render/RoadFlow.tsx`, `src/render/traffic.tsx`, `src/ui/RoadInspector.tsx`, `src/ui/RoadPointPanel.tsx`, `src/ui/RoadDataTab.tsx`, `src/parts/validateWorld.ts`, `src/guide/guide.ts`.
