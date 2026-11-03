---
status: proposed
date: 2026-11-03
---

# 0124. Shapes to build from, and handles that size an object along each axis

## Context and problem statement

Every part is a finished thing (a house, a tree, a car), sized by a uniform scale and a few props of its own. People who want something no part draws (a monument, a stadium's stand, a bar chart in 3D) have nothing to build it from. 3D tools start from plain shapes (a box, a ball, a cylinder…) pulled into place side by side; this is also where prefabs lead (`TODO.md`): a build made of shapes, shared as one thing.

## Decision drivers

- Shapes are parts like any other (ADR-0005, ADR-0043): saved, copied, painted, following data and drawn together (ADR-0086) with no special path.
- They fit each other: exact sizes on every axis, in grid units, meeting edge to edge.
- Sizing along one axis is a drag, as in a 3D tool, not only a typed number.
- Data stays a pillar (ADR-0019): a shape's height or arc from a value is a bar or a pie slice.

## Considered options

1. Shapes as parts in a category of their own, sized by props, with handles for parts that say which props size them.
2. A new kind of thing in the world (like roads and areas) with its own schema.
3. Shapes sized only by the object's scale, made non-uniform.

## Decision outcome

Chosen option: **1**.

- **The Shapes category** (`src/parts/shapes/`): Box (rounded edges, hollow), Ball, Cylinder, Cone, Pyramid, Wedge, Corner wedge, Dome, Capsule, Ring, Panel (a wall with an opening), Arch and Stairs. Each fills exactly its width × depth × height whatever its number of sides, standing on the ground (`shapeKit.tsx`: one builder sweeps an outline round the upright axis for the round ones, `solidGeometry` makes the corner wedge, `openingKit.ts` the panel and the arch). Round ones can go part of the way round (Arc), several can be hollow. Sizes are set in quarters on the slider (`sliderMin`, a new field option: the slider's steps count from it while any size from 0.05 can be typed).
- **Every shape has one colour,** Surface, mid grey by default and see-through when set (ADR-0090), a **Finish** (matte, satin, glossy, metal) and a **Glow** light.
- **Lights that start off:** a part's light can say `whenOn: "off"`, how objects switch it until they say otherwise (the Lights tab shows When: Never as its default). The shapes' glow uses it: a shape glows only when it's told when (After dark, Always, On a schedule or From data).
- **Size handles:** a part lists the props that size it along its own axes (`sizeAlong: { x, y, z }`). The selected object then gets a handle on each side and on its top (`render/SizeHandles.tsx`): a ball in its axis's colour, like the move arrows (X red, up green, Z blue), so it's told from the gizmo's cube that resizes the whole object by its shape too, drawn inside its turned and scaled group so they sit on its sides however it's turned or tipped. Dragging one moves that side along its axis: the size changes by the distance, snapped to the field's step (Alt or snapping off: freely), and the middle moves half of it, so the opposite side stays where it is; the top grows from the base, so nothing moves. One undo step per drag; Esc or a right click cancels it. A size that follows data has no handle (it's drawn as the data says, ADR-0109).
- **Size handles on other parts:** parts whose props are their drawn size list them too: the buildings' width and depth (warehouse, house, barn, depot, factory, school, both shops, café, church, greenhouse), the warehouse's, depot's and house's height (the house's wall height, the roof riding on it), the Zone's width and depth, and long things' length and width (shipping container, bench, picnic table, planter, log, flower bed, tunnel). A handle sits on the side of the object's footprint, as its selection frame does, so where the footprint takes in an eave, an awning or a flagpole it stands that far out; a test checks that each listed size grows its footprint or height by just as much (`parts/registry.test.ts`).

### Consequences

- Good: anything can be built from shapes, and built things are ordinary objects (copy, paste, paint, data, viewpoints).
- Good: any part can get size handles by listing its size props (zones, buildings, containers), with no code of its own.
- Bad: a build of many shapes is many objects: moving it is a group move, and there's no "one thing" until prefabs.
- Later: stacking, where a shape dragged onto another lands on its top as it does on raised land (ADR-0098); handles on buildings sized in floors, the top handle adding whole floors.

## More information

`src/parts/shapes/`, `src/render/SizeHandles.tsx`, `src/parts/types.ts` (`sizeAlong`, `sliderMin`, `ILightSpec.whenOn`), `src/parts/lightModel.ts` (`whenOnOf`). Tests: `src/parts/shapes/shapeKit.test.ts`, `e2e/shapes.spec.ts`. Related: ADR-0058, ADR-0060, ADR-0086, ADR-0090, ADR-0097, ADR-0098, ADR-0109.
