---
status: proposed
date: 2026-10-29
---

# 0103. Fences: drawn lines with styles, next to roads and areas

## Context and problem statement

Worlds have no fences, walls or hedges. A farm, a garden, a quay, a building site or a motorway all need one. A row of placed objects won't do it: lining posts up by hand is slow, they don't follow a curve, and changing the fence means changing every piece. The owner asked for fences as a drawn line of their own kind, like roads (TODO, 2026-10-26). That was chosen over a fence only along an area's edge. It should come with several looks, take more styles easily, and stay data-capable (ADR-0019).

## Decision drivers

- Drawn and reshaped exactly as roads are, with the same tools: click points, drag handles, insert by the dots between points, the move gizmo, G and the arrow keys, box selection, copy and paste (ADR-0017, ADR-0018, ADR-0064 to ADR-0068).
- Several looks to start with, and a new look is one file (like parts, ADR-0043), numbered for variants (ADR-0050).
- It stands on the ground under it: on raised land, slopes and peaks (ADR-0096, ADR-0098, ADR-0101), stepping at cliff edges, without anyone setting heights.
- Cheap: a fence of hundreds of posts is a draw call or two, not hundreds (PERFORMANCE.md, ADR-0092).
- Data where it fits: colours from data, like objects' (ADR-0060), and how much of it is built.
- `scene/` stays free of three.js; old worlds open unchanged (ADR-0026, ADR-0056).

## Considered options

1. **A `fences` list of its own**, each a line of points with a style, sharing the road tools.
2. **Fence styles as road styles**: free editing, but a fence would be a vehicle route with lanes, markings and supports, in the Roads group of the outliner.
3. **Fence along an area's edge** (a setting on areas): no fences that don't enclose something, and no gaps.
4. **Fence posts as placed objects** with a "repeat along a line" tool: hundreds of objects per fence, edited one by one.

## Decision outcome

Chosen option: **1**. Fences are a third drawn kind next to roads and areas.

