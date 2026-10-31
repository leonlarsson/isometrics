---
status: proposed
date: 2026-10-31
---

# 0112. Roads that show flows: vehicles each way, from a value or a row

## Context and problem statement

Data maps often show movement: players shared between games, goods between depots, people between districts. Roads and traffic exist (ADR-0017, ADR-0022, ADR-0042), but vehicles are objects placed one by one, and nothing about a road could follow data except its colour.

## Decision drivers

- Readable without colour (the owner is colourblind): how much and which way must show by count, direction, width and shape.
- A road follows a row of a "from, to, amount" table like objects do (ADR-0108).
- No new objects in the world per vehicle: a flow of 30 vehicles is one setting, not 30 things to manage.
- Cheap: vehicles batch like any part (ADR-0086).

## Considered options

1. Make the number of vehicle objects on a road follow data (adding and removing objects).
2. A flow drawn by the road itself: a `flow` group (`isOn`, `vehicleKind`, `vehicleCountAlong`, `vehicleCountAgainst`, `speed`, `showsArrows`), with the counts and the road's width able to follow data through the road's `data` map.

## Decision outcome

Chosen option: **2**. A road's flow is vehicles on one-way streams (`createOneWaySampler`): along its points in that way's lane, and the other way in the other lane, evenly spaced, growing in at the start and shrinking out at the end of the road so the jump back isn't seen. Chevrons lie on the road every five units pointing the bigger flow's way. `roadAsDrawn` (`editor/roadFlows.ts`) gives the road with its width and counts from data (a range, straight or log, ADR-0109); roads read their row's columns as `row.<column>`.

**Draw a road for each row…** (a table's viewer, when it has two columns of names) draws a road from the object its from column names to the one its to column names (matched loosely, from edge to edge), following its row, its vehicles from none to the most chosen as the amount goes from 0 to the column's largest. A toast names rows whose ends weren't found.

The road's **Data** tab: Table row, Flow (By hand / From data for each count) and Width from data. Flow vehicles aren't objects: they aren't selectable, don't overtake, and don't join the traffic of ADR-0042.

### Consequences

- Good: a flow map in one step from a table; readable by count, direction, width and arrows.
- Bad: roads cross without junctions (ADR-0017), so a dense flow map overlaps; drawing roads as curves round clusters is by hand.

## More information

`editor/roadFlows.ts`, `render/RoadFlow.tsx`, `ui/RoadDataTab.tsx`, `ui/RoadRowsDialog.tsx`, `scene/routes.ts` (`createOneWaySampler`).
