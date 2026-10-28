---
status: proposed
date: 2026-10-28
---

# 0096. Area corners with their own heights: slopes and ramps

## Context and problem statement

Any area can be raised ("Raised by", ADR-0021, ADR-0054), but only as a flat-topped block with cliff sides, and only from a slider in the Shape tab, which is easy to miss. Worlds want slopes, ramps up to a plateau, hills and banks. Roads already have a height per point (ADR-0018), lifted with the green arrow and G then Y. The owner has also thought about block modelling (a shapeable block for buildings and props); an area whose corners each have a height is a first step towards it.

## Decision drivers

- Saved worlds open and look as they did (ADR-0026, ADR-0056): a corner without a height of its own is as today.
- The same tools as road points: the green arrow on the selected corners, several at once (ADR-0065), G then Y, and a Height field.
- Raising a whole area keeps its slopes.
- The low-poly look: flat faces, no smoothing.
- `scene/` stays free of three.js, so the surface's height at a point can be worked out there (painting, later snapping).

## Considered options

1. **An absolute height per corner**, the area's height for corners without one: raising the whole area would have to change every corner that has its own.
2. **A lift per corner on top of the area's height** (`[x, z, lift]`), which can be negative down to the ground.
3. **A height map or terrain mesh** under the whole world: far more than this step needs, and a different model from areas.

## Decision outcome

Chosen option: **2**.

- An area's `points` are `[x, z]` or `[x, z, lift]`. The top at a corner stands at `height + lift`, never below the ground. Flat corners stay `[x, z]` in files, so worlds that don't use it don't change.
- **Drawing:** an area whose top is above the ground anywhere is solid. Its top is cut into triangles between its corners (ear clipping, `triangulateOutline` in `scene/areas`), each tilted to its corners' heights and flat-shaded. Its sides run down to the ground, and a side whose two corners are on the ground disappears, so a corner at 0 makes a ramp. Flat areas are drawn as before (water's reflections included).
- **Editing:** corner handles stand at their own heights. The selected corners get the move gizmo with its green arrow, like road points, and G then Y lifts them. The Corner panel has a **Height** field, from the area while the corner has no lift of its own, with Reset. A new corner inserted between two others takes the height between theirs, so it doesn't dent a slope. Moving corners keeps their lift.
- **The whole area:** "Raised by" stays the area's height, and now the whole-area gizmo (ADR-0066) has a lift arrow too, which changes it. Corners keep their lifts on top, so a slope rises as a whole.
- **Water stays level** (the owner, 2026-10-28): reflections need a level plane, so area types say whether their corners take heights (`staysLevel` in `AREA_TYPES`), and water's don't: its Corner panel shows Height greyed out, saying why, and its corners' gizmo has no lift arrow. Water raised as a whole keeps its reflections, its surface mirroring at its height above cliff sides (raised water lost them before). A corner's lift kept from another type is left alone and ignored while it's water.
- **Standing on it:** `areaTopAt(area, point)` gives the top's height anywhere inside, from the same triangles the mesh uses. Painting stands objects on the slope (ADR-0091). Selection outlines, hover outlines, box selection and framing follow each corner's height.

### Consequences

- Good: slopes, ramps and wedges, raised land that meets the ground on one side, all with the tools people already use for roads.
- Good: old worlds and files are unchanged.
- Bad: which diagonal a four-cornered top folds along is the triangulation's choice, not the user's; adding a corner in the middle of an edge changes it.
- Bad: heights are only at the outline's corners, so a peak is always on the edge, with a cliff behind it: ramps, wedges and slopes, but not a rounded hill. Points with a height inside an area (peaks) would make hills.
- Later: sloped water (a stream down a hill) drawn without reflections, if it's wanted.
- Later: objects dropped or dragged onto raised areas and slopes standing on them (painting does already), roads following a slope, and holes. For block modelling: a bottom per corner as well as a top, so a block can float or overhang, and blocks as objects that can be turned and copied like parts.