**The format** (`FenceSchema`, `scene.fences`, default empty, so worlds without it don't change):
- `style` (`FenceStyleSchema`): `picket_fence_01`, `rail_fence_01` (farm), `chain_link_fence_01`, `stone_wall_01`, `hedge_01`, `railing_01` (quays, bridges), `guard_rail_01` (roadsides).
- `points`: `[x, z]` or `[x, z, lift]` (read as `[x, z, 0]`). The lift raises the fence above the ground at that point, for a fence on a wall or along a bridge. `loops` closes it. `cornerRadius` (default 0, sharp corners) rounds its corners with the roads' curves (`roadCenterline`), for hedges and curved railings.
- `height` and `postSpacing`: `null` uses the style's own (ADR-0027).
- `colors`: by the style's colour ids, each an `EntityColorSchema` like an object's (ADR-0060). So a colour can be set, reset and follow data (a site's status) with the code objects use (`resolveColor`, `PartColorsSection`).
- `builtShare` (0 to 1, default 1): how much of it is built, from its first point. With `data.builtShare` it follows a data value (value ÷ valueAtFull), e.g. a construction fence that grows with a project's progress. Fences' binding maps are renamed and dropped with their data value, like objects' (`fenceBindingMapsOf` in `scene/dataBindings`).
- `name`, `locked` and `hidden`, as on roads and areas. Each field has a `.describe()` for `/schema.json` (ADR-0034).

**The layout** (`scene/fences.ts`, pure and tested): `fenceLayout` turns a fence into posts and spans:
1. The line is the roads' rounded centre line, its lift eased between points.
2. The line breaks into runs at its ends and at every corner sharper than `CORNER_ANGLE`. A post stands at each break, and the run between is shared out evenly, so no gap is longer than `postSpacing` and the corners always have a post.
3. Each post stands on the ground there (`groundHeightAt`) plus the lift. Where the ground steps by more than `GROUND_STEP` between samples (a cliff's edge), a post is added at the step. That way the fence steps down with the land instead of floating over it.
4. `builtShare` cuts the layout that far along its length.

A span is a straight piece from one post to the next. On a curve, the spans are its chords, as a real fence on a curve is built.

**The looks** (`src/fences/`, one file per style, registered in `FENCE_STYLES` in `fences/registry.ts`): `defineFenceStyle` gives a style its name, a description, search keywords, its own height and post spacing, its colours (`IColorSpec`, as parts list them, with see-through ones for a chain-link mesh), whether it has posts, and a `build` that adds pieces for the posts and spans. It uses the `FenceBuilder` primitives: a post, a beam between two posts that follows the slope, a flat profile extruded along a span (pointed pickets), a lump (hedge tops), all by colour id. The builder merges every piece of one colour into one geometry. A fence draws one mesh per colour (one to three draw calls) and rebuilds only when the fence, its ground or its colours change. A registry test checks that every style in the schema has a file, and that each builds something.

Dependencies: `fences/` sits next to `parts/` (`render → editor → fences → parts → scene`). It uses the parts' colour model and three.js, so it can't live in `scene/`.

**Editing**, as roads:
- **Draw:** Add to scene → Fences lists each style with a picture, then click points on the ground (the roads' draw tool and drawing bar: Enter or double-click finishes, clicking the first point closes a loop, Backspace takes back a point, Esc cancels). The shortcut is **Shift+F** (F frames the selection).
- **Reshape:** a selected fence gets point handles, insert dots, the point gizmo (with an arrow for the lift), several points at once (Shift or Ctrl-click, box selection) and the whole-fence gizmo (ADR-0066). The selection's point and gizmo code takes fences next to roads and areas: a fence's points move with the same `transformPoints` and group transforms as a road's, their third value a lift instead of a height. The handles sit on the fence's top, not on the ground. A fence takes clicks in an invisible band round its line (thin pickets are hard to hit), and that band would cover handles at its foot.
- **Clicking it:** that band is a mesh that isn't drawn (`visible={false}`; three's raycasting doesn't skip what isn't drawn), so it costs no draw call.
- **Points:** position, lift, Delete point, Split fence here (Open loop here) and Continue drawing at an end, as for roads.
- **Properties** (`fenceTabs`): *Fence* (name, style, lock, delete, length and posts), *Shape* (the selected point, loop, curves, height, post spacing, how much is built), *Look* (its colours, from data or by hand).
- Fences are in the outliner (their own group), the Scene's item menus, framing, hover highlights, hiding, locking, duplicating, deleting, copy and paste (the clipboard's `fences`), and the group transforms.
- Selection stays exclusive across kinds, now with `selectedFenceId` (ADR-0021, ADR-0064).

Brightwater, the starter world, has a few: a railing along the marina, a chain-link fence round the logistics yard, a stone wall on the hilltop by the lookout, hedges by the park and a paddock's rail fence.

**Not in this version** (later): gates (a gap or a swinging gate at a point, open or shut from data); joining two fences by dragging an end onto another (Continue drawing covers most of it); **Fence along the edge** on an area; fences that follow a road's height on a bridge by themselves (set the lift for now); more styles (`bollards_01`, `crowd_barrier_01`, `wattle_fence_01`, …).

### Consequences

- Good: fences, walls and hedges in a few clicks, with all the editing roads have, on any ground.
- Good: a new look is one file with a `build` from a handful of primitives, and gets the palette, the inspector, `/schema.json` and the colour settings by itself.
- Good: colours and how much is built follow data.
- Bad: a third drawn kind adds a branch to every place that handles roads and areas (selection, outliner, clipboard, group transforms). Kept small by sharing their helpers where the code allows.
- Bad: a fence's spans are rebuilt whenever the ground under it changes shape. That's cheap for a fence, but a world of many long fences on an area being reshaped redraws them all for each move.
